const express = require("express");
const authRoutes = require("./auth.routes");
const nodeRoutes = require("./node.routes");
const communityRoutes = require("./community.routes");
const steveRoutes = require("./steve.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "OK", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/nodes", nodeRoutes);
router.use("/community", communityRoutes);
router.use("/steve", steveRoutes);

module.exports = router;
