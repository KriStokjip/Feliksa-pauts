/** Mock-UI regression checks; no MySQL or webserver required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const base = path.join(__dirname, '..');
const escapeHTML = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function createPage(jsFile, responseFor) {
  const elements = {};
  let ready;
  const calls = [];
  const location = { replaced: null, replace(url) { this.replaced = url; } };
  const element = (id) => {
    if (elements[id]) return elements[id];
    const listeners = {};
    elements[id] = {
      value: '', innerHTML: '', textContent: '', disabled: false,
      listeners,
      addEventListener(name, handler) { listeners[name] = handler; },
      querySelector() { return { disabled: false }; },
      classList: { add() {}, remove() {}, contains() { return false; } },
      focus() {}, reset() {},
    };
    return elements[id];
  };
  const context = {
    Date, location, confirm: () => true,
    document: {
      addEventListener(name, handler) { if (name === 'DOMContentLoaded') ready = handler; },
      getElementById: element,
    },
    TaskFlow: {
      requireLogin: async () => ({ id: 6, username: 'alex' }),
      escapeHTML,
      dateLabel: (date) => date || 'No deadline',
      overdue: () => false,
      priorityLabel: (value) => value,
      statusLabel: (value) => value,
      showMessage(el, message) { el.textContent = message; },
      async api(action, opts) {
        calls.push({ action, opts });
        return responseFor(action, opts);
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(base, jsFile), 'utf8'), context);
  return { element, calls, location, ready: () => ready() };
}

(async () => {
  let saved = [];
  const taskPage = createPage('my-tasks.js', async (action, options) => {
    if (action === 'my-tasks') return { tasks: saved };
    if (action === 'personal-task') {
      saved = [{ id: 17, ...options.body }];
      return { ok: true };
    }
    if (action === 'delete-personal-task') {
      saved = [];
      return { ok: true };
    }
    throw new Error('Unexpected API action ' + action);
  });
  taskPage.element('personalStatusFilter').value = 'all';
  taskPage.element('personalPriorityFilter').value = 'all';
  taskPage.element('personalSort').value = 'deadline';
  await taskPage.ready();
  taskPage.element('personalTaskTitle').value = '<img onerror=alert(1)>';
  taskPage.element('personalTaskDescription').value = 'private description';
  taskPage.element('personalTaskPriority').value = 'high';
  taskPage.element('personalTaskStatus').value = 'todo';
  await taskPage.element('personalTaskForm').listeners.submit({ preventDefault() {} });
  assert.match(taskPage.element('personalTaskList').innerHTML, /&lt;img/);
  assert.doesNotMatch(taskPage.element('personalTaskList').innerHTML, /<img/);
  assert.equal(taskPage.calls.find((call) => call.action === 'personal-task').opts.body.description, 'private description');

  const profilePage = createPage('profile.js', async (action, opts) => {
    if (action === 'profile' && !opts) {
      return { profile: { username: 'fixed_name', email: 'x@example.com', first_name: 'Alex' } };
    }
    if (action === 'profile' && opts) return { message: 'First name updated.' };
    if (action === 'delete-account') return { ok: true };
    throw new Error('Unexpected API action');
  });
  await profilePage.ready();
  assert.equal(profilePage.element('profileUsername').value, 'fixed_name');
  profilePage.element('profileFirstName').value = 'Sasha';
  await profilePage.element('profileForm').listeners.submit({ preventDefault() {} });
  const edit = profilePage.calls.find((call) => call.action === 'profile' && call.opts);
  assert.equal(edit.opts.body.first_name, 'Sasha');
  assert.equal(Object.hasOwn(edit.opts.body, 'username'), false);
  profilePage.element('deleteAccountPassword').value = 'test-password';
  profilePage.element('deleteAccountConfirmation').value = 'DELETE';
  await profilePage.element('deleteAccountForm').listeners.submit({ preventDefault() {} });
  const del = profilePage.calls.find((call) => call.action === 'delete-account');
  assert.equal(del.opts.body.confirmation, 'DELETE');
  assert.equal(profilePage.location.replaced, 'login.html');

  // Important API ownership invariants: private task read/write/delete never
  // accept another user's owner ID from the browser.
  const api = fs.readFileSync(path.join(base, 'api.php'), 'utf8');
  assert.match(api, /FROM personal_tasks WHERE owner_id = \?/);
  assert.match(api, /DELETE FROM personal_tasks WHERE id = \? AND owner_id = \?/);
  assert.match(api, /password_verify\(\$password, \(string\) \$hash\)/);
  assert.match(api, /\$confirmation !== 'DELETE'/);
  console.log('Personal tasks and profile UI tests passed. (Mocked API.)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
