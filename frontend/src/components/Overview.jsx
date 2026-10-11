import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
  formatExplanatoryFactor,
} from '../i18n/translations';

export default function Overview({
  demandData,
  gapData,
  backendHealth,
  period = '2026-09',
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'demand_pressure' | 'supply_pressure'

  const demandResults = demandData?.results || [];
  const gapResults = gapData?.results || [];

  // 1. Highest-ranked demand result (Rank 1 from demand-index)
  const topDemandItem = demandResults.length > 0
    ? demandResults.reduce((max, r) =>
        r.composite_score > max.composite_score ? r : max
      , demandResults[0])
    : null;

  // 2. Strongest positive mismatch result (Highest relative mismatch among records meeting Demand Pressure threshold >= +15)
  const qualifyingDemandRecords = gapResults.filter(
    (r) => r.classification === 'Demand Pressure' || r.relative_mismatch_score >= 15.0
  );
  const topPositiveMismatch = qualifyingDemandRecords.length > 0
    ? qualifyingDemandRecords.reduce((max, r) =>
        r.relative_mismatch_score > max.relative_mismatch_score ? r : max
      , qualifyingDemandRecords[0])
    : null;

  // 3. Strongest negative mismatch result (Most negative relative mismatch among records meeting Supply Pressure threshold <= -15)
  const qualifyingSupplyRecords = gapResults.filter(
    (r) => r.classification === 'Supply Pressure' || r.relative_mismatch_score <= -15.0
  );
  const topNegativeMismatch = qualifyingSupplyRecords.length > 0
    ? qualifyingSupplyRecords.reduce((min, r) =>
        r.relative_mismatch_score < min.relative_mismatch_score ? r : min
      , qualifyingSupplyRecords[0])
    : null;

  // Filtered table rows
  const getFilteredGapRows = () => {
    if (filterMode === 'demand_pressure') {
      return [...qualifyingDemandRecords].sort(
        (a, b) => b.relative_mismatch_score - a.relative_mismatch_score
      );
    }
    if (filterMode === 'supply_pressure') {
      return [...qualifyingSupplyRecords].sort(
        (a, b) => a.relative_mismatch_score - b.relative_mismatch_score
      );
    }
    return gapResults.slice(0, 10); // Show top 10 by default
  };

  const displayedRows = getFilteredGapRows();

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
    <div className="overview-grid">
      {/* Top Key Indicator Stat Cards */}
      <section className="stats-cards-row">
        {/* Card 1: Reporting Period & Scope */}
        <div className="stat-card neutral">
          <div className="stat-card-header">
            <span className="stat-card-title">{t('overview.cycleCardTitle', 'Reporting Cycle')}</span>
            <span className="stat-card-icon">📅</span>
          </div>
          <div className="stat-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
            {period}
          </div>
          <div className="stat-card-meta">
            {t('overview.monitoredPairs', '{count} District-Occupations Monitored', { count: gapResults.length })}
          </div>
          <div className="stat-card-subtext">
            API: {backendHealth?.status === 'healthy' ? t('overview.connectedLive', 'Connected (Live :8000) • 3 States • 6 Districts') : t('app.statusOffline', 'Offline')}
          </div>
        </div>

        {/* Card 2: Highest-Ranked Employer Demand */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">{t('overview.highestDemandTitle', 'Highest Demand Intensity')}</span>
            <span className="stat-card-icon">🔥</span>
          </div>
          {topDemandItem ? (
            <>
              <div className="stat-card-value">
                {topDemandItem.composite_score.toFixed(1)}
                <span style={{ fontSize: '0.9rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                  /100
                </span>
              </div>
              <div className="stat-card-meta">
                {topDemandItem.occupation_title}
              </div>
              <div className="stat-card-subtext">
                {getDistrictDisplayName(topDemandItem.district_name, isHindi)}, {getStateDisplayName(topDemandItem.state_code, isHindi)} • {getSectorDisplayName(topDemandItem.sector, isHindi)}
              </div>
            </>
          ) : (
            <>
              <div className="stat-card-value" style={{ fontSize: '1.15rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                {t('overview.noQualifying', 'No qualifying cases')}
              </div>
              <div className="stat-card-subtext">{t('overview.noDemandInCycle', 'No demand observations in this cycle')}</div>
            </>
          )}
        </div>

        {/* Card 3: Strongest Demand Pressure (Positive Mismatch) */}
        <div className="stat-card demand-pressure">
          <div className="stat-card-header">
            <span className="stat-card-title">{t('overview.strongestDemandPressureTitle', 'Strongest Demand Pressure')}</span>
            <span className="stat-card-icon">⚡</span>
          </div>
          {topPositiveMismatch ? (
            <>
              <div className="stat-card-value" style={{ color: '#c2410c' }}>
                {formatMismatch(topPositiveMismatch.relative_mismatch_score)}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}> {t('common.pts', 'pts')}</span>
              </div>
              <div className="stat-card-meta">
                {topPositiveMismatch.occupation_title}
              </div>
              <div className="stat-card-subtext">
                {t('overview.demandOutpacesThroughput', '{district}, {state} • Demand outpaces throughput ({count} cases ≥ +15)', {
                  district: getDistrictDisplayName(topPositiveMismatch.district_name, isHindi),
                  state: getStateDisplayName(topPositiveMismatch.state_code, isHindi),
                  count: qualifyingDemandRecords.length,
                })}
              </div>
            </>
          ) : (
            <>
              <div className="stat-card-value" style={{ fontSize: '1.15rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                {t('overview.noQualifying', 'No qualifying cases')}
              </div>
              <div className="stat-card-meta">
                {t('overview.demandThresholdNote', 'Threshold: Score ≥ +15.0')}
              </div>
              <div className="stat-card-subtext">
                {t('overview.noDemandPressure', 'No district-occupation exhibits demand pressure in this cycle')}
              </div>
            </>
          )}
        </div>

        {/* Card 4: Strongest Supply Pressure (Negative Mismatch) */}
        <div className="stat-card supply-pressure">
          <div className="stat-card-header">
            <span className="stat-card-title">{t('overview.strongestSupplyPressureTitle', 'Strongest Supply Pressure')}</span>
            <span className="stat-card-icon">📦</span>
          </div>
          {topNegativeMismatch ? (
            <>
              <div className="stat-card-value" style={{ color: '#1d4ed8' }}>
                {formatMismatch(topNegativeMismatch.relative_mismatch_score)}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}> {t('common.pts', 'pts')}</span>
              </div>
              <div className="stat-card-meta">
                {topNegativeMismatch.occupation_title}
              </div>
              <div className="stat-card-subtext">
                {t('overview.throughputOutpacesDemand', '{district}, {state} • Throughput outpaces demand ({count} cases ≤ −15)', {
                  district: getDistrictDisplayName(topNegativeMismatch.district_name, isHindi),
                  state: getStateDisplayName(topNegativeMismatch.state_code, isHindi),
                  count: qualifyingSupplyRecords.length,
                })}
              </div>
            </>
          ) : (
            <>
              <div className="stat-card-value" style={{ fontSize: '1.15rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                {t('overview.noQualifying', 'No qualifying cases')}
              </div>
              <div className="stat-card-meta">
                {t('overview.supplyThresholdNote', 'Threshold: Score ≤ −15.0')}
              </div>
              <div className="stat-card-subtext">
                {t('overview.noSupplyPressure', 'No district-occupation exhibits supply pressure in this cycle')}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Main Ranking Table Card Panel */}
      <section className="card-panel">
        <div className="card-panel-header">
          <div className="card-title-group">
            <h2>{t('overview.tableTitle', 'Relative Demand-Supply Mismatch Rankings')}</h2>
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
            'All metrics displayed originate from synthetic pilot datasets spanning October 2024 through September 2026, calibrated to regional economic profiles across Karnataka, Maharashtra, and Telangana.'
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
