const { query } = require("../config/db");
const { toISODate, dateDiffInDays, subtractDays } = require("../utils/date");

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeDates(rows) {
  return rows
    .map((row) => toISODate(row.completion_date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
}

function buildStreakStatsFromDescendingDates(dates, today = toISODate(new Date())) {
  if (!Array.isArray(dates) || dates.length === 0) {
    return {
      totalCompleted: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDate: null
    };
  }

  let maxStreak = 1;
  let currentRun = 1;
  let currentStreak = 1;
  let latestSegmentBroken = false;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];
    if (dateDiffInDays(current, previous) === 1) {
      currentRun += 1;
      if (!latestSegmentBroken) {
        currentStreak += 1;
      }
    } else {
      currentRun = 1;
      latestSegmentBroken = true;
    }

    if (currentRun > maxStreak) {
      maxStreak = currentRun;
    }
  }

  if (dateDiffInDays(dates[0], today) > 1) {
    currentStreak = 0;
  }

  return {
    totalCompleted: dates.length,
    currentStreak,
    maxStreak,
    lastCompletedDate: dates[0] || null
  };
}

async function getUserCompletionDates(userId) {
  const rows = await query(
    `SELECT DISTINCT completion_date
     FROM user_completions
     WHERE user_id = ?
       AND completion_date <= UTC_DATE()
     ORDER BY completion_date DESC`,
    [userId]
  );

  return normalizeDates(rows);
}

async function getUserProgressStats(userId) {
  const [completionRows, totalDailyRows] = await Promise.all([
    query(
      `SELECT DISTINCT completion_date
       FROM user_completions
       WHERE user_id = ?
         AND completion_date <= UTC_DATE()
       ORDER BY completion_date DESC`,
      [userId]
    ),
    query(
      `SELECT COUNT(*) AS total_daily
       FROM daily_problems
       WHERE problem_date <= UTC_DATE()`
    )
  ]);

  const dates = completionRows.map((row) => toISODate(row.completion_date)).filter(Boolean);
  const streakStats = buildStreakStatsFromDescendingDates(dates);
  const totalDaily = Number(totalDailyRows[0]?.total_daily || 0);
  const completionRate =
    totalDaily === 0 ? 0 : Number(((streakStats.totalCompleted / totalDaily) * 100).toFixed(2));

  return {
    totalCompleted: streakStats.totalCompleted,
    currentStreak: streakStats.currentStreak,
    maxStreak: streakStats.maxStreak,
    completionRate,
    lastCompletedDate: streakStats.lastCompletedDate
  };
}

async function getUsersProgressStats(userIds = [], options = {}) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return new Map();
  }

  const placeholders = ids.map(() => "?").join(", ");
  const includeCompletionRate = options.includeCompletionRate !== false;

  const queries = [
    query(
      `SELECT user_id, completion_date
       FROM user_completions
       WHERE user_id IN (${placeholders})
         AND completion_date <= UTC_DATE()
       ORDER BY user_id, completion_date DESC`,
      ids
    )
  ];
  if (includeCompletionRate) {
    queries.push(
      query(
        `SELECT COUNT(*) AS total_daily
         FROM daily_problems
         WHERE problem_date <= UTC_DATE()`
      )
    );
  }

  const [completionRows, totalDailyRows] = await Promise.all(queries);

  const byUser = completionRows.reduce((acc, row) => {
    const userId = Number(row.user_id);
    if (!acc.has(userId)) {
      acc.set(userId, []);
    }
    acc.get(userId).push(toISODate(row.completion_date));
    return acc;
  }, new Map());

  const totalDaily = includeCompletionRate ? Number(totalDailyRows[0]?.total_daily || 0) : 0;
  const statsByUser = new Map();

  ids.forEach((userId) => {
    const dates = (byUser.get(userId) || []).filter(Boolean);
    const streakStats = buildStreakStatsFromDescendingDates(dates);
    const completionRate = includeCompletionRate
      ? totalDaily === 0
        ? 0
        : Number(((streakStats.totalCompleted / totalDaily) * 100).toFixed(2))
      : 0;

    statsByUser.set(userId, {
      totalCompleted: streakStats.totalCompleted,
      currentStreak: streakStats.currentStreak,
      maxStreak: streakStats.maxStreak,
      completionRate,
      lastCompletedDate: streakStats.lastCompletedDate
    });
  });

  return statsByUser;
}

