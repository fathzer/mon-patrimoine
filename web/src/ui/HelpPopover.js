const STYLE_ID = 'help-popover-style';
const CSS = `
  .help-popover {
    display: inline;
    color: var(--accent-blue);
    text-decoration: underline;
    cursor: pointer;
    outline: none;
  }

  .help-popover:hover {
    text-decoration: none;
  }

  .help-popover:focus-visible {
    text-decoration: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    border-radius: 2px;
  }

  .help-popover-card {
    position: fixed;
    z-index: 10000;
    display: none;
    min-width: 14rem;
    max-width: 24rem;
    max-height: 80vh;
    overflow: auto;
    background: var(--card-bg);
    border: 2px solid var(--accent-blue);
    border-radius: 8px;
    padding: 1rem;
    color: var(--text-main);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 40px rgba(59, 130, 246, 0.35);
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .help-popover-card-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--accent-blue);
  }

  .help-popover-card-body p {
    margin: 0 0 0.5rem;
  }

  .help-popover-card-body p:last-child {
    margin-bottom: 0;
  }
`;

let activeCard = null;
let activeTrigger = null;
const contentProviders = new Map();
let nextContentId = 1;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function positionCard(card, trigger) {
  const rect = trigger.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const margin = 8;

  let left = rect.left + rect.width / 2 - cardRect.width / 2;
  let top = rect.bottom + margin;

  if (left < margin) left = margin;
  if (left + cardRect.width > window.innerWidth - margin) {
    left = window.innerWidth - cardRect.width - margin;
  }
  if (top + cardRect.height > window.innerHeight - margin) {
    top = rect.top - cardRect.height - margin;
  }
  if (top < margin) top = margin;

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function show(trigger) {
  if (activeTrigger === trigger) {
    hide();
    return;
  }

  hide();

  const title = trigger.dataset.title || '';
  let contentHtml = '';
  if (trigger.dataset.content) {
    contentHtml = trigger.dataset.content;
  } else if (trigger.dataset.contentKey) {
    const provider = contentProviders.get(trigger.dataset.contentKey);
    const rawArgs = trigger.dataset.contentArgs;
    const args = rawArgs ? JSON.parse(rawArgs) : undefined;
    contentHtml = typeof provider === 'function' ? provider(args) : (provider || '');
  }

  const card = document.createElement('div');
  card.className = 'help-popover-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.innerHTML = `<div class="help-popover-card-title">${escapeHtml(title)}</div>
    <div class="help-popover-card-body">${contentHtml}</div>`;

  document.body.appendChild(card);
  card.style.display = 'block';

  activeCard = card;
  activeTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');

  positionCard(card, trigger);
}

function hide() {
  if (activeCard) {
    activeCard.remove();
    activeCard = null;
  }
  if (activeTrigger) {
    activeTrigger.setAttribute('aria-expanded', 'false');
    activeTrigger = null;
  }
}

function onDocumentClick(e) {
  const trigger = e.target.closest('.help-popover');
  if (trigger) {
    e.preventDefault();
    show(trigger);
    return;
  }

  if (e.target.closest('.help-popover-card')) {
    return;
  }

  hide();
}

function onDocumentKeydown(e) {
  if (e.key === 'Escape') {
    hide();
    return;
  }

  const trigger = e.target.closest('.help-popover');
  if (trigger && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    show(trigger);
  }
}

function init() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
}

init();

export class HelpPopover {
  static getHtml({ title = '', content = '', contentKey = '', contentArgs, label = '❓' } = {}) {
    const argsAttr = contentArgs !== undefined
      ? ` data-content-args="${escapeHtml(JSON.stringify(contentArgs))}"`
      : '';
    if (contentKey) {
      return `<span class="help-popover" role="button" tabindex="0" aria-expanded="false" data-title="${escapeHtml(title)}" data-content-key="${escapeHtml(contentKey)}"${argsAttr}>${escapeHtml(label)}</span>`;
    }
    if (typeof content === 'function') {
      const key = `__dynamic-${nextContentId++}`;
      contentProviders.set(key, content);
      return `<span class="help-popover" role="button" tabindex="0" aria-expanded="false" data-title="${escapeHtml(title)}" data-content-key="${escapeHtml(key)}"${argsAttr}>${escapeHtml(label)}</span>`;
    }
    return `<span class="help-popover" role="button" tabindex="0" aria-expanded="false" data-title="${escapeHtml(title)}" data-content="${escapeHtml(content)}"${argsAttr}>${escapeHtml(label)}</span>`;
  }

  static register(key, provider) {
    contentProviders.set(key, provider);
  }
}
