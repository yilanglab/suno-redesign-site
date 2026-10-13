Object.assign(document.querySelector('#hero-experience').style, { position: 'relative', zIndex: '100' });
const footer = document.querySelector('#hero-experience .playground-footer');
const tools = footer.querySelector('.motion-tools');
footer.hidden = false;
Object.assign(footer.style, { position: 'fixed', left: '16px', right: 'auto', bottom: '16px', zIndex: '100' });
// Keep the existing Hero controls and their handlers intact.
const tab = document.createElement('button');
tab.id = 'toggle-chapter-glow';
tab.textContent = '章节色团 ＋';
tab.setAttribute('aria-expanded', 'false');
tab.setAttribute('aria-controls', 'chapter-glow-panel');
tools.append(tab);
Object.assign(tools.style, { flexWrap: 'wrap', maxWidth: 'calc(100vw - 32px)' });
const panel = document.createElement('section');
panel.id = 'chapter-glow-panel';
panel.className = 'settings-panel';
panel.setAttribute('aria-label', '章节色团参数');
panel.hidden = true;
footer.after(panel);
const defaults = { speed: 10, opacity: 1.2, size: 1, travel: 24, x: 0, y: -38 };
const values = { ...defaults };
const fields = [
  ['speed', '流动速度', .2, 10, .1, '×'],
  ['opacity', '色团强度', 0, 2, .05, ''],
  ['size', '色团尺寸', .5, 2, .05, '×'],
  ['travel', '流动幅度', 0, 35, 1, '%'],
  ['x', '水平偏移', -50, 50, 1, '%'],
  ['y', '垂直偏移', -100, 100, 1, '%'],
];
panel.innerHTML = '<div class="settings-heading"><h2>章节色团</h2><button id="glow-reset" type="button">重置</button></div>' + fields.map(([key, label, min, max, step, unit]) => `<label for="glow-${key}">${label}<output id="glow-${key}-value">${values[key]}${unit}</output></label><input id="glow-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${values[key]}">`).join('') + '<button id="glow-copy" class="copy-settings" type="button">复制色团参数</button><p id="glow-copy-status" role="status"></p>';
const logoTab = document.createElement('button');
logoTab.id = 'toggle-logo-settings';
logoTab.textContent = 'Logo ＋';
logoTab.setAttribute('aria-expanded', 'false');
logoTab.setAttribute('aria-controls', 'logo-settings-panel');
tools.append(logoTab);
const logoPanel = document.createElement('section');
logoPanel.id = 'logo-settings-panel';
logoPanel.className = 'settings-panel';
logoPanel.setAttribute('aria-label', 'Logo 参数');
logoPanel.hidden = true;
footer.after(logoPanel);
const logoDefaults = { opacity: 40, size: 85 };
const logoValues = { ...logoDefaults };
logoPanel.innerHTML = '<div class="settings-heading"><h2>Logo</h2><button id="logo-reset" type="button">重置</button></div><label for="logo-opacity">常规透明度<output id="logo-opacity-value">40%</output></label><input id="logo-opacity" type="range" min="0" max="100" step="1" value="40"><label for="logo-size">尺寸<output id="logo-size-value">85%</output></label><input id="logo-size" type="range" min="40" max="160" step="1" value="85"><button id="logo-copy" class="copy-settings" type="button">复制 Logo 参数</button><p id="logo-copy-status" role="status"></p>';
function applyLogos() {
  const hero = document.querySelector('#hero');
  hero.style.setProperty('--logo-opacity', logoValues.opacity / 100);
  hero.style.setProperty('--logo-scale', logoValues.size / 100);
  for (const key of ['opacity', 'size']) {
    logoPanel.querySelector(`#logo-${key}`).value = logoValues[key];
    logoPanel.querySelector(`#logo-${key}-value`).value = `${logoValues[key]}%`;
  }
}
logoPanel.addEventListener('input', event => {
  const key = event.target.id.replace('logo-', '');
  if (key in logoValues) { logoValues[key] = Number(event.target.value); applyLogos(); }
});
logoPanel.querySelector('#logo-reset').addEventListener('click', () => { Object.assign(logoValues, logoDefaults); applyLogos(); });
logoPanel.querySelector('#logo-copy').addEventListener('click', async () => {
  const status = logoPanel.querySelector('#logo-copy-status');
  try { await navigator.clipboard.writeText(JSON.stringify(logoValues, null, 2)); status.textContent = '已复制'; }
  catch { status.textContent = '复制失败，请检查剪贴板权限'; }
});
applyLogos();
const panels = [...document.querySelectorAll('#hero-experience .settings-panel')];
for (const item of panels) Object.assign(item.style, { position: 'fixed', left: '16px', bottom: '74px', zIndex: '101', maxHeight: 'calc(100svh - 100px)', width: 'min(310px, calc(100vw - 32px))' });
const tabs = [document.querySelector('#toggle-settings'), document.querySelector('#toggle-background'), tab, logoTab];
for (const button of tabs) button.addEventListener('click', () => {
  if (button === tab || button === logoTab) {
    const target = button === tab ? panel : logoPanel;
    target.hidden = !target.hidden;
    button.setAttribute('aria-expanded', String(!target.hidden));
  }
  panels.forEach(item => {
    if (item.id !== button.getAttribute('aria-controls')) {
      item.hidden = true;
      tabs.find(control => control.getAttribute('aria-controls') === item.id)?.setAttribute('aria-expanded', 'false');
    }
  });
});
function apply() {
  const root = document.documentElement.style;
  for (const key of ['opacity', 'size', 'travel', 'x', 'y']) root.setProperty(`--glow-${key}`, values[key]);
  for (const [key, , , , , unit] of fields) {
    panel.querySelector(`#glow-${key}`).value = values[key];
    panel.querySelector(`#glow-${key}-value`).value = `${values[key]}${unit}`;
  }
}
panel.addEventListener('input', event => {
  const key = event.target.id.replace('glow-', '');
  if (key in values) { values[key] = Number(event.target.value); apply(); }
});
panel.querySelector('#glow-reset').addEventListener('click', () => { Object.assign(values, defaults); apply(); });
panel.querySelector('#glow-copy').addEventListener('click', async () => {
  const status = panel.querySelector('#glow-copy-status');
  try { await navigator.clipboard.writeText(JSON.stringify(values, null, 2)); status.textContent = '已复制'; }
  catch { status.textContent = '复制失败，请检查剪贴板权限'; }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const openTab = [tab, logoTab].find(button => button.getAttribute('aria-expanded') === 'true');
    if (openTab) { document.getElementById(openTab.getAttribute('aria-controls')).hidden = true; openTab.setAttribute('aria-expanded', 'false'); openTab.focus(); }
  }
});
const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('glow-visible', entry.isIntersecting)), { rootMargin: '180px' });
document.querySelectorAll('.chapter-glow').forEach(element => observer.observe(element));
apply();

