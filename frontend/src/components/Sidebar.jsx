import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

const NAV_SECTIONS = [
  {
    sectionKey: 'nav.group.intelligence',
    fallbackTitle: 'INTELLIGENCE',
    items: [
      {
        id: 'overview',
        labelKey: 'nav.overview',
        fallbackLabel: 'Overview',
        icon: 'chart-bar',
      },
      {
        id: 'demand',
        labelKey: 'nav.demand',
        fallbackLabel: 'Demand Intelligence',
        icon: 'trending-up',
      },
      {
        id: 'forecasts',
        labelKey: 'nav.forecasts',
        fallbackLabel: 'Forecasts',
        icon: 'compass',
      },
      {
        id: 'gap',
        labelKey: 'nav.gap',
        fallbackLabel: 'Skill Gaps',
        icon: 'scale',
      },
    ],
  },
  {
    sectionKey: 'nav.group.action',
    fallbackTitle: 'ACTION',
    items: [
      {
        id: 'alerts',
        labelKey: 'nav.alerts',
        fallbackLabel: 'Early-Warning Alerts',
        icon: 'bell',
        badgeType: 'alerts',
      },
      {
        id: 'recommendations',
        labelKey: 'nav.recommendations',
        fallbackLabel: 'Recommendations',
        icon: 'lightbulb',
        badgeType: 'recommendations',
      },
      {
        id: 'simulator',
        labelKey: 'nav.simulator',
        fallbackLabel: 'Scenario Studio',
        icon: 'sliders',
        badgeType: 'studio',
      },
      {
        id: 'workspace',
        labelKey: 'nav.workspace',
        fallbackLabel: 'My Workspace',
        icon: 'folder',
        badgeType: 'workspace',
      },
    ],
  },
  {
    sectionKey: 'nav.group.explore',
    fallbackTitle: 'EXPLORE',
    items: [
      {
        id: 'districts',
        labelKey: 'nav.districts',
        fallbackLabel: 'Districts',
        icon: 'map',
      },
      {
        id: 'occupations',
        labelKey: 'nav.occupations',
        fallbackLabel: 'Occupations',
        icon: 'briefcase',
      },
      {
        id: 'qualifications',
        labelKey: 'nav.qualifications',
        fallbackLabel: 'Qualifications',
        icon: 'award',
      },
    ],
  },
  {
    sectionKey: 'nav.group.system',
    fallbackTitle: 'SYSTEM',
    items: [
      {
        id: 'data-health',
        labelKey: 'nav.dataHealth',
        fallbackLabel: 'Data & Model Health',
        icon: 'shield',
      },
      {
        id: 'api',
        labelKey: 'nav.apiExports',
        fallbackLabel: 'API & Exports',
        icon: 'zap',
      },
      {
        id: 'settings',
        labelKey: 'nav.settings',
        fallbackLabel: 'Settings',
        icon: 'settings',
      },
    ],
  },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  onNavigateHome,
  onNavigateToHome,
  onOpenCopilot,
  onToggleCopilot,
  alertsCount,
  alertCount,
  backendHealth = { status: 'healthy' },
}) {
  const { t, isHindi } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const isOnline = backendHealth?.status === 'healthy';
  const handleHomeClick = onNavigateHome || onNavigateToHome || (() => onSelectTab('home'));
  const handleCopilotClick = onOpenCopilot || onToggleCopilot;
  const resolvedAlertCount = alertsCount ?? alertCount ?? 143;

  return (
    <aside className="sidebar app-sidebar" aria-label="Main Navigation">
      {/* Brand Identity */}
      <div className="sidebar-brand">
        <div
          className="brand-title-row"
          onClick={handleHomeClick}
          style={{ cursor: 'pointer' }}
          title="Return to SkillPulse Landing Page"
        >
          <div className="brand-logo">SP</div>
          <div>
            <div className="brand-name">{t('app.brandName', 'SkillPulse')}</div>
            <div className="brand-subtitle">{t('app.brandSubtitle', 'LMIS Engine')}</div>
          </div>
        </div>
      </div>

      {/* Return to Home Link */}
      <div className="sidebar-home-row">
        <button
          type="button"
          onClick={handleHomeClick}
          className="sidebar-home-btn"
        >
          <span>&larr; {t('nav.home', isHindi ? 'स्किलपल्स होम' : 'SkillPulse Home')}</span>
          <span className="sidebar-home-tag">PUBLIC</span>
        </button>
      </div>

      {/* Grouped Navigation Sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((group) => (
          <div key={group.sectionKey} className="sidebar-group">
            <div className="sidebar-section-label">
              {t(group.sectionKey, group.fallbackTitle)}
            </div>
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-tab={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectTab(item.id)}
                >
                  <span className="nav-icon">
                    <Icon name={item.icon} size={15} />
                  </span>
                  <span className="nav-item-label">{t(item.labelKey, item.fallbackLabel)}</span>
                  {item.badgeType === 'alerts' && resolvedAlertCount > 0 && (
                    <span className="nav-badge-pill alerts">
                      {resolvedAlertCount}
                    </span>
                  )}
                  {item.badgeType === 'recommendations' && (
                    <span className="nav-badge-pill recommendations">
                      4
                    </span>
                  )}
                  {item.badgeType === 'studio' && (
                    <span className="nav-badge-pill studio">
                      STUDIO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* SkillPulse Copilot Card + API Status Footer */}
      <div className="sidebar-footer">
        {handleCopilotClick && (
          <div className="sidebar-copilot-card">
            <div className="sidebar-copilot-header">
              <span className="sidebar-copilot-title">
                <Icon name="sparkles" size={13} />
                <span>{isHindi ? 'स्किलपल्स कोपायलट' : 'SkillPulse Copilot'}</span>
              </span>
              <span className="sidebar-copilot-tag">Grounded</span>
            </div>
            <div className="sidebar-copilot-desc">
              {isHindi
                ? 'लाइव एपीआई पर आधारित द्विभाषी नीति एवं पूर्वानुमान सहायक'
                : 'Bilingual policy & forecast assistant grounded on live API.'}
            </div>
            <button
              type="button"
              onClick={handleCopilotClick}
              className="sidebar-copilot-cta"
            >
              {isHindi ? 'कोपायलट से पूछें' : 'Ask Skill Copilot'}
            </button>
          </div>
        )}

        {/* Authenticated User / Session Info */}
        <div className="sidebar-account-box">
          {isAuthenticated ? (
            <div className="sidebar-account-inner">
              <div
                className="sidebar-user-info"
                onClick={() => onSelectTab('workspace')}
                style={{ cursor: 'pointer' }}
                title="View My Workspace"
              >
                <div className="sidebar-user-avatar">
                  <Icon name="user" size={13} />
                </div>
                <div className="sidebar-user-text">
                  <div className="sidebar-user-name">{user?.full_name || 'Planner'}</div>
                  <div className="sidebar-user-role">{isHindi ? 'सक्रिय सत्र' : 'Active Session'}</div>
                </div>
              </div>
              <button
                type="button"
                className="sidebar-logout-btn"
                onClick={async () => {
                  await logout();
                  onSelectTab('login');
                }}
                title={isHindi ? 'लॉग आउट' : 'Sign Out'}
                aria-label="Sign Out"
              >
                <Icon name="log-out" size={13} />
              </button>
            </div>
          ) : (
            <div className="sidebar-demo-info">
              <div className="sidebar-demo-badge">
                <span className="sidebar-demo-dot" />
                <span>{isHindi ? 'डेमो अन्वेषक' : 'Demo Visitor'}</span>
              </div>
              <button
                type="button"
                className="sidebar-auth-link"
                onClick={() => onSelectTab('login')}
              >
                {isHindi ? 'साइन इन करें' : 'Sign In'}
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-api-status-row">
          <span>{t('app.apiStatus', isHindi ? 'एपीआई स्थिति' : 'API Status')}</span>
          <span className={`sidebar-api-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="sidebar-api-dot" />
            {isOnline
              ? t('app.statusHealthy', isHindi ? 'बैकएंड सक्रिय' : 'Backend Online')
              : t('app.statusOffline', isHindi ? 'ऑफ़लाइन' : 'Offline')}
          </span>
        </div>
      </div>
    </aside>
  );
}
