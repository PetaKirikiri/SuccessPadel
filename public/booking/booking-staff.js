const staffEndpoint = '/api/booking-staff';
const legacyMemberKey = 'success-booking-members-v1';
const staffAccess = document.getElementById('staff-access');
const staffSignIn = document.getElementById('staff-sign-in');
const staffAuthenticator = document.getElementById('staff-authenticator');
const staffEnroll = document.getElementById('staff-enroll');
const staffOpening = document.getElementById('staff-opening');
const staffError = document.getElementById('staff-access-error');
const staffCancel = document.getElementById('staff-cancel');
let rosterRevision;
let loanRevision;
let staffWorkspaceVersion = 0;
let factorId;
let savingBookingMembers = false;

const demoRoster = {role:'owner', profile:{name:'Demo'}, members:[], revision:1};
let demoLoan = {ledger:{entries:[]}, revision:1};

function demoStaffRequest(action, details) {
  switch (action) {
    case undefined: return structuredClone(demoRoster);
    case 'loan': return structuredClone(demoLoan);
    case 'save':
      demoRoster.members = structuredClone(details.members);
      return {revision:++demoRoster.revision};
    case 'save-loan':
      demoLoan = {ledger:structuredClone(details.ledger), revision:demoLoan.revision + 1};
      return {revision:demoLoan.revision};
    default: throw new Error('Unavailable in demo.');
  }
}

async function staffRequest(action, details = {}) {
  if (bookingDemo) return demoStaffRequest(action, details);
  const signal = AbortSignal.timeout(15000);
  const response = await fetch(staffEndpoint, action ? {
    signal,
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({action, ...details}),
  } : {cache:'no-store', signal});
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
  staffWorkspaceVersion++;
  loanRevision = undefined;
  calendarDataset = null;
  bookingSamples = null;
  refreshBookingCalendars();
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
  if (loanRevision === undefined) throw new Error('Loan ledger unavailable.');
  const result = await staffRequest('save-loan', {ledger, revision:loanRevision});
  loanRevision = result.revision;
  coachLoan = ledger;
}

async function loadBookingLoan(version) {
  let {ledger, revision} = await staffRequest('loan');
  if (version !== staffWorkspaceVersion) return;
  loanRevision = revision;
  const local = JSON.parse(localStorage.getItem(coachLoanKey) || 'null');
  if (local && revision === 0 && Array.isArray(local.entries)) {
    await saveBookingLoan(local);
    ({ledger, revision} = await staffRequest('loan'));
    if (version !== staffWorkspaceVersion) return;
    loanRevision = revision;
  }
  if (local && comparableMember(ledger) === comparableMember(local)) {
    localStorage.removeItem(coachLoanKey);
  }
  coachLoan = ledger;
}

