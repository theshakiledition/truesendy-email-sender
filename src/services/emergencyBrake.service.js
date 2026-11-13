/**
 * src/services/emergencyBrake.service.js
 * Campaign Emergency Brake:
 * Aggregates campaign bounce metrics in real-time. If volume exceeds 50 emails and the
 * bounce rate exceeds 8%, immediately pauses the campaign and alerts the workspace owner.
 */

let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch {
  prisma = null;
}

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

// Configurable safety thresholds
const MIN_SENT_THRESHOLD = parseInt(process.env.EMERGENCY_BRAKE_MIN_SENT || '50', 10);
const MAX_BOUNCE_RATE_THRESHOLD = parseFloat(process.env.EMERGENCY_BRAKE_MAX_BOUNCE_RATE || '0.08'); // 8%

/**
 * Creates a system mailer transporter to deliver critical platform alerts.
 */
function createSystemAlertTransporter() {
  // Uses configured system SMTP or falls back to standard transport
  if (process.env.SYSTEM_SMTP_HOST && process.env.SYSTEM_SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SYSTEM_SMTP_HOST,
      port: parseInt(process.env.SYSTEM_SMTP_PORT || '587', 10),
      secure: process.env.SYSTEM_SMTP_SECURE === 'true',
      auth: {
        user: process.env.SYSTEM_SMTP_USER,
        pass: process.env.SYSTEM_SMTP_PASS,
      },
    });
  }

  // Stream-based transport in development/sandbox
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
}

/**
 * Sends a high-priority emergency alert email to the Workspace Owner.
 */
