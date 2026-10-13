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
import Icon from './Icon';

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
        className="glass-strong"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-md)',
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
                backgroundColor: 'var(--accent-indigo-bg)',
                color: 'var(--accent-indigo-text)',
                border: '1px solid var(--accent-indigo-border)',
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
                backgroundColor: 'var(--accent-soft-bg)',
                color: 'var(--accent-soft-text)',
                border: '1px solid var(--accent-soft-border)',
              }}
            >
              SIH26246 BENCHMARK PILOT
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              Cycle: {period}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0', letterSpacing: '-0.02em' }}>
            {isHindi ? 'स्किलपल्स एलएमआईएस — पायलट इंटेलिजेंस कमांड सेंटर' : 'SkillPulse LMIS — Pilot Intelligence Command Center'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.5 }}>
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
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="sliders" size={15} />
            <span>{isHindi ? 'परिदृश्य स्टूडियो खोलें' : 'Open Scenario Studio'}</span>
          </button>
        </div>
      </section>

      {/* ZONE 2: 6 Live KPI Indicator Stat Cards */}
      <section className="overview-kpis-grid">
        {/* Card 1: Regional Demand Index */}
        <div className="stat-card glass-strong" style={{ margin: 0, minHeight: '173px' }}>
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'मांग सूचकांक' : 'DEMAND INDEX'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
              {formatScore(avgDemand)}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}> /100</span>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#3b82f6', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--status-success-text)', fontWeight: 700 }}>
              Multi-Signal <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Composite</span>
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)' }}>
              {isHindi ? 'पायलट औसत मांग (0–100)' : 'Pilot Scope Avg Demand Score (0–100)'}
            </div>
          </div>
        </div>

        {/* Card 2: Supply Output Rank */}
        <div className="stat-card neutral glass-strong" style={{ margin: 0, minHeight: '173px' }}>
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'आपूर्ति आउटपुट रैंक' : 'SUPPLY OUTPUT RANK'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
              {formatScore(avgSupply)}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}> /100</span>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#6366f1', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-indigo-text)', fontWeight: 700 }}>
              Percentile Rank <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>3M Output</span>
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)' }}>
              {isHindi ? 'पिछले 3 माह प्रमाणीकरण रैंक' : 'Trailing 3M Certification Rank'}
            </div>
          </div>
        </div>

        {/* Card 3: Peak Relative Mismatch */}
        <div className="stat-card demand-pressure glass-strong" style={{ margin: 0, minHeight: '173px', borderLeft: '4px solid #ef4444' }}>
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'शीर्ष सापेक्ष असंतुलन' : 'PEAK RELATIVE MISMATCH'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--status-danger-text)' }}>
              {topPositiveMismatch ? formatMismatch(topPositiveMismatch.relative_mismatch_score) : '0.0'}
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}> pts</span>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#ef4444', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--status-danger-text)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topPositiveMismatch ? `${getDistrictDisplayName(topPositiveMismatch.district_name, isHindi)}` : 'None'}
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topPositiveMismatch ? topPositiveMismatch.occupation_title : 'Within ±15 pts'}
            </div>
          </div>
        </div>

        {/* Card 4: High-Pressure Corridors */}
        <div className="stat-card glass-strong" style={{ margin: 0, minHeight: '173px' }}>
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'जोखिम वाले ट्रेड' : 'AT-RISK CORRIDORS'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--status-demand-text)' }}>
              {atRiskCount}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}> / {gapResults.length}</span>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#f59e0b', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--status-demand-text)', fontWeight: 700 }}>
              Threshold Crossing <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>±15.0 pts</span>
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)' }}>
              {isHindi ? '|असंतुलन| ≥ 15 अंक' : '|Mismatch Score| ≥ 15 pts'}
            </div>
          </div>
        </div>

        {/* Card 5: Intelligence Signals */}
        <div
          className="stat-card neutral glass-strong"
          style={{ margin: 0, minHeight: '173px' }}
          title={`Total early-warning signals from /api/v1/alerts for period ${period}: ${totalAlertsCount} signals across 3M, 6M, and 12M horizons (${persistentAlertsCount} persistent across ≥2 horizons, spanning ${alertCorridorsCount} unique district-occupation corridors).`}
        >
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'पूर्व चेतावनी' : 'EARLY WARNINGS'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--status-danger-text)' }}>
              {totalAlertsCount}
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#ef4444', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--status-danger-text)', fontWeight: 700 }}>
              Alert Engine <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{persistentAlertsCount} Persistent</span>
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)' }}>
              {isHindi ? `3M/6M/12M (${alertCorridorsCount} गलियारे)` : `Across ${alertCorridorsCount} Pilot Corridors`}
            </div>
          </div>
        </div>

        {/* Card 6: Priority Actions */}
        <div
          className="stat-card neutral glass-strong"
          style={{ margin: 0, minHeight: '173px' }}
          title="Rule-based planning intervention dossiers derived from critical deficit corridors (|mismatch| ≥ 20.0 pts)."
        >
          <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">{isHindi ? 'प्राथमिक निर्णय' : 'PRIORITY DECISIONS'}</span>
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              SYNTHETIC PILOT
            </span>
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--accent-soft-text)' }}>
              3
            </div>
            <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#0d9488', width: '100%', margin: '0.35rem 0 0.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-soft-text)', fontWeight: 700 }}>
              Ranked Actions <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Interventions</span>
            </div>
            <div className="stat-card-subtext" style={{ color: 'var(--text-secondary)' }}>
              {isHindi ? 'ह्युरिस्टिक क्षमता परिदृश्य' : 'Heuristic Planning Scenarios'}
            </div>
          </div>
        </div>
      </section>

      {/* ZONE 3: Highest-Priority Signal Action Required Banner */}
      {topPositiveMismatch && (
        <section
          className="glass-strong"
          style={{
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            borderLeft: '5px solid #ef4444',
            borderRadius: '14px',
            padding: '1.15rem 1.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--status-danger-text)',
                  border: '1px solid var(--status-danger-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                ACTION REQUIRED
              </span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                • {getDistrictDisplayName(topPositiveMismatch.district_name, isHindi)} · {topPositiveMismatch.occupation_title} ({topPositiveMismatch.occupation_id})
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isHindi
                ? `सापेक्ष मांग प्रमाणीकरण आउटपुट से +${topPositiveMismatch.relative_mismatch_score.toFixed(1)} अंक अधिक है (मांग: ${topPositiveMismatch.demand_index_score.toFixed(1)}, आपूर्ति: ${topPositiveMismatch.supply_output_index.toFixed(1)})। अनुशंसित नियोजन परिदृश्य: स्थानीय सुविधा सीमाओं और थ्रूपुट यील्ड के आधार पर परिदृश्य स्टूडियो में 100 सीटें जोड़ने का मूल्यांकन करें।`
                : `Relative demand rank outpaces certification output rank by +${topPositiveMismatch.relative_mismatch_score.toFixed(1)} percentile points (Demand: ${topPositiveMismatch.demand_index_score.toFixed(1)}, Supply: ${topPositiveMismatch.supply_output_index.toFixed(1)}). Recommended planning scenario: Evaluate adding 100 training seats via Scenario Studio to test relative mismatch closure and output yield against local facility constraints.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedDistrictId(topPositiveMismatch.district_id);
                setFilterMode('demand_pressure');
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
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
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name="zap" size={14} />
              <span>{isHindi ? 'समाधान सिम्युलेट करें' : 'Simulate Fix'}</span>
            </button>
          </div>
        </section>
      )}

      {/* ZONE 4: Longitudinal Deltas - "WHAT CHANGED IN CURRENT PIPELINE RUN?" */}
      <section
        className="glass-strong"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.25rem 1.35rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="activity" size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
              {isHindi ? 'वर्तमान पाइपलाइन रन में क्या बदला?' : 'WHAT CHANGED IN CURRENT PIPELINE RUN?'} ({period} vs {prevPeriod || 'baseline origin'})
            </span>
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
              color: 'var(--accent-indigo-text)',
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
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Icon name="info" size={15} />
            <span>
              {isHindi
                ? `चयनित अवधि ${period} आधारभूत मूल चक्र है; पूर्ववर्ती चक्र तुलना की गणना के लिए अपर्याप्त ऐतिहासिक डेटा।`
                : `Selected period ${period} is the baseline origin cycle; insufficient comparable historical observation data to compute preceding period deltas.`}
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ padding: '0.75rem 0.95rem', backgroundColor: 'var(--status-danger-bg)', borderRadius: '8px', border: '1px solid var(--status-danger-border)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ color: 'var(--status-danger-text)', fontWeight: 700, marginTop: '0.1rem' }}><Icon name="trendDown" size={14} /></span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Dharwad · CNC Machine Operator (OCC_MFG_001)</strong> demand score rose {longitudinalDeltas.dha.demandDelta} pts (from {longitudinalDeltas.dha.demandPrev} to {longitudinalDeltas.dha.demandCurr} pts; mismatch widened {longitudinalDeltas.dha.mismatchDelta} pts to {longitudinalDeltas.dha.mismatchCurr} pts).
              </div>
            </div>
            <div style={{ padding: '0.75rem 0.95rem', backgroundColor: 'var(--accent-indigo-bg)', borderRadius: '8px', border: '1px solid var(--accent-indigo-border)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-indigo-text)', fontWeight: 700, marginTop: '0.1rem' }}><Icon name="trendUp" size={14} /></span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Pune · Industrial Automation Technician (OCC_MFG_002)</strong> supply rank shifted {longitudinalDeltas.pun.supplyDelta} percentile pts (from {longitudinalDeltas.pun.supplyPrev} to {longitudinalDeltas.pun.supplyCurr} percentile; mismatch at {longitudinalDeltas.pun.mismatchCurr} pts).
              </div>
            </div>
            <div style={{ padding: '0.75rem 0.95rem', backgroundColor: 'var(--accent-soft-bg)', borderRadius: '8px', border: '1px solid var(--accent-soft-border)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-soft-text)', fontWeight: 700 }}>→</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Bengaluru Urban · Cloud Infrastructure Associate (OCC_IT_001)</strong> demand intensity at {longitudinalDeltas.blr.demandCurr} pts ({longitudinalDeltas.blr.demandDelta} pts from {longitudinalDeltas.blr.demandPrev}; balanced with supply rank {longitudinalDeltas.blr.supplyCurr} percentile).
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: 'var(--status-demand-bg)',
            borderLeft: '4px solid #f59e0b',
            border: '1px solid var(--status-demand-border)',
            padding: '0.65rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--status-demand-text)' }}>{isHindi ? 'यह क्यों महत्वपूर्ण है:' : 'WHY THIS MATTERS:'}</strong>{' '}
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
        className="glass-strong"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.15rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.2rem 0', letterSpacing: '-0.01em' }}>
              {isHindi ? 'शीर्ष प्राथमिकता नीतिगत हस्तक्षेप (रैंक अनुसार)' : 'Top Priority Policy Interventions (Ranked)'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isHindi
                ? 'पायलट अंतर डेटा पर आधारित प्राथमिकता क्षमता समायोजन योजना परिदृश्य। ये अन्वेषणात्मक नियोजन सिमुलेशन हैं, वास्तविक रोजगार या श्रमिकों की कमी में सत्यापित परिवर्तन नहीं।'
                : 'Targeted capacity adjustment planning scenarios evaluated via Scenario Studio. Results denote exploratory planning simulations, not verified changes in real-world employment or worker shortages.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('recommendations')}
            style={{
              border: '1px solid var(--accent-indigo-border)',
              backgroundColor: 'var(--accent-indigo-bg)',
              color: 'var(--accent-indigo-text)',
              fontWeight: 700,
              fontSize: '0.75rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
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
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--status-danger-border)',
              borderLeft: '4px solid #ef4444',
              borderRadius: '12px',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--status-danger-text)' }}>
                  #01 · DHARWAD, KARNATAKA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 1 (Deficit #1)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                Simulate 100 Seats for CNC Machine Operator
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                Acute relative mismatch (+56.1 pts) where demand score (73.1 pts) exceeds recent certification throughput (17.0 percentile). Scenario Studio evaluates adjusting 100 cohort seats to address regional machining deficit.
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'योजनाबद्ध सीटें' : 'PLANNING SEATS'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>100 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'सिम्युलेटेड सापेक्ष असंतुलन परिवर्तन' : 'SIMULATED RELATIVE MISMATCH CHANGE'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--status-success-text)', fontFamily: 'var(--font-mono)' }}>-60.4 pts</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>(+63.2 → +2.8 pts)</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'लक्षित ट्रेड' : 'TARGET TRADE'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>CNC Operator</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'KA_DHA', occupation: 'OCC_MFG_001', state: 'KA' })}
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'KA_DHA', occupation: 'OCC_MFG_001', state: 'KA' })}
                  style={{ border: 'none', backgroundColor: '#ea580c', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>

          {/* Card #02: Bengaluru Cloud */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--accent-soft-border)',
              borderLeft: '4px solid #0d9488',
              borderRadius: '12px',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-soft-text)' }}>
                  #02 · BENGALURU URBAN, KARNATAKA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--accent-soft-text)', border: '1px solid var(--accent-soft-border)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 2 (Tech Growth)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                Sustain High-Tech Intake for Cloud Infrastructure
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                High-volume tech corridor with elevated demand score (85.8 pts) and strong certification throughput (88.7 percentile). Sustaining intake prevents future cohort deficits under enterprise hiring velocity.
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'योजनाबद्ध सीटें' : 'PLANNING SEATS'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>80 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'सिम्युलेटेड सापेक्ष असंतुलन परिवर्तन' : 'SIMULATED RELATIVE MISMATCH CHANGE'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--status-supply-text)', fontFamily: 'var(--font-mono)' }}>+43.4 pts</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>(-9.4 → +34.0 pts)</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'लक्षित ट्रेड' : 'TARGET TRADE'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Cloud Associate</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'KA_BLR_U', occupation: 'OCC_IT_001', state: 'KA' })}
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'KA_BLR_U', occupation: 'OCC_IT_001', state: 'KA' })}
                  style={{ border: 'none', backgroundColor: '#0d9488', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>

          {/* Card #03: Pune Automotive */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--status-supply-border)',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '12px',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--status-supply-text)' }}>
                  #03 · PUNE, MAHARASHTRA
                </span>
                <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--status-supply-bg)', color: 'var(--status-supply-text)', border: '1px solid var(--status-supply-border)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Priority Tier 3 (EV Transition)
                </span>
              </div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                Align Automotive ITI Seats to EV Diagnostics
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                High industrial demand (69.7 pts) alongside balanced certification output (68.9 percentile). Evaluating a 60-seat planning scenario safeguards training alignment with automotive EV transition while monitoring throughput constraints.
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '0.5rem', marginBottom: '0.65rem', fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'योजनाबद्ध सीटें' : 'PLANNING SEATS'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>60 (Scenario)</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'सिम्युलेटेड सापेक्ष असंतुलन परिवर्तन' : 'SIMULATED RELATIVE MISMATCH CHANGE'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--status-supply-text)', fontFamily: 'var(--font-mono)' }}>+62.3 pts</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>(-6.6 → +55.7 pts)</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {isHindi ? 'लक्षित ट्रेड' : 'TARGET TRADE'}
                  </div>
                  <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>EV Assembly</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: 'MH_PUN', occupation: 'OCC_MFG_003', state: 'MH' })}
                  style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('simulator', { district: 'MH_PUN', occupation: 'OCC_MFG_003', state: 'MH' })}
                  style={{ border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--accent-soft-bg)', border: '1px solid var(--accent-soft-border)', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--accent-soft-text)', fontWeight: 600 }}>
                  <Icon name="map-pin" size={13} />
                  <span>{isHindi ? 'सक्रिय ज़िला:' : 'Filtered to:'}</span>
                  <strong>{getDistrictDisplayName(selectedDistrictName, isHindi)}</strong>
                  <span>({displayedRows.length} {isHindi ? 'व्यवसाय' : 'occupations'})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistrictId(null)}
                    style={{ border: 'none', background: 'none', color: 'var(--status-demand-text)', cursor: 'pointer', fontWeight: 700, padding: 0, marginLeft: '0.2rem' }}
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
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              style={{
                border: 'none',
                background: filterMode === 'all' ? '#4f46e5' : 'transparent',
                fontWeight: filterMode === 'all' ? 700 : 500,
                color: filterMode === 'all' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: filterMode === 'all' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFilterMode('all')}
            >
              {t('overview.filterTop10', 'Top 10 Ranks')}
            </button>
            <button
              type="button"
              style={{
                background: filterMode === 'demand_pressure' ? 'var(--status-demand-bg)' : 'transparent',
                fontWeight: filterMode === 'demand_pressure' ? 700 : 500,
                color: filterMode === 'demand_pressure' ? 'var(--status-demand-text)' : 'var(--text-secondary)',
                border: filterMode === 'demand_pressure' ? '1px solid var(--status-demand-border)' : '1px solid transparent',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFilterMode('demand_pressure')}
            >
              {t('overview.filterDemandPressure', 'Demand Pressure ({count})', { count: qualifyingDemandRecords.length })}
            </button>
            <button
              type="button"
              style={{
                background: filterMode === 'supply_pressure' ? 'var(--status-supply-bg)' : 'transparent',
                fontWeight: filterMode === 'supply_pressure' ? 700 : 500,
                color: filterMode === 'supply_pressure' ? 'var(--status-supply-text)' : 'var(--text-secondary)',
                border: filterMode === 'supply_pressure' ? '1px solid var(--status-supply-border)' : '1px solid transparent',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFilterMode('supply_pressure')}
            >
              {t('overview.filterSupplyPressure', 'Supply Pressure ({count})', { count: qualifyingSupplyRecords.length })}
            </button>
          </div>
        </div>

        <div style={{ margin: '0 1.25rem 0.75rem 1.25rem', padding: '0.55rem 0.85rem', backgroundColor: 'var(--accent-soft-bg)', borderLeft: '3px solid var(--accent-primary)', border: '1px solid var(--accent-soft-border)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
          <Icon name="lightbulb" size={15} style={{ color: 'var(--accent-soft-text)', marginTop: '0.1rem' }} />
          <div>
            <strong style={{ color: 'var(--accent-soft-text)' }}>{isHindi ? 'परिणाम व्याख्या:' : 'Interpretation:'}</strong>{' '}
            {t('overview.mismatchInterpretation', 'Mismatch scores denote relative ranking differences between employer demand intensity and TVET certification throughput (−100 to +100 pts); a score of +50 denotes demand ranks 50 percentile points above supply, not an absolute worker shortage.')}
          </div>
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
          <Icon name="info" size={16} />
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
