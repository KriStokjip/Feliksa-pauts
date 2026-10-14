
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const calls = [];
const context = {
  URLSearchParams,
  Date,
  fetch: async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('action=csrf')) {
      return { ok: true, json: async () => ({ csrf_token: 'test-token' }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  },
  location: { replace: () => {} },
  document: { getElementById: () => null },
  alert: () => {},
};

vm.createContext(context);
const appSource = fs.readFileSync(path.join(__dirname, '..', 'javascript', 'app.js'), 'utf8');
vm.runInContext(`${appSource}\nthis.testTaskFlow = TaskFlow;`, context);

(async () => {
  const T = context.testTaskFlow;
  assert.equal(T.escapeHTML('<script>&"'), '&lt;script&gt;&amp;&quot;');
  assert.equal(T.overdue('2020-01-01', 'todo'), true);
  assert.equal(T.overdue('2020-01-01', 'done'), false);

  await T.api('leave-project', {
    method: 'POST',
    body: { project_id: 7 },
  });

  const request = calls.find((call) => call.url.includes('action=leave-project'));
  assert.ok(request, 'leave-project POST was issued');
  assert.equal(request.options.headers['X-CSRF-Token'], 'test-token');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(JSON.parse(request.options.body).project_id, 7);


  for (const [action, body] of [
    ['invite-member', { project_id: 7, username: 'alex' }],
    ['accept-invitation', { invitation_id: 12 }],
    ['decline-invitation', { invitation_id: 13 }],
    ['cancel-invitation', { project_id: 7, invitation_id: 14 }],
  ]) {
    await T.api(action, { method: 'POST', body });
    const request = calls.find((call) => call.url.includes(`action=${action}`));
    assert.ok(request, `${action} POST was issued`);
    assert.equal(request.options.headers['X-CSRF-Token'], 'test-token');
    assert.equal(request.options.credentials, 'same-origin');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), body);
  }

  console.log('Smoke tests passed. (No real PHP/MySQL connection was used.)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
