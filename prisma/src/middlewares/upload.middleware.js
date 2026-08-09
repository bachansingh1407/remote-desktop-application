const multer = require("multer");
const path = require("path");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

// Store file in memory instead of local disk.
// The controller will upload this buffer to ImageKit.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    // Block dangerous executable files
    const blocked = [".exe", ".bat", ".cmd", ".sh", ".msi"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (blocked.includes(ext)) {
        return cb(ApiError.badRequest(`File type ${ext} is not allowed`));
    }

    cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: env.maxFileSizeMb * 1024 * 1024,
    },
});

module.exports = { upload };