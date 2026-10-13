/** Workspace overview. */
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;

  try {
    const user = await T.requireLogin();
    if (!user) return;

    const data = await T.api('dashboard');
    const stats = data.stats;
    document.getElementById('statProjects').textContent = stats.projects;
    document.getElementById('statOpen').textContent = stats.open_tasks;
    document.getElementById('statDone').textContent = stats.done_tasks;
    document.getElementById('statOverdue').textContent = stats.overdue_tasks;

    const activeTasks = document.getElementById('activeTasks');
    activeTasks.innerHTML = data.tasks.length
      ? data.tasks.map((task) => `
          <div class="task-row">
            <div class="task-main">
              <div class="task-title">${T.escapeHTML(task.title)}</div>
              <div class="task-meta">
                <span>${T.escapeHTML(task.project_name)}</span>
                <span>·</span>
                <span class="${T.overdue(task.deadline, task.status) ? 'task-deadline overdue' : ''}">
                  ${T.escapeHTML(T.dateLabel(task.deadline))}
                </span>
                ${task.assignee ? `<span>· ${T.escapeHTML(task.assignee)}</span>` : ''}
              </div>
            </div>
            <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
            <a class="icon-button" href="project.html?id=${Number(task.project_id)}" aria-label="Open project">↗</a>
          </div>
        `).join('')
      : `<div class="empty-state">
           <strong>All caught up!</strong>
           No open tasks right now. Create a project to get started.
         </div>`;

    const result = await T.api('projects');
    const overview = document.getElementById('projectOverview');
    overview.innerHTML = result.projects.length
      ? result.projects.slice(0, 6).map((project) => `
          <div class="overview-item">
            <div class="overview-top">
              <span>${T.escapeHTML(project.name)}</span>
              <span>${project.progress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${project.progress}%"></div>
            </div>
            <div class="task-meta">
              <span>${project.done_count} of ${project.task_count} tasks completed</span>
              <a class="text-link" href="project.html?id=${project.id}">Open →</a>
            </div>
          </div>
        `).join('')
      : `<div class="empty-state">
           <strong>No projects yet</strong>
           Create your first project to see progress here.
           <a class="text-link" href="projects.html#new-project">Create a project →</a>
         </div>`;
  } catch (error) {
    console.error(error);
    T.showMessage(document.getElementById('dashboardError'), error.message, 'error');
  }
});
