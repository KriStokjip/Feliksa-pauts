const API = 'api.php';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  document.querySelectorAll('[data-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.toggle);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(show));
    });
  });

  async function api(action, body) {
    const response = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  function message(el, text, type) {
    el.textContent = text;
    el.className = 'message ' + (type || '');
  }

  const login = $('loginForm');
  if (login) login.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = $('loginMessage');
    const button = login.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('login', {username:$('loginUsername').value.trim(), password:$('loginPassword').value});
      location.href = 'dashboard.html';
    } catch (e) { message(msg, e.message, 'error'); }
    finally { button.disabled = false; }
  });

  const register = $('registerForm');
  if (register) register.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = $('registerMessage');
    const password = $('registerPassword').value;
    if (password !== $('confirmPassword').value) return message(msg, 'Passwords do not match.', 'error');
    const button = register.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('register', {
        username:$('registerUsername').value.trim(),
        email:$('registerEmail').value.trim(),
        password
      });
      message(msg, result.message, 'success');
      register.reset();
      setTimeout(() => location.href = 'login.html', 1000);
    } catch (e) { message(msg, e.message, 'error'); }
    finally { button.disabled = false; }
  });
});