// Smooth noise paths: independent axes/layers, without a repeating return leg.
const glowNodes = [...document.querySelectorAll('.chapter-glow')].map((element, index) => ({ element, seed: 71 + index * 137 + Math.random() * 1000 }));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function noise(time, seed) {
  const cell = Math.floor(time);
  const fraction = time - cell;
  const blend = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10);
  const hash = n => { const value = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (value - Math.floor(value)) * 2 - 1; };
  return hash(cell) * (1 - blend) + hash(cell + 1) * blend;
}
let elapsed = 0;
let lastFrame;
function drift(now) {
  const dt = lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, .05);
  lastFrame = now;
  if (!document.hidden && !reducedMotion.matches) {
    elapsed += dt * values.speed / 24;
    for (const { element, seed } of glowNodes) {
      if (!element.classList.contains('glow-visible')) continue;
      for (let layer = 0; layer < 2; layer++) {
        const t = elapsed * (layer ? .79 : 1) + seed;
        const x = -50 + noise(t, seed + layer * 23) * values.travel;
        const y = -46 + noise(t * .73, seed + layer * 43 + 11) * values.travel * .7;
        const rotation = noise(t * .51, seed + 17 + layer) * 16;
        const sx = 1 + noise(t * .63, seed + 29 + layer) * .12;
        const sy = 1 + noise(t * .57, seed + 37 + layer) * .1;
        element.style.setProperty(`--glow-transform-${layer}`, `translate(${x}%, ${y}%) rotate(${rotation}deg) scale(${sx}, ${sy})`);
      }
    }
  }
  requestAnimationFrame(drift);
}
requestAnimationFrame(drift);
