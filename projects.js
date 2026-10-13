document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const $ = id => document.getElementById(id);
  const panel = $('projectFormPanel'), form = $('projectForm'), grid = $('projectGrid');
  let projects = [], editingId = 0;
  try { if (!await T.requireLogin()) return; await render(); }
  catch (e) { T.showMessage($('projectFormMessage'),e.message,'error'); }

  function openForm(project = null) {
    editingId = project ? Number(project.id) : 0;
    form.reset();
    $('projectFormTitle').textContent = project ? 'Edit project' : 'Create a project';
    $('projectId').value = editingId || '';
    $('projectName').value = project?.name || '';
    $('projectDescription').value = project?.description || '';
    $('projectDeadline').value = project?.deadline || '';
    $('projectPriority').value = project?.priority || 'medium';
    T.showMessage($('projectFormMessage'),'');
    panel.classList.remove('hidden');
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('showProjectForm').addEventListener('click', () => openForm());
  $('cancelProjectForm').addEventListener('click', () => {panel.classList.add('hidden');form.reset();});
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await T.api('project',{method:'POST',body:{
        id:editingId || 0,name:$('projectName').value.trim(),description:$('projectDescription').value.trim(),
        deadline:$('projectDeadline').value,priority:$('projectPriority').value
      }});
      panel.classList.add('hidden'); form.reset(); await render();
    } catch (err) { T.showMessage($('projectFormMessage'),err.message,'error'); }
  });
  $('projectSearch').addEventListener('input', draw);
  $('priorityFilter').addEventListener('change', draw);

  async function render() { const data = await T.api('projects'); projects = data.projects; draw(); }
  function draw() {
    const q = $('projectSearch').value.trim().toLowerCase(), priority = $('priorityFilter').value;
    const list = projects.filter(p => (p.name+' '+(p.description||'')).toLowerCase().includes(q) && (priority==='all'||p.priority===priority));
    $('projectCount').textContent = `${list.length} project${list.length===1?'':'s'}`;
    grid.innerHTML = list.length ? list.map(p => `
      <article class="project-card"><div class="project-card-top"><h2>${T.escapeHTML(p.name)}</h2><span class="priority priority-${p.priority}">${T.priorityLabel(p.priority)}</span></div>
      <p class="project-description">${T.escapeHTML(p.description||'No description yet.')}</p>
      <div class="task-meta"><span>${p.task_count} task${p.task_count===1?'':'s'}</span><span>·</span><span>${T.escapeHTML(T.dateLabel(p.deadline))}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${p.progress}%"></div></div>
      <div class="project-card-foot"><span>${p.progress}% complete</span><span>${p.member_count} member${p.member_count===1?'':'s'}</span></div>
      <div class="project-card-actions"><a class="btn btn-primary" href="project.html?id=${p.id}">Open project →</a>
      ${p.role==='owner'?`<button class="btn btn-secondary edit-project" data-id="${p.id}">Edit</button>`:''}</div></article>`).join('') :
      '<div class="panel empty-state" style="grid-column:1/-1"><strong>No projects found</strong>Try another search or create a new project.</div>';
    grid.querySelectorAll('.edit-project').forEach(b => b.addEventListener('click', () => openForm(projects.find(p=>p.id===Number(b.dataset.id)))));
  }
  if (location.hash === '#new-project') openForm();
});
