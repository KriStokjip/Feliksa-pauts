/** Shared API, authentication, and display utilities. */
const TaskFlow = (() => {
  let csrfToken = null;
  let csrfRequest = null;

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;

    if (!csrfRequest) {
      csrfRequest = fetch('api.php?action=csrf', { credentials: 'same-origin' })
        .then(async (response) => {
          if (!response.ok) throw new Error('Unable to initialize a secure request.');
          const data = await response.json();
          csrfToken = data.csrf_token;
          return csrfToken;
        })
        .finally(() => { csrfRequest = null; });
    }
    return csrfRequest;
  }

  async function api(action, options = {}) {
    const method = options.method || 'GET';
    const params = new URLSearchParams({ action });

    if (options.query) {
      new URLSearchParams(options.query).forEach((value, key) => params.append(key, value));
    }

    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = await getCsrfToken();
    }

    const response = await fetch(`api.php?${params}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: method === 'GET' ? undefined : JSON.stringify(options.body || {}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        location.replace('login.html');
      }
      throw new Error(data.error || 'Request failed. Please try again.');
    }

    if (data.csrf_token) csrfToken = data.csrf_token;
    return data;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function dateLabel(value) {
    if (!value) return 'No deadline';

    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? 'Invalid deadline'
      : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  }

  function overdue(date, status) {
    if (!date || status === 'done') return false;

    const now = new Date();
    const localToday = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    return date < localToday;
  }

  const priorityLabel = (priority) => ({
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  })[priority] || 'Medium';

  const statusLabel = (status) => ({
    todo: 'To do',
    doing: 'In progress',
    done: 'Completed',
  })[status] || 'To do';

  async function currentUser() {
    const data = await api('me');
    return data.user;
  }

  async function requireLogin() {
    const user = await currentUser();
    if (!user) {
      location.replace('login.html');
      return null;
    }

    const greeting = document.getElementById('userGreeting');
    if (greeting) greeting.textContent = `Hi, ${user.username}`;

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;
        try {
          await api('logout', { method: 'POST' });
          csrfToken = null;
          location.replace('login.html');
        } catch (error) {
          alert(`Could not log out: ${error.message}`);
          logoutButton.disabled = false;
        }
      });
    }

    return user;
  }

  function showMessage(element, message, type = '') {
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`;
  }

  return {
    api,
    escapeHTML,
    dateLabel,
    overdue,
    priorityLabel,
    statusLabel,
    currentUser,
    requireLogin,
    showMessage,
  };
})();
