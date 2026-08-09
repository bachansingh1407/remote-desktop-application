const jwt = require("jsonwebtoken");
const env = require("../config/env");
const ApiError = require("./ApiError");

/**
 * Access tokens are short-lived JWTs. They carry just enough to authorize
 * a request (sub, role) — never anything sensitive. They are NOT stored
 * anywhere server-side; validity = signature + expiry only.
 */
function signAccessToken({ id, role, email }) {
  return jwt.sign({ sub: id, role, email }, env.accessTokenSecret, {
    expiresIn: env.accessTokenExpiry,
    issuer: "ostrin-backend",
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.accessTokenSecret, { issuer: "ostrin-backend" });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Access token expired");
    }
    throw ApiError.unauthorized("Invalid access token");
  }
}

module.exports = { signAccessToken, verifyAccessToken };
