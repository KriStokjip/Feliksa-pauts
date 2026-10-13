/** Dashboard for all visible personal and shared tasks. */
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);
  const priorityRank = { high: 0, medium: 1, low: 2 };
  let tasks = [];
  let user = null;

  const byDeadline = (a, b) => (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31');

  function render() {
    const status = get('dashboardStatus').value;
    const priority = get('dashboardPriority').value;
    const scope = get('dashboardScope').value;
    const sort = get('dashboardSort').value;
    const visible = tasks.filter((task) => {
      const statusMatches = status === 'all'
        || (status === 'open' ? task.status !== 'done' : task.status === 'done');
      const priorityMatches = priority === 'all' || task.priority === priority;
      const scopeMatches = scope === 'all'
        || (scope === 'personal' && task.kind === 'personal')
        || (scope === 'project' && task.kind === 'project')
        || (scope === 'assigned' && task.assignee_id === user.id);
      return statusMatches && priorityMatches && scopeMatches;
    });

    visible.sort((a, b) => {
      if (sort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || byDeadline(a, b);
      if (sort === 'title') return a.title.localeCompare(b.title);
      return byDeadline(a, b) || priorityRank[a.priority] - priorityRank[b.priority];
    });

    get('dashboardTaskCount').textContent = `${visible.length} matching task(s)`;
    get('dashboardTasks').innerHTML = visible.length
      ? visible.map((task) => {
          const href = task.kind === 'personal'
            ? 'my-tasks.html'
            : `project.html?id=${Number(task.project_id)}`;
          const source = task.kind === 'personal'
            ? 'Personal task'
            : `Project: ${T.escapeHTML(task.project_name)}`;
          return `
            <div class="task-row ${task.status === 'done' ? 'is-done' : ''}">
              <div class="task-main">
                <div class="task-title">${T.escapeHTML(task.title)}</div>
                ${task.description ? `<p class="task-description">${T.escapeHTML(task.description)}</p>` : ''}
                <div class="task-meta">
                  <span>${source}</span>
                  <span class="status-pill status-${task.status}">${T.statusLabel(task.status)}</span>
                  <span class="${T.overdue(task.deadline, task.status) ? 'task-deadline overdue' : ''}">
                    ${T.escapeHTML(T.dateLabel(task.deadline))}
                  </span>
                  ${task.kind === 'project' && task.assignee
                    ? `<span>Assigned: ${T.escapeHTML(task.assignee)}</span>` : ''}
                </div>
              </div>
              <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
              <a class="icon-button" href="${href}" aria-label="Open ${task.kind === 'personal' ? 'personal tasks' : 'project'}">Open →</a>
            </div>`;
        }).join('')
      : '<div class="empty-state"><strong>No matching tasks</strong>Try adjusting the filters or add a new task.</div>';
  }

  function renderProjects(projects) {
    get('projectOverview').innerHTML = projects.length
      ? projects.slice(0, 6).map((project) => `
          <div class="overview-item">
            <div class="overview-top">
              <span>${T.escapeHTML(project.name)}</span><span>${project.progress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${project.progress}%"></div>
            </div>
            <div class="task-meta">
              <span>${project.done_count} of ${project.task_count} tasks completed</span>
              <a class="text-link" href="project.html?id=${Number(project.id)}">Open →</a>
            </div>
          </div>`).join('')
      : '<div class="empty-state"><strong>No shared projects yet</strong>Create a project or accept an invitation.</div>';
  }

  ['dashboardStatus', 'dashboardPriority', 'dashboardScope', 'dashboardSort'].forEach((id) => {
    get(id).addEventListener('change', render);
  });

  try {
    user = await T.requireLogin();
    if (!user) return;
    const [dashboardData, projectsData] = await Promise.all([
      T.api('dashboard'),
      T.api('projects'),
    ]);

    tasks = dashboardData.tasks;
    get('statProjects').textContent = dashboardData.stats.projects;
    get('statOpen').textContent = dashboardData.stats.open_tasks;
    get('statDone').textContent = dashboardData.stats.done_tasks;
    get('statOverdue').textContent = dashboardData.stats.overdue_tasks;
    render();
    renderProjects(projectsData.projects);
  } catch (error) {
    T.showMessage(get('dashboardError'), error.message, 'error');
  }
});
