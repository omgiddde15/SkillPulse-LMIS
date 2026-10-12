import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const TAB_TITLES = {
  overview: { en: 'Overview', hi: 'अवलोकन' },
  demand: { en: 'Labour Demand Intelligence', hi: 'श्रम मांग विश्लेषण' },
  gap: { en: 'Skill Gap Analysis', hi: 'कौशल अंतर विश्लेषण' },
  forecasts: { en: 'Multi-Horizon Forecasting', hi: 'बहु-अवधि पूर्वानुमान' },
  alerts: { en: 'Early-Warning Alerts', hi: 'पूर्व-चेतावनी अलर्ट' },
  recommendations: { en: 'Policy Recommendations', hi: 'नीतिगत सिफारिशें' },
  simulator: { en: 'Scenario Studio', hi: 'परिदृश्य स्टूडियो' },
  districts: { en: 'Pilot Districts', hi: 'पायलट ज़िले' },
  occupations: { en: 'Occupational Taxonomy', hi: 'व्यावसायिक वर्गीकरण' },
  qualifications: { en: 'TVET Qualifications', hi: 'टीवीईटी योग्यताएं' },
  'data-health': { en: 'Data & Model Health', hi: 'डेटा एवं मॉडल स्वास्थ्य' },
  api: { en: 'API & Exports', hi: 'एपीआई एवं निर्यात' },
  settings: { en: 'Settings & Preferences', hi: 'सेटिंग्स एवं प्राथमिकताएं' },
};

export default function Header({
  period = '2026-09',
  activeTab = 'overview',
  onPeriodChange,
  onRefresh,
  onNavigateHome,
  onOpenCopilot,
  isRefreshing,
  backendHealth,
}) {
  const { language, setLanguage, t } = useLanguage();
  const isHindi = language === 'hi';

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

  const currentTabName = TAB_TITLES[activeTab]
    ? isHindi ? TAB_TITLES[activeTab].hi : TAB_TITLES[activeTab].en
    : activeTab;

  return (
    <header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.25rem', backgroundColor: '#ffffff', borderBottom: '1px solid var(--slate-200)', gap: '1rem', flexWrap: 'wrap' }}>
      {/* Left: Breadcrumbs & Dataset Provenance Pill */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        {/* Back to Home Link */}
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            style={{
              border: '1px solid var(--slate-200)',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-700)',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title={isHindi ? 'सार्वजनिक लैंडिंग पेज पर जाएं' : 'Return to public home page'}
          >
            <span>←</span>
            <span>{isHindi ? 'होम' : 'Home'}</span>
          </button>
        )}

        {/* Breadcrumb Trail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 500 }}>
          <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>SkillPulse LMIS</span>
          <span>/</span>
          <span style={{ color: 'var(--teal-700)', fontWeight: 700 }}>{currentTabName}</span>
        </div>

        {/* Compact Provenance Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '100px',
            backgroundColor: '#f0fdfa',
            border: '1px solid #99f6e4',
            fontSize: '0.68rem',
            color: '#0f766e',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
          title={isHindi ? 'सिंथेटिक प्रदर्शन डेटा셋 (SIH26246) — आधिकारिक जनगणना आंकड़े नहीं' : 'Synthetic demonstration dataset (SIH26246) — not official census statistics'}
        >
          <span>🔬</span>
          <span>{isHindi ? 'श्रम आसूचना पायलट — सिंथेटिक डेटा' : 'Labour Market Intelligence Pilot — Synthetic Data'}</span>
        </div>
      </div>

      {/* Right: Status, Period, Language, Refresh */}
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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

        {/* Grounded Copilot Drawer Trigger */}
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #0d9488',
              backgroundColor: '#f0fdfa',
              color: '#0f766e',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={isHindi ? 'ग्राउंडेड कोपायलट खोलें' : 'Open Grounded Copilot Drawer'}
          >
            <span>✨</span>
            <span>{isHindi ? 'कोपायलट' : 'Copilot'}</span>
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '10px', backgroundColor: '#0d9488', color: '#ffffff', fontWeight: 800 }}>
              LIVE
            </span>
          </button>
        )}

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
