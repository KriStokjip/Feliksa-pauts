
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeCard() {
  const parts = new Map();
  const child = (key) => {
    if (!parts.has(key)) parts.set(key, { textContent: '', dataset: {}, disabled: false });
    return parts.get(key);
  };
  return {
    dataset: {},
    querySelector: child,
    querySelectorAll: (selectors) => selectors === 'button'
      ? [child('.accept-invitation'), child('.decline-invitation')]
      : [child('.accept-invitation'), child('.decline-invitation')],
    get part() { return child; },
  };
}

const events = {};
const elements = Object.fromEntries(
  ['invitationsList', 'invitationsError', 'invitationsNotice', 'invitationCount'].map((id) => [id, {
    textContent: '',
    children: [],
    replaceChildren(...items) { this.children = items; },
    addEventListener(name, callback) { events[name] = callback; },
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
    cloneTemplate: (name) => {
      assert.equal(name, 'invitationCardTemplate');
      return makeCard();
    },
    emptyState: (title, description) => ({ title, description }),
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
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'javascript', 'invitations.js'), 'utf8'), context);

function clickButton(actionClass) {
  const card = elements.invitationsList.children[0];
  const target = card.part(`.${actionClass}`);
  target.classList = { contains: (name) => name === actionClass };
  target.dataset.id = '5';
  target.closest = (selector) => selector.includes('button') ? target : card;
  return events.click({ target });
}

(async () => {
  await ready();
  assert.equal(elements.invitationCount.textContent, '1 pending');
  const card = elements.invitationsList.children[0];
  assert.equal(card.part('.invitation-project').textContent, '<script>alert(1)</script>');

  await clickButton('accept-invitation');
  assert.equal(location.href, 'project.html?id=12');
  assert.equal(calls.at(-1).action, 'accept-invitation');
  assert.equal(calls.at(-1).options.body.invitation_id, 5);

  location.href = '';
  await clickButton('decline-invitation');
  assert.equal(location.href, '');
  assert.equal(elements.invitationCount.textContent, '0 pending');
  assert.equal(elements.invitationsList.children[0].title, 'No pending invitations');
  assert.equal(elements.invitationsNotice.textContent, 'Invitation declined.');

  console.log('Invitation UI tests passed. (Mocked API; no PHP/MySQL connection.)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
