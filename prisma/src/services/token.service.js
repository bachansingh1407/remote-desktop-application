const prisma = require("../config/db");
const env = require("../config/env");
const { signAccessToken } = require("../utils/jwt");
const {
  generateRefreshToken,
  hashToken,
  generateTokenFamily,
} = require("../utils/tokenCrypto");
const ApiError = require("../utils/ApiError");
const { logAudit } = require("./audit.service");
const { AUDIT_ACTIONS } = require("../constants");

function refreshExpiryDate() {
  return new Date(Date.now() + env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
}

/**
 * Issues a brand-new access+refresh pair, starting a new rotation family.
 * Called on login/register.
 */
async function issueTokenPair(user, req) {
  const family = generateTokenFamily();
  return issueRotatedPair(user, family, req);
}

/**
 * Issues a new pair within an EXISTING family (used both for the initial
 * issue and for every subsequent rotation, so family is always preserved).
 */
async function issueRotatedPair(user, family, req) {
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(rawRefreshToken),
      family,
      userId: user.id,
      expiresAt: refreshExpiryDate(),
      userAgent: req?.headers?.["user-agent"] || null,
      ip: req?.ip || null,
    },
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

/**
 * Rotates a refresh token: validates it, revokes it, issues a new one in
 * the same family. Implements reuse detection — if a token that is already
 * revoked is presented again, it means either (a) a race/retry, or more
 * seriously (b) the token was stolen and both the attacker and the
 * legitimate user are trying to use it. We can't distinguish these, so we
 * conservatively revoke the ENTIRE family, forcing re-login everywhere.
 */
async function rotateRefreshToken(rawToken, req) {
  if (!rawToken) throw ApiError.unauthorized("No refresh token provided");

  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  if (existing.revoked) {
    // Reuse of a revoked token — assume compromise, nuke the family.
    await prisma.refreshToken.updateMany({
      where: { family: existing.family, revoked: false },
      data: { revoked: true },
    });
    await logAudit({
      userId: existing.userId,
      action: AUDIT_ACTIONS.REFRESH_REUSE_DETECTED,
      meta: { family: existing.family },
      req,
    });
    throw ApiError.unauthorized("Refresh token reuse detected. Please log in again.");
  }

  if (existing.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token expired");
  }

  if (!existing.user || !existing.user.isActive) {
    throw ApiError.unauthorized("Account is inactive");
  }

  const newRawToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawToken);

  // Revoke old + create new atomically so a crash mid-rotation can't leave
  // a token that's simultaneously "valid" under two hashes.
  const [, created] = await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true, replacedByHash: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        family: existing.family,
        userId: existing.userId,
        expiresAt: refreshExpiryDate(),
        userAgent: req?.headers?.["user-agent"] || null,
        ip: req?.ip || null,
      },
    }),
  ]);

  const accessToken = signAccessToken(existing.user);

  await logAudit({
    userId: existing.userId,
    action: AUDIT_ACTIONS.REFRESH_SUCCESS,
    meta: { family: existing.family, tokenId: created.id },
    req,
  });

  return {
    accessToken,
    refreshToken: newRawToken,
    user: existing.user,
  };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true },
  });
}

/** Revokes every session for a user — e.g. on password change or "log out everywhere". */
async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}

module.exports = {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
