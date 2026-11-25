const staffPage = '/booking/staff.html';
const params = new URLSearchParams(location.search);
const setup = new URLSearchParams(location.hash.slice(1)).has('staff-setup');

async function openBookingEntry() {
  // Preserve existing setup invitations, calendar links and explicit demo entry.
  if (setup || ['1', 'staff'].includes(params.get('demo'))) {
    location.replace(staffPage + location.search + location.hash);
    return;
  }
  // This endpoint checks the HttpOnly cookie, role and owner verification.
  // It returns no roster, calendar, sales or customer data.
  try {
    const response = await fetch('/api/booking-staff', {
      method:'POST', credentials:'same-origin', cache:'no-store',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'session'}),
      signal:AbortSignal.timeout(10000),
    });
    const session = await response.json();
    if ((response.ok && ['owner','front_desk'].includes(session.role)) ||
        (response.status === 401 && session.returning) || (response.status === 403 && session.mfa)) {
      location.replace(staffPage + location.search + location.hash);
    }
  } catch {
    // The public page and explicit sign-in link remain usable during an outage.
  }
}

let catalogRequested = false;
function openCatalog() {
  if (location.hash !== '#shop' || catalogRequested) return;
  catalogRequested = true;
  const script = document.createElement('script');
  script.src = '/booking/shop-products.js?v=public-entry';
  script.onload = () => {
    const groups = {rackets:'Rackets', clothing:'Clothing', accessories:'Accessories', drinks:'Drinks'};
    const catalog = document.querySelector('#catalog');
    const rackets = previewRetailProducts.map((item,i) => ({
      name:item.name, category:'rackets', image:'/booking/photos/rackets/' + (i+1) + '.jpg',
    }));
    for (const [category, label] of Object.entries(groups)) {
      const group = document.createElement('details');
      const heading = document.createElement('summary');
      heading.textContent = label;
      const cards = document.createElement('div');
      cards.className = 'products';
      for (const product of [...rackets, ...photographedShopProducts].filter(p => p.category === category)) {
        const card = document.createElement('figure');
        const photo = new Image();
        photo.loading = 'lazy';
        photo.alt = '';
        photo.src = product.image || '/booking/photos/shop/' + product.id + '.jpg';
        const caption = document.createElement('figcaption');
        caption.textContent = product.name;
        card.append(photo, caption);
        cards.append(card);
      }
      group.append(heading, cards);
      catalog.append(group);
    }
  };
  script.onerror = () => {
    catalogRequested = false;
    document.querySelector('#catalog').textContent = 'Could not load products. Reopen Shop to retry.';
  };
  document.querySelector('#catalog').replaceChildren();
  document.head.append(script);
}
openBookingEntry();
openCatalog();
window.addEventListener('hashchange', openCatalog);
window.addEventListener('pageshow', event => { if (event.persisted) openBookingEntry(); });
