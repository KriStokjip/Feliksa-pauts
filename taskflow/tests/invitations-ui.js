/** UI-level invitation behavior test with a small fake DOM (no external packages). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const handlers = {};
const elements = Object.fromEntries(
  ['invitationsList', 'invitationsError', 'invitationsNotice', 'invitationCount']
    .map((id) => [id, {
      innerHTML: '',
      textContent: '',
      addEventListener(name, callback) { handlers[name] = callback; },
    }]),
);
let ready;
let pending = [{
  id: 5,
  project_id: 12,
  project_name: '<script>alert(1)</script>',
  project_description: 'A shared project',
  invited_by: 'owner',
  created_at: '2026-10-13 08:00:00',
}];
const calls = [];
const location = { href: '' };
const context = {
  Date,
  location,
  confirm: () => true,
  document: {
    addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; },
    getElementById(id) { return elements[id]; },
  },
  TaskFlow: {
    requireLogin: async () => ({ id: 19 }),
    escapeHTML: (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]),
    api: async (action, options) => {
      calls.push({ action, options });
      if (action === 'invitations') return { invitations: pending };
      if (action === 'accept-invitation') return { project_id: 12 };
      if (action === 'decline-invitation') {
        pending = [];
        return { ok: true };
      }
      throw new Error(`Unexpected action: ${action}`);
    },
    showMessage: (element, message) => { element.textContent = message; },
  },
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'invitations.js'), 'utf8'), context);

function clickButton(actionClass) {
  const buttons = [{ disabled: false }, { disabled: false }];
  const card = { querySelectorAll: () => buttons };
  const target = {
    classList: { contains: (name) => name === actionClass },
    dataset: { id: '5' },
    closest(selector) { return selector.includes('button') ? this : card; },
  };
  return handlers.click({ target });
}

(async () => {
  await ready();
  assert.match(elements.invitationsList.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(elements.invitationsList.innerHTML, /<script>/);
  assert.equal(elements.invitationCount.textContent, '1 pending');

  await clickButton('accept-invitation');
  assert.equal(location.href, 'project.html?id=12');
  assert.equal(calls.at(-1).action, 'accept-invitation');
  assert.equal(calls.at(-1).options.body.invitation_id, 5);

  location.href = '';
  await clickButton('decline-invitation');
  assert.equal(location.href, '');
  assert.equal(elements.invitationCount.textContent, '0 pending');
  assert.match(elements.invitationsList.innerHTML, /No pending invitations/);
  assert.equal(elements.invitationsNotice.textContent, 'Invitation declined.');

  console.log('Invitation UI tests passed. (Mocked API; no PHP/MySQL connection.)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
