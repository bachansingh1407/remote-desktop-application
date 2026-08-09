const { z } = require("zod");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
    message: "Password must contain at least one letter and one number",
  });

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
};
