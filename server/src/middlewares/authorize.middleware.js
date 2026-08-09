const ApiError = require("../utils/ApiError");

/**
 * Usage: router.get("/admin-only", authenticate, authorize("ADMIN"), handler)
 * Must run AFTER `authenticate` — relies on req.user being set.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(ApiError.forbidden("You do not have permission to perform this action"));
  }
  next();
};

module.exports = authorize;
