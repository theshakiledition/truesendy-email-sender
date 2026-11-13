/**
 * src/workers/emailSender.worker.js
 * BullMQ background worker implementing Inbox Rotation (Round-Robin) across many-to-many ConnectedEmails.
 * Features:
 * - Redis-backed daily send tracking per account.
 * - Round-robin lead distribution across healthy inboxes below their daily limit.
 * - Per-account randomized delay (3-9 min jitter) to isolate sender reputations.
 */

const { Worker, Queue } = require('bullmq');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const { decrypt } = require('../utils/crypto');
const { parseTemplate } = require('../utils/templateParser');
const {
  encodeTrackingToken,
  injectTrackingPixel,
  rewriteLinksForClickTracking,
} = require('../utils/tracking.util');
const {
  getAccountDailySentCount,
  incrementAccountDailySentCount,
  getAccountCooldownRemaining,
  setAccountCooldown,
  getNextRoundRobinIndex,
  acquireAccountLock,
  releaseAccountLock,
} = require('./throttler');

const prisma = new PrismaClient();

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisClient = new Redis(redisConfig);
const emailQueue = new Queue('send-email', { connection: redisClient });

/**
 * Resolves the active, VERIFIED custom tracking domain base URL for a campaign.
 * Priority:
 * 1. Campaign's linked customDomain relation (if status === 'VERIFIED')
 * 2. Campaign's raw trackingDomain string (if verified in TrackingDomain table)
 * 3. Default verified TrackingDomain for the workspace
 * 4. System fallback domain (e.g., process.env.TRACKING_CNAME_TARGET || 'https://track.truesendy.com')
 *
 * @param {Object} campaign
 * @param {string} workspaceId
 * @returns {Promise<string>} Base URL without trailing slash (e.g. "https://track.usercompany.com")
 */
async function resolveTrackingBaseUrl(campaign, workspaceId) {
  // 1. Direct relation to a verified TrackingDomain record
  if (campaign.customDomain && campaign.customDomain.status === 'VERIFIED') {
    return `https://${campaign.customDomain.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;
  }

  // 2. Check if raw campaign trackingDomain string is verified in DB
  if (campaign.trackingDomain) {
    const rawClean = campaign.trackingDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const verified = await prisma.trackingDomain.findFirst({
      where: {
        domain: rawClean,
        status: 'VERIFIED',
      },
      select: { domain: true },
    });

    if (verified) {
      return `https://${verified.domain}`;
    }
  }

  // 3. Fallback to workspace default verified custom domain
  if (workspaceId) {
    const defaultDomain = await prisma.trackingDomain.findFirst({
      where: {
        workspaceId,
        status: 'VERIFIED',
        isDefault: true,
      },
      select: { domain: true },
    });

    if (defaultDomain) {
      return `https://${defaultDomain.domain}`;
    }
  }

  // 4. Default system fallback tracking domain
  const fallbackHost = process.env.TRACKING_CNAME_TARGET || 'track.truesendy.com';
  return `https://${fallbackHost.replace(/^https?:\/\//, '')}`;
}

/**
 * Evaluates all ConnectedEmails attached to a campaign, checks their real-time Redis daily
 * quotas, and uses Round-Robin to select an available, non-cooldown inbox.
 *
 * @param {string} campaignId
 * @param {Array} sendingAccounts - CampaignSendingAccount relations with ConnectedEmail
 * @returns {Promise<{ account: Object|null, waitTimeMs: number, reason?: string }>}
 */
