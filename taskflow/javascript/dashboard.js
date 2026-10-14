
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
    const elements = visible.map((task) => {
      const card = T.cloneTemplate('dashboardTaskTemplate');
      card.classList.toggle('is-done', task.status === 'done');
      card.querySelector('.task-title').textContent = task.title;
      const description = card.querySelector('.task-description');
      description.textContent = task.description || '';
      description.hidden = !task.description;
      card.querySelector('.task-source').textContent = task.kind === 'personal'
        ? 'Personal task' : `Project: ${task.project_name}`;
      const status = card.querySelector('.status-pill');
      status.textContent = T.statusLabel(task.status);
      status.classList.add(`status-${task.status}`);
      const deadline = card.querySelector('.task-deadline');
      deadline.textContent = T.dateLabel(task.deadline);
      deadline.classList.toggle('overdue', T.overdue(task.deadline, task.status));
      const assignee = card.querySelector('.task-assignee');
      assignee.textContent = task.kind === 'project' && task.assignee
        ? `Assigned: ${task.assignee}` : '';
      assignee.hidden = !assignee.textContent;
      const priorityBadge = card.querySelector('.priority');
      priorityBadge.textContent = T.priorityLabel(task.priority);
      priorityBadge.classList.add(`priority-${task.priority}`);
      const link = card.querySelector('.task-open');
      link.href = task.kind === 'personal'
        ? 'my-tasks.html' : `project.html?id=${Number(task.project_id)}`;
      link.setAttribute('aria-label', task.kind === 'personal' ? 'Open personal tasks' : 'Open project');
      return card;
    });
    get('dashboardTasks').replaceChildren(...(elements.length
      ? elements : [T.emptyState('No matching tasks', 'Try adjusting the filters or add a new task.')]));
  }

  function renderProjects(projects) {
    const elements = projects.slice(0, 6).map((project) => {
      const card = T.cloneTemplate('projectOverviewTemplate');
      card.querySelector('.overview-name').textContent = project.name;
      card.querySelector('.overview-progress').textContent = `${project.progress}%`;
      card.querySelector('.progress-fill').style.width = `${project.progress}%`;
      card.querySelector('.overview-stats').textContent = `${project.done_count} of ${project.task_count} tasks completed`;
      card.querySelector('.overview-link').href = `project.html?id=${Number(project.id)}`;
      return card;
    });
    get('projectOverview').replaceChildren(...(elements.length
      ? elements : [T.emptyState('No shared projects yet', 'Create a project or accept an invitation.')]));
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
