const express = require("express");
const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate.middleware");
const validate = require("../middlewares/validate.middleware");
const { authLimiter, refreshLimiter } = require("../middlewares/rateLimiters");
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require("../validators/auth.validator");

const router = express.Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), authController.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);
router.patch(
  "/profile",
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile
);
router.post(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

module.exports = router;