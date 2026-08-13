const { Prisma } = require("@prisma/client");
const multer = require("multer");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");

// Only for errors Prisma itself expects can happen during normal
// operation (unique constraint, missing row, etc) — message text here is
// safe to show a user because we author it ourselves below, never Prisma's.
function mapKnownRequestError(err) {
  switch (err.code) {
    case "P2002":
      return ApiError.conflict(
        `A record with this ${err.meta?.target?.join(", ") || "value"} already exists`
      );
    case "P2003":
      return ApiError.badRequest("Related record does not exist");
    case "P2025":
      return ApiError.notFound("Record not found");
    default:
      return ApiError.internal("Something went wrong. Please try again.");
  }
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let error = err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = mapKnownRequestError(err);
  } else if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    // The database itself is unreachable, crashed, or misconfigured. This
    // is the exact error class that was previously leaking straight to
    // the login screen: Prisma's own error message includes the full
    // Postgres/Neon connection host and port, the query, and file paths —
    // a direct fingerprint of "this backend runs Prisma + PostgreSQL" and
    // exactly where the DB lives. None of that is safe to show a user, in
    // dev or in prod, so it's mapped to a plain, honest message instead.
    // Full details still go to the server log below for whoever's
    // actually debugging it.
    error = ApiError.serviceUnavailable(
      "We couldn't reach the database right now. Please try again in a moment."
    );
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    // Malformed query args (a bug, not a user mistake) — also carries
    // internal schema/field names in its message, same reasoning as above.
    error = ApiError.internal("Something went wrong. Please try again.");
  } else if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(`Upload error: ${err.message}`);
  } else if (!(err instanceof ApiError)) {
    // Any other unexpected/unhandled error — never leak internals to the
    // client, in dev or prod. The raw message/stack goes to the server
    // log immediately below (and only there — see the response block at
    // the bottom of this function for why nothing internal ever reaches
    // the HTTP response, regardless of NODE_ENV).
    error = ApiError.internal("Something went wrong. Please try again.");
  }

  if (error.statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  }

  // The stack trace (and anything else about the underlying error) never
  // goes in the HTTP response body — only to the server log above. A
  // dev-only "include stack for debugging" field was tried here before,
  // but the browser's Network tab shows the full response regardless of
  // NODE_ENV, so that field was itself the leak: anyone with devtools open
  // could read the exact DB host, file paths, and internal library names.
  // If you need a stack trace while debugging locally, read it from the
  // terminal running the server (logger.error above), not the response.
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
  });
}

module.exports = errorMiddleware;