(() => {
  const english = document.documentElement.lang === 'en';
  const content = window.SUNO_REDESIGN_CONTENT;
  // Media is shared by both locale routes and the hero playground.
  function resolveAssets(value) {
    if (typeof value === 'string' && value.startsWith('./assets/')) return new URL(value, new URL('/suno-redesign-site/suno-redesign/', location.origin)).href;
    if (Array.isArray(value)) return value.map(resolveAssets);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssets(item)]));
    return value;
  }
  window.SUNO_REDESIGN_CONTENT = resolveAssets(content);
  if (!english) {
    const pattern = /(?<=\p{Script=Han})[，。：](?=\p{Script=Han})/gu;
    function tightenCommas(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
      else while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.parentElement?.closest('script, style, textarea, input, .zh-tight-comma')) continue;
        pattern.lastIndex = 0;
        const matches = [...node.textContent.matchAll(pattern)];
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let start = 0;
        for (const match of matches) {
          fragment.append(node.textContent.slice(start, match.index));
          const comma = document.createElement('span');
          comma.className = 'zh-tight-comma';
          comma.textContent = match[0];
          fragment.append(comma);
          start = match.index + 1;
        }
        fragment.append(node.textContent.slice(start));
        node.replaceWith(fragment);
      }
    }
    tightenCommas(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) tightenCommas(node);
        else tightenCommas(record.target);
      }
    }).observe(document.body, {childList:true, subtree:true, characterData:true});
    return;
  }
  if (window.SUNO_EN_PLANS) window.SUNO_REDESIGN_CONTENT.plans = window.SUNO_EN_PLANS;
  const entries = Object.entries(window.SUNO_EN_COPY || {}).sort((a, b) => b[0].length - a[0].length);
  const translate = value => {
    if (!/[\u3400-\u9fff]/.test(value)) return value;
    let result = value;
    for (const [zh, en] of entries) result = result.split(zh).join(en);
    return result;
  };
  function localize(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = translate(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest('#hero-experience') || /^(SCRIPT|STYLE)$/.test(node.tagName)) return;
    for (const name of ['aria-label', 'alt', 'placeholder', 'title', 'aria-valuetext', 'data-question']) {
      if (node.hasAttribute(name)) {
        const previous = node.getAttribute(name);
        const next = translate(previous);
        if (next !== previous) node.setAttribute(name, next);
      }
    }
    for (const child of node.childNodes) localize(child);
  }
  localize(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) localize(node);
      else if (record.type === 'characterData') {
        if (!record.target.parentElement?.closest('#hero-experience')) localize(record.target);
      } else localize(record.target);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'alt', 'placeholder', 'title', 'aria-valuetext'] });
})();
