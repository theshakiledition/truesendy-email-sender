/**
 * src/utils/tracking.util.js
 * Utilities for email open tracking pixel injection, link wrapping, and signed token handling.
 */

const crypto = require('crypto');

// 1x1 transparent GIF (RFC 1630 minimal standard - 43 bytes)
const TRANSPARENT_1X1_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const TRACKING_SECRET = process.env.TRACKING_SECRET || process.env.ENCRYPTION_KEY || 'truesendy-tracking-secret';

/**
 * Encodes tracking metadata (campaignId, leadId, sequenceId) into an HMAC-signed base64url token.
 * Stateless design avoids pre-creating database tracking rows prior to send.
 *
 * @param {Object} payload
 * @param {string} payload.campaignId
 * @param {string} payload.leadId
 * @param {string} [payload.sequenceId]
 * @param {string} [payload.connectedEmailId]
 * @returns {string} Signed token: `<base64urlData>.<hmacSignature>`
 */
function encodeTrackingToken(payload) {
  const jsonStr = JSON.stringify({
    c: payload.campaignId,
    l: payload.leadId,
    s: payload.sequenceId || null,
    e: payload.connectedEmailId || null,
    t: Date.now(),
  });

  const encodedData = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TRACKING_SECRET)
    .update(encodedData)
    .digest('hex')
    .slice(0, 16); // 16-char HMAC suffix for tamper protection

  return `${encodedData}.${signature}`;
}

/**
 * Decodes and verifies the HMAC-signed tracking token.
 *
 * @param {string} token
 * @returns {{ campaignId: string, leadId: string, sequenceId: string|null, connectedEmailId: string|null }|null}
 */
function decodeTrackingToken(token) {
  if (!token || typeof token !== 'string') return null;

  // Strip .gif suffix if present in URL parameter (e.g., from /track/o/:trackingId.gif)
  const cleanToken = token.replace(/\.gif$/i, '');
  const parts = cleanToken.split('.');

  if (parts.length !== 2) return null;

  const [encodedData, signature] = parts;

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', TRACKING_SECRET)
    .update(encodedData)
    .digest('hex')
    .slice(0, 16);

  if (signature !== expectedSig) {
    console.warn('[Tracking] Invalid token signature detected.');
    return null;
  }

  try {
    const jsonStr = Buffer.from(encodedData, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);

    return {
      campaignId: parsed.c,
      leadId: parsed.l,
      sequenceId: parsed.s,
      connectedEmailId: parsed.e,
      createdTimestamp: parsed.t,
    };
  } catch (err) {
    console.error('[Tracking] Token deserialization error:', err.message);
    return null;
  }
}

/**
 * Injects the hidden 1x1 tracking pixel into the bottom of the HTML email body.
 * Places it before the closing `</body>` tag if present, or appends it to the end.
 *
 * @param {string} htmlBody - Raw HTML email content
 * @param {string} trackingBaseUrl - e.g. "https://track.outreachflow.io" or "https://api.truesendy.com"
 * @param {string} trackingToken - Signed tracking token
 * @returns {string} HTML with embedded tracking pixel
 */
function injectTrackingPixel(htmlBody, trackingBaseUrl, trackingToken) {
  if (!htmlBody || typeof htmlBody !== 'string') return htmlBody;

  // Clean trailing slashes
  const baseUrl = trackingBaseUrl.replace(/\/+$/, '');
  const pixelUrl = `${baseUrl}/track/o/${trackingToken}.gif`;

  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none !important;max-height:0px !important;max-width:0px !important;opacity:0 !important;overflow:hidden !important;visibility:hidden !important;mso-hide:all !important;" border="0" />`;

  // Inject before </body> if standard HTML structure exists
  if (/<\/body>/i.test(htmlBody)) {
    return htmlBody.replace(/<\/body>/i, `${pixelTag}</body>`);
  }

  // Otherwise append to the end of the email
  return `${htmlBody}\n${pixelTag}`;
}

/**
 * Rewrites `<a href="...">` links inside HTML to route through the click tracking endpoint.
 * Excludes mailto:, tel:, and anchor (#) links.
 *
 * @param {string} htmlBody - Email HTML
 * @param {string} trackingBaseUrl - e.g. "https://track.outreachflow.io"
 * @param {string} trackingToken - Signed tracking token
 * @returns {string} HTML with click tracking URLs
 */
function rewriteLinksForClickTracking(htmlBody, trackingBaseUrl, trackingToken) {
  if (!htmlBody || typeof htmlBody !== 'string') return htmlBody;

  const baseUrl = trackingBaseUrl.replace(/\/+$/, '');
  const clickEndpoint = `${baseUrl}/track/c/${trackingToken}`;

  // Matches href attributes in <a> tags
  const hrefRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;

  return htmlBody.replace(hrefRegex, (match, quote, originalUrl) => {
    // Ignore internal anchor hashes, mailto:, and tel: schemes
    if (
      !originalUrl ||
      originalUrl.startsWith('#') ||
      originalUrl.startsWith('mailto:') ||
      originalUrl.startsWith('tel:') ||
      originalUrl.includes('/track/c/')
    ) {
      return match;
    }

    const trackedUrl = `${clickEndpoint}?url=${encodeURIComponent(originalUrl)}`;
    return match.replace(`href=${quote}${originalUrl}${quote}`, `href=${quote}${trackedUrl}${quote}`);
  });
}

module.exports = {
  TRANSPARENT_1X1_GIF,
  encodeTrackingToken,
  decodeTrackingToken,
  injectTrackingPixel,
  rewriteLinksForClickTracking,
};
