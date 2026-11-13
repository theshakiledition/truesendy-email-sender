/**
 * src/services/emailVerifier.service.js
 * Verification engine for live testing SMTP and IMAP credentials before database persistence,
 * with full outbound proxy support (proxy-agent for Nodemailer, TLS socket tunneling for ImapFlow).
 */

const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { formatProxyUrl, createProxiedImapSocket } = require('./proxy.service');

const CONNECTION_TIMEOUT_MS = 15000; // 15 second timeout

/**
 * Live test of SMTP connection and credentials using Nodemailer through an assigned Proxy.
 *
 * @param {Object} params
 * @param {string} params.host
 * @param {number} params.port
 * @param {boolean} params.secure
 * @param {string} params.user
 * @param {string} params.pass
 * @param {Object|null} [params.proxy] - Optional assigned Proxy record { host, port, username, password }
 * @returns {Promise<{ success: boolean }>}
 */
async function verifySmtp({ host, port, secure, user, pass, proxy = null }) {
  // Dynamically resolve ProxyAgent from 'proxy-agent'
  let ProxyAgent;
  try {
    const mod = require('proxy-agent');
    ProxyAgent = mod.ProxyAgent || mod;
  } catch {
    ProxyAgent = null;
  }

  const transportOptions = {
    host,
    port,
    secure, // true for 465, false for 587/STARTTLS
    auth: {
      user,
      pass,
    },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: CONNECTION_TIMEOUT_MS,
    tls: {
      rejectUnauthorized: true,
    },
  };

  // If a proxy is assigned, wrap in ProxyAgent and pass as Nodemailer's agent
  if (proxy) {
    const proxyUrl = formatProxyUrl(proxy);
    if (ProxyAgent) {
      transportOptions.agent = new ProxyAgent(proxyUrl);
    } else {
      // Direct nodemailer proxy fallback
      transportOptions.proxy = proxyUrl;
    }
    console.log(`[EmailVerifier] Testing SMTP via Proxy: ${proxy.host}:${proxy.port}`);
  }

  const transporter = nodemailer.createTransport(transportOptions);

  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    let reason = error.message;

    if (error.responseCode) {
      reason = `[SMTP ${error.responseCode}] ${error.response || error.message}`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      reason = `Unable to reach SMTP server at ${host}:${port} (${error.code})`;
    }

    const err = new Error(`SMTP Verification Failed: ${reason}`);
    err.stage = 'SMTP';
    err.originalError = error;
    throw err;
  }
}

/**
 * Live test of IMAP connection and credentials using ImapFlow through an assigned Proxy.
 * Uses a proxied TLS socket created through the HTTP CONNECT tunnel.
 *
 * @param {Object} params
 * @param {string} params.host
 * @param {number} params.port
 * @param {boolean} params.secure
 * @param {string} params.user
 * @param {string} params.pass
 * @param {Object|null} [params.proxy] - Optional assigned Proxy record
 * @returns {Promise<{ success: boolean }>}
 */
async function verifyImap({ host, port, secure, user, pass, proxy = null }) {
  let customSocket = null;

  if (proxy) {
    console.log(`[EmailVerifier] Tunneling IMAP through Proxy: ${proxy.host}:${proxy.port}`);
    try {
      customSocket = await createProxiedImapSocket({
        proxy,
        targetHost: host,
        targetPort: port,
        secure,
        timeoutMs: CONNECTION_TIMEOUT_MS,
      });
    } catch (proxyErr) {
      const err = new Error(`Proxy IMAP Tunnel Failed: ${proxyErr.message}`);
      err.stage = 'IMAP_PROXY';
      err.originalError = proxyErr;
      throw err;
    }
  }

  const client = new ImapFlow({
    host,
    port,
    secure, // true for 993, false for 143/STARTTLS
    auth: {
      user,
      pass,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    tls: {
      rejectUnauthorized: true,
    },
    ...(customSocket ? { customSocket } : {}),
  });

  try {
    await client.connect();
    // Test capability & mailbox access by listing mailboxes
    await client.list();
    await client.logout();
    return { success: true };
  } catch (error) {
    let reason = error.message;

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      reason = `Unable to reach IMAP server at ${host}:${port} (${error.code})`;
    } else if (error.responseText) {
      reason = `[IMAP Server Response] ${error.responseText}`;
    }

    const err = new Error(`IMAP Verification Failed: ${reason}`);
    err.stage = 'IMAP';
    err.originalError = error;
    throw err;
  } finally {
    // Ensure socket cleanup even on failed handshakes
    try {
      if (client.usable) {
        await client.logout();
      } else {
        client.close();
      }
    } catch {}
    if (customSocket && !customSocket.destroyed) {
      try {
        customSocket.destroy();
      } catch {}
    }
  }
}

/**
 * Verifies both SMTP and IMAP credentials in parallel using the assigned proxy.
 *
 * @param {Object} config - Complete connection parameters.
 */
async function verifyEmailCredentials(config) {
  const {
    email,
    password,
    smtpHost,
    smtpPort,
    smtpSecure = smtpPort === 465,
    imapHost,
    imapPort,
    imapSecure = imapPort === 993,
    proxy = null,
  } = config;

  // Run both verification handshakes in parallel through the proxy
  const [smtpResult, imapResult] = await Promise.all([
    verifySmtp({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: email,
      pass: password,
      proxy,
    }),
    verifyImap({
      host: imapHost,
      port: imapPort,
      secure: imapSecure,
      user: email,
      pass: password,
      proxy,
    }),
  ]);

  return { smtp: smtpResult, imap: imapResult };
}

module.exports = {
  verifySmtp,
  verifyImap,
  verifyEmailCredentials,
};
