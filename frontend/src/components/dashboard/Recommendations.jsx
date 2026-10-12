import React, { useState, useEffect } from 'react';
import { fetchAlerts, fetchGapAnalysis } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getOccupationDisplayName,
  getSectorDisplayName,
} from '../../i18n/translations';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

export default function Recommendations({
  period = '2026-09',
  onNavigateToSimulator = () => {},
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [alerts, setAlerts] = useState([]);
  const [gapItems, setGapItems] = useState([]);
  const [sectorFilter, setSectorFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [alertsRes, gapRes] = await Promise.all([
          fetchAlerts({ period, limit: 100 }),
          fetchGapAnalysis({ period, limit: 100 }),
        ]);
        if (ignore) return;
        setAlerts(alertsRes.results || alertsRes.alerts || []);
        setGapItems(gapRes.results || gapRes.records || []);
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load policy recommendation inputs.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadData();
    return () => { ignore = true; };
  }, [period]);

  // Derive evidence-based policy dossiers from alerts and gap scores
  const dossiers = React.useMemo(() => {
    if (!gapItems.length) return [];

    // Filter by sector if selected
    const filtered = sectorFilter
      ? gapItems.filter((g) => g.sector === sectorFilter)
      : gapItems;

    return filtered.map((item) => {
      const relatedAlerts = alerts.filter(
        (a) => a.district_id === item.district_id && a.occupation_id === item.occupation_id
      );
      const mismatch = Number(item.relative_mismatch_score ?? item.mismatch ?? 0);
      const isDemandPressure = mismatch >= 15;
      const isSupplyPressure = mismatch <= -15;

      let policyCategory = 'balanced';
      let titleEn = 'Maintain Baseline Capacity & Monitor Hiring Velocity';
      let titleHi = 'आधारभूत क्षमता बनाए रखें एवं भर्ती गति की निगरानी करें';
      let actionEn = 'Continue current TVET intake levels; observe 3-month employer demand trajectory before altering seat sanctions.';
      let actionHi = 'वर्तमान टीवीईटी प्रवेश स्तर जारी रखें; सीट स्वीकृति बदलने से पहले 3-माह के नियोक्ता मांग रुझान की निगरानी करें।';
      let priority = 'low';

      if (isDemandPressure) {
        policyCategory = 'expand';
        priority = mismatch >= 40 ? 'critical' : 'high';
        titleEn = 'Sanction Capacity Expansion & Fast-Track TVET Batches';
        titleHi = 'प्रशिक्षण क्षमता विस्तार स्वीकृत करें एवं त्वरित बैच प्रारंभ करें';
        actionEn = `Employer hiring intensity significantly outpaces certified throughput (+${mismatch.toFixed(1)} pts). Reallocate donor seats from low-demand trades or add evening cohorts to close the projected shortfall.`;
        actionHi = `नियोक्ता भर्ती की तीव्रता प्रमाणित आउटपुट से काफी अधिक है (+${mismatch.toFixed(1)} अंक)। अधिशेष ट्रेडों से सीटें पुनर्वितरित करें या अनुमानित कमी को पूरा करने के लिए अतिरिक्त बैच शुरू करें।`;
      } else if (isSupplyPressure) {
        policyCategory = 'reallocate';
        priority = mismatch <= -40 ? 'high' : 'medium';
        titleEn = 'Consolidate Intake & Reallocate Seats to Deficit Trades';
        titleHi = 'प्रवेश स्तर संतुलित करें एवं सीटों को मांग वाले ट्रेडों में स्थानांतरित करें';
        actionEn = `Certified candidate throughput exceeds local hiring absorption (${mismatch.toFixed(1)} pts). Reallocate underutilized sanctioned seats to regional high-demand occupations to safeguard employment outcomes.`;
        actionHi = `प्रमाणित उम्मीदवार आउटपुट स्थानीय भर्ती अवशोषण से अधिक है (${mismatch.toFixed(1)} अंक)। रोजगार परिणामों को सुरक्षित करने के लिए कम उपयोग की गई सीटों को उच्च मांग वाले व्यवसायों में स्थानांतरित करें।`;
      }

      return {
        id: `${item.district_id}_${item.occupation_id}`,
        districtId: item.district_id,
        districtName: item.district_name,
        stateCode: item.state_code || item.state,
        occupationId: item.occupation_id,
        occupationTitle: item.occupation_title,
        sector: item.sector,
        mismatch,
        demandIndex: Number(item.demand_index_score ?? item.demand_index ?? 0),
        supplyIndex: Number(item.supply_output_index ?? item.supply_index ?? 0),
        alertCount: relatedAlerts.length,
        policyCategory,
        priority,
        title: isHindi ? titleHi : titleEn,
        action: isHindi ? actionHi : actionEn,
      };
    }).sort((a, b) => Math.abs(b.mismatch) - Math.abs(a.mismatch));
  }, [gapItems, alerts, sectorFilter, isHindi]);

  if (isLoading) {
    return <LoadingSpinner message={isHindi ? 'साक्ष्य-आधारित नीतिगत सिफारिशें तैयार की जा रही हैं...' : 'Generating evidence-based policy intervention dossiers...'} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>💡</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('recommendations.title', 'Evidence-Based Policy Interventions')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: 'var(--teal-800)', border: '1px solid #99f6e4', fontWeight: 700 }}>
                {dossiers.length} {isHindi ? 'कार्यवाही योग्य मामले' : 'Actionable Dossiers'}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'recommendations.subtitle',
                'Targeted seat reallocation and curriculum adjustments derived directly from current alert and gap signals.'
              )}
            </p>
          </div>

          {/* Sector Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="rec-sector" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)' }}>
              {t('common.sector', 'Sector')}:
            </label>
            <select
              id="rec-sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--slate-300)', backgroundColor: 'var(--slate-50)' }}
            >
              <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
              <option value="IT/ITeS">IT/ITeS</option>
              <option value="Logistics">Logistics</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dossier Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
        {dossiers.slice(0, 12).map((d) => {
          const isExpand = d.policyCategory === 'expand';
          const isReallocate = d.policyCategory === 'reallocate';
          const accentColor = isExpand ? '#c2410c' : isReallocate ? '#1d4ed8' : '#475569';
          const accentBg = isExpand ? '#fff7ed' : isReallocate ? '#eff6ff' : '#f8fafc';
          const accentBorder = isExpand ? '#ffedd5' : isReallocate ? '#dbeafe' : '#e2e8f0';

          return (
            <div
              key={d.id}
              style={{
                backgroundColor: '#ffffff',
                border: `1px solid ${accentBorder}`,
                borderLeft: `4px solid ${accentColor}`,
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                {/* District & Occupation Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                      {getOccupationDisplayName(d.occupationTitle, isHindi)}
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                      📍 {getDistrictDisplayName(d.districtName, isHindi)}, {getStateDisplayName(d.stateCode, isHindi)} • {getSectorDisplayName(d.sector, isHindi)}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: accentBg,
                      color: accentColor,
                      border: `1px solid ${accentBorder}`,
                    }}
                  >
                    {d.mismatch > 0 ? `+${d.mismatch.toFixed(1)}` : d.mismatch.toFixed(1)} pts
                  </span>
                </div>

                {/* Recommendation Title */}
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: accentColor, marginBottom: '0.4rem' }}>
                  {isExpand ? '⚡ ' : isReallocate ? '📦 ' : '⚖️ '}
                  {d.title}
                </div>

                {/* Evidence & Action Text */}
                <p style={{ fontSize: '0.76rem', color: 'var(--slate-600)', lineHeight: 1.5, margin: 0 }}>
                  {d.action}
                </p>
              </div>

              {/* Card Footer: Metrics & Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--slate-100)', paddingTop: '0.65rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                  Demand: {d.demandIndex.toFixed(1)} | Supply: {d.supplyIndex.toFixed(1)}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToSimulator(d.districtId, d.occupationId)}
                  style={{
                    backgroundColor: 'var(--slate-100)',
                    color: 'var(--teal-800)',
                    border: '1px solid var(--teal-200)',
                    borderRadius: '4px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0fdfa')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--slate-100)')}
                >
                  <span>🎛️</span>
                  <span>{isHindi ? 'सिम्युलेटर में परीक्षण करें' : 'Test in Simulator'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
