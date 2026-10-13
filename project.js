document.addEventListener("DOMContentLoaded", function () {
  const T = window.TaskFlow;
  if (!T.currentUser()) return;
  const params = new URLSearchParams(window.location.search);
  let projectId = params.get("id");
  let project = T.getProject(projectId);

  if (!project) {
    document.getElementById("projectHeader").innerHTML = '<h1>Project not found</h1><p class="muted">This project may have been deleted.</p><a class="text-link" href="projects.html">Return to projects →</a>';
    ["showTaskForm", "taskFormPanel", "taskList", "memberForm", "memberList", "editProjectButton", "deleteProjectButton"].forEach(id => {
      const el = document.getElementById(id); if (el) el.classList.add("hidden");
    });
    return;
  }

  const taskFormPanel = document.getElementById("taskFormPanel");
  const taskForm = document.getElementById("taskForm");
  const taskMessage = document.getElementById("taskFormMessage");
  const memberMessage = document.getElementById("memberMessage");

  function refreshProject() { project = T.getProject(projectId); }
  function save() { const projects = T.getProjects(); const index = projects.findIndex(item => item.id === projectId); if (index >= 0) projects[index] = project; T.saveProjects(projects); }
  function message(el, text, type) { el.textContent = text; el.className = "message " + type; }

  function renderHeader() {
    const owner = project.owner === T.currentUser();
    document.title = project.name + " | TaskFlow";
    document.getElementById("projectHeader").innerHTML = `
      <div class="project-hero-top"><div><span class="priority priority-${project.priority}">${T.priorityLabel(project.priority)} priority</span><h1>${T.escapeHTML(project.name)}</h1><p class="muted">${T.escapeHTML(project.description || "No description has been added yet.")}</p>
      <div class="hero-meta"><span>◷ Deadline: ${T.escapeHTML(T.dateLabel(project.deadline))}</span><span>•</span><span>♙ ${(project.members || []).length} team member${(project.members || []).length === 1 ? "" : "s"}</span><span>•</span><span>${(project.tasks || []).length} tasks</span></div></div>
      <div><a class="btn btn-secondary" href="projects.html">All projects</a></div></div>`;
    document.getElementById("editProjectButton").disabled = !owner;
    document.getElementById("deleteProjectButton").disabled = !owner;
    document.getElementById("editProjectButton").title = owner ? "" : "Only the project owner can edit settings";
    document.getElementById("deleteProjectButton").title = owner ? "" : "Only the project owner can delete this project";
  }

  function renderTasks() {
    const statusFilter = document.getElementById("taskStatusFilter").value;
    const priorityFilter = document.getElementById("taskPriorityFilter").value;
    const tasks = (project.tasks || []).filter(task =>
      (statusFilter === "all" || task.status === statusFilter) &&
      (priorityFilter === "all" || task.priority === priorityFilter)
    );
    const list = document.getElementById("taskList");
    list.innerHTML = tasks.length ? tasks.map(task => `
      <div class="task-row ${task.status === "done" ? "is-done" : ""}">
        <input class="task-check" type="checkbox" data-complete="${T.escapeHTML(task.id)}" ${task.status === "done" ? "checked" : ""} aria-label="Mark ${T.escapeHTML(task.title)} completed">
        <div class="task-main"><div class="task-title">${T.escapeHTML(task.title)}</div><div class="task-meta"><span class="status-pill status-${task.status}">${T.statusLabel(task.status)}</span><span>Assigned: ${T.escapeHTML(task.assignee || "Unassigned")}</span><span class="${T.isOverdue(task.deadline, task.status) ? "task-deadline overdue" : ""}">${T.escapeHTML(T.dateLabel(task.deadline))}${T.isOverdue(task.deadline, task.status) ? " · Overdue" : ""}</span></div></div>
        <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
        <div class="task-actions"><button class="icon-button edit-task" data-id="${T.escapeHTML(task.id)}" aria-label="Edit task">✎</button><button class="icon-button delete-task" data-id="${T.escapeHTML(task.id)}" aria-label="Delete task">✕</button></div>
      </div>`).join("") : '<div class="empty-state"><strong>No tasks here</strong>Add a task or change the filters.</div>';

    list.querySelectorAll("[data-complete]").forEach(input => input.addEventListener("change", () => {
      const task = project.tasks.find(item => item.id === input.dataset.complete);
      if (task) task.status = input.checked ? "done" : "todo";
      save(); renderAll();
    }));
    list.querySelectorAll(".edit-task").forEach(button => button.addEventListener("click", () => {
      const task = project.tasks.find(item => item.id === button.dataset.id);
      if (!task) return;
      document.getElementById("taskId").value = task.id;
      document.getElementById("taskTitle").value = task.title;
      document.getElementById("taskAssignee").value = task.assignee || "";
      document.getElementById("taskDeadline").value = task.deadline || "";
      document.getElementById("taskPriority").value = task.priority || "medium";
      document.getElementById("taskStatus").value = task.status || "todo";
      taskFormPanel.classList.remove("hidden");
      taskFormPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
    list.querySelectorAll(".delete-task").forEach(button => button.addEventListener("click", () => {
      if (!confirm("Delete this task?")) return;
      project.tasks = project.tasks.filter(item => item.id !== button.dataset.id);
      save(); renderAll();
    }));

    const done = (project.tasks || []).filter(task => task.status === "done").length;
    const pct = T.progress(project);
    document.getElementById("progressNumber").textContent = pct + "%";
    document.getElementById("progressBar").style.width = pct + "%";
    document.getElementById("progressCaption").textContent = `${done} of ${(project.tasks || []).length} tasks completed`;
  }

  function renderMembers() {
    const list = document.getElementById("memberList");
    const members = [...new Set(project.members || [])];
    list.innerHTML = members.map(name => {
      const owner = name === project.owner;
      return `<div class="member-item"><span class="avatar">${T.escapeHTML(name.slice(0, 2).toUpperCase())}</span><span class="member-name">${T.escapeHTML(name)}<br><span class="member-role">${owner ? "Project owner" : "Team member"}</span></span>${!owner && project.owner === T.currentUser() ? `<button class="remove-member" data-member="${T.escapeHTML(name)}" aria-label="Remove ${T.escapeHTML(name)}">✕</button>` : ""}</div>`;
    }).join("") || '<div class="empty-state">No team members yet.</div>';
    list.querySelectorAll(".remove-member").forEach(button => button.addEventListener("click", () => {
      project.members = project.members.filter(name => name !== button.dataset.member);
      save(); renderMembers(); renderHeader();
    }));
  }

  function renderAll() { refreshProject(); renderHeader(); renderTasks(); renderMembers(); }

  document.getElementById("showTaskForm").addEventListener("click", () => {
    taskForm.reset();
    document.getElementById("taskId").value = "";
    document.getElementById("taskAssignee").value = T.currentUser();
    document.getElementById("taskStatus").value = "todo";
    taskFormPanel.classList.toggle("hidden");
  });
  document.getElementById("cancelTaskForm").addEventListener("click", () => { taskFormPanel.classList.add("hidden"); taskForm.reset(); message(taskMessage, "", ""); });

  taskForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const title = document.getElementById("taskTitle").value.trim();
    if (!title) return message(taskMessage, "Please enter a task title.", "error");
    const id = document.getElementById("taskId").value;
    const taskData = {
      title,
      assignee: document.getElementById("taskAssignee").value.trim() || "Unassigned",
      deadline: document.getElementById("taskDeadline").value,
      priority: document.getElementById("taskPriority").value,
      status: document.getElementById("taskStatus").value
    };
    if (id) {
      const task = project.tasks.find(item => item.id === id);
      if (task) Object.assign(task, taskData);
    } else {
      project.tasks = project.tasks || [];
      project.tasks.push({ id: T.uid(), ...taskData });
    }
    save(); taskForm.reset(); document.getElementById("taskId").value = ""; taskFormPanel.classList.add("hidden"); renderAll();
  });

  document.getElementById("taskStatusFilter").addEventListener("change", renderTasks);
  document.getElementById("taskPriorityFilter").addEventListener("change", renderTasks);

  document.getElementById("memberForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const name = document.getElementById("memberName").value.trim();
    if (!name) return;
    if (project.members.some(member => member.toLowerCase() === name.toLowerCase())) {
      return message(memberMessage, "That member is already on the team.", "error");
    }
    project.members.push(name);
    save();
    document.getElementById("memberName").value = "";
    message(memberMessage, name + " added to the demo team.", "success");
    renderMembers(); renderHeader();
  });

  document.getElementById("editProjectButton").addEventListener("click", () => {
    if (project.owner !== T.currentUser()) return alert("Only the project owner can edit settings.");
    window.location.href = "projects.html?edit=" + encodeURIComponent(project.id);
  });

  document.getElementById("deleteProjectButton").addEventListener("click", () => {
    if (project.owner !== T.currentUser()) return alert("Only the project owner can delete this project.");
    if (!confirm("Delete this project and all its tasks? This cannot be undone.")) return;
    T.saveProjects(T.getProjects().filter(item => item.id !== project.id));
    window.location.href = "projects.html";
  });

  renderAll();
});
