import './flowing-background.js';
import './site-header.js';
import { setupHomepageNav } from './homepage-nav.js';
import { startHeroAmbient } from './hero-ambient.js';
import { createPlayer, PLAY_ICON, PAUSE_ICON } from './hero-player.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ALBUM_COUNT, COVER_SIZE, DEFAULTS, albumScale, albumBlur, AUTO_DOWN_SECONDS, shouldAutoDown, DEFAULT_CURVES, DEFAULT_ALBUM_INDEX, advanceAutoPhase, transitionProgress, SWITCH_DURATION_MS, EDGE_PALETTE, transitionEase, albumPose, albumSlot } from './album-layout.mjs';

setupHomepageNav(document.querySelector('#hero-experience') || document.body);

const stage = document.querySelector('#album-stage');
const hero = document.querySelector('#hero');
const previous = document.querySelector('#previous-album');
const next = document.querySelector('#next-album');
const settingsToggle = document.querySelector('#toggle-settings');
const settingsPanel = document.querySelector('#settings-panel');
const status = document.querySelector('#status-message');
const scrubber = document.querySelector('#album-progress');
const timeline = document.querySelector('.album-timeline');
const showTimelineInput = document.querySelector('#showTimeline');
let scrubCycle = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const songs = window.SUNO_REDESIGN_CONTENT?.songs || [];
const settings = { ...DEFAULTS };
function applyTimelineVisibility() {
  timeline.hidden = !settings.showTimeline;
}
applyTimelineVisibility();
showTimelineInput.checked = settings.showTimeline;
const curves = Object.fromEntries(Object.entries(DEFAULT_CURVES).map(([axis, points]) => [axis, [...points]]));
const abort = new AbortController();
const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: abort.signal });
let renderer;
let scene;
let camera;
let geometry;
let infoGeometry;
let frame = 0;
let transition = null;
let targetPhase = DEFAULT_ALBUM_INDEX;
let keyLight;
let phase = DEFAULT_ALBUM_INDEX - 0.23;
let lastTime = 0;
let autoPaused = reducedMotion.matches;
let dragging = false;
let playHold = false;

let disposed = false;
let ready = false;
let insideViewport = true;
let resizeObserver;
let intersectionObserver;
let centreX = 0;
let centreY = 0;
let scale = 1;
let viewWidth = 0;
let viewHeight = 0;
const albums = [];
const textures = new Set();

function cancelFrame() {
  cancelAnimationFrame(frame);
  frame = 0;
  lastTime = 0;
}

function fallback(message) {
  cancelFrame();
  ready = false;
  stage.dataset.renderer = 'fallback';
  renderer?.domElement.remove();
  previous.disabled = next.disabled = settingsToggle.disabled = scrubber.disabled = true;
  settingsPanel.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');
  status.textContent = message;
}

function applyTextureSpace(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.add(texture);
  return texture;
}

// Match object-fit: cover: preserve the artwork ratio and crop its centre to a square.
function squareCoverTexture(texture) {
  const { width, height } = texture.image;
  if (width > height) {
    texture.repeat.x = height / width;
    texture.offset.x = (1 - texture.repeat.x) / 2;
  } else if (height > width) {
    texture.repeat.y = width / height;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
  return applyTextureSpace(texture);
}

// Printed reverse labels keep each sleeve identifiable as it turns.
function printedTexture(song) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1b18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#dfd5c6';
    ctx.font = '15px sans-serif';
    ctx.fillText('SUNO', 32, 43);
    ctx.strokeStyle = '#83776b';
    ctx.lineWidth = 1;
    for (const radius of [145, 141, 132, 120, 42]) {
      ctx.beginPath();ctx.arc(256, 239, radius, 0, Math.PI * 2);ctx.stroke();
    }
    ctx.fillStyle = '#aa8b72';
    ctx.beginPath();ctx.arc(256, 239, 39, 0, Math.PI * 2);ctx.fill();
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();ctx.arc(256, 239, 4, 0, Math.PI * 2);ctx.fill();
    ctx.fillStyle = '#dfd5c6';
    ctx.font = '20px sans-serif';
    ctx.fillText(song.title, 32, 452, 448);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#a59989';
    ctx.fillText(song.artistName, 32, 478, 448);
  return applyTextureSpace(new THREE.CanvasTexture(canvas));
}

