import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { fetchGapAnalysis, fetchMetadata } from '../../api/client';
import ThemeToggle from '../ThemeToggle';
import Icon from '../Icon';

const SAARTHI_FEATURED_PROMPTS = [
  {
    icon: 'compass',
    query: 'How do I use this site?',
    titleEn: 'How do I use this site?',
    titleHi: 'इस साइट का उपयोग कैसे करें?',
    categoryEn: 'Platform Guide',
    categoryHi: 'प्लेटफ़ॉर्म गाइड',
    descEn: 'Learn how to navigate through the 18 modules and workflows.',
    descHi: 'सभी 18 मॉड्यूल और कार्यप्रवाहों को नेविगेट करना सीखें।',
  },
  {
    icon: 'sliders',
    query: 'How do I simulate changing training seats?',
    titleEn: 'How do I simulate training seats?',
    titleHi: 'प्रशिक्षण सीटों का सिमुलेशन कैसे करें?',
    categoryEn: 'Scenario Studio',
    categoryHi: 'परिदृश्य स्टूडियो',
    descEn: 'Step-by-step instructions to shift seats and simulate deficit impact.',
    descHi: 'सीटों को पुनरावंटित करने और घाटे के प्रभाव का सिमुलेशन करें।',
  },
  {
    icon: 'file-text',
    query: 'Explain the relative mismatch score.',
    titleEn: 'Explain relative mismatch score.',
    titleHi: 'सापेक्ष असंतुलन स्कोर का विवरण दें।',
    categoryEn: 'Metric Definition',
    categoryHi: 'मेट्रिक परिभाषा',
    descEn: 'Formula: Demand − Supply rank with 90-day placement maturity rule.',
    descHi: 'सूत्र: 90-दिन के प्लेसमेंट परिपक्वता नियम के साथ मांग − आपूर्ति रैंक।',
  },
  {
    icon: 'zap',
    query: 'Which district has the highest demand pressure this cycle?',
    titleEn: 'Which district has highest demand pressure?',
    titleHi: 'किस ज़िले में सबसे अधिक मांग दबाव है?',
    categoryEn: 'Policy Analytics',
    categoryHi: 'नीतिगत विश्लेषण',
    descEn: 'Cross-sectional regional ranking computed from live pilot database.',
    descHi: 'पायलट डेटाबेस से सीधे परिकलित क्षेत्रीय रैंकिंग।',
  },
];

