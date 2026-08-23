const fs = require("fs");
const archiver = require("archiver");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const nodeService = require("../services/node.service");
const { logAudit } = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../constants");
const axios = require("axios");

// RFC 5987-style filename so names with unicode/spaces/quotes survive
// intact instead of getting mangled by naive browsers.
function contentDisposition(name) {
  const fallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function streamZip(res, { zipName, entries }) {
  res.status(200);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", contentDisposition(`${zipName}.zip`));

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    // Headers are already flushed by this point — nothing to do but end
    // the connection; the client will see a truncated/corrupt download,
    // which is honest given something actually failed mid-stream.
    res.destroy(err);
  });
  archive.pipe(res);

  for (const entry of entries) {
    if (!entry.node) {
      // Directory-only entry (empty folder placeholder).
      archive.append(Buffer.alloc(0), { name: entry.relPath });
      continue;
    }
    if (entry.node.storagePath) {
      try {
        const remote = await axios.get(entry.node.storagePath, { responseType: "stream" });
        archive.append(remote.data, { name: entry.relPath });
      } catch {
        // One bad remote file shouldn't sink the whole zip — drop in a
        // placeholder noting it couldn't be fetched and keep going.
        archive.append(Buffer.from("This file could not be downloaded.\n"), {
          name: `${entry.relPath}.error.txt`,
        });
      }
    } else {
      archive.append(Buffer.from(entry.node.content ?? "", "utf-8"), { name: entry.relPath });
    }
  }

  await archive.finalize();
}

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

// GET /nodes/:id/download — single item. Folders are zipped on the fly;
// files stream directly (from ImageKit for uploads, from the DB `content`
// column for in-app text files — previously unsupported and a 404).
const download = asyncHandler(async (req, res) => {
  const descriptor = await nodeService.getDownloadDescriptor(req.params.id, req.user.id);

  if (descriptor.kind === "folder") {
    const entries = await nodeService.buildZipEntries([descriptor.node.id], req.user.id);
    await streamZip(res, { zipName: descriptor.node.name, entries });
    return;
  }

  if (descriptor.kind === "buffer") {
    res.setHeader("Content-Type", descriptor.mimeType);
    res.setHeader("Content-Disposition", contentDisposition(descriptor.name));
    res.setHeader("Content-Length", descriptor.buffer.length);
    res.send(descriptor.buffer);
    return;
  }

  // kind === "remote": proxy-stream from ImageKit instead of buffering the
  // whole file in memory (the old arraybuffer approach), and set the
  // filename so the browser actually saves it as a download rather than
  // navigating to it inline.
  const upstream = await axios.get(descriptor.storagePath, { responseType: "stream" });
  res.setHeader("Content-Type", upstream.headers["content-type"] || descriptor.mimeType);
  res.setHeader("Content-Disposition", contentDisposition(descriptor.name));
  if (upstream.headers["content-length"]) {
    res.setHeader("Content-Length", upstream.headers["content-length"]);
  }
  upstream.data.pipe(res);
});

// GET /nodes/download?ids=a,b,c — bulk/multi-select download. Any mix of
// file and folder ids, zipped together at the top level.
const downloadBulk = asyncHandler(async (req, res) => {
  const raw = req.query.ids;
  if (!raw) throw ApiError.badRequest("No items selected");
  const ids = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) throw ApiError.badRequest("No items selected");

  const entries = await nodeService.buildZipEntries(ids, req.user.id);
  const zipName = ids.length === 1 ? "download" : `download-${ids.length}-items`;
  await streamZip(res, { zipName, entries });
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
  downloadBulk,
};