const INFO_WIDTH = 1024;
const INFO_HEIGHT = 320;
const INFO_GAP = 0.06;
const compactCount = value => value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : String(value);
const assetURL = path => new URL(path, new URL('/suno-redesign-site/suno-redesign/', location.origin)).href;
async function loadImage(src) {
  const image = new Image();
  image.src = src;
  try { await image.decode(); return image; } catch { return null; }
}
// Album info shares the cover transform, but stays sharp and fades only at the front.
async function infoTexture(song) {
  const canvas = document.createElement('canvas');
  canvas.width = INFO_WIDTH;
  canvas.height = INFO_HEIGHT;
  const ctx = canvas.getContext('2d');
  const avatar = await loadImage(assetURL(song.artistImage));
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 16;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 86px "Neue Montreal", sans-serif';
  ctx.fillText(song.title, 0, 60, INFO_WIDTH);
  const avatarY = 172;
  ctx.save();
  ctx.beginPath();ctx.arc(34, avatarY, 34, 0, Math.PI * 2);ctx.clip();
  if (avatar) ctx.drawImage(avatar, 0, avatarY - 34, 68, 68);
  else { ctx.fillStyle = '#ffffff33';ctx.fillRect(0, avatarY - 34, 68, 68); }
  ctx.restore();
  ctx.fillStyle = '#e4ddd8';
  ctx.font = '62px "Neue Montreal", sans-serif';
  ctx.fillText(song.artistName, 96, avatarY + 2, INFO_WIDTH - 96);
  const statsY = 274;
  ctx.fillStyle = '#d2cac4';
  ctx.font = '54px "Neue Montreal", sans-serif';
  ctx.beginPath();ctx.moveTo(6, statsY - 18);ctx.lineTo(36, statsY);ctx.lineTo(6, statsY + 18);ctx.closePath();ctx.fill();
  const plays = compactCount(song.playCount);
  ctx.fillText(plays, 58, statsY + 2);
  const heartX = 58 + ctx.measureText(plays).width + 56;
  ctx.save();
  ctx.translate(heartX, statsY);ctx.scale(1.35, 1.35);
  ctx.strokeStyle = '#d2cac4';ctx.lineWidth = 3.4;ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(15, 14);
  ctx.bezierCurveTo(-6, 0, -2, -18, 8, -15);
  ctx.bezierCurveTo(12, -14, 15, -9, 15, -7);
  ctx.bezierCurveTo(15, -9, 18, -14, 22, -15);
  ctx.bezierCurveTo(32, -18, 36, 0, 15, 14);
  ctx.stroke();
  ctx.restore();
  ctx.fillText(compactCount(song.likeCount), heartX + 66, statsY + 2);
  return applyTextureSpace(new THREE.CanvasTexture(canvas));
}

// Screen-space bounds of the frontal album (cover plus info), relative to the hero.
const corner = new THREE.Vector3();
function frontalAlbumRect() {
  if (!ready || !albums.length) return null;
  const album = albums.reduce((best, item) => Math.abs(item.distance) < Math.abs(best.distance) ? item : best);
  album.mesh.updateMatrixWorld();
  const half = COVER_SIZE / 2;
  const bottom = -half - INFO_GAP * COVER_SIZE - COVER_SIZE * INFO_HEIGHT / INFO_WIDTH;
  let left = Infinity, top = Infinity, right = -Infinity, lower = -Infinity;
  for (const [x, y] of [[-half, half], [half, half], [-half, bottom], [half, bottom]]) {
    album.mesh.localToWorld(corner.set(x, y, 0.5)).project(camera);
    const sx = (corner.x + 1) / 2 * hero.clientWidth;
    const sy = (1 - corner.y) / 2 * hero.clientHeight;
    left = Math.min(left, sx); right = Math.max(right, sx);
    top = Math.min(top, sy); lower = Math.max(lower, sy);
  }
  return { left, top, right, bottom: lower };
}

