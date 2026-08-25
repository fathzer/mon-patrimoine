import { fr } from '../i18n/fr.js';

export type I18nParams = Record<string, string | number>;

type Dictionary = Record<string, unknown>;

export class I18n {
  static readonly currentLanguage: string = 'fr';
  static readonly dictionaries: Record<string, Dictionary> = { fr };

  static t(key: string, params: I18nParams = {}): string {
    const keys = key.split('.');
    let translation: unknown = this.dictionaries[this.currentLanguage];

    for (const k of keys) {
      if (translation && typeof translation === 'object' && (translation as Dictionary)[k] !== undefined) {
        translation = (translation as Dictionary)[k];
      } else {
        return key;
      }
    }

    if (typeof translation === 'string') {
      let result = translation;
      Object.keys(params).forEach(param => {
        result = result.replace(`{${param}}`, String(params[param]));
      });
      return result;
    }

    return translation as string;
  }
}
