import React, { useState, useCallback, useMemo } from 'react';
import { translate } from '../i18n/translations.js';
import { LanguageContext, STORAGE_KEY } from './LanguageContext.js';

/**
 * Validates language code to guarantee safe fallback
 */
function getInitialLanguage() {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') {
      return saved;
    }
  } catch {
    // Gracefully handle sandboxed or blocked localStorage
  }
  return 'en';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((newLang) => {
    const valid = newLang === 'hi' ? 'hi' : 'en';
    setLanguageState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, valid);
    } catch {
      // Ignore storage write errors in restricted environments
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'));
  }, [setLanguage]);

  const t = useCallback(
    (key, paramsOrFallback, maybeParams) => {
      return translate(language, key, paramsOrFallback, maybeParams);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      isHindi: language === 'hi',
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
