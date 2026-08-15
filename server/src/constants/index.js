const ROLES = Object.freeze({
  USER: "USER",
  ADMIN: "ADMIN",
});

const NODE_TYPES = Object.freeze({
  FILE: "FILE",
  FOLDER: "FOLDER",
});

// Audit action names — kept as plain strings (not an enum in Postgres) so
// new event types can be added without a migration.
const AUDIT_ACTIONS = Object.freeze({
  REGISTER: "auth.register",
  LOGIN_SUCCESS: "auth.login_success",
  LOGIN_FAILED: "auth.login_failed",
  LOGIN_LOCKED: "auth.login_locked",
  LOGOUT: "auth.logout",
  REFRESH_SUCCESS: "auth.refresh_success",
  REFRESH_REUSE_DETECTED: "auth.refresh_reuse_detected",
  PASSWORD_CHANGED: "auth.password_changed",
  PROFILE_UPDATED: "auth.profile_updated",

  NODE_CREATE: "node.create",
  NODE_RENAME: "node.rename",
  NODE_MOVE: "node.move",
  NODE_DUPLICATE: "node.duplicate",
  NODE_TRASH: "node.trash",
  NODE_RESTORE: "node.restore",
  NODE_DELETE_FOREVER: "node.delete_forever",
  NODE_EMPTY_TRASH: "node.empty_trash",

  COMMUNITY_POST_CREATE: "community.post_create",
  COMMUNITY_POST_DELETE: "community.post_delete",
});

module.exports = { ROLES, NODE_TYPES, AUDIT_ACTIONS };
