import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const NAV_ITEMS = [
  { id: 'overview', key: 'nav.overview', label: 'Overview', icon: '📊', isComingSoon: false },
  { id: 'demand', key: 'nav.demand', label: 'Demand Intelligence', icon: '📈', isComingSoon: false },
  { id: 'gap', key: 'nav.gap', label: 'Gap Analysis', icon: '⚖️', isComingSoon: false },
  { id: 'forecasts', key: 'nav.forecasts', label: 'Forecasts', icon: '🔮', isComingSoon: false },
  { id: 'alerts', key: 'nav.alerts', label: 'Early-Warning Alerts', icon: '🚨', isComingSoon: false },
  { id: 'simulator', key: 'nav.simulator', label: 'Training-Seat Simulator', icon: '🎛️', isComingSoon: false },
];

export default function Sidebar({ activeTab, onSelectTab, backendHealth }) {
  const { t } = useLanguage();

  const getStatusClass = () => {
    if (backendHealth.status === 'healthy') return 'online';
    if (backendHealth.status === 'checking') return 'checking';
    return 'offline';
  };

  const getStatusLabel = () => {
    if (backendHealth.status === 'healthy') return t('app.statusHealthy', 'Backend Online');
    if (backendHealth.status === 'checking') return t('app.statusChecking', 'Checking API...');
    return t('app.statusOffline', 'Backend Offline');
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-emblem">
          <div className="brand-icon">SP</div>
          <div>
            <div className="brand-title">SkillPulse</div>
            <div className="brand-subtitle">{t('app.brandSubtitle', 'LMIS Engine')}</div>
          </div>
        </div>
        <div className="brand-tag">{t('app.brandTag', 'Workforce Intelligence • SIH26246')}</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">{t('app.coreModules', 'Core Modules')}</div>
        <ul className="nav-menu">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id} className="nav-item">
                <button
                  type="button"
                  className={`nav-button ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectTab(item.id)}
                >
                  <span className="nav-item-content">
                    <span className="nav-icon">{item.icon}</span>
                    <span>{t(item.key, item.label)}</span>
                  </span>
                  {item.isComingSoon && (
                    <span className="badge-coming-soon">{t('app.comingSoon', 'Coming next')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="backend-status-box">
          <span>{t('app.apiStatus', 'API Status')}</span>
          <span className={`status-pill ${getStatusClass()}`}>
            <span className="status-dot"></span>
            {getStatusLabel()}
          </span>
        </div>
      </div>
    </aside>
  );
}
