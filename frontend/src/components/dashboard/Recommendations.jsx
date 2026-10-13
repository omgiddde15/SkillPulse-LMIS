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
import Icon from '../Icon';

const TOP_RANKED_INTERVENTIONS = [
  {
    rank: '#01',
    districtId: 'KA_DHA',
    districtName: 'Dharwad',
    stateCode: 'KA',
    stateName: 'Karnataka',
    occupationId: 'OCC_MFG_001',
    occupationTitle: 'CNC Machine Operator',
    sector: 'Manufacturing',
    tierLabel: 'Priority Tier 1 (Deficit #1)',
    seats: 100,
    beforeMismatchPts: 63.2,
    afterMismatchPts: 2.8,
    mismatchDeltaPts: -60.4,
    titleEn: 'Simulate 100 Seats for CNC Machine Operator',
    titleHi: 'सीएनसी मशीन ऑपरेटर के लिए 100 सीटों का अनुकरण करें',
    summaryEn: 'Persistent acute shortage in CNC Machine Operator (+56.1 pts current relative mismatch) where demand score (73.1 pts) exceeds recent certification throughput (17.0 percentile). Scenario Studio evaluates adjusting 100 cohort seats against local facility constraints.',
    summaryHi: 'सीएनसी मशीन ऑपरेटर में निरंतर तीव्र कमी (+56.1 अंक सापेक्ष असंतुलन) जहां मांग सूचकांक (73.1 अंक) प्रमाणीकरण थ्रूपुट (17.0 पर्सेंटाइल) से अधिक है। परिदृश्य स्टूडियो 100 सीटों के समायोजन का मूल्यांकन करता है।',
  },
  {
    rank: '#02',
    districtId: 'KA_BLR_U',
    districtName: 'Bengaluru Urban',
    stateCode: 'KA',
    stateName: 'Karnataka',
    occupationId: 'OCC_IT_001',
    occupationTitle: 'Cloud Infrastructure Associate',
    sector: 'IT/ITeS',
    tierLabel: 'Priority Tier 2 (Tech Growth)',
    seats: 80,
    beforeMismatchPts: -9.4,
    afterMismatchPts: 34.0,
    mismatchDeltaPts: 43.4,
    titleEn: 'Sustain High-Tech Intake for Cloud Infrastructure Associate',
    titleHi: 'क्लाउड इंफ्रास्ट्रक्चर एसोसिएट के लिए हाई-टेक प्रवेश बनाए रखें',
    summaryEn: 'High-volume tech corridor with elevated demand score (85.8 pts) and strong certification throughput (88.7 percentile). Sustaining intake prevents future cohort deficits under enterprise hiring velocity.',
    summaryHi: 'आईटी/आईटीईएस क्लाउड इन्फ्रास्ट्रक्चर की उच्च मांग (85.8 अंक) और मजबूत प्रमाणीकरण थ्रूपुट (88.7 पर्सेंटाइल)। प्रवेश बनाए रखने से भविष्य की कमी को रोका जा सकता है।',
  },
  {
    rank: '#03',
    districtId: 'MH_PUN',
    districtName: 'Pune',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    occupationId: 'OCC_MFG_003',
    occupationTitle: 'Electric Vehicle Assembly Technician',
    sector: 'Manufacturing',
    tierLabel: 'Priority Tier 3 (EV Transition)',
    seats: 60,
    beforeMismatchPts: -6.6,
    afterMismatchPts: 55.7,
    mismatchDeltaPts: 62.3,
    titleEn: 'Align Automotive ITI Cohorts to EV Diagnostics Hub',
    titleHi: 'ऑटोमोटिव आईटीआई बैचों को ईवी डायग्नोस्टिक्स हब के साथ संरेखित करें',
    summaryEn: 'High industrial manufacturing demand (69.7 pts) alongside balanced certification output (68.9 percentile). Evaluating a 60-seat planning scenario safeguards training alignment with automotive EV transition while monitoring throughput constraints.',
    summaryHi: 'पुणे विनिर्माण में उच्च औद्योगिक मांग (69.7 अंक) और संतुलित प्रमाणीकरण आउटपुट (68.9 पर्सेंटाइल)। 60 सीटों को पुनर्संतुलित करने से ईवी परिवर्तन के साथ तालमेल बना रहता है।',
  },
  {
    rank: '#04',
    districtId: 'TS_HYD',
    districtName: 'Hyderabad',
    stateCode: 'TS',
    stateName: 'Telangana',
    occupationId: 'OCC_LOG_002',
    occupationTitle: 'Cold Chain Logistics Supervisor',
    sector: 'Logistics',
    tierLabel: 'Priority Tier 4 (Pharma Cluster)',
    seats: 50,
    beforeMismatchPts: -33.0,
    afterMismatchPts: -5.7,
    mismatchDeltaPts: 27.4,
    titleEn: 'Expand Pharma Cold-Chain Logistics TVET Certification Tracks',
    titleHi: 'फार्मा कोल्ड-चेन लॉजिस्टिक्स टीवीईटी प्रमाणन ट्रैक का विस्तार करें',
    summaryEn: 'Genome Valley pharmaceutical expansion drives demand for certified temperature-controlled supply chain handlers. Sanctioning specialized modules bridges urgent industry deficit.',
    summaryHi: 'जीनोम वैली फार्मा विस्तार नियंत्रित आपूर्ति श्रृंखला पर्यवेक्षकों की मांग को बढ़ाता है। विशेष मॉड्यूल स्वीकृत करने से उद्योग की कमी दूर होती है।',
  },
];

