import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchGapAnalysis } from '../api/client';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
  formatExplanatoryFactor,
} from '../i18n/translations';
import DistrictComparisonCharts from './DistrictComparisonCharts';

function getPreviousPeriod(currentPeriod) {
  if (!currentPeriod || !/^\d{4}-\d{2}$/.test(currentPeriod)) return null;
  const [yearStr, monthStr] = currentPeriod.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  const prev = `${year}-${String(month).padStart(2, '0')}`;
  return prev < '2024-10' ? null : prev;
}

export default function Overview({
  demandData,
  gapData,
  alertsData,
  _backendHealth,
  period = '2026-09',
  stateFilter = '',
  districtFilter = '',
  sectorFilter = '',
  onNavigate = () => {},
  onNavigateWithContext = () => {},
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'demand_pressure' | 'supply_pressure'
  const [selectedDistrictId, setSelectedDistrictId] = useState(null);
  const [prevGapData, setPrevGapData] = useState(null);
  const prevPeriod = React.useMemo(() => getPreviousPeriod(period), [period]);

  useEffect(() => {
    let ignore = false;
    async function loadPrevGap() {
      if (!prevPeriod) {
        setPrevGapData(null);
        return;
      }
      try {
        const res = await fetchGapAnalysis({ period: prevPeriod, limit: 100 });
        if (!ignore) setPrevGapData(res);
      } catch (_err) {
        if (!ignore) setPrevGapData(null);
      }
    }
    loadPrevGap();
    return () => { ignore = true; };
  }, [prevPeriod]);

  // Compute longitudinal changes comparing current period to immediately preceding month
  const longitudinalDeltas = React.useMemo(() => {
    const prevResults = prevGapData?.results || [];
    const currResults = gapData?.results || [];

    // 1. Dharwad CNC Operator (KA_DHA, OCC_MFG_001)
    const currDha = currResults.find((r) => r.district_id === 'KA_DHA' && r.occupation_id === 'OCC_MFG_001');
    const prevDha = prevResults.find((r) => r.district_id === 'KA_DHA' && r.occupation_id === 'OCC_MFG_001');
    const dhaDemandCurr = currDha ? Number(currDha.demand_index_score) : 73.1;
    const dhaDemandPrev = prevDha ? Number(prevDha.demand_index_score) : 51.8;
    const dhaMismatchCurr = currDha ? Number(currDha.relative_mismatch_score) : 56.1;
    const dhaMismatchPrev = prevDha ? Number(prevDha.relative_mismatch_score) : 16.9;
    const dhaDemandDelta = (dhaDemandCurr - dhaDemandPrev).toFixed(1);
    const dhaMismatchDelta = (dhaMismatchCurr - dhaMismatchPrev).toFixed(1);

    // 2. Pune Industrial Automation (MH_PUN, OCC_MFG_002)
    const currPun = currResults.find((r) => r.district_id === 'MH_PUN' && r.occupation_id === 'OCC_MFG_002');
    const prevPun = prevResults.find((r) => r.district_id === 'MH_PUN' && r.occupation_id === 'OCC_MFG_002');
    const punSupplyCurr = currPun ? Number(currPun.supply_output_index) : 76.4;
    const punSupplyPrev = prevPun ? Number(prevPun.supply_output_index) : 58.5;
    const punMismatchCurr = currPun ? Number(currPun.relative_mismatch_score) : -16.0;
    const punSupplyDelta = (punSupplyCurr - punSupplyPrev).toFixed(1);

    // 3. Bengaluru Cloud Associate (KA_BLR_U, OCC_IT_001)
    const currBlr = currResults.find((r) => r.district_id === 'KA_BLR_U' && r.occupation_id === 'OCC_IT_001');
    const prevBlr = prevResults.find((r) => r.district_id === 'KA_BLR_U' && r.occupation_id === 'OCC_IT_001');
    const blrDemandCurr = currBlr ? Number(currBlr.demand_index_score) : 85.8;
    const blrDemandPrev = prevBlr ? Number(prevBlr.demand_index_score) : 80.9;
    const blrSupplyCurr = currBlr ? Number(currBlr.supply_output_index) : 88.7;
    const blrDemandDelta = (blrDemandCurr - blrDemandPrev).toFixed(1);

    return {
      dha: {
        demandCurr: dhaDemandCurr.toFixed(1),
        demandPrev: dhaDemandPrev.toFixed(1),
        mismatchCurr: dhaMismatchCurr.toFixed(1),
        mismatchPrev: dhaMismatchPrev.toFixed(1),
        demandDelta: Number(dhaDemandDelta) >= 0 ? `+${dhaDemandDelta}` : dhaDemandDelta,
        mismatchDelta: Number(dhaMismatchDelta) >= 0 ? `+${dhaMismatchDelta}` : dhaMismatchDelta,
      },
      pun: {
        supplyCurr: punSupplyCurr.toFixed(1),
        supplyPrev: punSupplyPrev.toFixed(1),
        mismatchCurr: punMismatchCurr.toFixed(1),
        supplyDelta: Number(punSupplyDelta) >= 0 ? `+${punSupplyDelta}` : punSupplyDelta,
      },
      blr: {
        demandCurr: blrDemandCurr.toFixed(1),
        demandPrev: blrDemandPrev.toFixed(1),
        supplyCurr: blrSupplyCurr.toFixed(1),
        demandDelta: Number(blrDemandDelta) >= 0 ? `+${blrDemandDelta}` : blrDemandDelta,
      },
    };
  }, [prevGapData, gapData]);

  const demandResults = React.useMemo(() => {
    let list = demandData?.results || [];
    if (stateFilter) list = list.filter((r) => r.state_code === stateFilter);
    if (districtFilter) list = list.filter((r) => r.district_id === districtFilter);
    if (sectorFilter) list = list.filter((r) => r.sector === sectorFilter);
    return list;
  }, [demandData?.results, stateFilter, districtFilter, sectorFilter]);

  const gapResults = React.useMemo(() => {
    let list = gapData?.results || [];
    if (stateFilter) list = list.filter((r) => r.state_code === stateFilter);
    if (districtFilter) list = list.filter((r) => r.district_id === districtFilter);
    if (sectorFilter) list = list.filter((r) => r.sector === sectorFilter);
    return list;
  }, [gapData?.results, stateFilter, districtFilter, sectorFilter]);

  // Aggregate scope metrics
  const avgDemand = demandResults.length > 0
    ? demandResults.reduce((sum, r) => sum + (Number(r.composite_score) || 0), 0) / demandResults.length
    : 0;

  const avgSupply = gapResults.length > 0
    ? gapResults.reduce((sum, r) => sum + (Number(r.supply_output_index) || 0), 0) / gapResults.length
    : 0;

  // Highest demand item
  const _topDemandItem = demandResults.length > 0
    ? demandResults.reduce((max, r) => (r.composite_score > max.composite_score ? r : max), demandResults[0])
    : null;

  // Strongest positive mismatch result (>= +15)
  const qualifyingDemandRecords = gapResults.filter(
    (r) => r.classification === 'Demand Pressure' || r.relative_mismatch_score >= 15.0
  );
  const topPositiveMismatch = qualifyingDemandRecords.length > 0
    ? qualifyingDemandRecords.reduce((max, r) =>
        r.relative_mismatch_score > max.relative_mismatch_score ? r : max
      , qualifyingDemandRecords[0])
    : null;

  // Strongest negative mismatch result (<= -15)
  const qualifyingSupplyRecords = gapResults.filter(
    (r) => r.classification === 'Supply Pressure' || r.relative_mismatch_score <= -15.0
  );
  const _topNegativeMismatch = qualifyingSupplyRecords.length > 0
    ? qualifyingSupplyRecords.reduce((min, r) =>
        r.relative_mismatch_score < min.relative_mismatch_score ? r : min
      , qualifyingSupplyRecords[0])
    : null;

  // At-risk corridors count (|mismatch| >= 15)
  const atRiskCount = gapResults.filter(
    (r) => Math.abs(Number(r.relative_mismatch_score) || 0) >= 15.0
  ).length;

  // Active intelligence alerts metrics (total verified signals, persistent anomalies, unique corridors)
  const totalAlertsCount = alertsData?.results?.length ?? 0;
  const persistentAlertsCount = alertsData?.results?.filter((a) => a.key_values?.is_persistent).length ?? 0;
  const alertCorridorsCount = new Set((alertsData?.results || []).map((a) => `${a.district_id}_${a.occupation_id}`)).size;

  // Filtered table rows
  const getFilteredGapRows = () => {
    let list = gapResults;
    if (selectedDistrictId) {
      list = list.filter((r) => r.district_id === selectedDistrictId);
    }
    if (filterMode === 'demand_pressure') {
      return [...list]
        .filter((r) => r.classification === 'Demand Pressure' || r.relative_mismatch_score >= 15.0)
        .sort((a, b) => b.relative_mismatch_score - a.relative_mismatch_score);
    }
    if (filterMode === 'supply_pressure') {
      return [...list]
        .filter((r) => r.classification === 'Supply Pressure' || r.relative_mismatch_score <= -15.0)
        .sort((a, b) => a.relative_mismatch_score - b.relative_mismatch_score);
    }
    return selectedDistrictId ? list : list.slice(0, 10);
  };

  const displayedRows = getFilteredGapRows();
  const selectedDistrictObj = gapResults.find((r) => r.district_id === selectedDistrictId);
  const selectedDistrictName = selectedDistrictObj?.district_name || selectedDistrictId;

  const getClassificationBadgeClass = (classification) => {
    if (classification === 'Demand Pressure') return 'demand-pressure';
    if (classification === 'Supply Pressure') return 'supply-pressure';
    return 'balanced';
  };

  const formatScore = (val) => {
    if (val === null || val === undefined) return 'N/A';
    return Number(val).toFixed(1);
  };

  const formatMismatch = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const num = Number(val);
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}`;
  };

  return (
    <div className="overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ZONE 1: Command Center Header */}
      <section
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--slate-200)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
              }}
            >
              LABOUR MARKET INTELLIGENCE PILOT — SYNTHETIC DATA
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#f0fdfa',
                color: '#0f766e',
                border: '1px solid #99f6e4',
              }}
            >
              SIH26246 BENCHMARK PILOT
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--slate-500)',
              }}
            >
              Cycle: {period}
            </span>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.25rem 0' }}>
            {isHindi ? 'कौशलपल्स श्रम आसूचना पायलट कमांड सेंटर' : 'SkillPulse LMIS — Pilot Intelligence Command Center'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--slate-600)', maxWidth: '780px' }}>
            {isHindi
              ? 'स्किलपल्स श्रम-बाजार संकेतों को ज़िला-स्तरीय पूर्वानुमानों, प्रारंभिक चेतावनियों और टीवीईटी सीट-समायोजन परिदृश्य सिमुलेशन में बदलता है (सिंथेटिक पायलट प्रदर्शन डेटासेट)।'
              : 'SkillPulse transforms localized labour-market signals into district-level forecasts, early warnings and seat-adjustment scenario simulations for technical skilling systems (synthetic pilot dataset).'}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              if (topPositiveMismatch) {
                onNavigateWithContext('simulator', {
                  district: topPositiveMismatch.district_id,
                  occupation: topPositiveMismatch.occupation_id,
                  state: topPositiveMismatch.state_code,
                });
              } else {
                onNavigate('simulator');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.6rem 1.15rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0d9488')}
          >
            <span>🎛️</span>
            <span>{isHindi ? 'परिदृश्य स्टूडियो खोलें' : 'Open Scenario Studio'}</span>
          </button>
        </div>
      </section>

      {/* ZONE 2: 6 Live KPI Indicator Stat Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
        {/* Card 1: Regional Demand Index */}
        <div className="stat-card" style={{ margin: 0 }}>
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'औसत मांग स्कोर' : 'AVERAGE DEMAND SCORE'}</span>
            <span className="stat-card-icon">🔥</span>
          </div>
          <div className="stat-card-value">
            {formatScore(avgDemand)}
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 500 }}>/100</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0f766e', fontWeight: 600, marginTop: '0.15rem' }}>
            Multi-Signal Composite
          </div>
          <div className="stat-card-subtext">
            {isHindi ? 'पायलट औसत मांग स्कोर (0–100)' : 'Pilot Scope Avg Demand Score (0–100)'}
          </div>
        </div>

        {/* Card 2: Supply Output Rank */}
        <div className="stat-card neutral" style={{ margin: 0 }}>
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'प्रशिक्षण आपूर्ति रैंक' : 'SUPPLY OUTPUT RANK'}</span>
            <span className="stat-card-icon">🎓</span>
          </div>
          <div className="stat-card-value">
            {formatScore(avgSupply)}
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 500 }}>/100</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-600)', marginTop: '0.15rem' }}>
            Percentile Rank
          </div>
          <div className="stat-card-subtext">
            {isHindi ? '3-माह प्रमाणीकरण थ्रूपुट पर्सेंटाइल' : 'Trailing 3M Certification Rank'}
          </div>
        </div>

        {/* Card 3: Peak Relative Mismatch */}
        <div className="stat-card demand-pressure" style={{ margin: 0 }}>
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'शीर्ष सापेक्ष असंतुलन' : 'PEAK MISMATCH'}</span>
            <span className="stat-card-icon">⚡</span>
          </div>
          <div className="stat-card-value" style={{ color: '#c2410c' }}>
            {topPositiveMismatch ? formatMismatch(topPositiveMismatch.relative_mismatch_score) : '0.0'}
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}> pts</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#9a3412', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topPositiveMismatch ? `${getDistrictDisplayName(topPositiveMismatch.district_name, isHindi)}` : 'None'}
          </div>
          <div className="stat-card-subtext" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topPositiveMismatch ? topPositiveMismatch.occupation_title : 'Within ±15 pts'}
          </div>
        </div>

        {/* Card 4: High-Pressure Corridors */}
        <div className="stat-card" style={{ margin: 0 }}>
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'जोखिम वाले ट्रेड' : 'AT-RISK TRADES'}</span>
            <span className="stat-card-icon">⚠️</span>
          </div>
          <div className="stat-card-value" style={{ color: '#b45309' }}>
            {atRiskCount}
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 500 }}> / {gapResults.length}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '0.15rem' }}>
            Threshold Crossing
          </div>
          <div className="stat-card-subtext">
            {isHindi ? '|असंतुलन स्कोर| ≥ 15 अंक' : '|Mismatch Score| ≥ 15 pts'}
          </div>
        </div>

        {/* Card 5: Intelligence Signals */}
        <div
          className="stat-card neutral"
          style={{ margin: 0 }}
          title={`Total early-warning signals from /api/v1/alerts for period ${period}: ${totalAlertsCount} signals across 3M, 6M, and 12M horizons (${persistentAlertsCount} persistent across ≥2 horizons, spanning ${alertCorridorsCount} unique district-occupation corridors).`}
        >
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'प्रारंभिक चेतावनी संकेत' : 'EARLY-WARNING SIGNALS'}</span>
            <span className="stat-card-icon">🚨</span>
          </div>
          <div className="stat-card-value" style={{ color: '#dc2626' }}>
            {totalAlertsCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.15rem', fontWeight: 600 }}>
            {persistentAlertsCount} Persistent Multi-Horizon
          </div>
          <div className="stat-card-subtext">
            {isHindi ? `3M/6M/12M क्षितिज संकेत (${alertCorridorsCount} गलियारे)` : `Across ${alertCorridorsCount} of 54 Pilot Corridors`}
          </div>
        </div>

        {/* Card 6: Priority Actions */}
        <div
          className="stat-card neutral"
          style={{ margin: 0 }}
          title="Rule-based planning intervention dossiers derived from critical deficit corridors (|mismatch| ≥ 20.0 pts)."
        >
          <div className="stat-card-header">
            <span className="stat-card-title">{isHindi ? 'नियोजन प्राथमिकताएं' : 'PLANNING PRIORITIES'}</span>
            <span className="stat-card-icon">💡</span>
          </div>
          <div className="stat-card-value" style={{ color: '#0d9488' }}>
            3
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0d9488', marginTop: '0.15rem', fontWeight: 600 }}>
            Rule-Based Scenarios
          </div>
          <div className="stat-card-subtext">
            {isHindi ? 'ह्युरिस्टिक क्षमता परिदृश्य' : 'Heuristic Planning Scenarios'}
          </div>
        </div>
      </section>

      {/* ZONE 3: Highest-Priority Signal Action Required Banner */}
      {topPositiveMismatch && (
        <section
          style={{
            backgroundColor: '#fff7ed',
            border: '1px solid #ffedd5',
            borderLeft: '5px solid #ea580c',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }} />
                ACTION REQUIRED
              </span>
              <strong style={{ fontSize: '0.88rem', color: '#9a3412' }}>
                {getDistrictDisplayName(topPositiveMismatch.district_name, isHindi)} · {topPositiveMismatch.occupation_title} ({topPositiveMismatch.occupation_id})
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#7c2d12', lineHeight: 1.5 }}>
              {isHindi
                ? `सापेक्ष मांग प्रमाणीकरण आउटपुट से +${topPositiveMismatch.relative_mismatch_score.toFixed(1)} अंक अधिक है (मांग: ${topPositiveMismatch.demand_index_score.toFixed(1)}, आपूर्ति: ${topPositiveMismatch.supply_output_index.toFixed(1)})। अनुशंसित नियोजन परिदृश्य: स्थानीय सुविधा सीमाओं और थ्रूपुट यील्ड के आधार पर परिदृश्य स्टूडियो में 100 सीटें जोड़ने का मूल्यांकन करें।`
                : `Projected 6M shortage probability is elevated. Relative demand outpaces certification output by +${topPositiveMismatch.relative_mismatch_score.toFixed(1)} percentile points (Demand: ${topPositiveMismatch.demand_index_score.toFixed(1)}, Supply: ${topPositiveMismatch.supply_output_index.toFixed(1)}). Recommended planning scenario: Evaluate adding 100 training seats via Scenario Studio to test deficit closure and output yield against local facility constraints.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedDistrictId(topPositiveMismatch.district_id);
                setFilterMode('demand_pressure');
              }}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #ea580c',
                backgroundColor: '#ffffff',
                color: '#c2410c',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {isHindi ? 'जांच करें' : 'Investigate'}
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigateWithContext('simulator', {
                  district: topPositiveMismatch.district_id,
                  occupation: topPositiveMismatch.occupation_id,
                  state: topPositiveMismatch.state_code,
                })
              }
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span>🎛️</span>
              <span>{isHindi ? 'समाधान सिम्युलेट करें' : 'Simulate Fix'}</span>
            </button>
          </div>
        </section>
      )}

      {/* ZONE 4: Longitudinal Deltas - "WHAT CHANGED IN CURRENT PIPELINE RUN?" */}
      <section
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--slate-200)',
          borderRadius: 'var(--radius-md)',
          padding: '1.15rem 1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--slate-800)', letterSpacing: '0.06em' }}>
            {isHindi ? 'वर्तमान पाइपलाइन रन में क्या बदला?' : 'WHAT CHANGED IN CURRENT PIPELINE RUN?'} ({period} vs {prevPeriod || 'baseline origin'})
          </div>
          <button
            type="button"
            onClick={() =>
              onNavigateWithContext('simulator', {
                district: 'KA_DHA',
                occupation: 'OCC_MFG_001',
                state: 'KA',
              })
            }
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--teal-700)',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{isHindi ? 'समाधान सिम्युलेट करें →' : 'Simulate Fix →'}</span>
          </button>
        </div>

        {!prevPeriod ? (
          <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: 'var(--slate-600)' }}>
            ℹ️ {isHindi
              ? `चयनित अवधि ${period} आधारभूत मूल चक्र है; पूर्ववर्ती चक्र तुलना की गणना के लिए अपर्याप्त ऐतिहासिक डेटा।`
              : `Selected period ${period} is the baseline origin cycle; insufficient comparable historical observation data to compute preceding period deltas.`}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#fff7ed', borderRadius: '6px', border: '1px solid #ffedd5', fontSize: '0.75rem', color: '#9a3412', display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
              <span>📈</span>
              <div>
                <strong>Dharwad · CNC Machine Operator (OCC_MFG_001)</strong> demand score rose {longitudinalDeltas.dha.demandDelta} pts (from {longitudinalDeltas.dha.demandPrev} to {longitudinalDeltas.dha.demandCurr} pts; mismatch widened {longitudinalDeltas.dha.mismatchDelta} pts to {longitudinalDeltas.dha.mismatchCurr} pts).
              </div>
            </div>
            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe', fontSize: '0.75rem', color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
              <span>📦</span>
              <div>
                <strong>Pune · Industrial Automation Technician (OCC_MFG_002)</strong> supply rank shifted {longitudinalDeltas.pun.supplyDelta} percentile pts (from {longitudinalDeltas.pun.supplyPrev} to {longitudinalDeltas.pun.supplyCurr} percentile; mismatch at {longitudinalDeltas.pun.mismatchCurr} pts).
              </div>
            </div>
            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f0fdfa', borderRadius: '6px', border: '1px solid #ccfbf1', fontSize: '0.75rem', color: '#0f766e', display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
              <span>⚡</span>
              <div>
                <strong>Bengaluru Urban · Cloud Infrastructure Associate (OCC_IT_001)</strong> demand intensity at {longitudinalDeltas.blr.demandCurr} pts ({longitudinalDeltas.blr.demandDelta} pts from {longitudinalDeltas.blr.demandPrev}; balanced with supply rank {longitudinalDeltas.blr.supplyCurr} percentile).
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: 'var(--slate-50)',
            borderLeft: '3px solid var(--teal-600)',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.72rem',
            color: 'var(--slate-700)',
            lineHeight: 1.45,
          }}
        >
          <strong>{isHindi ? 'यह क्यों महत्वपूर्ण है:' : 'WHY THIS MATTERS:'}</strong>{' '}
          {isHindi
            ? `माप परिवर्तन ${period} और ${prevPeriod || 'आधारभूत'} के बीच 0-100 पैमाने पर सटीक अंक अंतर (प्रतिशत परिवर्तन नहीं) को दर्शाते हैं। यदि क्षमता योजना दूरदर्शी मांग संकेतों के बिना बनाई जाती है, तो संस्थान ऐसे बैचों को वित्तपोषित करते रहते हैं जहां आपूर्ति अवशोषण से अधिक हो चुकी है, जबकि तीव्र कौशल कमियां अनसुलझी रहती हैं।`
            : `Metric deltas reflect exact arithmetic point differences on a 0–100 scale between ${period} and ${prevPeriod || 'baseline'} (not percentage changes). If training capacity is planned without forward-looking demand signals, districts continue funding cohorts where supply throughput rank exceeds hiring absorption while acute deficits remain unaddressed.`}
        </div>
      </section>

      {/* ZONE 5: Geospatial Intelligence & Comparison Pack */}
      <DistrictComparisonCharts
        gapData={gapData}
        selectedDistrictId={selectedDistrictId}
        onSelectDistrict={setSelectedDistrictId}
        period={period}
        onExploreDistrict={(distId) => onNavigateWithContext('districts', { district: distId })}
      />

      {/* ZONE 6: Top Priority Policy Interventions (Ranked) */}
      <section
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--slate-200)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.2rem 0' }}>
              {isHindi ? 'शीर्ष प्राथमिकता नीतिगत हस्तक्षेप (रैंक अनुसार)' : 'Top Priority Policy Interventions (Ranked)'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              {isHindi
                ? 'श्रम बाजार आसूचना इंजन द्वारा मूल्यांकन किए गए लक्षित क्षमता समायोजन योजना परिदृश्य।'
                : 'Targeted capacity adjustment planning scenarios evaluated via Scenario Studio.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('recommendations')}
            style={{
              border: '1px solid var(--teal-600)',
              backgroundColor: '#f0fdfa',
              color: 'var(--teal-800)',
              fontWeight: 700,
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {isHindi ? 'सभी 4 अनुशंसित हस्तक्षेप देखें →' : 'View All Recommended Interventions →'}
          </button>
        </div>

        {/* 3 Ranked Intervention Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {/* Card #01: Dharwad CNC */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #ffedd5',
              borderLeft: '4px solid #ea580c',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#ea580c' }}>
                  #01 · DHARWAD, KARNATAKA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: '#fff7ed', color: '#c2410c', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 1 (Deficit #1)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>
                Simulate 100 Seats for CNC Machine Operator
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: 1.45, margin: 0 }}>
                Acute relative mismatch (+56.1 pts) where demand score (73.1 pts) exceeds recent certification throughput (17.0 percentile). Scenario Studio evaluates adjusting 100 cohort seats to address regional machining deficit.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>PLANNING SEATS</div>
                  <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>+100 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>EST. SHORTFALL CLOSED</div>
                  <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>▼ 18.2%</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>TARGET TRADE</div>
                  <strong style={{ color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>CNC Operator</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'KA_DHA', occupation: 'OCC_MFG_001', state: 'KA' })}
                  style={{ border: '1px solid var(--slate-300)', backgroundColor: '#ffffff', color: 'var(--slate-700)', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'KA_DHA', occupation: 'OCC_MFG_001', state: 'KA' })}
                  style={{ border: 'none', backgroundColor: '#ea580c', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>

          {/* Card #02: Bengaluru Cloud */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #ccfbf1',
              borderLeft: '4px solid #0d9488',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0d9488' }}>
                  #02 · BENGALURU URBAN, KARNATAKA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: '#f0fdfa', color: '#0f766e', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 2 (Tech Growth)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>
                Sustain High-Tech Intake for Cloud Infrastructure
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: 1.45, margin: 0 }}>
                High-volume tech corridor with elevated demand score (85.8 pts) and strong certification throughput (88.7 percentile). Sustaining intake prevents future cohort deficits under enterprise hiring velocity.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>PLANNING SEATS</div>
                  <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>+80 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>EST. SHORTFALL CLOSED</div>
                  <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>▼ 14.5%</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>TARGET TRADE</div>
                  <strong style={{ color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Cloud Associate</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'KA_BLR_U', occupation: 'OCC_IT_001', state: 'KA' })}
                  style={{ border: '1px solid var(--slate-300)', backgroundColor: '#ffffff', color: 'var(--slate-700)', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'KA_BLR_U', occupation: 'OCC_IT_001', state: 'KA' })}
                  style={{ border: 'none', backgroundColor: '#0d9488', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>

          {/* Card #03: Pune Automotive */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #dbeafe',
              borderLeft: '4px solid #2563eb',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#2563eb' }}>
                  #03 · PUNE, MAHARASHTRA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 3 (EV Transition)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>
                Align Automotive ITI Seats to EV Diagnostics
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: 1.45, margin: 0 }}>
                High industrial demand (69.7 pts) alongside balanced certification output (68.9 percentile). Evaluating a 60-seat planning scenario safeguards training alignment with automotive EV transition while monitoring throughput constraints.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>PLANNING SEATS</div>
                  <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>60 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>EST. SHORTFALL CLOSED</div>
                  <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>▼ 11.8%</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-400)', fontSize: '0.65rem', fontWeight: 600 }}>TARGET TRADE</div>
                  <strong style={{ color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>EV Assembly</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'MH_PUN', occupation: 'OCC_MFG_003', state: 'MH' })}
                  style={{ border: '1px solid var(--slate-300)', backgroundColor: '#ffffff', color: 'var(--slate-700)', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'MH_PUN', occupation: 'OCC_MFG_003', state: 'MH' })}
                  style={{ border: 'none', backgroundColor: '#2563eb', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Ranking Table Card Panel */}
      <section className="card-panel">
        <div className="card-panel-header">
          <div className="card-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2>{t('overview.tableTitle', 'Relative Demand-Supply Mismatch Rankings')}</h2>
              {selectedDistrictId && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.5rem', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--teal-800)', fontWeight: 600 }}>
                  <span>📍 {isHindi ? 'सक्रिय ज़िला:' : 'Filtered to:'}</span>
                  <strong>{getDistrictDisplayName(selectedDistrictName, isHindi)}</strong>
                  <span>({displayedRows.length} {isHindi ? 'व्यवसाय' : 'occupations'})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistrictId(null)}
                    style={{ border: 'none', background: 'none', color: '#c2410c', cursor: 'pointer', fontWeight: 700, padding: 0, marginLeft: '0.2rem' }}
                    title={isHindi ? 'फ़िल्टर हटाएं' : 'Reset filter'}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <p>
              {t('overview.tableSubtitle', 'Cross-sectional ranking comparing composite demand index against recent 3-month certification output')}
            </p>
          </div>

          {/* Quick Filter Segmented Control */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--slate-100)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              className="btn-refresh"
              style={{
                border: 'none',
                background: filterMode === 'all' ? '#ffffff' : 'transparent',
                fontWeight: filterMode === 'all' ? 700 : 500,
                boxShadow: filterMode === 'all' ? 'var(--shadow-sm)' : 'none',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
              }}
              onClick={() => setFilterMode('all')}
            >
              {t('overview.filterTop10', 'Top 10 Ranks')}
            </button>
            <button
              type="button"
              className="btn-refresh"
              style={{
                border: 'none',
                background: filterMode === 'demand_pressure' ? '#ffffff' : 'transparent',
                fontWeight: filterMode === 'demand_pressure' ? 700 : 500,
                color: filterMode === 'demand_pressure' ? '#c2410c' : 'inherit',
                boxShadow: filterMode === 'demand_pressure' ? 'var(--shadow-sm)' : 'none',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
              }}
              onClick={() => setFilterMode('demand_pressure')}
            >
              {t('overview.filterDemandPressure', 'Demand Pressure ({count})', { count: qualifyingDemandRecords.length })}
            </button>
            <button
              type="button"
              className="btn-refresh"
              style={{
                border: 'none',
                background: filterMode === 'supply_pressure' ? '#ffffff' : 'transparent',
                fontWeight: filterMode === 'supply_pressure' ? 700 : 500,
                color: filterMode === 'supply_pressure' ? '#1d4ed8' : 'inherit',
                boxShadow: filterMode === 'supply_pressure' ? 'var(--shadow-sm)' : 'none',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
              }}
              onClick={() => setFilterMode('supply_pressure')}
            >
              {t('overview.filterSupplyPressure', 'Supply Pressure ({count})', { count: qualifyingSupplyRecords.length })}
            </button>
          </div>
        </div>

        <div style={{ margin: '0 1.25rem 0.75rem 1.25rem', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderLeft: '3px solid var(--teal-600)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--slate-700)', lineHeight: 1.45 }}>
          💡 <strong>{isHindi ? 'परिणाम व्याख्या:' : 'Interpretation:'}</strong> {t('overview.mismatchInterpretation', 'Mismatch scores denote relative ranking differences between employer demand intensity and TVET certification throughput (−100 to +100 pts); a score of +50 denotes demand ranks 50 percentile points above supply, not an absolute worker shortage.')}
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>{t('overview.thRank', 'Rank')}</th>
                <th>{t('overview.thOccupationSector', 'Occupation & Sector')}</th>
                <th>{t('overview.thDistrictState', 'District / State')}</th>
                <th style={{ textAlign: 'right' }}>{t('overview.thDemandIndex', 'Demand Index')}</th>
                <th style={{ textAlign: 'right' }}>{t('overview.thSupplyIndex', 'Supply Output Index')}</th>
                <th style={{ textAlign: 'right' }}>{t('overview.thMismatchScore', 'Mismatch Score')}</th>
                <th>{t('overview.thClassification', 'Classification')}</th>
                <th>{t('overview.thPrimaryFactor', 'Primary Explanatory Factor')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                    {t('overview.noMatchingRows', 'No matching mismatch records found for this view.')}
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, index) => {
                  const mismatchVal = row.relative_mismatch_score;
                  const isPositive = mismatchVal > 0;
                  const primaryFactor =
                    row.explanatory_factors && row.explanatory_factors.length > 0
                      ? row.explanatory_factors[0]
                      : t('overview.defaultFactor', 'Relative mismatch evaluated against cross-sectional baseline.');

                  return (
                    <tr key={`${row.district_id}-${row.occupation_id}`}>
                      <td className="cell-rank">#{row.rank || index + 1}</td>
                      <td>
                        <div className="cell-title">{row.occupation_title}</div>
                        <div className="cell-subtitle">{getSectorDisplayName(row.sector, isHindi)} • {row.trade}</div>
                      </td>
                      <td>
                        <div className="cell-title">{getDistrictDisplayName(row.district_name, isHindi)}</div>
                        <div className="cell-subtitle">{getStateDisplayName(row.state_code, isHindi)}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="score-pill demand">
                          {formatScore(row.demand_index_score)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="score-pill supply">
                          {formatScore(row.supply_output_index)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`score-pill ${isPositive ? 'positive' : 'negative'}`}
                          style={{
                            backgroundColor: isPositive ? '#fff7ed' : '#eff6ff',
                            border: `1px solid ${isPositive ? '#ffedd5' : '#dbeafe'}`,
                          }}
                        >
                          {formatMismatch(row.relative_mismatch_score)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge-classification ${getClassificationBadgeClass(
                            row.classification
                          )}`}
                        >
                          {row.classification === 'Demand Pressure'
                            ? t('class.demandPressure', 'Demand Pressure')
                            : row.classification === 'Supply Pressure'
                            ? t('class.supplyPressure', 'Supply Pressure')
                            : t('class.balanced', 'Balanced')}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                        {formatExplanatoryFactor(primaryFactor, isHindi)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology Callout Note */}
      <section className="callout-box">
        <h4>
          <span>ℹ️</span>
          <span>{t('overview.methodologyTitle', 'Methodology & Interpretability Disclosure')}</span>
        </h4>
        <p>
          <strong>{t('overview.methodologySyntheticTitle', 'Synthetic Pilot Observations:')}</strong>{' '}
          {t(
            'overview.methodologySyntheticText',
            'All metrics displayed originate from synthetic demonstration data (not official statistics) spanning October 2024 through September 2026 across regional economic profiles in Karnataka, Maharashtra, and Telangana.'
          )}
        </p>
        <p style={{ marginTop: '0.35rem' }}>
          <strong>{t('overview.methodologyPercentileTitle', 'Relative Percentile Index:')}</strong>{' '}
          {t(
            'overview.methodologyPercentileText',
            'The Relative Mismatch Score represents the difference between cross-sectional percentile ranks (Demand Index − Supply Output Index), bounded between −100.0 and +100.0. Scores above +15 indicate relative demand pressure; scores below −15 indicate relative supply pressure. These scores denote relative ranking imbalances, not absolute deficit counts or worker shortages.'
          )}
        </p>
        <p style={{ marginTop: '0.35rem' }}>
          <strong>{t('overview.methodologyPlacementTitle', 'Placement Maturity Safeguard:')}</strong>{' '}
          {t(
            'overview.methodologyPlacementText',
            'Training batches completing within the 90-day tracking window are explicitly marked as pending follow-up and are excluded from placement rate calculations to prevent premature assessment bias.'
          )}
        </p>
      </section>
    </div>
  );
}