async function selectRotatedInbox(campaignId, sendingAccounts) {
  if (!sendingAccounts || sendingAccounts.length === 0) {
    return { account: null, waitTimeMs: 0, reason: 'NO_INBOXES_ATTACHED' };
  }

  // 1. Check Redis daily sent count for each connected inbox
  const eligibleCandidates = [];

  for (const sa of sendingAccounts) {
    const account = sa.connectedEmail;

    // Skip disconnected or auth-failed inboxes
    if (account.connectionStatus !== 'CONNECTED') {
      continue;
    }

    // Daily limit cap: check campaign-specific override or general inbox limit
    const dailyCap = sa.assignedDailyCap || account.dailyLimit;
    const currentSentToday = await getAccountDailySentCount(redisClient, account.id);

    if (currentSentToday < dailyCap) {
      eligibleCandidates.push({
        account,
        currentSentToday,
        dailyCap,
      });
    }
  }

  // If every connected inbox has exhausted its daily limit
  if (eligibleCandidates.length === 0) {
    return { account: null, waitTimeMs: 6 * 60 * 60 * 1000, reason: 'DAILY_QUOTA_EXHAUSTED' };
  }

  // Sort candidates deterministically by ID to ensure stable round-robin ordering
  eligibleCandidates.sort((a, b) => a.account.id.localeCompare(b.account.id));

  // 2. Atomic Round-Robin Selection with Cooldown Bypass
  // Fetch next counter from Redis to evenly distribute across candidate inboxes
  const rrIndex = await getNextRoundRobinIndex(redisClient, campaignId);
  const totalEligible = eligibleCandidates.length;

  let selectedAccount = null;
  let lockedAccountId = null;
  let shortestCooldownMs = Infinity;

  // Iterate starting at (rrIndex % totalEligible) and wrap around
  for (let i = 0; i < totalEligible; i++) {
    const candidateIndex = (rrIndex + i) % totalEligible;
    const { account } = eligibleCandidates[candidateIndex];

    // Check independent per-account cooldown in Redis
    const remainingCooldown = await getAccountCooldownRemaining(redisClient, account.id);

    if (remainingCooldown === 0) {
      // Try to acquire distributed lock for this specific account
      const lockAcquired = await acquireAccountLock(redisClient, account.id, 30000);
      if (lockAcquired) {
        selectedAccount = account;
        lockedAccountId = account.id;
        break; // Successfully reserved available inbox
      }
    } else {
      if (remainingCooldown < shortestCooldownMs) {
        shortestCooldownMs = remainingCooldown;
      }
    }
  }

  // If all eligible accounts are currently in cooldown, return the shortest wait time
  if (!selectedAccount) {
    const waitTime = shortestCooldownMs > 0 && shortestCooldownMs < Infinity ? shortestCooldownMs : 60000;
    return { account: null, waitTimeMs: waitTime, reason: 'ALL_INBOXES_IN_COOLDOWN' };
  }

  return { account: selectedAccount, lockedAccountId, waitTimeMs: 0 };
}

/**
 * Main BullMQ worker job processor.
 */
