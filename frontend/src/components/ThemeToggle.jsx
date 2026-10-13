import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { isHindi } = useLanguage();

  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <div
      className={`theme-toggle-group ${className}`.trim()}
      role="group"
      aria-label={isHindi ? 'थीम चुनें (लाइट या डार्क)' : 'Color theme selector (Light or Dark)'}
      data-testid="theme-toggle"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={`theme-toggle-btn ${isLight ? 'active' : ''}`}
        data-theme-option="light"
        data-testid="theme-toggle-light"
        aria-pressed={isLight}
        aria-label={isHindi ? 'लाइट थीम सक्रिय करें' : 'Switch to Light theme'}
        title={isHindi ? 'लाइट थीम (Light Theme)' : 'Switch to Light theme'}
        onClick={() => setTheme('light')}
      >
        <Icon name="sun" size={13} />
        <span>{isHindi ? 'लाइट' : 'Light'}</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${isDark ? 'active' : ''}`}
        data-theme-option="dark"
        data-testid="theme-toggle-dark"
        aria-pressed={isDark}
        aria-label={isHindi ? 'डार्क थीम सक्रिय करें' : 'Switch to Dark theme'}
        title={isHindi ? 'डार्क थीम (Dark Theme)' : 'Switch to Dark theme'}
        onClick={() => setTheme('dark')}
      >
        <Icon name="moon" size={13} />
        <span>{isHindi ? 'डार्क' : 'Dark'}</span>
      </button>
    </div>
  );
}
