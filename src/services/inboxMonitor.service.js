/**
 * src/services/inboxMonitor.service.js
 * IMAP Monitoring service for cold email SaaS:
 * - Automated SMTP Bounce Detection (DSNs) with mailbox relocation.
 * - Lead Reply Detection with AI Intent Categorization & Workspace Suppression.
 * - Warmup Engine Spam Recovery & Folder Rescuing.
 */

const { ImapFlow } = require('imapflow');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../utils/crypto');
const { categorizeEmailReply } = require('./aiCategorizer.service');
const { parseBounceEmail } = require('../utils/bounceDetector');
const { evaluateCampaignEmergencyBrake } = require('./emergencyBrake.service');

const prisma = new PrismaClient();

const CONNECTION_TIMEOUT_MS = 20000;

/**
 * Creates and configures an ImapFlow client for a given ConnectedEmail account.
 */
function createImapClient(account) {
  const decryptedPass = decrypt(account.encryptedImapPass);
  const decryptedUser = account.encryptedImapUser
    ? decrypt(account.encryptedImapUser)
    : account.email;

  return new ImapFlow({
    host: account.encryptedImapHost,
    port: account.imapPort || (account.imapSecure ? 993 : 143),
    secure: account.imapSecure,
    auth: {
      user: decryptedUser,
      pass: decryptedPass,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: CONNECTION_TIMEOUT_MS,
  });
}

/**
 * Discovers the Spam / Junk mailbox path across different email providers.
 */
async function findSpamMailboxPath(client) {
  const mailboxes = await client.list();

  for (const box of mailboxes) {
    if (box.specialUse === '\\Junk') {
      return box.path;
    }

    const normalizedName = (box.name || box.path || '').toLowerCase();
    if (
      normalizedName === 'spam' ||
      normalizedName === 'junk' ||
      normalizedName === 'junk email' ||
      normalizedName.endsWith('/spam') ||
      normalizedName.endsWith('/junk')
    ) {
      return box.path;
    }
  }

  return null;
}

/**
 * Discovers the Trash or Archive mailbox path to move processed bounces out of the Primary inbox.
 */
async function findTrashOrArchiveMailboxPath(client) {
  const mailboxes = await client.list();

  // 1. Check RFC 6154 special-use flags
  for (const box of mailboxes) {
    if (box.specialUse === '\\Trash' || box.specialUse === '\\Archive') {
      return box.path;
    }
  }

  // 2. Name heuristics
  for (const box of mailboxes) {
    const normalized = (box.name || box.path || '').toLowerCase();
    if (
      normalized === 'trash' ||
      normalized === 'bin' ||
      normalized === 'deleted items' ||
      normalized === 'archive' ||
      normalized.endsWith('/trash') ||
      normalized.endsWith('/bin') ||
      normalized.endsWith('/archive')
    ) {
      return box.path;
    }
  }

  return null;
}

/**
 * Downloads the complete raw RFC 822 email buffer from IMAP.
 *
 * @param {ImapFlow} client
 * @param {number} messageUid
 * @returns {Promise<Buffer|null>}
 */
async function downloadRawEmailBuffer(client, messageUid) {
  try {
    const { content } = await client.download(messageUid, undefined, { uid: true });
    const chunks = [];
    for await (const chunk of content) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.warn(`[InboxMonitor] Failed to download raw message UID ${messageUid}:`, err.message);
    return null;
  }
}

/**
 * Extracts plain text content from a raw RFC 822 email buffer.
 *
 * @param {Buffer} rawBuffer
 * @returns {string}
 */
function extractBodyFromBuffer(rawBuffer) {
  if (!rawBuffer) return '';
  const rawString = rawBuffer.toString('utf8');
  const headerSplit = rawString.split(/\r?\n\r?\n/);
  let body = headerSplit.length > 1 ? headerSplit.slice(1).join('\n\n') : rawString;

  return body
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * Handles an identified SMTP bounce notification:
 * 1. Matches the bounced lead in PostgreSQL across active campaigns tied to this ConnectedEmail.
 * 2. Updates the Lead's status to 'BOUNCED' and clears `nextContactAt` so the queue immediately skips them.
 * 3. Logs the event in `EmailAnalytics` and `EmailActivityLog`.
 * 4. Relocates the bounce notification to the Trash/Archive mailbox to keep Unibox uncluttered.
 *
 * @param {ImapFlow} client
 * @param {Object} account
 * @param {Object} message - IMAP message object
 * @param {Object} bounceInfo - Result from parseBounceEmail
 * @param {string|null} trashPath
 */
async function handleBounceEvent(client, account, message, bounceInfo, trashPath) {
  console.warn(
    `[InboxMonitor] Processing SMTP Bounce for target: '${bounceInfo.bouncedEmail}' (Type: ${bounceInfo.bounceType}) - Reason: ${bounceInfo.reason}`
  );

  // 1. Fetch campaigns actively linked to this connected email inbox
  const accountWithCampaigns = await prisma.connectedEmail.findUnique({
    where: { id: account.id },
    include: {
      campaignLinks: {
        select: { campaignId: true },
      },
    },
  });

  const activeCampaignIds = accountWithCampaigns?.campaignLinks.map((l) => l.campaignId) || [];

  let bouncedLead = null;

  // 2. Query Lead table for the bounced recipient across campaigns tied to this inbox
  if (bounceInfo.bouncedEmail) {
    if (activeCampaignIds.length > 0) {
      bouncedLead = await prisma.lead.findFirst({
        where: {
          workspaceId: account.workspaceId,
          email: { equals: bounceInfo.bouncedEmail, mode: 'insensitive' },
          campaignId: { in: activeCampaignIds },
        },
      });
    }

    // Fallback: search workspace-wide
    if (!bouncedLead) {
      bouncedLead = await prisma.lead.findFirst({
        where: {
          workspaceId: account.workspaceId,
          email: { equals: bounceInfo.bouncedEmail, mode: 'insensitive' },
        },
      });
    }
  }

  // 3. Update Lead and Analytics in PostgreSQL
  if (bouncedLead) {
    console.log(`[InboxMonitor] Matched bounced lead: ${bouncedLead.email} (ID: ${bouncedLead.id})`);

    await prisma.$transaction([
      // A. Update Lead status to BOUNCED and clear next scheduled sequence step
      prisma.lead.update({
        where: { id: bouncedLead.id },
        data: {
          status: 'BOUNCED',
          hasBounced: true,
          nextContactAt: null, // Critical: stops sending queue from executing any future follow-up steps
        },
      }),

      // B. Increment campaign bounce rate metrics in EmailAnalytics
      ...(bouncedLead.campaignId
        ? [
            prisma.emailAnalytics.upsert({
              where: { campaignId: bouncedLead.campaignId },
              update: {
                bouncedCount: { increment: 1 },
              },
              create: {
                campaignId: bouncedLead.campaignId,
                totalLeads: 1,
                bouncedCount: 1,
              },
            }),
            prisma.emailActivityLog.create({
              data: {
                eventType: 'BOUNCED',
                campaignId: bouncedLead.campaignId,
                leadId: bouncedLead.id,
                connectedEmailId: account.id,
                bounceReason: bounceInfo.reason,
                messageId: message.envelope?.messageId || null,
              },
            }),
          ]
        : []),
    ]);

    // 3.5. Campaign Emergency Brake check:
    // If total sent > 50 and bounce rate > 8%, immediately pause campaign and alert workspace owner
    if (bouncedLead.campaignId) {
      try {
        await evaluateCampaignEmergencyBrake(bouncedLead.campaignId);
      } catch (brakeErr) {
        console.error('[InboxMonitor] Error during emergency brake evaluation:', brakeErr.message);
      }
    }
  } else {
    console.log(`[InboxMonitor] Bounced recipient '${bounceInfo.bouncedEmail}' not found in active leads.`);
  }

  // 4. Move the bounce email out of Primary INBOX to Trash or Archive
  try {
    await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });

    if (trashPath) {
      await client.messageMove(message.uid, trashPath, { uid: true });
      console.log(`[InboxMonitor] Moved bounce email UID ${message.uid} -> ${trashPath}`);
    } else {
      // If no trash folder detected, mark as deleted
      await client.messageDelete(message.uid, { uid: true });
      console.log(`[InboxMonitor] Deleted bounce email UID ${message.uid} from INBOX`);
    }
  } catch (moveErr) {
    console.warn(`[InboxMonitor] Could not relocate bounce email UID ${message.uid}:`, moveErr.message);
  }
}