const player = createPlayer({ songs, resolve: assetURL, signal: abort.signal });
const playButton = document.querySelector('#album-play');
const PLAY_INSET = 16;
const PLAY_SIZE = 56;
let playButtonSong = -1;
function renderPlayButton() {
  if (playButtonSong < 0) return;
  const playing = player.isPlaying(playButtonSong);
  playButton.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  playButton.setAttribute('aria-label', `${playing ? '暂停' : '播放'} ${songs[playButtonSong].title}`);
}
player.subscribe(renderPlayButton);
function updatePlayButton() {
  const album = albums.reduce((best, item) => Math.abs(item.distance) < Math.abs(best.distance) ? item : best);
  const visible = !dragging && !transition && Math.abs(album.distance) < 0.23;
  playButton.classList.toggle('is-visible', visible);
  playButton.tabIndex = visible ? 0 : -1;
  if (!visible) { setPlayHold(false); return; }
  if (album.songIndex !== playButtonSong) { playButtonSong = album.songIndex; renderPlayButton(); }
  if (playHold) return;
  album.mesh.localToWorld(corner.set(-COVER_SIZE / 2, -COVER_SIZE / 2, 0.5)).project(camera);
  const x = (corner.x + 1) / 2 * hero.clientWidth + PLAY_INSET;
  const y = (1 - corner.y) / 2 * hero.clientHeight - PLAY_INSET - PLAY_SIZE;
  // `translate` applies outside `scale`, so the fade-in scale stays centred on the button.
  playButton.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
  // The album drifts while frontal, so the button can slide under a still cursor without a hover event.
  if (pointerOverPlay()) { setPlayHold(true); lastTime = 0; }
}
let pointerAt = null;
function pointerOverPlay() {
  if (!pointerAt) return false;
  const rect = playButton.getBoundingClientRect();
  return pointerAt.x >= rect.left && pointerAt.x <= rect.right && pointerAt.y >= rect.top && pointerAt.y <= rect.bottom;
}
function setPlayHold(hold) {
  playHold = hold;
  playButton.classList.toggle('is-hovered', hold);
}
function syncPlayHold() {
  const hold = playButton.classList.contains('is-visible') && (pointerOverPlay() || playButton.matches(':focus-visible'));
  if (hold === playHold) return;
  setPlayHold(hold);
  if (hold) cancelFrame(); else resumeLoop();
}
listen(window, 'pointermove', event => { pointerAt = { x: event.clientX, y: event.clientY }; syncPlayHold(); }, { passive: true });
listen(document.documentElement, 'pointerleave', () => { pointerAt = null; syncPlayHold(); });
listen(playButton, 'focus', syncPlayHold);
listen(playButton, 'blur', syncPlayHold);
listen(playButton, 'click', () => { if (playButtonSong >= 0) player.play(playButtonSong); });

let infoFading = false;
function draw(dt = 1 / 60) {
  if (!ready || disposed) return;
  infoFading = false;
  const previousInfo = new Map(albums.map(album => [album.logicalIndex, album.infoOpacity || 0]));
  for (let slot = 0; slot < albums.length; slot++) {
    const album = albums[slot];
    const { distance, songIndex } = albumSlot(slot, phase, songs.length);
    const pose = albumPose(distance, settings.spacingX, settings.spacingY, settings.spacingZ, curves, settings.rotation, settings.clockwiseAngle);
    album.distance = distance;
    const logicalIndex = Math.floor(phase) + slot - Math.floor(ALBUM_COUNT / 2);
    if (album.logicalIndex !== logicalIndex) {
      album.infoOpacity = previousInfo.get(logicalIndex) || 0;
      album.logicalIndex = logicalIndex;
    }
    if (album.songIndex !== songIndex) {
      const artwork = art[songIndex];
      album.materials.front.map = artwork.front;
      album.materials.back.map = artwork.back;
      album.materials.info.map = artwork.info;
      album.songIndex = songIndex;
    }
    const blur = albumBlur(distance, settings.blur, curves.blur);
    for (const face of ['front','back']) {
      const material = album.materials[face];
      const image = material.map.image;
      material.userData.blur.value.set(blur / (image.width || 512), blur / (image.height || 512));
    }
    album.mesh.position.set(centreX + settings.positionX / 100 * viewWidth + pose.x * scale, centreY + settings.positionY / 100 * viewHeight + pose.y * scale, pose.z * scale);
    album.mesh.rotation.set(pose.rx, pose.ry, pose.rz);
    const size = scale * albumScale(distance, settings.scaleFalloff, curves.scale);
    album.mesh.scale.set(size, size, settings.thickness * size);
    album.mesh.visible = pose.opacity > 0.005;
    for (const material of Object.values(album.materials)) material.opacity = pose.opacity;
    const infoTarget = Math.abs(distance) <= 0.230001 ? 1 : 0;
    const delta = infoTarget - (album.infoOpacity || 0);
    album.infoOpacity = reducedMotion.matches ? infoTarget : (album.infoOpacity || 0) + Math.sign(delta) * Math.min(Math.abs(delta), dt / 0.5);
    infoFading ||= Math.abs(infoTarget - album.infoOpacity) > 0.001;
    const alpha = album.infoOpacity;
    album.materials.info.opacity = pose.opacity * alpha * alpha * (3 - 2 * alpha);
  }
  const angle = THREE.MathUtils.degToRad(settings.lightAngle);
  keyLight.position.set(Math.cos(angle) * 7.2, Math.sin(angle) * 7.2, 9);
  hero.dataset.phase = String(phase);
  hero.dataset.targetPhase = String(targetPhase);
  hero.dataset.motion = dragging ? 'dragging' : transition ? 'switching' : autoPaused || playHold ? 'idle' : 'drifting';
  updatePlayButton();
  const progress = transitionProgress(phase, scrubCycle ?? undefined);
  scrubber.value = Math.round(progress.progress * 1000);
  scrubber.style.setProperty('--progress', `${progress.progress * 100}%`);
  scrubber.setAttribute('aria-valuetext', `${Math.round(progress.progress * 100)}%，当前专辑正面结束至下一张正面`);
  document.querySelector('#album-progress-value').value = `${Math.round(progress.progress * 100)}%`;
  renderer.render(scene, camera);
}

