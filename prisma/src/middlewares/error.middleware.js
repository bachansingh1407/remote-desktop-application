const { Prisma } = require("@prisma/client");
const multer = require("multer");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const logger = require("../config/logger");

function mapPrismaError(err) {
  switch (err.code) {
    case "P2002":
      return ApiError.conflict(
        `A record with this ${err.meta?.target?.join(", ") || "value"} already exists`
      );
    case "P2003":
      return ApiError.badRequest("Related record does not exist (foreign key constraint)");
    case "P2025":
      return ApiError.notFound("Record not found");
    default:
      return ApiError.internal("Database error");
  }
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let error = err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = mapPrismaError(err);
  } else if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(`Upload error: ${err.message}`);
  } else if (!(err instanceof ApiError)) {
    // Unexpected/unhandled error — never leak internals to the client.
    logger.error("Unhandled error", { message: err.message, stack: err.stack });
    error = ApiError.internal(env.isProd ? "Something went wrong" : err.message);
  }

  if (error.statusCode >= 500) {
    logger.error(error.message, { stack: err.stack, path: req.originalUrl });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = errorMiddleware;
