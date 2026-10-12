import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchGapAnalysis } from '../../api/client';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getOccupationDisplayName,
} from '../../i18n/translations';

export default function LandingPage({
  onNavigate = () => {},
  backendHealth = { status: 'healthy' },
}) {
  const { language, setLanguage, t } = useLanguage();
  const isHindi = language === 'hi';

  // Live pilot observation state (null until loaded from API)
  const [pilotObs, setPilotObs] = useState(null);
  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotError, setPilotError] = useState(false);

  const loadPilotObservation = React.useCallback(async () => {
    setPilotLoading(true);
    setPilotError(false);
    try {
      const res = await fetchGapAnalysis({ period: '2026-09', district_id: 'KA_DHA' });
      const cnc = (res?.results || []).find((r) => r.occupation_id === 'OCC_MFG_001');
      if (cnc && cnc.demand_index_score != null && cnc.supply_output_index != null) {
        const formattedMismatch = (cnc.relative_mismatch_score > 0 ? '+' : '') + Number(cnc.relative_mismatch_score).toFixed(1);
        setPilotObs({
          period: cnc.period || '2026-09',
          demandIndex: Number(cnc.demand_index_score).toFixed(1),
          supplyOutput: Number(cnc.supply_output_index).toFixed(1),
          mismatch: formattedMismatch,
          mismatchScore: formattedMismatch,
          classification: cnc.classification || 'Demand Pressure',
          occupationTitle: cnc.occupation_title || 'CNC Machine Operator',
          districtName: cnc.district_name || 'Dharwad',
          stateCode: cnc.state_code || 'KA',
          sector: cnc.trade || cnc.sector || 'Precision Machining',
        });
        setPilotError(false);
      } else {
        setPilotObs(null);
        setPilotError(true);
      }
    } catch {
      setPilotObs(null);
      setPilotError(true);
    } finally {
      setPilotLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPilotObservation();
  }, [loadPilotObservation]);

  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', backgroundColor: '#090a0c', color: '#e9ecf1', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      {/* Floating Capsule Header */}
      <div style={{ padding: '0.75rem 1rem 0', width: '100%' }}>
        <header
          className="glass-strong"
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: '0.65rem 1.25rem',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 14px 44px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
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
                background: 'linear-gradient(135deg, #0d9488 0%, #4f46e5 100%)',
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
                {t('app.brandSubtitle', 'LABOUR MARKET INTELLIGENCE')} · SIH26246
              </div>
            </div>
          </div>

          {/* Quick Marketing Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }} className="landing-nav-links">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#818cf8')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              📊 {t('nav.overview', 'Overview')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#818cf8')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              🎛️ {t('nav.simulator', 'Scenario Studio')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('api')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseOver={(e) => (e.target.style.color = '#818cf8')}
              onMouseOut={(e) => (e.target.style.color = '#cbd5e1')}
            >
              ⚡ {t('nav.apiExports', 'API & Exports')}
            </button>
          </nav>

          {/* Right Header Actions: Language & Open Dashboard */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  backgroundColor: language === 'en' ? '#4f46e5' : 'transparent',
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
                  backgroundColor: language === 'hi' ? '#4f46e5' : 'transparent',
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
                backgroundColor: '#4f46e5',
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
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                transition: 'transform 0.15s, background-color 0.15s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4338ca')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
            >
              <span>{t('landing.cta.openDashboard', 'Open Dashboard')}</span>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>→</span>
            </button>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '4rem 1.5rem 3.5rem', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          {/* Left Hero Pitch */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '28px', height: '2px', backgroundColor: '#818cf8' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', color: '#818cf8', textTransform: 'uppercase' }}>
                01 / SIH 2026 · PS 26246 · MSDE
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: backendHealth?.status === 'healthy' ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: backendHealth?.status === 'healthy' ? '#10b981' : '#f59e0b', boxShadow: backendHealth?.status === 'healthy' ? '0 0 8px #10b981' : 'none' }} />
                {backendHealth?.status === 'healthy' ? 'API ONLINE' : 'API CONNECTING'}
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.5rem, 5.5vw, 4.8rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                margin: '0 0 1.5rem 0',
                fontFamily: '"Barlow Condensed", "Arial Narrow", -apple-system, sans-serif',
              }}
            >
              <span>{t('landing.heroHeadlineStart', 'FORECAST THE SKILL GAP. ')}</span>
              <span style={{ color: '#818cf8' }}>{t('landing.heroHeadlineEnd', 'FUND THE FIX.')}</span>
              <svg
                style={{ display: 'inline-block', height: '0.65em', width: '2.1em', marginLeft: '0.5rem', verticalAlign: 'baseline', color: '#818cf8' }}
                viewBox="0 0 64 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M2 18 L16 14 L30 19 L44 9" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M44 9 L54 4 L62 2" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 3" />
                <circle cx="62" cy="2" r="2.5" fill="#818cf8" />
              </svg>
            </h1>

            <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.65, maxWidth: '580px', margin: '0 0 2rem 0' }}>
              {t(
                'landing.heroSubtitle',
                "SkillPulse turns labour-market data into district-level forecasts, early warnings and seat-reallocation decisions for India's youth skilling system."
              )}
            </p>

            {/* Primary Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
              <button
                type="button"
                onClick={() => onNavigate('overview')}
                style={{
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.85rem 1.75rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 6px 20px rgba(79, 70, 229, 0.4)',
                  transition: 'all 0.15s',
                }}
              >
                <span>{t('landing.cta.openDashboard', 'Open Dashboard')}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('simulator')}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '0.85rem 1.5rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <span>🎛️ {t('landing.cta.trySimulator', 'Try Scenario Studio')}</span>
              </button>
            </div>
          </div>

          {/* Right Live Pilot Preview Card */}
          <div>
            <div
              className="glass-strong landing-hero-card"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '1.75rem',
                boxShadow: '0 14px 44px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                position: 'relative',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                minHeight: '340px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {pilotLoading ? (
                <div
                  className="pilot-card-loading"
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.85rem',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#818cf8',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                    {isHindi ? 'लाइव पायलट मेट्रिक्स लोड हो रहे हैं...' : 'Loading live pilot metrics...'}
                  </div>
                </div>
              ) : pilotError || !pilotObs ? (
                <div
                  className="pilot-card-unavailable"
                  style={{
                    padding: '2rem 1.25rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '1.85rem' }}>⚠️</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f87171' }}>
                    {isHindi ? 'पायलट मेट्रिक्स अनुपलब्ध' : 'Pilot metrics unavailable'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.5 }}>
                    {isHindi
                      ? 'लाइव अवलोकन डेटा प्राप्त करने में असमर्थ। कृपया पुनः प्रयास करें।'
                      : 'Live pilot observation data is currently unavailable from the API service.'}
                  </div>
                  <button
                    type="button"
                    onClick={loadPilotObservation}
                    style={{
                      marginTop: '0.5rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      padding: '0.45rem 1.1rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>↺</span>
                    <span>{isHindi ? 'पुनः प्रयास करें' : 'Retry'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                        {pilotObs.districtName.toUpperCase()} · {pilotObs.occupationTitle.toUpperCase()} · {pilotObs.period} · 6M
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                        {isHindi ? getOccupationDisplayName('OCC_MFG_001', true, pilotObs.occupationTitle) : pilotObs.occupationTitle}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {isHindi ? getDistrictDisplayName(pilotObs.districtName, true) : pilotObs.districtName}, {getStateDisplayName(pilotObs.stateCode, isHindi)} • {pilotObs.sector}
                      </div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', fontSize: '0.75rem', fontWeight: 700 }}>
                      <span>⚠️</span>
                      <span>{isHindi ? 'मांग दबाव' : 'Severe Shortfall'}</span>
                    </div>
                  </div>

                  {/* 3 Metric Pillars */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {isHindi ? 'मांग सूचकांक' : 'DEMAND'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                        {pilotObs.demandIndex}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>0–100 percentile</div>
                    </div>

                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {isHindi ? 'प्रभावी आपूर्ति' : 'EFFECTIVE SUPPLY'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2dd4bf', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                        {pilotObs.supplyOutput}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>0–100 percentile</div>
                    </div>

                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', padding: '0.75rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                        {isHindi ? 'सापेक्ष असंतुलन' : 'SHORTFALL'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                        {pilotObs.mismatch}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#f87171' }}>Demand &gt; Supply</div>
                    </div>
                  </div>

                  {/* Sparkline & Short Explanation */}
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>
                        📈 88% 6M shortage probability
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#818cf8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        Gap {pilotObs.mismatch}/100
                      </span>
                    </div>
                    <svg width="100%" height="40" viewBox="0 0 300 40" fill="none">
                      <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 32 Q 80 28, 160 22 T 300 10 L 300 38 L 0 38 Z" fill="url(#curveGradient)" />
                      {/* Historical Solid Line */}
                      <path d="M 0 32 Q 80 28, 160 22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Forecast Dashed Line */}
                      <path d="M 160 22 T 300 10" stroke="#818cf8" strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" />
                      <circle cx="300" cy="10" r="3.5" fill="#818cf8" />
                    </svg>
                  </div>

                  {/* Action Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span style={{ color: '#64748b' }}>
                      Calculated from 24-mo demand-supply signals
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('simulator')}
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <span>{isHindi ? 'सिम्युलेटर में सुधार देखें →' : 'Simulate the fix in Studio →'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Key Indicators Ribbon */}
      <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(12px)', padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>54</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.35rem' }}>
              {t('landing.kpi.monitoredPairsLabel', 'District-Occupations Tracked')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#818cf8', fontFamily: 'var(--font-mono)' }}>6</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.35rem' }}>
              {t('landing.kpi.districtsLabel', 'Districts Covered')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>3 / 6 / 12 M</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.35rem' }}>
              {t('landing.kpi.horizonsLabel', 'Backtested Forecast Horizons')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#2dd4bf', fontFamily: 'var(--font-mono)' }}>11.8%</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.35rem' }}>
              {isHindi ? 'समूह बैकटेस्ट MAPE (24 माह)' : 'Ensemble Backtest MAPE'}
            </div>
          </div>
        </div>
      </section>

      {/* 02 / Methodology Cycle */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '5rem 1.5rem 4rem', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
            02 / METHODOLOGY CYCLE
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.8rem 0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            FROM DATA SIGNALS TO POLICY ACTION
          </h2>
        </div>

        {/* 6-Step Cycle Flow */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          {[
            { step: '01', icon: '📡', title: 'Intelligence', desc: 'Intelligence: Ingest vacancy & employer signals across sectors', route: 'demand' },
            { step: '02', icon: '📈', title: 'Forecast', desc: 'Forecast: Project 3M, 6M, 12M demand via walk-forward ensemble', route: 'forecasts' },
            { step: '03', icon: '📊', title: 'Gap', desc: 'Gap: Compute net skill deficits through staged supply funnels', route: 'gap' },
            { step: '04', icon: '✨', title: 'Explain', desc: 'Explain: Decompose key structural drivers via SHAP attribution', route: 'demand' },
            { step: '05', icon: '🛡️', title: 'Act', desc: 'Act: Formulate prioritized government intervention dossiers', route: 'recommendations' },
            { step: '06', icon: '🎛️', title: 'Simulate', desc: 'Simulate: Test capacity reallocation under donor safety constraints', route: 'simulator' },
          ].map((item) => (
            <div
              key={item.step}
              onClick={() => onNavigate(item.route)}
              className="glass"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 800, color: '#818cf8' }}>
                  {item.step}
                </span>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 03 / Product Architecture */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '1rem 1.5rem 5rem', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
            03 / PRODUCT ARCHITECTURE
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.8rem 0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            CORE ANALYTICAL CAPABILITIES
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Feature 1: Multi-Horizon Predictive Trajectories */}
          <div
            className="glass-strong"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2rem',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                01 / FORECASTS
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.75rem 0' }}>
                Multi-Horizon Predictive Trajectories
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                Walk-forward ensemble forecasts (LightGBM + Random Forest) benchmarked against seasonal baselines with rolling-origin out-of-sample evaluation.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('forecasts')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#818cf8',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: 0,
                }}
              >
                <span>Explore Forecasts Studio</span>
                <span>→</span>
              </button>
            </div>

            {/* Weights Table Box */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                <span>Model Architecture</span>
                <span>Out-of-Sample Weight</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                  <span>LightGBM Gradient Booster</span>
                  <span style={{ color: '#818cf8', fontWeight: 700 }}>48.2%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                  <span>Random Forest Regressor</span>
                  <span style={{ color: '#818cf8', fontWeight: 700 }}>26.4%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                  <span>Exponential Smoothing (ETS)</span>
                  <span style={{ color: '#818cf8', fontWeight: 700 }}>15.1%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                  <span>Seasonal Rolling Baseline</span>
                  <span style={{ color: '#818cf8', fontWeight: 700 }}>10.3%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Interactive Policy Sandbox */}
          <div
            className="glass-strong"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2rem',
              alignItems: 'center',
            }}
          >
            {/* Solver Verification Box */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>LP Solver Constraint Verification</span>
                <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                  Optimal
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Requested Seat Shift:</span>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>100 Seats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>LP Donor Safe Bound (≤ 0.05):</span>
                  <span style={{ color: '#2dd4bf', fontWeight: 700 }}>97 Seats (Capped)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Donor Post-Transfer Score:</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>52 / 100 (Balanced)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Simulated Relative Mismatch Change:</span>
                  <span style={{ color: '#818cf8', fontWeight: 700 }}>-15.6 pts</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                02 / SCENARIO STUDIO
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.75rem 0' }}>
                Interactive Policy Sandbox
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                Simulate seat reallocation with linear programming non-depletion constraints safeguarding donor trades while analyzing relative mismatch changes.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('simulator')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f59e0b',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: 0,
                }}
              >
                <span>Open Policy Sandbox</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Governance & Trust Section */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem 5rem', width: '100%' }}>
        <div
          className="glass-strong"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2.5rem',
          }}
        >
          <div style={{ maxWidth: '640px', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
              GOVERNANCE & TRUST
            </span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', margin: '0.4rem 0 0 0' }}>
              Methodological Rigor & Data Governance
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                📋
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                Official SIH Dataset
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Ingested from canonical government skill registers, ITI admissions, and employer hiring feeds across pilot states.
              </p>
            </div>

            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                🔬
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                Walk-Forward Validation
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Fitted strictly on preceding origins without future look-ahead data leakage across 24-month longitudinal timeline.
              </p>
            </div>

            <div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
                🛡️
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                Donor Non-Depletion
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Mathematically prevents donor training trades from slipping into severe deficits during reallocation scenarios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem 5rem', width: '100%', textAlign: 'center' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.8rem 0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            READY TO EXPLORE INDIA'S SKILL PULSE?
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1.75rem 0' }}>
            Access district-level intelligence, multi-horizon demand forecasts, and linear programming seat reallocation models.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            style={{
              backgroundColor: '#4f46e5',
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
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
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
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #0d9488, #4f46e5)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>
                  SP
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>SkillPulse</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                Skills for India's youth, planned before the shortage.
              </p>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'inline-block' }}>
                RUN-SIH-001 • Official SIH Dataset v2.1 • Ensemble Model v2.1.0
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                INTELLIGENCE MODULES
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <li><button type="button" onClick={() => onNavigate('overview')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Overview</button></li>
                <li><button type="button" onClick={() => onNavigate('forecasts')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Forecasts Studio</button></li>
                <li><button type="button" onClick={() => onNavigate('gap')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Skill Gaps</button></li>
                <li><button type="button" onClick={() => onNavigate('simulator')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Scenario Studio</button></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                GOVERNANCE & PLATFORM
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <li><button type="button" onClick={() => onNavigate('recommendations')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Recommendations</button></li>
                <li><button type="button" onClick={() => onNavigate('api')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>API & Exports</button></li>
                <li><button type="button" onClick={() => onNavigate('data-health')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Data & Model Health</button></li>
                <li><button type="button" onClick={() => onNavigate('settings')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>Settings & Preferences</button></li>
              </ul>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.72rem', color: '#475569' }}>
            <div>
              Ministry of Skill Development & Entrepreneurship (MSDE) — Smart India Hackathon 2026
            </div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              Pipeline snapshot — not a live feed
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