function tick(time) {
  frame = 0;
  if (!ready || document.hidden || !insideViewport || disposed) return;
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
  lastTime = time;
  if (transition) {
    transition.elapsed += dt * 1000;
    const t = Math.min(1, transition.elapsed / transition.duration);
    phase = transition.from + (transition.to - transition.from) * transitionEase(t);
    if (t === 1) { phase = transition.to; transition = null; }
  } else if (!autoPaused && !dragging && !playHold) {
    const before = phase;
    phase = advanceAutoPhase(phase, dt, settings.autoSpeed, settings.frontalSeconds);
    targetPhase = Math.round(phase);
    if (shouldAutoDown(before, phase, settings.frontalSeconds)) navigate(1);
  }
  draw(dt);
  resumeLoop();
}

function resumeLoop() {
  if (!frame && ready && (infoFading || transition || (!autoPaused && !dragging && !playHold)) && !document.hidden && insideViewport && !disposed) frame = requestAnimationFrame(tick);
}

function navigate(direction, immediate = false) {
  if (!ready) return;
  scrubCycle = null;
  targetPhase += direction;
  cancelFrame();
  if (immediate || reducedMotion.matches) {
    phase = targetPhase - 0.23; transition = null; draw(); resumeLoop();
  } else {
    transition = { from: phase, to: targetPhase - 0.23, elapsed: 0, duration: SWITCH_DURATION_MS / settings.speed };
    resumeLoop();
  }
}

function resize() {
  const media = hero.querySelector('.press-marquee');
  const mark = hero.querySelector('.wordmark').getBoundingClientRect();
  const cta = hero.querySelector('.hero-cta').getBoundingClientRect();
  const bounds = hero.getBoundingClientRect();
  const copy = hero.querySelector('.hero-copy').getBoundingClientRect();
  media.style.setProperty('--press-top', `${mark.top - bounds.top}px`);
  media.style.setProperty('--press-height', `${cta.bottom - mark.top}px`);
  media.style.right = `${copy.left - bounds.left}px`;
  if (!renderer || disposed) return;
  const width = hero.clientWidth;
  const height = hero.clientHeight;
  const mobile = width <= 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  viewWidth = viewHeight * camera.aspect;
  const desiredPixels = mobile ? Math.min(width * 0.46, 230) : Math.min(width * 0.24, height * 0.36, 410);
  scale = (desiredPixels / height) * viewHeight / COVER_SIZE;
  centreX = viewWidth * (mobile ? 0.145 : 0.205);
  centreY = viewHeight * (mobile ? -0.17 : 0.005);
  draw();
}

