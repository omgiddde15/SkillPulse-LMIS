import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function LoadingSpinner({ message }) {
  const { isHindi } = useLanguage();
  const defaultMsg = isHindi
    ? 'लाइव कार्यबल आसूचना मेट्रिक्स लोड हो रहे हैं...'
    : 'Loading live workforce intelligence metrics...';

  return (
    <div className="loading-box" role="status">
      <div className="spinner"></div>
      <div>{message || defaultMsg}</div>
    </div>
  );
}
