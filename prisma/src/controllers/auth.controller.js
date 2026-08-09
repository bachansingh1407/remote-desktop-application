const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const authService = require("../services/auth.service");
const { rotateRefreshToken } = require("../services/token.service");
const env = require("../config/env");

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/api/auth",
  maxAge: env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res, token) {
  res.cookie(env.refreshTokenCookieName, token, cookieOptions);
}

function clearRefreshCookie(res) {
  res.clearCookie(env.refreshTokenCookieName, { ...cookieOptions, maxAge: 0 });
}

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body, req);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(201, { user, accessToken }, "Account created successfully").send(res);
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body, req);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(200, { user, accessToken }, "Logged in successfully").send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.[env.refreshTokenCookieName];
  const { accessToken, refreshToken, user } = await rotateRefreshToken(incoming, req);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(200, { accessToken, user: { id: user.id, role: user.role, email: user.email } }).send(
    res
  );
});

const logout = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.[env.refreshTokenCookieName];
  await authService.logout(incoming, req.user?.id, req);
  clearRefreshCookie(res);
  new ApiResponse(200, null, "Logged out successfully").send(res);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  new ApiResponse(200, { user }).send(res);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body, req);
  new ApiResponse(200, { user }, "Profile updated").send(res);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword, req);
  clearRefreshCookie(res);
  new ApiResponse(200, null, "Password changed. Please log in again.").send(res);
});

module.exports = { register, login, refresh, logout, me, updateProfile, changePassword };
