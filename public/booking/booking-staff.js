const staffEndpoint = '/api/booking-staff';
const legacyMemberKey = 'success-booking-members-v1';
const staffAccess = document.getElementById('staff-access');
const staffSignIn = document.getElementById('staff-sign-in');
const staffAuthenticator = document.getElementById('staff-authenticator');
const staffEnroll = document.getElementById('staff-enroll');
const staffError = document.getElementById('staff-access-error');
const staffCancel = document.getElementById('staff-cancel');
let rosterRevision;
let loanRevision;
let factorId;
let savingBookingMembers = false;

async function staffRequest(action, details = {}) {
  const response = await fetch(staffEndpoint, action ? {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({action, ...details}),
  } : {cache:'no-store'});
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error), {status:response.status, mfa:payload.mfa, factorId:payload.factorId});
  return payload;
}

async function saveBookingMembers(members) {
  if (savingBookingMembers || !bookingStaffRole) throw new Error('Member save unavailable');
  savingBookingMembers = true;
  try {
    const result = await staffRequest('save', {members, revision:rosterRevision});
    rosterRevision = result.revision;
  } catch (error) {
    if (error.status === 401 || error.status === 403) lockStaffWorkspace();
    throw error;
  } finally {
    savingBookingMembers = false;
  }
}

function lockStaffWorkspace() {
  document.body.setAttribute('data-booking-locked', '');
  delete document.body.dataset.bookingRole;
  bookingStaffRole = undefined;
  staffAccount.open = false;
  if (staffPasswordDialog.open) staffPasswordDialog.close();
  memberRecords = [];
  coachLoan = {entries:[]};
  drawMembers();
  staffAccess.hidden = false;
  staffSignIn.hidden = false;
  staffAuthenticator.hidden = true;
  staffCancel.hidden = true;
}

function comparableRosterMember(record) {
  // The PDF import omitted blank optional fields in older browsers.
  const populated = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== ''));
  return comparableMember(populated);
}

function comparableMember(record) {
  return JSON.stringify(record, (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
      : value);
}

async function saveBookingLoan(ledger) {
  const result = await staffRequest('save-loan', {ledger, revision:loanRevision});
  loanRevision = result.revision;
  coachLoan = ledger;
}

async function loadBookingLoan() {
  let {ledger, revision} = await staffRequest('loan');
  loanRevision = revision;
  const local = JSON.parse(localStorage.getItem(coachLoanKey) || 'null');
  if (local && revision === 0 && Array.isArray(local.entries)) {
    await saveBookingLoan(local);
    ({ledger, revision} = await staffRequest('loan'));
    loanRevision = revision;
  }
  if (local && comparableMember(ledger) === comparableMember(local)) {
    localStorage.removeItem(coachLoanKey);
  }
  coachLoan = ledger;
}

async function loadStaffWorkspace() {
  staffError.textContent = '';
  try {
    let roster = await staffRequest();
    bookingStaffRole = roster.role;
    rosterRevision = roster.revision;
    if (roster.role === 'owner') {
      await loadBookingLoan();
      const local = JSON.parse(localStorage.getItem(legacyMemberKey) || '[]');
      const demoIds = new Set(['mali', 'anan', 'narin', 'demo-package-customer']);
      const candidates = Array.isArray(local) ? local.filter(record => !demoIds.has(record?.id)) : [];
      if (candidates.length) {
        const existingIds = new Set(roster.members.map(member => member.id));
        const newMembers = candidates.filter(member => !existingIds.has(member.id));
        if (newMembers.length) {
          await saveBookingMembers([...roster.members, ...newMembers]);
          roster = await staffRequest();
          rosterRevision = roster.revision;
        }
        const verified = new Set(roster.members.map(member => member.id));
        if (!candidates.every(member => verified.has(member.id))) throw new Error('Member import could not be verified.');
      }
      if (candidates.every(member => roster.members.some(saved => saved.id === member.id && comparableRosterMember(saved) === comparableRosterMember(member)))) {
        localStorage.removeItem(legacyMemberKey);
      }
    }
    memberRecords = roster.members;
    document.body.dataset.bookingRole = roster.role;
    renderStaffAccount(roster.profile, roster.role);
    if (roster.role !== 'owner' && document.getElementById('sales').classList.contains('active')) {
      sidebar.querySelector('[data-section="dashboard"]').click();
    }
    drawMembers();
    restoreBookingView();
    staffAccess.hidden = true;
    document.body.removeAttribute('data-booking-locked');
  } catch (error) {
    lockStaffWorkspace();
    if (error.mfa) {
      factorId = error.factorId;
      staffSignIn.hidden = true;
      staffAuthenticator.hidden = false;
      staffEnroll.hidden = Boolean(factorId);
      staffCancel.hidden = false;
    } else if (error.status !== 401) {
      staffError.textContent = error.message || 'Could not open Bookings.';
    }
  }
}

staffSignIn.onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  if (button.disabled) return;
  button.disabled = true;
  staffError.textContent = '';
  try {
    const {username, password} = Object.fromEntries(new FormData(staffSignIn));
    await staffRequest('login', {username, password});
    staffSignIn.reset();
    await loadStaffWorkspace();
  } catch (error) {
    staffError.textContent = error.message || 'Staff sign-in failed.';
  } finally {
    button.disabled = false;
  }
};

