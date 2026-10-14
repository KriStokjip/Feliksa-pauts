
document.addEventListener('DOMContentLoaded', async () => {
  const T = TaskFlow;
  const get = (id) => document.getElementById(id);

  get('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = get('profileForm').querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const data = await T.api('profile', {
        method: 'POST',
        body: { first_name: get('profileFirstName').value.trim() },
      });
      T.showMessage(get('profileMessage'), data.message, 'success');
    } catch (error) {
      T.showMessage(get('profileMessage'), error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  get('deleteAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirm('PERMANENTLY delete your account and every project you own? This cannot be undone.')) return;

    const button = get('deleteAccountForm').querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await T.api('delete-account', {
        method: 'POST',
        body: {
          password: get('deleteAccountPassword').value,
          confirmation: get('deleteAccountConfirmation').value,
        },
      });
      location.replace('login.html');
    } catch (error) {
      T.showMessage(get('deleteAccountMessage'), error.message, 'error');
      button.disabled = false;
    }
  });

  try {
    if (!await T.requireLogin()) return;
    const { profile } = await T.api('profile');
    get('profileUsername').value = profile.username;
    get('profileEmail').value = profile.email;
    get('profileFirstName').value = profile.first_name || '';
  } catch (error) {
    T.showMessage(get('profilePageError'), error.message, 'error');
  }
});
