const app = require("./app");
const { env } = require("./config/env");
const { pool } = require("./config/db");

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dexter API running on port ${env.port}`);
});

process.on("SIGINT", async () => {
  await pool.end();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
