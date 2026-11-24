// Catalog photo IDs follow Kett's original album order.
const racketSpecifications = {
  2: ['Junior beginners', 'Round', 'Lower center', 'Soft EVA', '3K fiberglass', 'https://www.siuxpadel.com/products/beat-kid-2027'],
  3: ['Junior players'],
  6: ['Advanced attacking players', 'Diamond', null, 'MultiEVA', 'Fibrix · fiberglass and carbon', 'https://www.bullpadel.com/gb/6816-racket-bullpadel-pearl-27.html'],
  9: ['Advanced power players', 'Diamond', null, 'Ultra-hard EVA', null, 'https://www.siuxpadel.com/en/pages/leandro-augsburger'],
  10: ['Advanced power players', 'Diamond', null, 'Ultra-hard EVA', null, 'https://www.siuxpadel.com/en/pages/leandro-augsburger'],
  12: ['Beginners looking for control', 'Round', 'Center', 'Soft Performance EVA', 'Fiberglass', 'https://allforpadel.com/en/110-new-collection?model=metalbone&page=3'],
  13: ['Intermediate control players', 'Round', null, 'HR3 Soft EVA', '3K fiberglass', 'https://noxsport.com/en/products/pala-equation-soft-advanced'],
  16: ['Advanced all-court attackers', 'Hybrid', null, null, null, 'https://www.siuxpadel.com/en/pages/leandro-augsburger'],
  19: ['Technical attackers', 'Diamond', null, null, null, 'https://www.babolat.com/es/padel/palas/diamante.html']
};

function renderRacketCard(product, edit) {
  const photoId = product.racketPhotoId || previewRetailProducts.findIndex(
    item => item.name.toLowerCase() === product.name.toLowerCase()
  ) + 1;
  const [fit, shape, sweetSpot, core, face, source] = racketSpecifications[photoId] || [];
  const card = memberNode('article', null, 'racket-card');
  const visual = memberNode('div', null, 'racket-card-visual');
  if (photoId) {
    const image = document.createElement('img');
    image.src = '/booking/photos/rackets/' + photoId + '.jpg';
    image.alt = product.name;
    image.loading = 'lazy';
    visual.append(image);
  }
  const heading = memberNode('div', null, 'racket-card-heading');
  heading.append(memberNode('h3', product.name), memberNode('strong', formatPrice(product.price)));
  visual.append(heading);
  const specs = memberNode('dl', null, 'racket-card-specs');
  for (const [label, value] of [['Best for', fit], ['Shape', shape], ['Sweet spot', sweetSpot], ['Core', core], ['Face', face]]) {
    const field = memberNode('div', null);
    field.append(memberNode('dt', label), memberNode('dd', value || '—'));
    specs.append(field);
  }
  const footer = memberNode('footer', null, 'racket-card-footer');
  if (source) {
    const link = memberNode('a', 'Specifications');
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    footer.append(link);
  }
  const button = memberNode('button', 'Edit', 'secondary');
  button.type = 'button';
  button.setAttribute('aria-label', 'Edit ' + product.name);
  button.onclick = edit;
  footer.append(button);
  card.append(visual, specs, footer);
  return card;
}
