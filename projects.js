/** Project listing, creation, editing, and voluntary team departures. */
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);
  const panel = get('projectFormPanel');
  const form = get('projectForm');
  const grid = get('projectGrid');

  let projects = [];
  let editingId = 0;

  function openForm(project = null) {
    editingId = project ? Number(project.id) : 0;
    form.reset();

    get('projectFormTitle').textContent = project ? 'Edit project' : 'Create a project';
    get('projectId').value = editingId || '';
    get('projectName').value = project?.name || '';
    get('projectDescription').value = project?.description || '';
    get('projectDeadline').value = project?.deadline || '';
    get('projectPriority').value = project?.priority || 'medium';

    T.showMessage(get('projectFormMessage'), '');
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function draw() {
    const search = get('projectSearch').value.trim().toLowerCase();
    const priority = get('priorityFilter').value;
    const filtered = projects.filter((project) => (
      `${project.name} ${project.description || ''}`.toLowerCase().includes(search)
      && (priority === 'all' || project.priority === priority)
    ));

    get('projectCount').textContent = `${filtered.length} project${filtered.length === 1 ? '' : 's'}`;
    grid.innerHTML = filtered.length
      ? filtered.map((project) => `
          <article class="project-card">
            <div class="project-card-top">
              <h2>${T.escapeHTML(project.name)}</h2>
              <span class="priority priority-${project.priority}">${T.priorityLabel(project.priority)}</span>
            </div>
            <p class="project-description">${T.escapeHTML(project.description || 'No description yet.')}</p>
            <div class="task-meta">
              <span>${project.task_count} task${project.task_count === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>${T.escapeHTML(T.dateLabel(project.deadline))}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${project.progress}%"></div>
            </div>
            <div class="project-card-foot">
              <span>${project.progress}% complete</span>
              <span>${project.member_count} member${project.member_count === 1 ? '' : 's'}</span>
            </div>
            <div class="project-card-actions">
              <a class="btn btn-primary" href="project.html?id=${project.id}">Open project →</a>
              ${project.role === 'owner'
                ? `<button class="btn btn-secondary edit-project" data-id="${project.id}">Edit</button>`
                : `<button class="btn btn-secondary leave-project" data-id="${project.id}">Leave</button>`}
            </div>
          </article>
        `).join('')
      : `<div class="panel empty-state no-projects">
           <strong>No projects found</strong>
           Try another search or create a new project.
         </div>`;

    grid.querySelectorAll('.edit-project').forEach((button) => {
      button.addEventListener('click', () => {
        const project = projects.find((item) => item.id === Number(button.dataset.id));
        if (project && project.role === 'owner') openForm(project);
      });
    });

    grid.querySelectorAll('.leave-project').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.id);
        const project = projects.find((item) => item.id === id);
        if (!project || project.role === 'owner') return;
        if (!confirm(`Leave "${project.name}"? Your assigned tasks will become unassigned.`)) return;

        button.disabled = true;
        try {
          await T.api('leave-project', { method: 'POST', body: { project_id: id } });
          await render();
        } catch (error) {
          T.showMessage(get('projectsError'), error.message, 'error');
          button.disabled = false;
        }
      });
    });
  }

  async function render() {
    const data = await T.api('projects');
    projects = data.projects;
    draw();
  }

  get('showProjectForm').addEventListener('click', () => openForm());
  get('cancelProjectForm').addEventListener('click', () => {
    panel.classList.add('hidden');
    form.reset();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;

    try {
      await T.api('project', {
        method: 'POST',
        body: {
          id: editingId,
          name: get('projectName').value.trim(),
          description: get('projectDescription').value.trim(),
          deadline: get('projectDeadline').value,
          priority: get('projectPriority').value,
        },
      });
      panel.classList.add('hidden');
      form.reset();
      T.showMessage(get('projectsError'), '');
      await render();
    } catch (error) {
      T.showMessage(get('projectFormMessage'), error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  get('projectSearch').addEventListener('input', draw);
  get('priorityFilter').addEventListener('change', draw);

  try {
    if (!await T.requireLogin()) return;
    await render();

    // Only accept an edit ID from the URL; load actual data from the API.
    const editParam = new URLSearchParams(location.search).get('edit');
    if (editParam !== null) {
      const id = Number(editParam);
      const project = projects.find((item) => item.id === id && item.role === 'owner');
      if (project) {
        openForm(project);
      } else {
        T.showMessage(get('projectsError'), 'Project not found or you cannot edit it.', 'error');
      }
    } else if (location.hash === '#new-project') {
      openForm();
    }
  } catch (error) {
    T.showMessage(get('projectsError'), error.message, 'error');
    get('projectCount').textContent = 'Could not load projects';
  }
});
