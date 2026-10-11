const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next], true);
  });
}

document.getElementById('print-sign').addEventListener('click', () => window.print());

const a4Button = document.getElementById('a4-preview');
const a4Styles = document.getElementById('a4-styles');
const sheet = document.querySelector('.sign');
function fitA4Preview() {
  const enabled = a4Button.getAttribute('aria-pressed') === 'true';
  const widthScale = (document.documentElement.clientWidth - 24) / (210 * 96 / 25.4);
  const controlsHeight = document.querySelector('.preview-bar').offsetHeight + document.querySelector('.sheet-tabs').offsetHeight + 80;
  const availableHeight = window.innerHeight - controlsHeight;
  const heightScale = availableHeight / (297 * 96 / 25.4);
  sheet.style.zoom = enabled ? String(Math.min(1, widthScale, Math.max(0.2, heightScale))) : '';
}
a4Button.addEventListener('click', () => {
  const enabled = a4Button.getAttribute('aria-pressed') !== 'true';
  a4Button.setAttribute('aria-pressed', String(enabled));
  a4Styles.media = enabled ? 'all' : 'print';
  fitA4Preview();
  if (enabled) window.scrollTo(0, 0);
});
window.addEventListener('resize', fitA4Preview);
fitA4Preview();
