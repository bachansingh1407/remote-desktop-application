const express = require("express");
const communityController = require("../controllers/community.controller");
const authenticate = require("../middlewares/authenticate.middleware");
const validate = require("../middlewares/validate.middleware");
const { communityLimiter } = require("../middlewares/rateLimiters");
const { createPostSchema, listQuerySchema, idParamSchema } = require("../validators/community.validator");

const router = express.Router();

// Every route requires a valid access token (the app is behind the desktop
// login), but note `name` in the body is a free-typed display name, not the
// account name — see community.service.js.
router.use(authenticate);

router.get("/", validate({ query: listQuerySchema }), communityController.list);
router.post("/", communityLimiter, validate({ body: createPostSchema }), communityController.create);
router.delete("/:id", validate({ params: idParamSchema }), communityController.remove);

module.exports = router;
