const { query } = require("../config/db");
const { toISODate, dateDiffInDays, subtractDays } = require("../utils/date");

function normalizeDates(rows) {
  return rows
    .map((row) => toISODate(row.completion_date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
}

function calculateCurrentStreak(dates, today = toISODate(new Date())) {
  if (dates.length === 0) {
    return 0;
  }

  const latest = dates[0];
  if (dateDiffInDays(latest, today) > 1) {
    return 0;
  }

  let streak = 1;
  let expectedNext = subtractDays(latest, 1);

  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index] === expectedNext) {
      streak += 1;
      expectedNext = subtractDays(dates[index], 1);
    } else if (dates[index] < expectedNext) {
      break;
    }
  }

  return streak;
}

function calculateMaxStreak(dates) {
  if (dates.length === 0) {
    return 0;
  }

  const ascending = [...dates].sort((a, b) => a.localeCompare(b));
  let maxStreak = 1;
  let current = 1;

  for (let index = 1; index < ascending.length; index += 1) {
    const previous = ascending[index - 1];
    const currentDate = ascending[index];
    if (dateDiffInDays(previous, currentDate) === 1) {
      current += 1;
      maxStreak = Math.max(maxStreak, current);
    } else if (previous !== currentDate) {
      current = 1;
    }
  }

  return maxStreak;
}

async function getUserCompletionDates(userId) {
  const rows = await query(
    `SELECT completion_date
     FROM user_completions
     WHERE user_id = ?
     ORDER BY completion_date DESC`,
    [userId]
  );

  return normalizeDates(rows);
}

async function getUserProgressStats(userId) {
  const [dates, totalDailyRows] = await Promise.all([
    getUserCompletionDates(userId),
    query(
      `SELECT COUNT(*) AS total_daily
       FROM daily_problems
       WHERE problem_date <= UTC_DATE()`
    )
  ]);

  const today = toISODate(new Date());
  const totalCompleted = dates.length;
  const currentStreak = calculateCurrentStreak(dates, today);
  const maxStreak = calculateMaxStreak(dates);
  const totalDaily = Number(totalDailyRows[0]?.total_daily || 0);
  const completionRate = totalDaily === 0 ? 0 : Number(((totalCompleted / totalDaily) * 100).toFixed(2));

  return {
    totalCompleted,
    currentStreak,
    maxStreak,
    completionRate,
    lastCompletedDate: dates[0] || null
  };
}

async function getUsersProgressStats(userIds = []) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return new Map();
  }

  const placeholders = ids.map(() => "?").join(", ");
  const [completionRows, totalDailyRows] = await Promise.all([
    query(
      `SELECT user_id, completion_date
       FROM user_completions
       WHERE user_id IN (${placeholders})
       ORDER BY user_id, completion_date DESC`,
      ids
    ),
    query(
      `SELECT COUNT(*) AS total_daily
       FROM daily_problems
       WHERE problem_date <= UTC_DATE()`
    )
  ]);

  const byUser = completionRows.reduce((acc, row) => {
    const userId = Number(row.user_id);
    if (!acc.has(userId)) {
      acc.set(userId, []);
    }
    acc.get(userId).push(toISODate(row.completion_date));
    return acc;
  }, new Map());

  const totalDaily = Number(totalDailyRows[0]?.total_daily || 0);
  const today = toISODate(new Date());
  const statsByUser = new Map();

  ids.forEach((userId) => {
    const dates = (byUser.get(userId) || []).filter(Boolean).sort((a, b) => b.localeCompare(a));
    const totalCompleted = dates.length;
    const currentStreak = calculateCurrentStreak(dates, today);
    const maxStreak = calculateMaxStreak(dates);
    const completionRate = totalDaily === 0 ? 0 : Number(((totalCompleted / totalDaily) * 100).toFixed(2));

    statsByUser.set(userId, {
      totalCompleted,
      currentStreak,
      maxStreak,
      completionRate,
      lastCompletedDate: dates[0] || null
    });
  });

  return statsByUser;
}

async function getLeaderboard(limit = 10) {
  const [users, completionRows] = await Promise.all([
    query(
      `SELECT id, name
       FROM users
       WHERE role = 'user'`
    ),
    query(
      `SELECT user_id, completion_date
       FROM user_completions
       ORDER BY user_id, completion_date DESC`
    )
  ]);

  const datesByUser = completionRows.reduce((acc, row) => {
    const userId = row.user_id;
    if (!acc.has(userId)) {
      acc.set(userId, []);
    }
    acc.get(userId).push(toISODate(row.completion_date));
    return acc;
  }, new Map());

  const today = toISODate(new Date());
  const leaderboard = users.map((user) => {
    const dates = (datesByUser.get(user.id) || []).sort((a, b) => b.localeCompare(a));
    return {
      userId: user.id,
      name: user.name,
      totalCompleted: dates.length,
      currentStreak: calculateCurrentStreak(dates, today),
      lastCompletedDate: dates[0] || null
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
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));
}

async function getDailyCompletionRates(days = 14) {
  const [usersCountRows, dailyRows] = await Promise.all([
    query(`SELECT COUNT(*) AS total_users FROM users WHERE role = 'user'`),
    query(
      `SELECT dp.problem_date AS problem_date, COUNT(DISTINCT uc.user_id) AS completions
       FROM daily_problems dp
       LEFT JOIN user_completions uc ON uc.daily_problem_id = dp.id
       WHERE dp.problem_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)
       GROUP BY dp.problem_date
       ORDER BY dp.problem_date ASC`,
      [days - 1]
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
  const [signupRows, completionRows] = await Promise.all([
    query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS signups
       FROM users
       WHERE role = 'user' AND created_at >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [days - 1]
    ),
    query(
      `SELECT completion_date AS date, COUNT(*) AS completions
       FROM user_completions
       WHERE completion_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY)
       GROUP BY completion_date
       ORDER BY completion_date ASC`,
      [days - 1]
    )
  ]);

  const signupsByDate = new Map(signupRows.map((row) => [toISODate(row.date), Number(row.signups)]));
  const completionsByDate = new Map(
    completionRows.map((row) => [toISODate(row.date), Number(row.completions)])
  );

  const today = toISODate(new Date());
  const trend = [];
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
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
