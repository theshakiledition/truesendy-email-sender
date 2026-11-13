/**
 * tests/impersonatorProtection.test.js
 * Verification test for:
 * 1. preventImpersonatorDestruction middleware (Express guard)
 * 2. resolveAuditActors attribution logic (attributing to impersonatorId)
 */

const assert = require('assert');
const { preventImpersonatorDestruction } = require('../src/middleware/impersonationGuard');
const { resolveAuditActors } = require('../src/utils/auditLogger');
const { signToken } = require('../src/utils/jwt.util');

async function runTests() {
  console.log('--- Testing Impersonator Protection & Audit Attribution ---');

  // Test 1: Impersonator blocked on DELETE /api/workspaces/delete
  {
    const impersonatedToken = signToken({
      userId: 'customer-user-123',
      role: 'USER',
      impersonatorId: 'admin-super-999',
    });

    let statusCalled = null;
    let jsonCalled = null;
    let nextCalled = false;

    const req = {
      method: 'DELETE',
      originalUrl: '/api/workspaces/delete',
      cookies: { auth_token: impersonatedToken },
      headers: {},
    };

    const res = {
      status(code) {
        statusCalled = code;
        return this;
      },
      json(data) {
        jsonCalled = data;
        return this;
      },
    };

    preventImpersonatorDestruction(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCalled, 403, 'Should return 403 status');
    assert.strictEqual(
      jsonCalled.error,
      'This action is not allowed while impersonating a user.',
      'Must match exact error message'
    );
    assert.strictEqual(nextCalled, false, 'Next should not be called when blocked');
    console.log('✓ Test 1 Passed: Impersonator blocked on DELETE /api/workspaces/delete with 403');
  }

  // Test 2: Impersonator blocked on POST /api/user/billing
  {
    const req = {
      method: 'POST',
      originalUrl: '/api/user/billing/subscribe',
      user: {
        userId: 'customer-user-123',
        impersonatorId: 'admin-super-999',
      },
      cookies: {},
      headers: {},
    };

    let statusCalled = null;
    let jsonCalled = null;
    const res = {
      status(c) {
        statusCalled = c;
        return this;
      },
      json(d) {
        jsonCalled = d;
        return this;
      },
    };

    preventImpersonatorDestruction(req, res, () => {});
    assert.strictEqual(statusCalled, 403, 'Should block POST /api/user/billing');
    assert.strictEqual(
      jsonCalled.error,
      'This action is not allowed while impersonating a user.'
    );
    console.log('✓ Test 2 Passed: Impersonator blocked on POST /api/user/billing with 403');
  }

  // Test 3: Normal user allowed on POST /api/user/password
  {
    let nextCalled = false;
    const req = {
      method: 'POST',
      originalUrl: '/api/user/password',
      user: {
        userId: 'customer-user-123',
        impersonatorId: null, // Normal user, not impersonating
      },
      cookies: {},
      headers: {},
    };
    const res = {};

    preventImpersonatorDestruction(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Normal user should proceed without blockage');
    console.log('✓ Test 3 Passed: Normal user allowed through sensitive endpoints');
  }

  // Test 4: Impersonator allowed on safe GET requests
  {
    let nextCalled = false;
    const req = {
      method: 'GET',
      originalUrl: '/api/user/billing',
      user: {
        userId: 'customer-user-123',
        impersonatorId: 'admin-super-999',
      },
      cookies: {},
      headers: {},
    };
    const res = {};

    preventImpersonatorDestruction(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'GET request should be allowed during impersonation');
    console.log('✓ Test 4 Passed: GET request allowed during impersonation');
  }

  // Test 5: Audit attribution - when impersonating, actorId MUST be impersonatorId
  {
    const session = {
      userId: 'target-customer-456',
      impersonatorId: 'admin-super-999',
    };

    const { actorId, impersonatorId, targetUserId, isImpersonating } = resolveAuditActors(session);

    assert.strictEqual(actorId, 'admin-super-999', 'actorId must be attributed to impersonatorId');
    assert.strictEqual(impersonatorId, 'admin-super-999');
    assert.strictEqual(targetUserId, 'target-customer-456');
    assert.strictEqual(isImpersonating, true);
    console.log('✓ Test 5 Passed: Audit log attributes action to impersonatorId, not targetUserId');
  }

  // Test 6: Audit attribution - normal user attributes to userId
  {
    const session = {
      userId: 'regular-user-789',
      impersonatorId: null,
    };

    const { actorId, impersonatorId, targetUserId, isImpersonating } = resolveAuditActors(session);

    assert.strictEqual(actorId, 'regular-user-789', 'actorId must be regular userId');
    assert.strictEqual(impersonatorId, null);
    assert.strictEqual(targetUserId, null);
    assert.strictEqual(isImpersonating, false);
    console.log('✓ Test 6 Passed: Audit log attributes normal user action to userId');
  }

  console.log('\nAll 6 verification tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
