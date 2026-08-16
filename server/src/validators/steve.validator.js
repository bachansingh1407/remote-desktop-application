const { z } = require("zod");

// Deliberately permissive shape — this mirrors the OpenAI/Groq chat message
// format, which varies by role (a "tool" message has tool_call_id + name,
// an "assistant" message with tool calls has no content, etc.). We validate
// structure and bound the sizes, not every role-specific combination.
const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().max(4000).nullable().optional(),
  tool_calls: z.array(z.any()).max(6).optional(),
  tool_call_id: z.string().max(200).optional(),
  name: z.string().max(100).optional(),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(60),
});

module.exports = { chatSchema };
