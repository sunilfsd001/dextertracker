const express = require("express");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const { query } = require("../config/db");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { signToken } = require("../utils/jwt");

const router = express.Router();

const signupValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be between 2 and 80 characters."),
  body("email").trim().isEmail().withMessage("Please provide a valid email."),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be at least 8 characters long.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number.")
];

const loginValidation = [
  body("email").trim().isEmail().withMessage("Please provide a valid email."),
  body("password").notEmpty().withMessage("Password is required.")
];

router.post("/signup", signupValidation, validate, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const existing = await query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'user')`,
      [name, normalizedEmail, passwordHash]
    );

    const user = {
      id: insertResult.insertId,
      name,
      email: normalizedEmail,
      role: "user"
    };
    const token = signToken(user);

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", loginValidation, validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const users = await query(
      `SELECT id, name, email, role, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const dbUser = users[0];
    const passwordMatches = await bcrypt.compare(password, dbUser.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role
    };
    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User account not found." });
    }

    return res.status(200).json({ user: users[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
