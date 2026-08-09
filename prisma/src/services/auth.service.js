const prisma = require("../config/db");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { hashPassword, comparePassword } = require("../utils/hash");
const { issueTokenPair, revokeRefreshToken, revokeAllUserTokens } = require("./token.service");
const { logAudit } = require("./audit.service");
const { AUDIT_ACTIONS, ROLES } = require("../constants");

const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

async function register({ name, email, password }, req) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: ROLES.USER },
    select: publicUser,
  });

  const tokens = await issueTokenPair(user, req);
  await logAudit({ userId: user.id, action: AUDIT_ACTIONS.REGISTER, req });

  return { user, ...tokens };
}

async function login({ email, password }, req) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Constant-shape response whether the account exists or not, to avoid
  // leaking which emails are registered via timing/response differences
  // as much as practical at this layer.
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated");
  }

  // --- Server-side lockout (authoritative; frontend lockout is UX-only) ---
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    await logAudit({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_LOCKED, req });
    throw ApiError.tooManyRequests(
      `Account is temporarily locked. Try again in ${secondsLeft}s.`
    );
  }

  const isValid = await comparePassword(password, user.passwordHash);

  if (!isValid) {
    const failedAttempts = user.failedAttempts + 1;
    const shouldLock = failedAttempts >= env.maxLoginAttempts;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.lockoutDurationMinutes * 60 * 1000)
          : null,
      },
    });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      meta: { failedAttempts, locked: shouldLock },
      req,
    });

    if (shouldLock) {
      throw ApiError.tooManyRequests(
        `Too many failed attempts. Account locked for ${env.lockoutDurationMinutes} minutes.`
      );
    }
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Successful login — reset lockout counters.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const tokens = await issueTokenPair(user, req);
  await logAudit({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_SUCCESS, req });

  const { passwordHash, failedAttempts, lockedUntil, ...safeUser } = user;
  return { user: safeUser, ...tokens };
}

async function logout(rawRefreshToken, userId, req) {
  await revokeRefreshToken(rawRefreshToken);
  await logAudit({ userId, action: AUDIT_ACTIONS.LOGOUT, req });
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUser,
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

async function updateProfile(userId, { name }, req) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: publicUser,
  });
  await logAudit({ userId, action: AUDIT_ACTIONS.PROFILE_UPDATED, req });
  return user;
}

async function changePassword(userId, currentPassword, newPassword, req) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Password change invalidates every existing session — a compromised
  // session shouldn't survive the user regaining control of their account.
  await revokeAllUserTokens(userId);
  await logAudit({ userId, action: AUDIT_ACTIONS.PASSWORD_CHANGED, req });
}

module.exports = { register, login, logout, getMe, updateProfile, changePassword };
