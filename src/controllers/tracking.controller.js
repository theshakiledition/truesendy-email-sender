/**
 * src/controllers/tracking.controller.js
 * Express controller handling pixel open events and link click redirects.
 */

const dns = require('dns').promises;
const { PrismaClient } = require('@prisma/client');
const {
  TRANSPARENT_1X1_GIF,
  decodeTrackingToken,
} = require('../utils/tracking.util');

const prisma = new PrismaClient();

/**
 * GET /track/o/:trackingId.gif
 * Tracks email opens by returning an un-cached transparent 1x1 GIF and logging the event.
 */
async function trackOpen(req, res, next) {
  const { trackingId } = req.params;

  // 1. Send aggressive cache-busting headers to force mail clients to re-request on each open
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_1X1_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, post-check=0, pre-check=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });

  // End request with the 1x1 GIF buffer immediately to keep client latency sub-millisecond
  res.end(TRANSPARENT_1X1_GIF);

  // 2. Asynchronously process metrics in the background so HTTP response is not delayed
  try {
    const payload = decodeTrackingToken(trackingId);
    if (!payload || !payload.leadId || !payload.campaignId) {
      return;
    }

    const { campaignId, leadId, sequenceId, connectedEmailId } = payload;
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || null;

    // Check if this is the lead's first open to track unique opens
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, lastOpenedAt: true },
    });

    if (!lead) return;

    const isFirstOpen = !lead.lastOpenedAt;

    // Atomic database update: Analytics + Lead + Granular Audit Log
    await prisma.$transaction([
      // A. Increment Campaign Analytics
      prisma.emailAnalytics.upsert({
        where: { campaignId },
        update: {
          openedCount: { increment: 1 },
          ...(isFirstOpen ? { uniqueOpenedCount: { increment: 1 } } : {}),
        },
        create: {
          campaignId,
          totalLeads: 1,
          openedCount: 1,
          uniqueOpenedCount: 1,
        },
      }),

      // B. Update Lead timestamp
      prisma.lead.update({
        where: { id: leadId },
        data: {
          lastOpenedAt: new Date(),
        },
      }),

      // C. Record detailed open event
      prisma.emailActivityLog.create({
        data: {
          eventType: 'OPENED',
          campaignId,
          leadId,
          sequenceId: sequenceId || undefined,
          connectedEmailId: connectedEmailId || undefined,
          ipAddress,
          userAgent,
        },
      }),
    ]);
  } catch (err) {
    console.error('[Tracking Controller] Error logging open event:', err.message);
  }
}

/**
 * GET /track/c/:trackingId
 * Logs link click event and executes a 302 redirect to the destination URL.
 */
async function trackClick(req, res, next) {
  const { trackingId } = req.params;
  const rawDestination = req.query.url;

  if (!rawDestination || typeof rawDestination !== 'string') {
    return res.status(400).send('Missing or invalid destination URL.');
  }

  // Security: Prevent Open Redirect vulnerabilities (protocol whitelist)
  let destinationUrl;
  try {
    const parsed = new URL(rawDestination);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).send('Invalid URL protocol. Only HTTP and HTTPS are permitted.');
    }
    destinationUrl = parsed.toString();
  } catch {
    return res.status(400).send('Malformed destination URL.');
  }

  // 1. Asynchronously log the click event
  try {
    const payload = decodeTrackingToken(trackingId);

    if (payload && payload.leadId && payload.campaignId) {
      const { campaignId, leadId, sequenceId, connectedEmailId } = payload;
      const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const userAgent = req.headers['user-agent'] || null;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, lastClickedAt: true },
      });

      if (lead) {
        const isFirstClick = !lead.lastClickedAt;

        await prisma.$transaction([
          // Increment Campaign Analytics
          prisma.emailAnalytics.upsert({
            where: { campaignId },
            update: {
              clickedCount: { increment: 1 },
              ...(isFirstClick ? { uniqueClickedCount: { increment: 1 } } : {}),
            },
            create: {
              campaignId,
              totalLeads: 1,
              clickedCount: 1,
              uniqueClickedCount: 1,
            },
          }),

          // Update Lead timestamp
          prisma.lead.update({
            where: { id: leadId },
            data: {
              lastClickedAt: new Date(),
            },
          }),

          // Record detailed click event
          prisma.emailActivityLog.create({
            data: {
              eventType: 'CLICKED',
              campaignId,
              leadId,
              sequenceId: sequenceId || undefined,
              connectedEmailId: connectedEmailId || undefined,
              clickedUrl: destinationUrl,
              ipAddress,
              userAgent,
            },
          }),
        ]);
      }
    }
  } catch (err) {
    console.error('[Tracking Controller] Error logging click event:', err.message);
  }

  // 2. Perform 302 Found redirect to destination
  return res.redirect(302, destinationUrl);
}

