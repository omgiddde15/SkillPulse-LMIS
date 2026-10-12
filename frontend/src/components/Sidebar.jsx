import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const NAV_GROUPS = [
  {
    groupId: 'intelligence',
    groupKey: 'nav.group.intelligence',
    groupLabel: 'INTELLIGENCE',
    items: [
      { id: 'overview', key: 'nav.overview', label: 'Overview', icon: '📊' },
      { id: 'demand', key: 'nav.demand', label: 'Labour Intelligence', icon: '📈' },
      { id: 'forecasts', key: 'nav.forecasts', label: 'Forecasts', icon: '🔮' },
      { id: 'gap', key: 'nav.gap', label: 'Skill Gaps', icon: '⚖️' },
    ],
  },
  {
    groupId: 'action',
    groupKey: 'nav.group.action',
    groupLabel: 'ACTION',
    items: [
      { id: 'alerts', key: 'nav.alerts', label: 'Early Warnings', icon: '🚨', badge: '14' },
      { id: 'recommendations', key: 'nav.recommendations', label: 'Recommendations', icon: '💡', badge: '4' },
      { id: 'simulator', key: 'nav.simulator', label: 'Scenario Studio', icon: '🎛️', studioBadge: true },
    ],
  },
  {
    groupId: 'explore',
    groupKey: 'nav.group.explore',
    groupLabel: 'EXPLORE',
    items: [
      { id: 'districts', key: 'nav.districts', label: 'Districts', icon: '🗺️' },
      { id: 'occupations', key: 'nav.occupations', label: 'Occupations', icon: '💼' },
      { id: 'qualifications', key: 'nav.qualifications', label: 'Qualifications', icon: '🎓' },
    ],
  },
  {
    groupId: 'system',
    groupKey: 'nav.group.system',
    groupLabel: 'SYSTEM',
    items: [
      { id: 'data-health', key: 'nav.dataHealth', label: 'Data & Model Health', icon: '🛡️' },
      { id: 'api', key: 'nav.apiExports', label: 'API & Exports', icon: '⚡' },
      { id: 'settings', key: 'nav.settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  backendHealth = { status: 'healthy' },
}) {
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
    <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Brand & Home Navigation */}
      <div className="sidebar-header" style={{ padding: '1rem', borderBottom: '1px solid var(--navy-800)' }}>
        <div
          className="brand-emblem"
          onClick={() => onSelectTab('overview')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          <div className="brand-icon" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)' }}>
            SP
          </div>
          <div>
            <div className="brand-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>SkillPulse</div>
            <div className="brand-subtitle">{t('app.brandSubtitle', 'LMIS Engine')}</div>
          </div>
        </div>

        {/* Home Landing Link Button */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          style={{
            marginTop: '0.85rem',
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.35rem 0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>←</span>
            <span>{t('nav.home', 'SkillPulse Home')}</span>
          </span>
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>PUBLIC</span>
        </button>
      </div>

      {/* 4 Grouped Navigation Sections */}
      <nav className="sidebar-nav" style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.groupId} className="nav-group">
            <div
              className="nav-section-title"
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: '#64748b',
                letterSpacing: '0.08em',
                padding: '0.2rem 0.75rem',
                marginBottom: '0.25rem',
              }}
            >
              {t(group.groupKey, group.groupLabel)}
            </div>

            <ul className="nav-menu" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      type="button"
                      className={`nav-button ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectTab(item.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--navy-800)' : 'transparent',
                        color: isActive ? '#ffffff' : '#cbd5e1',
                        borderLeft: isActive ? '3px solid #0d9488' : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span className="nav-item-content" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="nav-icon" style={{ fontSize: '0.95rem' }}>{item.icon}</span>
                        <span>{t(item.key, item.label)}</span>
                      </span>

                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: item.id === 'alerts' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(13, 148, 136, 0.2)',
                            color: item.id === 'alerts' ? '#f87171' : '#2dd4bf',
                            border: `1px solid ${item.id === 'alerts' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(13, 148, 136, 0.35)'}`,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}

                      {item.studioBadge && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                            color: '#ffffff',
                          }}
                        >
                          STUDIO
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer with API Status */}
      <div className="sidebar-footer" style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--navy-800)' }}>
        <div className="backend-status-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
          <span style={{ color: '#64748b' }}>{t('app.apiStatus', 'API Status')}</span>
          <span className={`status-pill ${getStatusClass()}`}>
            <span className="status-dot"></span>
            {getStatusLabel()}
          </span>
        </div>
      </div>
    </aside>
  );
}
