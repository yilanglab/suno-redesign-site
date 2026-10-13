const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.4-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5Z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
const formatTime = seconds => {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export { PLAY_ICON, PAUSE_ICON };

export function createPlayer({ songs, resolve, signal }) {
  const audio = new Audio();
  audio.preload = 'none';
  const root = document.createElement('aside');
  root.className = 'mini-player';
  root.setAttribute('aria-label', '正在播放');
  root.hidden = true;
  const cover = new Image(48, 48);
  cover.className = 'mini-player-cover';
  cover.alt = '';
  cover.src = resolve(songs[0].image);
  root.innerHTML = `
    <div class="mini-player-meta"><strong class="mini-player-title"></strong><span class="mini-player-artist"></span></div>
    <button class="mini-player-toggle" type="button" aria-label="暂停">${PAUSE_ICON}</button>
    <button class="mini-player-close" type="button" aria-label="关闭播放器"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <div class="mini-player-progress">
      <span class="mini-player-time" data-time="current">0:00</span>
      <input class="mini-player-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="播放进度">
      <span class="mini-player-time" data-time="duration">0:00</span>
    </div>`;
  root.prepend(cover);
  (document.querySelector('#hero-experience') || document.body).append(root);
  const $ = selector => root.querySelector(selector);
  const toggle = $('.mini-player-toggle');
  const seek = $('.mini-player-seek');
  const listeners = new Set();
  let current = -1;
  let seeking = false;

  const emit = () => { for (const callback of listeners) callback(); };
  function renderState() {
    const playing = !audio.paused;
    toggle.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    toggle.setAttribute('aria-label', playing ? '暂停' : '播放');
    root.dataset.playing = String(playing);
    emit();
  }
  function renderTime() {
    const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
    if (!seeking) seek.value = Math.round(ratio * 1000);
    seek.style.setProperty('--progress', `${ratio * 100}%`);
    $('[data-time="current"]').textContent = formatTime(audio.currentTime);
    $('[data-time="duration"]').textContent = formatTime(audio.duration);
  }
  function show() {
    if (!root.hidden) return;
    root.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-visible')));
  }
  function close() {
    audio.pause();
    current = -1;
    root.classList.remove('is-visible');
    setTimeout(() => { if (current === -1) root.hidden = true; }, 320);
    emit();
  }
  function play(index) {
    if (index === current) {
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
      return;
    }
    const song = songs[index];
    current = index;
    audio.src = resolve(song.audio);
    cover.src = resolve(song.image);
    $('.mini-player-title').textContent = song.title;
    $('.mini-player-artist').textContent = song.artistName;
    renderTime();
    show();
    audio.play().catch(() => renderState());
    emit();
  }

  const on = (target, type, callback) => target.addEventListener(type, callback, { signal });
  on(audio, 'play', () => document.dispatchEvent(new Event('hero-audio-play')));
  on(document, 'homepage-media-play', () => audio.pause());
  for (const type of ['play', 'pause', 'ended']) on(audio, type, renderState);
  for (const type of ['timeupdate', 'loadedmetadata', 'durationchange']) on(audio, type, renderTime);
  on(toggle, 'click', () => play(current));
  on($('.mini-player-close'), 'click', close);
  on(seek, 'input', () => {
    seeking = true;
    if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
    renderTime();
  });
  on(seek, 'change', () => { seeking = false; });
  signal.addEventListener('abort', () => { audio.pause(); root.remove(); });

  return {
    play,
    isPlaying: index => index === current && !audio.paused,
    subscribe: callback => listeners.add(callback),
  };
}
