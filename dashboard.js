document.addEventListener("DOMContentLoaded", function () {
  const T = window.TaskFlow;
  if (!T.currentUser()) return;
  T.ensureSeedProject();

  const projects = T.getProjects().filter(project =>
    project.owner === T.currentUser() || (project.members || []).includes(T.currentUser())
  );
  const allTasks = projects.flatMap(project => (project.tasks || []).map(task => ({ ...task, projectName: project.name, projectId: project.id })));
  const openTasks = allTasks.filter(task => task.status !== "done");
  const doneTasks = allTasks.filter(task => task.status === "done");
  const overdue = openTasks.filter(task => T.isOverdue(task.deadline, task.status));

  document.getElementById("statProjects").textContent = projects.length;
  document.getElementById("statOpen").textContent = openTasks.length;
  document.getElementById("statDone").textContent = doneTasks.length;
  document.getElementById("statOverdue").textContent = overdue.length;

  const active = document.getElementById("activeTasks");
  const nextTasks = openTasks.slice().sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  }).slice(0, 6);

  active.innerHTML = nextTasks.length ? nextTasks.map(task => `
    <div class="task-row">
      <div class="task-main">
        <div class="task-title">${T.escapeHTML(task.title)}</div>
        <div class="task-meta"><span>${T.escapeHTML(task.projectName)}</span><span>·</span><span class="${T.isOverdue(task.deadline, task.status) ? "task-deadline overdue" : ""}">${T.escapeHTML(T.dateLabel(task.deadline))}</span></div>
      </div>
      <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
      <a class="icon-button" href="project.html?id=${encodeURIComponent(task.projectId)}" aria-label="Open project">↗</a>
    </div>`).join("") : '<div class="empty-state"><strong>All caught up!</strong>No open tasks right now. Create a project or enjoy the breathing room.</div>';

  const overview = document.getElementById("projectOverview");
  overview.innerHTML = projects.length ? projects.slice(0, 6).map(project => {
    const pct = T.progress(project);
    return `<div class="overview-item">
      <div class="overview-top"><span>${T.escapeHTML(project.name)}</span><span>${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="task-meta"><span>${(project.tasks || []).filter(t => t.status === "done").length} of ${(project.tasks || []).length} tasks completed</span><a class="text-link" href="project.html?id=${encodeURIComponent(project.id)}">Open →</a></div>
    </div>`;
  }).join("") : '<div class="empty-state"><strong>No projects yet</strong>Create your first project to see progress here.<br><a class="text-link" href="projects.html#new-project">Create a project →</a></div>';
});
