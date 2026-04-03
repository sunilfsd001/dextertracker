const express = require("express");
const { query: queryValidator } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { getLeaderboard } = require("../services/statsService");

const router = express.Router();

router.get(
  "/",
  authenticate,
  [
    queryValidator("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 10);
      const leaderboard = await getLeaderboard(limit);
      return res.status(200).json({ leaderboard });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
