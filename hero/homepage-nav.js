export function setupHomepageNav(host) {
  const header = host.querySelector('.site-header');
  const hero = host.querySelector('.hero');
  header.classList.add('nav-initializing');
  const brand = document.createElement('a');
  brand.className = 'nav-scroll-brand';
  brand.href = '#top';
  brand.setAttribute('aria-label', 'Suno，返回首页');
  const brandImage = document.createElement('img');
  brandImage.src = host.querySelector('.wordmark').src;
  brandImage.alt = '';
  brandImage.width = 82;
  brandImage.height = 21;
  brand.append(brandImage);
  header.querySelector('.nav-inner').prepend(brand);
  brand.addEventListener('click', event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  const english = document.documentElement.lang === 'en';
  const languageTrigger = header.querySelector('.language-trigger');
  languageTrigger.setAttribute('aria-label', english ? 'Choose language' : '选择语言');
  header.querySelectorAll('.language-card a').forEach(link => {
    const current = link.lang === (english ? 'en' : 'zh-CN');
    if (current) link.setAttribute('aria-current', 'page');
    link.href = link.getAttribute('href') + location.hash;
  });
  const mobileToggle = header.querySelector('.mobile-toggle');
  const mobileMenu = document.createElement('nav');
  mobileMenu.className = 'mobile-navigation';
  mobileMenu.id = 'mobile-navigation';
  mobileMenu.setAttribute('aria-label', english ? 'Main navigation' : '主导航');
  mobileMenu.hidden = true;
  mobileMenu.innerHTML = `<details><summary>Products</summary>${[['V6 Models','v6'],['Studio','studio-welcome'],['Voices','voices'],['Stem Separation','stem-separation'],['Remix','remix-welcome'],['Custom Models','custom-models']].map(([label,path]) => `<a href="https://suno.com/${path}">${label}</a>`).join('')}</details><details><summary>Resources</summary>${[['About','https://suno.com/about'],['Blog','https://suno.com/blog'],['Release Notes','https://suno.com/blog'],['Safety','https://suno.com/safety'],['Community Guidelines','https://suno.com/community-guidelines'],['Contact Us','https://help.suno.com/en/articles/2551617'],['Help','https://help.suno.com/']].map(([label,url]) => `<a href="${url}">${label}</a>`).join('')}</details><a href="#pricing" data-mobile-pricing>Pricing</a><a href="https://suno.com/careers">Careers</a>`;
  header.append(mobileMenu);
  mobileToggle.setAttribute('aria-controls', mobileMenu.id);
  mobileToggle.setAttribute('aria-expanded', 'false');
  function closeMobileMenu() {
    mobileMenu.hidden = true;
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.setAttribute('aria-label', english ? 'Open menu' : '打开菜单');
  }
  closeMobileMenu();
  mobileToggle.addEventListener('click', () => {
    const opening = mobileMenu.hidden;
    header.dispatchEvent(new Event('nav-dismiss'));
    mobileMenu.hidden = !opening;
    mobileToggle.setAttribute('aria-expanded', String(opening));
    mobileToggle.setAttribute('aria-label', opening ? (english ? 'Close menu' : '关闭菜单') : (english ? 'Open menu' : '打开菜单'));
  });
  document.addEventListener('pointerdown', event => { if (!header.contains(event.target)) closeMobileMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileMenu.hidden) { closeMobileMenu(); mobileToggle.focus(); }
  });
  mobileMenu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link.hasAttribute('data-mobile-pricing')) {
      const pricing = document.querySelector('#pricing');
      if (pricing) { event.preventDefault(); pricing.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' }); }
      else link.href = '/suno-redesign-site/suno-redesign/zh/#pricing';
    }
    closeMobileMenu();
  });
  window.addEventListener('resize', () => { if (innerWidth > 1100) closeMobileMenu(); });
  const joinSlot = document.createElement('div');
  joinSlot.className = 'nav-join-slot';
  joinSlot.innerHTML = '<a class="pill nav-join" href="https://suno.com/create">Join Suno for Free</a>';
  header.querySelector('.account').append(joinSlot);
  let scrollFrame = 0;
  function updateHeaderSurface() {
    scrollFrame = 0;
    const overContent = hero.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
    if (overContent !== header.classList.contains('is-over-content')) header.dispatchEvent(new Event('nav-dismiss'));
    header.classList.toggle('is-over-content', overContent);
    joinSlot.inert = !overContent;
    joinSlot.setAttribute('aria-hidden', String(!overContent));
    brand.inert = !overContent;
    brand.setAttribute('aria-hidden', String(!overContent));
  }
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeaderSurface);
  }, { passive: true });
  window.addEventListener('resize', updateHeaderSurface);
  updateHeaderSurface();
  document.fonts.ready.then(() => requestAnimationFrame(() => {
    updateHeaderSurface();
    requestAnimationFrame(() => header.classList.remove('nav-initializing'));
  }));
  const surface = document.createElement('div');
  surface.className = 'nav-surface';
  surface.setAttribute('aria-hidden', 'true');
  header.prepend(surface);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let animation;
  let active = null;
  const contentAnimations = new Map();
  function animateContent(panel, entering, direction) {
    const running = contentAnimations.get(panel);
    const current = getComputedStyle(panel);
    const from = running
      ? { opacity: current.opacity, transform: current.transform, filter: current.filter, visibility: 'visible' }
      : { opacity: entering ? 0 : 1, transform: `translateX(${entering ? direction * 28 : 0}px)`, filter: entering ? 'blur(6px)' : 'blur(0px)', visibility: 'visible' };
    running?.cancel();
    const motion = panel.animate([from, {
      opacity: entering ? 1 : 0,
      transform: `translateX(${entering ? 0 : -direction * 28}px)`,
      filter: entering ? 'blur(0px)' : 'blur(6px)', visibility: 'visible',
    }], { duration: entering ? 240 : 180, easing: 'cubic-bezier(.22,1,.36,1)' });
    contentAnimations.set(panel, motion);
    motion.onfinish = () => { if (contentAnimations.get(panel) === motion) contentAnimations.delete(panel); };
  }
  function place(item, keyboard = false) {
    if (!item?.querySelector('.mega, .app-card, .language-card')) {
      for (const motion of contentAnimations.values()) motion.cancel();
      contentAnimations.clear();
      active = null;
      surface.classList.remove('is-open');
      return;
    }
    const previous = surface.getBoundingClientRect();
    const wasOpen = surface.classList.contains('is-open');
    const panel = item.querySelector('.mega, .app-card, .language-card');
    const trigger = item.querySelector(':scope > button').getBoundingClientRect();
    const parent = header.getBoundingClientRect();
    const width = panel.offsetWidth;
    const utility = !item.classList.contains('nav-item');
    const desiredX = trigger.left - parent.left - (utility ? 0 : 24);
    const x = Math.max(0, Math.min(desiredX, parent.width - width));
    const originX = utility ? item.getBoundingClientRect().left - parent.left : 0;
    panel.style.left = `${x - originX}px`;
    panel.style.right = 'auto';
    const height = panel.offsetHeight;
    animation?.cancel();
    Object.assign(surface.style, { left: `${x}px`, width: `${width}px`, height: `${height}px` });
    surface.classList.add('is-open');
    if (wasOpen && active !== item && !keyboard && !reduced.matches) {
      const direction = trigger.left > active.querySelector(':scope > button').getBoundingClientRect().left ? 1 : -1;
      animateContent(active.querySelector('.mega, .app-card, .language-card'), false, direction);
      animateContent(panel, true, direction);
      const target = surface.getBoundingClientRect();
      animation = surface.animate([
        { transform: `translate(${previous.left-target.left}px,${previous.top-target.top}px) scale(${previous.width/width},${previous.height/height})` },
        { transform: 'none' },
      ], { duration: 240, easing: 'cubic-bezier(.4,0,.2,1)' });
    }
    active = item;
  }
  header.addEventListener('nav-change', event => place(event.detail.item, event.detail.keyboard));
  window.addEventListener('resize', () => { if (active) place(active, true); });
  const pricing = [...header.querySelectorAll('.desktop-nav > button')].find(button => ['Pricing', '套餐'].includes(button.textContent.trim()));
  pricing?.addEventListener('click', () => {
    header.dispatchEvent(new Event('nav-dismiss'));
    const section = document.querySelector('#pricing');
    if (section) section.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    else location.assign('../suno-redesign-site/suno-redesign/#pricing');
  });
}
