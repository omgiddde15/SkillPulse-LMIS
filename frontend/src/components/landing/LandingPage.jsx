import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function LandingPage({
  onNavigate = () => {},
  backendHealth = { status: 'healthy' },
}) {
  const { language, setLanguage, t } = useLanguage();
  const isHindi = language === 'hi';

  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', backgroundColor: '#060b14', color: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      {/* A. Landing Navigation Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(6, 11, 20, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Logo & Product Brand */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
            onClick={() => onNavigate('home')}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
              }}
            >
              SP
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  SkillPulse
                </span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {t('app.brandSubtitle', 'LMIS Engine')} • SIH26246
              </div>
            </div>
          </div>

          {/* Quick Marketing Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }} className="landing-nav-links">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#14b8a6')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              📊 {t('nav.overview', 'Overview')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('forecasts')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#14b8a6')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              🔮 {t('nav.forecasts', 'Forecasts')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#14b8a6')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              🎛️ {t('nav.simulator', 'Scenario Studio')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('api')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#14b8a6')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              ⚡ {t('nav.apiExports', 'API & Exports')}
            </button>
          </nav>

          {/* Right Header Actions: Language & Open Dashboard */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Bilingual Switcher */}
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                style={{
                  border: 'none',
                  backgroundColor: language === 'en' ? '#0d9488' : 'transparent',
                  color: language === 'en' ? '#ffffff' : '#94a3b8',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                style={{
                  border: 'none',
                  backgroundColor: language === 'hi' ? '#0d9488' : 'transparent',
                  color: language === 'hi' ? '#ffffff' : '#94a3b8',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                हिन्दी
              </button>
            </div>

            {/* Open Dashboard Primary Action */}
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              style={{
                backgroundColor: '#0d9488',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
                transition: 'transform 0.15s, background-color 0.15s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0d9488')}
            >
              <span>{t('landing.cta.openDashboard', 'Open Dashboard')}</span>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>→</span>
            </button>
          </div>
        </div>
      </header>

      {/* B. Hero Section */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem 1.5rem 3.5rem', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          {/* Left Hero Pitch */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '100px', backgroundColor: 'rgba(13, 148, 136, 0.12)', border: '1px solid rgba(13, 148, 136, 0.35)', marginBottom: '1.25rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#2dd4bf' }}>01 / SIH 2026</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
              <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>Problem Statement SIH26246 (MSDE)</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: backendHealth?.status === 'healthy' ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: backendHealth?.status === 'healthy' ? '#10b981' : '#f59e0b' }} />
                {backendHealth?.status === 'healthy' ? 'API Online' : 'API Connecting'}
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 1.25rem 0' }}>
              <span>{t('landing.heroHeadlineStart', 'Forecast Skill Gaps. ')}</span>
              <span style={{ color: '#14b8a6' }}>{t('landing.heroHeadlineEnd', 'Guide Training Decisions.')}</span>
            </h1>

            <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.65, maxWidth: '580px', margin: '0 0 2rem 0' }}>
              {t(
                'landing.heroSubtitle',
                'SkillPulse analyses employer demand signals, TVET training throughput, relative skill gaps, multi-horizon forecasts, and training-capacity scenarios for regional workforce planning.'
              )}
            </p>

            {/* Three Primary Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
              <button
                type="button"
                onClick={() => onNavigate('overview')}
                style={{
                  backgroundColor: '#0d9488',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.85rem 1.6rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 6px 20px rgba(13, 148, 136, 0.35)',
                  transition: 'all 0.15s',
                }}
              >
                <span>{t('landing.cta.openDashboard', 'Open Dashboard')}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('forecasts')}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '12px',
                  padding: '0.85rem 1.4rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <span>🔮 {t('landing.cta.exploreForecasts', 'Explore Forecasts')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('simulator')}
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '12px',
                  padding: '0.85rem 1.4rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <span>🎛️ {t('landing.cta.trySimulator', 'Try Seat Simulator')}</span>
              </button>
            </div>
          </div>

          {/* Right Live Pilot Preview Card */}
          <div>
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '20px',
                padding: '1.75rem',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
                position: 'relative',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isHindi ? 'पायलट अवलोकन • चक्र 2026-09' : 'PILOT OBSERVATION • CYCLE 2026-09'}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                    CNC Machine Operator
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Dharwad, Karnataka (KA) • Precision Machining
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.15)', border: '1px solid rgba(234, 88, 12, 0.35)', color: '#fb923c', fontSize: '0.75rem', fontWeight: 700 }}>
                  <span>⚡</span>
                  <span>{isHindi ? 'मांग दबाव' : 'Demand Pressure'}</span>
                </div>
              </div>

              {/* 3 Metric Pillars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isHindi ? 'मांग सूचकांक' : 'DEMAND INDEX'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2dd4bf', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    84.2
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>0–100 percentile</div>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isHindi ? 'आपूर्ति आउटपुट' : 'SUPPLY OUTPUT'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    28.1
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>0–100 percentile</div>
                </div>

                <div style={{ backgroundColor: 'rgba(234, 88, 12, 0.06)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#ea580c', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isHindi ? 'सापेक्ष असंतुलन' : 'MISMATCH'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f97316', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    +56.1
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#ea580c' }}>Demand &gt; Supply</div>
                </div>
              </div>

              {/* Sparkline & Short Explanation */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>
                    {isHindi ? '24-माह अनुदैर्ध्य प्रवृत्ति एवं 80% भविष्यवाणी अंतराल' : '24M Longitudinal Trajectory + 80% Prediction Interval'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#2dd4bf', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    Linear Trend Model
                  </span>
                </div>
                <svg width="100%" height="40" viewBox="0 0 300 40" fill="none">
                  {/* Confidence Interval Band */}
                  <path d="M 0 32 Q 80 28, 160 20 T 300 10 L 300 22 Q 220 28, 160 30 T 0 36 Z" fill="#0d9488" fillOpacity="0.18" />
                  {/* Historical Series Line */}
                  <path d="M 0 35 L 50 32 L 100 30 L 150 26 L 200 22" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  {/* Forecast Line */}
                  <path d="M 200 22 L 250 17 L 300 12" stroke="#14b8a6" strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" />
                  <circle cx="300" cy="12" r="3.5" fill="#14b8a6" />
                </svg>
              </div>

              {/* Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ color: '#64748b' }}>
                  {isHindi ? 'प्रारूप हेयूरिस्टिक थ्रेशोल्ड (±15 अंक)' : 'Prototype heuristic thresholds (±15 pts)'}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('simulator')}
                  style={{ background: 'none', border: 'none', color: '#14b8a6', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <span>{isHindi ? 'सिम्युलेटर में सुधार देखें →' : 'Simulate the fix in Studio →'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. Key Indicators Strip */}
      <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(15, 23, 42, 0.45)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>54</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>
              {t('landing.kpi.monitoredPairsLabel', 'District-Occupations Tracked')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#14b8a6', fontFamily: 'var(--font-mono)' }}>6</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>
              {t('landing.kpi.districtsLabel', 'Pilot Districts (KA, MH, TS)')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>3 / 6 / 12 M</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>
              {t('landing.kpi.horizonsLabel', 'Backtested Forecast Horizons')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>24 M</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>
              {t('landing.kpi.historyLabel', 'Monthly Longitudinal Observations')}
            </div>
          </div>
        </div>
      </section>

      {/* D. How It Works (Methodology Cycle) */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '5rem 1.5rem 4rem', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#14b8a6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
            {t('landing.methodology.tag', 'METHODOLOGY CYCLE')}
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.8rem 0' }}>
            {t('landing.methodology.title', 'From Demand Signals to Actionable Policy')}
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
            {t(
              'landing.methodology.subtitle',
              'Transparent 5-stage explainable intelligence pipeline connecting real signals to TVET capacity decisions.'
            )}
          </p>
        </div>

        {/* 5-Stage Step Flow */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
          {[
            { step: '01', icon: '📡', titleKey: 'landing.step1.title', title: 'Demand Signals', descKey: 'landing.step1.desc', desc: 'Ingests job postings, recruitment growth, vacancy persistence, and employer hiring breadth.', route: 'demand' },
            { step: '02', icon: '📊', titleKey: 'landing.step2.title', title: 'Demand Index', descKey: 'landing.step2.desc', desc: 'Computes explainable percentile rankings (0–100) with dynamic weight re-normalization.', route: 'demand' },
            { step: '03', icon: '🎓', titleKey: 'landing.step3.title', title: 'Supply Comparison', descKey: 'landing.step3.desc', desc: 'Tracks certified TVET throughput and conversion funnels to evaluate effective labor supply.', route: 'gap' },
            { step: '04', icon: '🔮', titleKey: 'landing.step4.title', title: 'Forecasts & Alerts', descKey: 'landing.step4.desc', desc: 'Projects demand via rolling-origin backtests and generates ±15 heuristic mismatch alerts.', route: 'forecasts' },
            { step: '05', icon: '🎛️', titleKey: 'landing.step5.title', title: 'Scenario Studio', descKey: 'landing.step5.desc', desc: 'Simulates seat transfers with donor non-depletion constraints safeguarding existing trades.', route: 'simulator' },
          ].map((item) => (
            <div
              key={item.step}
              onClick={() => onNavigate(item.route)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.45)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 800, color: '#14b8a6' }}>
                  {item.step}
                </span>
                <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                {t(item.titleKey, item.title)}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                {t(item.descKey, item.desc)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* E. Core Capabilities Cards */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 1.5rem 5rem', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#14b8a6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
            {t('landing.capabilities.tag', 'CORE CAPABILITIES')}
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.8rem 0' }}>
            {t('landing.capabilities.title', 'Integrated Decision Support Modules')}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {[
            {
              id: 'demand',
              icon: '📈',
              titleKey: 'landing.cap1.title',
              title: 'Labour Demand Intelligence',
              descKey: 'landing.cap1.desc',
              desc: 'Multi-signal demand scoring and driver attribution across pilot districts.',
              badge: '0-100 Percentile Index',
            },
            {
              id: 'gap',
              icon: '⚖️',
              titleKey: 'landing.cap2.title',
              title: 'District & Skill-Gap Analysis',
              descKey: 'landing.cap2.desc',
              desc: 'Relative mismatch rankings centered on zero, distinguishing demand and supply pressure.',
              badge: 'Demand vs. Supply Output',
            },
            {
              id: 'forecasts',
              icon: '🔮',
              titleKey: 'landing.cap3.title',
              title: 'Multi-Horizon Forecasting',
              descKey: 'landing.cap3.desc',
              desc: 'Deterministic backtested projections with 80% empirical prediction intervals.',
              badge: 'Linear Trend & MA3',
            },
            {
              id: 'alerts',
              icon: '🚨',
              titleKey: 'landing.cap4.title',
              title: 'Early-Warning Alerts',
              descKey: 'landing.cap4.desc',
              desc: 'Automated 4-tier severity alerts for emerging shortages and persistent supply gluts.',
              badge: '±15 Heuristic Threshold',
            },
            {
              id: 'districts',
              icon: '🗺️',
              titleKey: 'landing.cap5.title',
              title: 'District Geographic Map',
              descKey: 'landing.cap5.desc',
              desc: 'Interactive Leaflet basemap and SVG schematic location map with non-overlapping labels.',
              badge: 'Dual Basemap & Schematic',
            },
            {
              id: 'simulator',
              icon: '🎛️',
              titleKey: 'landing.cap6.title',
              title: 'Training-Seat Simulator',
              descKey: 'landing.cap6.desc',
              desc: 'What-if capacity sandbox comparing baseline throughput vs proposed cohort adjustments.',
              badge: 'Donor Non-Depletion',
            },
          ].map((card) => (
            <div
              key={card.id}
              onClick={() => onNavigate(card.id)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '18px',
                padding: '1.75rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.45)';
                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{card.icon}</span>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(20, 184, 166, 0.12)', color: '#2dd4bf', border: '1px solid rgba(20, 184, 166, 0.25)', fontWeight: 600 }}>
                    {card.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                  {t(card.titleKey, card.title)}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  {t(card.descKey, card.desc)}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#14b8a6', fontSize: '0.8rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span>{isHindi ? 'मॉड्यूल खोलें' : 'Open Module'}</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* F. Data Provenance & Governance Section */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem 5rem', width: '100%' }}>
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '2.5rem',
          }}
        >
          <div style={{ maxWidth: '640px', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#14b8a6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              {t('landing.governance.tag', 'DATA PROVENANCE & GOVERNANCE')}
            </span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', margin: '0.4rem 0 0 0' }}>
              {t('landing.governance.title', 'Rigorous Methodology & Transparent Synthetic Pilot')}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(13, 148, 136, 0.15)', color: '#2dd4bf', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                📋
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                {t('landing.gov1.title', 'Synthetic Demonstration Data')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {t(
                  'landing.gov1.desc',
                  'All observations are synthetic demonstration data for SIH26246 (not official census statistics).'
                )}
              </p>
            </div>

            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                🔬
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                {t('landing.gov2.title', 'Rolling-Origin Backtesting')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {t(
                  'landing.gov2.desc',
                  'Out-of-sample models evaluated without future look-ahead data leakage.'
                )}
              </p>
            </div>

            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                🛡️
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                {t('landing.gov3.title', 'Donor Non-Depletion')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {t(
                  'landing.gov3.desc',
                  'Mathematical checks prevent donor training trades from slipping into severe deficits.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* G. Bottom CTA Section */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem 5rem', width: '100%', textAlign: 'center' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.8rem 0' }}>
            {t('landing.ctaSection.title', 'Ready to Explore India’s Workforce Pulse?')}
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1.75rem 0' }}>
            {t(
              'landing.ctaSection.desc',
              'Experience explainable workforce intelligence, demand forecasts, and training capacity simulations.'
            )}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            style={{
              backgroundColor: '#0d9488',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.95rem 2.2rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 8px 24px rgba(13, 148, 136, 0.4)',
              transition: 'transform 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span>{t('landing.cta.openDashboard', 'Open Dashboard')}</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: '#04070d', padding: '3rem 1.5rem 2rem', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #0d9488, #2563eb)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>
                  SP
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>SkillPulse</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                Labour Market Information System (LMIS) & Skill Demand-Supply Forecasting Engine.
              </p>
              <div style={{ fontSize: '0.7rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                SIH 2026 • Problem Statement SIH26246
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                Intelligence Modules
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <li><button type="button" onClick={() => onNavigate('overview')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Overview</button></li>
                <li><button type="button" onClick={() => onNavigate('demand')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Demand Intelligence</button></li>
                <li><button type="button" onClick={() => onNavigate('forecasts')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Forecasts Studio</button></li>
                <li><button type="button" onClick={() => onNavigate('gap')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Skill Gaps</button></li>
                <li><button type="button" onClick={() => onNavigate('simulator')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Scenario Studio</button></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                Exploration & Registry
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <li><button type="button" onClick={() => onNavigate('districts')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Pilot Districts</button></li>
                <li><button type="button" onClick={() => onNavigate('occupations')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Occupations Taxonomy</button></li>
                <li><button type="button" onClick={() => onNavigate('qualifications')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>TVET Qualifications</button></li>
                <li><button type="button" onClick={() => onNavigate('alerts')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Early-Warning Alerts</button></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                System & Governance
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <li><button type="button" onClick={() => onNavigate('data-health')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Data & Model Health</button></li>
                <li><button type="button" onClick={() => onNavigate('api')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>API & Exports</button></li>
                <li><button type="button" onClick={() => onNavigate('settings')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Settings & Preferences</button></li>
              </ul>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.72rem', color: '#475569' }}>
            <div>
              Ministry of Skill Development & Entrepreneurship (MSDE) — Smart India Hackathon 2026
            </div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              Synthetic pilot demonstration • Not an official statistical census
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