staffEnroll.onclick = async () => {
  staffEnroll.disabled = true;
  staffError.textContent = '';
  try {
    const setup = await staffRequest('enroll');
    factorId = setup.factorId;
    document.getElementById('staff-secret').value = setup.secret;
    document.getElementById('staff-secret-label').hidden = false;
    staffEnroll.hidden = true;
    staffAuthenticator.elements.code.focus();
  } catch (error) {
    staffError.textContent = error.message || 'Could not set up the authenticator.';
  } finally {
    staffEnroll.disabled = false;
  }
};

staffAuthenticator.onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  staffError.textContent = '';
  try {
    await staffRequest('verify', {factorId, code: staffAuthenticator.elements.code.value});
    staffAuthenticator.reset();
    document.getElementById('staff-secret-label').hidden = true;
    await loadStaffWorkspace();
  } catch (error) {
    staffError.textContent = error.message || 'Authenticator verification failed.';
  } finally {
    button.disabled = false;
  }
};

async function signOutBookingStaff() {
  try {
    await staffRequest('logout');
    location.reload();
  } catch {
    lockStaffWorkspace();
    staffError.textContent = 'Could not sign out. Try again.';
    staffCancel.hidden = false;
  }
}
staffCancel.onclick = signOutBookingStaff;
const staffAccount = memberNode('details', null, 'booking-staff-account');
const staffAccountSummary = document.createElement('summary');
const staffAccountAvatar = memberNode('span', null, 'booking-portrait');
staffAccountAvatar.setAttribute('aria-hidden', 'true');
const staffAccountName = memberNode('span', 'Account', 'booking-profile-name');
staffAccountSummary.append(staffAccountAvatar, staffAccountName);
const staffAccountActions = memberNode('div', null, 'booking-staff-account-actions');
const staffPasswordButton = memberNode('button', 'Staff login');
staffPasswordButton.type = 'button';
const staffSignOut = memberNode('button', 'Sign out');
staffSignOut.type = 'button';
staffSignOut.onclick = signOutBookingStaff;
staffAccountActions.append(staffPasswordButton, staffSignOut);
staffAccount.append(staffAccountSummary, staffAccountActions);
tools.append(staffAccount);
document.addEventListener('click', event => {
  if (!staffAccount.contains(event.target)) staffAccount.open = false;
});
staffAccount.addEventListener('keydown', event => {
  if (event.key === 'Escape' && staffAccount.open) {
    staffAccount.open = false;
    staffAccountSummary.focus();
  }
});

function renderStaffAccount(profile, role) {
  const name = profile?.name || (role === 'front_desk' ? 'SuccessPadel' : 'Account');
  const initial = name.charAt(0).toUpperCase();
  staffAccountName.textContent = name;
  staffAccountAvatar.textContent = initial;
  if (profile?.avatar) {
    const photo = new Image();
    photo.alt = '';
    photo.referrerPolicy = 'no-referrer';
    photo.onerror = () => { staffAccountAvatar.textContent = initial; };
    photo.src = profile.avatar;
    staffAccountAvatar.replaceChildren(photo);
  }
  staffPasswordButton.hidden = role !== 'owner';
}

