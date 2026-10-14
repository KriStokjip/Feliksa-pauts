
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

    const hero = T.cloneTemplate('projectHeroTemplate');
    const badge = hero.querySelector('.hero-priority');
    badge.textContent = `${T.priorityLabel(project.priority)} priority`;
    badge.classList.add(`priority-${project.priority}`);
    hero.querySelector('.hero-name').textContent = project.name;
    hero.querySelector('.hero-description').textContent = project.description || 'No description yet.';
    hero.querySelector('.hero-deadline').textContent = `Deadline: ${T.dateLabel(project.deadline)}`;
    hero.querySelector('.hero-members').textContent = `${memberCount} team member${memberCount === 1 ? '' : 's'}`;
    get('projectHeader').replaceChildren(hero);

    const completed = project.tasks.filter((task) => task.status === 'done').length;
    get('progressNumber').textContent = `${project.progress}%`;
    get('progressBar').style.width = `${project.progress}%`;
    get('progressCaption').textContent = `${completed} of ${project.tasks.length} tasks completed`;

    const assignee = get('taskAssignee');
    assignee.replaceChildren(new Option('Unassigned', ''), ...project.members.map((member) =>
      new Option(member.username, String(member.id))));

    const memberElements = project.members.map((member) => {
      const card = T.cloneTemplate('projectMemberTemplate');
      card.querySelector('.avatar').textContent = member.username.slice(0, 2).toUpperCase();
      card.querySelector('.member-username').textContent = member.username;
      card.querySelector('.member-role').textContent = member.role === 'owner' ? 'Project owner' : 'Team member';
      const removeButton = card.querySelector('.remove-member');
      if (owner && member.role !== 'owner') {
        removeButton.dataset.id = String(member.id);
        removeButton.setAttribute('aria-label', `Remove ${member.username}`);
      } else {
        removeButton.remove();
      }
      return card;
    });
    get('memberList').replaceChildren(...memberElements);

    get('pendingInvitations').classList.toggle('hidden', !owner);
    if (owner) {
      const invitations = project.pending_invitations || [];
      const pending = invitations.map((invite) => {
        const card = T.cloneTemplate('pendingInviteTemplate');
        card.querySelector('.pending-username').textContent = invite.username;
        const button = card.querySelector('.cancel-invite');
        button.dataset.id = String(invite.id);
        button.setAttribute('aria-label', `Cancel invitation for ${invite.username}`);
        return card;
      });
      get('pendingInviteList').replaceChildren(...(pending.length
        ? pending : [T.emptyState('No pending invitations', '')]));

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

    const cards = tasks.map((task) => {
      const card = T.cloneTemplate('projectTaskTemplate');
      card.classList.toggle('is-done', task.status === 'done');
      card.querySelector('.task-title').textContent = task.title;
      const description = card.querySelector('.task-description');
      description.textContent = task.description || '';
      description.hidden = !task.description;
      const badge = card.querySelector('.status-pill');
      badge.textContent = T.statusLabel(task.status);
      badge.classList.add(`status-${task.status}`);
      const deadline = card.querySelector('.task-deadline');
      deadline.textContent = T.dateLabel(task.deadline);
      deadline.classList.toggle('overdue', T.overdue(task.deadline, task.status));
      card.querySelector('.task-assignee').textContent = task.assignee
        ? `Assigned to ${task.assignee}` : 'Unassigned';
      const priority = card.querySelector('.priority');
      priority.textContent = T.priorityLabel(task.priority);
      priority.classList.add(`priority-${task.priority}`);
      card.querySelectorAll('.edit-task, .delete-task').forEach((button) => {
        button.dataset.id = String(task.id);
      });
      return card;
    });
    get('taskList').replaceChildren(...(cards.length
      ? cards : [T.emptyState('No tasks found', 'Add a task or change your filters.')]));

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
    get('taskDescription').value = task?.description || '';
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
          description: get('taskDescription').value.trim(),
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
    const errorPanel = T.cloneTemplate('projectErrorTemplate');
    errorPanel.querySelector('.project-error-message').textContent = error.message;
    get('projectHeader').replaceChildren(errorPanel);
    get('projectWorkGrid').classList.add('hidden');
  }
});