/**
 * POST /api/tracking/verify
 * Validates a custom tracking domain's CNAME record using Node's native dns.promises.resolveCname.
 * If verified, marks the domain as VERIFIED in PostgreSQL and returns a structured response.
 */
async function verifyTrackingDomain(req, res, next) {
  try {
    const { domain, workspaceId } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: 'A domain name string is required (e.g., track.yourdomain.com).',
      });
    }

    // 1. Sanitize and normalize input domain
    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '');

    // Hostname validation regex
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: `Invalid domain format: '${domain}'. Expected a valid FQDN such as track.mycompany.com.`,
      });
    }

    // Expected SaaS tracking CNAME target (e.g. track.truesendy.com)
    const expectedCname = (
      process.env.TRACKING_CNAME_TARGET || 'track.truesendy.com'
    )
      .toLowerCase()
      .replace(/\.$/, '');

    // 2. Resolve or fallback workspaceId
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const defaultWorkspace = await prisma.workspace.findFirst({
        select: { id: true },
      });
      resolvedWorkspaceId = defaultWorkspace?.id;
    }

    if (!resolvedWorkspaceId) {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: 'workspaceId is required and no active workspace was found.',
      });
    }

    // 3. Perform DNS CNAME Lookup using Node native dns.promises
    let cnameRecords = [];
    try {
      cnameRecords = await dns.resolveCname(cleanDomain);
    } catch (dnsError) {
      let failureReason = dnsError.message;

      if (dnsError.code === 'ENODATA') {
        failureReason = 'No CNAME record was found for this hostname. Please add a CNAME record in your DNS provider.';
      } else if (dnsError.code === 'ENOTFOUND') {
        failureReason = 'Domain not found. Please verify the domain is registered and nameservers are active.';
      } else if (dnsError.code === 'SERVFAIL' || dnsError.code === 'ETIMEOUT') {
        failureReason = 'DNS query timed out or nameservers failed to respond. Please check DNS propagation.';
      }

      // Update or create FAILED record in PostgreSQL
      const failedRecord = await prisma.trackingDomain.upsert({
        where: { domain: cleanDomain },
        update: {
          status: 'FAILED',
          cnameTarget: expectedCname,
          lastVerifiedAt: new Date(),
          lastErrorReason: failureReason,
        },
        create: {
          workspaceId: resolvedWorkspaceId,
          domain: cleanDomain,
          cnameTarget: expectedCname,
          status: 'FAILED',
          lastVerifiedAt: new Date(),
          lastErrorReason: failureReason,
        },
      });

      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: 'DNS lookup failed.',
        details: failureReason,
        expected: expectedCname,
        dnsCode: dnsError.code,
        domain: failedRecord,
      });
    }

    // 4. Verify CNAME record matches expected SaaS host (stripping trailing dots)
    const normalizedRecords = cnameRecords.map((r) => r.toLowerCase().replace(/\.$/, ''));
    const isVerified = normalizedRecords.some((record) => record === expectedCname);

    if (isVerified) {
      // Update PostgreSQL to VERIFIED
      const verifiedRecord = await prisma.trackingDomain.upsert({
        where: { domain: cleanDomain },
        update: {
          status: 'VERIFIED',
          cnameTarget: expectedCname,
          lastVerifiedAt: new Date(),
          lastErrorReason: null,
          sslActive: true, // Mark ready for SSL proxying
        },
        create: {
          workspaceId: resolvedWorkspaceId,
          domain: cleanDomain,
          cnameTarget: expectedCname,
          status: 'VERIFIED',
          lastVerifiedAt: new Date(),
          sslActive: true,
        },
      });

      return res.status(200).json({
        success: true,
        status: 'VERIFIED',
        message: 'Custom tracking domain verified successfully.',
        data: {
          id: verifiedRecord.id,
          domain: verifiedRecord.domain,
          cnameTarget: verifiedRecord.cnameTarget,
          status: verifiedRecord.status,
          resolvedTargets: normalizedRecords,
          lastVerifiedAt: verifiedRecord.lastVerifiedAt,
        },
      });
    }

    // CNAME exists, but points to wrong target
    const mismatchReason = `CNAME points to '${normalizedRecords.join(', ')}' instead of expected '${expectedCname}'.`;

    const failedRecord = await prisma.trackingDomain.upsert({
      where: { domain: cleanDomain },
      update: {
        status: 'FAILED',
        cnameTarget: expectedCname,
        lastVerifiedAt: new Date(),
        lastErrorReason: mismatchReason,
      },
      create: {
        workspaceId: resolvedWorkspaceId,
        domain: cleanDomain,
        cnameTarget: expectedCname,
        status: 'FAILED',
        lastVerifiedAt: new Date(),
        lastErrorReason: mismatchReason,
      },
    });

    return res.status(400).json({
      success: false,
      status: 'FAILED',
      error: 'CNAME record target mismatch.',
      details: mismatchReason,
      expected: expectedCname,
      received: normalizedRecords,
      domain: failedRecord,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tracking/check-domain
 * Caddy On-Demand TLS "ask" endpoint.
 * Accepts `?domain=track.customer.com` from Caddy.
 * Returns 200 OK if the domain is verified in PostgreSQL, or 403 Forbidden to abort certificate issuance.
 */
async function checkDomainForCaddy(req, res) {
  const { domain } = req.query;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).send('Domain query parameter is required.');
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, '');

  // 1. Whitelist primary system domains if requested (e.g. track.truesendy.com, truesendy.com)
  const primaryDomain = (process.env.APP_PRIMARY_DOMAIN || 'truesendy.com').toLowerCase();
  const cnameTarget = (process.env.TRACKING_CNAME_TARGET || 'track.truesendy.com').toLowerCase();

  if (
    cleanDomain === primaryDomain ||
    cleanDomain.endsWith(`.${primaryDomain}`) ||
    cleanDomain === cnameTarget
  ) {
    return res.status(200).send('OK');
  }

  // 2. Query PostgreSQL to verify that the customer domain exists and is VERIFIED
  try {
    const verifiedDomain = await prisma.trackingDomain.findFirst({
      where: {
        domain: cleanDomain,
        status: 'VERIFIED',
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (verifiedDomain) {
      return res.status(200).send('OK');
    }

    // Deny unknown or unverified domains to prevent Let's Encrypt rate-limit exhaustion
    console.warn(`[Caddy TLS Ask] Denied certificate issuance for unverified domain: '${cleanDomain}'`);
    return res.status(403).send('Forbidden: Domain is not verified.');
  } catch (err) {
    console.error(`[Caddy TLS Ask] Database error checking domain '${cleanDomain}':`, err.message);
    return res.status(500).send('Internal Server Error');
  }
}

module.exports = {
  trackOpen,
  trackClick,
  verifyTrackingDomain,
  checkDomainForCaddy,
};
