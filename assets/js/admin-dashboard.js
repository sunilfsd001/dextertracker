import {
  apiRequest,
  clearSession,
  requireAuth,
  formatDate,
  formatDateTime,
  formatPercent
} from "./api.js";

const user = requireAuth(["admin"]);
if (!user) {
  throw new Error("Unauthorized");
}

const adminWelcome = document.getElementById("adminWelcome");
const adminDatePill = document.getElementById("adminDatePill");
const adminLogoutButton = document.getElementById("adminLogoutButton");

const metricTotalUsers = document.getElementById("metricTotalUsers");
const metricTodayCompletions = document.getElementById("metricTodayCompletions");
const metricTodayRate = document.getElementById("metricTodayRate");
const metricTotalCompletions = document.getElementById("metricTotalCompletions");

const completionRateChart = document.getElementById("completionRateChart");
const activityChart = document.getElementById("activityChart");
const topPerformersList = document.getElementById("topPerformersList");

const problemForm = document.getElementById("problemForm");
const problemIdInput = document.getElementById("problemId");
const problemTitleInput = document.getElementById("problemTitleInput");
const problemDescriptionInput = document.getElementById("problemDescriptionInput");
const problemTopicInput = document.getElementById("problemTopicInput");
const problemDifficultyInput = document.getElementById("problemDifficultyInput");
const problemReferenceInput = document.getElementById("problemReferenceInput");
const problemCancelButton = document.getElementById("problemCancelButton");
const problemMessage = document.getElementById("problemMessage");
const problemBankList = document.getElementById("problemBankList");

const dailyProblemForm = document.getElementById("dailyProblemForm");
const dailyProblemDate = document.getElementById("dailyProblemDate");
const dailyProblemSelect = document.getElementById("dailyProblemSelect");
const dailyResetButton = document.getElementById("dailyResetButton");
const dailyProblemMessage = document.getElementById("dailyProblemMessage");
const dailyProblemsList = document.getElementById("dailyProblemsList");

const usersList = document.getElementById("usersList");
const selectedUserDetails = document.getElementById("selectedUserDetails");

let problemState = [];
let dailyProblemState = [];
let userState = [];
let selectedUserId = "";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `status-message ${type}`.trim();
}

function handleAuthError(error) {
  if (error.status === 401) {
    clearSession();
    window.location.href = "index.html";
    return true;
  }
  return false;
}

function toISODate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoMinusDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return toISODate(date);
}

function resetProblemForm() {
  problemIdInput.value = "";
  problemTitleInput.value = "";
  problemDescriptionInput.value = "";
  problemTopicInput.value = "";
  problemDifficultyInput.value = "easy";
  problemReferenceInput.value = "";
}

function resetDailyForm() {
  dailyProblemDate.value = toISODate(new Date());
  if (problemState[0]) {
    dailyProblemSelect.value = String(problemState[0].id);
  } else {
    dailyProblemSelect.value = "";
  }
}

function renderProblemSelect() {
  if (problemState.length === 0) {
    dailyProblemSelect.innerHTML = `<option value="">No problems available</option>`;
    return;
  }

  dailyProblemSelect.innerHTML = problemState
    .map((problem) => {
      const difficulty = String(problem.difficulty || "").toUpperCase();
      return `<option value="${problem.id}">${escapeHtml(problem.title)} | ${escapeHtml(difficulty)} | ${escapeHtml(problem.topic)}</option>`;
    })
    .join("");
}

