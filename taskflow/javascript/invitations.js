
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);
  const list = get('invitationsList');

  function dateSent(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  }

  async function load() {
    const response = await T.api('invitations');
    const invitations = response.invitations;

    get('invitationCount').textContent = `${invitations.length} pending`;
    const cards = invitations.map((invite) => {
      const card = T.cloneTemplate('invitationCardTemplate');
      card.dataset.id = String(invite.id);
      card.querySelector('.invitation-project').textContent = invite.project_name;
      card.querySelector('.invitation-description').textContent = invite.project_description || 'No project description yet.';
      const sent = dateSent(invite.created_at);
      card.querySelector('.invitation-byline').textContent = `Invited by ${invite.invited_by}${sent ? ` · ${sent}` : ''}`;
      card.querySelectorAll('.accept-invitation, .decline-invitation').forEach((button) => {
        button.dataset.id = String(invite.id);
      });
      return card;
    });
    list.replaceChildren(...(cards.length
      ? cards : [T.emptyState('No pending invitations', 'When someone invites you to a project, it will appear here.')]));
  }

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const card = button.closest('.invitation-card');
    if (!card) return;

    const invitationId = Number(button.dataset.id);
    const accepting = button.classList.contains('accept-invitation');
    if (!accepting && !confirm('Decline this project invitation?')) return;

    card.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    T.showMessage(get('invitationsError'), '');
    T.showMessage(get('invitationsNotice'), '');

    try {
      const response = await T.api(
        accepting ? 'accept-invitation' : 'decline-invitation',
        { method: 'POST', body: { invitation_id: invitationId } },
      );

      if (accepting) {
        location.href = `project.html?id=${encodeURIComponent(response.project_id)}`;
        return;
      }

      await load();
      T.showMessage(get('invitationsNotice'), 'Invitation declined.', 'success');
    } catch (error) {
      T.showMessage(get('invitationsError'), error.message, 'error');
      card.querySelectorAll('button').forEach((item) => { item.disabled = false; });
    }
  });

  try {
    if (!await T.requireLogin()) return;
    await load();
  } catch (error) {
    T.showMessage(get('invitationsError'), error.message, 'error');
    list.textContent = 'Unable to load invitations.';
  }
});
