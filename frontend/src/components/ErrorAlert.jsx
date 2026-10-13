import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';

export default function ErrorAlert({ message, onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="error-banner" role="alert">
      <div className="error-title">
        <Icon name="warning" size={16} />
        <span>{t('error.backendConnection', 'Backend Connection Error')}</span>
      </div>
      <div className="error-message">
        {message || t('error.unexpected', 'An unexpected error occurred while communicating with the backend API.')}
      </div>
      {onRetry && (
        <button type="button" className="btn-retry" onClick={onRetry}>
          {t('common.tryAgain', 'Try Again')}
        </button>
      )}
    </div>
  );
}
