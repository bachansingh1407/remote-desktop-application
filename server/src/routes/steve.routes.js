const express = require("express");
const steveController = require("../controllers/steve.controller");
const authenticate = require("../middlewares/authenticate.middleware");
const validate = require("../middlewares/validate.middleware");
const { steveChatLimiter } = require("../middlewares/rateLimiters");
const { chatSchema } = require("../validators/steve.validator");

const router = express.Router();

router.use(authenticate);
router.post("/chat", steveChatLimiter, validate({ body: chatSchema }), steveController.chat);

module.exports = router;
