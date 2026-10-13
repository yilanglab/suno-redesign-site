import { createShader } from 'shaders/js';
import flowingGradient from 'shaders/core/FlowingGradient';
import dither from 'shaders/core/Dither';
import { createFlowColor, cloneFlowColorParams } from './flow-color.js';

const canvas = document.querySelector('#flowing-background');
canvas.style.width = '100%';
canvas.style.height = '100%';
const flowCanvas = document.querySelector('#flow-color-background');
const panel = document.querySelector('#background-panel');
const tab = document.querySelector('#toggle-background');
const albumTab = document.querySelector('#toggle-settings');
const albumPanel = document.querySelector('#settings-panel');
const modeSelect = document.querySelector('#bg-mode');
const gradientControls = document.querySelector('#bg-gradient-controls');
const flowControls = document.querySelector('#bg-flow-controls');
const paletteList = document.querySelector('#bg-flow-palettes');
const statusLine = document.querySelector('#bg-status');
const copyStatus = document.querySelector('#bg-copy-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const defaults = { grainPattern: 'whiteNoise', grainAmount: 0.25, grainSize: 2, grainSpread: 0.8, speed: 2.05, distortion: 0.4, opacity: 1, seed: 10, colorA: '#f2a8ff', colorB: '#b074c8', colorC: '#FF7222', colorD: '#8f147c' };
const flowKeys = ['speed', 'scale', 'warp', 'warpScale', 'softness', 'holdMs', 'transitionMs', 'grainAmount', 'grainSize', 'grainLuma', 'grainFps'];
const { opacity: flowColorOpacity, ...flowColorParams } = {
  opacity: 0.8,
  speed: 0.5,
  scale: 0.95,
  warp: 0.1,
  warpScale: 2,
  softness: 0.09,
  holdMs: 5000,
  transitionMs: 900,
  grainAmount: 0.09,
  grainSize: 1.5,
  grainLuma: 0.04,
  grainFps: 0,
  grainPattern: 'whiteNoise',
  renderScale: 1,
  palettes: [
    { colors: ['#1000C0', '#F24016', '#E1B1F8'], band: 0 },
    { colors: ['#717E3B', '#FF88A0', '#FFB800'], band: 0.05 },
    { colors: ['#870D73', '#FF7222', '#C3E734'], band: 0.04 },
  ],
};
const flowDefaults = cloneFlowColorParams(flowColorParams);
const MAX_PALETTES = 8;
const effect = 'FlowingGradient';
const settings = { ...defaults, opacity: flowColorOpacity };
let flowSettings = cloneFlowColorParams(flowDefaults);
let mode = 'flowColor';
let flow = null;
let gradientStatus = '';
const addPaletteButton = document.querySelector('#bg-flow-add-palette');
const grainPatternSelect = document.querySelector('#bg-flow-grainPattern');
const colorRoles = ['低处', '交界', '高处'];

function baseProps() {
  const speed = reduced.matches ? 0 : settings.speed;
  return { ...settings, opacity: 1, colorSpace: 'oklch', speed };
}
function grainProps() {
  return { pattern: settings.grainPattern, colorMode: 'source', pixelSize: settings.grainSize, spread: settings.grainSpread, threshold: 0.5, opacity: settings.grainAmount };

}
function formatFlow(name, value) {
  if (name === 'holdMs' || name === 'transitionMs') return `${(value / 1000).toFixed(1)} 秒`;
  if (name === 'speed') return `${value.toFixed(2)}×`;
  if (name === 'grainFps') return value > 0 ? `${value} 帧/秒` : '静止';
  if (name === 'grainSize') return `${value} px`;
  return String(value);
}
function renderPalettes() {
  const { palettes } = flowSettings;
  paletteList.replaceChildren(...palettes.map((palette, index) => {
    const row = document.createElement('div');
    row.className = 'bg-palette';
    const name = `配色 ${index + 1}`;
    const swatches = palette.colors.map((color, slot) => `<input type="color" value="${color}" data-palette="${index}" data-slot="${slot}" aria-label="${name}${colorRoles[slot]}颜色" title="${colorRoles[slot]}">`).join('');
    const remove = `<button type="button" class="bg-palette-remove" data-remove="${index}" aria-label="删除${name}" title="删除"${palettes.length <= 1 ? ' disabled' : ''}>×</button>`;
    row.innerHTML = `<div class="bg-palette-row"><span>${name}</span><div class="bg-palette-swatches">${swatches}${remove}</div></div>`
      + `<label for="bg-flow-band-${index}">交界环宽度<output id="bg-flow-band-${index}-value">${palette.band.toFixed(2)}</output></label>`
      + `<input id="bg-flow-band-${index}" type="range" min="0" max="0.2" step="0.01" value="${palette.band}" data-palette="${index}" data-band>`;
    return row;
  }));
  addPaletteButton.disabled = palettes.length >= MAX_PALETTES;
}
function setStatus() {
  if (mode === 'flowingGradient') statusLine.textContent = gradientStatus;
}
function startFlow() {
  if (flow) return;
  try {
    flow = createFlowColor(flowCanvas, cloneFlowColorParams(flowSettings));
  } catch {
    flow = null;
  }
  if (flow) {
    flowCanvas.dataset.state = 'loading';
    requestAnimationFrame(() => requestAnimationFrame(() => { if (flow) flowCanvas.dataset.state = 'ready'; }));
  } else {
    flowCanvas.dataset.state = 'fallback';
  }
  statusLine.textContent = flow ? '' : '当前浏览器不支持 WebGL，显示纯色背景';
}
function stopFlow() {
  flow?.destroy();
  flow = null;
}
function applyMode() {
  const isFlow = mode === 'flowColor';
  modeSelect.value = mode;
  flowControls.hidden = !isFlow;
  gradientControls.hidden = isFlow;
  canvas.hidden = isFlow;
  flowCanvas.hidden = !isFlow;
  if (isFlow) { shader?.pause(); startFlow(); }
  else { stopFlow(); if (!document.hidden) shader?.resume(); setStatus(); }
}
let shader;
let disposed = false;
function update() {
  canvas.style.opacity = settings.opacity;
  flowCanvas.style.opacity = settings.opacity;
  for (const name of Object.keys(settings)) {
    const input = document.querySelector(`#bg-${name}`);
    input.value = settings[name];
    const output = document.querySelector(`#bg-${name}-value`);
    if (output) output.value = name === 'opacity' ? `${Math.round(settings[name]*100)}%` : String(settings[name]);
  }
  for (const name of flowKeys) {
    document.querySelector(`#bg-flow-${name}`).value = flowSettings[name];
    document.querySelector(`#bg-flow-${name}-value`).value = formatFlow(name, flowSettings[name]);
  }
  grainPatternSelect.value = flowSettings.grainPattern;
  shader?.update('hero-flow', baseProps());
  shader?.update('hero-grain', grainProps());
  flow?.setParams(cloneFlowColorParams(flowSettings));
}
tab.addEventListener('click', () => {
  panel.hidden = !panel.hidden;
  tab.setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) { albumPanel.hidden = true; albumTab.setAttribute('aria-expanded','false'); }
});
albumTab.addEventListener('click', () => { panel.hidden = true;tab.setAttribute('aria-expanded','false'); });
for (const name of Object.keys(defaults)) document.querySelector(`#bg-${name}`).addEventListener('input', event => {
  settings[name] = (name.startsWith('color') || name === 'grainPattern') ? event.target.value : Number(event.target.value);
  copyStatus.textContent = '';
  update();
});
for (const name of flowKeys) document.querySelector(`#bg-flow-${name}`).addEventListener('input', event => {
  flowSettings[name] = Number(event.target.value);
  copyStatus.textContent = '';
  update();
});
paletteList.addEventListener('input', event => {
  const palette = flowSettings.palettes[Number(event.target.dataset.palette)];
  if (!palette) return;
  if ('band' in event.target.dataset) {
    palette.band = Number(event.target.value);
    event.target.previousElementSibling.querySelector('output').value = palette.band.toFixed(2);
  } else {
    palette.colors[Number(event.target.dataset.slot)] = event.target.value;
  }
  copyStatus.textContent = '';
  update();
});
paletteList.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button || flowSettings.palettes.length <= 1) return;
  flowSettings.palettes.splice(Number(button.dataset.remove), 1);
  renderPalettes();
  copyStatus.textContent = '';
  update();
});
addPaletteButton.addEventListener('click', () => {
  if (flowSettings.palettes.length >= MAX_PALETTES) return;
  const last = flowSettings.palettes.at(-1);
  flowSettings.palettes.push({ colors: [...last.colors], band: last.band });
  renderPalettes();
  paletteList.lastElementChild.querySelector('input[type=color]').focus();
  copyStatus.textContent = '';
  update();
});
grainPatternSelect.addEventListener('change', () => { flowSettings.grainPattern = grainPatternSelect.value; copyStatus.textContent = ''; update(); });
modeSelect.addEventListener('change', () => { mode = modeSelect.value; copyStatus.textContent = ''; applyMode(); update(); });
document.querySelector('#bg-reset').addEventListener('click', () => {
  if (mode === 'flowColor') { flowSettings = cloneFlowColorParams(flowDefaults); settings.opacity = flowColorOpacity; renderPalettes(); }
  else Object.assign(settings, defaults);
  copyStatus.textContent='';
  update();
});
document.querySelector('#bg-copy').addEventListener('click', async () => {
  const payload = mode === 'flowColor'
    ? { effect: 'FlowColor', opacity: settings.opacity, ...Object.fromEntries(flowKeys.map(name => [name, flowSettings[name]])), grainPattern: flowSettings.grainPattern, renderScale: flowSettings.renderScale, palettes: flowSettings.palettes }
    : { effect, ...settings };
  try { await navigator.clipboard.writeText(JSON.stringify(payload,null,2)); copyStatus.textContent = '背景参数已复制'; }
  catch { copyStatus.textContent = '复制失败，请重试'; }
});
document.addEventListener('keydown', event => { if(event.key === 'Escape'&&!panel.hidden){panel.hidden=true;tab.setAttribute('aria-expanded','false');tab.focus();} });
document.addEventListener('visibilitychange', () => { if(document.hidden)shader?.pause();else if(mode === 'flowingGradient')shader?.resume(); });
reduced.addEventListener('change', () => { update(); if (flow) { stopFlow(); startFlow(); } });
window.addEventListener('pagehide', event => { if(event.persisted)shader?.pause();else {disposed=true;shader?.destroy();stopFlow();} });
window.addEventListener('pageshow', event => {if(event.persisted&&mode === 'flowingGradient')shader?.resume();});
renderPalettes();
applyMode();
update();
async function startBackground() {
canvas.dataset.state = 'loading';
const fail = message => { canvas.dataset.state = 'fallback'; gradientStatus = message; setStatus(); };
const timeout = setTimeout(() => { if (canvas.dataset.state === 'loading') fail('背景仍在初始化，暂时显示静态渐变'); }, 8000);
try {
  shader = await createShader(canvas, { components: [{ type: effect, id: 'hero-flow', props: baseProps() }, { type: 'Dither', id: 'hero-grain', props: grainProps() }] }, {
    components: [flowingGradient, dither], colorSpace: 'srgb', toneMapping: 'linear', disableTelemetry: true,
    onError: () => fail('当前浏览器使用静态渐变背景'),
  });
  if(disposed)shader.destroy();
  else {
    canvas.dataset.state=shader.getFailureReason()?'fallback':'ready';
    if(!shader.getFailureReason()){ gradientStatus=''; setStatus(); }
    if (mode === 'flowColor') shader.pause();
    update();
  }
} catch {
  fail('当前浏览器使用静态渐变背景');
}

finally {clearTimeout(timeout);}
}
startBackground();
