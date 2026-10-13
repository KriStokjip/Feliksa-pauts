document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow, $ = id => document.getElementById(id);
  const projectId = Number(new URLSearchParams(location.search).get('id'));
  let project = null, currentUser = null;
  try {
    currentUser = await T.requireLogin(); if (!currentUser) return;
    if (!projectId) throw new Error('Missing project ID.');
    await load();
  } catch (e) {
    $('projectHeader').innerHTML = `<div class="empty-state"><strong>Could not open project</strong>${T.escapeHTML(e.message)}<br><a class="text-link" href="projects.html">Return to projects</a></div>`;
  }

  async function load() {
    const data = await T.api('project',{query:'id='+encodeURIComponent(projectId)});
    project = data.project; draw();
  }
  function draw() {
    const owner = Number(project.owner_id) === Number(currentUser.id);
    $('projectHeader').innerHTML = `<div class="project-hero-top"><div><span class="priority priority-${project.priority}">${T.priorityLabel(project.priority)} priority</span><h1>${T.escapeHTML(project.name)}</h1><p class="muted">${T.escapeHTML(project.description||'No description yet.')}</p><div class="hero-meta"><span>Deadline: ${T.escapeHTML(T.dateLabel(project.deadline))}</span><span>·</span><span>${project.members.length} team member${project.members.length===1?'':'s'}</span></div></div><a class="btn btn-secondary" href="projects.html">All projects</a></div>`;
    $('progressNumber').textContent = project.progress+'%';
    $('progressBar').style.width = project.progress+'%';
    const done = project.tasks.filter(t=>t.status==='done').length;
    $('progressCaption').textContent = `${done} of ${project.tasks.length} tasks completed`;
    $('taskAssignee').innerHTML = '<option value="">Unassigned</option>' + project.members.map(m=>`<option value="${m.id}">${T.escapeHTML(m.username)}</option>`).join('');
    $('memberList').innerHTML = project.members.map(m=>`<div class="member-item"><span class="avatar">${T.escapeHTML(m.username.slice(0,2).toUpperCase())}</span><div class="member-name">${T.escapeHTML(m.username)}<div class="member-role">${m.role==='owner'?'Project owner':'Team member'}</div></div>${owner&&m.role!=='owner'?`<button class="remove-member" data-id="${m.id}" aria-label="Remove ${T.escapeHTML(m.username)}">Remove</button>`:''}</div>`).join('');
    $('editProjectButton').disabled = !owner; $('deleteProjectButton').disabled = !owner;
    $('showTaskForm').disabled = false;
    renderTasks();
    $('memberForm').classList.toggle('hidden',!owner);
    $('editProjectButton').onclick = () => {
      const q = new URLSearchParams({edit:String(project.id),name:project.name,description:project.description||'',deadline:project.deadline||'',priority:project.priority});
      location.href = 'projects.html?'+q.toString();
    };
    $('deleteProjectButton').onclick = async () => {
      if (!owner || !confirm('Delete this project and all its tasks? This cannot be undone.')) return;
      try { await T.api('delete-project',{method:'POST',body:{id:project.id}}); location.href='projects.html'; }
      catch(e) { alert(e.message); }
    };
    $('memberList').querySelectorAll('.remove-member').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Remove this member from the project?')) return;
      try { await T.api('remove-member',{method:'POST',body:{project_id:project.id,user_id:Number(b.dataset.id)}}); await load(); }
      catch(e) { T.showMessage($('memberMessage'),e.message,'error'); }
    }));
  }
  function renderTasks() {
    const status = $('taskStatusFilter').value, priority = $('taskPriorityFilter').value;
    const tasks = project.tasks.filter(t=>(status==='all'||t.status===status)&&(priority==='all'||t.priority===priority));
    $('taskList').innerHTML = tasks.length ? tasks.map(t=>`
      <div class="task-row ${t.status==='done'?'is-done':''}"><div class="task-main"><div class="task-title">${T.escapeHTML(t.title)}</div><div class="task-meta"><span class="status-pill status-${t.status}">${T.statusLabel(t.status)}</span><span>${T.escapeHTML(T.dateLabel(t.deadline))}</span><span>${t.assignee?'Assigned to '+T.escapeHTML(t.assignee):'Unassigned'}</span></div></div><span class="priority priority-${t.priority}">${T.priorityLabel(t.priority)}</span><div class="task-actions"><button class="icon-button edit-task" data-id="${t.id}" aria-label="Edit task">Edit</button><button class="icon-button delete-task" data-id="${t.id}" aria-label="Delete task">×</button></div></div>`).join('') :
      '<div class="empty-state"><strong>No tasks found</strong>Add a task or change your filters.</div>';
    $('taskList').querySelectorAll('.edit-task').forEach(b=>b.addEventListener('click',()=>openTask(project.tasks.find(t=>t.id===Number(b.dataset.id)))));
    $('taskList').querySelectorAll('.delete-task').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Delete this task?'))return;
      try{await T.api('delete-task',{method:'POST',body:{id:Number(b.dataset.id)}});await load();}
      catch(e){alert(e.message);}
    }));
  }
  function openTask(task=null) {
    $('taskForm').reset(); $('taskId').value=task?.id||'';
    $('taskTitle').value=task?.title||''; $('taskAssignee').value=task?.assignee_id||'';
    $('taskDeadline').value=task?.deadline||''; $('taskPriority').value=task?.priority||'medium'; $('taskStatus').value=task?.status||'todo';
    T.showMessage($('taskFormMessage'),''); $('taskFormPanel').classList.remove('hidden');
    $('taskFormPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  $('showTaskForm').addEventListener('click',()=>openTask());
  $('cancelTaskForm').addEventListener('click',()=>$('taskFormPanel').classList.add('hidden'));
  $('taskStatusFilter').addEventListener('change',renderTasks); $('taskPriorityFilter').addEventListener('change',renderTasks);
  $('taskForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try {
      await T.api('task',{method:'POST',body:{id:Number($('taskId').value)||0,project_id:projectId,title:$('taskTitle').value.trim(),assignee_id:$('taskAssignee').value,deadline:$('taskDeadline').value,priority:$('taskPriority').value,status:$('taskStatus').value}});
      $('taskFormPanel').classList.add('hidden'); await load();
    } catch(err){T.showMessage($('taskFormMessage'),err.message,'error');}
  });
  $('memberForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try{await T.api('members',{method:'POST',body:{project_id:projectId,username:$('memberName').value.trim()}});$('memberName').value='';T.showMessage($('memberMessage'),'Team member added.','success');await load();}
    catch(err){T.showMessage($('memberMessage'),err.message,'error');}
  });
});
