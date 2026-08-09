const { z } = require("zod");

const uuid = z.string().uuid("Invalid id");
const nullableParentId = z.union([uuid, z.null()]).optional();
const nodeName = z.string().trim().min(1, "Name is required").max(255);

const idParamSchema = z.object({ id: uuid });

const listQuerySchema = z.object({
  parentId: z.union([uuid, z.literal("null")]).optional(),
});

const createFolderSchema = z.object({
  parentId: nullableParentId,
  name: nodeName,
});

const createFileSchema = z.object({
  parentId: nullableParentId,
  name: nodeName,
  content: z.string().optional().default(""),
});

const renameSchema = z.object({
  name: nodeName,
});

const moveSchema = z.object({
  newParentId: z.union([uuid, z.null()]),
});

const contentSchema = z.object({
  content: z.string(),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(255),
});

module.exports = {
  idParamSchema,
  listQuerySchema,
  createFolderSchema,
  createFileSchema,
  renameSchema,
  moveSchema,
  contentSchema,
  searchQuerySchema,
};
