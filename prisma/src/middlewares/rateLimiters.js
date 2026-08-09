const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

// Shared handler so rate-limit rejections go through the same JSON error
// shape as everything else instead of express-rate-limit's default text.
const rateLimitHandler = (req, res, next) => {
  next(ApiError.tooManyRequests("Too many requests. Please try again later."));
};

const globalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Tighter limiter specifically for login/register/refresh — these are the
// endpoints brute-force and credential-stuffing attacks target directly.
// This is IP-based defense in depth; it works alongside (not instead of)
// the per-account lockout enforced in auth.service.js.
const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMinutes * 60 * 1000,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
});

module.exports = { globalLimiter, authLimiter };
