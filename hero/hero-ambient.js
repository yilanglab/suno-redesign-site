const GENRES = ['Brass band', 'Dancehall', 'Tango', 'Synthpop', 'Math Rock', 'Future bass', 'Afrobeats', 'Techno', 'Samba', 'Drill', 'Dubstep', 'Ambient techno', 'Americana', 'Disco', 'Reggae', 'R&B', 'Soul', 'Funk', 'Country', 'Dream Pop', 'Synthwave', 'Classical', 'Lo-Fi', 'Hip Hop'];
const PROMPTS = ['Make any song you can imagine', 'Make a country song about Jess being late', 'Make a house song about quitting your job', 'Make a jazz song about watering my plants'];
const SEND_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const SHOW_GENRE_TAGS = false;
const MAX_TAGS = 5;
const TYPE_MS = 48;
const random = (min, max) => min + Math.random() * (max - min);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

export function startHeroAmbient({ hero, getFrontalRect, signal }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'hero-ambient';
  layer.setAttribute('aria-hidden', 'true');
  hero.insertBefore(layer, hero.querySelector('.hero-copy'));
  const copy = hero.querySelector('.hero-copy');
  const promptSlot = hero.querySelector('.hero-prompt');
  const nav = hero.querySelector('.playground-footer:not([hidden]) .motion-tools');
  const tags = new Set();
  let prompt = null;
  let genreBag = [];

  const active = () => !signal.aborted && !document.hidden && !reduced.matches && hero.clientWidth > 700;
  const relative = element => {
    const box = element.getBoundingClientRect();
    const origin = hero.getBoundingClientRect();
    return { left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top };
  };
  function obstacles(except) {
    const list = [];
    const frontal = getFrontalRect();
    if (frontal) list.push({ rect: frontal, gap: 28 });
    if (nav) list.push({ rect: relative(nav), gap: 20 });
    const player = document.querySelector('.mini-player:not([hidden])');
    if (player) list.push({ rect: relative(player), gap: 24 });
    for (const tag of tags) if (tag.element !== except) list.push({ rect: tag.rect, gap: 14 });
    if (prompt && prompt.element !== except) list.push({ rect: prompt.rect, gap: 18 });
    return list;
  }
  function place(element, region) {
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const blockers = obstacles(element);
    for (let attempt = 0; attempt < 24; attempt++) {
      const left = random(region.left, Math.max(region.left, region.right - width));
      const top = random(region.top, Math.max(region.top, region.bottom - height));
      const rect = { left, top, right: left + width, bottom: top + height };
      if (rect.right > region.right || rect.bottom > region.bottom) continue;
      if (blockers.some(({ rect: other, gap }) => overlaps(rect, other, gap))) continue;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      return rect;
    }
    return null;
  }
  function nextGenre() {
    if (!genreBag.length) genreBag = GENRES.filter(name => ![...tags].some(tag => tag.name === name)).sort(() => Math.random() - 0.5);
    return genreBag.pop();
  }
  function removeTag(tag) {
    if (!tags.has(tag)) return;
    tags.delete(tag);
    clearTimeout(tag.timer);
    tag.element.classList.remove('is-visible');
    setTimeout(() => tag.element.remove(), 800);
  }
  function spawnTag() {
    if (!active() || tags.size >= MAX_TAGS) return;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const copyRight = copy ? relative(copy).right : width * 0.4;
    const element = document.createElement('span');
    element.className = 'genre-tag';
    element.textContent = nextGenre();
    layer.append(element);
    const rect = place(element, { left: Math.max(width * 0.48, copyRight + 40), right: width - 96, top: 104, bottom: height - 96 });
    if (!rect) { element.remove(); return; }
    const tag = { element, rect, name: element.textContent };
    tags.add(tag);
    requestAnimationFrame(() => element.classList.add('is-visible'));
    tag.timer = setTimeout(() => removeTag(tag), random(3200, 5600));
  }

  async function promptLoop() {
    let index = Math.floor(Math.random() * PROMPTS.length);
    while (!signal.aborted) {
      if (!active()) { await wait(1000); continue; }
      const text = document.documentElement.lang === 'zh-CN' && document.querySelector('#hero-experience') ? ['把你想象的声音写成歌', '写一首关于朋友迟到的乡村歌曲', '写一首关于辞职的浩室舞曲', '写一首给植物浇水的爵士歌曲'][index] : PROMPTS[index];
      index = (index + 1) % PROMPTS.length;
      const element = document.createElement('div');
      element.className = 'typed-prompt';
      element.innerHTML = `<span class="typed-frame"></span><span class="typed-text"><span class="typed-value"></span><span class="typed-caret"></span></span><span class="typed-send">${SEND_ICON}</span>`;
      const typed = element.querySelector('.typed-value');
      typed.textContent = text;
      promptSlot.append(element);
      // Measured with the full sentence and send button so the frame fits exactly once typing ends.
      element.style.width = `${element.offsetWidth}px`;
      typed.textContent = '';
      prompt = { element, rect: relative(element) };
      for (let n = 1; n <= text.length && !signal.aborted; n++) {
        typed.textContent = text.slice(0, n);
        await wait(TYPE_MS + random(-14, 26));
      }
      await wait(450);
      element.classList.add('is-composed');
      await wait(1300);
      element.classList.add('is-sending');
      await wait(260);
      element.classList.add('is-sent');
      await wait(800);
      element.remove();
      prompt = null;
      await wait(random(600, 1400));
    }
  }

  async function tagLoop() {
    while (!signal.aborted) {
      spawnTag();
      await wait(random(900, 1700));
    }
  }
  signal.addEventListener('abort', () => layer.remove());
  if (promptSlot) promptLoop();
  if (!SHOW_GENRE_TAGS) return;
  // Albums keep moving, so tags that end up under the frontal album leave early.
  const guard = setInterval(() => {
    const frontal = getFrontalRect();
    if (!frontal) return;
    for (const tag of tags) if (overlaps(tag.rect, frontal, 8)) removeTag(tag);
  }, 400);
  signal.addEventListener('abort', () => clearInterval(guard));
  tagLoop();
}
