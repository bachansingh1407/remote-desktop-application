const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const prisma = require("./config/db");

const server = app.listen(env.port, () => {
  logger.info(`Ostrin backend listening on port ${env.port} [${env.nodeEnv}]`);
});

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Shutdown complete.");
    process.exit(0);
  });

  // Force-exit if graceful shutdown hangs for more than 10s.
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: reason?.message || reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — exiting", { message: err.message, stack: err.stack });
  process.exit(1);
});
