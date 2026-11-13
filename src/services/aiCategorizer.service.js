/**
 * src/services/aiCategorizer.service.js
 * AI categorization service for incoming sales replies using LLM Structured Outputs.
 * Classifies replies into: INTERESTED, NOT_INTERESTED, MEETING_BOOKED, OUT_OF_OFFICE, DO_NOT_CONTACT.
 */

const VALID_TAGS = [
  'INTERESTED',
  'NOT_INTERESTED',
  'MEETING_BOOKED',
  'OUT_OF_OFFICE',
  'DO_NOT_CONTACT',
];

// JSON Schema definition for OpenAI Structured Outputs
const CATEGORIZATION_JSON_SCHEMA = {
  name: 'lead_reply_classification',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      tag: {
        type: 'string',
        enum: VALID_TAGS,
        description:
          'Exact categorization tag representing the lead\'s intent and response sentiment.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0.00 to 1.00',
      },
      reason: {
        type: 'string',
        description: 'Brief one-sentence justification for the classification.',
      },
    },
    required: ['tag', 'confidence', 'reason'],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a Senior Revenue Operations & Sales Intelligence AI analyzing email replies from B2B cold outreach campaigns.
Analyze the email response and classify it into EXACTLY ONE of the following tags:

1. INTERESTED:
   The prospect asks for more information, asks about pricing, expresses curiosity, requests a deck, or asks questions (e.g. "Send over some slides", "How does this compare to Tool X?").

2. NOT_INTERESTED:
   The prospect politely or firmly declines without requesting removal (e.g. "We don't need this right now", "We already use Competitor Y", "Bad timing for us").

3. MEETING_BOOKED:
   The prospect agrees to a meeting, suggests availability, asks for a calendar link, or accepts an invite (e.g. "Thursday at 2 PM EST works", "Here is my Calendly", "Let's jump on a quick call").

4. OUT_OF_OFFICE:
   Automated vacation notices, parental leave, holiday auto-responses, or general auto-responders.

5. DO_NOT_CONTACT:
   Explicit unsubscribe requests, cease-and-desist or legal notices, hostility, or demands to delete contact details (e.g. "Unsubscribe", "Take me off your list", "Do not email me again", "Reported as spam").

Rules:
- If the email is clearly an auto-responder, ALWAYS classify as OUT_OF_OFFICE.
- If the email contains any variation of "remove me", "unsubscribe", or "stop contacting", ALWAYS classify as DO_NOT_CONTACT.`;

/**
 * Fallback heuristic classifier used if the LLM API is unavailable, unconfigured, or times out.
 */
function heuristicFallbackClassifier(text) {
  const normalized = (text || '').toLowerCase();

  // 1. Unsubscribe / Hostile / Do Not Contact
  if (
    normalized.includes('unsubscribe') ||
    normalized.includes('unsub') ||
    normalized.includes('remove me') ||
    normalized.includes('take me off') ||
    normalized.includes('do not contact') ||
    normalized.includes('stop emailing') ||
    normalized.includes('lose my email') ||
    normalized.includes('reported as spam') ||
    normalized.includes('gdpr')
  ) {
    return {
      tag: 'DO_NOT_CONTACT',
      confidence: 0.95,
      reason: 'Matched explicit unsubscribe / do-not-contact request.',
    };
  }

  // 2. Out of Office / Auto-responder
  if (
    normalized.includes('out of office') ||
    normalized.includes('out of the office') ||
    normalized.includes('auto-reply') ||
    normalized.includes('autoreply') ||
    normalized.includes('automatic reply') ||
    normalized.includes('on leave') ||
    normalized.includes('away from my email') ||
    normalized.includes('sabbatical') ||
    normalized.includes('maternity leave') ||
    normalized.includes('paternity leave')
  ) {
    return {
      tag: 'OUT_OF_OFFICE',
      confidence: 0.95,
      reason: 'Matched automated out-of-office notification.',
    };
  }

  // 3. Meeting Booked / Availability
  if (
    normalized.includes('calendly') ||
    normalized.includes('hubspot.com/meetings') ||
    normalized.includes('cal.com') ||
    normalized.includes('zoom.us') ||
    normalized.includes('works for me') ||
    normalized.includes('works for us') ||
    normalized.includes('works on my end') ||
    normalized.includes('let\'s chat') ||
    normalized.includes('jump on a call') ||
    normalized.includes('book time')
  ) {
    return {
      tag: 'MEETING_BOOKED',
      confidence: 0.9,
      reason: 'Prospect proposed meeting availability or booking link.',
    };
  }

  // 4. Rejection / Not Interested
  if (
    normalized.includes('not interested') ||
    normalized.includes('no thank') ||
    normalized.includes('not a good fit') ||
    normalized.includes('pass on this') ||
    normalized.includes('bad timing') ||
    normalized.includes('don\'t need this') ||
    normalized.includes('already have')
  ) {
    return {
      tag: 'NOT_INTERESTED',
      confidence: 0.9,
      reason: 'Prospect declined the outreach proposal.',
    };
  }

  return {
    tag: 'INTERESTED',
    confidence: 0.7,
    reason: 'Prospect responded positively or requested further information.',
  };
}

/**
 * Categorizes an email reply using OpenAI API with Structured Outputs (JSON Schema).
 *
 * @param {string} replyBody - The raw or cleaned text of the prospect's reply.
 * @param {string} [subject] - Email subject line.
 * @returns {Promise<{ tag: string, confidence: number, reason: string }>}
 */
async function categorizeEmailReply(replyBody, subject = '') {
  if (!replyBody || typeof replyBody !== 'string') {
    return {
      tag: 'NOT_INTERESTED',
      confidence: 0.5,
      reason: 'Empty reply body provided.',
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // If no OpenAI API key is set, use the robust rule-based fallback
  if (!apiKey) {
    console.warn('[AI Categorizer] OPENAI_API_KEY not found. Using heuristic fallback.');
    return heuristicFallbackClassifier(replyBody);
  }

  const userContent = `Subject: ${subject || 'N/A'}\n\nEmail Body:\n"""\n${replyBody.slice(0, 3000)}\n"""`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: CATEGORIZATION_JSON_SCHEMA,
        },
        temperature: 0.1, // Near-zero temperature for reliable, deterministic classification
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI Categorizer] OpenAI API error (${response.status}):`, errText);
      return heuristicFallbackClassifier(replyBody);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return heuristicFallbackClassifier(replyBody);
    }

    const parsedResult = JSON.parse(content);

    // Validate that the returned tag is strictly one of the allowed enums
    if (!VALID_TAGS.includes(parsedResult.tag)) {
      console.warn(`[AI Categorizer] Invalid tag '${parsedResult.tag}' returned. Falling back.`);
      return heuristicFallbackClassifier(replyBody);
    }

    return {
      tag: parsedResult.tag,
      confidence: Number(parsedResult.confidence) || 0.9,
      reason: parsedResult.reason || 'AI categorized',
    };
  } catch (error) {
    console.error('[AI Categorizer] Failed to classify reply with LLM:', error.message);
    return heuristicFallbackClassifier(replyBody);
  }
}

module.exports = {
  categorizeEmailReply,
  heuristicFallbackClassifier,
  VALID_TAGS,
};