listen(document.querySelector('#toggle-auto'), 'click', () => {
  scrubCycle = null;
  autoPaused = !autoPaused;
  document.querySelector('#toggle-auto').textContent = autoPaused ? '继续滚动' : '暂停滚动';
  if (autoPaused && !transition) cancelFrame();
  draw(); resumeLoop();
});
function beginScrub() {
  if (scrubCycle === null) scrubCycle = transitionProgress(phase).cycle;
  autoPaused = true;
  transition = null;
  cancelFrame();
  document.querySelector('#toggle-auto').textContent = '继续滚动';
}
function scrubTo(value) {
  if (!ready) return;
  beginScrub();
  const { start, end } = transitionProgress(phase, scrubCycle);
  phase = start + Math.max(0, Math.min(1, value))*(end-start);
  targetPhase = Math.round(phase);
  draw();
}
function scrubPointer(event) {
  const rect = scrubber.getBoundingClientRect();
  scrubTo((event.clientX-rect.left-7)/(rect.width-14));
}
listen(scrubber, 'pointerdown', event => {
  if (!ready) return;
  event.preventDefault();
  scrubber.focus();
  scrubber.setPointerCapture(event.pointerId);
  scrubPointer(event);
});
listen(scrubber, 'pointermove', event => {
  if (scrubber.hasPointerCapture(event.pointerId)) scrubPointer(event);
});
listen(scrubber, 'pointerup', event => {
  if (scrubber.hasPointerCapture(event.pointerId)) scrubber.releasePointerCapture(event.pointerId);
});
listen(scrubber, 'keydown', event => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) beginScrub();
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); scrubTo(event.key === 'Home' ? 0 : 1); }
});
listen(scrubber, 'input', () => scrubTo(Number(scrubber.value)/1000));
listen(previous, 'click' , event => navigate(-1, event.detail === 0));
listen(next, 'click', event => navigate(1, event.detail === 0));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let drag = null;
function albumAt(event) {
  const rect = hero.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(albums.filter(album => album.mesh.visible).map(album => album.mesh), true)[0];
}
// Pixels of vertical pointer travel that move the stack by one album, and its direction.
function dragUnit() {
  const centre = albumPose(0, settings.spacingX, settings.spacingY, settings.spacingZ, curves, settings.rotation, settings.clockwiseAngle);
  const after = albumPose(1, settings.spacingX, settings.spacingY, settings.spacingZ, curves, settings.rotation, settings.clockwiseAngle);
  const pixels = Math.abs(after.y - centre.y) * scale / viewHeight * hero.clientHeight;
  return { pixels: Math.max(pixels, 80), sign: Math.sign(after.y - centre.y) || 1 };
}
listen(hero, 'pointerdown', event => {
  if (!ready || event.button !== 0 || event.target.closest('button, a, input, select, textarea, label, [id$="-panel"], .site-header')) return;
  if (!albumAt(event)) return;
  event.preventDefault();
  hero.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, startY: event.clientY, startPhase: phase, unit: dragUnit(), moved: false, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
  dragging = true;
  scrubCycle = null;
  transition = null;
  cancelFrame();
  hero.dataset.dragging = '';
  draw();
});
listen(hero, 'pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const travel = event.clientY - drag.startY;
  if (Math.abs(travel) > 3) drag.moved = true;
  const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
  const instant = drag.unit.sign * (event.clientY - drag.lastY) / drag.unit.pixels / elapsed * 1000;
  drag.velocity = drag.velocity * 0.7 + instant * 0.3;
  drag.lastY = event.clientY;
  drag.lastTime = event.timeStamp;
  phase = drag.startPhase + drag.unit.sign * travel / drag.unit.pixels;
  targetPhase = Math.round(phase);
  draw();
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (hero.hasPointerCapture(event.pointerId)) hero.releasePointerCapture(event.pointerId);
  const { moved, velocity } = drag;
  drag = null;
  dragging = false;
  delete hero.dataset.dragging;
  if (moved) {
    targetPhase = Math.round(phase + Math.max(-1.5, Math.min(1.5, velocity * 0.18)));
    transition = { from: phase, to: targetPhase - 0.23, elapsed: 0, duration: 620 };
  }
  draw();
  resumeLoop();
}
listen(hero, 'pointerup', endDrag);
listen(hero, 'pointercancel', endDrag);
listen(settingsToggle, 'click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});
listen(document, 'keydown', event => {
  if (event.key === 'Escape' && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
    settingsToggle.focus();
  }
});
function renderCurve(axis) {
  const editor = document.querySelector(`[data-axis="${axis}"]`);
  const points = curves[axis];
  const coords = points.map((y, i) => [20 + i*200/3, 115-(y+0.5)/2*95]);
  editor.querySelector('.curve-grid').setAttribute('d', 'M20 15V120H220M20 91.25H220M20 43.75H220M120 15V120');
  editor.querySelector('.curve-line').setAttribute('d', `M${coords[0]} C${coords[1]} ${coords[2]} ${coords[3]}`);
  editor.querySelectorAll('circle').forEach((circle, i) => {
    circle.setAttribute('cy', coords[i][1]);
    circle.setAttribute('aria-valuenow', Math.round(points[i]*100));
  });
}
for (const axis of Object.keys(curves)) {
  const editor = document.querySelector(`[data-axis="${axis}"]`);
  const svg = editor.querySelector('svg');
  const group = editor.querySelector('.curve-handles');
  for (let i=0; i<4; i++) {
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    for (const [key,value] of Object.entries({cx:20+i*200/3,cy:67.5,r:8,tabindex:0,role:'slider','aria-label':`${axis.toUpperCase()} 曲线控制点 ${i+1}`,'aria-valuemin':-50,'aria-valuemax':150})) point.setAttribute(key,value);
    group.appendChild(point);
    const change = value => {
      curves[axis][i] = Math.max(-0.5, Math.min(1.5, value));
      document.querySelector('#copy-status').textContent = '';
      renderCurve(axis); draw();
    };
    let dragging = false;
    listen(point, 'pointerdown', event => { event.preventDefault(); dragging = true; point.setPointerCapture(event.pointerId); });
    listen(point, 'pointermove', event => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      change((115-(event.clientY-rect.top)*140/rect.height)/95*2-0.5);
    });
    listen(point, 'pointerup', () => { dragging = false; });
    listen(point, 'pointercancel', () => { dragging = false; });
    listen(point, 'keydown', event => {
      if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      change(event.key === 'Home' ? -0.5 : event.key === 'End' ? 1.5 : curves[axis][i]+(event.key === 'ArrowUp' ? .05 : -.05));
    });
  }
  for (const button of editor.querySelectorAll('[data-curve-preset]')) listen(button, 'click', () => {
    curves[axis] = button.dataset.curvePreset === 'flat' ? [.5,.5,.5,.5] : [1,1,0,0];
    document.querySelector('#copy-status').textContent = '';
    renderCurve(axis); draw();
  });
  renderCurve(axis);
}
listen(showTimelineInput, 'change', () => {
  document.querySelector('#copy-status').textContent = '';
  document.querySelector('#copy-fallback').hidden = true;
  settings.showTimeline = showTimelineInput.checked;
  applyTimelineVisibility();
});
for (const name of Object.keys(DEFAULTS)) {
  if (name === 'showTimeline') continue;
  const input = document.querySelector(`#${name}`);
  listen(input, 'input', () => {
    document.querySelector('#copy-status').textContent = '';
    document.querySelector('#copy-fallback').hidden = true;
    settings[name] = Number(input.value);
    document.querySelector(`#${name}-value`).value = (name === 'speed' || name === 'autoSpeed' || name === 'rotation') ? `${settings[name].toFixed(name === 'rotation' ? 2 : 1)}×` : name === 'frontalSeconds' ? `${settings[name]} 秒` : (name === 'positionX' || name === 'positionY') ? `${settings[name]}%` : name === 'scaleFalloff' ? `${Math.round(settings[name]*100)}%` : name === 'blur' ? `${settings[name]} px` : (name === 'lightAngle' || name === 'clockwiseAngle') ? `${settings[name]}°` : settings[name].toFixed(name === 'thickness' ? 3 : 2);
    draw();
  });
}
listen(document.querySelector('#reset-settings'), 'click', () => {
  document.querySelector('#copy-status').textContent = '';
  document.querySelector('#copy-fallback').hidden = true;
  scrubCycle = null;
  Object.assign(settings, DEFAULTS);
  for (const axis of Object.keys(curves)) { curves[axis] = [...DEFAULT_CURVES[axis]]; renderCurve(axis); }
  for (const name of Object.keys(DEFAULTS)) {
    if (name === 'showTimeline') continue;
    document.querySelector(`#${name}`).value = settings[name];
    document.querySelector(`#${name}-value`).value = (name === 'speed' || name === 'autoSpeed' || name === 'rotation') ? `${settings[name].toFixed(name === 'rotation' ? 2 : 1)}×` : name === 'frontalSeconds' ? `${settings[name]} 秒` : (name === 'positionX' || name === 'positionY') ? `${settings[name]}%` : name === 'scaleFalloff' ? `${Math.round(settings[name]*100)}%` : name === 'blur' ? `${settings[name]} px` : (name === 'lightAngle' || name === 'clockwiseAngle') ? `${settings[name]}°` : settings[name].toFixed(name === 'thickness' ? 3 : 2);
  }
  showTimelineInput.checked = settings.showTimeline;
  applyTimelineVisibility();
  cancelFrame(); transition = null; targetPhase = DEFAULT_ALBUM_INDEX; phase = DEFAULT_ALBUM_INDEX - 0.23;draw();resumeLoop();
});
listen(document, 'visibilitychange', () => { if (document.hidden) cancelFrame(); else resumeLoop(); });
listen(reducedMotion, 'change', () => {
  if (reducedMotion.matches) {
    autoPaused = true; phase = Math.round(phase); transition = null; cancelFrame();draw();
    document.querySelector('#toggle-auto').textContent = '继续滚动';
  }
});
listen(window, 'pagehide', event => {
  cancelFrame();
  if (event.persisted) return;
  disposed = true;
  abort.abort();
  resizeObserver?.disconnect();intersectionObserver?.disconnect();
  geometry?.dispose();infoGeometry?.dispose();
  for (const album of albums) for (const material of Object.values(album.materials)) material.dispose();
  for (const texture of textures) texture.dispose();
  renderer?.dispose();
});
listen(window, 'pageshow', event => { if (event.persisted) { resize();resumeLoop(); } });

