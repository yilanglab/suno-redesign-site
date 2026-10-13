(() => {
  const screenshotWidth = 1920;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileLayout = matchMedia('(max-width: 760px)');
  const analyses = [...document.querySelectorAll('.page-analysis')].map(element => {
    const viewport = element.querySelector('.page-viewport');
    const strip = element.querySelector('.page-strip');
    const highlight = element.querySelector('.page-highlight');
    const steps = [...element.querySelectorAll('.page-step')].map(element => ({
      element,
      start: Number(element.dataset.start),
      end: Number(element.dataset.end),
      top: 0,
    })).filter(step => Number.isFinite(step.start) && step.end > step.start);
    if (!viewport || !strip || !highlight || !steps.length) return null;
    return {
      element, viewport, strip, highlight, steps,
      viewer: element.querySelector('.page-visual, .page-viewer'),
      image: strip.querySelector('img'),
      imageHeight: 0,
      active: -1,
      width: 0,
      height: 0,
    };
  }).filter(Boolean);
  const chapters = [...document.querySelectorAll('.case-nav nav a')].map(link => {
    const section = link.hash && document.getElementById(decodeURIComponent(link.hash.slice(1)));
    return section ? { link, section, top: 0 } : null;
  }).filter(Boolean);

  let frame = 0;
  let needsMeasure = true;
  let initialized = false;
  let keyboardInput = false;
  let activeChapter = null;

  function updateMotion() {
    const motion = !initialized || keyboardInput || reducedMotion.matches ? 'none' : 'auto';
    analyses.forEach(analysis => { analysis.element.dataset.motion = motion; });
  }

  function renderRegion(analysis, index) {
    const step = analysis.steps[index];
    const regionHeight = step.end - step.start;
    const scale = Math.min(
      Math.max(analysis.width - 16, 1) / screenshotWidth,
      Math.max(analysis.height - 56, 1) / regionHeight,
    );
    const x = (analysis.width - screenshotWidth * scale) / 2;
    const centeredY = (analysis.height - regionHeight * scale) / 2 - step.start * scale;
    const minimumY = Math.min(0, analysis.height - analysis.imageHeight * scale);
    const y = Math.max(minimumY, Math.min(0, centeredY));
    analysis.strip.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    analysis.highlight.style.top = `${step.start}px`;
    analysis.highlight.style.height = `${regionHeight}px`;
    analysis.highlight.style.width = `${screenshotWidth}px`;
    analysis.highlight.style.setProperty('--highlight-border', `${2 / scale}px`);

    if (analysis.active === index) return;
    analysis.steps.forEach((item, stepIndex) => {
      item.element.classList.toggle('is-active', stepIndex === index);
    });
    analysis.active = index;
  }

  function update() {
    frame = 0;
    const scrollTop = window.scrollY;
    const measured = needsMeasure;
    if (measured) {
      analyses.forEach(analysis => {
        analysis.width = analysis.viewport.clientWidth;
        analysis.height = analysis.viewport.clientHeight;
        analysis.imageHeight = analysis.image?.naturalHeight
          || Number(analysis.image?.getAttribute('height'))
          || analysis.steps.at(-1).end;
        analysis.steps.forEach(step => { step.top = step.element.getBoundingClientRect().top + scrollTop; });
      });
      chapters.forEach(chapter => { chapter.top = chapter.section.getBoundingClientRect().top + scrollTop; });
      needsMeasure = false;
    }

    const focusLines = analyses.map(analysis => {
      let position = window.innerHeight * 0.52;
      if (mobileLayout.matches && analysis.viewer) {
        position = Math.min(
          window.innerHeight - 32,
          Math.max(position, analysis.viewer.getBoundingClientRect().bottom + 24),
        );
      }
      return scrollTop + position;
    });
    analyses.forEach((analysis, analysisIndex) => {
      let index = 0;
      analysis.steps.forEach((step, stepIndex) => {
        if (step.top <= focusLines[analysisIndex]) index = stepIndex;
      });
      if (measured || analysis.active !== index) renderRegion(analysis, index);
    });
    const chapterLine = scrollTop + window.innerHeight * 0.4;
    let currentChapter = chapters[0] || null;
    chapters.forEach(chapter => { if (chapter.top <= chapterLine) currentChapter = chapter; });
    if (currentChapter !== activeChapter) {
      chapters.forEach(chapter => {
        if (chapter === currentChapter) chapter.link.setAttribute('aria-current', 'location');
        else chapter.link.removeAttribute('aria-current');
      });
      activeChapter = currentChapter;
    }

    if (!initialized) {
      requestAnimationFrame(() => {
        initialized = true;
        updateMotion();
      });
    }
  }

  function schedule(measure = false) {
    needsMeasure ||= measure;
    if (!frame) frame = requestAnimationFrame(update);
  }

  analyses.forEach(analysis => {
    analysis.element.addEventListener('click', event => {
      const trigger = event.target.closest('.step-trigger, .analysis-jump');
      if (!trigger) return;
      const stepElement = trigger.closest('.page-step');
      const index = stepElement
        ? analysis.steps.findIndex(step => step.element === stepElement)
        : Number(trigger.dataset.stepIndex);
      if (!Number.isInteger(index) || !analysis.steps[index]) return;
      event.preventDefault();
      keyboardInput = event.detail === 0;
      updateMotion();
      analysis.steps[index].element.scrollIntoView({
        block: 'center',
        behavior: keyboardInput || reducedMotion.matches ? 'instant' : 'smooth',
      });
      schedule();
    });
  });

  chapters.forEach(chapter => {
    chapter.link.addEventListener('click', event => {
      if (event.detail !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      keyboardInput = true;
      updateMotion();
      if (location.hash !== chapter.link.hash) history.pushState(null, '', chapter.link.hash);
      chapter.section.scrollIntoView({ block: 'start', behavior: 'instant' });
      schedule();
    });
  });

  document.addEventListener('keydown', event => {
    if (!['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    keyboardInput = true;
    updateMotion();
  });
  const resumePointerMotion = () => {
    if (!keyboardInput) return;
    keyboardInput = false;
    updateMotion();
  };
  ['pointerdown', 'touchstart', 'wheel'].forEach(type => {
    window.addEventListener(type, resumePointerMotion, { passive: true });
  });
  window.addEventListener('scroll', () => schedule(), { passive: true });
  window.addEventListener('resize', () => schedule(true), { passive: true });
  window.addEventListener('load', () => schedule(true));
  window.addEventListener('pageshow', () => schedule(true));
  reducedMotion.addEventListener('change', updateMotion);
  document.fonts?.ready.then(() => schedule(true));

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => schedule(true));
    resizeObserver.observe(document.body);
    analyses.forEach(analysis => resizeObserver.observe(analysis.viewport));
  }
  updateMotion();
  schedule(true);
})();
