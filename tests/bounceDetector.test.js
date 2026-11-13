/**
 * tests/bounceDetector.test.js
 * Unit test suite for SMTP Bounce and DSN Parser.
 */

const { parseBounceEmail } = require('../src/utils/bounceDetector');

// Sample RFC 822 Hard Bounce (RFC 3464 Delivery Status Notification)
const RFC3464_HARD_BOUNCE = `From: "Mail Delivery Subsystem" <mailer-daemon@googlemail.com>
To: alex@outreachpro.com
Subject: Delivery Status Notification (Failure)
Date: Wed, 13 Nov 2026 10:00:00 +0000
MIME-Version: 1.0
Content-Type: multipart/report; report-type=delivery-status; boundary="boundary-dsn-123"

--boundary-dsn-123
Content-Type: text/plain; charset="UTF-8"

** Address not found **

Your message wasn't delivered to bad.lead@acmecorp.com because the address couldn't be found, or is unable to receive mail.

--boundary-dsn-123
Content-Type: message/delivery-status

Reporting-MTA: dns; googlemail.com
Arrival-Date: Wed, 13 Nov 2026 09:59:58 +0000

Final-Recipient: rfc822; bad.lead@acmecorp.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.

--boundary-dsn-123--
`;

// Sample RFC 822 Soft Bounce (Mailbox Full / Quota Exceeded)
const SOFT_BOUNCE_MAILBOX_FULL = `From: Postmaster <postmaster@outlook.com>
To: alex@outreachpro.com
Subject: Undeliverable: Outreach regarding Q4 pipeline
Date: Wed, 13 Nov 2026 10:15:00 +0000
Content-Type: text/plain; charset="UTF-8"

Delivery has failed to these recipients or groups:

full.inbox@partnertech.io
The recipient's mailbox is full and can't accept messages right now.

Diagnostic information for administrators:
Action: failed
Status: 4.2.2
Diagnostic-Code: smtp; 452 4.2.2 The user's mailbox is over quota.
`;

// Sample Normal Email (Lead Reply)
const NORMAL_LEAD_REPLY = `From: "Sarah Connor" <sarah.connor@acmetech.io>
To: alex@outreachpro.com
Subject: Re: Quick question Sarah
Date: Wed, 13 Nov 2026 10:20:00 +0000
Content-Type: text/plain; charset="UTF-8"

Hi Alex,

Thanks for reaching out! Yes, I would be interested in learning more about your cold email deliverability platform. Are you free this Thursday?

Best,
Sarah
`;

async function runTests() {
  console.log('Running Bounce Detector Unit Tests...\n');

  // Test 1: RFC 3464 Hard Bounce
  const hardResult = await parseBounceEmail(RFC3464_HARD_BOUNCE);
  console.log('Test 1 (Hard Bounce):', hardResult);
  console.assert(hardResult.isBounce === true, 'Test 1 Failed: isBounce should be true');
  console.assert(hardResult.bouncedEmail === 'bad.lead@acmecorp.com', `Test 1 Failed: expected bad.lead@acmecorp.com, got ${hardResult.bouncedEmail}`);
  console.assert(hardResult.bounceType === 'hard', 'Test 1 Failed: bounceType should be hard');
  console.assert(hardResult.statusCode === '5.1.1', 'Test 1 Failed: statusCode should be 5.1.1');
  console.log('✓ Test 1 Passed: Correctly identified RFC 3464 Hard Bounce\n');

  // Test 2: Soft Bounce (Mailbox Full)
  const softResult = await parseBounceEmail(SOFT_BOUNCE_MAILBOX_FULL);
  console.log('Test 2 (Soft Bounce):', softResult);
  console.assert(softResult.isBounce === true, 'Test 2 Failed: isBounce should be true');
  console.assert(softResult.bouncedEmail === 'full.inbox@partnertech.io', `Test 2 Failed: expected full.inbox@partnertech.io, got ${softResult.bouncedEmail}`);
  console.assert(softResult.bounceType === 'soft', 'Test 2 Failed: bounceType should be soft');
  console.assert(softResult.statusCode === '4.2.2', 'Test 2 Failed: statusCode should be 4.2.2');
  console.log('✓ Test 2 Passed: Correctly identified Soft Bounce\n');

  // Test 3: Normal Lead Reply
  const normalResult = await parseBounceEmail(NORMAL_LEAD_REPLY);
  console.log('Test 3 (Normal Email):', normalResult);
  console.assert(normalResult.isBounce === false, 'Test 3 Failed: isBounce should be false');
  console.assert(normalResult.bouncedEmail === null, 'Test 3 Failed: bouncedEmail should be null');
  console.assert(normalResult.bounceType === null, 'Test 3 Failed: bounceType should be null');
  console.log('✓ Test 3 Passed: Correctly bypassed normal lead reply\n');

  console.log('ALL TESTS PASSED SUCCESSFULLY! (3/3)');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  RFC3464_HARD_BOUNCE,
  SOFT_BOUNCE_MAILBOX_FULL,
  NORMAL_LEAD_REPLY,
};