function renderProblemBank() {
  if (problemState.length === 0) {
    problemBankList.innerHTML = `<div class="empty-state">No problems in bank yet.</div>`;
    return;
  }

  problemBankList.innerHTML = problemState
    .map(
      (problem) => `
      <div class="history-item">
        <strong>${escapeHtml(problem.title)}</strong>
        <p>${escapeHtml(problem.difficulty.toUpperCase())} | ${escapeHtml(problem.topic)}</p>
        <p>${escapeHtml(problem.description)}</p>
        <p class="muted">Created by ${escapeHtml(problem.created_by)} | ${formatDateTime(problem.created_at)}</p>
        <div class="note-item-actions">
          <button class="small-btn" data-action="edit-problem" data-id="${problem.id}" type="button">Edit</button>
          <button class="small-btn danger" data-action="delete-problem" data-id="${problem.id}" type="button">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

function renderDailyProblems() {
  if (dailyProblemState.length === 0) {
    dailyProblemsList.innerHTML = `<div class="empty-state">No daily problems scheduled.</div>`;
    return;
  }

  dailyProblemsList.innerHTML = dailyProblemState
    .map(
      (entry) => `
      <div class="history-item">
        <strong>${formatDate(entry.problem_date)} | ${escapeHtml(entry.title)}</strong>
        <p>${escapeHtml(entry.difficulty.toUpperCase())} | ${escapeHtml(entry.topic)}</p>
        <div class="note-item-actions">
          <button class="small-btn" data-action="edit-daily" data-id="${entry.id}" type="button">Edit</button>
          <button class="small-btn danger" data-action="delete-daily" data-id="${entry.id}" type="button">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

function renderUsers() {
  if (userState.length === 0) {
    usersList.innerHTML = `<div class="empty-state">No user accounts yet.</div>`;
    return;
  }

  usersList.innerHTML = userState
    .map(
      (entry) => `
      <button class="list-item" data-user-id="${entry.id}" type="button">
        <strong>${escapeHtml(entry.name)}</strong>
        <p>${escapeHtml(entry.email)}</p>
        <p>Streak: ${entry.stats.currentStreak} | Total: ${entry.stats.totalCompleted}</p>
      </button>
    `
    )
    .join("");

  usersList.querySelectorAll("button[data-user-id]").forEach((button) => {
    button.classList.toggle("is-active", String(button.dataset.userId || "") === selectedUserId);
  });
}

function renderTopPerformers(topPerformers = []) {
  if (topPerformers.length === 0) {
    topPerformersList.innerHTML = `<div class="empty-state">No performer data yet.</div>`;
    return;
  }

  topPerformersList.innerHTML = topPerformers
    .map(
      (entry) => `
      <div class="list-item">
        <strong>#${entry.rank} ${escapeHtml(entry.name)}</strong>
        <p>${entry.totalCompleted} completed | ${entry.currentStreak} streak</p>
      </div>
    `
    )
    .join("");
}

function renderCompletionRateChart(data = []) {
  if (data.length === 0) {
    completionRateChart.innerHTML = `<div class="empty-state">No completion data.</div>`;
    return;
  }

  const maxRate = Math.max(...data.map((item) => Number(item.completionRate || 0)), 1);
  completionRateChart.style.gridTemplateColumns = `repeat(${data.length}, minmax(12px, 1fr))`;
  completionRateChart.innerHTML = data
    .map((item) => {
      const rate = Number(item.completionRate || 0);
      const height = Math.max(8, (rate / maxRate) * 165);
      return `<div class="bar" style="height:${height}px" title="${item.date}" data-value="${rate.toFixed(0)}%"></div>`;
    })
    .join("");
}

function renderActivityChart(data = []) {
  if (data.length === 0) {
    activityChart.innerHTML = `<div class="empty-state">No activity data.</div>`;
    return;
  }

  const maxValue = Math.max(
    ...data.map((item) => Math.max(Number(item.signups || 0), Number(item.completions || 0))),
    1
  );

  activityChart.style.gridTemplateColumns = `repeat(${data.length}, minmax(10px, 1fr))`;
  activityChart.innerHTML = data
    .map((item) => {
      const signupHeight = Math.max(6, (Number(item.signups || 0) / maxValue) * 160);
      const completionHeight = Math.max(6, (Number(item.completions || 0) / maxValue) * 160);
      return `
        <div class="pair-wrap" title="${item.date}">
          <div class="bar alt" style="height:${signupHeight}px" data-value="${item.signups}S"></div>
          <div class="bar" style="height:${completionHeight}px" data-value="${item.completions}C"></div>
        </div>
      `;
    })
    .join("");
}

async function loadProblemBank() {
  try {
    const response = await apiRequest("/admin/problems");
    problemState = response.problems || [];
    renderProblemSelect();
    renderProblemBank();
  } catch (error) {
    if (!handleAuthError(error)) {
      problemBankList.innerHTML = `<div class="empty-state">Unable to load problem bank.</div>`;
      setMessage(problemMessage, error.message, "error");
    }
  }
}

async function loadDailyProblems() {
  try {
    const from = isoMinusDays(21);
    const to = isoMinusDays(-7);
    const response = await apiRequest(`/admin/daily-problems?from=${from}&to=${to}`);
    dailyProblemState = response.dailyProblems || [];
    renderDailyProblems();
  } catch (error) {
    if (!handleAuthError(error)) {
      dailyProblemsList.innerHTML = `<div class="empty-state">Unable to load daily problems.</div>`;
      setMessage(dailyProblemMessage, error.message, "error");
    }
  }
}

async function loadUsers() {
  try {
    const response = await apiRequest("/admin/users");
    userState = response.users || [];
    renderUsers();

    if (selectedUserId && userState.some((entry) => String(entry.id) === selectedUserId)) {
      await loadUserDetails(selectedUserId);
    } else if (selectedUserId) {
      selectedUserId = "";
      selectedUserDetails.innerHTML = "Select a user to view notes and completion history.";
      selectedUserDetails.className = "history-list muted";
    }
  } catch (error) {
    if (!handleAuthError(error)) {
      usersList.innerHTML = `<div class="empty-state">Unable to load users.</div>`;
    }
  }
}

async function loadUserDetails(userId) {
  try {
    selectedUserId = String(userId);
    renderUsers();
    selectedUserDetails.innerHTML = `<div class="empty-state">Loading user details...</div>`;
    selectedUserDetails.className = "history-list";

    const response = await apiRequest(`/admin/users/${encodeURIComponent(selectedUserId)}`);
    const userData = response.user;
    const stats = response.stats || {};
    const notes = response.notes || [];
    const history = response.completionHistory || [];

    selectedUserDetails.innerHTML = `
      <div class="history-item">
        <strong>${escapeHtml(userData.name)} (${escapeHtml(userData.email)})</strong>
        <p>Current streak: ${stats.currentStreak} | Max streak: ${stats.maxStreak} | Completed: ${stats.totalCompleted}</p>
      </div>
      <div class="history-item">
        <strong>Notes (${notes.length})</strong>
        <p>${
          notes
            .map((note) => `<b>${escapeHtml(note.title)}:</b> ${escapeHtml(note.content)}`)
            .join("<br/>") || "No notes yet."
        }</p>
      </div>
      <div class="history-item">
        <strong>Completion History (${history.length})</strong>
        <p>${
          history
            .slice(0, 20)
            .map((entry) => `${formatDate(entry.completion_date)} - ${escapeHtml(entry.title)}`)
            .join("<br/>") || "No completion records."
        }</p>
      </div>
    `;
  } catch (error) {
    if (!handleAuthError(error)) {
      selectedUserDetails.innerHTML = `<div class="empty-state">Unable to load user details. ${escapeHtml(error.message || "")}</div>`;
    }
  }
}

async function loadAnalytics() {
  try {
    const response = await apiRequest("/admin/analytics");
    const overview = response.overview || {};
    metricTotalUsers.textContent = overview.totalUsers || 0;
    metricTodayCompletions.textContent = overview.todayCompletions || 0;
    metricTodayRate.textContent = formatPercent(overview.todayCompletionRate || 0);
    metricTotalCompletions.textContent = overview.totalCompletions || 0;

    renderCompletionRateChart(response.dailyCompletionRates || []);
    renderActivityChart(response.userActivityTrend || []);
    renderTopPerformers(response.topPerformers || []);
  } catch (error) {
    if (!handleAuthError(error)) {
      setMessage(problemMessage, "Unable to load analytics.", "error");
    }
  }
}

async function refreshAll() {
  await Promise.all([loadProblemBank(), loadDailyProblems(), loadUsers(), loadAnalytics()]);
}

problemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: problemTitleInput.value.trim(),
    description: problemDescriptionInput.value.trim(),
    difficulty: problemDifficultyInput.value,
    topic: problemTopicInput.value.trim(),
    referenceUrl: problemReferenceInput.value.trim()
  };

  if (!payload.title || !payload.description || !payload.topic) {
    setMessage(problemMessage, "Please fill out required fields.", "error");
    return;
  }

  try {
    const problemId = problemIdInput.value.trim();
    if (problemId) {
      await apiRequest(`/admin/problems/${problemId}`, {
        method: "PUT",
        body: payload
      });
      setMessage(problemMessage, "Problem updated successfully.");
    } else {
      await apiRequest("/admin/problems", {
        method: "POST",
        body: payload
      });
      setMessage(problemMessage, "Problem added to bank.");
    }

    resetProblemForm();
    await Promise.all([loadProblemBank(), loadDailyProblems(), loadAnalytics()]);
  } catch (error) {
    if (!handleAuthError(error)) {
      setMessage(problemMessage, error.message, "error");
    }
  }
});

