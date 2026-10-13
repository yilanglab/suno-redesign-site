const header = document.querySelector('.site-header');
const popovers = [...header.querySelectorAll('[data-popover]')];
const CLOSE_DELAY = 140;
let openItem = null;
let closeTimer = 0;

function setOpen(item, open) {
  item.toggleAttribute('data-open', open);
  item.querySelector(':scope > button').setAttribute('aria-expanded', String(open));
}
function open(item) {
  clearTimeout(closeTimer);
  if (openItem && openItem !== item) setOpen(openItem, false);
  openItem = item;
  setOpen(item, true);
  header.setAttribute('data-menu-open', '');
  header.dispatchEvent(new CustomEvent('nav-change', { detail: { item, keyboard: lastPointer === 'keyboard' } }));
}
function close() {
  if (!openItem) return;
  setOpen(openItem, false);
  openItem = null;
  header.removeAttribute('data-menu-open');
  header.dispatchEvent(new CustomEvent('nav-change', { detail: { item: null } }));
}
function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(close, CLOSE_DELAY);
}

header.addEventListener('nav-dismiss', close);
let lastPointer = '';
for (const item of popovers) {
  const trigger = item.querySelector(':scope > button');
  item.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { lastPointer = 'mouse'; open(item); } });
  item.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleClose(); });
  item.addEventListener('focusin', event => { if (event.target.matches(':focus-visible')) open(item); });
  item.addEventListener('focusout', event => { if (!item.contains(event.relatedTarget)) scheduleClose(); });
  trigger.addEventListener('click', () => {
    if (lastPointer === 'mouse' && openItem === item) return;
    openItem === item ? close() : open(item);
  });
}
document.addEventListener('pointerdown', event => {
  lastPointer = event.pointerType;
  if (openItem && !openItem.contains(event.target)) close();
});
document.addEventListener('keydown', event => { if (event.key !== 'Escape') lastPointer = 'keyboard'; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !openItem) return;
  const trigger = openItem.querySelector(':scope > button');
  close();
  trigger.focus();
});

const wordmark = document.querySelector('.wordmark');
const ready = Promise.all([document.fonts?.ready, wordmark?.decode?.().catch(() => {})]);
Promise.race([ready, new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {
  requestAnimationFrame(() => (document.querySelector('#hero-experience') || document.body).classList.add('is-ready'));
});
