const crypto = require("crypto");

/**
 * Refresh tokens are deliberately NOT JWTs. They are high-entropy opaque
 * random strings. The raw value is sent to the client exactly once (as an
 * httpOnly cookie) and is never persisted anywhere — only its SHA-256 hash
 * lives in the database. This means:
 *   - A DB leak alone cannot be used to forge a valid refresh token.
 *   - Revocation is immediate and authoritative (no waiting for JWT expiry).
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateTokenFamily() {
  return crypto.randomUUID();
}

module.exports = { generateRefreshToken, hashToken, generateTokenFamily };
