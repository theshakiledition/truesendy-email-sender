/**
 * scripts/create-superadmin.js
 * CLI Utility to bootstrap or update a Superadmin account in PostgreSQL.
 * 
 * Usage:
 *   node scripts/create-superadmin.js [email] [password]
 * Example:
 *   node scripts/create-superadmin.js admin@truesendy.com MySecurePassword123!
 */

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password.util');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@truesendy.com').trim().toLowerCase();
  const password = args[1] || 'SuperAdmin2026!TrueSendy';

  console.log('========================================================');
  console.log(' TrueSendy Superadmin Creation Script');
  console.log('========================================================');
  console.log(`Target Email:    ${email}`);
  console.log(`Target Role:     SUPERADMIN`);

  const passwordHash = hashPassword(password);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        systemRole: 'SUPERADMIN',
        passwordHash,
        isEmailVerified: true,
      },
      create: {
        email,
        firstName: 'System',
        lastName: 'Superadmin',
        systemRole: 'SUPERADMIN',
        passwordHash,
        isEmailVerified: true,
        subscriptionTier: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
      },
    });

    console.log('\n[SUCCESS] Superadmin account configured successfully!');
    console.log('--------------------------------------------------------');
    console.log(`User ID:   ${user.id}`);
    console.log(`Email:     ${user.email}`);
    console.log(`Role:      ${user.systemRole}`);
    console.log(`Password:  ${password}`);
    console.log('--------------------------------------------------------');
    console.log(`You can now log in at: https://send.truesendy.com/login`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Failed to create superadmin:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