async function loadStaffWorkspace({afterSignIn = false} = {}) {
  staffError.textContent = '';
  try {
    const version = ++staffWorkspaceVersion;
    const [rosterRequest, calendarRequest] = await Promise.allSettled([
      staffRequest(),
      bookingDemo ? null : staffRequest('calendar'),
    ]);
    if (version !== staffWorkspaceVersion) return;
    if (rosterRequest.status === 'rejected') throw rosterRequest.reason;
    if (calendarRequest.status === 'rejected') throw calendarRequest.reason;
    let roster = rosterRequest.value;
    if (!bookingDemo) calendarDataset = calendarRequest.value;
    bookingStaffRole = roster.role;
    rosterRevision = roster.revision;
    if (roster.role === 'owner') {
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
    if (bookingSamples && !storedRows('success-padel-bookings').length) {
      day.value = bookingSamples.date;
      salesDate.value = bookingSamples.date;
      salesPeriod = 'date';
    }
    refreshBookingCalendars();
    if (document.getElementById('sales').classList.contains('active')) renderSales();
    if (pricingPage.classList.contains('active')) renderPricing();
    if (document.getElementById('shop')?.classList.contains('active')) renderShop();
    staffAccess.hidden = true;
    document.body.removeAttribute('data-booking-locked');
    if (roster.role === 'owner') {
      loadBookingLoan(version).then(()=>{
        if(version===staffWorkspaceVersion && document.getElementById('sales').classList.contains('active')) renderSales();
      }).catch(error=>console.warn('Could not load booking loan ledger',error));
      if (!bookingDemo) {
        fetch(staffEndpoint + '?demo=samples', {cache:'no-store', signal:AbortSignal.timeout(5000)})
          .then(response=>response.ok ? response.json() : null)
          .then(samples=>{
            if (!samples || version!==staffWorkspaceVersion) return;
            bookingSamples=samples;
            refreshBookingCalendars();
            if (document.getElementById('sales').classList.contains('active')) renderSales();
            if (pricingPage.classList.contains('active')) renderPricing();
            if (document.getElementById('shop')?.classList.contains('active')) renderShop();
          }).catch(()=>{});
      }
    }
  } catch (error) {
    lockStaffWorkspace();
    if (error.mfa) {
      factorId = error.factorId;
      staffSignIn.hidden = true;
      staffAuthenticator.hidden = false;
      staffEnroll.hidden = Boolean(factorId);
      staffCancel.hidden = false;
    } else if (afterSignIn || error.status !== 401) {
      staffError.textContent = error.name === 'TimeoutError'
        ? 'Bookings took too long to load. Try again.'
        : error.message || 'Could not open Bookings.';
    }
  }
}

staffSignIn.onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  if (button.disabled) return;
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Signing in…';
  staffError.textContent = '';
  try {
    const {username, password} = Object.fromEntries(new FormData(staffSignIn));
    await staffRequest('login', {username, password});
    staffSignIn.hidden = true;
    staffSignIn.elements.password.value = '';
    staffOpening.hidden = false;
    staffOpening.textContent = 'Opening Bookings…';
    await loadStaffWorkspace({afterSignIn:true});
  } catch (error) {
    staffError.textContent = error.name === 'TimeoutError'
      ? 'Sign-in took too long. Try again.'
      : error.message || 'Staff sign-in failed.';
  } finally {
    staffOpening.hidden = true;
    staffOpening.textContent = '';
    button.textContent = originalLabel;
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
  staffPasswordButton.hidden = bookingDemo || role !== 'owner';
  staffSignOut.textContent = bookingDemo ? 'Exit demo' : 'Sign out';
  if (bookingDemo) staffSignOut.onclick = () => location.assign('/booking/');
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
const setupForm = document.getElementById('kett-account-setup');
const staffAccessHeading = staffAccess.querySelector('h1');
const bookingPageTitle = document.title;
let setupToken = new URLSearchParams(location.hash.slice(1)).get('staff-setup');
if (setupToken) history.replaceState(history.state, '', location.pathname + location.search);
setupForm.onsubmit = async event => {
  event.preventDefault();
  const {username, password, confirmation} = setupForm.elements;
  const submit = setupForm.querySelector('button');
  submit.disabled = true;
  staffError.textContent = '';
  try {
    await staffRequest('kett-setup', {token:setupToken, username:username.value,
      password:password.value, confirmation:confirmation.value});
    staffSignIn.elements.username.value = username.value.trim();
    setupToken = null;
    setupForm.reset();
    setupForm.hidden = true;
    staffAccessHeading.textContent = 'Staff sign-in';
    document.title = bookingPageTitle;
    staffSignIn.hidden = false;
    staffSignIn.elements.password.focus();
  } catch (error) {
    staffError.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};

async function startBookingWorkspace() {
  if (setupToken && !bookingDemo) {
    staffAccessHeading.textContent = 'Set up your Bookings account';
    document.title = 'Set up your Bookings account · Success Padel';
    staffAccess.hidden = false;
    staffSignIn.hidden = true;
    setupForm.hidden = false;
    setupForm.elements.username.focus();
    return;
  }
  if (bookingDatabaseDemo) {
    const response = await fetch(staffEndpoint + '?demo=samples', {cache:'no-store'});
    if (response.status === 401 || response.status === 403) {
      location.replace('/booking/');
      return;
    }
    if (!response.ok) throw new Error('Could not load sample data.');
    const {date, bookings, availability, sales, products} = await response.json();
    bookingDemoDate = date;
    bookingDemoSales = sales;
    localStorage.setItem('success-padel-bookings', JSON.stringify(bookings));
    localStorage.setItem(availabilityKey, JSON.stringify(availability));
    localStorage.setItem(retailProductsKey, JSON.stringify(products ?? []));
    day.value = pDay.value = date;
    refreshBookingCalendars();
  }
  await loadStaffWorkspace();
}

startBookingWorkspace().catch(() => {
  if (!bookingDatabaseDemo) { staffError.textContent = 'Could not open Bookings.'; return; }
  staffSignIn.hidden = true;
  staffError.textContent = 'Could not load sample data.';
  const back = memberNode('a', 'Back to Bookings');
  back.href = '/booking/';
  staffError.after(back);
});
