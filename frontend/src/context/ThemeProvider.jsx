import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeContext } from './ThemeContext';

const STORAGE_KEY = 'skillpulse_theme';
const FALLBACK_KEY = 'theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Fallback if localStorage is inaccessible
  }
  return 'dark';
}

function applyThemeToDom(themeValue) {
  if (typeof document === 'undefined') return;
  const resolved = themeValue === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  document.documentElement.classList.add(`theme-${resolved}`);
  if (document.body) {
    document.body.setAttribute('data-theme', resolved);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${resolved}`);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const initial = getInitialTheme();
    applyThemeToDom(initial);
    return initial;
  });

  const setTheme = useCallback((nextTheme) => {
    setThemeState((prev) => {
      const resolved = typeof nextTheme === 'function' ? nextTheme(prev) : nextTheme;
      const valid = resolved === 'light' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, valid);
        localStorage.setItem(FALLBACK_KEY, valid);
      } catch {
        // Ignore storage write errors
      }
      applyThemeToDom(valid);
      return valid;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(FALLBACK_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
