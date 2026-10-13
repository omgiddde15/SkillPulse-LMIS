import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { fetchGapAnalysis, fetchMetadata } from '../../api/client';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getOccupationDisplayName,
} from '../../i18n/translations';
import ThemeToggle from '../ThemeToggle';
import Icon from '../Icon';

export default function LandingPage({
  onNavigate,
  onEnterDashboard: onEnterDashboardProp,
  onNavigateToModule: onNavigateToModuleProp,
  onNavigateToSimulatorWithContext: onNavigateToSimulatorWithContextProp,
  backendHealth = { status: 'healthy' },
}) {
  const { user, isAuthenticated, enterDemo, logout } = useAuth();
  const onEnterDashboard = onEnterDashboardProp || (() => {
    enterDemo();
    onNavigate?.('overview');
  });
  const onNavigateToModule = onNavigateToModuleProp || ((mod) => onNavigate?.(mod));
  const onNavigateToSimulatorWithContext =
    onNavigateToSimulatorWithContextProp || (() => onNavigate?.('simulator'));
  const { language, setLanguage, t } = useLanguage();
  const isHindi = language === 'hi';
  const isOnline = backendHealth.status === 'healthy';

  const [pilotObs, setPilotObs] = useState(null);
  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotError, setPilotError] = useState(null);

  const loadLivePilotMetrics = useCallback(async () => {
    setPilotLoading(true);
    setPilotError(null);
    try {
      const [metaRes, gapRes] = await Promise.all([
        fetchMetadata(),
        fetchGapAnalysis({ period: '2026-09', limit: 200 }),
      ]);

      const gapRecords = gapRes?.results || gapRes?.records || [];
      if (!gapRecords.length) {
        throw new Error('No gap analysis records returned from API.');
      }

      const targetRecord =
        gapRecords.find((r) => r.district_id === 'KA_DHA' && r.occupation_id === 'OCC_MFG_001') ||
        gapRecords.reduce((max, r) => (r.relative_mismatch_score > max.relative_mismatch_score ? r : max), gapRecords[0]);

      const latestPeriod =
        targetRecord.period ||
        metaRes?.Coverage?.latest_period ||
        metaRes?.coverage?.latest_period ||
        '2026-09';

      setPilotObs({
        districtId: targetRecord.district_id,
        districtName: targetRecord.district_name,
        stateCode: targetRecord.state_code,
        occupationId: targetRecord.occupation_id,
        occupationTitle: targetRecord.occupation_title,
        trade: targetRecord.trade || targetRecord.sector,
        period: latestPeriod,
        demandScore: Number(targetRecord.demand_index_score ?? targetRecord.demand_index ?? 0),
        supplyScore: Number(targetRecord.supply_output_index ?? targetRecord.supply_index ?? 0),
        mismatchScore: Number(targetRecord.relative_mismatch_score ?? targetRecord.mismatch ?? 0),
        classification: targetRecord.classification || 'Demand Pressure',
      });
    } catch (err) {
      setPilotObs(null);
      setPilotError(err.message || 'Unable to fetch live pilot metrics from backend API.');
    } finally {
      setPilotLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLivePilotMetrics();
  }, [loadLivePilotMetrics]);

  return (
    <div className="landing-page">
      {/* Top Public Header Bar */}
      <header className="landing-header">
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="brand-logo" style={{ width: '36px', height: '36px', fontSize: '1rem' }}>
              SP
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  SkillPulse
                </span>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isOnline ? 'var(--accent-primary)' : '#ef4444',
                    display: 'inline-block',
                  }}
                  title={isOnline ? 'Backend API Online' : 'Backend API Offline'}
                />
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                LMIS ENGINE • SIH26246
              </div>
            </div>
          </div>

          {/* Quick Jump Links */}
          <nav
            aria-label="Public quick navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '1.35rem', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => onNavigateToModule('overview')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="chart-bar" size={14} />
              <span>{t('landing.navOverview', 'Overview')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule('forecasts')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="compass" size={14} />
              <span>{t('landing.navForecasts', 'Forecasts')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule('simulator')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="sliders" size={14} />
              <span>{t('landing.navSimulator', 'Scenario Studio')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule('api')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="zap" size={14} />
              <span>{t('landing.navApi', 'API & Exports')}</span>
            </button>
          </nav>

          {/* Theme Switcher, Language Switcher & Launch CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <ThemeToggle />

            <div className="lang-toggle-group" role="group" aria-label="Language selector">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`lang-toggle-btn ${language === 'en' ? 'active' : ''}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`lang-toggle-btn ${language === 'hi' ? 'active' : ''}`}
              >
                हिन्दी
              </button>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigate('workspace')}
                className="auth-ghost-btn"
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title={`Signed in as ${user?.full_name}`}
              >
                <Icon name="user" size={13} />
                <span>{user?.full_name || 'My Workspace'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="auth-ghost-btn"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Sign in to your account"
                >
                  <Icon name="lock" size={12} />
                  <span>{isHindi ? 'साइन इन' : 'Sign In'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('signup')}
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Create a new account"
                >
                  <span>{isHindi ? 'खाता बनाएं' : 'Sign Up'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onEnterDashboard}
              style={{
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.48rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span>{t('landing.openDashboard', 'Open Dashboard')}</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          maxWidth: '1340px',
          margin: '0 auto',
          padding: 'clamp(2rem, 5vw, 4.5rem) clamp(1rem, 3vw, 2rem) 3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Headline & CTAs */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-soft-bg)',
              border: '1px solid var(--accent-soft-border)',
              marginBottom: '1.5rem',
              fontSize: '0.73rem',
              color: 'var(--accent-soft-text)',
              fontWeight: 600,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>SIH26246 PILOT</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span>{t('landing.badgeText', 'Labour Market Intelligence Pilot — Synthetic Data')}</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span style={{ color: isOnline ? 'var(--accent-soft-text)' : '#ef4444', fontWeight: 700 }}>
              ● {isOnline ? (isHindi ? 'एपीआई सक्रिय' : 'API Online') : 'API Offline'}
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 4.4vw, 3.85rem)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              margin: '0 0 1.25rem 0',
              color: 'var(--text-primary)',
            }}
          >
            {isHindi ? (
              <>
                कौशल अंतराल का पूर्वानुमान।{' '}
                <span style={{ color: 'var(--accent-primary)', display: 'block' }}>
                  प्रशिक्षण निर्णयों को दिशा।
                </span>
              </>
            ) : (
              <>
                Forecast Skill Gaps.{' '}
                <span style={{ color: 'var(--accent-primary)', display: 'block' }}>
                  Guide Training Decisions.
                </span>
              </>
            )}
          </h1>

          <p
            style={{
              fontSize: '1.02rem',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              margin: '0 0 2rem 0',
              maxWidth: '580px',
            }}
          >
            {isHindi
              ? 'स्किलपल्स क्षेत्रीय कार्यबल योजना के लिए नियोक्ता मांग संकेतों, टीवीईटी प्रशिक्षण आउटपुट, सापेक्ष कौशल अंतराल, बहु-क्षितिज पूर्वानुमानों और प्रशिक्षण-सीट परिदृश्यों का विश्लेषण करता है (सिंथेटिक पायलट डेटासेट)।'
              : 'SkillPulse analyses employer demand signals, TVET training throughput, relative skill gaps, multi-horizon forecasts, and training-capacity scenarios for regional workforce planning (synthetic pilot dataset).'}
          </p>

          {/* 3 Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
            <button
              type="button"
              onClick={onEnterDashboard}
              style={{
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.78rem 1.45rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span>{isHindi ? 'डैशबोर्ड खोलें' : 'Open Dashboard'}</span>
              <span>&rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToModule('forecasts')}
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '0.78rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="compass" size={15} />
              <span>{isHindi ? 'पूर्वानुमान देखें' : 'Explore Forecasts'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToModule('simulator')}
              style={{
                backgroundColor: 'var(--status-demand-bg)',
                color: 'var(--status-demand-text)',
                border: '1px solid var(--status-demand-border)',
                borderRadius: '8px',
                padding: '0.78rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="sliders" size={15} />
              <span>{isHindi ? 'सीट सिम्युलेटर आज़माएं' : 'Try Seat Simulator'}</span>
            </button>
          </div>

          {/* Explore Demo CTA Pill for SIH Judges */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onEnterDashboard}
              style={{
                background: 'none',
                border: '1px dashed var(--accent-primary)',
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontWeight: 600,
              }}
              title="Explore live analytical platform without registering"
            >
              <Icon name="compass" size={13} />
              <span>{isHindi ? 'निर्णायक डेमो मोड: बिना पंजीकरण के संपूर्ण प्लेटफ़ॉर्म देखें' : 'Explore Demo Mode: Instant Judge Access Without Registration'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Pilot Observation Card */}
        <div
          className="landing-hero-card landing-card-surface"
          style={{
            padding: '1.6rem',
            position: 'relative',
          }}
        >
          {pilotLoading ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  border: '3px solid var(--accent-soft-border)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  margin: '0 auto 0.85rem auto',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isHindi ? 'लाइव पायलट मेट्रिक्स लोड हो रहे हैं...' : 'Loading live pilot metrics...'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {isHindi ? 'बैकएंड एपीआई से संपर्क किया जा रहा है' : 'Querying /api/v1/gap-analysis & /api/v1/metadata'}
              </div>
            </div>
          ) : pilotError || !pilotObs ? (
            <div
              role="alert"
              style={{
                padding: '1.75rem 1.25rem',
                textAlign: 'center',
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                borderRadius: '10px',
              }}
            >
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--status-danger-text)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Icon name="alert-triangle" size={16} />
                <span>{isHindi ? 'पायलट मेट्रिक्स अनुपलब्ध' : 'Pilot metrics unavailable'}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                {isHindi
                  ? 'लाइव बैकएंड एपीआई से डेटा प्राप्त नहीं किया जा सका। कोई अनुमानित संख्या प्रदर्शित नहीं की गई है।'
                  : 'Live pilot metrics could not be loaded from the backend API. No fabricated fallback figures are displayed.'}
              </p>
              <button
                type="button"
                onClick={loadLivePilotMetrics}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isHindi ? 'पुनः प्रयास करें' : 'Retry'}
              </button>
            </div>
          ) : (
            <>
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1.2rem',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {isHindi
                      ? `पायलट अवलोकन • चक्र ${pilotObs.period}`
                      : `PILOT OBSERVATION • CYCLE ${pilotObs.period}`}
                  </div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {getOccupationDisplayName(pilotObs.occupationTitle, isHindi)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {getDistrictDisplayName(pilotObs.districtName, isHindi)}, {getStateDisplayName(pilotObs.stateCode, isHindi)} ({pilotObs.stateCode}) • {pilotObs.trade}
                  </div>
                </div>

                <span
                  style={{
                    backgroundColor: 'var(--status-demand-bg)',
                    color: 'var(--status-demand-text)',
                    border: '1px solid var(--status-demand-border)',
                    padding: '0.28rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Icon name="zap" size={12} />
                  <span>{isHindi ? 'मांग दबाव' : pilotObs.classification}</span>
                </span>
              </div>

              {/* 3 Score Metric Tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '1.2rem',
                }}
              >
                <div className="landing-subcard-surface" style={{ padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {isHindi ? 'मांग सूचकांक' : 'DEMAND INDEX'}
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                    {pilotObs.demandScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>0–100 percentile</div>
                </div>

                <div className="landing-subcard-surface" style={{ padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {isHindi ? 'आपूर्ति आउटपुट' : 'SUPPLY OUTPUT'}
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                    {pilotObs.supplyScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>0–100 percentile</div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--status-demand-bg)',
                    border: '1px solid var(--status-demand-border)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.64rem', color: 'var(--status-demand-text)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {isHindi ? 'सापेक्ष असंतुलन' : 'RELATIVE MISMATCH'}
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--status-demand-text)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                    {pilotObs.mismatchScore > 0 ? `+${pilotObs.mismatchScore.toFixed(1)}` : pilotObs.mismatchScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--status-demand-text)' }}>Demand − Supply (pts)</div>
                </div>
              </div>

              {/* Mini Trajectory & Forecast Strip */}
              <div
                className="landing-subcard-surface"
                style={{
                  padding: '0.9rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {isHindi ? '24-माह अनुदैर्ध्य प्रक्षेपवक्र + 80% अंतराल' : '24M Longitudinal Trajectory + 80% Prediction Interval'}
                  </span>
                  <span style={{ color: 'var(--accent-soft-text)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Icon name="trending-up" size={12} />
                    <span>Linear Trend Model</span>
                  </span>
                </div>

                <svg viewBox="0 0 360 54" style={{ width: '100%', height: '54px', display: 'block' }}>
                  <line x1="0" y1="44" x2="360" y2="44" stroke="var(--chart-grid)" strokeWidth="1" />
                  <path
                    d="M 10 40 L 50 38 L 90 36 L 130 33 L 170 30 L 210 27 L 250 23"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  />
                  <polygon
                    points="250,23 345,6 345,26 250,23"
                    fill="rgba(16, 185, 129, 0.2)"
                  />
                  <path
                    d="M 250 23 L 345 15"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                  <circle cx="250" cy="23" r="3.5" fill="var(--text-primary)" />
                  <circle cx="345" cy="15" r="4" fill="var(--accent-primary)" />
                </svg>
              </div>

              {/* Card Footer CTA */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {isHindi ? 'प्रोटोटाइप ह्युरिस्टिक सीमा (±15 अंक)' : 'Prototype heuristic thresholds (±15 pts)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToSimulatorWithContext) {
                      onNavigateToSimulatorWithContext({
                        district: pilotObs.districtId,
                        occupation: pilotObs.occupationId,
                        state: pilotObs.stateCode,
                      });
                    } else {
                      onNavigateToModule('simulator');
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>{isHindi ? 'स्टूडियो में समाधान सिम्युलेट करें' : 'Simulate scenario in Studio'}</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 4-Column Metric Strip */}
      <section
        style={{
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-subtle)',
        }}
      >
        <div
          style={{
            maxWidth: '1340px',
            margin: '0 auto',
            padding: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              54
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'ज़िला-व्यवसाय समय श्रृंखलाएं' : 'District-Occupation Series Tracked'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
              6
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'पायलट ज़िले (कर्नाटक, महाराष्ट्र, तेलंगाना)' : 'Pilot Districts (KA, MH, TS)'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              3 / 6 / 12 M
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'रोलिंग-ओरिजिन पूर्वानुमान क्षितिज' : 'Rolling-Origin Forecast Horizons'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#f59e0b' }}>
              24 M
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'मासिक अनुदैर्ध्य डेटा (2024-10 से 2026-09)' : 'Monthly Longitudinal Data (2024-10 to 2026-09)'}
            </div>
          </div>
        </div>
      </section>

      {/* 5-Stage Methodology Pipeline */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '4rem 2rem 2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem', fontWeight: 700 }}>
            {isHindi ? 'पद्धति चक्र' : 'METHODOLOGY PIPELINE'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {isHindi ? 'मांग संकेतों से साक्ष्य-आधारित योजना तक' : 'From Demand Signals to Scenario Planning'}
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {[
            {
              step: '01',
              icon: 'activity',
              title: isHindi ? 'मांग संकेत' : 'Demand Signals',
              desc: isHindi ? 'जॉब विज्ञापन, रिक्ति निरंतरता, नियोक्ता विविधता और वेतन सूचकांक।' : 'Online job postings, growth velocity, vacancy persistence, employer breadth & wage index.',
            },
            {
              step: '02',
              icon: 'trending-up',
              title: isHindi ? 'समग्र मांग सूचकांक' : 'Demand Composite Index',
              desc: isHindi ? '5 भारित घटकों का 0–100 क्रॉस-सेक्शनल पर्सेंटाइल सूचकांक।' : 'Explainable 5-component weighted cross-sectional percentile score (0 to 100).',
            },
            {
              step: '03',
              icon: 'scale',
              title: isHindi ? 'आपूर्ति एवं अंतर विश्लेषण' : 'Supply & Relative Mismatch',
              desc: isHindi ? '90-दिन के परिपक्वता नियम के साथ प्रमाणीकरण आउटपुट रैंक बनाम मांग रैंक।' : 'Compares Demand Score against trailing 3M Certification Rank with 90-day placement maturity.',
            },
            {
              step: '04',
              icon: 'compass',
              title: isHindi ? 'पूर्वानुमान एवं अलर्ट' : 'Forecasts & Alerts',
              desc: isHindi ? 'रोलिंग-ओरिजिन बैकटेस्टेड मॉडल (Naive, MA3, Linear Trend) और ±15 सीमा अलर्ट।' : 'Rolling-origin backtested models (Naive, MA3, Linear Trend) with 80% intervals and ±15 alerts.',
            },
            {
              step: '05',
              icon: 'sliders',
              title: isHindi ? 'परिदृश्य स्टूडियो' : 'Scenario Studio',
              desc: isHindi ? 'आनुपातिक स्थिर-उपज सीट सिमुलेशन और डोनर गैर-कमी जांच।' : 'Proportional constant-yield seat capacity simulation and donor non-depletion checks.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="landing-card-surface"
              style={{
                padding: '1.25rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  STAGE {item.step}
                </span>
                <span style={{ color: 'var(--accent-primary)' }}>
                  <Icon name={item.icon} size={16} />
                </span>
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Platform Capabilities (6 Module Cards) */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '2rem 2rem 3.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem', fontWeight: 700 }}>
            {isHindi ? 'प्लेटफॉर्म क्षमताएं' : 'CORE PLATFORM CAPABILITIES'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {isHindi ? 'एकीकृत श्रम बाजार निर्णय प्रणाली' : 'End-to-End Workforce Decision Intelligence'}
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: '1.25rem',
          }}
        >
          {[
            {
              tab: 'demand',
              icon: 'trending-up',
              title: isHindi ? 'मांग इंटेलिजेंस इंजन' : 'Demand Intelligence Engine',
              desc: isHindi
                ? '5 व्याख्यात्मक घटकों (रिक्ति मात्रा 30%, वृद्धि 25%, निरंतरता 15%, नियोक्ता विविधता 15%, वेतन 15%) का विश्लेषण।'
                : 'Synthesises 5 explainable components (posting volume 30%, growth 25%, persistence 15%, employer breadth 15%, wage index 15%) into a 0–100 score.',
            },
            {
              tab: 'gap',
              icon: 'scale',
              title: isHindi ? 'सापेक्ष कौशल अंतर विश्लेषण' : 'Relative Skill Gap Analysis',
              desc: isHindi
                ? 'मांग सूचकांक और प्रमाणित आउटपुट के बीच सापेक्ष रैंक अंतराल और 90-दिन के प्लेसमेंट परिपक्वता नियम का मूल्यांकन।'
                : 'Computes relative mismatch (Demand Score − Supply Output Rank) with cohort funnel yields and 90-day placement maturity guardrails.',
            },
            {
              tab: 'forecasts',
              icon: 'compass',
              title: isHindi ? 'बहु-क्षितिज पूर्वानुमान (3, 6, 12 माह)' : 'Multi-Horizon Forecasts (3M, 6M, 12M)',
              desc: isHindi
                ? '16 रोलिंग-ओरिजिन कटऑफ पर Naive, 3-Month Moving Average और Linear Trend मॉडलों की तुलना और 80% अंतराल।'
                : 'Compares Naive baseline, 3-Month Moving Average (MA3), and Linear Trend across rolling-origin cutoffs with 80% prediction intervals (±1.282 × RMSE).',
            },
            {
              tab: 'alerts',
              icon: 'bell',
              title: isHindi ? 'प्रारंभिक चेतावनी अलर्ट और सिफारिशें' : 'Early-Warning Alerts & Dossiers',
              desc: isHindi
                ? '≥2 क्षितिजों पर निरंतर असंतुलन (±15 अंक) और कारण स्पष्टीकरण के साथ साक्ष्य-आधारित हस्तक्षेप।'
                : 'Detects persistent multi-horizon pressures (≥2 horizons crossing ±15 pts) and formats human-in-the-loop planning dossiers.',
            },
            {
              tab: 'simulator',
              icon: 'sliders',
              title: isHindi ? 'प्रशिक्षण-सीट परिदृश्य स्टूडियो' : 'Training-Seat Scenario Studio',
              desc: isHindi
                ? 'आनुपातिक स्थिर-उपज स्केलिंग और डोनर ट्रेड सुरक्षा जांच के तहत प्रस्तावित सीट क्षमता का परीक्षण करें।'
                : 'Test proposed batch seat adjustments using proportional constant-yield throughput scaling and heuristic donor non-depletion checks.',
            },
            {
              tab: 'districts',
              icon: 'map',
              title: isHindi ? 'स्थानिक पायलट मानचित्र एवं एक्सप्लोरर' : 'Spatial District Map & Explorers',
              desc: isHindi
                ? 'कर्नाटक, महाराष्ट्र और तेलंगाना के 6 पायलट ज़िलों, 9 व्यवसायों और एनएसक्यूएफ स्तरों का इंटरैक्टिव मानचित्र।'
                : 'Interactive Leaflet geographic map across 6 pilot districts, 9 NCO/QP-mapped occupations, and NSQF Levels 3.0–6.0.',
            },
          ].map((card) => (
            <div
              key={card.tab}
              onClick={() => onNavigateToModule(card.tab)}
              className="landing-card-surface"
              style={{
                padding: '1.4rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--accent-primary)', marginBottom: '0.65rem' }}>
                  <Icon name={card.icon} size={20} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.45rem 0' }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                  {card.desc}
                </p>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>{isHindi ? 'मॉड्यूल खोलें' : 'Explore Module'}</span>
                <span>&rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Forecasting & Scenario Studio Technical Architecture Section */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '1rem clamp(1rem, 3vw, 2rem) 3.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Left Panel: Implemented Forecasting Models & Rolling-Origin Backtesting */}
          <div className="landing-card-surface" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {isHindi ? 'रोलिंग-ओरिजिन बैकटेस्टिंग' : 'ROLLING-ORIGIN BACKTEST ARCHITECTURE'}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                  {isHindi ? 'पारदर्शी पूर्वानुमान मॉडल चयन' : 'Deterministic Baseline Model Selection'}
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--accent-soft-text)', border: '1px solid var(--accent-soft-border)', fontWeight: 700 }}>
                Min Out-of-Sample MAE
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.25rem 0' }}>
              {isHindi
                ? 'प्रत्येक ज़िला-व्यवसाय श्रृंखला के लिए 16 समय-क्रमबद्ध रोलिंग कटऑफ पर तीन पारदर्शी सांख्यिकीय मॉडलों का परीक्षण किया जाता है। न्यूनतम आउट-ऑफ़-सैंपल MAE वाला मॉडल स्वचालित रूप से चुना जाता है।'
                : 'Each district-occupation series is evaluated across time-ordered rolling-origin cutoffs (up to 16 origins for 3M horizon) comparing three transparent models. The model with the lowest out-of-sample MAE is deterministically selected.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                {
                  name: isHindi ? 'रैखिक प्रवृत्ति मॉडल (Linear Trend)' : 'Linear Trend (OLS Drift)',
                  metric: '3M Avg WAPE: 4.85% • MAE: 4.55 postings',
                  role: isHindi ? 'निरंतर विस्तार या गिरावट वाली श्रृंखलाओं के लिए चयनित' : 'Selected via minimum out-of-sample MAE on trending series',
                  color: 'var(--accent-primary)',
                },
                {
                  name: isHindi ? '3-माह गतिमान औसत (MA3)' : '3-Month Moving Average (MA3)',
                  metric: '3M Avg WAPE: 7.85% • MAE: 7.34 postings',
                  role: isHindi ? 'चक्रीय या अल्पकालिक उतार-चढ़ाव वाली श्रृंखलाओं के लिए' : 'Trailing 3-month mean evaluated on cyclical series',
                  color: '#3b82f6',
                },
                {
                  name: isHindi ? 'अंतिम-प्रेक्षण बेंचमार्क (Naive Baseline)' : 'Last-Observation Naive Baseline',
                  metric: '3M Avg WAPE: 7.21% • MAE: 6.74 postings',
                  role: isHindi ? 'स्थिरता बेंचमार्क और टाई-ब्रेकर' : 'Persistence baseline and deterministic tie-breaker',
                  color: '#f59e0b',
                },
              ].map((m) => (
                <div
                  key={m.name}
                  className="landing-subcard-surface"
                  style={{
                    padding: '0.75rem 0.95rem',
                    borderLeft: `3px solid ${m.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: m.color }}>{m.metric}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {m.role}
                  </div>
                </div>
              ))}
            </div>

            <div className="landing-subcard-surface" style={{ padding: '0.75rem 1rem', fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>
                {isHindi
                  ? 'अनिश्चितता अंतराल: बिंदु पूर्वानुमान ± 1.282 × आउट-ऑफ़-सैंपल RMSE (नाममात्र 80%)'
                  : 'Prediction Interval: Point Forecast ± 1.282 × out-of-sample RMSE (Nominal 80%)'}
              </span>
              <button
                type="button"
                onClick={() => onNavigateToModule('data-health')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}
              >
                {isHindi ? 'डायग्नोस्टिक्स देखें →' : 'View Diagnostics →'}
              </button>
            </div>
          </div>

          {/* Right Panel: Scenario Studio Constant-Yield Simulator Equations */}
          <div className="landing-card-surface" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {isHindi ? 'सीट आवंटन सिमुलेशन इंजन' : 'CONSTANT-YIELD SCENARIO ENGINE'}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                  {isHindi ? 'प्रशिक्षण-सीट परिदृश्य समीकरण' : 'Proportional Throughput & Rank Recalculation'}
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: 'var(--status-demand-bg)', color: 'var(--status-demand-text)', border: '1px solid var(--status-demand-border)', fontWeight: 700 }}>
                Exploratory Simulation
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.15rem 0' }}>
              {isHindi
                ? 'परिदृश्य स्टूडियो स्थिर फ़नल उपज (नामांकन × पूर्णता × प्रमाणन दर) के तहत प्रस्तावित सीट परिवर्तनों के प्रभाव की गणना करता है और सभी 54 श्रृंखलाओं में आपूर्ति पर्सेंटाइल को पुनः क्रमित करता है।'
                : 'Scenario Studio models how proposed batch seat adjustments scale future certified throughput under constant empirical funnel yields, then recalculates cross-sectional supply percentile ranks across all 54 monitored series.'}
            </p>

            {/* Grounded Simulator Equations Box */}
            <div className="landing-subcard-surface" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Icon name="calculator" size={14} />
                  <span>{isHindi ? 'सिम्युलेटर गणना समीकरण' : 'Simulator Calculation Equations'}</span>
                </span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-soft-text)', fontWeight: 700 }}>
                  54-Series Mid-Rank
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>1. Scaling Ratio:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R = Proposed_Seats / Baseline_Avg_Seats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>2. Scenario Output:</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Output_sim = Forecast_Output × R</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>3. Relative Mismatch:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>Mismatch_sim = Demand_Rank − Supply_Rank_sim</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>4. Heuristic Thresholds:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>±15.0 percentile points (Prototype Rule)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {isHindi ? 'सापेक्ष रैंक अंतराल (श्रमिक हेडकाउंट कमी नहीं)' : 'Measures relative rank mismatch, not a worker headcount shortfall'}
              </span>
              <button
                type="button"
                onClick={() => onNavigateToModule('simulator')}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isHindi ? 'परिदृश्य स्टूडियो खोलें →' : 'Launch Scenario Studio →'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Governance & Synthetic Transparency Section */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '1rem 2rem 4rem 2rem' }}>
        <div
          className="landing-card-surface"
          style={{
            padding: '1.75rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="layers" size={15} />
              <span>{isHindi ? 'सिंथेटिक पायलट डेटा प्रकटीकरण' : 'Synthetic Pilot Data Disclosure'}</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {isHindi
                ? 'इस प्लेटफॉर्म के सभी 6,495 अवलोकन रिकॉर्ड SIH26246 बेंचमार्क मूल्यांकन के लिए सिंथेटिक प्रदर्शन डेटा हैं (आधिकारिक सरकारी जनगणना आंकड़े नहीं)।'
                : 'All 6,495 observation records in this pilot are synthetic demonstration data created for SIH26246 benchmark evaluation (not official census or ministry statistics).'}
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#3b82f6', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="file-text" size={15} />
              <span>{isHindi ? '90-दिन प्लेसमेंट परिपक्वता नियम' : '90-Day Placement Maturity Rule'}</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {isHindi
                ? 'टीवीईटी मानकों के तहत, पूर्णता के 90 दिनों के भीतर वाले बैचों को "अनुवर्ती लंबित" के रूप में चिह्नित किया जाता है और शून्य प्लेसमेंट के रूप में दंडित नहीं किया जाता।'
                : 'Cohorts completed within 90 days of the reference cutoff are flagged as "Pending 90-Day Follow-Up" rather than misreported as zero-placement outcomes.'}
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="scale" size={15} />
              <span>{isHindi ? 'सापेक्ष असंतुलन बनाम श्रमिक कमी' : 'Relative Mismatch vs. Headcount'}</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {isHindi
                ? 'असंतुलन स्कोर (−100 से +100) मांग और आपूर्ति पर्सेंटाइल रैंक के अंतर को दर्शाता है, न कि श्रमिकों की वास्तविक संख्या की कमी को।'
                : 'Mismatch scores (−100 to +100 pts) measure cross-sectional percentile rank differences, not an empirical worker headcount deficit or guaranteed employment outcome.'}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-subtle)',
          padding: '2.5rem 2rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            maxWidth: '1340px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="brand-logo" style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}>
              SP
            </div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              SkillPulse LMIS
            </span>
            <span>•</span>
            <span>Smart India Hackathon 2026 (PS SIH26246)</span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            Synthetic Pilot Dataset (6,495 rows) • Deterministic Backtest Engine (Naive, MA3, Linear Trend)
          </div>
        </div>
      </footer>
    </div>
  );
}
