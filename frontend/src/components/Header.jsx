import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Header({
  period = '2026-09',
  onPeriodChange,
  onRefresh,
  isRefreshing,
  backendHealth,
}) {
  const { language, setLanguage, t } = useLanguage();

  const getStatusClass = () => {
    if (backendHealth?.status === 'healthy') return 'online';
    if (backendHealth?.status === 'checking') return 'checking';
    return 'offline';
  };

  const getStatusLabel = () => {
    if (backendHealth?.status === 'healthy') return t('app.statusHealthy', 'Backend Online');
    if (backendHealth?.status === 'checking') return t('app.statusChecking', 'Checking API...');
    return t('app.statusOffline', 'Backend Offline');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-brand">
          <div className="header-brand-icon" aria-hidden="true">SP</div>
          <div className="header-brand-info">
            <div className="header-title-row">
              <span className="header-brand-title">SkillPulse</span>
              <span className="header-brand-badge">{t('app.brandSubtitle', 'LMIS Engine')}</span>
            </div>
            <div className="header-caption">
              {t('app.title', 'Workforce Intelligence & Skill Gap Decision Engine')}
            </div>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Backend Status Indicator */}
        {backendHealth && (
          <div className="header-status-box" title={t('app.apiStatus', 'API Status')}>
            <span className={`status-pill ${getStatusClass()}`}>
              <span className="status-dot"></span>
              {getStatusLabel()}
            </span>
          </div>
        )}

        {/* Reporting Period Selector */}
        <div className="period-badge-box">
          <label htmlFor="period-select" className="period-label">
            {t('common.reportingPeriod', 'Reporting Period')}
          </label>
          <select
            id="period-select"
            value={period}
            onChange={(e) => onPeriodChange && onPeriodChange(e.target.value)}
            className="period-select"
          >
            <option value="2026-09">2026-09 ({t('common.activePilot', 'Active Pilot')})</option>
            <option value="2026-08">2026-08</option>
            <option value="2026-07">2026-07</option>
            <option value="2026-06">2026-06</option>
          </select>
        </div>

        {/* Compact EN / हिन्दी Language Toggle */}
        <div className="lang-toggle-box" role="group" aria-label="Language selection">
          <button
            type="button"
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
            title="English interface"
            aria-pressed={language === 'en'}
          >
            EN
          </button>
          <button
            type="button"
            className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
            onClick={() => setLanguage('hi')}
            title="हिन्दी इंटरफ़ेस"
            aria-pressed={language === 'hi'}
          >
            हिन्दी
          </button>
        </div>

        {/* Refresh Action */}
        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={t('common.refreshTooltip', 'Refresh dashboard metrics from backend')}
        >
          <span>🔄</span>
          <span>{isRefreshing ? t('common.refreshing', 'Refreshing...') : t('common.refresh', 'Refresh')}</span>
        </button>
      </div>
    </header>
  );
}
