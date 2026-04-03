const express = require("express");
const { body, param, query: queryValidator } = require("express-validator");
const { query } = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { getUserProgressStats, getUserCompletionDates } = require("../services/statsService");
const { toISODate } = require("../utils/date");

const router = express.Router();

router.use(authenticate, authorize("user"));

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

router.get("/profile", async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const stats = await getUserProgressStats(req.user.id);
    return res.status(200).json({
      user: users[0],
      stats
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/notes",
  [
    queryValidator("limit")
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage("Limit must be between 1 and 200."),
    queryValidator("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be a non-negative integer.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const limit = clampInteger(req.query.limit, 100, 1, 200);
      const offset = clampInteger(req.query.offset, 0, 0, 100000);
      const notes = await query(
        `SELECT id, title, content, created_at, updated_at
         FROM notes
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ${offset}, ${limit}`,
        [req.user.id]
      );

      return res.status(200).json({ notes });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/notes",
  [
    body("title")
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage("Title must be between 1 and 120 characters."),
    body("content")
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage("Content must be between 1 and 5000 characters.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, content } = req.body;
      const result = await query(
        `INSERT INTO notes (user_id, title, content)
         VALUES (?, ?, ?)`,
        [req.user.id, title, content]
      );

      const inserted = await query(
        `SELECT id, title, content, created_at, updated_at
         FROM notes
         WHERE id = ?
         LIMIT 1`,
        [result.insertId]
      );

      return res.status(201).json({
        message: "Note created successfully.",
        note: inserted[0]
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.put(
  "/notes/:noteId",
  [
    param("noteId").isInt({ min: 1 }).withMessage("Invalid note id."),
    body("title")
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage("Title must be between 1 and 120 characters."),
    body("content")
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage("Content must be between 1 and 5000 characters.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const noteId = Number(req.params.noteId);
      const { title, content } = req.body;

      const result = await query(
        `UPDATE notes
         SET title = ?, content = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND user_id = ?`,
        [title, content, noteId, req.user.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Note not found." });
      }

      const updated = await query(
        `SELECT id, title, content, created_at, updated_at
         FROM notes
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [noteId, req.user.id]
      );

      return res.status(200).json({
        message: "Note updated successfully.",
        note: updated[0]
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/notes/:noteId",
  [param("noteId").isInt({ min: 1 }).withMessage("Invalid note id.")],
  validate,
  async (req, res, next) => {
    try {
      const noteId = Number(req.params.noteId);
      const result = await query(`DELETE FROM notes WHERE id = ? AND user_id = ?`, [
        noteId,
        req.user.id
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Note not found." });
      }

      return res.status(200).json({ message: "Note deleted successfully." });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/today-problem", async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT dp.id AS daily_problem_id,
              dp.problem_date,
              p.id AS problem_id,
              p.title,
              p.description,
              p.difficulty,
              p.topic,
              p.reference_url
       FROM daily_problems dp
       INNER JOIN problems p ON p.id = dp.problem_id
       WHERE dp.problem_date = UTC_DATE()
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No coding problem has been set for today yet." });
    }

    const completionRows = await query(
      `SELECT EXISTS(
          SELECT 1
          FROM user_completions
          WHERE user_id = ? AND completion_date = UTC_DATE()
       ) AS completed_today`,
      [req.user.id]
    );

    return res.status(200).json({
      problem: {
        ...rows[0],
        problem_date: toISODate(rows[0].problem_date)
      },
      completedToday: Number(completionRows[0]?.completed_today || 0) === 1
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/today-problem/complete", async (req, res, next) => {
  try {
    const dailyProblemRows = await query(
      `SELECT id
       FROM daily_problems
       WHERE problem_date = UTC_DATE()
       LIMIT 1`
    );

    if (dailyProblemRows.length === 0) {
      return res.status(404).json({ message: "No coding problem has been set for today yet." });
    }

    const dailyProblem = dailyProblemRows[0];
    try {
      await query(
        `INSERT INTO user_completions (user_id, daily_problem_id, completion_date)
         VALUES (?, ?, UTC_DATE())`,
        [req.user.id, dailyProblem.id]
      );
    } catch (dbError) {
      if (dbError && dbError.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "You already marked today's problem as finished." });
      }
      throw dbError;
    }

    const stats = await getUserProgressStats(req.user.id);
    return res.status(201).json({
      message: "Great work. Today's problem is marked as finished.",
      stats
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/history",
  [
    queryValidator("limit")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Limit must be between 1 and 365.")
  ],
  validate,
  async (req, res, next) => {
    try {
      const limit = clampInteger(req.query.limit, 60, 1, 365);
      const rows = await query(
        `SELECT uc.completion_date,
                p.title,
                p.difficulty,
                p.topic
         FROM user_completions uc
         INNER JOIN daily_problems dp ON dp.id = uc.daily_problem_id
         INNER JOIN problems p ON p.id = dp.problem_id
         WHERE uc.user_id = ?
           AND uc.completion_date <= UTC_DATE()
         ORDER BY uc.completion_date DESC
         LIMIT ${limit}`,
        [req.user.id]
      );

      const history = rows.map((row) => ({
        completionDate: toISODate(row.completion_date),
        title: row.title,
        difficulty: row.difficulty,
        topic: row.topic
      }));

      return res.status(200).json({ history });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/stats", async (req, res, next) => {
  try {
    const [stats, completionDates] = await Promise.all([
      getUserProgressStats(req.user.id),
      getUserCompletionDates(req.user.id)
    ]);

    return res.status(200).json({
      stats,
      completionDates
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
