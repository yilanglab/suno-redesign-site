(() => {
  const section = document.querySelector('#possibilities');
  if (!section) return;
  const buttons = [...section.querySelectorAll('[data-tool-select]')];
  const destinations = { studio: 'https://suno.com/studio-welcome', stems: 'https://suno.com/stem-separation', remix: 'https://suno.com/remix-welcome' };
  const captions = { studio: 'Suno Studio', stems: 'Stem separation · 分轨', remix: 'Remix · 重混' };
  buttons.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.toolSelect;
    buttons.forEach(item => {
      const active = item === button;
      item.setAttribute('aria-pressed', String(active));
      item.closest('.cap-tool').classList.toggle('is-selected', active);
    });
    section.querySelectorAll('[data-tool-image]').forEach(image => { image.hidden = image.dataset.toolImage !== selected; });
    const link = section.querySelector('#cap-tool-link');
    link.href = destinations[selected];
    link.setAttribute('aria-label', `了解 ${captions[selected]}`);
  }));
})();
