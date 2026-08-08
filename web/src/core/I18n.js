import { fr } from '../i18n/fr.js';

export class I18n {
  static currentLanguage = 'fr';
  static dictionaries = { fr };

  static t(key, params = {}) {
    const keys = key.split('.');
    let translation = this.dictionaries[this.currentLanguage];

    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        return key; // Fallback sur la clé
      }
    }

    if (typeof translation === 'string') {
      Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, params[param]);
      });
    }

    return translation;
  }
}
