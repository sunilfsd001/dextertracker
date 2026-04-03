const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

function required(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function fromUri(uri, field) {
  if (!uri) {
    return null;
  }
  try {
    const parsed = new URL(uri);
    if (field === "host") {
      return parsed.hostname || null;
    }
    if (field === "port") {
      return parsed.port ? Number(parsed.port) : null;
    }
    if (field === "user") {
      return parsed.username || null;
    }
    if (field === "password") {
      return parsed.password || null;
    }
    if (field === "db") {
      return parsed.pathname ? parsed.pathname.replace(/^\//, "") : null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

const mysqlUri = process.env.MYSQL_ADDON_URI || "";
const dbHost = process.env.DB_HOST || process.env.MYSQL_ADDON_HOST || fromUri(mysqlUri, "host") || "localhost";
const dbPort = Number(
  process.env.DB_PORT || process.env.MYSQL_ADDON_PORT || fromUri(mysqlUri, "port") || 3306
);
const dbUser = process.env.DB_USER || process.env.MYSQL_ADDON_USER || fromUri(mysqlUri, "user") || "root";
const dbPassword =
  process.env.DB_PASSWORD ||
  process.env.MYSQL_ADDON_PASSWORD ||
  fromUri(mysqlUri, "password") ||
  "";
const dbName = process.env.DB_NAME || process.env.MYSQL_ADDON_DB || fromUri(mysqlUri, "db") || "coding_tracker";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  db: {
    host: required("DB_HOST", dbHost),
    port: dbPort,
    user: required("DB_USER", dbUser),
    password: dbPassword,
    name: required("DB_NAME", dbName),
    ssl: parseBoolean(process.env.DB_SSL, false)
  },
  jwt: {
    secret: required("JWT_SECRET", "dev_only_change_me"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  }
};

module.exports = { env };
