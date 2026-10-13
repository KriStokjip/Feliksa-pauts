document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  try {
    const user = await T.requireLogin();
    if (!user) return;
    const data = await T.api('dashboard');
    const s = data.stats;
    document.getElementById('statProjects').textContent = s.projects;
    document.getElementById('statOpen').textContent = s.open_tasks;
    document.getElementById('statDone').textContent = s.done_tasks;
    document.getElementById('statOverdue').textContent = s.overdue_tasks;

    const tasks = document.getElementById('activeTasks');
    tasks.innerHTML = data.tasks.length ? data.tasks.map(task => `
      <div class="task-row">
        <div class="task-main"><div class="task-title">${T.escapeHTML(task.title)}</div>
        <div class="task-meta"><span>${T.escapeHTML(task.project_name)}</span><span>·</span>
        <span class="${T.overdue(task.deadline,task.status) ? 'task-deadline overdue' : ''}">${T.escapeHTML(T.dateLabel(task.deadline))}</span>
        ${task.assignee ? `<span>· ${T.escapeHTML(task.assignee)}</span>` : ''}</div></div>
        <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
        <a class="icon-button" href="project.html?id=${encodeURIComponent(task.project_id)}" aria-label="Open project">↗</a>
      </div>`).join('') : '<div class="empty-state"><strong>All caught up!</strong>No open tasks right now. Create a project to get started.</div>';

    const result = await T.api('projects');
    const projects = result.projects;
    const overview = document.getElementById('projectOverview');
    overview.innerHTML = projects.length ? projects.slice(0,6).map(p => `
      <div class="overview-item"><div class="overview-top"><span>${T.escapeHTML(p.name)}</span><span>${p.progress}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${p.progress}%"></div></div>
      <div class="task-meta"><span>${p.done_count} of ${p.task_count} tasks completed</span><a class="text-link" href="project.html?id=${p.id}">Open →</a></div></div>`).join('') :
      '<div class="empty-state"><strong>No projects yet</strong>Create your first project to see progress here.<br><a class="text-link" href="projects.html#new-project">Create a project →</a></div>';
  } catch (e) { console.error(e); }
});
