const prisma = require("../config/db");
const logger = require("../config/logger");

/**
 * Writes an audit trail entry. Deliberately never throws upward into the
 * calling flow — a logging failure should never block a real user action
 * (e.g. don't fail a login because the audit_logs insert hiccuped).
 */
async function logAudit({ userId = null, action, meta = null, req = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        meta,
        ip: req?.ip || null,
        userAgent: req?.headers?.["user-agent"] || null,
      },
    });
  } catch (err) {
    logger.warn("Failed to write audit log", { action, error: err.message });
  }
}

module.exports = { logAudit };