/**
 * Scans the Primary Inbox for unread messages:
 * 1. Passes raw RFC 822 email source to `parseBounceEmail` for automated bounce detection.
 * 2. If it is a bounce, updates Lead/Analytics and moves message to Trash.
 * 3. If it is a regular reply, triggers AI auto-categorization and workspace suppression.
 *
 * @param {ImapFlow} client
 * @param {Object} account
 * @returns {Promise<{ repliesCount: number, bouncesCount: number }>}
 */
async function processInboxMessages(client, account) {
  let repliesCount = 0;
  let bouncesCount = 0;

  const lock = await client.getMailboxLock('INBOX');
  const trashPath = await findTrashOrArchiveMailboxPath(client);

  try {
    const fetchQuery = { seen: false };
    const fetchOptions = {
      uid: true,
      envelope: true,
      headers: ['in-reply-to', 'references', 'subject', 'content-type'],
    };

    for await (const message of client.fetch(fetchQuery, fetchOptions)) {
      // Download raw RFC 822 message content
      const rawBuffer = await downloadRawEmailBuffer(client, message.uid);
      if (!rawBuffer) continue;

      // ========================================================================
      // PATH A: Automated SMTP Bounce & DSN Detection
      // ========================================================================
      const bounceInfo = await parseBounceEmail(rawBuffer);

      if (bounceInfo.isBounce) {
        await handleBounceEvent(client, account, message, bounceInfo, trashPath);
        bouncesCount++;
        continue; // Handled as bounce -> proceed to next email
      }

      // ========================================================================
      // PATH B: Regular Lead Reply & AI Intent Classification
      // ========================================================================
      const senderEmail = message.envelope?.from?.[0]?.address?.toLowerCase();
      if (!senderEmail) continue;

      const inReplyToRaw = message.headers?.get('in-reply-to');
      const inReplyTo = Array.isArray(inReplyToRaw) ? inReplyToRaw[0] : inReplyToRaw;

      // Match Lead by Message-ID or Email Address
      let matchedLead = null;
      let matchedCampaignId = null;

      if (inReplyTo) {
        const cleanMessageId = inReplyTo.replace(/[<>]/g, '').trim();
        const activity = await prisma.emailActivityLog.findFirst({
          where: {
            messageId: { contains: cleanMessageId },
            eventType: 'SENT',
          },
          include: { lead: true },
        });

        if (activity?.lead) {
          matchedLead = activity.lead;
          matchedCampaignId = activity.campaignId;
        }
      }

      if (!matchedLead) {
        matchedLead = await prisma.lead.findFirst({
          where: {
            workspaceId: account.workspaceId,
            email: { equals: senderEmail, mode: 'insensitive' },
            status: { in: ['CONTACTED', 'UNTOUCHED'] },
          },
        });
        matchedCampaignId = matchedLead?.campaignId;
      }

      if (matchedLead) {
        console.log(`[InboxMonitor] Detected reply from lead: ${matchedLead.email} (Campaign: ${matchedCampaignId})`);

        // Extract message body text
        const replyBodyText = extractBodyFromBuffer(rawBuffer) || message.envelope?.subject || '';
        const emailSubject = message.envelope?.subject || 'Re: Outreach';

        // AI Intent Classification
        const aiClassification = await categorizeEmailReply(replyBodyText, emailSubject);
        console.log(
          `[InboxMonitor] AI Auto-Categorized reply as: [${aiClassification.tag}] - ${aiClassification.reason}`
        );

        const isNegativeIntent =
          aiClassification.tag === 'DO_NOT_CONTACT' ||
          aiClassification.tag === 'NOT_INTERESTED';

        // Update Lead record
        await prisma.lead.update({
          where: { id: matchedLead.id },
          data: {
            status: 'REPLIED',
            hasReplied: true,
            aiTag: aiClassification.tag,
            aiReason: aiClassification.reason,
            isDoNotContact: isNegativeIntent,
            hasUnsubscribed: isNegativeIntent ? true : matchedLead.hasUnsubscribed,
            lastRepliedAt: new Date(),
            nextContactAt: null, // Clear scheduled drips
          },
        });

        // Workspace-wide suppression for negative intent
        if (isNegativeIntent) {
          console.warn(
            `[InboxMonitor] Suppressing '${matchedLead.email}' across all campaigns in workspace '${account.workspaceId}'`
          );

          await prisma.lead.updateMany({
            where: {
              workspaceId: account.workspaceId,
              email: { equals: matchedLead.email, mode: 'insensitive' },
            },
            data: {
              isDoNotContact: true,
              hasUnsubscribed: true,
              nextContactAt: null,
            },
          });
        }

        // Update Analytics & Activity Log
        if (matchedCampaignId) {
          await prisma.$transaction([
            prisma.emailAnalytics.upsert({
              where: { campaignId: matchedCampaignId },
              update: { repliedCount: { increment: 1 } },
              create: {
                campaignId: matchedCampaignId,
                totalLeads: 1,
                repliedCount: 1,
              },
            }),
            prisma.emailActivityLog.create({
              data: {
                eventType: 'REPLIED',
                campaignId: matchedCampaignId,
                leadId: matchedLead.id,
                connectedEmailId: account.id,
                messageId: message.envelope?.messageId || null,
                replySnippet: replyBodyText.slice(0, 300) || emailSubject,
              },
            }),
          ]);
        }

        repliesCount++;
        await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
      }
    }
  } finally {
    lock.release();
  }

  return { repliesCount, bouncesCount };
}