listen(document.querySelector('#copy-settings'), 'click', async () => {
  const feedback = document.querySelector('#copy-status');
  const text = JSON.stringify({ ...settings, palette: EDGE_PALETTE, albumIndex: targetPhase, transition: 'easeInOutCubic', durationMs: SWITCH_DURATION_MS / settings.speed, spacingCurves: { x: curves.x, y: curves.y, z: curves.z }, rotationCurve: curves.rotation, clockwiseCurve: curves.clockwise, blurCurve: curves.blur, scaleCurve: curves.scale, autoDownSeconds: AUTO_DOWN_SECONDS }, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    feedback.textContent = '效果参数已复制';
  } catch {
    feedback.textContent = '请选择并复制下方参数';
    const field = document.querySelector('#copy-fallback');
    field.hidden = false; field.value = text; field.focus(); field.select();
  }
});

let art = [];
async function start() {
  document.querySelector('#toggle-auto').textContent = autoPaused ? '继续滚动' : '暂停滚动';
  if (!songs.length) { fallback('专辑暂时无法加载，请刷新重试。');return; }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor('#0E0807', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    camera.position.set(0, 0, 14);
    scene.add(new THREE.HemisphereLight('#f3efff', '#65534b', 1.65));
    keyLight = new THREE.DirectionalLight('#fff7ee', 2.1);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight('#d7c4ef', 0.8);
    rim.position.set(6, -1, 3);scene.add(rim);
    resize();
    const loader = new THREE.TextureLoader();
    await Promise.all(['500 86px "Neue Montreal"', '62px "Neue Montreal"'].map(font => document.fonts?.load(font).catch(() => {})));
    art = await Promise.all(songs.map(async song => ({
      front: squareCoverTexture(await loader.loadAsync(assetURL(song.image))),
      back: printedTexture(song),
      info: await infoTexture(song),
    })));
    if (disposed) { for (const texture of textures) texture.dispose();return; }
    geometry = new RoundedBoxGeometry(COVER_SIZE, COVER_SIZE, 1, 2, 0.014);
    // Evaluate all four stops per pixel. Vertex colours skipped the orange
    // stop on the long, sparsely tessellated side faces.
    const palette = EDGE_PALETTE.map(value => new THREE.Color(value));
    function edgeMaterial() {
      const material = new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0, transparent: true });
      material.onBeforeCompile = shader => {
        palette.forEach((color, i) => { shader.uniforms[`edgeColor${i}`] = { value: color }; });
        shader.vertexShader = 'varying float vEdgePosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vEdgePosition = (abs(normal.x) > abs(normal.y) ? position.y : position.x) / ${COVER_SIZE} + 0.5;
        `);
        shader.fragmentShader = `varying float vEdgePosition;
          uniform vec3 edgeColor0; uniform vec3 edgeColor1;
          uniform vec3 edgeColor2; uniform vec3 edgeColor3;
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float edgeT = clamp(vEdgePosition, 0.0, 1.0) * 3.0;
          vec3 edgeTint = edgeT < 1.0
            ? mix(edgeColor0, edgeColor1, smoothstep(0.0, 1.0, edgeT))
            : edgeT < 2.0
              ? mix(edgeColor1, edgeColor2, smoothstep(1.0, 2.0, edgeT))
              : mix(edgeColor2, edgeColor3, smoothstep(2.0, 3.0, edgeT));
          diffuseColor.rgb *= edgeTint;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += edgeTint * 0.2;');
      };
      material.customProgramCacheKey = () => 'four-stop-album-edge-v1';
      return material;
    }
    function focusMaterial(material) {
      const blur = { value: new THREE.Vector2() };
      material.userData.blur = blur;
      material.onBeforeCompile = shader => {
        shader.uniforms.albumBlurRadius = blur;
        shader.fragmentShader = 'uniform vec2 albumBlurRadius;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 sampledDiffuseColor = vec4(0.0);
            if (albumBlurRadius.x < 0.00001) {
              sampledDiffuseColor = texture2D(map, vMapUv);
            } else {
              for (int x = -2; x <= 2; x++) {
                for (int y = -2; y <= 2; y++) {
                  float weight = exp(-float(x*x+y*y)/2.0);
                  sampledDiffuseColor += texture2D(map, clamp(vMapUv + vec2(float(x),float(y))*albumBlurRadius, vec2(0.001), vec2(0.999))) * weight;
                }
              }
              sampledDiffuseColor /= 6.168924;
            }
            diffuseColor *= sampledDiffuseColor;
          #endif
        `);
      };
      material.customProgramCacheKey = () => 'album-focus-gaussian-v1';
      return material;
    }
    const infoHeight = COVER_SIZE * INFO_HEIGHT / INFO_WIDTH;
    infoGeometry = new THREE.PlaneGeometry(COVER_SIZE, infoHeight);
    infoGeometry.translate(0, -COVER_SIZE / 2 - INFO_GAP * COVER_SIZE - infoHeight / 2, 0.5);
    for (let index = 0; index < ALBUM_COUNT; index++) {
      const materials = {
        edge: edgeMaterial(),
        front: focusMaterial(new THREE.MeshPhysicalMaterial({ map: art[0].front, roughness: 0.54, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.45, transparent: true })),
        back: focusMaterial(new THREE.MeshStandardMaterial({ map: art[0].back, roughness: 0.65, transparent: true })),
        info: new THREE.MeshBasicMaterial({ map: art[0].info, transparent: true, depthWrite: false, toneMapped: false }),
      };
      const mesh = new THREE.Mesh(geometry, [materials.edge, materials.edge, materials.edge, materials.edge, materials.front, materials.back]);
      mesh.add(new THREE.Mesh(infoGeometry, materials.info));
      scene.add(mesh);albums.push({ mesh, materials, songIndex: -1, distance: Infinity });
    }
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.appendChild(renderer.domElement);
    listen(renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault();fallback('3D 画面已暂停，请刷新恢复。');
    });
    ready = true;
    resize();
    await renderer.compileAsync(scene, camera);
    if (disposed) return;
    draw();
    stage.dataset.renderer = 'webgl';
    // Reveal the first frame while the album timeline starts moving.
    const reveal = renderer.domElement.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reducedMotion.matches ? 0 : 450,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    });
    previous.disabled = next.disabled = settingsToggle.disabled = scrubber.disabled = false;
    resizeObserver = new ResizeObserver(resize);resizeObserver.observe(hero);
    intersectionObserver = new IntersectionObserver(([entry]) => {
      insideViewport = entry.isIntersecting;
      if (insideViewport) resumeLoop();else cancelFrame();
    });intersectionObserver.observe(hero);
    resize();resumeLoop();
    startHeroAmbient({ hero, getFrontalRect: frontalAlbumRect, signal: abort.signal });
    await reveal.finished;
    if (disposed) { reveal.cancel(); return; }
    renderer.domElement.style.opacity = '1';
    reveal.cancel();
  } catch (error) {
    console.error('Hero scene could not start:', error);
    fallback('当前浏览器显示静态封面。');
    renderer?.dispose();
  }
}
start();
