const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { env } = require("./config/env");
const { query } = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

function buildCorsOrigins() {
  if (!env.corsOrigin || env.corsOrigin === "*") {
    return "*";
  }
  return env.corsOrigin
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const allowedOrigins = buildCorsOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins === "*") {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/db", async (req, res) => {
  try {
    const ping = await query("SELECT 1 AS ok");
    const usersCount = await query("SELECT COUNT(*) AS total_users FROM users");
    return res.status(200).json({
      status: "ok",
      db: {
        connected: Number(ping[0]?.ok || 0) === 1,
        database: env.db.name,
        totalUsers: Number(usersCount[0]?.total_users || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use(errorHandler);

module.exports = app;
