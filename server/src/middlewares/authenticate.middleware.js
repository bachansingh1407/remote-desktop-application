const { verifyAccessToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/db");

/**
 * Verifies the Authorization: Bearer <accessToken> header.
 * Attaches req.user = { id, role, email }.
 *
 * Deliberately re-checks isActive against the DB (cheap indexed lookup on
 * PK) rather than trusting the JWT payload blindly — this lets us disable
 * a compromised/offboarded account instantly instead of waiting up to
 * ACCESS_TOKEN_EXPIRY for the stale claim to expire.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Account is inactive or no longer exists");
  }

  req.user = { id: user.id, role: user.role, email: user.email };
  next();
});

module.exports = authenticate;