const staffPasswordDialog = memberNode('dialog', null, 'modal-back');
staffPasswordDialog.setAttribute('aria-labelledby', 'booking-staff-password-title');
staffPasswordDialog.innerHTML = `
  <form class="modal compact-booking booking-staff-password">
    <h2 id="booking-staff-password-title">Staff login</h2>
    <label>Username <input value="SuccessPadel" readonly autocomplete="username"></label>
    <label>New password <input name="password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required autofocus></label>
    <label>Confirm password <input name="confirm" type="password" minlength="12" maxlength="72" autocomplete="new-password" required></label>
    <output role="alert"></output>
    <div class="modal-actions">
      <button type="button" class="secondary">Cancel</button>
      <button type="submit" class="primary">Save password</button>
    </div>
  </form>`;
document.body.append(staffPasswordDialog);
const staffPasswordForm = staffPasswordDialog.querySelector('form');
const staffPasswordError = staffPasswordForm.querySelector('output');
const staffPasswordSave = staffPasswordForm.querySelector('[type="submit"]');
staffPasswordButton.onclick = () => {
  staffAccount.open = false;
  staffPasswordDialog.showModal();
};
const staffPasswordCancel = staffPasswordForm.querySelector('[type="button"]');
staffPasswordCancel.onclick = () => staffPasswordDialog.close();
staffPasswordDialog.addEventListener('cancel', event => {
  if (staffPasswordSave.disabled) event.preventDefault();
});
staffPasswordDialog.addEventListener('close', () => {
  staffPasswordForm.reset();
  staffPasswordError.textContent = '';
  staffAccountSummary.focus();
});
staffPasswordForm.onsubmit = async event => {
  event.preventDefault();
  if (staffPasswordSave.disabled) return;
  const password = staffPasswordForm.elements.password.value;
  if (password !== staffPasswordForm.elements.confirm.value) {
    staffPasswordError.textContent = 'Passwords don’t match.';
    staffPasswordForm.elements.confirm.focus();
    return;
  }
  staffPasswordSave.disabled = true;
  staffPasswordCancel.disabled = true;
  staffPasswordError.textContent = '';
  try {
    await staffRequest('staff-password', {password});
    staffPasswordDialog.close();
  } catch (error) {
    staffPasswordError.textContent = error.message || 'Could not save the staff password.';
  } finally {
    staffPasswordSave.disabled = false;
    staffPasswordCancel.disabled = false;
  }
};
const googleSignInContainer = document.getElementById('booking-google-sign-in');
let googleScript;

function loadGoogleIdentity() {
  googleScript ??= new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return googleScript;
}

async function showGoogleSignIn() {
  if (staffAccess.hidden || staffSignIn.hidden) return;
  const configResponse = await fetch(staffEndpoint + '?google=config', {cache:'no-store'});
  if (!configResponse.ok) throw new Error('Google sign-in unavailable.');
  const config = await configResponse.json();
  await loadGoogleIdentity();
  google.accounts.id.initialize({
    client_id:config.clientId,
    nonce:config.nonce,
    callback:async response => {
      staffError.textContent = '';
      try {
        await staffRequest('google-sign-in', {credential:response.credential});
        await loadStaffWorkspace();
      } catch (error) {
        staffError.textContent = error.message || 'Google sign-in failed. Try again.';
        await showGoogleSignIn().catch(() => {});
      }
    },
  });
  googleSignInContainer.replaceChildren();
  googleSignInContainer.hidden = false;
  google.accounts.id.renderButton(googleSignInContainer,{theme:'outline',size:'large',text:'signin_with'});
}

loadStaffWorkspace().then(() => showGoogleSignIn()).catch(() => {
  if (!staffAccess.hidden) staffError.textContent = 'Google sign-in unavailable. Reload to try again.';
});
