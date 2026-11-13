/**
 * src/utils/bounceDetector.js
 * SMTP Delivery Status Notification (DSN) and Bounce Parser.
 * Analyzes RFC 822 raw messages using mailparser (with native fallback) to identify
 * hard vs soft bounces, target lead email address, and SMTP diagnostic codes.
 */

let mailparser;
try {
  mailparser = require('mailparser');
} catch {
  mailparser = null;
}

// Common bounce sender patterns
const BOUNCE_SENDER_REGEX = /mailer-daemon|postmaster|mail delivery subsystem|delivery notification|bounce/i;

// Common bounce subject patterns
const BOUNCE_SUBJECT_REGEX = /delivery status notification|undelivered mail|mail delivery failed|failure notice|returned to sender|undeliverable|delivery failure/i;

// Regex patterns to extract recipient email address from DSN headers and body
const FINAL_RECIPIENT_REGEX = /(?:final-recipient|original-recipient)\s*:\s*(?:rfc822;)?\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i;
const TO_RECIPIENT_REGEX = /(?:to|recipient)\s*:\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i;
const DIAGNOSTIC_EMAIL_REGEX = /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>\s*:\s*(?:5\d{2}|4\d{2})/i;
const GENERAL_EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// Regex patterns for Enhanced Status Codes (RFC 3463: e.g. 5.1.1, 4.2.2) and Basic SMTP Codes (e.g. 550, 451)
const STATUS_CODE_REGEX = /\b(?:status\s*:\s*)?([45]\.\d{1,3}\.\d{1,3})\b/i;
const SMTP_CODE_REGEX = /\b([45]\d{2})\s+(?:[45]\.\d{1,3}\.\d{1,3})?\b/;
const DIAGNOSTIC_CODE_REGEX = /diagnostic-code\s*:\s*(?:smtp\s*;\s*)?([^\r\n]+)/i;
const ACTION_REGEX = /action\s*:\s*([a-zA-Z-]+)/i;

// Keywords indicative of Hard vs Soft bounces
const HARD_BOUNCE_KEYWORDS = [
  'user unknown',
  'no such user',
  'mailbox unavailable',
  'recipient address rejected',
  'does not exist',
  'account has been disabled',
  'domain not found',
  'invalid recipient',
  'address not found',
  'unrouteable address',
  'mailbox not found',
  'permanent failure',
];

const SOFT_BOUNCE_KEYWORDS = [
  'mailbox full',
  'quota exceeded',
  'over quota',
  'storage limit',
  'temporarily deferred',
  'try again later',
  'connection timed out',
  'too many connections',
  'rate limited',
  'greylisted',
  'service unavailable, try again',
  'temporary failure',
];

/**
 * Fallback lightweight RFC 822 parser used if mailparser is not yet installed.
 */
function nativeRfc822Parser(rawEmail) {
  const text = typeof rawEmail === 'string' ? rawEmail : rawEmail.toString('utf8');
  const [headerPart, ...bodyParts] = text.split(/\r?\n\r?\n/);
  const body = bodyParts.join('\n\n');

  const headers = new Map();
  const rawHeaders = headerPart.split(/\r?\n(?![ \t])/);

  for (const h of rawHeaders) {
    const colonIdx = h.indexOf(':');
    if (colonIdx > 0) {
      const key = h.slice(0, colonIdx).trim().toLowerCase();
      const val = h.slice(colonIdx + 1).trim();
      headers.set(key, { value: val });
    }
  }

  const fromVal = headers.get('from')?.value || '';
  const fromEmail = fromVal.match(/<([^>]+)>/)?.[1] || fromVal;

  return {
    headers: {
      get: (k) => headers.get(k.toLowerCase()),
    },
    from: {
      value: [{ address: fromEmail, name: fromVal }],
    },
    subject: headers.get('subject')?.value || '',
    text: body,
    html: body,
    attachments: [],
  };
}

/**
 * Parses raw email text / attachments to extract DSN fields (Action, Status, Diagnostic-Code, Recipient).
 */
function extractDsnFields(text) {
  if (!text || typeof text !== 'string') return {};

  const recipientMatch = text.match(FINAL_RECIPIENT_REGEX) || text.match(DIAGNOSTIC_EMAIL_REGEX) || text.match(TO_RECIPIENT_REGEX);
  const statusMatch = text.match(STATUS_CODE_REGEX);
  const smtpCodeMatch = text.match(SMTP_CODE_REGEX);
  const diagnosticMatch = text.match(DIAGNOSTIC_CODE_REGEX);
  const actionMatch = text.match(ACTION_REGEX);

  return {
    recipient: recipientMatch ? recipientMatch[1].toLowerCase() : null,
    statusCode: statusMatch ? statusMatch[1] : (smtpCodeMatch ? smtpCodeMatch[1] : null),
    diagnosticCode: diagnosticMatch ? diagnosticMatch[1].trim() : null,
    action: actionMatch ? actionMatch[1].toLowerCase() : null,
  };
}

/**
 * Determines whether a bounce is 'hard' or 'soft' based on status codes, action, and diagnostic text.
 *
 * @param {string|null} statusCode - Enhanced or basic status code (e.g. "5.1.1", "550", "4.2.2")
 * @param {string} fullText - Aggregated diagnostic and body text
 * @returns {'hard'|'soft'|null}
 */
