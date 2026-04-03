const { env } = require("../config/env");

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  // eslint-disable-next-line no-console
  console.error(error);

  const payload = {
    message: "Internal server error."
  };

  if (env.nodeEnv !== "production") {
    payload.code = error.code || null;
    payload.error = error.message || "Unknown error";
  }

  return res.status(500).json({
    ...payload
  });
}

module.exports = {
  errorHandler
};
