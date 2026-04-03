const express = require("express");
const { body, param, query: queryValidator } = require("express-validator");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  getUserProgressStats,
  getLeaderboard,
  getDailyCompletionRates,
  getUserActivityTrends
} = require("../services/statsService");
const { toISODate } = require("../utils/date");

const router = express.Router();

router.use(authenticate, authorize("admin"));

const problemValidation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 180 })
    .withMessage("Title must be between 3 and 180 characters."),
  body("description")
    .trim()
    .isLength({ min: 10, max: 6000 })
    .withMessage("Description must be between 10 and 6000 characters."),
  body("difficulty")
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty must be easy, medium, or hard."),
  body("topic")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Topic must be between 2 and 100 characters."),
  body("referenceUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Reference URL must be a valid URL.")
];

router.get("/overview", async (req, res, next) => {
  try {
    const [userCountRows, todayCompletionRows, topPerformers] = await Promise.all([
      query(`SELECT COUNT(*) AS total_users FROM users WHERE role = 'user'`),
      query(
        `SELECT COUNT(*) AS today_completions
         FROM user_completions
         WHERE completion_date = UTC_DATE()`
      ),
      getLeaderboard(5)
    ]);

    const totalUsers = Number(userCountRows[0]?.total_users || 0);
    const todayCompletions = Number(todayCompletionRows[0]?.today_completions || 0);
    const todayCompletionRate = totalUsers === 0 ? 0 : Number(((todayCompletions / totalUsers) * 100).toFixed(2));

    return res.status(200).json({
      totals: {
        totalUsers,
        todayCompletions,
        todayCompletionRate
      },
      topPerformers
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/problems",
  [
    queryValidator("search")
      .optional()
      .isLength({ max: 120 })
      .withMessage("Search term is too long.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const search = (req.query.search || "").trim();
      let rows;

      if (search) {
        rows = await query(
          `SELECT p.id, p.title, p.description, p.difficulty, p.topic, p.reference_url, p.created_at, u.name AS created_by
           FROM problems p
           INNER JOIN users u ON u.id = p.created_by
           WHERE p.title LIKE ? OR p.topic LIKE ?
           ORDER BY p.created_at DESC`,
          [`%${search}%`, `%${search}%`]
        );
      } else {
        rows = await query(
          `SELECT p.id, p.title, p.description, p.difficulty, p.topic, p.reference_url, p.created_at, u.name AS created_by
           FROM problems p
           INNER JOIN users u ON u.id = p.created_by
           ORDER BY p.created_at DESC`
        );
      }

      return res.status(200).json({ problems: rows });
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/problems", problemValidation, validate, async (req, res, next) => {
  try {
    const { title, description, difficulty, topic, referenceUrl } = req.body;
    const result = await query(
      `INSERT INTO problems (title, description, difficulty, topic, reference_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, difficulty, topic, referenceUrl || null, req.user.id]
    );

    const insertedRows = await query(
      `SELECT id, title, description, difficulty, topic, reference_url, created_at
       FROM problems
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Problem added to bank successfully.",
      problem: insertedRows[0]
    });
  } catch (error) {
    return next(error);
  }
});

router.put(
  "/problems/:problemId",
  [param("problemId").isInt({ min: 1 }).withMessage("Invalid problem id."), ...problemValidation],
  validate,
  async (req, res, next) => {
    try {
      const problemId = Number(req.params.problemId);
      const { title, description, difficulty, topic, referenceUrl } = req.body;
      const result = await query(
        `UPDATE problems
         SET title = ?, description = ?, difficulty = ?, topic = ?, reference_url = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [title, description, difficulty, topic, referenceUrl || null, problemId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Problem not found." });
      }

      const updated = await query(
        `SELECT id, title, description, difficulty, topic, reference_url, updated_at
         FROM problems
         WHERE id = ?
         LIMIT 1`,
        [problemId]
      );

      return res.status(200).json({
        message: "Problem updated successfully.",
        problem: updated[0]
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/problems/:problemId",
  [param("problemId").isInt({ min: 1 }).withMessage("Invalid problem id.")],
  validate,
  async (req, res, next) => {
    try {
      const problemId = Number(req.params.problemId);
      const assignedRows = await query(
        `SELECT id
         FROM daily_problems
         WHERE problem_id = ?
         LIMIT 1`,
        [problemId]
      );

      if (assignedRows.length > 0) {
        return res.status(409).json({
          message: "This problem is scheduled as a daily problem and cannot be deleted."
        });
      }

      const result = await query(`DELETE FROM problems WHERE id = ?`, [problemId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Problem not found." });
      }

      return res.status(200).json({ message: "Problem deleted successfully." });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/daily-problems",
  [
    queryValidator("from")
      .optional()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("From date must be in YYYY-MM-DD format."),
    queryValidator("to")
      .optional()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("To date must be in YYYY-MM-DD format.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const from = req.query.from || "1970-01-01";
      const to = req.query.to || "2999-12-31";

      const rows = await query(
        `SELECT dp.id,
                dp.problem_date,
                dp.created_at,
                p.id AS problem_id,
                p.title,
                p.difficulty,
                p.topic
         FROM daily_problems dp
         INNER JOIN problems p ON p.id = dp.problem_id
         WHERE dp.problem_date BETWEEN ? AND ?
         ORDER BY dp.problem_date DESC`,
        [from, to]
      );

      return res.status(200).json({
        dailyProblems: rows.map((row) => ({
          ...row,
          problem_date: toISODate(row.problem_date)
        }))
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/daily-problems",
  [
    body("problemDate")
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("Problem date must be in YYYY-MM-DD format."),
    body("problemId").isInt({ min: 1 }).withMessage("Problem id must be a valid integer.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const { problemDate, problemId } = req.body;
      const problemRows = await query(`SELECT id FROM problems WHERE id = ? LIMIT 1`, [problemId]);
      if (problemRows.length === 0) {
        return res.status(404).json({ message: "Problem not found in the bank." });
      }

      try {
        const result = await query(
          `INSERT INTO daily_problems (problem_date, problem_id, created_by)
           VALUES (?, ?, ?)`,
          [problemDate, problemId, req.user.id]
        );

        const inserted = await query(
          `SELECT dp.id, dp.problem_date, p.id AS problem_id, p.title, p.difficulty, p.topic
           FROM daily_problems dp
           INNER JOIN problems p ON p.id = dp.problem_id
           WHERE dp.id = ?
           LIMIT 1`,
          [result.insertId]
        );

        return res.status(201).json({
          message: "Daily coding problem created successfully.",
          dailyProblem: {
            ...inserted[0],
            problem_date: toISODate(inserted[0].problem_date)
          }
        });
      } catch (dbError) {
        if (dbError.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "A daily problem already exists for this date." });
        }
        throw dbError;
      }
    } catch (error) {
      return next(error);
    }
  }
);

router.put(
  "/daily-problems/:dailyProblemId",
  [
    param("dailyProblemId").isInt({ min: 1 }).withMessage("Invalid daily problem id."),
    body("problemDate")
      .optional()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("Problem date must be in YYYY-MM-DD format."),
    body("problemId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Problem id must be a valid integer.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const dailyProblemId = Number(req.params.dailyProblemId);
      const existingRows = await query(`SELECT * FROM daily_problems WHERE id = ? LIMIT 1`, [dailyProblemId]);
      if (existingRows.length === 0) {
        return res.status(404).json({ message: "Daily problem not found." });
      }

      const nextProblemDate = req.body.problemDate || toISODate(existingRows[0].problem_date);
      const nextProblemId = req.body.problemId || existingRows[0].problem_id;

      if (req.body.problemId) {
        const problemRows = await query(`SELECT id FROM problems WHERE id = ? LIMIT 1`, [nextProblemId]);
        if (problemRows.length === 0) {
          return res.status(404).json({ message: "Problem not found in the bank." });
        }
      }

      try {
        await query(
          `UPDATE daily_problems
           SET problem_date = ?, problem_id = ?, updated_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [nextProblemDate, nextProblemId, dailyProblemId]
        );
      } catch (dbError) {
        if (dbError.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "A daily problem already exists for this date." });
        }
        throw dbError;
      }

      const updated = await query(
        `SELECT dp.id, dp.problem_date, p.id AS problem_id, p.title, p.difficulty, p.topic
         FROM daily_problems dp
         INNER JOIN problems p ON p.id = dp.problem_id
         WHERE dp.id = ?
         LIMIT 1`,
        [dailyProblemId]
      );

      return res.status(200).json({
        message: "Daily problem updated successfully.",
        dailyProblem: {
          ...updated[0],
          problem_date: toISODate(updated[0].problem_date)
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/daily-problems/:dailyProblemId",
  [param("dailyProblemId").isInt({ min: 1 }).withMessage("Invalid daily problem id.")],
  validate,
  async (req, res, next) => {
    try {
      const dailyProblemId = Number(req.params.dailyProblemId);
      const completionRows = await query(
        `SELECT id
         FROM user_completions
         WHERE daily_problem_id = ?
         LIMIT 1`,
        [dailyProblemId]
      );

      if (completionRows.length > 0) {
        return res.status(409).json({
          message: "This daily problem already has completion records and cannot be deleted."
        });
      }

      const result = await query(`DELETE FROM daily_problems WHERE id = ?`, [dailyProblemId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Daily problem not found." });
      }

      return res.status(200).json({ message: "Daily problem deleted successfully." });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/users", async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, name, email, created_at
       FROM users
       WHERE role = 'user'
       ORDER BY created_at DESC`
    );

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const stats = await getUserProgressStats(user.id);
        return {
          ...user,
          stats
        };
      })
    );

    return res.status(200).json({ users: enrichedUsers });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/users/:userId",
  [param("userId").isInt({ min: 1 }).withMessage("Invalid user id.")],
  validate,
  async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      const userRows = await query(
        `SELECT id, name, email, role, created_at
         FROM users
         WHERE id = ? AND role = 'user'
         LIMIT 1`,
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ message: "User not found." });
      }

      const [notes, completions, stats] = await Promise.all([
        query(
          `SELECT id, title, content, created_at, updated_at
           FROM notes
           WHERE user_id = ?
           ORDER BY updated_at DESC`,
          [userId]
        ),
        query(
          `SELECT uc.completion_date, p.title, p.difficulty, p.topic
           FROM user_completions uc
           INNER JOIN daily_problems dp ON dp.id = uc.daily_problem_id
           INNER JOIN problems p ON p.id = dp.problem_id
           WHERE uc.user_id = ?
           ORDER BY uc.completion_date DESC`,
          [userId]
        ),
        getUserProgressStats(userId)
      ]);

      return res.status(200).json({
        user: userRows[0],
        stats,
        notes,
        completionHistory: completions.map((completion) => ({
          ...completion,
          completion_date: toISODate(completion.completion_date)
        }))
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/analytics", async (req, res, next) => {
  try {
    const [overviewRows, dailyCompletionRates, userActivityTrend, topPerformers] = await Promise.all([
      query(
        `SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'user') AS total_users,
            (SELECT COUNT(*) FROM user_completions WHERE completion_date = UTC_DATE()) AS today_completions,
            (SELECT COUNT(*) FROM notes) AS total_notes,
            (SELECT COUNT(*) FROM user_completions) AS total_completions`
      ),
      getDailyCompletionRates(14),
      getUserActivityTrends(30),
      getLeaderboard(10)
    ]);

    const totalUsers = Number(overviewRows[0]?.total_users || 0);
    const todayCompletions = Number(overviewRows[0]?.today_completions || 0);
    const todayCompletionRate = totalUsers === 0 ? 0 : Number(((todayCompletions / totalUsers) * 100).toFixed(2));

    return res.status(200).json({
      overview: {
        totalUsers,
        todayCompletions,
        todayCompletionRate,
        totalNotes: Number(overviewRows[0]?.total_notes || 0),
        totalCompletions: Number(overviewRows[0]?.total_completions || 0)
      },
      dailyCompletionRates,
      userActivityTrend,
      topPerformers
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
