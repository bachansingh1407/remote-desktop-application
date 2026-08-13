require("dotenv").config();

// Fail fast: a backend that silently boots without its secrets is worse
// than one that refuses to start. This is the single source of truth for
// config — nowhere else in the codebase should read process.env directly.

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === "") {
    throw new Error(`[config] Missing required environment variable: ${key}`);
  }
  return value;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 5000),
  apiPrefix: process.env.API_PREFIX || "/api",

  databaseUrl: required("DATABASE_URL"),

  // Comma-separated list supported, e.g.
  // "http://localhost:3000,https://your-frontend.vercel.app"
  // so local dev and a deployed frontend can both hit this backend
  // without needing separate .env files.
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",

  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7),
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || "refreshToken",

  // In production the frontend and backend almost always live on different
  // origins (e.g. vercel.app + onrender.com) — that's a cross-site request,
  // and cross-site cookies are only sent by browsers when SameSite=None
  // AND Secure=true. SameSite=Lax (fine for same-site localhost dev) is
  // silently dropped on cross-site XHR/fetch, which looks exactly like
  // "refresh token flow is broken" (login works, then the session vanishes
  // on the very next request). Defaults below auto-pick the right pair
  // unless explicitly overridden via env.
  cookieSecure: toBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production"),
  cookieSameSite:
    process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === "production" ? "none" : "lax"),

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),

  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  lockoutDurationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES || 15),

  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  authRateLimitWindowMinutes: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || 15),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  // Refresh is called silently/automatically far more often than login is
  // called by a human — needs its own, more generous ceiling. See
  // rateLimiters.js for the full reasoning.
  refreshRateLimitMax: Number(process.env.REFRESH_RATE_LIMIT_MAX || 60),

  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 15),

  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@ostrin.dev",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!",
  seedAdminName: process.env.SEED_ADMIN_NAME || "Admin",
  imagekit: {
    publicKey: required("IMAGEKIT_PUBLIC_KEY"),
    privateKey: required("IMAGEKIT_PRIVATE_KEY"),
    urlEndpoint: required("IMAGEKIT_URL_ENDPOINT"),
    folder: process.env.IMAGEKIT_FOLDER || "workspace",
  },
};
console.log("CORS allowed origins:", env.corsOrigins.join(", "));
console.log("ImageKit:", env.imagekit.urlEndpoint);
if (env.isProd && env.accessTokenSecret.length < 32) {
  throw new Error(
    "[config] ACCESS_TOKEN_SECRET is too short for production. Use `openssl rand -hex 64`."
  );
}

module.exports = env;