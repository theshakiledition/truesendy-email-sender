/**
 * src/controllers/auth.controller.js
 * Authentication Controller for Express API.
 * Handles Superadmin / User login, session verification, and logout.
 */

let prismaClient;
function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

const { verifyPassword } = require('../utils/password.util');
const { signToken, verifyToken, SECURE_COOKIE_OPTIONS } = require('../utils/jwt.util');

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const prisma = getPrisma();

    // 1. Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        systemRole: true,
        isEmailVerified: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // 2. Verify password
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // 3. Generate signed JWT (24 hours)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.systemRole,
      systemRole: user.systemRole,
    };

    const token = signToken(tokenPayload, 86400);

    // 4. Set secure HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      redirectTo: user.systemRole === 'SUPERADMIN' ? '/admin' : '/campaigns',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        role: user.systemRole,
      },
    });
  } catch (error) {
    console.error('[AuthController.login Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
}

/**
 * GET /api/auth/session
 */
async function getSession(req, res) {
  try {
    const token =
      (req.cookies && req.cookies.auth_token) ||
      (req.headers.authorization && req.headers.authorization.replace('Bearer ', '').trim());

    if (!token) {
      return res.status(200).json({ authenticated: false, user: null });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(200).json({ authenticated: false, user: null });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        id: payload.userId || payload.id,
        email: payload.email,
        role: payload.role,
        systemRole: payload.systemRole || payload.role,
        impersonatorId: payload.impersonatorId || null,
        impersonatedAt: payload.impersonatedAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      authenticated: false,
      user: null,
      error: err.message,
    });
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res) {
  res.clearCookie('auth_token', { path: '/' });
  res.clearCookie('admin_token', { path: '/' });
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

module.exports = {
  login,
  getSession,
  logout,
};
