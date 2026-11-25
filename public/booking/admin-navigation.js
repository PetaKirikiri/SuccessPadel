const administrationNavigation = sidebar.querySelector('.staff-nav');

administrationNavigation.prepend(customerNav);

const shopButton = memberNode('button', 'Shop');
shopButton.type = 'button';
shopButton.dataset.section = 'shop';
administrationNavigation.prepend(shopButton);

const shopPage = memberNode('section', null, 'page booking-admin-page');
shopPage.id = 'shop';
const shopHeader = memberNode('header', null, 'booking-page-header');
shopHeader.append(memberNode('h1', 'Shop'));
const shopSearch = document.createElement('input');
shopSearch.type = 'search';
shopSearch.placeholder = 'Find product';
shopSearch.setAttribute('aria-label', 'Find product');
const shopControls = memberNode('div', null, 'pricing-header-controls');
const shopFilterDialog = createBookingFilterDialog('shop-filters-title', 'Shop filters');
shopFilterDialog.classList.add('shop-filter-dialog');
const shopFilterGroups = shopFilterDialog.querySelector('.sales-filter-groups');
const shopSearchLabel = memberNode('label', 'Find product', 'field shop-filter-search');
shopSearch.removeAttribute('placeholder');
shopSearchLabel.append(shopSearch);
shopFilterGroups.before(shopSearchLabel);
let shopCategory = '';
function renderShopFilters() {
  shopFilterGroups.replaceChildren();
  const populated = new Set(retailProducts().map(retailCategory));
  const categories = retailCategories.filter(([key]) => populated.has(key));
  appendBookingFilterGroup(shopFilterGroups, 'Product category',
    [['', 'All products'], ...categories],
    shopCategory, value => { shopCategory = value; }, () => {
      shopFilterButton.setAttribute('aria-label', 'Filter products' +
        (shopCategory ? ' · ' + retailCategories.find(([key]) => key === shopCategory)[1] : ''));
      renderShopFilters();
      renderShop();
    });
}
const shopFilterButton = bookingFilterLauncher('Filter', 'filter', () => {
  renderShopFilters();
  shopFilterDialog.showModal();
});
shopFilterButton.setAttribute('aria-label', 'Filter products');
shopControls.append(shopFilterButton);
shopHeader.append(shopControls);
const shopCatalog = memberNode('div', null, 'racket-catalog');
shopPage.append(shopHeader, shopCatalog);
document.querySelector('.content').append(shopPage);

function renderShop() {
  const query = shopSearch.value.trim().toLowerCase();
  const cards = retailProducts().filter(product =>
    (!shopCategory || retailCategory(product) === shopCategory) &&
    product.name.toLowerCase().includes(query)).map(product => {
    if (retailCategory(product) === 'rackets') return renderRacketCard(product);
    const card = memberNode('article', null, 'racket-card');
    const heading = memberNode('div', null, 'racket-card-heading');
    heading.append(memberNode('h3', product.name), memberNode('strong', formatPrice(product.price)));
    const photo = photographedShopProducts.find(item => item.id === product.id);
    if (photo) {
      const visual = memberNode('div', null, 'shop-product-photo');
      const image = document.createElement('img');
      const original = '/booking/photos/shop/' + photo.id + '.jpg';
      image.addEventListener('error', () => { image.src = original; }, {once:true});
      image.src = '/booking/photos/shop/catalog-white/' + photo.id + '.jpg';
      image.alt = product.name;
      image.loading = 'lazy';
      visual.append(image);
      card.append(visual);
    }
    card.append(heading);
    if (product.details) card.append(memberNode('div', product.details, 'racket-card-footer'));
    return card;
  });
  shopCatalog.replaceChildren(...(cards.length ? cards : [memberNode('p', 'No products found')]));
}
shopButton.onclick = () => { selectStaffSection(shopButton); renderShop(); };
shopSearch.addEventListener('input', renderShop);

