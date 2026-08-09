// Every controller is async. Without this, a thrown/rejected error inside
// an async function is swallowed by Express instead of reaching next(err).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