/**
 * Monitors a single ConnectedEmail inbox for bounces and replies with robust error recovery.
 */
async function monitorAccountInbox(account) {
  const client = createImapClient(account);

  try {
    await client.connect();

    // 1. Process Inbox unread messages (bounces + replies)
    const { repliesCount, bouncesCount } = await processInboxMessages(client, account);

    await prisma.connectedEmail.update({
      where: { id: account.id },
      data: {
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date(),
        lastErrorReason: null,
      },
    });

    return { repliesCount, bouncesCount };
  } catch (err) {
    console.error(`[InboxMonitor] IMAP error on account ${account.email}:`, err.message);

    const isAuthError =
      err.message?.includes('AUTHENTICATE') ||
      err.message?.includes('Invalid credentials') ||
      err.code === 'AUTHENTICATIONFAILED';

    await prisma.connectedEmail.update({
      where: { id: account.id },
      data: {
        connectionStatus: isAuthError ? 'AUTH_FAILED' : 'DISCONNECTED',
        lastCheckedAt: new Date(),
        lastErrorReason: err.message,
      },
    });

    throw err;
  } finally {
    try {
      if (client.usable) await client.logout();
      else client.close();
    } catch {}
  }
}

/**
 * Iterates through all active connected emails in the system.
 */
async function checkAllConnectedInboxes() {
  const accounts = await prisma.connectedEmail.findMany({
    where: {
      connectionStatus: { in: ['CONNECTED', 'DISCONNECTED'] },
    },
  });

  console.log(`[InboxMonitor] Starting poll across ${accounts.length} inboxes...`);

  for (const account of accounts) {
    try {
      await monitorAccountInbox(account);
    } catch {
      console.warn(`[InboxMonitor] Skipping failed account ${account.email} until next cycle.`);
    }
  }
}

module.exports = {
  monitorAccountInbox,
  checkAllConnectedInboxes,
  findSpamMailboxPath,
  findTrashOrArchiveMailboxPath,
  handleBounceEvent,
  processInboxMessages,
};