async function getLeaderboard(limit = 10) {
  const safeLimit = clampInteger(limit, 10, 1, 100);
  const users = await query(
    `SELECT id, name
     FROM users
     WHERE role = 'user'
     ORDER BY id ASC`
  );
  const statsByUser = await getUsersProgressStats(
    users.map((user) => user.id),
    { includeCompletionRate: false }
  );

  const leaderboard = users.map((user) => {
    const stats = statsByUser.get(user.id) || {
      totalCompleted: 0,
      currentStreak: 0,
      lastCompletedDate: null
    };
    return {
      userId: user.id,
      name: user.name,
      totalCompleted: Number(stats.totalCompleted || 0),
      currentStreak: Number(stats.currentStreak || 0),
      lastCompletedDate: stats.lastCompletedDate || null
    };
  });

  return leaderboard
    .sort((a, b) => {
      if (b.totalCompleted !== a.totalCompleted) {
        return b.totalCompleted - a.totalCompleted;
      }
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      return (b.lastCompletedDate || "").localeCompare(a.lastCompletedDate || "");
    })
    .slice(0, safeLimit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));
}

async function getDailyCompletionRates(days = 14) {
  const safeDays = clampInteger(days, 14, 1, 365);
  const lookbackDays = Math.max(0, safeDays - 1);

  const [usersCountRows, dailyRows] = await Promise.all([
    query(`SELECT COUNT(*) AS total_users FROM users WHERE role = 'user'`),
    query(
      `SELECT dp.problem_date AS problem_date, COUNT(DISTINCT uc.user_id) AS completions
       FROM daily_problems dp
       LEFT JOIN user_completions uc ON uc.daily_problem_id = dp.id
       WHERE dp.problem_date BETWEEN DATE_SUB(UTC_DATE(), INTERVAL ${lookbackDays} DAY) AND UTC_DATE()
       GROUP BY dp.problem_date
       ORDER BY dp.problem_date ASC`
    )
  ]);

  const totalUsers = Number(usersCountRows[0]?.total_users || 0);
  return dailyRows.map((row) => ({
    date: toISODate(row.problem_date),
    completions: Number(row.completions),
    completionRate: totalUsers === 0 ? 0 : Number(((Number(row.completions) / totalUsers) * 100).toFixed(2))
  }));
}

async function getUserActivityTrends(days = 30) {
  const safeDays = clampInteger(days, 30, 1, 365);
  const lookbackDays = Math.max(0, safeDays - 1);

  const [signupRows, completionRows] = await Promise.all([
    query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS signups
       FROM users
       WHERE role = 'user' AND created_at >= DATE_SUB(UTC_DATE(), INTERVAL ${lookbackDays} DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    ),
    query(
      `SELECT completion_date AS date, COUNT(*) AS completions
       FROM user_completions
       WHERE completion_date >= DATE_SUB(UTC_DATE(), INTERVAL ${lookbackDays} DAY)
       GROUP BY completion_date
       ORDER BY completion_date ASC`
    )
  ]);

  const signupsByDate = new Map(signupRows.map((row) => [toISODate(row.date), Number(row.signups)]));
  const completionsByDate = new Map(
    completionRows.map((row) => [toISODate(row.date), Number(row.completions)])
  );

  const today = toISODate(new Date());
  const trend = [];
  for (let dayOffset = safeDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = subtractDays(today, dayOffset);
    trend.push({
      date,
      signups: signupsByDate.get(date) || 0,
      completions: completionsByDate.get(date) || 0
    });
  }

  return trend;
}

module.exports = {
  getUserProgressStats,
  getUsersProgressStats,
  getUserCompletionDates,
  getLeaderboard,
  getDailyCompletionRates,
  getUserActivityTrends
};
