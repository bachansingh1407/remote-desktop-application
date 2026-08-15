const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../constants");

/**
 * Creates a post. authorId is stamped from the authenticated session (for
 * moderation only) even though `name` is a free-text field the poster
 * chose themselves — the two are intentionally decoupled.
 */
async function createPost(authorId, { name, message }) {
  return prisma.communityPost.create({
    data: { name, message, authorId },
    select: { id: true, name: true, message: true, createdAt: true, authorId: true },
  });
}

/**
 * Cursor-paginated, newest first. Cursor is the id of the last post the
 * caller already has; `createdAt` isn't unique enough alone to cursor on
 * safely (two posts in the same millisecond), so we page on
 * (createdAt, id) via Prisma's cursor + skip:1 pattern.
 */
async function listPosts({ cursor, limit }) {
  const posts = await prisma.communityPost.findMany({
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, message: true, createdAt: true, authorId: true },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/**
 * A post can be removed by whoever wrote it, or by an admin. Everyone
 * else gets a 403 — not a 404 — so the frontend can tell "not yours"
 * apart from "already gone" if it ever needs to.
 */
async function deletePost(postId, requester) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound("Post not found");

  const isOwner = post.authorId && post.authorId === requester.id;
  const isAdmin = requester.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("You can only remove your own posts");
  }

  await prisma.communityPost.delete({ where: { id: postId } });
}

module.exports = { createPost, listPosts, deletePost };
