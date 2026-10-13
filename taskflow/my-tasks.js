/** User-owned private tasks, unrelated to project membership. */
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);
  let tasks = [];

  const priorityRank = { high: 0, medium: 1, low: 2 };
  const byDeadline = (a, b) => (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31');

  async function load() {
    const data = await T.api('my-tasks');
    tasks = data.tasks;
    draw();
  }

  function draw() {
    const status = get('personalStatusFilter').value;
    const priority = get('personalPriorityFilter').value;
    const sort = get('personalSort').value;
    const visible = tasks.filter((task) => {
      const statusMatches = status === 'all' || (status === 'open' ? task.status !== 'done' : task.status === 'done');
      return statusMatches && (priority === 'all' || task.priority === priority);
    });

    visible.sort((a, b) => {
      if (sort === 'newest') return b.id - a.id;
      if (sort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || byDeadline(a, b);
      return byDeadline(a, b) || priorityRank[a.priority] - priorityRank[b.priority];
    });

    get('personalTaskCount').textContent = `${visible.length} of ${tasks.length} personal task(s)`;
    get('personalTaskList').innerHTML = visible.length
      ? visible.map((task) => `
          <div class="task-row ${task.status === 'done' ? 'is-done' : ''}">
            <div class="task-main">
              <div class="task-title">${T.escapeHTML(task.title)}</div>
              ${task.description ? `<p class="task-description">${T.escapeHTML(task.description)}</p>` : ''}
              <div class="task-meta">
                <span class="status-pill status-${task.status}">${T.statusLabel(task.status)}</span>
                <span class="${T.overdue(task.deadline, task.status) ? 'task-deadline overdue' : ''}">
                  ${T.escapeHTML(T.dateLabel(task.deadline))}
                </span>
              </div>
            </div>
            <span class="priority priority-${task.priority}">${T.priorityLabel(task.priority)}</span>
            <div class="task-actions">
              <button type="button" class="icon-button toggle-personal" data-id="${task.id}">
                ${task.status === 'done' ? 'Reopen' : 'Complete'}
              </button>
              <button type="button" class="icon-button edit-personal" data-id="${task.id}">Edit</button>
              <button type="button" class="icon-button delete-personal" data-id="${task.id}">Delete</button>
            </div>
          </div>
        `).join('')
      : '<div class="empty-state"><strong>No matching tasks</strong>Try a different filter or create your first personal task.</div>';
  }

  function openForm(task = null) {
    get('personalTaskForm').reset();
    get('personalTaskFormTitle').textContent = task ? 'Edit personal task' : 'New personal task';
    get('personalTaskId').value = task?.id || '';
    get('personalTaskTitle').value = task?.title || '';
    get('personalTaskDescription').value = task?.description || '';
    get('personalTaskDeadline').value = task?.deadline || '';
    get('personalTaskPriority').value = task?.priority || 'medium';
    get('personalTaskStatus').value = task?.status || 'todo';
    T.showMessage(get('personalTaskFormMessage'), '');
    get('personalTaskFormPanel').classList.remove('hidden');
    get('personalTaskTitle').focus();
  }

  get('showPersonalTaskForm').addEventListener('click', () => openForm());
  get('cancelPersonalTaskForm').addEventListener('click', () => get('personalTaskFormPanel').classList.add('hidden'));
  ['personalStatusFilter', 'personalPriorityFilter', 'personalSort'].forEach((id) => {
    get(id).addEventListener('change', draw);
  });

  get('personalTaskForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = get('personalTaskForm').querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await T.api('personal-task', {
        method: 'POST',
        body: {
          id: Number(get('personalTaskId').value) || 0,
          title: get('personalTaskTitle').value.trim(),
          description: get('personalTaskDescription').value.trim(),
          deadline: get('personalTaskDeadline').value,
          priority: get('personalTaskPriority').value,
          status: get('personalTaskStatus').value,
        },
      });
      get('personalTaskFormPanel').classList.add('hidden');
      await load();
    } catch (error) {
      T.showMessage(get('personalTaskFormMessage'), error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  // One delegated listener works after every list re-render.
  get('personalTaskList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button || button.disabled) return;
    const task = tasks.find((item) => item.id === Number(button.dataset.id));
    if (!task) return;
    if (button.classList.contains('edit-personal')) {
      openForm(task);
      return;
    }
    if (button.classList.contains('delete-personal') && !confirm(`Delete "${task.title}" permanently?`)) return;

    button.disabled = true;
    try {
      if (button.classList.contains('delete-personal')) {
        await T.api('delete-personal-task', { method: 'POST', body: { id: task.id } });
      } else if (button.classList.contains('toggle-personal')) {
        await T.api('personal-task', {
          method: 'POST',
          body: {
            ...task,
            description: task.description || '',
            deadline: task.deadline || '',
            status: task.status === 'done' ? 'todo' : 'done',
          },
        });
      }
      await load();
      T.showMessage(get('personalTasksError'), '');
    } catch (error) {
      T.showMessage(get('personalTasksError'), error.message, 'error');
      button.disabled = false;
    }
  });

  try {
    if (!await T.requireLogin()) return;
    await load();
  } catch (error) {
    T.showMessage(get('personalTasksError'), error.message, 'error');
  }
});
