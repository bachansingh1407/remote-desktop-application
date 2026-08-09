const express = require("express");
const nodeController = require("../controllers/node.controller");
const authenticate = require("../middlewares/authenticate.middleware");
const validate = require("../middlewares/validate.middleware");
const { upload } = require("../middlewares/upload.middleware");
const {
  idParamSchema,
  listQuerySchema,
  createFolderSchema,
  createFileSchema,
  renameSchema,
  moveSchema,
  contentSchema,
  searchQuerySchema,
} = require("../validators/node.validator");

const router = express.Router();

// Every route in this file requires a valid access token.
router.use(authenticate);

// --- Fixed-path routes FIRST, before any /:id routes, to avoid collisions ---
router.get("/tree", nodeController.getTree);
router.get("/", validate({ query: listQuerySchema }), nodeController.listChildren);
router.get("/trash", nodeController.listTrash);
router.delete("/trash/empty", nodeController.emptyTrash);
router.get("/search", validate({ query: searchQuerySchema }), nodeController.search);
router.get("/stats", nodeController.stats);

router.post("/folder", validate({ body: createFolderSchema }), nodeController.createFolder);
router.post("/file", validate({ body: createFileSchema }), nodeController.createFile);
router.post("/import", upload.single("file"), nodeController.importFile);

// --- Parameterized routes ---
router.get("/:id/path", validate({ params: idParamSchema }), nodeController.getPath);
router.get("/:id/download", validate({ params: idParamSchema }), nodeController.download);

router.patch(
  "/:id/content",
  validate({ params: idParamSchema, body: contentSchema }),
  nodeController.updateContent
);
router.patch(
  "/:id/rename",
  validate({ params: idParamSchema, body: renameSchema }),
  nodeController.rename
);
router.patch(
  "/:id/move",
  validate({ params: idParamSchema, body: moveSchema }),
  nodeController.move
);
router.post("/:id/duplicate", validate({ params: idParamSchema }), nodeController.duplicate);
router.post("/:id/trash", validate({ params: idParamSchema }), nodeController.trash);
router.post("/:id/restore", validate({ params: idParamSchema }), nodeController.restore);
router.delete("/:id", validate({ params: idParamSchema }), nodeController.deleteForever);

module.exports = router;