const usersButton = memberNode('button', 'Users & access');
usersButton.type = 'button';
usersButton.dataset.section = 'booking-users';
administrationNavigation.append(usersButton);

const accountMenuButton = memberNode('button', 'Users & access', 'booking-admin-button');
accountMenuButton.type = 'button';
accountMenuButton.setAttribute('aria-controls', 'booking-users');
staffAccountActions.prepend(accountMenuButton);

const usersPage = memberNode('section', null, 'page booking-admin-page');
usersPage.id = 'booking-users';
const usersHeader = memberNode('header', null, 'booking-page-header');
const addUser = memberNode('button', 'Add user', 'primary');
addUser.type = 'button';
addUser.disabled = true;
usersHeader.append(memberNode('h1', 'Users & access'), addUser);
const usersError = memberNode('output');
usersError.setAttribute('role', 'alert');
const usersTable = memberNode('div', null, 'booking-data-table');
usersTable.innerHTML = '<table class="table"><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Username</th><th scope="col">Action</th></tr></thead><tbody></tbody></table>';
usersPage.append(usersHeader, usersError, usersTable);
document.querySelector('.content').append(usersPage);

const userEditor = memberNode('dialog', null, 'modal-back');
userEditor.setAttribute('aria-labelledby','staff-user-title');
userEditor.innerHTML = `<form class="modal compact-booking">
  <h2 id="staff-user-title">Add user</h2>
  <label class="field">Name<input name="name" maxlength="60" required></label>
  <label class="field">Username<input name="username" autocomplete="off" pattern="[A-Za-z][A-Za-z0-9_\\-]{2,31}" required></label>
  <label class="field">Password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
  <output role="alert"></output>
  <div class="modal-actions"><button class="secondary" type="button">Cancel</button><button class="primary" type="submit">Save user</button></div>
</form>`;
document.body.append(userEditor);
const userForm = userEditor.querySelector('form');
const userSave = userForm.querySelector('[type="submit"]');
const userCancel = userForm.querySelector('[type="button"]');
let staffAccountTarget;
function openUserEditor(account) {
  staffAccountTarget = account;
  userForm.reset();
  userForm.querySelector('output').textContent = '';
  userForm.querySelector('h2').textContent = account ? 'Set password for '+account.name : 'Add user';
  for (const field of ['name', 'username']) {
    userForm.elements[field].disabled = Boolean(account);
    userForm.elements[field].closest('label').hidden = Boolean(account);
  }
  userEditor.showModal();
}
addUser.onclick = () => openUserEditor();
userCancel.onclick = () => userEditor.close();
userEditor.addEventListener('cancel', event => { if (userSave.disabled) event.preventDefault(); });
userEditor.addEventListener('close', () => userForm.reset());
userForm.onsubmit = async event => {
  event.preventDefault();
  userSave.disabled = userCancel.disabled = true;
  const error = userForm.querySelector('output');
  error.textContent = '';
  try {
    await staffRequest('staff-accounts', {
      ...Object.fromEntries(new FormData(userForm)),
      operation:staffAccountTarget ? 'reset' : 'create',
      id:staffAccountTarget?.id,
    });
    userEditor.close();
    await loadStaffAccounts();
  } catch (failure) {
    error.textContent = failure.message || 'Could not save the account.';
  } finally {
    userSave.disabled = userCancel.disabled = false;
  }
};

