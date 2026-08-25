import { I18n } from './core/I18n.js';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) {
      el.textContent = I18n.t(key);
    }
  });

  document.title = document.title.replace('Mon Patrimoine', I18n.t('app.title'));
});
