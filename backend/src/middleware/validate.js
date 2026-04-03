const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    message: "Validation failed.",
    errors: errors.array().map((entry) => ({
      field: entry.path,
      message: entry.msg
    }))
  });
}

module.exports = {
  validate
};
