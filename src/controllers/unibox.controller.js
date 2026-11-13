/**
 * src/controllers/unibox.controller.js
 * Controller for the Unified Inbox: fetches replied conversations and dispatches direct replies.
 */

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/crypto');

const prisma = new PrismaClient();

/**
 * GET /api/unibox
 * Fetches all leads with status = 'REPLIED', along with their message threads and campaign metadata.
 * Results are sorted by the most recent reply timestamp and grouped by campaign.
 */
async function getRepliedConversations(req, res, next) {
  try {
    const { workspaceId, campaignId } = req.query;

    const whereClause = {
      status: 'REPLIED',
    };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    if (campaignId) {
      whereClause.campaignId = campaignId;
    }

    // Fetch replied leads and their complete audit history
    const repliedLeads = await prisma.lead.findMany({
      where: whereClause,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            timezone: true,
            analytics: true,
          },
        },
        activityLogs: {
          where: {
            eventType: { in: ['SENT', 'REPLIED'] },
          },
          orderBy: { timestamp: 'asc' },
          include: {
            connectedEmail: {
              select: {
                id: true,
                email: true,
                fromName: true,
              },
            },
            sequence: {
              select: {
                stepNumber: true,
                subject: true,
              },
            },
          },
        },
      },
      orderBy: {
        lastRepliedAt: 'desc',
      },
    });

    // Group leads by campaignId
    const groupedByCampaign = {};

    for (const lead of repliedLeads) {
      const cId = lead.campaignId || 'unassigned';
      const cName = lead.campaign ? lead.campaign.name : 'Direct Outreach';

      if (!groupedByCampaign[cId]) {
        groupedByCampaign[cId] = {
          campaignId: cId,
          campaignName: cName,
          analytics: lead.campaign?.analytics || null,
          totalReplies: 0,
          conversations: [],
        };
      }

      // Build conversation thread
      const messages = lead.activityLogs.map((log) => ({
        id: log.id,
        direction: log.eventType === 'SENT' ? 'OUTBOUND' : 'INBOUND',
        senderName: log.eventType === 'SENT' ? (log.connectedEmail?.fromName || 'You') : (lead.firstName || lead.email),
        senderEmail: log.eventType === 'SENT' ? log.connectedEmail?.email : lead.email,
        subject: log.sequence?.subject || 'Re: Outreach',
        body: log.replySnippet || (log.eventType === 'SENT' ? 'Outbound cold outreach email' : 'Lead response received'),
        timestamp: log.timestamp,
        messageId: log.messageId,
      }));

      // Extract last message snippet for sidebar preview
      const lastMessage = messages[messages.length - 1];

      groupedByCampaign[cId].conversations.push({
        lead: {
          id: lead.id,
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          jobTitle: lead.jobTitle,
          phone: lead.phone,
          website: lead.website,
          lastRepliedAt: lead.lastRepliedAt,
        },
        lastSnippet: lastMessage ? lastMessage.body : '',
        lastTimestamp: lastMessage ? lastMessage.timestamp : lead.lastRepliedAt,
        messages,
      });

      groupedByCampaign[cId].totalReplies += 1;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRepliedLeads: repliedLeads.length,
        campaigns: Object.values(groupedByCampaign),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/unibox/reply
 * Dispatches a manual follow-up response from the original assigned ConnectedEmail inbox
 * and appends the message to the thread history.
 */
async function sendManualReply(req, res, next) {
  try {
    const { leadId, body, subject } = req.body;

    if (!leadId || !body) {
      return res.status(400).json({
        success: false,
        error: 'leadId and body are required fields.',
      });
    }

    // 1. Fetch Lead, Campaign, and last communication history
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        campaign: {
          include: {
            sendingAccounts: {
              include: { connectedEmail: true },
            },
          },
        },
        activityLogs: {
          where: { eventType: { in: ['SENT', 'REPLIED'] } },
          orderBy: { timestamp: 'desc' },
          take: 5,
          include: { connectedEmail: true },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }

    // 2. Identify the inbox to send from (prefer inbox previously used with this lead)
    const previousSentLog = lead.activityLogs.find((log) => log.eventType === 'SENT' && log.connectedEmail);
    let sendingAccount = previousSentLog ? previousSentLog.connectedEmail : null;

    if (!sendingAccount && lead.campaign?.sendingAccounts?.length > 0) {
      sendingAccount = lead.campaign.sendingAccounts[0].connectedEmail;
    }

    if (!sendingAccount || sendingAccount.connectionStatus !== 'CONNECTED') {
      return res.status(400).json({
        success: false,
        error: 'No active connected sending account available to dispatch reply.',
      });
    }

    // 3. Threading headers (In-Reply-To and References)
    const lastMessageWithId = lead.activityLogs.find((log) => log.messageId);
    const parentMessageId = lastMessageWithId?.messageId || undefined;

    // 4. Decrypt SMTP Credentials
    const decryptedPass = decrypt(sendingAccount.encryptedSmtpPass);
    const decryptedUser = sendingAccount.encryptedSmtpUser
      ? decrypt(sendingAccount.encryptedSmtpUser)
      : sendingAccount.email;

    const transporter = nodemailer.createTransport({
      host: sendingAccount.encryptedSmtpHost,
      port: sendingAccount.smtpPort,
      secure: sendingAccount.smtpSecure,
      auth: {
        user: decryptedUser,
        pass: decryptedPass,
      },
      connectionTimeout: 15000,
      socketTimeout: 15000,
    });

    // 5. Send Email
    const finalSubject = subject || 'Re: Following up';
    const sendInfo = await transporter.sendMail({
      from: `"${sendingAccount.fromName}" <${sendingAccount.email}>`,
      to: lead.email,
      replyTo: sendingAccount.replyTo || sendingAccount.email,
      subject: finalSubject,
      text: body,
      html: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #111;">${body.replace(/\n/g, '<br/>')}</div>`,
      inReplyTo: parentMessageId,
      references: parentMessageId,
    });

    // 6. Record outbound message in activity log
    const activityRecord = await prisma.emailActivityLog.create({
      data: {
        eventType: 'SENT',
        campaignId: lead.campaignId || sendingAccount.workspaceId,
        leadId: lead.id,
        connectedEmailId: sendingAccount.id,
        messageId: sendInfo.messageId || null,
        replySnippet: body.slice(0, 250),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Reply sent successfully.',
      data: {
        id: activityRecord.id,
        direction: 'OUTBOUND',
        senderName: sendingAccount.fromName,
        senderEmail: sendingAccount.email,
        subject: finalSubject,
        body,
        timestamp: activityRecord.timestamp,
        messageId: sendInfo.messageId,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRepliedConversations,
  sendManualReply,
};
