/**
 * src/controllers/adminProxy.controller.js
 * Admin controller for managing outbound proxies (Webshare bulk upload & inventory).
 */

const { syncWebshareProxies } = require('../utils/proxySync.util');

let prismaClient;
function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

/**
 * Parses Webshare export format: `IP:Port:Username:Password` (one per line).
 */
function parseWebshareProxyList(rawString) {
  if (!rawString || typeof rawString !== 'string') return [];

  const lines = rawString.split(/\r?\n/);
  const parsed = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      const host = parts[0].trim();
      const port = parts[1].trim();
      const username = parts[2] ? parts[2].trim() : null;
      const password = parts[3] ? parts[3].trim() : null;

      if (host && port) {
        parsed.push({
          host,
          port, // string format
          username: username || null,
          password: password || null,
          protocol: 'HTTP',
          isActive: true,
        });
      }
    }
  }

  return parsed;
}

/**
 * POST /api/admin/proxies/bulk
 * Accepts JSON payload with `rawProxyText`.
 */
async function bulkUploadProxies(req, res, next) {
  try {
    const rawProxyText =
      typeof req.body === 'string'
        ? req.body
        : req.body?.rawProxyText || req.body?.proxies || req.body?.rawText;

    if (!rawProxyText || typeof rawProxyText !== 'string' || !rawProxyText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'rawProxyText is empty. Please provide IP:Port:Username:Password per line.',
      });
    }

    const proxyRecords = parseWebshareProxyList(rawProxyText);

    if (proxyRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid proxy entries could be parsed. Expected format: IP:Port:Username:Password',
      });
    }

    const prisma = getPrisma();
    const result = await prisma.proxy.createMany({
      data: proxyRecords,
      skipDuplicates: true,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${proxyRecords.length} proxies (${result.count} inserted, ${proxyRecords.length - result.count} duplicates skipped).`,
      parsedCount: proxyRecords.length,
      insertedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/proxies
 */
async function listProxies(req, res, next) {
  try {
    const prisma = getPrisma();
    const proxies = await prisma.proxy.findMany({
      include: {
        _count: {
          select: { connectedEmails: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: proxies,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/proxies/:id/toggle
 */
async function toggleProxyStatus(req, res, next) {
  try {
    const { id } = req.params;
    const prisma = getPrisma();

    const existing = await prisma.proxy.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Proxy not found' });
    }

    const updated = await prisma.proxy.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        _count: {
          select: { connectedEmails: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Proxy ${updated.host}:${updated.port} is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/proxies/sync
 * Delegates to the standalone syncWebshareProxies utility.
 */
async function handleSyncWebshareProxies(req, res, next) {
  try {
    const result = await syncWebshareProxies();
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  parseWebshareProxyList,
  bulkUploadProxies,
  listProxies,
  toggleProxyStatus,
  syncWebshareProxies: handleSyncWebshareProxies,
};
