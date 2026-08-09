const ApiError = require("../utils/ApiError");

/**
 * validate({ body, params, query }) — each key is an optional Zod schema.
 * Parsed (and coerced/defaulted) values are written back onto req, so
 * downstream handlers always see clean, typed data.
 */
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    next();
  } catch (err) {
    const details = err.errors?.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    next(ApiError.badRequest("Validation failed", details || err.message));
  }
};

module.exports = validate;
