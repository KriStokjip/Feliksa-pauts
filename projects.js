document.addEventListener("DOMContentLoaded", function () {
  const T = window.TaskFlow;
  if (!T.currentUser()) return;
  T.ensureSeedProject();

  const formPanel = document.getElementById("projectFormPanel");
  const form = document.getElementById("projectForm");
  const message = document.getElementById("projectFormMessage");
  const grid = document.getElementById("projectGrid");
  const showButton = document.getElementById("showProjectForm");
  const search = document.getElementById("projectSearch");
  const priorityFilter = document.getElementById("priorityFilter");

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "message " + type;
  }
  function resetForm() {
    form.reset();
    document.getElementById("projectId").value = "";
    document.getElementById("projectFormTitle").textContent = "Create a project";
    showMessage("", "");
  }
  function openForm(project) {
    formPanel.classList.remove("hidden");
    if (project) {
      document.getElementById("projectFormTitle").textContent = "Edit project";
      document.getElementById("projectId").value = project.id;
      document.getElementById("projectName").value = project.name;
      document.getElementById("projectDescription").value = project.description || "";
      document.getElementById("projectDeadline").value = project.deadline || "";
      document.getElementById("projectPriority").value = project.priority || "medium";
      document.getElementById("projectMembers").value = (project.members || []).filter(name => name !== project.owner).join(", ");
    } else resetForm();
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  showButton.addEventListener("click", () => openForm(null));
  document.getElementById("cancelProjectForm").addEventListener("click", () => { formPanel.classList.add("hidden"); resetForm(); });
  document.getElementById("cancelProjectForm2").addEventListener("click", () => { formPanel.classList.add("hidden"); resetForm(); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const projects = T.getProjects();
    const id = document.getElementById("projectId").value;
    const name = document.getElementById("projectName").value.trim();
    if (!name) return showMessage("Please enter a project name.", "error");
    const description = document.getElementById("projectDescription").value.trim();
    const deadline = document.getElementById("projectDeadline").value;
    const priority = document.getElementById("projectPriority").value;
    const extraMembers = document.getElementById("projectMembers").value.split(",").map(x => x.trim()).filter(Boolean);
    const members = [...new Set([T.currentUser(), ...extraMembers])];

    if (id) {
      const project = projects.find(item => item.id === id && item.owner === T.currentUser());
      if (!project) return showMessage("You can only edit projects you own in this demo.", "error");
      Object.assign(project, { name, description, deadline, priority, members });
    } else {
      projects.unshift({ id: T.uid(), owner: T.currentUser(), name, description, deadline, priority, members, createdAt: new Date().toISOString(), tasks: [] });
    }
    T.saveProjects(projects);
    formPanel.classList.add("hidden");
    resetForm();
    render();
  });

  function render() {
    const projects = T.getProjects().filter(project =>
      project.owner === T.currentUser() || (project.members || []).includes(T.currentUser())
    );
    const query = search.value.trim().toLowerCase();
    const priority = priorityFilter.value;
    const filtered = projects.filter(project =>
      (project.name + " " + (project.description || "")).toLowerCase().includes(query) &&
      (priority === "all" || project.priority === priority)
    );
    document.getElementById("projectCount").textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"}`;
    grid.innerHTML = filtered.length ? filtered.map(project => {
      const pct = T.progress(project);
      const tasks = project.tasks || [];
      const members = (project.members || []).slice(0, 4);
      const avatars = members.map(name => `<span class="avatar" title="${T.escapeHTML(name)}">${T.escapeHTML(name.slice(0, 2).toUpperCase())}</span>`).join("");
      return `<article class="project-card">
        <div class="project-card-top"><h2>${T.escapeHTML(project.name)}</h2><span class="priority priority-${project.priority}">${T.priorityLabel(project.priority)}</span></div>
        <p class="project-description">${T.escapeHTML(project.description || "No description yet.")}</p>
        <div class="task-meta"><span>${tasks.length} task${tasks.length === 1 ? "" : "s"}</span><span>·</span><span>${T.escapeHTML(T.dateLabel(project.deadline))}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="project-card-foot"><span>${pct}% complete</span><div class="member-avatars">${avatars}</div></div>
        <div class="project-card-actions"><a class="btn btn-primary" href="project.html?id=${encodeURIComponent(project.id)}">Open project →</a><button class="btn btn-secondary edit-project" data-id="${T.escapeHTML(project.id)}">Edit</button></div>
      </article>`;
    }).join("") : '<div class="panel empty-state" style="grid-column:1/-1"><strong>No projects found</strong>Try another search or create a new project.</div>';

    grid.querySelectorAll(".edit-project").forEach(button => button.addEventListener("click", () => {
      const project = T.getProject(button.dataset.id);
      if (project && project.owner === T.currentUser()) openForm(project);
      else alert("Only the project owner can edit settings in this prototype.");
    }));
  }
  search.addEventListener("input", render);
  priorityFilter.addEventListener("change", render);
  if (window.location.hash === "#new-project") openForm(null);
  render();
});
