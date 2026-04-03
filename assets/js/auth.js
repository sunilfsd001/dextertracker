import { apiRequest, setSession, getCurrentUser } from "./api.js";

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const messageElement = document.getElementById("authMessage");

const existingUser = getCurrentUser();
if (existingUser) {
  window.location.href = existingUser.role === "admin" ? "admin.html" : "dashboard.html";
}

function setMessage(message, type = "") {
  messageElement.textContent = message;
  messageElement.className = `status-message ${type}`.trim();
}

function setTab(tab) {
  const showLogin = tab === "login";
  loginTab.classList.toggle("active", showLogin);
  signupTab.classList.toggle("active", !showLogin);
  loginForm.classList.toggle("active", showLogin);
  signupForm.classList.toggle("active", !showLogin);
  setMessage("");
}

function redirectByRole(role) {
  window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
}

loginTab.addEventListener("click", () => setTab("login"));
signupTab.addEventListener("click", () => setTab("signup"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Authenticating...");

  const formData = new FormData(loginForm);
  const payload = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "")
  };

  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: payload,
      auth: false
    });

    setSession(result.token, result.user);
    setMessage("Login successful. Redirecting...");
    redirectByRole(result.user.role);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Creating account...");

  const formData = new FormData(signupForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "")
  };

  try {
    const result = await apiRequest("/auth/signup", {
      method: "POST",
      body: payload,
      auth: false
    });

    setSession(result.token, result.user);
    setMessage("Account created. Redirecting...");
    redirectByRole(result.user.role);
  } catch (error) {
    if (error.details && error.details.length > 0) {
      const details = error.details.map((entry) => entry.message).join(" ");
      setMessage(details, "error");
    } else {
      setMessage(error.message, "error");
    }
  }
});
