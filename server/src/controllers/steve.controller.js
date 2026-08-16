const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const steveService = require("../services/steve.service");

const chat = asyncHandler(async (req, res) => {
  const message = await steveService.chatCompletion(req.body.messages);
  new ApiResponse(200, { message }).send(res);
});

module.exports = { chat };
