const { PrismaClient } = require("@prisma/client");
const env = require("./env");

// Singleton pattern: prevents nodemon hot-reloads from spawning a new
// PrismaClient (and a new connection pool) on every restart in dev.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: env.isProd ? ["error", "warn"] : ["error", "warn"],
  });

if (!env.isProd) {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
