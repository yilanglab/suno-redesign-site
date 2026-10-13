(() => {
  'use strict';

  const content = window.SUNO_REDESIGN_CONTENT || {};
  const songs = Array.isArray(content.songs) ? content.songs : [];
  const socials = Array.isArray(content.socials) ? content.socials : [];
  const plans = Array.isArray(content.plans?.items) ? content.plans.items : [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const icon = (name, className = '') => `<svg aria-hidden="true"${className ? ` class="${className}"` : ''}><use href="#i-${name}"/></svg>`;
  const count = (value) => Number(value) >= 1000000 ? `${(Number(value) / 1000000).toFixed(1)}M` : Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}K` : String(value ?? '');
  const formatTime = (value) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '—:—';
  const audio = $('#song-audio');
  const video = $('#social-video');
  document.addEventListener('hero-audio-play', () => { audio.pause(); video.pause(); });
  for (const media of [audio, video]) media.addEventListener('play', () => document.dispatchEvent(new Event('homepage-media-play')));
  let currentSong = null;
  let billing = 'yearly';
  let lastDialogFocus = null;
  let activeDialog = null;
  let playbackRequest = 0;

  function announce(message) { $('#announcer').textContent = message; }

  function renderSocials() {
    const filmstrip = $('#social-filmstrip');
    const cards = (duplicate = false) => socials.map((social, index) => `<article class="social-card"><button class="social-art" data-open-video="${index}"${duplicate ? ' tabindex="-1"' : ''} aria-label="播放 ${escape(social.handle)} 的创作案例视频"><img src="${escape(social.poster)}" alt="${escape(social.handle)} 的原视频画面" loading="lazy" width="228" height="342"><span class="social-stats"><span>${icon('play')}${escape(social.plays)}</span><span>${icon('heart')}${escape(social.likes)}</span></span><span class="social-play">${icon('play')}</span></button><div class="social-caption"><a href="${escape(social.href)}"${duplicate ? ' tabindex="-1"' : ''} target="_blank" rel="noopener noreferrer">${escape(social.handle)}${icon('external')}</a></div></article>`).join('');
    filmstrip.innerHTML = `<div class="social-marquee-track"><div class="social-marquee-group">${cards()}</div><div class="social-marquee-group" aria-hidden="true">${cards(true)}</div></div>`;
    const observer = new IntersectionObserver(([entry]) => {
      filmstrip.classList.toggle('is-offscreen', !entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(filmstrip);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') filmstrip.classList.add('is-keyboard-mode');
    });
    document.addEventListener('visibilitychange', () => filmstrip.classList.toggle('is-page-hidden', document.hidden));
    // Focus can scroll the clipped viewport to reveal an offscreen card.
    // Restore the seamless track when keyboard interaction leaves the region.
    filmstrip.addEventListener('focusout', (event) => {
      if (!filmstrip.contains(event.relatedTarget)) filmstrip.scrollLeft = 0;
    });
  }

  const featureList = (features) => `<ul class="plan-features">${features.map((feature) => `<li>${icon('check')}<span>${escape(feature)}</span></li>`).join('')}</ul>`;

  const billingBar = $('.billing-toggle');
  const billingPill = $('.t-tabs-pill', billingBar);
  function moveBillingPill(animate = false) {
    const selected = $('[data-billing].is-active', billingBar);
    const previous = billingPill.style.transition;
    if (!animate) billingPill.style.transition = 'none';
    billingPill.style.transform = `translateX(${selected.offsetLeft}px)`;
    billingPill.style.width = `${selected.offsetWidth}px`;
    if (!animate) { void billingPill.offsetWidth; billingPill.style.transition = previous; }
  }
  new ResizeObserver(() => moveBillingPill()).observe(billingBar);
  document.fonts.ready.then(() => moveBillingPill());

  function renderPlanDetails() {
    $('#pricing-details').innerHTML = plans.map((plan) => {
      const free = plan.name === 'Free';
      return `<article class="plan-detail${plan.name === 'Pro' ? ' featured' : ''}${free ? ' starter' : ''}"><div class="plan-top"><h3>${free ? 'Starter' : escape(plan.name)}</h3>${plan.badge ? `<span class="plan-badge">${escape(plan.badge)}</span>` : ''}</div><p class="plan-desc">${escape(plan.description)}</p><div class="plan-price"><strong>${free ? '免费' : `$${escape(plan[billing])}`}</strong>${free ? '' : '<small>/ 月</small>'}</div><p class="plan-price-note">${free ? '无需订阅' : billing === 'yearly' ? (document.documentElement.lang === 'en' ? `$${escape(plan.yearlyTotal)} per year, billed annually` : `每年 $${escape(plan.yearlyTotal)}，按年计费`) : '按月计费'}</p><a class="button" href="${free ? 'https://suno.com/create' : 'https://suno.com/pricing'}" target="_blank" rel="noopener noreferrer">${free ? '开始免费创作' : '立即订阅'}</a>${featureList(plan.features || [])}${plan.excluded?.length ? `<ul class="plan-excluded">${plan.excluded.map((feature) => `<li>${escape(feature)}</li>`).join('')}</ul>` : ''}</article>`;
    }).join('');
    $('#billing-note').textContent = billing === 'yearly' ? '按年计费，以下显示折合每月价格。税费在结账时计算。' : '按月计费。税费在结账时计算。';
    $$('[data-billing]').forEach((button) => {
      const selected = button.dataset.billing === billing;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function updatePlaybackUI() {
    const playing = currentSong !== null && !audio.paused && !audio.ended;
    $$('[data-play-song]').forEach((button) => {
      const index = Number(button.dataset.playSong);
      const selected = playing && index === currentSong;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? '暂停' : '试听'} ${songs[index]?.title || ''}，${songs[index]?.artistName || ''}`);
      $('.song-play', button).innerHTML = icon(selected ? 'pause' : 'play');
      button.closest('.song-card').classList.toggle('is-playing', selected);
    });
    $('#player-play').innerHTML = icon(playing ? 'pause' : 'play');
    $('#player-play').setAttribute('aria-label', playing ? '暂停播放' : '继续播放');
  }

  async function playSong(index) {
    const song = songs[index];
    if (!song?.audio) { announce('这首作品暂时无法试听，请选择另一首。'); return; }
    if (currentSong === index && !audio.paused) { audio.pause(); return; }
    const request = ++playbackRequest;
    video.pause();
    $('#mini-player').hidden = false;
    document.body.classList.add('player-open');
    $('#player-status').textContent = '正在载入…';
    if (currentSong !== index) {
      audio.pause();
      currentSong = index;
      audio.src = song.audio;
      $('#player-cover').src = song.image;
      $('#player-cover').alt = `${song.title} 的作品封面`;
      $('#player-title').textContent = song.title;
      $('#player-artist').textContent = song.artistName;
      $('#player-current').textContent = '0:00';
      $('#player-duration').textContent = '—:—';
      $('#player-seek').value = 0;
      audio.load();
    }
    updatePlaybackUI();
    try {
      await audio.play();
      if (request === playbackRequest) { $('#player-status').textContent = ''; announce(`正在播放 ${song.title}，${song.artistName}`); }
    } catch (error) {
      if (request !== playbackRequest || error.name === 'AbortError') return;
      $('#player-status').textContent = '无法播放，请点击播放重试或换一首。';
      announce('音频无法播放，请重试或选择另一首。');
      updatePlaybackUI();
    }
  }

  function closePlayer() {
    playbackRequest += 1;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    currentSong = null;
    $('#mini-player').hidden = true;
    document.body.classList.remove('player-open');
    updatePlaybackUI();
    const firstSong = $('[data-play-song]');
    firstSong?.focus({ preventScroll: true });
  }

  audio.addEventListener('play', updatePlaybackUI);
  audio.addEventListener('pause', updatePlaybackUI);
  audio.addEventListener('ended', () => { updatePlaybackUI(); $('#player-status').textContent = '播放完毕'; });
  audio.addEventListener('loadstart', () => $('#mini-player').classList.add('is-loading'));
  audio.addEventListener('playing', () => { $('#mini-player').classList.remove('is-loading'); $('#player-status').textContent = ''; });
  audio.addEventListener('waiting', () => { if (currentSong !== null) $('#player-status').textContent = '正在缓冲…'; });
  audio.addEventListener('error', () => { if (currentSong !== null) { $('#player-status').textContent = '音频暂时不可用，请重试或换一首。'; $('#mini-player').classList.remove('is-loading'); } });
  audio.addEventListener('loadedmetadata', () => { $('#player-duration').textContent = formatTime(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    const duration = audio.duration;
    $('#player-current').textContent = formatTime(audio.currentTime);
    if (Number.isFinite(duration) && duration > 0) $('#player-seek').value = (audio.currentTime / duration) * 100;
    $('#player-seek').setAttribute('aria-valuetext', `${formatTime(audio.currentTime)}，总时长 ${formatTime(duration)}`);
  });
  $('#player-seek').addEventListener('input', (event) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
  });
  $('#player-play').addEventListener('click', () => { if (currentSong !== null) playSong(currentSong); });
  $('#player-next').addEventListener('click', () => { if (songs.length) playSong(currentSong === null ? 0 : (currentSong + 1) % songs.length); });
  $('#player-close').addEventListener('click', closePlayer);

  function openDialog(dialog) {
    if (activeDialog) activeDialog.close();
    lastDialogFocus = document.activeElement;
    activeDialog = dialog;
    document.body.classList.add('dialog-open');
    dialog.showModal();
    $('[data-close-dialog]', dialog)?.focus({ preventScroll: true });
  }

  function onDialogClose(dialog) {
    if (dialog.id === 'video-dialog') {
      video.pause();
      video.removeAttribute('src');
      video.load();
      $('#video-status').textContent = '';
    }
    if (activeDialog === dialog) {
      activeDialog = null;
      document.body.classList.remove('dialog-open');
      if (lastDialogFocus?.isConnected) lastDialogFocus.focus({ preventScroll: true });
    }
  }

  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => onDialogClose(dialog));
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = $$('a[href],button:not([disabled]),input:not([disabled]),video[controls],[tabindex="0"]', dialog).filter((element) => !element.hidden && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  });

  const videoDialog = $('#video-dialog');
  const viewer = document.createElement('div');
  viewer.className = 'video-viewer';
  videoDialog.append(viewer);
  viewer.append(video, $('#video-original'));
  let videoSource = null, viewerMotion = null, closingVideo = false;
  const reducedVideoMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function sourceTransform() {
    const from = videoSource?.getBoundingClientRect(), to = viewer.getBoundingClientRect();
    if (!from || !to.width || !to.height) return 'scale(.97)';
    return `translate(${from.left-to.left}px, ${from.top-to.top}px) scale(${from.width/to.width}, ${from.height/to.height})`;
  }
  function closeVideo(animate = true) {
    if (closingVideo || !videoDialog.open) return;
    closingVideo = true;
    video.pause();
    const current = getComputedStyle(viewer).transform;
    viewerMotion?.cancel();
    videoDialog.classList.remove('is-viewing');
    if (!animate || reducedVideoMotion.matches) { videoDialog.close(); closingVideo = false; return; }
    viewerMotion = viewer.animate([{transform:current,opacity:1},{transform:sourceTransform(),opacity:0}], {duration:220,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    viewerMotion.onfinish = () => { videoDialog.close(); viewerMotion.cancel(); closingVideo = false; };
  }
  videoDialog.addEventListener('cancel', event => { event.preventDefault(); closeVideo(false); });
  videoDialog.addEventListener('click', event => { if (!viewer.contains(event.target)) closeVideo(); });
  videoDialog.addEventListener('close', () => {
    viewerMotion?.cancel(); videoSource?.style.removeProperty('visibility');
    videoDialog.classList.remove('is-viewing'); closingVideo = false;
  });
  video.addEventListener('loadedmetadata', () => {
    if (video.videoWidth && video.videoHeight) viewer.style.setProperty('--video-ratio', video.videoWidth/video.videoHeight);
  });
  function openVideo(index, trigger, animate = true) {
    const social = socials[index];
    if (!social?.video) { announce('这个案例暂时无法播放。'); return; }
    audio.pause();
    video.pause();
    $('#video-title').textContent = `${social.handle} · 创作案例`;
    $('#video-original').href = social.href;
    $('#video-original').innerHTML = `${escape(social.handle)}${icon('external')}`;
    videoSource = trigger.closest('.social-card');
    viewer.style.setProperty('--video-ratio', 228/342);
    video.poster = social.poster;
    video.src = social.video;
    $('#video-status').textContent = '正在载入视频…';
    openDialog($('#video-dialog'));
    video.load();
    viewerMotion?.cancel();
    if (animate && !reducedVideoMotion.matches) viewerMotion = viewer.animate([{transform:sourceTransform(),opacity:1},{transform:'none',opacity:1}], {duration:280,easing:'cubic-bezier(.4,0,.2,1)'});
    videoSource.style.visibility = 'hidden';
    videoDialog.classList.add('is-viewing');
    video.play().catch(() => { if (activeDialog?.id === 'video-dialog') $('#video-status').textContent = '点击视频中的播放按钮开始观看。'; });
  }
  video.addEventListener('playing', () => { $('#video-status').textContent = ''; audio.pause(); });
  video.addEventListener('error', () => { if (activeDialog?.id === 'video-dialog') $('#video-status').textContent = '视频暂时无法播放。请重试，或查看创作者原社媒。'; });


  const faqQuery = $('#faq-query');
  function updateFAQSearch() {
    const query = faqQuery.value.trim();
    $('#submit-search').hidden = !query;
    $$('#faq-keywords [data-question]').forEach((button) => {
      const selected = button.dataset.question === query;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  $$('#faq-keywords [data-question]').forEach((button) => {
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      faqQuery.value = button.dataset.question;
      updateFAQSearch();
    });

  });
  faqQuery.addEventListener('input', updateFAQSearch);
  $('.faq-content').addEventListener('submit', (event) => {
    faqQuery.value = faqQuery.value.trim();
    if (!faqQuery.value) { event.preventDefault(); faqQuery.focus(); }
  });

  document.addEventListener('click', (event) => {
    const song = event.target.closest('[data-play-song]');
    if (song) { playSong(Number(song.dataset.playSong)); return; }
    const social = event.target.closest('[data-open-video]');
    if (social) { openVideo(Number(social.dataset.openVideo), social, event.detail !== 0); return; }
    const close = event.target.closest('[data-close-dialog]');
    if (close) { close.closest('dialog')?.close(); return; }
    const bill = event.target.closest('[data-billing]');
    if (bill) { billing = bill.dataset.billing; renderPlanDetails(); moveBillingPill(true); return; }
    const question = event.target.closest('#faq-keywords [data-question]');
    if (question) {
      faqQuery.value = question.dataset.question;
      updateFAQSearch();
      faqQuery.focus({ preventScroll: true });
    }
  });

  renderSocials();
  renderPlanDetails();
  moveBillingPill();
  updateFAQSearch();
})();

(() => {
  const video = document.querySelector('#mobile-preview-video');
  if (!video) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  const sync = () => {
    if (visible && !document.hidden && !reducedMotion.matches) video.play().catch(() => {});
    else video.pause();
  };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 }).observe(video);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
})();

// Reveal each chapter and card row as scrolling brings it into view.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const modules = [...document.querySelectorAll(
    '.cap-intro, .cap-bento, .cap-sharing, #creators > .section-wrap > .section-heading, #social-filmstrip, #pricing > .section-heading, #pricing > .billing-toggle, #pricing-details, #mobile-app > .section-heading, .mobile-download-layout, #faq > .section-heading, .faq-content'
  )];
  const reveal = (element) => {
    element.classList.remove('scroll-reveal-pending');
    element.classList.add('scroll-reveal-visible');
    observer.unobserve(element);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  modules.forEach(element => {
    // Preserve the resting state for a direct chapter link or restored scroll position.
    if (element.getBoundingClientRect().top < innerHeight) return;
    element.classList.add('scroll-reveal-pending');
    observer.observe(element);
    element.addEventListener('focusin', () => reveal(element), { once: true });
  });
  motion.addEventListener('change', () => {
    if (motion.matches) {
      modules.forEach(element => element.classList.remove('scroll-reveal-pending', 'scroll-reveal-visible'));
      observer.disconnect();
    }
  });
})();
