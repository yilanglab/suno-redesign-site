import markup from './index.html';
import styles from './hero.css';
import navigationStyles from './homepage-nav.css';

const host = document.querySelector('#hero-experience');
const heroBase = new URL('/suno-redesign-site/hero/', location.origin);
// Reuse the playground markup and assets without creating a second document or iframe.
host.innerHTML = markup.split('<body>')[1].split('</body>')[0]
  .replace('<main class="hero"', '<section class="hero"')
  .replace('</main>', '</section>')
  .replace(/(src|href)="(\.\.?\/[^\"]+)"/g, (_, attr, path) => `${attr}="${new URL(path, heroBase).href}"`);
const sheet = document.createElement('style');
sheet.dataset.heroStyles = '';
const fonts = styles.match(/@font-face\{[^}]*\}/g) || [];
const scoped = styles.replace(/@font-face\{[^}]*\}/g, '')
  .replace(/:root|\bbody\b/g, ':scope')
  .replace(/url\((['"]?)([^)'" ]+)\1\)/g, (_, quote, path) => path.startsWith('#') ? `url(${path})` : `url("${new URL(path, heroBase).href}")`);
sheet.textContent = fonts.join('\n').replace(/url\((['"]?)([^)'" ]+)\1\)/g, (_, quote, path) => path.startsWith('#') ? `url(${path})` : `url("${new URL(path, heroBase).href}")`)
  + `\n@scope (#hero-experience) {\n${scoped}\n${navigationStyles}\n:scope{display:block;line-height:normal}\n}\n`;
document.head.append(sheet);
// Match the loading wordmark to the actual responsive hero layout.
const loadingLogo = host.querySelector('.wordmark');
const syncLoadingLogo = () => {
  const bounds = loadingLogo.getBoundingClientRect();
  const origin = host.getBoundingClientRect();
  host.style.setProperty('--loading-logo-x', `${bounds.left - origin.left}px`);
  host.style.setProperty('--loading-logo-y', `${bounds.top - origin.top}px`);
  host.style.setProperty('--loading-logo-width', `${bounds.width}px`);
  host.style.setProperty('--loading-logo-height', `${bounds.height}px`);

};
const loadingLogoObserver = new ResizeObserver(syncLoadingLogo);
loadingLogoObserver.observe(host);
loadingLogoObserver.observe(host.querySelector('.hero-copy'));
syncLoadingLogo();
// Wait for the actual blur transition, rather than a wall-clock estimate.
const finishLoadingEntrance = () => {
  if (host.dataset.loadingEntered) return;
  host.dataset.loadingEntered = 'true';
  requestAnimationFrame(() => requestAnimationFrame(checkHeroReady));
};
host.addEventListener('transitionend', event => {
  if (event.target === host && event.pseudoElement === '::before' && event.propertyName === 'filter') finishLoadingEntrance();
});
document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
  syncLoadingLogo();
  host.dataset.loadingLogo = 'ready';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishLoadingEntrance();
})));
// Keep the static first frame until both renderers have produced a usable frame.
const loadingObserver = new MutationObserver(checkHeroReady);
function checkHeroReady() {
  const stage = host.querySelector('.album-stage');
  const background = host.querySelector('#flow-color-background');
  if (!['webgl', 'fallback'].includes(stage?.dataset.renderer)
      || !['ready', 'fallback'].includes(background?.dataset.state)) return;
  syncLoadingLogo();
  if (!host.dataset.loadingEntered || host.dataset.loadState) return;
  host.dataset.loadState = 'ready';
  // Keep the opaque loading logo over its identical counterpart throughout the crossfade.
  setTimeout(() => { host.dataset.loadState = 'complete'; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
  loadingLogoObserver.disconnect();
  loadingObserver.disconnect();
}
loadingObserver.observe(host, { subtree: true, attributes: true, attributeFilter: ['data-renderer', 'data-state'] });
const zhHero = await import('../suno-redesign-site/suno-redesign/zh-hero.js');
zhHero.localizeHero(host);
await import('./hero.js');
checkHeroReady();

await import('../suno-redesign-site/suno-redesign/chapter-glow-controls.js');

zhHero.setupFontPanel(host);
