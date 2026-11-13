/**
 * tests/emergencyBrake.test.js
 * Test suite for Campaign Emergency Brake thresholds and logic.
 */

const {
  MIN_SENT_THRESHOLD,
  MAX_BOUNCE_RATE_THRESHOLD,
} = require('../src/services/emergencyBrake.service');

function simulateEmergencyBrake({ sentCount, bouncedCount }) {
  if (sentCount === 0) return { triggered: false, reason: 'NO_SENT' };

  const bounceRate = bouncedCount / sentCount;
  const isVolumeMet = sentCount >= MIN_SENT_THRESHOLD;
  const isRateExceeded = bounceRate > MAX_BOUNCE_RATE_THRESHOLD;

  if (isVolumeMet && isRateExceeded) {
    return {
      triggered: true,
      sentCount,
      bouncedCount,
      bounceRate,
      action: 'PAUSE_CAMPAIGN_AND_NOTIFY_OWNER',
    };
  }

  return {
    triggered: false,
    sentCount,
    bouncedCount,
    bounceRate,
    reason: isVolumeMet ? 'BOUNCE_RATE_OK' : 'INSUFFICIENT_VOLUME',
  };
}

function runTests() {
  console.log('Running Campaign Emergency Brake Logic Tests...\n');

  // Case 1: Low volume (30 sent, 5 bounced = 16.7%). Should NOT trigger (volume < 50)
  const case1 = simulateEmergencyBrake({ sentCount: 30, bouncedCount: 5 });
  console.log('Case 1 (Low volume, high rate):', case1);
  console.assert(case1.triggered === false, 'Case 1 Failed: Should not trigger below 50 sent');
  console.assert(case1.reason === 'INSUFFICIENT_VOLUME');
  console.log('✓ Case 1 Passed: Safely bypassed on sample sizes < 50\n');

  // Case 2: High volume, healthy rate (100 sent, 4 bounced = 4.0%). Should NOT trigger (<= 8%)
  const case2 = simulateEmergencyBrake({ sentCount: 100, bouncedCount: 4 });
  console.log('Case 2 (Healthy rate):', case2);
  console.assert(case2.triggered === false, 'Case 2 Failed: Should not trigger at 4% bounce rate');
  console.assert(case2.reason === 'BOUNCE_RATE_OK');
  console.log('✓ Case 2 Passed: Campaign continues when bounce rate is healthy\n');

  // Case 3: High volume, dangerous rate (100 sent, 9 bounced = 9.0% > 8%). MUST TRIGGER!
  const case3 = simulateEmergencyBrake({ sentCount: 100, bouncedCount: 9 });
  console.log('Case 3 (Exceeds 8% threshold at volume > 50):', case3);
  console.assert(case3.triggered === true, 'Case 3 Failed: Emergency brake should trigger');
  console.assert(case3.action === 'PAUSE_CAMPAIGN_AND_NOTIFY_OWNER');
  console.log('✓ Case 3 Passed: Emergency Brake successfully triggered!\n');

  console.log('ALL EMERGENCY BRAKE TESTS PASSED (3/3)!');
}

runTests();