async function processEmailJob(job) {
  const { leadId, campaignId } = job.data;
  let activeLockId = null;

  try {
    // --------------------------------------------------------------------------
    // 1. Fetch Lead & Verification Checks
    // --------------------------------------------------------------------------
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return { status: 'SKIPPED', reason: 'LEAD_NOT_FOUND' };
    }

    if (lead.hasReplied || lead.hasBounced || lead.hasUnsubscribed || lead.isDoNotContact) {
      return { status: 'SKIPPED', reason: 'LEAD_ALREADY_CONVERTED_OR_BLOCKED' };
    }

    // --------------------------------------------------------------------------
    // 2. Fetch Campaign, Sequence, and Many-to-Many Sending Inboxes
    // --------------------------------------------------------------------------
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        customDomain: true,
        sendingAccounts: {
          include: {
            connectedEmail: true,
          },
        },
        sequences: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      return { status: 'SKIPPED', reason: 'CAMPAIGN_INACTIVE' };
    }

    const currentStepNumber = lead.currentSequenceStep || 1;
    const sequence = campaign.sequences.find((s) => s.stepNumber === currentStepNumber);

    if (!sequence) {
      return { status: 'COMPLETED_SEQUENCE' };
    }

    // --------------------------------------------------------------------------
    // 3. Inbox Rotation (Round-Robin) with Per-Account Daily Limits
    // --------------------------------------------------------------------------
    const {
      account: selectedAccount,
      lockedAccountId,
      waitTimeMs,
      reason,
    } = await selectRotatedInbox(campaignId, campaign.sendingAccounts);

    activeLockId = lockedAccountId;

    // If no inbox can send right now (all throttled or daily cap reached):
    // Re-schedule the job with delay without blocking worker threads!
    if (!selectedAccount) {
      console.log(
        `[Worker] Campaign ${campaign.name} deferring job ${job.id}. Reason: ${reason}. Retry in ${Math.round(waitTimeMs / 1000)}s`
      );
      await emailQueue.add('send-email', job.data, { delay: waitTimeMs + 2000 });
      return { status: 'DEFERRED', reason, retryAfterSeconds: Math.round(waitTimeMs / 1000) };
    }

    console.log(
      `[Worker] Inbox Rotation Selected: ${selectedAccount.email} for Lead: ${lead.email} (Campaign: ${campaign.name})`
    );

    // --------------------------------------------------------------------------
    // 4. Decrypt SMTP Credentials for Selected Inbox
    // --------------------------------------------------------------------------
    const decryptedPass = decrypt(selectedAccount.encryptedSmtpPass);
    const decryptedUser = selectedAccount.encryptedSmtpUser
      ? decrypt(selectedAccount.encryptedSmtpUser)
      : selectedAccount.email;

    const transporter = nodemailer.createTransport({
      host: selectedAccount.encryptedSmtpHost,
      port: selectedAccount.smtpPort,
      secure: selectedAccount.smtpSecure,
      auth: {
        user: decryptedUser,
        pass: decryptedPass,
      },
      connectionTimeout: 15000,
      socketTimeout: 15000,
    });

    // --------------------------------------------------------------------------
    // 5. Parse Email Copy (Variables + Spintax) & Apply Custom Domain Tracking
    // --------------------------------------------------------------------------
    const renderedSubject = parseTemplate(sequence.subject, lead);
    const renderedBody = parseTemplate(sequence.body, lead);

    // Resolve the active, verified custom tracking domain (e.g. "https://track.usercompany.com")
    const trackingBaseUrl = await resolveTrackingBaseUrl(campaign, lead.workspaceId);

    // Generate signed tracking token with metadata
    const trackingToken = encodeTrackingToken({
      campaignId: campaign.id,
      leadId: lead.id,
      sequenceId: sequence.id,
      connectedEmailId: selectedAccount.id,
    });

    let finalHtml = renderedBody;

    if (!campaign.sendAsPlaintext) {
      // Rewrite all <a href="..."> links to route through custom tracking domain:
      // e.g. https://track.usercompany.com/track/c/:token?url=https://destination.com
      if (campaign.trackClicks) {
        finalHtml = rewriteLinksForClickTracking(finalHtml, trackingBaseUrl, trackingToken);
      }

      // Inject the 1x1 transparent open pixel pointing to custom tracking domain:
      // e.g. <img src="https://track.usercompany.com/track/o/:token.gif" ... />
      if (campaign.trackOpens) {
        finalHtml = injectTrackingPixel(finalHtml, trackingBaseUrl, trackingToken);
      }
    }

    // Threading continuity for follow-up steps
    let inReplyToHeader, referencesHeader;
    if (sequence.stepNumber > 1 && sequence.threadReply) {
      const prevLog = await prisma.emailActivityLog.findFirst({
        where: { campaignId, leadId: lead.id, eventType: 'SENT' },
        orderBy: { timestamp: 'desc' },
      });
      if (prevLog?.messageId) {
        inReplyToHeader = prevLog.messageId;
        referencesHeader = prevLog.messageId;
      }
    }

    // --------------------------------------------------------------------------
    // 6. Dispatch Email via Selected Inbox
    // --------------------------------------------------------------------------
    const sendInfo = await transporter.sendMail({
      from: `"${selectedAccount.fromName}" <${selectedAccount.email}>`,
      to: lead.email,
      replyTo: selectedAccount.replyTo || selectedAccount.email,
      subject: renderedSubject,
      html: campaign.sendAsPlaintext ? undefined : finalHtml,
      text: campaign.sendAsPlaintext ? renderedBody : undefined,
      inReplyTo: inReplyToHeader,
      references: referencesHeader,
      headers: {
        'X-Campaign-ID': campaign.id,
        'X-Lead-ID': lead.id,
        'X-Sender-Account': selectedAccount.id,
      },
    });

    // --------------------------------------------------------------------------
    // 7. Enforce Randomized Jitter Delay PER ACCOUNT in Redis (3 to 9 minutes)
    // --------------------------------------------------------------------------
    const MIN_DELAY_SEC = 180; // 3 minutes
    const MAX_DELAY_SEC = 540; // 9 minutes

    // Only THIS specific account enters cooldown; other inboxes remain available!
    const appliedJitterMs = await setAccountCooldown(
      redisClient,
      selectedAccount.id,
      MIN_DELAY_SEC,
      MAX_DELAY_SEC
    );

    // Atomically increment Redis daily sent counter for this inbox
    const newDailySent = await incrementAccountDailySentCount(redisClient, selectedAccount.id);

    console.log(
      `[Worker] Dispatched via ${selectedAccount.email} (Sent today: ${newDailySent}). Cooldown applied: ${Math.round(appliedJitterMs / 1000)}s`
    );

    // --------------------------------------------------------------------------
    // 8. Atomic Postgres Transaction: Update Lead, Analytics, and Inboxes
    // --------------------------------------------------------------------------
    const nextStep = campaign.sequences.find((s) => s.stepNumber === currentStepNumber + 1);
    let nextContactAt = null;

    if (nextStep) {
      const delayMs = (nextStep.delayDays * 24 * 60 + nextStep.delayHours * 60) * 60 * 1000;
      nextContactAt = new Date(Date.now() + delayMs);
    }

    await prisma.$transaction([
      // Update Lead progress
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: 'CONTACTED',
          currentSequenceStep: nextStep ? nextStep.stepNumber : currentStepNumber,
          lastContactedAt: new Date(),
          nextContactAt,
        },
      }),

      // Update ConnectedEmail global stats
      prisma.connectedEmail.update({
        where: { id: selectedAccount.id },
        data: {
          todaySentCount: { increment: 1 },
          lastSentAt: new Date(),
        },
      }),

      // Update junction table for this specific campaign's inbox quota
      prisma.campaignSendingAccount.update({
        where: {
          campaignId_connectedEmailId: {
            campaignId,
            connectedEmailId: selectedAccount.id,
          },
        },
        data: {
          sentCount: { increment: 1 },
        },
      }),

      // Upsert Campaign-level analytics
      prisma.emailAnalytics.upsert({
        where: { campaignId },
        update: {
          sentCount: { increment: 1 },
          deliveredCount: { increment: 1 },
        },
        create: {
          campaignId,
          totalLeads: 1,
          sentCount: 1,
          deliveredCount: 1,
        },
      }),

      // Log granular activity event
      prisma.emailActivityLog.create({
        data: {
          eventType: 'SENT',
          campaignId,
          leadId: lead.id,
          sequenceId: sequence.id,
          connectedEmailId: selectedAccount.id,
          messageId: sendInfo.messageId || null,
        },
      }),
    ]);

    return {
      status: 'SUCCESS',
      messageId: sendInfo.messageId,
      inbox: selectedAccount.email,
      inboxSentToday: newDailySent,
      cooldownSeconds: Math.round(appliedJitterMs / 1000),
    };
  } finally {
    // Always release distributed lock for the chosen account
    if (activeLockId) {
      await releaseAccountLock(redisClient, activeLockId);
    }
  }
}

// ------------------------------------------------------------------------------
// Worker Initialization
// ------------------------------------------------------------------------------
const emailWorker = new Worker('send-email', processEmailJob, {
  connection: redisClient,
  concurrency: 15, // Higher concurrency enabled because inboxes rotate independently!
  lockDuration: 60000,
});

emailWorker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed: ${result.status} (${result.inbox || 'N/A'})`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = {
  emailWorker,
  processEmailJob,
  selectRotatedInbox,
  emailQueue,
};
