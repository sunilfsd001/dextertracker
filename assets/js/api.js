const TOKEN_KEY = "coding_tracker_token";
const USER_KEY = "coding_tracker_user";

const PAGE_LOGIN = "index.html";
const PAGE_USER = "dashboard.html";
const PAGE_ADMIN = "admin.html";

const API_BASE_URL =
  window.__DEXTER_API_BASE_URL ||
  localStorage.getItem("dexter_api_base_url") ||
  "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const token = getToken();
  const url = new URL(`${API_BASE_URL}${path}`);

  // Prevent stale cached GET responses in admin/user dashboards.
  if (method === "GET") {
    url.searchParams.set("_ts", String(Date.now()));
  }

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(options.headers || {})
  };

  if (token && options.auth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    cache: "no-store",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = responseBody.error
      ? `${responseBody.message || "Request failed."} (${responseBody.error})`
      : responseBody.message || "Request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.code = responseBody.code || null;
    error.details = responseBody.errors || [];
    throw error;
  }

  return responseBody;
}

function requireAuth(allowedRoles = []) {
  const user = getCurrentUser();
  const token = getToken();

  if (!token || !user) {
    window.location.href = PAGE_LOGIN;
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    window.location.href = user.role === "admin" ? PAGE_ADMIN : PAGE_USER;
    return null;
  }

  return user;
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export {
  apiRequest,
  setSession,
  clearSession,
  getCurrentUser,
  requireAuth,
  formatDate,
  formatDateTime,
  formatPercent
};
