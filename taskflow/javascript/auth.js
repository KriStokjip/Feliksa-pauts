
document.addEventListener('DOMContentLoaded', () => {
  const get = (id) => document.getElementById(id);
  let csrfToken = null;

  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = get(button.dataset.toggle);
      if (!input) return;

      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(show));
    });
  });

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const response = await fetch('api.php?action=csrf', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.csrf_token) {
      throw new Error(data.error || 'Could not start a secure session.');
    }
    csrfToken = data.csrf_token;
    return csrfToken;
  }

  async function api(action, body) {
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': await getCsrfToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) csrfToken = null;
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }

  function message(element, text, type = '') {
    element.textContent = text;
    element.className = `message ${type}`;
  }

  const login = get('loginForm');
  if (login) {
    login.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = login.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        await api('login', {
          username: get('loginUsername').value.trim(),
          password: get('loginPassword').value,
        });
        location.replace('dashboard.html');
      } catch (error) {
        message(get('loginMessage'), error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  const registration = get('registerForm');
  if (registration) {
    registration.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = get('registerPassword').value;

      if (password !== get('confirmPassword').value) {
        message(get('registerMessage'), 'Passwords do not match.', 'error');
        return;
      }

      const button = registration.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        const result = await api('register', {
          username: get('registerUsername').value.trim(),
          first_name: get('registerFirstName').value.trim(),
          email: get('registerEmail').value.trim(),
          password,
        });
        message(get('registerMessage'), result.message, 'success');
        registration.reset();
        setTimeout(() => location.replace('login.html'), 1200);
      } catch (error) {
        message(get('registerMessage'), error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }
});