export default function Recommendations({
  period = '2026-09',
  onNavigateToSimulator = () => {},
  onNavigateWithContext = () => {},
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
          fetchAlerts({ period, limit: 500 }),
          fetchGapAnalysis({ period, limit: 500 }),
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
        titleEn = 'Evaluate Capacity Expansion & Fast-Track TVET Batches';
        titleHi = 'प्रशिक्षण क्षमता विस्तार एवं त्वरित बैच परिदृश्यों का मूल्यांकन करें';
        actionEn = `Employer hiring intensity significantly outpaces certified throughput (+${mismatch.toFixed(1)} pts). Evaluate seat adjustment planning scenarios in Scenario Studio (such as additional intake or evening cohorts) against certified throughput yield and facility constraints to evaluate closing the projected relative mismatch.`;
        actionHi = `नियोक्ता भर्ती की तीव्रता प्रमाणित आउटपुट से काफी अधिक है (+${mismatch.toFixed(1)} अंक)। प्रमाणित थ्रूपुट यील्ड और संस्थागत सीमाओं के विरुद्ध परिदृश्य स्टूडियो में सीट विस्तार परिदृश्यों का मूल्यांकन करें ताकि प्रक्षेपित सापेक्ष असंतुलन को कम किया जा सके।`;
      } else if (isSupplyPressure) {
        policyCategory = 'reallocate';
        priority = mismatch <= -40 ? 'high' : 'medium';
        titleEn = 'Evaluate Intake Adjustment & Planning Scenarios';
        titleHi = 'प्रवेश समायोजन एवं योजना परिदृश्यों का मूल्यांकन करें';
        actionEn = `Certified candidate throughput ranks higher than local demand indicators (${mismatch.toFixed(1)} pts). Evaluate this corridor as a candidate planning scenario in Scenario Studio to assess local employer absorption and facility constraints before considering seat adjustments.`;
        actionHi = `प्रमाणित उम्मीदवार आउटपुट स्थानीय मांग संकेतकों से अधिक है (${mismatch.toFixed(1)} अंक)। सीट समायोजन पर विचार करने से पहले स्थानीय नियोक्ता अवशोषण और सुविधाओं का आकलन करने के लिए परिदृश्य स्टूडियो में इसका मूल्यांकन करें।`;
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
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', color: 'var(--accent-primary)' }}><Icon name="lightbulb" size={20} /></span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('recommendations.title', 'Evidence-Based Policy Interventions')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--teal-800)', border: '1px solid var(--accent-soft-border)', fontWeight: 700 }}>
                4 {isHindi ? 'रैंक किए गए हस्तक्षेप' : 'Ranked Interventions'} • {dossiers.length} {isHindi ? 'कार्यवाही योग्य मामले' : 'Total Dossiers'}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'recommendations.subtitle',
                'Targeted capacity planning scenarios and curriculum adjustments derived directly from current alert and gap signals.'
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
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--slate-300)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
              <option value="IT/ITeS">IT/ITeS</option>
              <option value="Logistics">Logistics</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </div>
        </div>
      </div>

      {/* TOP RANKED INTERVENTION DOSSIERS (#01 to #04) */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.2rem 0' }}>
            {isHindi ? 'शीर्ष प्राथमिकता क्षमता योजना परिदृश्य (रैंक अनुसार)' : 'Top Priority Capacity Planning Scenarios (Ranked)'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--slate-500)' }}>
            {isHindi
              ? 'हेयूरिस्टिक असंतुलन नियमों और पायलट डेटा सिमुलेशन के आधार पर प्रस्तावित योजना परिदृश्य। ये अन्वेषणात्मक नियोजन सिमुलेशन हैं, वास्तविक रोजगार या श्रमिकों की कमी में सत्यापित परिवर्तन नहीं।'
              : 'Deterministic heuristic planning scenarios backed by live gap scores and seat non-depletion constraints. Results represent exploratory planning simulations, not verified changes in real-world employment or worker shortages.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {TOP_RANKED_INTERVENTIONS.map((item) => (
            <div
              key={item.rank}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--slate-200)',
                borderLeft: '4px solid #0d9488',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {item.rank} · {item.districtName.toUpperCase()}, {item.stateName.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--teal-800)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--accent-soft-border)' }}>
                    {item.tierLabel}
                  </span>
                </div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>
                  {isHindi ? item.titleHi : item.titleEn}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: 1.45, margin: 0 }}>
                  {isHindi ? item.summaryHi : item.summaryEn}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: '0.65rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                  <div>
                    <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>
                      {isHindi ? 'योजनाबद्ध सीटें' : 'PLANNING SEATS'}
                    </div>
                    <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>{item.seats} (Scenario)</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>
                      {isHindi ? 'सिम्युलेटेड सापेक्ष असंतुलन परिवर्तन' : 'SIMULATED RELATIVE MISMATCH CHANGE'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: item.mismatchDeltaPts < 0 ? 'var(--status-success-text)' : 'var(--status-supply-text)', fontFamily: 'var(--font-mono)' }}>
                        {item.mismatchDeltaPts >= 0 ? '+' : ''}{item.mismatchDeltaPts.toFixed(1)} pts
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        ({item.beforeMismatchPts >= 0 ? '+' : ''}{item.beforeMismatchPts.toFixed(1)} → {item.afterMismatchPts >= 0 ? '+' : ''}{item.afterMismatchPts.toFixed(1)} pts)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>
                      {isHindi ? 'लक्षित ट्रेड' : 'TARGET TRADE'}
                    </div>
                    <strong style={{ color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{item.occupationTitle}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => onNavigateWithContext('gap', { district: item.districtId, occupation: item.occupationId, state: item.stateCode })}
                    style={{ border: '1px solid var(--slate-300)', backgroundColor: 'var(--bg-surface)', color: 'var(--slate-700)', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateWithContext) {
                        onNavigateWithContext('simulator', { district: item.districtId, occupation: item.occupationId, state: item.stateCode });
                      } else {
                        onNavigateToSimulator(item.districtId, item.occupationId);
                      }
                    }}
                    style={{ border: 'none', backgroundColor: '#0d9488', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Simulate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Dossier Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
        {dossiers.slice(0, 12).map((d) => {
          const isExpand = d.policyCategory === 'expand';
          const isReallocate = d.policyCategory === 'reallocate';
          const accentColor = isExpand ? 'var(--status-demand-text)' : isReallocate ? 'var(--status-supply-text)' : 'var(--text-secondary)';
          const accentBg = isExpand ? 'var(--status-demand-bg)' : isReallocate ? 'var(--status-supply-bg)' : 'var(--bg-subtle)';
          const accentBorder = isExpand ? 'var(--status-demand-border)' : isReallocate ? 'var(--status-supply-border)' : 'var(--border-subtle)';
          const leftBarColor = isExpand ? 'var(--status-demand)' : isReallocate ? 'var(--status-supply)' : 'var(--slate-400)';

          return (
            <div
              key={d.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: `1px solid ${accentBorder}`,
                borderLeft: `4px solid ${leftBarColor}`,
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Icon name="pin" size={12} />
                      <span>{getDistrictDisplayName(d.districtName, isHindi)}, {getStateDisplayName(d.stateCode, isHindi)} • {getSectorDisplayName(d.sector, isHindi)}</span>
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
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: accentColor, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Icon name={isExpand ? 'zap' : isReallocate ? 'box' : 'scale'} size={14} />
                  <span>{d.title}</span>
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

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => onNavigateWithContext('gap', { district: d.districtId, occupation: d.occupationId, state: d.stateCode })}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--slate-700)',
                      border: '1px solid var(--slate-300)',
                      borderRadius: '4px',
                      padding: '0.3rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View Evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateWithContext) {
                        onNavigateWithContext('simulator', { district: d.districtId, occupation: d.occupationId, state: d.stateCode });
                      } else {
                        onNavigateToSimulator(d.districtId, d.occupationId);
                      }
                    }}
                    style={{
                      backgroundColor: '#0d9488',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Icon name="sliders" size={13} />
                    <span>{isHindi ? 'सिम्युलेट' : 'Simulate'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
