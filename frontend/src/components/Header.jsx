import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

export default function Header({
  activeTab,
  period,
  onPeriodChange,
  backendHealth = { status: 'healthy' },
  isRefreshing = false,
  onRefresh,
  onRefreshData,
  onNavigateHome,
  onNavigateToHome,
  onOpenCopilot,
  onToggleCopilot,
  onNavigate,
}) {
  const { language, setLanguage, t, isHindi } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const isOnline = backendHealth?.status === 'healthy';
  const handleRefreshClick = onRefresh || onRefreshData;
  const handleHomeClick = onNavigateHome || onNavigateToHome;
  const handleCopilotClick = onOpenCopilot || onToggleCopilot;

  const getActiveSectionLabel = (tabId) => {
    switch (tabId) {
      case 'workspace':
        return t('nav.workspace', isHindi ? 'मेरा कार्यक्षेत्र' : 'My Workspace');
      case 'career':
        return t('nav.careerProfile', isHindi ? 'करियर प्रोफ़ाइल' : 'Career Profile');
      case 'overview':
        return t('nav.overview', 'Overview');
      case 'demand':
        return t('nav.demand', 'Demand Intelligence');
      case 'gap':
        return t('nav.gap', 'Skill Gaps');
      case 'forecasts':
        return t('nav.forecasts', 'Forecasts');
      case 'alerts':
        return t('nav.alerts', 'Early-Warning Alerts');
      case 'recommendations':
        return t('nav.recommendations', 'Recommendations');
      case 'simulator':
        return t('nav.simulator', 'Scenario Studio');
      case 'districts':
        return t('nav.districts', 'Districts');
      case 'occupations':
        return t('nav.occupations', 'Occupations');
      case 'qualifications':
        return t('nav.qualifications', 'Qualifications');
      case 'data-health':
        return t('nav.dataHealth', 'Data & Model Health');
      case 'api':
        return t('nav.apiExports', 'API & Exports');
      case 'settings':
        return t('nav.settings', 'Settings');
      default:
        return t('nav.overview', 'Overview');
    }
  };

  return (
    <header className="top-header app-header">
      <div className="header-left">
        {handleHomeClick && (
          <button
            type="button"
            className="btn-refresh header-home-btn"
            onClick={handleHomeClick}
            title="Return to SkillPulse Landing Page"
          >
            <span>&larr;</span>
            <span>{isHindi ? 'होम' : 'Home'}</span>
          </button>
        )}

        <div className="header-breadcrumb">
          <span>{t('app.brandName', 'SkillPulse')}</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{getActiveSectionLabel(activeTab)}</span>
        </div>

        <span
          className="synthetic-pill"
          title={t('app.demoFullDisclaimer', 'Synthetic demonstration dataset for SIH26246 (not official statistics).')}
        >
          <Icon name="layers" size={12} />
          <span>{t('app.compactDemoNotice', 'Synthetic Demo Data — Pilot Testing Only')}</span>
        </span>
      </div>

      <div className="header-right">
        {/* Live Backend Health Indicator */}
        <div
          className={`health-badge ${isOnline ? 'online' : 'offline'}`}
          title={
            isOnline
              ? `${t('app.statusHealthy', 'Backend Online')} (${backendHealth?.service || 'skillpulse-api'})`
              : t('app.statusOffline', 'Backend Offline')
          }
        >
          <span className={`health-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span>{isOnline ? t('app.statusHealthy', 'Backend Online') : t('app.statusOffline', 'Backend Offline')}</span>
        </div>

        {/* Reporting Period Selector */}
        <div className="period-selector-wrapper">
          <span className="period-label">{t('common.reportingPeriod', 'Reporting Period')}</span>
          <select
            aria-label={t('common.reportingPeriod', 'Reporting Period')}
            className="period-select"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
          >
            <option value="2026-09">2026-09 ({t('common.activePilot', 'Active Pilot')})</option>
            <option value="2026-08">2026-08</option>
            <option value="2026-07">2026-07</option>
            <option value="2026-06">2026-06</option>
          </select>
        </div>

        {/* Theme Switcher (Light / Dark) */}
        <ThemeToggle />

        {/* Language Toggle (English / Hindi) */}
        <div
          className="lang-toggle-group"
          role="group"
          aria-label="Language selector"
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`lang-toggle-btn ${language === 'en' ? 'active' : ''}`}
            title="Switch to English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`lang-toggle-btn ${language === 'hi' ? 'active' : ''}`}
            title="हिन्दी में बदलें"
          >
            हिन्दी
          </button>
        </div>

        {/* Copilot Assistant Trigger */}
        {handleCopilotClick && (
          <button
            type="button"
            onClick={handleCopilotClick}
            className="header-copilot-btn"
            title="Open SkillPulse Grounded Policy Copilot"
          >
            <Icon name="sparkles" size={13} />
            <span>{language === 'hi' ? 'कोपायलट' : 'Copilot'}</span>
            <span className="header-copilot-live-pill">LIVE</span>
          </button>
        )}

        {/* Refresh Action */}
        <button
          type="button"
          className="btn-refresh"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          title={t('common.refreshTooltip', 'Refresh dashboard metrics from backend')}
        >
          <Icon name="refresh" size={13} />
          <span>{isRefreshing ? t('common.refreshing', 'Refreshing...') : t('common.refresh', 'Refresh')}</span>
        </button>

        {/* User Account / Workspace Menu */}
        {isAuthenticated ? (
          <div className="header-user-menu" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <button
              type="button"
              className={`header-user-btn ${activeTab === 'workspace' ? 'active' : ''}`}
              onClick={() => onNavigate?.('workspace')}
              title={`Logged in as ${user?.full_name || 'User'} (${user?.email || ''})`}
            >
              <Icon name="user" size={13} />
              <span className="header-user-name">{user?.full_name || 'My Workspace'}</span>
            </button>
            <button
              type="button"
              className="header-logout-btn"
              onClick={async () => {
                await logout();
                if (onNavigate) onNavigate('login');
              }}
              title={isHindi ? 'लॉग आउट करें' : 'Sign Out'}
              aria-label="Sign Out"
            >
              <Icon name="log-out" size={13} />
              <span>{isHindi ? 'लॉग आउट' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          <div className="header-auth-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <button
              type="button"
              className="header-signin-btn"
              onClick={() => onNavigate?.('login')}
              title="Sign in to your account"
            >
              <Icon name="lock" size={12} />
              <span>{isHindi ? 'साइन इन' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              className="header-signup-btn"
              onClick={() => onNavigate?.('signup')}
              title="Create a new account"
            >
              <span>{isHindi ? 'खाता बनाएं' : 'Sign Up'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
