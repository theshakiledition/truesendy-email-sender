/**
 * scripts/create-user.js
 * CLI Utility to create a customer user account with an active workspace.
 * 
 * Usage:
 *   node scripts/create-user.js [email] [password] [workspaceName]
 * Example:
 *   node scripts/create-user.js client@example.com Password123! "My Cold Outreach"
 */

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password.util');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'client@example.com').trim().toLowerCase();
  const password = args[1] || 'UserPassword123!';
  const workspaceName = args[2] || 'Primary Workspace';

  console.log('========================================================');
  console.log(' TrueSendy User & Workspace Creation Script');
  console.log('========================================================');
  console.log(`User Email:      ${email}`);
  console.log(`Workspace Name:  ${workspaceName}`);

  const passwordHash = hashPassword(password);

  try {
    // 1. Create or update User
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        systemRole: 'USER',
        isEmailVerified: true,
      },
      create: {
        email,
        firstName: 'Client',
        lastName: 'User',
        systemRole: 'USER',
        passwordHash,
        isEmailVerified: true,
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 2. Create Workspace and assign as OWNER
    const workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    console.log('\n[SUCCESS] User account & Workspace configured!');
    console.log('--------------------------------------------------------');
    console.log(`User ID:        ${user.id}`);
    console.log(`Email:          ${user.email}`);
    console.log(`Password:       ${password}`);
    console.log(`Workspace ID:   ${workspace.id}`);
    console.log(`Workspace Name: ${workspace.name}`);
    console.log('--------------------------------------------------------');
    console.log(`Login at: https://send.truesendy.com/login`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Failed to create user:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