async function loadStaffAccounts() {
  const body = usersTable.querySelector('tbody');
  addUser.disabled = true;
  usersError.textContent = '';
  body.replaceChildren();
  try {
    const {accounts} = await staffRequest('staff-accounts', {operation:'list'});
    if (bookingStaffRole !== 'owner') return;
    for (const account of accounts.sort((left,right) =>
      Number(right.role === 'owner')-Number(left.role === 'owner') || left.name.localeCompare(right.name))) {
      const row = body.insertRow();
      row.insertCell().textContent = account.name;
      row.insertCell().textContent = account.role === 'owner' ? 'Owner' : 'Front desk';
      row.insertCell().textContent = account.username || '—';
      const actions = row.insertCell();
      if (account.shared) actions.append(staffPasswordButton);
      else if (account.role === 'front_desk' && account.username) {
        const reset = memberNode('button','Set password','secondary');
        reset.type = 'button';
        reset.onclick = () => openUserEditor(account);
        actions.append(reset);
      }
    }
    if (!accounts.some(account => account.shared)) {
      const row = body.insertRow();
      row.insertCell().textContent = 'SuccessPadel';
      row.insertCell().textContent = 'Front desk';
      row.insertCell().textContent = '—';
      row.insertCell().append(staffPasswordButton);
    }
    staffPasswordButton.textContent = 'Set staff password';
    staffPasswordButton.classList.add('secondary');
    addUser.disabled = false;
  } catch (error) {
    usersError.textContent = error.message || 'Could not load accounts.';
  }
}
usersButton.onclick = () => {
  if (bookingStaffRole !== 'owner') return;
  selectStaffSection(usersButton);
  void loadStaffAccounts();
};
accountMenuButton.onclick = () => {
  staffAccount.open = false;
  usersButton.click();
};

for (const [section, input] of [['dashboard', day], ['pilates', pDay]]) {
  const dateControls = input.closest('.booking-week-toolbar');
  dateControls.dataset.calendarControls = section;
  searchBar.prepend(dateControls);
}

const bookingDateDisplay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
for (const [input, calendar] of [[day, document.getElementById('court-calendar')], [pDay, pGrid]]) {
  const field = document.createElement('span');
  field.className = 'booking-date-field';
  const display = document.createElement('span');
  display.setAttribute('aria-hidden', 'true');
  input.before(field);
  field.append(display, input);

  const updateDisplay = () => {
    display.textContent = input.value
      ? bookingDateDisplay.format(new Date(input.value + 'T00:00:00Z'))
      : 'Booking date';
  };
  input.addEventListener('input', updateDisplay);
  input.addEventListener('change', updateDisplay);
  new MutationObserver(updateDisplay).observe(calendar, {childList: true});
  updateDisplay();
}

