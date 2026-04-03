import {
  apiRequest,
  clearSession,
  requireAuth,
  formatDate,
  formatDateTime,
  formatPercent
} from "./api.js";

const user = requireAuth(["user"]);
if (!user) {
  throw new Error("Unauthorized");
}

const welcomeHeading = document.getElementById("welcomeHeading");
const todayDatePill = document.getElementById("todayDatePill");
const logoutButton = document.getElementById("logoutButton");

const problemTitle = document.getElementById("problemTitle");
const problemDescription = document.getElementById("problemDescription");
const problemDifficultyBadge = document.getElementById("problemDifficultyBadge");
const problemTopic = document.getElementById("problemTopic");
const problemReference = document.getElementById("problemReference");
const finishProblemButton = document.getElementById("finishProblemButton");
const finishMessage = document.getElementById("finishMessage");

const currentStreakValue = document.getElementById("currentStreakValue");
const maxStreakValue = document.getElementById("maxStreakValue");
const totalCompletedValue = document.getElementById("totalCompletedValue");
const completionRateValue = document.getElementById("completionRateValue");
const lastCompletedValue = document.getElementById("lastCompletedValue");
const miniHistoryBars = document.getElementById("miniHistoryBars");

const leaderboardList = document.getElementById("leaderboardList");
const historyList = document.getElementById("historyList");

const noteForm = document.getElementById("noteForm");
const noteIdInput = document.getElementById("noteId");
const noteTitleInput = document.getElementById("noteTitle");
const noteContentInput = document.getElementById("noteContent");
const cancelEditNoteButton = document.getElementById("cancelEditNoteButton");
const notesList = document.getElementById("notesList");
const noteMessage = document.getElementById("noteMessage");

let notesState = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function setFinishMessage(message, type = "") {
  finishMessage.textContent = message;
  finishMessage.className = `status-message ${type}`.trim();
}

function setNoteMessage(message, type = "") {
  noteMessage.textContent = message;
  noteMessage.className = `status-message ${type}`.trim();
}

function handleAuthError(error) {
  if (error.status === 401) {
    clearSession();
    window.location.href = "index.html";
    return true;
  }
  return false;
}

function updateStats(stats) {
  currentStreakValue.textContent = stats.currentStreak || 0;
  maxStreakValue.textContent = stats.maxStreak || 0;
  totalCompletedValue.textContent = stats.totalCompleted || 0;
  completionRateValue.textContent = formatPercent(stats.completionRate || 0);
  lastCompletedValue.textContent = formatDate(stats.lastCompletedDate);
}

function renderMiniHistory(completionDates = []) {
  miniHistoryBars.innerHTML = "";
  const completionSet = new Set(completionDates);

  for (let day = 13; day >= 0; day -= 1) {
    const isoDate = isoMinusDays(day);
    const bar = document.createElement("div");
    const active = completionSet.has(isoDate);
    bar.classList.toggle("active", active);
    bar.style.height = active ? "44px" : "16px";
    bar.title = `${isoDate} - ${active ? "Completed" : "Missed"}`;
    miniHistoryBars.appendChild(bar);
  }
}

function renderLeaderboard(leaderboard = []) {
  if (leaderboard.length === 0) {
    leaderboardList.innerHTML = `<div class="empty-state">No leaderboard data yet.</div>`;
    return;
  }

  leaderboardList.innerHTML = leaderboard
    .map(
      (entry) => `
      <div class="list-item">
        <strong>#${entry.rank} ${escapeHtml(entry.name)}</strong>
        <p>${Number(entry.totalCompleted)} completed | ${Number(entry.currentStreak)} streak</p>
      </div>
    `
    )
    .join("");
}

