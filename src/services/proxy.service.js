/**
 * src/services/proxy.service.js
 * Proxy allocation engine & connection tunneling helpers.
 */

const http = require('http');
const tls = require('tls');
let prismaClient;

function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

/**
 * Fetches the active proxy from PostgreSQL with the lowest number of active connected inboxes.
 * Balances the pool evenly across Webshare IPs.
 *
 * @returns {Promise<Object|null>} The assigned proxy record or null if no proxies exist.
 */
async function assignProxy() {
  const prisma = getPrisma();

  const proxies = await prisma.proxy.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: {
        select: { connectedEmails: true },
      },
    },
    orderBy: [
      {
        connectedEmails: {
          _count: 'asc',
        },
      },
      {
        createdAt: 'asc',
      },
    ],
    take: 1,
  });

  return proxies.length > 0 ? proxies[0] : null;
}

/**
 * Formats standard proxy URI: `http://user:pass@ip:port` or `http://ip:port`.
 *
 * @param {Object} proxy - Proxy model object
 * @returns {string} Fully qualified proxy URL
 */
function formatProxyUrl(proxy) {
  if (!proxy) return '';
  if (proxy.username && proxy.password) {
    const user = encodeURIComponent(proxy.username);
    const pass = encodeURIComponent(proxy.password);
    return `http://${user}:${pass}@${proxy.host}:${proxy.port}`;
  }
  return `http://${proxy.host}:${proxy.port}`;
}

/**
 * Creates an encrypted TLS socket routed through an HTTP CONNECT proxy tunnel for ImapFlow.
 * Works seamlessly using https-proxy-agent or native HTTP CONNECT tunnel.
 *
 * @param {Object} params
 * @param {Object} params.proxy - Assigned Proxy record { host, port, username, password }
 * @param {string} params.targetHost - Destination IMAP host (e.g. "imap.gmail.com")
 * @param {number} params.targetPort - Destination IMAP port (e.g. 993)
 * @param {boolean} [params.secure=true] - Whether destination requires TLS
 * @param {number} [params.timeoutMs=15000] - Connection timeout
 * @returns {Promise<tls.TLSSocket|net.Socket>} Proxied socket ready for IMAP protocol
 */
function createProxiedImapSocket({ proxy, targetHost, targetPort, secure = true, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    // 1. Check if https-proxy-agent is available
    let HttpsProxyAgent;
    try {
      HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent || require('https-proxy-agent');
    } catch {
      HttpsProxyAgent = null;
    }

    const proxyAuth =
      proxy.username && proxy.password ? `${proxy.username}:${proxy.password}` : null;

    // Standard HTTP CONNECT request through the Webshare HTTP Proxy
    const connectReq = http.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`,
      headers: proxyAuth
        ? {
            'Proxy-Authorization': `Basic ${Buffer.from(proxyAuth).toString('base64')}`,
          }
        : {},
      timeout: timeoutMs,
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(
          new Error(
            `Proxy CONNECT failed with status [${res.statusCode}] ${res.statusMessage || ''} for target ${targetHost}:${targetPort}`
          )
        );
      }

      if (secure) {
        // Upgrade tunnel to TLS for secure IMAP (port 993)
        const tlsSocket = tls.connect(
          {
            socket,
            host: targetHost,
            servername: targetHost,
            rejectUnauthorized: true,
          },
          () => {
            resolve(tlsSocket);
          }
        );

        tlsSocket.on('error', (err) => {
          socket.destroy();
          reject(new Error(`TLS Handshake via Proxy Failed: ${err.message}`));
        });
      } else {
        resolve(socket);
      }
    });

    connectReq.on('timeout', () => {
      connectReq.destroy();
      reject(new Error(`Proxy connection timed out contacting ${proxy.host}:${proxy.port}`));
    });

    connectReq.on('error', (err) => {
      reject(new Error(`Proxy Connection Error (${proxy.host}:${proxy.port}): ${err.message}`));
    });

    connectReq.end();
  });
}

module.exports = {
  assignProxy,
  formatProxyUrl,
  createProxiedImapSocket,
};