function seedPreviewCompetitions() {
  if (!bookingFixtures) return;
  const key = 'success-padel-bookings';
  const saved = storedRows(key);
  let changed = false;
  for (const [date, title] of [
    ['2026-11-25','Beginner Tournament · Mixed'],
    ['2026-11-26','Intermediate Competition · Mixed'],
    ['2026-11-27','Intermediate Competition · Fixed'],
  ]) {
    const legacy = saved.filter(booking => booking.eventId && booking.weeklyOngoing &&
      booking.date === date && booking.time === '18:00' && booking.duration === 120 &&
      date === '2026-11-25' && booking.customer === 'Beginner Tournament');
    for (const booking of legacy) {
      booking.customer = title;
      booking.eventType = 'competition';
      changed = true;
    }
    if (saved.some(booking => booking.eventId && booking.date === date && booking.customer === title)) continue;
    const series = {date, weeklyOngoing:true};
    const conflict = saved.some(booking => courtNames.includes(booking.court) &&
      minutes(booking.time) < 1200 && minutes(booking.time) + booking.duration > 1080 &&
      (bookingOccursOn(booking,date) || bookingOccursOn(series,booking.date)));
    if (conflict) continue;
    const eventId = 'preview-competition-' + date;
    for (const court of courtNames) {
      saved.push({...series,eventId,eventType:'competition',eventRepeat:'weekly',
        eventEnd:'20:00',activity:'event',customer:title,court,time:'18:00',duration:120,price:0,preview:true});
    }
    changed = true;
  }
  for (const [date, court, time, duration, customer, coach, product, paid, price, paymentMethod] of [
    ['2026-11-26','Court 1','08:30',90,'Ben',null,null,true,1200,'test-qr'],
    ['2026-11-26','Court 3','10:30',60,'Maya','David','normal-coaching',true,2000,'test-card'],
    ['2026-11-26','Court 4','15:00',90,'Pim','Bia','coaching-match',false,2400],
    ['2026-11-27','Court 2','09:00',60,'Lek',null,null,false,800],
    ['2026-11-27','Court 3','11:00',60,'Narin T.','Tong','normal-coaching',true,2000,'test-card'],
    ['2026-11-27','Court 4','14:30',90,'Anan S.','Neung','coaching-match',false,2400],
  ]) {
    const example = saved.find(booking => booking.preview && !booking.eventId &&
      booking.date === date && booking.court === court && booking.time === time &&
      booking.duration === duration && booking.customer === customer && booking.coach === coach &&
      booking.price == null);
    const payment = paid ? {
      paidAmount:price, paymentMethod, paidBy:customer, paidAt:date+'T'+time+':00+07:00',
    } : {};
    if (example) {
      Object.assign(example,{price,...(example.paid && !example.paidAt ? payment : {})});
      changed = true;
      continue;
    }
    const start = minutes(time), end = start + duration;
    if (saved.some(booking => bookingOccursOn(booking,date) &&
      (booking.court === court || (coach && booking.coach === coach)) &&
      minutes(booking.time) < end && minutes(booking.time) + booking.duration > start)) continue;
    saved.push({date,court,time,duration,customer,coach,product,paid,price,...payment,
      activity:coach?'coaching':'play',membership:'Non-member',preview:true});
    changed = true;
  }
  for (const booking of saved) {
    if (booking.date !== '2026-11-25' || !booking.preview || booking.eventId ||
        booking.paidAt || booking.splitPayments?.length || !bookingIsPaid(booking) ||
        !Number.isFinite(booking.price) || booking.price <= 0 || !booking.paymentMethod) continue;
    booking.paidAt = booking.date+'T'+booking.time+':00+07:00';
    booking.paidBy ||= booking.customer;
    booking.paidAmount ??= booking.price;
    changed = true;
  }
  if (changed) {
    localStorage.setItem(key,JSON.stringify(saved));
    refreshBookingCalendars();
  }
}
seedPreviewCompetitions();

function seedPreviewClinic() {
  if (!bookingFixtures) return;
  const key = 'success-padel-bookings';
  const bookings = storedRows(key);
  const clinic = {
    eventId: 'preview-beginner-clinic', eventRepeat: 'weekly', weeklyOngoing: true,
    date: '2026-11-28', time: '14:00', duration: 60, eventEnd: '15:00',
    court: 'Court 4', customer: 'Padel Clinic · Beginners · Bia · 3 players',
    eventCoach: 'Bia', activity: 'event', preview: true,
  };
  if (bookings.some(booking => booking.eventId === clinic.eventId ||
    (booking.eventId && booking.date === clinic.date && booking.customer === clinic.customer))) return;
  const legacy = bookings.find(booking => booking.eventId && booking.weeklyOngoing &&
    booking.date === clinic.date && booking.time === clinic.time && booking.duration === clinic.duration &&
    booking.court === 'Court 1' && booking.customer === 'Padel Clinic · Beginners · Beer · 3 players');
  const conflict = bookings.some(booking => booking !== legacy && booking.court === clinic.court &&
    minutes(booking.time) < 900 && minutes(booking.time) + booking.duration > 840 &&
    (bookingOccursOn(booking, clinic.date) || bookingOccursOn(clinic, booking.date)));
  if (conflict) return;
  if (legacy) Object.assign(legacy, clinic, {eventId: legacy.eventId});
  else bookings.push(clinic);
  localStorage.setItem(key, JSON.stringify(bookings));
  refreshBookingCalendars();
}
seedPreviewClinic();
