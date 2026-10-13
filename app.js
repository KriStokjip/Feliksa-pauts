/* Shared localStorage helpers for the TaskFlow school prototype. */
(function () {
  const KEY = "taskflow_projects";
  const USER_KEY = "taskflow_currentUser";

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }

  function currentUser() {
    return localStorage.getItem(USER_KEY) || "";
  }

  function getUsers() {
    return safeParse(localStorage.getItem("taskflow_users"), []);
  }

  function saveUsers(users) {
    localStorage.setItem("taskflow_users", JSON.stringify(users));
  }

  function getProjects() {
    return safeParse(localStorage.getItem(KEY), []);
  }

  function saveProjects(projects) {
    localStorage.setItem(KEY, JSON.stringify(projects));
  }

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function dateLabel(date) {
    if (!date) return "No deadline";
    const parsed = new Date(date + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) return "No deadline";
    return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function isOverdue(date, status) {
    if (!date || status === "done") return false;
    return date < new Date().toISOString().slice(0, 10);
  }

  function priorityLabel(priority) {
    return ({ high: "High", medium: "Medium", low: "Low" })[priority] || "Medium";
  }

  function statusLabel(status) {
    return ({ todo: "To do", doing: "In progress", done: "Completed" })[status] || "To do";
  }

  function progress(project) {
    const tasks = project.tasks || [];
    if (!tasks.length) return 0;
    return Math.round(tasks.filter(task => task.status === "done").length / tasks.length * 100);
  }

  function getProject(id) {
    return getProjects().find(project => project.id === id);
  }

  function requireLogin() {
    if (!currentUser()) {
      window.location.replace("login.html");
      return false;
    }
    const greeting = document.getElementById("userGreeting");
    if (greeting) greeting.textContent = "Hi, " + currentUser();
    const logout = document.getElementById("logoutButton");
    if (logout) logout.addEventListener("click", () => {
      localStorage.removeItem(USER_KEY);
      window.location.href = "login.html";
    });
    return true;
  }

  function ensureSeedProject() {
    const projects = getProjects();
    if (projects.length || !currentUser()) return;
    const today = new Date();
    const deadline = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    projects.push({
      id: uid(),
      owner: currentUser(),
      name: "Website launch",
      description: "Plan the first version of our team website and keep everyone aligned.",
      priority: "high",
      deadline,
      members: [currentUser(), "alex", "sam"],
      createdAt: new Date().toISOString(),
      tasks: [
        { id: uid(), title: "Create the page structure", assignee: currentUser(), deadline, priority: "high", status: "done" },
        { id: uid(), title: "Design the dashboard", assignee: "alex", deadline, priority: "medium", status: "doing" },
        { id: uid(), title: "Review the project with the team", assignee: "sam", deadline: "", priority: "low", status: "todo" }
      ]
    });
    saveProjects(projects);
  }

  window.TaskFlow = {
    currentUser, getUsers, saveUsers, getProjects, saveProjects, uid, escapeHTML,
    dateLabel, isOverdue, priorityLabel, statusLabel, progress, getProject,
    requireLogin, ensureSeedProject
  };

  if (document.body.classList.contains("app-page")) requireLogin();
})();
