const TaskFlow = (() => {
  async function api(action, options = {}) {
    const url = `api.php?action=${encodeURIComponent(action)}${options.query ? '&' + options.query : ''}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {'Content-Type':'application/json'},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) location.href = 'login.html';
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function dateLabel(value) {
    if (!value) return 'No deadline';
    const d = new Date(value + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? 'No deadline' : d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
  }
  function overdue(date, status) {
    return Boolean(date && status !== 'done' && date < new Date().toISOString().slice(0,10));
  }
  const priorityLabel = p => ({high:'High',medium:'Medium',low:'Low'}[p] || 'Medium');
  const statusLabel = s => ({todo:'To do',doing:'In progress',done:'Completed'}[s] || 'To do');
  async function currentUser() {
    const data = await api('me');
    return data.user;
  }
  async function requireLogin() {
    const user = await currentUser();
    if (!user) { location.replace('login.html'); return null; }
    const greeting = document.getElementById('userGreeting');
    if (greeting) greeting.textContent = 'Hi, ' + user.username;
    const logout = document.getElementById('logoutButton');
    if (logout) logout.addEventListener('click', async () => {
      try { await api('logout',{method:'POST',body:{}}); } finally { location.href='login.html'; }
    });
    return user;
  }
  function showMessage(el, text, type='') {
    if (!el) return;
    el.textContent = text;
    el.className = 'message ' + type;
  }
  return {api, escapeHTML, dateLabel, overdue, priorityLabel, statusLabel, currentUser, requireLogin, showMessage};
})();
