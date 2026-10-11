import { createContext, useContext } from 'react';
import { translate } from '../i18n/translations.js';

export const STORAGE_KEY = 'skillpulse_lang';

/**
 * Default fallback translator that uses the English dictionary and respects
 * any fallback string passed to t(), ensuring raw keys are never rendered.
 */
function defaultTranslate(key, paramsOrFallback, maybeParams) {
  return translate('en', key, paramsOrFallback, maybeParams);
}

export const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: defaultTranslate,
  isHindi: false,
});

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx || typeof ctx.t !== 'function') {
    return {
      language: 'en',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: defaultTranslate,
      isHindi: false,
    };
  }
  return ctx;
}
