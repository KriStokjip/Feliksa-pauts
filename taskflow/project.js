/** Project details, tasks, team management, and leave-project action. */
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);
  const projectId = Number(new URLSearchParams(location.search).get('id'));

  let project = null;
  let currentUser = null;

  async function load() {
    const data = await T.api('project', { query: `id=${encodeURIComponent(projectId)}` });
    project = data.project;
    draw();
  }

  function draw() {
    const owner = Number(project.owner_id) === Number(currentUser.id);
    const memberCount = project.members.length;

    get('projectHeader').innerHTML = `
      <div class="project-hero-top">
        <div>
          <span class="priority priority-${project.priority}">
            ${T.priorityLabel(project.priority)} priority
          </span>
          <h1>${T.escapeHTML(project.name)}</h1>
          <p class="muted">${T.escapeHTML(project.description || 'No description yet.')}</p>
          <div class="hero-meta">
            <span>Deadline: ${T.escapeHTML(T.dateLabel(project.deadline))}</span>
            <span>·</span>
            <span>${memberCount} team member${memberCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <a class="btn btn-secondary" href="projects.html">All projects</a>
      </div>`;

    const completed = project.tasks.filter((task) => task.status === 'done').length;
    get('progressNumber').textContent = `${project.progress}%`;
    get('progressBar').style.width = `${project.progress}%`;
    get('progressCaption').textContent = `${completed} of ${project.tasks.length} tasks completed`;

    get('taskAssignee').innerHTML = '<option value="">Unassigned</option>'
      + project.members.map((member) => `
          <option value="${member.id}">${T.escapeHTML(member.username)}</option>
        `).join('');

    get('memberList').innerHTML = project.members.map((member) => `
      <div class="member-item">
        <span class="avatar">${T.escapeHTML(member.username.slice(0, 2).toUpperCase())}</span>
        <div class="member-name">
          ${T.escapeHTML(member.username)}
          <div class="member-role">${member.role === 'owner' ? 'Project owner' : 'Team member'}</div>
        </div>
        ${owner && member.role !== 'owner'
          ? `<button class="remove-member" data-id="${member.id}" aria-label="Remove ${T.escapeHTML(member.username)}">Remove</button>`
          : ''}
      </div>`).join('');

    get('pendingInvitations').classList.toggle('hidden', !owner);
    if (owner) {
      const invitations = project.pending_invitations || [];
      get('pendingInviteList').innerHTML = invitations.length
        ? invitations.map((invite) => `
            <div class="pending-invite-item">
              <span>${T.escapeHTML(invite.username)} <span class="pending-label">Pending</span></span>
              <button type="button" class="remove-member cancel-invite" data-id="${invite.id}"
                aria-label="Cancel invitation for ${T.escapeHTML(invite.username)}">Cancel</button>
            </div>
          `).join('')
        : '<p class="muted">No pending invitations.</p>';

      get('pendingInviteList').querySelectorAll('.cancel-invite').forEach((button) => {
        button.addEventListener('click', async () => {
          if (!confirm('Cancel this invitation?')) return;
          button.disabled = true;
          try {
            await T.api('cancel-invitation', {
              method: 'POST',
              body: { project_id: project.id, invitation_id: Number(button.dataset.id) },
            });
            await load();
            T.showMessage(get('memberMessage'), 'Invitation cancelled.', 'success');
          } catch (error) {
            T.showMessage(get('memberMessage'), error.message, 'error');
            button.disabled = false;
          }
        });
      });
    }

    get('memberForm').classList.toggle('hidden', !owner);
    get('ownerSettings').classList.toggle('hidden', !owner);
    get('leaveProjectPanel').classList.toggle('hidden', owner);
    renderTasks();

    get('memberList').querySelectorAll('.remove-member').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Remove this member? Their assigned tasks will become unassigned.')) return;
        button.disabled = true;

        try {
          await T.api('remove-member', {
            method: 'POST',
            body: {
              project_id: project.id,
              user_id: Number(button.dataset.id),
            },
          });
          await load();
        } catch (error) {
          T.showMessage(get('memberMessage'), error.message, 'error');
          button.disabled = false;
        }
      });
    });
  }

  function renderTasks() {
    const status = get('taskStatusFilter').value;
    const priority = get('taskPriorityFilter').value;
    const tasks = project.tasks.filter((task) => (
      (status === 'all' || task.status === status)
      && (priority === 'all' || task.priority === priority)
    ));

    get('taskList').innerHTML = tasks.length
      ? tasks.map((task) => `
          <div class="task-row ${task.status === 'done' ? 'is-done' : ''}">
            <div class="task-main">
              <div class="task-title">${T.escapeHTML(task.title)}</div>
              <div class="task-meta">
                <span class="status-pill status-${task.status}">${T.statusLabel(task.status)}</span>
                <span class="${T.overdue(task.deadline, task.status) ? 'task-deadline overdue' : ''}">
                  ${T.escapeHTML(T.dateLabel(task.deadline))}
                </span>
                <span>${task.assignee ? `Assigned to ${T.escapeHTML(task.assignee)}` : 'Unassigned'}</span>
              </div>
            </div>
            <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
            <div class="task-actions">
              <button class="icon-button edit-task" data-id="${task.id}" aria-label="Edit task">Edit</button>
              <button class="icon-button delete-task" data-id="${task.id}" aria-label="Delete task">×</button>
            </div>
          </div>`).join('')
      : `<div class="empty-state">
           <strong>No tasks found</strong>
           Add a task or change your filters.
         </div>`;

    get('taskList').querySelectorAll('.edit-task').forEach((button) => {
      button.addEventListener('click', () => {
        const task = project.tasks.find((item) => item.id === Number(button.dataset.id));
        if (task) openTask(task);
      });
    });

    get('taskList').querySelectorAll('.delete-task').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this task?')) return;
        button.disabled = true;
        try {
          await T.api('delete-task', {
            method: 'POST',
            body: { id: Number(button.dataset.id) },
          });
          await load();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      });
    });
  }

  function openTask(task = null) {
    get('taskForm').reset();
    get('taskId').value = task?.id || '';
    get('taskTitle').value = task?.title || '';
    get('taskAssignee').value = task?.assignee_id || '';
    get('taskDeadline').value = task?.deadline || '';
    get('taskPriority').value = task?.priority || 'medium';
    get('taskStatus').value = task?.status || 'todo';

    T.showMessage(get('taskFormMessage'), '');
    get('taskFormPanel').classList.remove('hidden');
    get('taskFormPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  get('showTaskForm').addEventListener('click', () => openTask());
  get('cancelTaskForm').addEventListener('click', () => get('taskFormPanel').classList.add('hidden'));
  get('taskStatusFilter').addEventListener('change', () => { if (project) renderTasks(); });
  get('taskPriorityFilter').addEventListener('change', () => { if (project) renderTasks(); });

  get('taskForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = get('taskForm').querySelector('[type="submit"]');
    button.disabled = true;

    try {
      await T.api('task', {
        method: 'POST',
        body: {
          id: Number(get('taskId').value) || 0,
          project_id: projectId,
          title: get('taskTitle').value.trim(),
          assignee_id: get('taskAssignee').value,
          deadline: get('taskDeadline').value,
          priority: get('taskPriority').value,
          status: get('taskStatus').value,
        },
      });
      get('taskFormPanel').classList.add('hidden');
      await load();
    } catch (error) {
      T.showMessage(get('taskFormMessage'), error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  get('memberForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = get('memberForm').querySelector('[type="submit"]');
    button.disabled = true;

    try {
      await T.api('invite-member', {
        method: 'POST',
        body: { project_id: projectId, username: get('memberName').value.trim() },
      });
      get('memberName').value = '';
      T.showMessage(get('memberMessage'), 'Invitation sent. They will join when they accept.', 'success');
      await load();
    } catch (error) {
      T.showMessage(get('memberMessage'), error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  get('editProjectButton').addEventListener('click', () => {
    if (project && project.owner_id === currentUser.id) {
      location.href = `projects.html?edit=${encodeURIComponent(project.id)}`;
    }
  });

  get('deleteProjectButton').addEventListener('click', async () => {
    if (!project || project.owner_id !== currentUser.id) return;
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;

    try {
      await T.api('delete-project', { method: 'POST', body: { id: project.id } });
      location.href = 'projects.html';
    } catch (error) {
      alert(error.message);
    }
  });

  get('leaveProjectButton').addEventListener('click', async () => {
    if (!project || project.owner_id === currentUser.id) return;
    if (!confirm(`Leave "${project.name}"? Your assigned tasks will become unassigned.`)) return;

    const button = get('leaveProjectButton');
    button.disabled = true;
    try {
      await T.api('leave-project', {
        method: 'POST',
        body: { project_id: project.id },
      });
      location.replace('projects.html');
    } catch (error) {
      T.showMessage(get('leaveProjectMessage'), error.message, 'error');
      button.disabled = false;
    }
  });

  try {
    currentUser = await T.requireLogin();
    if (!currentUser) return;

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new Error('Missing or invalid project ID.');
    }
    await load();
  } catch (error) {
    get('projectHeader').innerHTML = `
      <div class="empty-state">
        <strong>Could not open project</strong>
        ${T.escapeHTML(error.message)}
        <a class="text-link" href="projects.html">Return to projects</a>
      </div>`;
    get('projectWorkGrid').classList.add('hidden');
  }
});
