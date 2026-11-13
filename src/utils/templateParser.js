/**
 * src/utils/templateParser.js
 * Robust cold outreach template parser supporting variable interpolation with fallbacks
 * and recursive/nested Spintax resolution.
 */

// Placeholders used to protect literal braces in lead data from being treated as Spintax
const LBRACE_TOKEN = '__LBRACE_ESCAPED__';
const RBRACE_TOKEN = '__RBRACE_ESCAPED__';

/**
 * Retrieves a property value from the lead object using case-insensitive,
 * snake_case/camelCase conversion, and nested dot-notation paths.
 *
 * @param {Object} lead - Lead data object
 * @param {string} path - Variable identifier (e.g., 'first_name', 'companyName', 'customVariables.tech')
 * @returns {any} Value or undefined if not found
 */
function getLeadValue(lead, path) {
  if (!lead || typeof lead !== 'object') return undefined;

  // 1. Direct path lookup (e.g., lead['first_name'] or lead.firstName)
  if (path in lead && lead[path] !== undefined && lead[path] !== null) {
    return lead[path];
  }

  // 2. Dot-notation traversal (e.g. 'customVariables.industry')
  if (path.includes('.')) {
    const segments = path.split('.');
    let current = lead;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined && current !== null) {
      return current;
    }
  }

  // 3. Normalized dictionary lookup for snake_case / camelCase aliases
  // e.g., 'first_name' -> 'firstName', 'company_name' -> 'companyName'
  const normalizedKey = path.toLowerCase().replace(/[_\-\s]/g, '');

  for (const [key, val] of Object.entries(lead)) {
    if (key.toLowerCase().replace(/[_\-\s]/g, '') === normalizedKey) {
      if (val !== undefined && val !== null) return val;
    }
  }

  // 4. Fallback search inside `lead.customVariables` JSON if present
  if (lead.customVariables && typeof lead.customVariables === 'object') {
    if (path in lead.customVariables && lead.customVariables[path] !== undefined && lead.customVariables[path] !== null) {
      return lead.customVariables[path];
    }
    for (const [key, val] of Object.entries(lead.customVariables)) {
      if (key.toLowerCase().replace(/[_\-\s]/g, '') === normalizedKey) {
        if (val !== undefined && val !== null) return val;
      }
    }
  }

  return undefined;
}

/**
 * Replaces double-curly bracket variables (e.g., {{first_name}}, {{company_name | there}}).
 * If a variable is missing or empty, returns the default fallback if supplied, otherwise ''.
 *
 * @param {string} text - Raw template string
 * @param {Object} lead - Lead data object
 * @param {boolean} [escapeBracesInValues=true] - Prevents lead values containing '{' from triggering Spintax
 * @returns {string} String with all variables substituted
 */
function substituteVariables(text, lead = {}, escapeBracesInValues = true) {
  if (!text || typeof text !== 'string') return '';

  // Matches: {{ variable_name }} or {{ variable_name | fallback text }}
  // Group 1: variable path
  // Group 2: optional fallback text
  const varRegex = /\{\{\s*([a-zA-Z0-9_.\-]+)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;

  return text.replace(varRegex, (match, rawVarName, fallback) => {
    const rawVal = getLeadValue(lead, rawVarName);

    let replacement = '';

    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      replacement = String(rawVal);
    } else if (fallback !== undefined) {
      replacement = fallback.trim();
    } else {
      replacement = '';
    }

    if (escapeBracesInValues) {
      // Escape literal curly braces in data so Spintax parser does not misinterpret them
      replacement = replacement.replace(/\{/g, LBRACE_TOKEN).replace(/\}/g, RBRACE_TOKEN);
    }

    return replacement;
  });
}

/**
 * Parses and resolves nested Spintax blocks: `{option1|option2|{sub1|sub2}}`.
 * Operates iteratively on the innermost un-nested brackets until all blocks are resolved.
 *
 * @param {string} text - String containing spintax blocks
 * @param {Function} [randomFn=Math.random] - Optional random number generator for deterministic testing
 * @returns {string} Fully resolved text
 */
function resolveSpintax(text, randomFn = Math.random) {
  if (!text || typeof text !== 'string') return '';

  // Matches innermost curly braces: {anything not containing { or }}
  const spintaxRegex = /\{([^{}]+)\}/;

  let iterations = 0;
  const MAX_ITERATIONS = 50; // Guard against malformed or excessive nesting

  while (spintaxRegex.test(text) && iterations < MAX_ITERATIONS) {
    text = text.replace(spintaxRegex, (match, innerContent) => {
      // If there's no pipe '|', it might be a single bracketed word like {word}
      if (!innerContent.includes('|')) {
        return innerContent;
      }

      const options = innerContent.split('|');
      const randValue = typeof randomFn === 'function' ? randomFn() : Math.random();
      const selectedIndex = Math.min(
        Math.floor(randValue * options.length),
        options.length - 1
      );

      return options[selectedIndex] !== undefined ? options[selectedIndex] : '';
    });

    iterations++;
  }

  // Restore any escaped literal braces from variable values
  text = text.replace(new RegExp(LBRACE_TOKEN, 'g'), '{').replace(new RegExp(RBRACE_TOKEN, 'g'), '}');

  return text;
}

/**
 * Full template processing pipeline:
 * 1. Resolves all variables and fallbacks.
 * 2. Resolves nested Spintax expressions.
 *
 * @param {string} template - Raw input template
 * @param {Object} [lead={}] - Lead data object
 * @param {Object} [options={}] - Options { randomFn }
 * @returns {string} Final email-ready string
 */
function parseTemplate(template, lead = {}, options = {}) {
  if (!template || typeof template !== 'string') return '';

  const { randomFn = Math.random } = options;

  // Step 1: Substitute variables first (with brace protection)
  const substituted = substituteVariables(template, lead, true);

  // Step 2: Resolve nested Spintax and unmask protected characters
  const finalized = resolveSpintax(substituted, randomFn);

  return finalized;
}

module.exports = {
  substituteVariables,
  resolveSpintax,
  parseTemplate,
  getLeadValue,
};
