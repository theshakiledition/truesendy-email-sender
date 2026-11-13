/**
 * src/templates/templateEngine.js
 * Template parser with Spintax resolution and lead variable interpolation.
 */

/**
 * Recursively resolves Spintax patterns: `{option1|option2|{sub1|sub2}}`
 * Uses regex replacement until no unparsed spintax brackets remain.
 *
 * @param {string} text - Raw template string containing spintax
 * @returns {string} Randomized text
 */
function resolveSpintax(text) {
  if (!text || typeof text !== 'string') return '';

  // Matches innermost `{...}` without nested curly braces
  const spintaxRegex = /\{([^{}]+)\}/g;

  let iterations = 0;
  const MAX_ITERATIONS = 20; // Guard against malformed unbalanced braces

  while (spintaxRegex.test(text) && iterations < MAX_ITERATIONS) {
    text = text.replace(spintaxRegex, (match, choices) => {
      const options = choices.split('|');
      const selectedIndex = Math.floor(Math.random() * options.length);
      return options[selectedIndex] !== undefined ? options[selectedIndex] : '';
    });
    iterations++;
  }

  return text;
}

/**
 * Interpolates lead variables into the template string.
 * Supports:
 * - standard lead fields: {{first_name}}, {{firstName}}, {{company_name}}, {{email}}
 * - custom variables from lead.customVariables JSON: {{icebreaker}}, {{pain_point}}
 * - fallback values with pipes: {{first_name|there}}
 *
 * @param {string} text - Template with variable placeholders
 * @param {Object} lead - Lead database record with customVariables
 * @returns {string} Interpolated text
 */
function interpolateVariables(text, lead = {}) {
  if (!text || typeof text !== 'string') return '';

  const customVars = lead.customVariables || {};

  // Normalize lead standard fields into an accessible dictionary
  const context = {
    first_name: lead.firstName || '',
    firstname: lead.firstName || '',
    last_name: lead.lastName || '',
    lastname: lead.lastName || '',
    company_name: lead.companyName || '',
    companyname: lead.companyName || '',
    company: lead.companyName || '',
    email: lead.email || '',
    job_title: lead.jobTitle || '',
    jobtitle: lead.jobTitle || '',
    phone: lead.phone || '',
    website: lead.website || '',
  };

  // Merge custom JSON variables (case-insensitively)
  Object.keys(customVars).forEach((key) => {
    context[key.toLowerCase()] = String(customVars[key] ?? '');
  });

  // Regex to match {{variable_name}} or {{variable_name|fallback}}
  const varRegex = /\{\{\s*([a-zA-Z0-9_\-]+)(?:\|([^}]+))?\s*\}\}/g;

  return text.replace(varRegex, (match, rawKey, fallback) => {
    const key = rawKey.toLowerCase();
    const value = context[key];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }

    // Use fallback if supplied, otherwise empty string
    return fallback !== undefined ? fallback.trim() : '';
  });
}

/**
 * Full template renderer: Resolves variables first, then resolves spintax.
 *
 * @param {Object} template - Object containing { subject, body }
 * @param {Object} lead - Lead record
 * @returns {{ subject: string, body: string }} Fully rendered email copy
 */
function renderEmailTemplate({ subject, body }, lead) {
  // 1. Inject variables
  const subjectWithVars = interpolateVariables(subject, lead);
  const bodyWithVars = interpolateVariables(body, lead);

  // 2. Resolve Spintax randomized variations
  const finalSubject = resolveSpintax(subjectWithVars);
  const finalBody = resolveSpintax(bodyWithVars);

  return {
    subject: finalSubject,
    body: finalBody,
  };
}

module.exports = {
  resolveSpintax,
  interpolateVariables,
  renderEmailTemplate,
};
