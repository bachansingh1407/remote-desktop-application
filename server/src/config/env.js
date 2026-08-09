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

  corsOrigin: (process.env.CORS_ORIGIN),

  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",

  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7),
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || "refreshToken",

  cookieSecure: toBool(process.env.COOKIE_SECURE, false),
  cookieSameSite: process.env.COOKIE_SAME_SITE || "lax",

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),

  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  lockoutDurationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES || 15),

  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  authRateLimitWindowMinutes: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || 15),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),

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
console.log("CORS:", env.corsOrigin);
console.log("ImageKit:", env.imagekit.urlEndpoint);
if (env.isProd && env.accessTokenSecret.length < 32) {
  throw new Error(
    "[config] ACCESS_TOKEN_SECRET is too short for production. Use `openssl rand -hex 64`."
  );
}

module.exports = env;
