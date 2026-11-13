/**
 * src/controllers/connectedEmail.controller.js
 * Express controller for connecting and testing sender inboxes.
 */

const { verifyEmailCredentials } = require('../services/emailVerifier.service');
const { createConnectedEmail } = require('../services/connectedEmail.service');
const { assignProxy } = require('../services/proxy.service');

/**
 * POST /api/emails/connect
 * Handles live test verification, AES encryption, and persistence of email inboxes.
 */
async function connectEmailAccount(req, res, next) {
  try {
    const {
      workspaceId,
      email,
      password,
      appPassword,
      smtpHost,
      smtpPort = 465,
      imapHost,
      imapPort = 993,
      fromName,
      replyTo,
      provider,
      dailyLimit,
    } = req.body;

    const resolvedPassword = appPassword || password;
    let resolvedWorkspaceId = workspaceId || req.workspaceId || req.headers['x-workspace-id'];

    // 1. Strict Input Validation
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!resolvedPassword) missingFields.push('appPassword (or password)');
    if (!smtpHost) missingFields.push('smtpHost');
    if (!smtpPort) missingFields.push('smtpPort');
    if (!imapHost) missingFields.push('imapHost');
    if (!imapPort) missingFields.push('imapPort');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Fallback/Resolve default workspace if not explicitly provided
    if (!resolvedWorkspaceId) {
      const { prisma } = require('../services/connectedEmail.service');
      let defaultWorkspace = await prisma.workspace.findFirst();
      if (!defaultWorkspace) {
        defaultWorkspace = await prisma.workspace.create({
          data: {
            name: 'Default Workspace',
            slug: 'default-workspace',
          },
        });
      }
      resolvedWorkspaceId = defaultWorkspace.id;
    }

    const parsedSmtpPort = parseInt(smtpPort, 10);
    const parsedImapPort = parseInt(imapPort, 10);

    if (isNaN(parsedSmtpPort) || isNaN(parsedImapPort)) {
      return res.status(400).json({
        success: false,
        error: 'smtpPort and imapPort must be valid integers.',
      });
    }

    // Standard port-based SSL determination (configurable)
    const smtpSecure = parsedSmtpPort === 465;
    const imapSecure = parsedImapPort === 993;

    // 2. Fetch Active Proxy with Lowest Active Connections from Proxy Pool
    const assignedProxy = await assignProxy();
    if (assignedProxy) {
      console.log(
        `[ConnectEmail] Assigned Proxy: ${assignedProxy.host}:${assignedProxy.port} (Active links: ${assignedProxy._count?.connectedEmails || 0})`
      );
    } else {
      console.log('[ConnectEmail] No active proxies in pool. Proceeding with direct connection.');
    }

    // 3. Live Verification Check (SMTP via proxy-agent & IMAP via proxied TLS socket)
    try {
      await verifyEmailCredentials({
        email,
        password: resolvedPassword,
        smtpHost,
        smtpPort: parsedSmtpPort,
        smtpSecure,
        imapHost,
        imapPort: parsedImapPort,
        imapSecure,
        proxy: assignedProxy,
      });
    } catch (verifyError) {
      // Rejection: do NOT link proxy or persist account
      console.warn(`[ConnectEmail] Verification failed for ${email}: ${verifyError.message}`);
      return res.status(400).json({
        success: false,
        stage: verifyError.stage || 'VERIFICATION',
        error: verifyError.message,
        details: verifyError.originalError?.message || null,
        proxyUsed: assignedProxy ? `${assignedProxy.host}:${assignedProxy.port}` : null,
      });
    }

    // 4. Encrypt and Persist to PostgreSQL via Prisma & Link to Assigned Proxy
    const newAccount = await createConnectedEmail({
      workspaceId: resolvedWorkspaceId,
      email,
      password: resolvedPassword,
      fromName: fromName || email.split('@')[0],
      replyTo,
      provider: provider || 'SMTP_IMAP',
      smtpHost,
      smtpPort: parsedSmtpPort,
      smtpSecure,
      imapHost,
      imapPort: parsedImapPort,
      imapSecure,
      dailyLimit,
      proxyId: assignedProxy ? assignedProxy.id : null,
    });

    // 5. Return Success Response with linked proxy metadata
    return res.status(200).json({
      success: true,
      message: 'Email account verified and connected successfully through proxy pool.',
      data: newAccount,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  connectEmailAccount,
};