function renderHistory(history = []) {
  if (history.length === 0) {
    historyList.innerHTML = `<div class="empty-state">No completion history yet.</div>`;
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
      <div class="history-item">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${formatDate(item.completionDate)} | ${escapeHtml(item.difficulty.toUpperCase())} | ${escapeHtml(item.topic)}</p>
      </div>
    `
    )
    .join("");
}

function renderNotes() {
  if (notesState.length === 0) {
    notesList.innerHTML = `<div class="empty-state">No notes yet. Create your first one.</div>`;
    return;
  }

  notesList.innerHTML = notesState
    .map(
      (note) => `
      <div class="note-item">
        <strong>${escapeHtml(note.title)}</strong>
        <p>${escapeHtml(note.content)}</p>
        <p class="muted">Updated: ${formatDateTime(note.updated_at)}</p>
        <div class="note-item-actions">
          <button class="small-btn" data-action="edit" data-id="${note.id}" type="button">Edit</button>
          <button class="small-btn danger" data-action="delete" data-id="${note.id}" type="button">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

function setNoteForm(note = null) {
  if (!note) {
    noteIdInput.value = "";
    noteTitleInput.value = "";
    noteContentInput.value = "";
    cancelEditNoteButton.style.display = "none";
    return;
  }

  noteIdInput.value = String(note.id);
  noteTitleInput.value = note.title;
  noteContentInput.value = note.content;
  cancelEditNoteButton.style.display = "inline-flex";
}

async function loadTodayProblem() {
  try {
    const response = await apiRequest("/user/today-problem");
    const { problem, completedToday } = response;

    problemTitle.textContent = problem.title;
    problemDescription.textContent = problem.description;
    problemDifficultyBadge.textContent = problem.difficulty;
    problemTopic.textContent = problem.topic;
    problemReference.href = problem.reference_url || "#";
    problemReference.style.display = problem.reference_url ? "inline-flex" : "none";

    finishProblemButton.disabled = completedToday;
    finishProblemButton.textContent = completedToday ? "Finished Today" : "Mark as Finished";
    setFinishMessage(completedToday ? "You already finished today's problem." : "");
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }

    problemTitle.textContent = "No Problem Yet";
    problemDescription.textContent = error.message;
    problemDifficultyBadge.textContent = "-";
    problemTopic.textContent = "Awaiting admin update";
    problemReference.style.display = "none";
    finishProblemButton.disabled = true;
    finishProblemButton.textContent = "Unavailable";
    setFinishMessage("Admin has not assigned today's problem yet.", "warn");
  }
}

async function loadNotes() {
  try {
    const response = await apiRequest("/user/notes");
    notesState = response.notes || [];
    renderNotes();
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }
    notesList.innerHTML = `<div class="empty-state">Unable to load notes.</div>`;
  }
}

async function loadHistory() {
  try {
    const response = await apiRequest("/user/history?limit=30");
    renderHistory(response.history || []);
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }
    historyList.innerHTML = `<div class="empty-state">Unable to load history.</div>`;
  }
}

async function loadLeaderboard() {
  try {
    const response = await apiRequest("/leaderboard?limit=10");
    renderLeaderboard(response.leaderboard || []);
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }
    leaderboardList.innerHTML = `<div class="empty-state">Unable to load leaderboard.</div>`;
  }
}

async function loadStats() {
  try {
    const [profileResponse, statsResponse] = await Promise.all([
      apiRequest("/user/profile"),
      apiRequest("/user/stats")
    ]);

    updateStats(profileResponse.stats || {});
    renderMiniHistory(statsResponse.completionDates || []);
  } catch (error) {
    if (!handleAuthError(error)) {
      setFinishMessage("Unable to load stats.", "error");
    }
  }
}

async function refreshDashboard() {
  await Promise.all([loadTodayProblem(), loadNotes(), loadHistory(), loadLeaderboard(), loadStats()]);
}

finishProblemButton.addEventListener("click", async () => {
  finishProblemButton.disabled = true;
  setFinishMessage("Marking completion...");

  try {
    const response = await apiRequest("/user/today-problem/complete", {
      method: "POST"
    });

    updateStats(response.stats || {});
    finishProblemButton.textContent = "Finished Today";
    setFinishMessage(response.message);
    await Promise.all([loadLeaderboard(), loadHistory(), loadStats(), loadTodayProblem()]);
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }

    setFinishMessage(error.message, "error");
    finishProblemButton.disabled = false;
  }
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const noteId = noteIdInput.value.trim();
  const payload = {
    title: noteTitleInput.value.trim(),
    content: noteContentInput.value.trim()
  };

  if (!payload.title || !payload.content) {
    setNoteMessage("Note title and content are required.", "error");
    return;
  }

  try {
    if (noteId) {
      await apiRequest(`/user/notes/${noteId}`, {
        method: "PUT",
        body: payload
      });
      setNoteMessage("Note updated.");
    } else {
      await apiRequest("/user/notes", {
        method: "POST",
        body: payload
      });
      setNoteMessage("Note created.");
    }

    setNoteForm(null);
    await loadNotes();
  } catch (error) {
    if (handleAuthError(error)) {
      return;
    }
    setNoteMessage(error.message, "error");
  }
});

cancelEditNoteButton.addEventListener("click", () => {
  setNoteForm(null);
});

notesList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const noteId = Number(target.dataset.id);
  const action = target.dataset.action;
  const note = notesState.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  if (action === "edit") {
    setNoteForm(note);
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm("Delete this note permanently?");
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/user/notes/${noteId}`, {
        method: "DELETE"
      });
      if (Number(noteIdInput.value) === noteId) {
        setNoteForm(null);
      }
      setNoteMessage("Note deleted.");
      await loadNotes();
    } catch (error) {
      if (!handleAuthError(error)) {
        setNoteMessage(error.message, "error");
      }
    }
  }
});

logoutButton.addEventListener("click", () => {
  clearSession();
  window.location.href = "index.html";
});

function initializePage() {
  welcomeHeading.textContent = `Welcome, ${user.name}`;
  todayDatePill.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  cancelEditNoteButton.style.display = "none";
  setNoteMessage("");
}

initializePage();
refreshDashboard();
