const mysql = require("mysql2/promise");
const { env } = require("./env");

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = {
  pool,
  query
};
