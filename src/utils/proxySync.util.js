/**
 * src/utils/proxySync.util.js
 * Standalone utility to fetch and synchronize Webshare proxies with PostgreSQL via Prisma.
 */

let prismaClient;

function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

/**
 * Downloads the proxy list from WEBSHARE_DOWNLOAD_URL, synchronizes with PostgreSQL,
 * updates credentials for existing proxies, inserts new ones, and marks rotated/stale
 * proxies as isActive: false.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   message?: string,
 *   error?: string,
 *   stats?: { totalFetched: number, added: number, updated: number, deactivated: number, totalActive: number }
 * }>}
 */
async function syncWebshareProxies() {
  console.log('[ProxySync] Starting automated Webshare proxy synchronization...');

  try {
    const downloadUrl = process.env.WEBSHARE_DOWNLOAD_URL;

    if (!downloadUrl || !downloadUrl.trim()) {
      const err = 'WEBSHARE_DOWNLOAD_URL environment variable is not defined.';
      console.error(`[ProxySync Error]: ${err}`);
      return { success: false, error: err };
    }

    // 1. Fetch raw text list from Webshare API
    const response = await fetch(downloadUrl.trim(), {
      headers: { 'User-Agent': 'TrueSendy-System-Worker/1.0' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = `Webshare API responded with HTTP status [${response.status}]: ${response.statusText}`;
      console.error(`[ProxySync Error]: ${err}`);
      return { success: false, error: err };
    }

    const responseText = await response.text();

    // 2. Parse IP:Port:Username:Password (one per line)
    const lines = responseText.split(/\r?\n/);
    const incomingProxies = [];
    const activeIncomingKeys = new Set();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(':');
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parts[1].trim();
        const username = parts[2] ? parts[2].trim() : null;
        const password = parts[3] ? parts[3].trim() : null;

        if (host && port) {
          incomingProxies.push({ host, port, username, password });
          activeIncomingKeys.add(`${host}:${port}`);
        }
      }
    }

    if (incomingProxies.length === 0) {
      const err = 'Webshare returned an empty or unparseable proxy list.';
      console.warn(`[ProxySync Warning]: ${err}`);
      return { success: false, error: err };
    }

    // 3. Fetch current inventory from PostgreSQL
    const prisma = getPrisma();
    const existingProxies = await prisma.proxy.findMany();
    const existingMap = new Map();

    for (const p of existingProxies) {
      existingMap.set(`${p.host}:${p.port}`, p);
    }

    let addedCount = 0;
    let updatedCount = 0;

    // 4. Upsert/update incoming proxies based on host + port
    for (const incoming of incomingProxies) {
      const key = `${incoming.host}:${incoming.port}`;
      const existing = existingMap.get(key);

      if (existing) {
        // Update credentials & ensure isActive is true
        await prisma.proxy.update({
          where: { id: existing.id },
          data: {
            username: incoming.username,
            password: incoming.password,
            protocol: 'HTTP',
            isActive: true,
          },
        });
        updatedCount++;
      } else {
        // Insert new proxy
        await prisma.proxy.create({
          data: {
            host: incoming.host,
            port: incoming.port,
            username: incoming.username,
            password: incoming.password,
            protocol: 'HTTP',
            isActive: true,
          },
        });
        addedCount++;
      }
    }

    // 5. Deactivate rotated/stale proxies not present in Webshare download
    const deadProxies = existingProxies.filter(
      (p) => !activeIncomingKeys.has(`${p.host}:${p.port}`) && p.isActive
    );

    let deactivatedCount = 0;
    if (deadProxies.length > 0) {
      const deadIds = deadProxies.map((p) => p.id);
      const updateResult = await prisma.proxy.updateMany({
        where: { id: { in: deadIds } },
        data: { isActive: false },
      });
      deactivatedCount = updateResult.count;
    }

    const stats = {
      totalFetched: incomingProxies.length,
      added: addedCount,
      updated: updatedCount,
      deactivated: deactivatedCount,
      totalActive: incomingProxies.length,
    };

    const message = `Sync succeeded: ${addedCount} added, ${updatedCount} updated, ${deactivatedCount} deactivated. Total active: ${stats.totalActive}.`;
    console.log(`[ProxySync Success]: ${message}`);

    return {
      success: true,
      message,
      stats,
    };
  } catch (error) {
    console.error('[ProxySync Exception]:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during proxy synchronization',
    };
  }
}

module.exports = {
  syncWebshareProxies,
};
