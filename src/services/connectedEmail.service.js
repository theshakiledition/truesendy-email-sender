/**
 * src/services/connectedEmail.service.js
 * Database service for managing ConnectedEmail entities via Prisma ORM.
 */

const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('../utils/crypto');

const prisma = new PrismaClient();

/**
 * Encrypts credentials and persists the ConnectedEmail record to PostgreSQL.
 *
 * @param {Object} data - Verified connection details
 * @returns {Promise<Object>} Sanitized ConnectedEmail record (without raw passwords)
 */
async function createConnectedEmail(data) {
  const {
    workspaceId,
    email,
    fromName,
    replyTo,
    provider = 'SMTP_IMAP',
    smtpHost,
    smtpPort,
    smtpSecure = smtpPort === 465,
    imapHost,
    imapPort,
    imapSecure = imapPort === 993,
    password,
    dailyLimit = 50,
    proxyId = null,
  } = data;

  // Encrypt the sensitive app password using AES-256-GCM
  const encryptedPassword = encrypt(password);
  const encryptedUser = encrypt(email);

  // Upsert ensures we don't duplicate the same inbox within the same workspace
  const connectedEmail = await prisma.connectedEmail.upsert({
    where: {
      workspaceId_email: {
        workspaceId,
        email,
      },
    },
    update: {
      fromName: fromName || email.split('@')[0],
      replyTo: replyTo || null,
      provider,
      connectionStatus: 'CONNECTED',
      lastCheckedAt: new Date(),
      lastErrorReason: null,

      // Associated proxy
      proxyId: proxyId || null,

      // SMTP encrypted configuration
      encryptedSmtpHost: smtpHost,
      smtpPort: Number(smtpPort),
      encryptedSmtpUser: encryptedUser,
      encryptedSmtpPass: encryptedPassword,
      smtpSecure,

      // IMAP encrypted configuration
      encryptedImapHost: imapHost,
      imapPort: Number(imapPort),
      encryptedImapUser: encryptedUser,
      encryptedImapPass: encryptedPassword,
      imapSecure,

      dailyLimit: Number(dailyLimit) || 50,
    },
    create: {
      workspaceId,
      email,
      fromName: fromName || email.split('@')[0],
      replyTo: replyTo || null,
      provider,
      connectionStatus: 'CONNECTED',
      lastCheckedAt: new Date(),

      // Associated proxy
      proxyId: proxyId || null,

      // SMTP encrypted configuration
      encryptedSmtpHost: smtpHost,
      smtpPort: Number(smtpPort),
      encryptedSmtpUser: encryptedUser,
      encryptedSmtpPass: encryptedPassword,
      smtpSecure,

      // IMAP encrypted configuration
      encryptedImapHost: imapHost,
      imapPort: Number(imapPort),
      encryptedImapUser: encryptedUser,
      encryptedImapPass: encryptedPassword,
      imapSecure,

      dailyLimit: Number(dailyLimit) || 50,
    },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      fromName: true,
      replyTo: true,
      provider: true,
      connectionStatus: true,
      proxyId: true,
      proxy: {
        select: {
          id: true,
          host: true,
          port: true,
          protocol: true,
        },
      },
      smtpPort: true,
      smtpSecure: true,
      imapPort: true,
      imapSecure: true,
      dailyLimit: true,
      todaySentCount: true,
      reputationScore: true,
      lastCheckedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return connectedEmail;
}

module.exports = {
  createConnectedEmail,
  prisma,
};