function classifyBounceType(statusCode, fullText = '') {
  const normalizedText = fullText.toLowerCase();

  // 1. Evaluate RFC status codes (5.x.x = Hard, 4.x.x = Soft)
  if (statusCode) {
    if (statusCode.startsWith('5.') || statusCode.startsWith('5')) {
      return 'hard';
    }
    if (statusCode.startsWith('4.') || statusCode.startsWith('4')) {
      return 'soft';
    }
  }

  // 2. Keyword matching fallback
  for (const keyword of HARD_BOUNCE_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      return 'hard';
    }
  }

  for (const keyword of SOFT_BOUNCE_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      return 'soft';
    }
  }

  return 'hard'; // Conservative default for unclassified delivery failures
}

/**
 * Main utility function to detect and parse SMTP Delivery Status Notifications (DSNs).
 *
 * @param {string|Buffer} rawEmail - Full RFC 822 raw email string or buffer
 * @returns {Promise<{
 *   isBounce: boolean,
 *   bouncedEmail: string|null,
 *   bounceType: 'hard'|'soft'|null,
 *   reason: string,
 *   statusCode?: string|null,
 *   action?: string|null
 * }>}
 */
async function parseBounceEmail(rawEmail) {
  if (!rawEmail) {
    return {
      isBounce: false,
      bouncedEmail: null,
      bounceType: null,
      reason: 'Empty raw email payload provided.',
    };
  }

  let parsed;
  try {
    if (mailparser && typeof mailparser.simpleParser === 'function') {
      parsed = await mailparser.simpleParser(rawEmail);
    } else {
      parsed = nativeRfc822Parser(rawEmail);
    }
  } catch (parseErr) {
    parsed = nativeRfc822Parser(rawEmail);
  }

  // 1. Check Content-Type header for multipart/report & report-type=delivery-status
  const rawContentType = parsed.headers.get('content-type')?.value || '';
  const contentTypeParams = parsed.headers.get('content-type')?.params || {};
  const isMultipartReport =
    rawContentType.includes('multipart/report') ||
    contentTypeParams['report-type'] === 'delivery-status' ||
    rawContentType.includes('delivery-status');

  // 2. Check Sender and Subject patterns
  const senderAddress = parsed.from?.value?.[0]?.address || '';
  const senderName = parsed.from?.value?.[0]?.name || '';
  const subject = parsed.subject || '';

  const isBounceSender =
    BOUNCE_SENDER_REGEX.test(senderAddress) ||
    BOUNCE_SENDER_REGEX.test(senderName);

  const isBounceSubject = BOUNCE_SUBJECT_REGEX.test(subject);

  // If none of the bounce criteria are met, this is a normal email
  if (!isMultipartReport && !isBounceSender && !isBounceSubject) {
    return {
      isBounce: false,
      bouncedEmail: null,
      bounceType: null,
      reason: 'Not a delivery status notification or bounce email.',
    };
  }

  // 3. Aggregate all text sources: main body and attached delivery-status / text parts
  let aggregateText = `${subject}\n${parsed.text || ''}\n${parsed.html || ''}\n`;

  if (Array.isArray(parsed.attachments)) {
    for (const att of parsed.attachments) {
      if (
        att.contentType === 'message/delivery-status' ||
        att.contentType?.startsWith('text/') ||
        att.filename?.endsWith('.txt') ||
        att.filename?.endsWith('.eml')
      ) {
        if (att.content && Buffer.isBuffer(att.content)) {
          aggregateText += `\n--- ATTACHMENT: ${att.contentType} ---\n${att.content.toString('utf8')}`;
        }
      }
    }
  }

  // 4. Extract DSN parameters (Recipient, Status, Action, Diagnostic-Code)
  const dsn = extractDsnFields(aggregateText);

  // Fallback search for recipient email if DSN header not found
  let bouncedEmail = dsn.recipient;
  if (!bouncedEmail) {
    const allEmails = aggregateText.match(GENERAL_EMAIL_REGEX) || [];
    // Exclude the bounce sender and postmaster addresses
    const candidates = allEmails
      .map((e) => e.toLowerCase())
      .filter((e) => !BOUNCE_SENDER_REGEX.test(e) && !e.includes('postmaster') && !e.includes('mailer-daemon'));

    if (candidates.length > 0) {
      bouncedEmail = candidates[0];
    }
  }

  // 5. Determine bounce classification (hard vs soft)
  const bounceType = classifyBounceType(dsn.statusCode, aggregateText);

  // 6. Format reason description
  let reason = dsn.diagnosticCode || `Delivery failed with status code ${dsn.statusCode || '5.X.X'}`;
  if (bounceType === 'soft') {
    reason = dsn.diagnosticCode || `Temporary delivery failure: ${dsn.statusCode || '4.X.X (Mailbox full/deferred)'}`;
  } else if (bounceType === 'hard' && !dsn.diagnosticCode) {
    reason = `Permanent delivery failure: Recipient mailbox invalid or rejected (${dsn.statusCode || '550'})`;
  }

  return {
    isBounce: true,
    bouncedEmail: bouncedEmail || null,
    bounceType,
    reason: reason.replace(/\s+/g, ' ').trim(),
    statusCode: dsn.statusCode || null,
    action: dsn.action || 'failed',
  };
}

module.exports = {
  parseBounceEmail,
  classifyBounceType,
  extractDsnFields,
  BOUNCE_SENDER_REGEX,
  BOUNCE_SUBJECT_REGEX,
};