export default function LandingPage({
  onNavigate,
  onEnterDashboard: onEnterDashboardProp,
  onNavigateToModule: onNavigateToModuleProp,
  onNavigateToSimulatorWithContext: onNavigateToSimulatorWithContextProp,
  onOpenCopilot,
  backendHealth = { status: 'healthy' },
}) {
  const { user, isAuthenticated, enterDemo } = useAuth();
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
      setPilotError(err.message || 'Unable to fetch pilot metrics from backend API.');
    } finally {
      setPilotLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLivePilotMetrics();
  }, [loadLivePilotMetrics]);

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
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

          {/* Quick Jump Navigation */}
          <nav
            aria-label="Public quick navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', flexWrap: 'wrap' }}
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
              onClick={() => onNavigateToModule('career')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="briefcase" size={14} />
              <span>{isHindi ? 'कैरियर प्रोफाइल' : 'Career Profile'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule('api')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Icon name="zap" size={14} />
              <span>{t('landing.navApi', 'API & Exports')}</span>
            </button>

            {/* Quick Ask Saarthi Header Button */}
            <button
              type="button"
              onClick={() => onOpenCopilot?.('How do I use this site?')}
              style={{
                backgroundColor: 'var(--accent-soft-bg)',
                border: '1px solid var(--accent-soft-border)',
                color: 'var(--accent-soft-text)',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Open SkillPulse Saarthi Assistant"
            >
              <Icon name="compass" size={13} />
              <span>{isHindi ? 'सारथी से पूछें' : 'Ask Saarthi'}</span>
            </button>
          </nav>

          {/* Theme Switcher, Language Switcher & Access CTAs */}
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
          padding: 'clamp(2rem, 5vw, 4.5rem) clamp(1rem, 3vw, 2rem) 2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Headline, Problem Context & Primary/Secondary CTAs */}
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
              marginBottom: '1.25rem',
              fontSize: '0.73rem',
              color: 'var(--accent-soft-text)',
              fontWeight: 600,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>SIH26246</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span>{isHindi ? 'श्रम बाज़ार आसूचना प्रणाली (6 पायलट ज़िले • 9 व्यवसाय)' : 'Labour Market Intelligence Pilot (6 Districts • 9 Occupations)'}</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span style={{ color: isOnline ? 'var(--accent-soft-text)' : '#ef4444', fontWeight: 700 }}>
              ● {isOnline ? (isHindi ? 'सक्रिय' : 'Cycle 2026-09 Active') : 'Offline'}
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 4.2vw, 3.75rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.01em',
              margin: '0 0 1.25rem 0',
              color: 'var(--text-primary)',
            }}
          >
            {isHindi ? (
              <>
                कौशल अंतराल का पूर्वानुमान।{' '}
                <span style={{ color: 'var(--accent-primary)', display: 'block' }}>
                  प्रशिक्षण निर्णयों को वास्तविक दिशा।
                </span>
              </>
            ) : (
              <>
                Forecast the Skill Gap.{' '}
                <span style={{ color: 'var(--accent-primary)', display: 'block' }}>
                  Guide Vocational Planning.
                </span>
              </>
            )}
          </h1>

          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              margin: '0 0 2rem 0',
              maxWidth: '580px',
            }}
          >
            {isHindi
              ? 'स्किलपल्स भारत में नियोक्ता मांग संकेतों, टीवीईटी पूर्णता थ्रूपुट, सापेक्ष कौशल असंतुलन, बहु-क्षितिज पूर्वानुमानों और संवादात्मक प्रशिक्षण-सीट सिमुलेशन को एकीकृत करने वाली निर्णय-सहायक प्रणाली है।'
              : 'SkillPulse bridges India\'s labour-market demand-supply friction by synthesizing employer hiring signals, TVET funnel throughput, multi-horizon forecasts, and interactive seat-capacity simulation scenarios.'}
          </p>

          {/* Action Buttons: Primary Launch, Secondary Saarthi, Tertiary Forecasts */}
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
              <span>{isHindi ? 'प्लेटफ़ॉर्म लॉन्च करें' : 'Launch Platform'}</span>
              <span>&rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenCopilot?.('How do I use this site?')}
              style={{
                backgroundColor: 'var(--accent-soft-bg)',
                color: 'var(--accent-soft-text)',
                border: '1px solid var(--accent-soft-border)',
                borderRadius: '8px',
                padding: '0.78rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="compass" size={16} />
              <span>{isHindi ? 'सारथी से पूछें' : 'Ask SkillPulse Saarthi'}</span>
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
              <Icon name="trending-up" size={15} />
              <span>{isHindi ? 'पूर्वानुमान देखें' : 'Explore Forecasts'}</span>
            </button>
          </div>

          {/* Guest Access Pill for Hackathon Evaluators */}
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
              title="Explore full platform as guest without registering"
            >
              <Icon name="compass" size={13} />
              <span>{isHindi ? 'निर्णायक डेमो मोड: बिना लॉगिन संपूर्ण प्लेटफ़ॉर्म देखें' : 'Instant Evaluator Access: Explore All Modules as Guest'}</span>
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
                {isHindi ? 'पायलट अवलोकन लोड हो रहा है...' : 'Loading pilot observation metrics...'}
              </div>
            </div>
          ) : pilotError || !pilotObs ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.65rem', color: 'var(--status-danger)' }}>
                {pilotError || 'Pilot dataset unavailable.'}
              </div>
              <button
                type="button"
                onClick={loadLivePilotMetrics}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {isHindi ? 'पुनः प्रयास करें' : 'Retry'}
              </button>
            </div>
          ) : (
            <>
              {/* Card Header with Observation Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    {isHindi ? 'पायलट विश्लेषणात्मक प्रेक्षण' : 'PILOT ANALYTICAL OBSERVATION'}
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                    {pilotObs.districtName} ({pilotObs.stateCode})
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {pilotObs.occupationTitle}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--status-demand-bg)',
                      color: 'var(--status-demand-text)',
                      border: '1px solid var(--status-demand-border)',
                      display: 'inline-block',
                    }}
                  >
                    {pilotObs.classification}
                  </span>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                    Cycle {pilotObs.period}
                  </div>
                </div>
              </div>

              {/* 3 Metric Scores */}
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

              {/* Trajectory Strip */}
              <div
                className="landing-subcard-surface"
                style={{
                  padding: '0.9rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {isHindi ? '24-माह अनुदैर्ध्य प्रक्षेपवक्र + 80% अनिश्चितता अंतराल' : '24M Longitudinal Trajectory + 80% Prediction Interval'}
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

              {/* Action Buttons on Pilot Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateToModule('gap')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Icon name="search" size={13} />
                  <span>{isHindi ? 'कौशल अंतर में देखें' : 'Inspect in Skill Gaps'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToSimulatorWithContext) {
                      onNavigateToSimulatorWithContext(pilotObs.districtId, pilotObs.occupationId);
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

      {/* Role-Based Getting Started Gateway (3 Core Stakeholder Pathways) */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '2.5rem clamp(1rem, 3vw, 2rem)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem', fontWeight: 700 }}>
            {isHindi ? 'भूमिका-आधारित ऑनबोर्डिंग' : 'ROLE-BASED ONBOARDING'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {isHindi ? 'प्रत्येक हितधारक के लिए उपयुक्त प्रवेश द्वार' : 'Tailored Workflows for Every Stakeholder'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '640px', margin: '0.5rem auto 0 auto' }}>
            {isHindi
              ? 'चाहे आप नीति निर्माता हों, छात्र हों या हैकथॉन निर्णायक हों — अपने लक्ष्य के अनुसार सीधे प्रासंगिक टूल पर पहुंचें।'
              : 'Direct navigation into verified modules designed for policymakers, students, and hackathon technical evaluators.'}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            gap: '1.35rem',
          }}
        >
          {/* Card 1: Policymakers & TVET Planners */}
          <div
            className="landing-card-surface"
            style={{
              padding: '1.6rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '3px solid var(--accent-primary)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.65rem' }}>
                <Icon name="sliders" size={20} />
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                  POLICY & TVET ADMINISTRATION
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                {isHindi ? 'नीति निर्माता एवं टीवीईटी योजनाकार' : 'Policymakers & TVET Planners'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
                {isHindi
                  ? 'क्षेत्रीय मांग तीव्रता की निगरानी करें, 4-चरणीय टीवीईटी पूर्णता फ़नल का मूल्यांकन करें, और गैर-क्षरण सुरक्षा उपायों के साथ सीट पुनर्वितरण परिदृश्यों का परीक्षण करें।'
                  : 'Monitor regional demand intensity, evaluate 4-stage TVET training funnels, examine persistent early warnings, and test seat reallocation scenarios.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem' }}>
                {['Overview', 'Skill Gaps', 'Forecasts', 'Alerts', 'Seat Simulator'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onEnterDashboard}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{isHindi ? 'नीति सुइट देखें' : 'Explore Policy Suite'}</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Card 2: Candidates & Job Seekers */}
          <div
            className="landing-card-surface"
            style={{
              padding: '1.6rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '3px solid #3b82f6',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '0.65rem' }}>
                <Icon name="briefcase" size={20} />
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                  CANDIDATES & STUDENTS
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                {isHindi ? 'अभ्यर्थी एवं शिक्षार्थी' : 'Candidates & Job Seekers'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
                {isHindi
                  ? 'सत्यापित कौशल प्रोफाइल बनाएं, एनएसक्यूएफ लक्षित भूमिका अंतर की पहचान करें, चरण-दर-चरण कैरियर रोडमैप तैयार करें, और स्वयं/नैप्स अवसरों पर आवेदन करें।'
                  : 'Build verified skill profiles, audit NSQF target role competencies, generate milestone roadmaps with Career Navigator, and explore official Government of India opportunities.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem' }}>
                {['Career Profile', 'Target Role Gaps', 'Career Navigator', 'SWAYAM / NAPS', 'Application Tracker'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToModule('career')}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{isHindi ? 'कैरियर रोडमैप बनाएं' : 'Build Career Roadmap'}</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Card 3: Evaluators & Technical Users */}
          <div
            className="landing-card-surface"
            style={{
              padding: '1.6rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '3px solid #f59e0b',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.65rem' }}>
                <Icon name="shield" size={20} />
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                  HACKATHON EVALUATORS & AUDITORS
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                {isHindi ? 'मूल्यांकनकर्ता एवं तकनीकी लेखा परीक्षक' : 'Evaluators & Technical Auditors'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
                {isHindi
                  ? '6,495 पंक्तियों में टीवीईटी फ़नल इनवेरिएंट्स के 100% अनुपालन का ऑडिट करें, 16 रोलिंग ओरिजिन फोल्ड्स में पूर्वानुमान बैकटेस्टिंग आरएमएसई का मूल्यांकन करें, और ओपन रेस्ट एपीआई का परीक्षण करें।'
                  : 'Audit 100% adherence to TVET funnel invariants across 6,495 rows, evaluate forecast RMSE across 16 rolling origin backtests, and test production REST APIs.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem' }}>
                {['Data Health', 'Funnel Invariants', 'Rolling-Origin RMSE', 'OpenAPI /docs', 'JSON/CSV Exports'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToModule('data-health')}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{isHindi ? 'सिस्टम स्वास्थ्य ऑडिट करें' : 'Audit System Health'}</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </section>

      {/* SkillPulse Saarthi Spotlight Section */}
      <section
        style={{
          backgroundColor: 'var(--bg-subtle)',
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '3.5rem clamp(1rem, 3vw, 2rem)',
        }}
      >
        <div style={{ maxWidth: '1340px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem', fontWeight: 700 }}>
                {isHindi ? 'बुद्धिमान निर्णय समर्थन' : 'INTELLIGENT DECISION SUPPORT'}
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isHindi ? 'स्किलपल्स सारथी से मिलें' : 'Meet SkillPulse Saarthi'}
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.4rem', maxWidth: '600px' }}>
                {isHindi
                  ? 'प्लेटफ़ॉर्म नेविगेट करने, मेट्रिक सूत्रों को समझने और 6 पायलट ज़िलों में साक्ष्य-आधारित श्रम बाज़ार विश्लेषण के लिए आपका संवादात्मक मार्गदर्शक।'
                  : 'Your dual-engine conversational guide for platform navigation, step-by-step workflows, and grounded labour-market analytics.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenCopilot?.('How do I use this site?')}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="compass" size={15} />
              <span>{isHindi ? 'सारथी असिस्टेंट खोलें' : 'Launch Saarthi Assistant'}</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Clickable Example Prompts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '1rem',
            }}
          >
            {SAARTHI_FEATURED_PROMPTS.map((item) => (
              <div
                key={item.query}
                onClick={() => onOpenCopilot?.(item.query)}
                className="landing-card-surface"
                style={{
                  padding: '1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent-soft-text)',
                        backgroundColor: 'var(--accent-soft-bg)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {isHindi ? item.categoryHi : item.categoryEn}
                    </span>
                    <span style={{ color: 'var(--accent-primary)' }}>
                      <Icon name={item.icon} size={15} />
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                    "{isHindi ? item.titleHi : item.titleEn}"
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    {isHindi ? item.descHi : item.descEn}
                  </p>
                </div>

                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{isHindi ? 'सारथी से पूछें' : 'Ask Saarthi'}</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Column System Scope Statistics Strip */}
      <section
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-canvas)',
        }}
      >
        <div
          style={{
            maxWidth: '1340px',
            margin: '0 auto',
            padding: '2.5rem 2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              6,495
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'सत्यापित पायलट डेटा रिकॉर्ड (मांग + टीवीईटी)' : 'Verified Pilot Data Records (Demand + TVET)'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
              100%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'फ़नल इनवेरिएंट अनुपालन (प्रमाणन ≤ पूर्णता)' : 'Funnel Invariant Monotonicity Adherence'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              6 Districts
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? 'महाराष्ट्र, कर्नाटक एवं तेलंगाना पायलट' : 'Maharashtra, Karnataka & Telangana Pilots'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#f59e0b' }}>
              3 Horizons
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isHindi ? '3M, 6M, 12M बैकटेस्टेड रोलिंग पूर्वानुमान' : '3M, 6M, 12M Backtested Rolling Forecasts'}
            </div>
          </div>
        </div>
      </section>

      {/* Expanded Capabilities Grid (8 Implemented Modules) */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '3.5rem clamp(1rem, 3vw, 2rem)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem', fontWeight: 700 }}>
            {isHindi ? 'सत्यापित मॉड्यूल' : 'VERIFIED MODULES'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {isHindi ? 'संपूर्ण श्रम बाज़ार आसूचना और निष्पादन सुइट' : 'Integrated Labour Market Intelligence & Execution Suite'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', maxWidth: '640px', margin: '0.4rem auto 0 auto' }}>
            {isHindi
              ? 'नीतिगत विश्लेषण, परिदृश्य सिमुलेशन और उम्मीदवार कैरियर उन्नयन के लिए कार्यान्वित वास्तविक उपकरण।'
              : 'Implemented capabilities spanning policy analytics, scenario simulation, and candidate skilling.'}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '1.25rem',
          }}
        >
          {[
            {
              tab: 'demand',
              icon: 'trending-up',
              title: isHindi ? 'मांग इंटेलिजेंस' : 'Demand Intelligence',
              desc: isHindi
                ? '5 भारित घटकों (विज्ञापन मात्रा 30%, वृद्धि 25%, निरंतरता 15%, विविधता 15%, वेतन 15%) का संयुक्त मांग स्कोर।'
                : 'Weighted 5-component composite demand score capturing posting volume, growth velocity, vacancy persistence, employer breadth, and wage premiums.',
            },
            {
              tab: 'gap',
              icon: 'scale',
              title: isHindi ? 'कौशल अंतर विश्लेषण' : 'Skill Gaps & TVET Funnel',
              desc: isHindi
                ? 'मांग सूचकांक और आपूर्ति आउटपुट के बीच सापेक्ष असंतुलन (Demand − Supply) और 90-दिन का प्लेसमेंट परिपक्वता नियम।'
                : 'Relative mismatch score bounded [-100, +100] with 4-stage TVET training funnels and 90-day placement maturity guardrails.',
            },
            {
              tab: 'forecasts',
              icon: 'compass',
              title: isHindi ? 'पूर्वानुमान एवं मॉडल बेंचमार्क' : 'Predictive Forecasts',
              desc: isHindi
                ? '16 रोलिंग-ओरिजिन परीक्षणों पर Naive, 3-Month Moving Average और Linear Trend मॉडलों की तुलना तथा 80% अनिश्चितता अंतराल।'
                : 'Multi-horizon forecasts (3M, 6M, 12M) with empirical 80% prediction intervals (±1.282 × RMSE) evaluated across 16 rolling-origin splits.',
            },
            {
              tab: 'alerts',
              icon: 'bell',
              title: isHindi ? 'प्रारंभिक चेतावनी अलर्ट' : 'Early-Warning Alerts',
              desc: isHindi
                ? '2 या अधिक क्षितिजों पर निरंतर असंतुलन (±15 अंक) वाले गंभीर संरचनात्मक अंतरालों की स्वचालित पहचान।'
                : 'Automated detection of entrenched multi-horizon deficits and surpluses persisting across consecutive projection windows.',
            },
            {
              tab: 'simulator',
              icon: 'sliders',
              title: isHindi ? 'परिदृश्य स्टूडियो (सीट सिम्युलेटर)' : 'Scenario Studio (Seat Simulator)',
              desc: isHindi
                ? 'स्थिर-उपज स्केलिंग और डोनर ट्रेड के लिए 30% क्षमता सुरक्षा नियम के तहत प्रशिक्षण सीटों के पुनरावंटन का सिमुलेशन।'
                : 'Interactive sandbox to reallocate training seats between trades under constant-yield scaling and donor non-depletion constraints.',
            },
            {
              tab: 'career',
              icon: 'briefcase',
              title: isHindi ? 'कैरियर प्रोफाइल एवं नेविगेटर' : 'Career Profile & Navigator',
              desc: isHindi
                ? 'एनएसक्यूएफ लक्षित भूमिका अंतर विश्लेषण, 4-मील का पत्थर रोडमैप और उम्मीदवार कैरियर नेविगेटर सहायक।'
                : 'Candidate skills audit, NSQF role gap breakdown, milestone learning roadmap, and dedicated Career Navigator copilot.',
            },
            {
              tab: 'opportunities',
              icon: 'award',
              title: isHindi ? 'अवसर खोजक (स्वयं / नैप्स)' : 'Opportunity Explorer',
              desc: isHindi
                ? 'SWAYAM Plus, NAPS और NCS से संकलित सत्यापित अप्रेंटिसशिप, कौशल पाठ्यक्रम और रोज़गार सूची।'
                : 'Verified directory of live apprenticeships, vocational courses, and jobs aggregated from SWAYAM Plus, NAPS, and NCS portals.',
            },
            {
              tab: 'districts',
              icon: 'map',
              title: isHindi ? 'ज़िला भौगोलिक मानचित्र' : 'Districts Geographic Explorer',
              desc: isHindi
                ? 'महाराष्ट्र, कर्नाटक और तेलंगाना के 6 पायलट ज़िलों का इंटरैक्टिव लीफ़लेट मानचित्र और तुलनात्मक चार्ट।'
                : 'Interactive Leaflet vector map and comparative cross-district benchmarking across Maharashtra, Karnataka, and Telangana.',
            },
          ].map((card) => (
            <div
              key={card.tab}
              onClick={() => onNavigateToModule(card.tab)}
              className="landing-card-surface"
              style={{
                padding: '1.35rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div>
                <div style={{ color: 'var(--accent-primary)', marginBottom: '0.65rem' }}>
                  <Icon name={card.icon} size={20} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {card.desc}
                </p>
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>{isHindi ? 'मॉड्यूल खोलें' : 'Open Module'}</span>
                <span>&rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Architecture & Synthetic Methodology Section */}
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '1rem clamp(1rem, 3vw, 2rem) 3.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Left Panel: Implemented Forecasting Models */}
          <div className="landing-card-surface" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {isHindi ? 'रोलिंग-ओरिजिन सत्यापन' : 'ROLLING-ORIGIN BACKTEST ARCHITECTURE'}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                  {isHindi ? 'पारदर्शी पूर्वानुमान मॉडल चयन' : 'Deterministic Baseline Model Selection'}
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--accent-soft-text)', border: '1px solid var(--accent-soft-border)', fontWeight: 700 }}>
                16 Rolling Origins
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.25rem 0' }}>
              {isHindi
                ? 'प्रत्येक ज़िला-व्यवसाय श्रृंखला के लिए 16 समय-क्रमबद्ध रोलिंग कटऑफ पर तीन पारदर्शी सांख्यिकीय मॉडलों का परीक्षण किया जाता है। न्यूनतम आउट-ऑफ़-सैंपल त्रुटि वाला मॉडल स्वचालित रूप से चुना जाता है।'
                : 'Each district-occupation series is evaluated across time-ordered rolling-origin cutoffs comparing three models. The model minimizing out-of-sample error is deterministically selected per regional series.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                {
                  name: isHindi ? 'रैखिक प्रवृत्ति मॉडल (Linear Trend)' : 'Linear Trend (OLS Drift)',
                  metric: 'Evaluated across 16 walk-forward splits',
                  role: isHindi ? 'निरंतर विस्तार वाली श्रृंखलाओं के लिए चयनित' : 'Selected on trending series with sustained industrial growth',
                  color: 'var(--accent-primary)',
                },
                {
                  name: isHindi ? '3-माह गतिमान औसत (MA3)' : '3-Month Moving Average (MA3)',
                  metric: 'Trailing 3-month rolling mean',
                  role: isHindi ? 'चक्रीय या मौसमी उतार-चढ़ाव वाली श्रृंखलाओं के लिए' : 'Evaluated on stationary or cyclical series',
                  color: '#3b82f6',
                },
                {
                  name: isHindi ? 'अंतिम-प्रेक्षण बेंचमार्क (Naive Baseline)' : 'Last-Observation Naive Baseline',
                  metric: 'Persistence baseline & tie-breaker',
                  role: isHindi ? 'स्थिरता बेंचमार्क' : 'Baseline benchmark preventing overfitting',
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
                  ? 'अनिश्चितता अंतराल: बिंदु पूर्वानुमान ± 1.282 × आउट-ऑफ़-सैंपल RMSE (80% विश्वास स्तर)'
                  : 'Prediction Interval: Point Forecast ± 1.282 × out-of-sample RMSE (Nominal 80% CI)'}
              </span>
              <button
                type="button"
                onClick={() => onNavigateToModule('forecasts')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}
              >
                {isHindi ? 'पूर्वानुमान देखें →' : 'View Forecasts →'}
              </button>
            </div>
          </div>

          {/* Right Panel: Scenario Studio Equations */}
          <div className="landing-card-surface" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {isHindi ? 'स्थिर-उपज सिमुलेशन इंजन' : 'CONSTANT-YIELD SCENARIO ENGINE'}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                  {isHindi ? 'प्रशिक्षण-सीट पुनरावंटन समीकरण' : 'Proportional Capacity Scaling'}
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: 'var(--status-demand-bg)', color: 'var(--status-demand-text)', border: '1px solid var(--status-demand-border)', fontWeight: 700 }}>
                Exploratory Sandbox
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.15rem 0' }}>
              {isHindi
                ? 'परिदृश्य स्टूडियो स्थिर फ़नल उपज (सीटें × पूर्णता दर × प्लेसमेंट दर) के तहत प्रस्तावित सीट परिवर्तनों के प्रभाव की गणना करता है और डोनर ट्रेड के लिए 30% क्षमता सुरक्षा नियम लागू करता है।'
                : 'Scenario Studio models how proposed seat adjustments scale certified placements under empirical funnel yields, enforcing a 30% capacity retention rule on donor trades.'}
            </p>

            {/* Simulator Equations Box */}
            <div className="landing-subcard-surface" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Icon name="calculator" size={14} />
                  <span>{isHindi ? 'सिम्युलेटर गणना समीकरण' : 'Simulator Calculation Rules'}</span>
                </span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-soft-text)', fontWeight: 700 }}>
                  Analytical Equations
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>1. Placement Delta:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>ΔPlacements = ΔSeats × Completion% × Placement%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>2. Donor Retention:</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Remaining_Seats ≥ 0.30 × Baseline_Seats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>3. Relative Mismatch:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>Mismatch_sim = Demand_Score − Supply_Score_sim</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>4. Infrastructure Lag:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>3-Month Model Activation Delay</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {isHindi ? 'सापेक्ष असंतुलन सूचकांक (श्रमिक हेडकाउंट कमी नहीं)' : 'Relative mismatch index, not physical headcount shortage'}
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
      <section style={{ maxWidth: '1340px', margin: '0 auto', padding: '1rem clamp(1rem, 3vw, 2rem) 4rem' }}>
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
                ? 'इस प्लेटफॉर्म के सभी 6,495 रिकॉर्ड SIH26246 बेंचमार्क मूल्यांकन के लिए सिंथेटिक प्रदर्शन डेटा हैं (आधिकारिक सरकारी जनगणना आंकड़े नहीं)।'
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
                : 'Mismatch scores (−100 to +100 pts) measure cross-sectional percentile rank differences, not an empirical worker headcount deficit.'}
            </p>
          </div>
        </div>
      </section>

      {/* Public Footer */}
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
            <span>Smart India Hackathon 2026 (Problem Statement SIH26246)</span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            Synthetic Pilot Baseline (6,495 rows) • SkillPulse Saarthi v2.0 • Deterministic Decision Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
