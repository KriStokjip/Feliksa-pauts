/* Demo authentication only. Passwords are not hashed; never use for real accounts. */
document.addEventListener("DOMContentLoaded", function () {
  const $ = id => document.getElementById(id);

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", function () {
      const input = $(button.dataset.toggle);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute("aria-pressed", String(!showing));
    });
  });

  function getUsers() {
    try {
      const users = JSON.parse(localStorage.getItem("taskflow_users") || "[]");
      return Array.isArray(users) ? users : [];
    } catch (_) { return []; }
  }

  function showMessage(element, text, type) {
    element.textContent = text;
    element.className = "message " + type;
  }

  const loginForm = $("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const username = $("loginUsername").value.trim();
      const password = $("loginPassword").value;
      const message = $("loginMessage");
      const user = getUsers().find(item =>
        item.username.toLowerCase() === username.toLowerCase() &&
        item.password === password
      );
      if (!user) {
        showMessage(message, "Username or password is incorrect. If this is your first time, register first.", "error");
        return;
      }
      localStorage.setItem("taskflow_currentUser", user.username);
      window.location.href = "dashboard.html";
    });
  }

  const registerForm = $("registerForm");
  if (registerForm) {
    const password = $("registerPassword");
    const strength = $("strength");
    password.addEventListener("input", function () {
      const value = password.value;
      let score = 0;
      if (value.length >= 8) score++;
      if (value.length >= 12) score++;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
      if (/\d/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value)) score++;
      const level = value.length === 0 ? 0 : score <= 2 ? 1 : score <= 4 ? 2 : 3;
      const color = level === 1 ? "#ff454b" : level === 2 ? "#f3a33c" : "#57b637";
      strength.innerHTML = level ? '<div class="strength-bar" style="width:' + (level * 33.333) + '%;background:' + color + '"></div>' : "";
      strength.setAttribute("aria-label", ["", "Weak password", "Medium password", "Strong password"][level]);
    });

    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const username = $("registerUsername").value.trim();
      const email = $("registerEmail").value.trim();
      const pass = password.value;
      const confirm = $("confirmPassword").value;
      const message = $("registerMessage");

      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        showMessage(message, "Username must be 3–20 characters using letters, numbers, or underscores.", "error");
        return;
      }
      if (pass.length < 8 || !/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/\d/.test(pass) || !/[^A-Za-z0-9]/.test(pass)) {
        showMessage(message, "Password must contain 8+ characters, uppercase and lowercase letters, a number, and a special character.", "error");
        return;
      }
      if (pass !== confirm) {
        showMessage(message, "Passwords do not match.", "error");
        return;
      }
      const users = getUsers();
      if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        showMessage(message, "That username is already registered.", "error");
        return;
      }
      if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
        showMessage(message, "That email is already registered.", "error");
        return;
      }
      users.push({ id: "user-" + Date.now().toString(36), username, email, password: pass });
      try {
        localStorage.setItem("taskflow_users", JSON.stringify(users));
        showMessage(message, "Account created! Taking you to login…", "success");
        registerForm.reset();
        strength.innerHTML = "";
        setTimeout(() => window.location.href = "login.html", 900);
      } catch (_) {
        showMessage(message, "Could not save the account. Check browser storage space.", "error");
      }
    });
  }
});
