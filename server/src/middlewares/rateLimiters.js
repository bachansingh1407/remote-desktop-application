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

// Tighter limiter specifically for login/register — these are the
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

// Separate, much more generous limiter for /auth/refresh.
//
// IMPORTANT: refresh is not a "credential attempt" the way login/register
// are — the frontend calls it silently on every app boot (initializeAuth)
// and again automatically from the axios 401-interceptor on basically
// every expired-access-token request. A real user session can legitimately
// fire this dozens of times an hour just from normal page reloads / tab
// switches. Sharing the strict 10-per-15-min login limiter with this route
// means a handful of page refreshes during normal use (or dev hot-reload)
// exhausts the quota and starts 429-ing genuine login attempts too.
// Reuse-detection + rotation in token.service.js is the real defense here;
// this limiter just needs to catch abusive hammering, not everyday use.
const refreshLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMinutes * 60 * 1000,
  max: env.refreshRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // only count failed/invalid refresh attempts against the quota
});

// Community wall is public-ish (any authenticated user, free-text name).
// Without a per-account cap someone could script-post hundreds of cards
// and flood the board — this is deliberately generous for real usage
// (a person posting a handful of times a session) but hard enough to stop
// a spam loop. Independent of globalLimiter, which is IP-wide across the
// whole API.
const communityLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Steve's chat endpoint calls out to Groq, which is real, metered API
// usage — this needs its own ceiling independent of globalLimiter so a
// runaway frontend loop (or someone hammering the chat box) can't rack up
// unbounded LLM cost. One user turn can trigger up to 2 Groq calls (the
// tool-calling round trip), so this is sized generously enough for normal
// back-and-forth conversation while still capping worst-case abuse.
const steveChatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter, refreshLimiter, communityLimiter, steveChatLimiter };
