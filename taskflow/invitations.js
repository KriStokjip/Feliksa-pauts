/** Accept or decline invitations addressed to the logged-in user. */
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
    list.innerHTML = invitations.length
      ? invitations.map((invite) => `
          <article class="invitation-card" data-id="${invite.id}">
            <div class="invitation-details">
              <h3>${T.escapeHTML(invite.project_name)}</h3>
              <p class="invitation-description">
                ${T.escapeHTML(invite.project_description || 'No project description yet.')}
              </p>
              <p class="muted">
                Invited by ${T.escapeHTML(invite.invited_by)}
                ${dateSent(invite.created_at) ? `· ${T.escapeHTML(dateSent(invite.created_at))}` : ''}
              </p>
            </div>
            <div class="invitation-actions">
              <button type="button" class="btn btn-primary accept-invitation" data-id="${invite.id}">
                Accept
              </button>
              <button type="button" class="btn btn-secondary decline-invitation" data-id="${invite.id}">
                Decline
              </button>
            </div>
          </article>
        `).join('')
      : `<div class="empty-state">
           <strong>No pending invitations</strong>
           When someone invites you to a project, it will appear here.
         </div>`;
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
