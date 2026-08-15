const { z } = require("zod");

// Deliberately generous but bounded — this is a public wall, so the caps
// exist to keep cards readable and stop someone pasting an essay, not to
// police content.
const createPostSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(40, "Keep your name under 40 characters"),
  message: z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(500, "Keep it under 500 characters"),
});

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const idParamSchema = z.object({
  id: z.string().uuid("Invalid id"),
});

module.exports = { createPostSchema, listQuerySchema, idParamSchema };
