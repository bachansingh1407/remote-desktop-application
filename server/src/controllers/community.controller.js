const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const communityService = require("../services/community.service");
const { logAudit } = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../constants");

const create = asyncHandler(async (req, res) => {
  const post = await communityService.createPost(req.user.id, req.body);
  await logAudit({
    userId: req.user.id,
    action: AUDIT_ACTIONS.COMMUNITY_POST_CREATE,
    meta: { id: post.id },
    req,
  });
  new ApiResponse(201, { post }, "Posted to the community wall").send(res);
});

const list = asyncHandler(async (req, res) => {
  const { items, nextCursor } = await communityService.listPosts(req.query);
  new ApiResponse(200, { items, nextCursor }).send(res);
});

const remove = asyncHandler(async (req, res) => {
  await communityService.deletePost(req.params.id, req.user);
  await logAudit({
    userId: req.user.id,
    action: AUDIT_ACTIONS.COMMUNITY_POST_DELETE,
    meta: { id: req.params.id },
    req,
  });
  new ApiResponse(200, null, "Post removed").send(res);
});

module.exports = { create, list, remove };