problemCancelButton.addEventListener("click", () => {
  resetProblemForm();
  setMessage(problemMessage, "");
});

problemBankList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const problemId = Number(target.dataset.id);
  const selectedProblem = problemState.find((problem) => problem.id === problemId);
  if (!selectedProblem) {
    return;
  }

  if (action === "edit-problem") {
    problemIdInput.value = String(selectedProblem.id);
    problemTitleInput.value = selectedProblem.title;
    problemDescriptionInput.value = selectedProblem.description;
    problemTopicInput.value = selectedProblem.topic;
    problemDifficultyInput.value = selectedProblem.difficulty;
    problemReferenceInput.value = selectedProblem.reference_url || "";
    setMessage(problemMessage, "Editing selected problem.");
    return;
  }

  if (action === "delete-problem") {
    const confirmed = window.confirm("Delete this problem from the bank?");
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/admin/problems/${problemId}`, {
        method: "DELETE"
      });
      if (Number(problemIdInput.value) === problemId) {
        resetProblemForm();
      }
      setMessage(problemMessage, "Problem deleted.");
      await Promise.all([loadProblemBank(), loadDailyProblems(), loadAnalytics()]);
    } catch (error) {
      if (!handleAuthError(error)) {
        setMessage(problemMessage, error.message, "error");
      }
    }
  }
});

dailyProblemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedDate = dailyProblemDate.value;
  const selectedProblemId = Number(dailyProblemSelect.value);
  if (!selectedDate || !selectedProblemId) {
    setMessage(dailyProblemMessage, "Please choose date and problem.", "error");
    return;
  }

  const existing = dailyProblemState.find((entry) => entry.problem_date === selectedDate);
  const payload = {
    problemDate: selectedDate,
    problemId: selectedProblemId
  };

  try {
    if (existing) {
      await apiRequest(`/admin/daily-problems/${existing.id}`, {
        method: "PUT",
        body: payload
      });
      setMessage(dailyProblemMessage, "Daily problem updated.");
    } else {
      await apiRequest("/admin/daily-problems", {
        method: "POST",
        body: payload
      });
      setMessage(dailyProblemMessage, "Daily problem created.");
    }

    await Promise.all([loadDailyProblems(), loadAnalytics()]);
  } catch (error) {
    if (!handleAuthError(error)) {
      setMessage(dailyProblemMessage, error.message, "error");
    }
  }
});

dailyResetButton.addEventListener("click", () => {
  resetDailyForm();
  setMessage(dailyProblemMessage, "");
});

dailyProblemsList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const dailyId = Number(target.dataset.id);
  const selected = dailyProblemState.find((entry) => entry.id === dailyId);
  if (!selected) {
    return;
  }

  if (action === "edit-daily") {
    dailyProblemDate.value = selected.problem_date;
    dailyProblemSelect.value = String(selected.problem_id);
    setMessage(dailyProblemMessage, "Editing selected daily problem.");
    return;
  }

  if (action === "delete-daily") {
    const confirmed = window.confirm("Delete this scheduled daily problem?");
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/admin/daily-problems/${dailyId}`, {
        method: "DELETE"
      });
      setMessage(dailyProblemMessage, "Daily problem deleted.");
      await Promise.all([loadDailyProblems(), loadAnalytics()]);
    } catch (error) {
      if (!handleAuthError(error)) {
        setMessage(dailyProblemMessage, error.message, "error");
      }
    }
  }
});

usersList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-user-id]");
  if (!button) {
    return;
  }

  const userId = String(button.dataset.userId || "");
  if (!userId) {
    return;
  }

  loadUserDetails(userId);
});

adminLogoutButton.addEventListener("click", () => {
  clearSession();
  window.location.href = "index.html";
});

function initialize() {
  adminWelcome.textContent = `Welcome, ${user.name}`;
  adminDatePill.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  resetProblemForm();
  resetDailyForm();
}

initialize();
refreshAll();
