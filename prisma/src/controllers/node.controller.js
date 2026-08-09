const fs = require("fs");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const nodeService = require("../services/node.service");
const { logAudit } = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../constants");
const axios = require("axios");

const getTree = asyncHandler(async (req, res) => {
  const items = await nodeService.getFullTree(req.user.id);
  new ApiResponse(200, { items }).send(res);
});

const listChildren = asyncHandler(async (req, res) => {
  const items = await nodeService.listChildren(req.user.id, req.query.parentId);
  new ApiResponse(200, { items }).send(res);
});

const listTrash = asyncHandler(async (req, res) => {
  const items = await nodeService.listTrash(req.user.id);
  new ApiResponse(200, { items }).send(res);
});

const search = asyncHandler(async (req, res) => {
  const items = await nodeService.searchNodes(req.user.id, req.query.q);
  new ApiResponse(200, { items }).send(res);
});

const getPath = asyncHandler(async (req, res) => {
  const path = await nodeService.getPath(req.user.id, req.params.id);
  new ApiResponse(200, { path }).send(res);
});

const stats = asyncHandler(async (req, res) => {
  const data = await nodeService.getWorkspaceStats(req.user.id);
  new ApiResponse(200, data).send(res);
});

const createFolder = asyncHandler(async (req, res) => {
  const node = await nodeService.createFolder(req.user.id, req.body);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_CREATE, meta: { id: node.id, type: "FOLDER" }, req });
  new ApiResponse(201, { node }, "Folder created").send(res);
});

const createFile = asyncHandler(async (req, res) => {
  const node = await nodeService.createFile(req.user.id, req.body);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_CREATE, meta: { id: node.id, type: "FILE" }, req });
  new ApiResponse(201, { node }, "File created").send(res);
});

const importFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const parentId = req.body.parentId === "null" || !req.body.parentId ? null : req.body.parentId;
  const node = await nodeService.importFile(req.user.id, { parentId, file: req.file });
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_CREATE, meta: { id: node.id, type: "FILE", imported: true }, req });
  new ApiResponse(201, { node }, "File uploaded").send(res);
});

const updateContent = asyncHandler(async (req, res) => {
  const node = await nodeService.updateContent(req.params.id, req.user.id, req.body.content);
  new ApiResponse(200, { node }, "File saved").send(res);
});

const rename = asyncHandler(async (req, res) => {
  const node = await nodeService.renameNode(req.params.id, req.user.id, req.body.name);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_RENAME, meta: { id: node.id }, req });
  new ApiResponse(200, { node }, "Renamed").send(res);
});

const move = asyncHandler(async (req, res) => {
  const node = await nodeService.moveNode(req.params.id, req.user.id, req.body.newParentId);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_MOVE, meta: { id: node.id, newParentId: req.body.newParentId }, req });
  new ApiResponse(200, { node }, "Moved").send(res);
});

const duplicate = asyncHandler(async (req, res) => {
  const node = await nodeService.duplicateNode(req.params.id, req.user.id);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_DUPLICATE, meta: { id: node.id }, req });
  new ApiResponse(201, { node }, "Duplicated").send(res);
});

const trash = asyncHandler(async (req, res) => {
  const result = await nodeService.trashNode(req.params.id, req.user.id);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_TRASH, meta: { id: req.params.id, ...result }, req });
  new ApiResponse(200, result, "Moved to trash").send(res);
});

const restore = asyncHandler(async (req, res) => {
  const result = await nodeService.restoreNode(req.params.id, req.user.id);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_RESTORE, meta: { id: req.params.id, ...result }, req });
  new ApiResponse(200, result, "Restored").send(res);
});

const deleteForever = asyncHandler(async (req, res) => {
  const result = await nodeService.deleteForever(req.params.id, req.user.id);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_DELETE_FOREVER, meta: { id: req.params.id, ...result }, req });
  new ApiResponse(200, result, "Deleted permanently").send(res);
});

const emptyTrash = asyncHandler(async (req, res) => {
  const result = await nodeService.emptyTrash(req.user.id);
  await logAudit({ userId: req.user.id, action: AUDIT_ACTIONS.NODE_EMPTY_TRASH, meta: result, req });
  new ApiResponse(200, result, "Trash emptied").send(res);
});

const download = asyncHandler(async (req, res) => {
  const node = await nodeService.getDownloadInfo(
    req.params.id,
    req.user.id
  );

  const response = await axios.get(node.storagePath, {
    responseType: "arraybuffer",
  });

  res.setHeader(
    "Content-Type",
    response.headers["content-type"]
  );

  res.send(response.data);
});

module.exports = {
  getTree,
  listChildren,
  listTrash,
  search,
  getPath,
  stats,
  createFolder,
  createFile,
  importFile,
  updateContent,
  rename,
  move,
  duplicate,
  trash,
  restore,
  deleteForever,
  emptyTrash,
  download,
};