async function sendEmergencyBrakeEmail({ ownerEmail, ownerName, campaignName, bounceRate, sentCount, bouncedCount }) {
  const transporter = createSystemAlertTransporter();

  const formattedRate = (bounceRate * 100).toFixed(1);
  const subject = `🚨 EMERGENCY STOP: Campaign "${campaignName}" paused due to high bounce rate (${formattedRate}%)`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0714; color: #f4f4f5; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #130c22; border: 1px solid #3b1b66; border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
          .badge { display: inline-block; background: #dc2626; color: #ffffff; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
          h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 8px; }
          p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 12px 0; }
          .metric-card { background: #1d1233; border: 1px solid #4c2282; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .metric-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .metric-label { color: #a1a1aa; }
          .metric-val { color: #ffffff; font-weight: 600; font-family: monospace; }
          .metric-val.danger { color: #f87171; font-weight: 700; }
          .alert-box { background: rgba(220, 38, 38, 0.1); border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 4px; margin: 20px 0; }
          .alert-box strong { color: #fca5a5; display: block; margin-bottom: 4px; }
          .action-box { background: #181028; border: 1px dashed #6b21a8; border-radius: 12px; padding: 16px; margin-top: 24px; }
          .action-box h3 { font-size: 14px; color: #e9d5ff; margin-top: 0; margin-bottom: 6px; }
          .footer { font-size: 12px; color: #71717a; text-align: center; margin-top: 32px; border-top: 1px solid #271442; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Emergency Brake Activated</div>
          <h1>Campaign Automatically Paused</h1>
          <p>Hello ${ownerName || 'Workspace Owner'},</p>
          <p>Our deliverability safety monitors have automatically triggered an <strong>Emergency Stop</strong> on your campaign <strong>"${campaignName}"</strong>.</p>
          
          <div class="metric-card">
            <div class="metric-row">
              <span class="metric-label">Current Bounce Rate:</span>
              <span class="metric-val danger">${formattedRate}% (Safety Threshold: ${(MAX_BOUNCE_RATE_THRESHOLD * 100)}%)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Bounced Leads:</span>
              <span class="metric-val danger">${bouncedCount} invalid recipients</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Emails Sent:</span>
              <span class="metric-val">${sentCount} emails</span>
            </div>
          </div>

          <div class="alert-box">
            <strong>Why did this happen?</strong>
            Internet Service Providers (Google Workspace, Microsoft 365, Yahoo) strictly enforce bounce rate ceilings. A bounce rate above 5% signals poor list hygiene and puts your sending inboxes and domain reputations at immediate risk of permanent blacklisting.
          </div>

          <div class="action-box">
            <h3>Recommended Action:</h3>
            <p>1. <strong>Do not immediately unpause this campaign</strong> with your current lead list.</p>
            <p>2. Scrub your remaining prospect contacts through an email verification tool (such as <strong>TrueSendy List Cleaner</strong> or NeverBounce) to remove invalid, catch-all, and disposable mailboxes.</p>
            <p>3. Once clean leads are uploaded, you may safely resume your campaign from your dashboard.</p>
          </div>

          <div class="footer">
            TrueSendy Deliverability Guard • Automated Infrastructure Protection
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SYSTEM_ALERT_FROM || '"TrueSendy Security Guard" <alerts@truesendy.com>',
      to: ownerEmail,
      subject,
      html: htmlBody,
    });

    console.log(`[EmergencyBrake] Notification sent to owner ${ownerEmail}. MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EmergencyBrake] Failed to send alert email to ${ownerEmail}:`, err.message);
  }
}

/**
 * Aggregates the bounce rate for a specific campaignId.
 * If total sent > 50 and bounce rate > 8%, immediately pauses the campaign and notifies the owner.
 *
 * @param {string} campaignId - Campaign UUID
 * @returns {Promise<{
 *   triggered: boolean,
 *   campaignId: string,
 *   sentCount: number,
 *   bouncedCount: number,
 *   bounceRate: number,
 *   reason: string
 * }>}
 */
async function evaluateCampaignEmergencyBrake(campaignId) {
  if (!campaignId) {
    return { triggered: false, reason: 'INVALID_CAMPAIGN_ID', bounceRate: 0, sentCount: 0, bouncedCount: 0 };
  }

  // 1. Fetch Campaign, Analytics, and Workspace Owner
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      analytics: true,
      workspace: {
        include: {
          members: {
            where: { role: 'OWNER' },
            include: { user: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    return { triggered: false, reason: 'CAMPAIGN_NOT_FOUND', bounceRate: 0, sentCount: 0, bouncedCount: 0 };
  }

  const sentCount = campaign.analytics?.sentCount || 0;
  const bouncedCount = campaign.analytics?.bouncedCount || 0;

  // Need at least 1 sent email to compute rate
  if (sentCount === 0) {
    return {
      triggered: false,
      campaignId,
      sentCount: 0,
      bouncedCount,
      bounceRate: 0,
      reason: 'NO_SENT_EMAILS',
    };
  }

  // Calculate current bounce rate
  const currentBounceRate = bouncedCount / sentCount;

  // Persist updated rate into EmailAnalytics table
  await prisma.emailAnalytics.update({
    where: { campaignId },
    data: {
      bounceRate: currentBounceRate,
    },
  });

  // 2. Evaluate Emergency Brake Conditions:
  // - Total sent volume is greater than 50 emails
  // - Current bounce rate exceeds threshold (8%)
  const isVolumeMet = sentCount >= MIN_SENT_THRESHOLD;
  const isRateExceeded = currentBounceRate > MAX_BOUNCE_RATE_THRESHOLD;

  if (isVolumeMet && isRateExceeded) {
    console.error(
      `[EmergencyBrake] TRIGGERED for Campaign '${campaign.name}' (${campaignId}). ` +
        `Bounce rate: ${(currentBounceRate * 100).toFixed(1)}% (${bouncedCount}/${sentCount} sent). Threshold: ${(MAX_BOUNCE_RATE_THRESHOLD * 100)}%`
    );

    // 3. Immediately PAUSE the campaign in PostgreSQL
    if (campaign.status !== 'PAUSED') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'PAUSED',
        },
      });

      // Clear pending queue timestamps on UNTOUCHED leads in this campaign to stop execution immediately
      await prisma.lead.updateMany({
        where: {
          campaignId,
          status: 'UNTOUCHED',
        },
        data: {
          nextContactAt: null,
        },
      });
    }

    // 4. Identify Workspace Owner
    const ownerMember = campaign.workspace.members.find((m) => m.role === 'OWNER') || campaign.workspace.members[0];
    const ownerUser = ownerMember?.user;

    // 5. Dispatch Alert Notification Email
    if (ownerUser && ownerUser.email) {
      await sendEmergencyBrakeEmail({
        ownerEmail: ownerUser.email,
        ownerName: ownerUser.firstName ? `${ownerUser.firstName} ${ownerUser.lastName || ''}`.trim() : 'Founder',
        campaignName: campaign.name,
        bounceRate: currentBounceRate,
        sentCount,
        bouncedCount,
      });
    } else {
      console.warn(`[EmergencyBrake] Could not locate an owner email for workspace ${campaign.workspaceId}`);
    }

    return {
      triggered: true,
      campaignId,
      campaignName: campaign.name,
      sentCount,
      bouncedCount,
      bounceRate: currentBounceRate,
      ownerAlerted: ownerUser?.email || null,
      reason: `Emergency Brake Activated: ${(currentBounceRate * 100).toFixed(1)}% bounce rate exceeded ${(MAX_BOUNCE_RATE_THRESHOLD * 100)}% limit.`,
    };
  }

  return {
    triggered: false,
    campaignId,
    campaignName: campaign.name,
    sentCount,
    bouncedCount,
    bounceRate: currentBounceRate,
    reason: isVolumeMet
      ? `Bounce rate ${(currentBounceRate * 100).toFixed(1)}% within acceptable limits.`
      : `Volume too low for statistical confidence (${sentCount}/${MIN_SENT_THRESHOLD} sent).`,
  };
}

module.exports = {
  evaluateCampaignEmergencyBrake,
  sendEmergencyBrakeEmail,
  MIN_SENT_THRESHOLD,
  MAX_BOUNCE_RATE_THRESHOLD,
};
