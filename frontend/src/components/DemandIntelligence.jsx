import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import { fetchDemandIndex } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import {
  formatDemandDriver,
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
} from '../i18n/translations';

const STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'TS', name: 'Telangana' },
];

const DISTRICTS = [
  { id: 'KA_BLR_U', name: 'Bengaluru Urban', state: 'KA' },
  { id: 'KA_DHA', name: 'Dharwad', state: 'KA' },
  { id: 'MH_MUM', name: 'Mumbai Suburban', state: 'MH' },
  { id: 'MH_PUN', name: 'Pune', state: 'MH' },
  { id: 'TS_HYD', name: 'Hyderabad', state: 'TS' },
  { id: 'TS_MED', name: 'Medchal-Malkajgiri', state: 'TS' },
];

const SECTORS = ['IT/ITeS', 'Logistics', 'Manufacturing'];

export default function DemandIntelligence({
  period = '2026-09',
  onPeriodChange,
  stateFilter,
  districtFilter,
  sectorFilter,
  occupationFilter,
  onStateChange,
  onDistrictChange,
  onSectorChange,
  _onOccupationChange,
  onResetFilters,
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Filters
  const [selectedState, setSelectedState] = useState(stateFilter || '');
  const [selectedDistrict, setSelectedDistrict] = useState(districtFilter || '');
  const [selectedSector, setSelectedSector] = useState(sectorFilter || '');

  // Sync external filters when passed from parent ContextFilterBar
  useEffect(() => {
    if (stateFilter !== undefined) setSelectedState(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    if (districtFilter !== undefined) setSelectedDistrict(districtFilter);
  }, [districtFilter]);

  useEffect(() => {
    if (sectorFilter !== undefined) setSelectedSector(sectorFilter);
  }, [sectorFilter]);

  // Selected row for Component Breakdown Drawer
  const [selectedRowId, setSelectedRowId] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('composite_score');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const executeDemandFetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchDemandIndex({
        period,
        state_code: selectedState || undefined,
        district_id: selectedDistrict || undefined,
        sector: selectedSector || undefined,
        limit: 100,
      });
      setData(res);
      if (res?.results?.length > 0) {
        setSelectedRowId(`${res.results[0].district_id}-${res.results[0].occupation_id}`);
      } else {
        setSelectedRowId(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to load Demand Index analytics from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedState, selectedDistrict, selectedSector]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const res = await fetchDemandIndex({
          period,
          state_code: selectedState || undefined,
          district_id: selectedDistrict || undefined,
          sector: selectedSector || undefined,
          limit: 100,
        });
        if (ignore) return;
        setData(res);
        if (res?.results?.length > 0) {
          setSelectedRowId(`${res.results[0].district_id}-${res.results[0].occupation_id}`);
        } else {
          setSelectedRowId(null);
        }
        setErrorMessage(null);
      } catch (err) {
        if (ignore) return;
        setErrorMessage(err.message || 'Unable to load Demand Index analytics from backend.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [period, selectedState, selectedDistrict, selectedSector]);

  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    onStateChange?.(newState);
    // Reset district if it doesn't belong to newly selected state
    if (newState && selectedDistrict) {
      const match = DISTRICTS.find((d) => d.id === selectedDistrict && d.state === newState);
      if (!match) {
        setSelectedDistrict('');
        onDistrictChange?.('');
      }
    }
  };

  const resetFilters = () => {
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedSector('');
    onResetFilters?.();
  };

  const filteredDistricts = useMemo(() => {
    if (!selectedState) return DISTRICTS;
    return DISTRICTS.filter((d) => d.state === selectedState);
  }, [selectedState]);

  // Client-side sorting and occupation filtering
  const sortedResults = useMemo(() => {
    if (!data?.results) return [];
    let list = [...data.results];
    if (occupationFilter) {
      list = list.filter((r) => r.occupation_id === occupationFilter);
    }
    return list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, occupationFilter, sortField, sortDirection]);

  // Keep selected row synchronized with filtered results
  useEffect(() => {
    if (sortedResults.length > 0) {
      const exists = sortedResults.some((r) => `${r.district_id}-${r.occupation_id}` === selectedRowId);
      if (!exists) {
        setSelectedRowId(`${sortedResults[0].district_id}-${sortedResults[0].occupation_id}`);
      }
    } else {
      setSelectedRowId(null);
    }
  }, [sortedResults, selectedRowId]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Selected item object for breakdown
  const selectedItem = useMemo(() => {
    if (!selectedRowId || sortedResults.length === 0) return null;
    return sortedResults.find((r) => `${r.district_id}-${r.occupation_id}` === selectedRowId) || null;
  }, [sortedResults, selectedRowId]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const list = sortedResults;
    if (list.length === 0) {
      return { total: 0, highestScore: null, highestItem: null, avgScore: 0 };
    }
    const maxItem = list.reduce((max, cur) => (cur.composite_score > max.composite_score ? cur : max), list[0]);
    const avg = list.reduce((sum, cur) => sum + cur.composite_score, 0) / list.length;
    return {
      total: list.length,
      highestScore: maxItem.composite_score,
      highestItem: maxItem,
      avgScore: avg,
    };
  }, [sortedResults]);

  const formatGrowth = (rawVal) => {
    if (rawVal === null || rawVal === undefined) return 'N/A';
    const pct = rawVal * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}% (raw: ${rawVal.toFixed(4)})`;
  };

  return (
    <div className="overview-grid">
      {/* Page Intro Header Banner */}
      <div className="page-intro-header">
        <h1 className="page-intro-title">{t('demand.introTitle', 'SkillPulse Demand Intelligence Engine')}</h1>
        <p className="page-intro-desc">
          {t(
            'demand.introDesc',
            'Evaluates multi-source employer hiring intent across 5 explainable components into a cross-sectional percentile composite score (0 to 100). Combines job posting volumes, trailing 3-month growth velocity, vacancy persistence, recruitment employer diversity, and wage attractiveness.'
          )}
        </p>
      </div>

      {/* Filter Control Bar */}
      <section className="filter-bar-panel">
        <div className="filter-group">
          <label htmlFor="demand-period" className="filter-label">{t('common.reportingPeriod', 'Reporting Period')}</label>
          <select
            id="demand-period"
            className="filter-select"
            value={period}
            onChange={(e) => onPeriodChange && onPeriodChange(e.target.value)}
          >
            <option value="2026-09">2026-09 ({t('common.activePilot', 'Active Pilot')})</option>
            <option value="2026-08">2026-08</option>
            <option value="2026-07">2026-07</option>
            <option value="2026-06">2026-06</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="demand-state" className="filter-label">{t('common.state', 'State')}</label>
          <select
            id="demand-state"
            className="filter-select"
            value={selectedState}
            onChange={handleStateChange}
          >
            <option value="">{t('common.allStates', 'All States (3)')}</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>{getStateDisplayName(s.code, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="demand-district" className="filter-label">{t('common.district', 'District')}</label>
          <select
            id="demand-district"
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              onDistrictChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allDistricts', 'All Districts')} ({filteredDistricts.length})</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>{getDistrictDisplayName(d.name, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="demand-sector" className="filter-label">{t('common.sector', 'Sector')}</label>
          <select
            id="demand-sector"
            className="filter-select"
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              onSectorChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
            {SECTORS.map((sec) => (
              <option key={sec} value={sec}>{getSectorDisplayName(sec, isHindi)}</option>
            ))}
          </select>
        </div>

        {(selectedState || selectedDistrict || selectedSector) && (
          <button type="button" className="btn-reset-filters" onClick={resetFilters}>
            <span>✕</span> {t('common.resetFilters', 'Reset Filters')}
          </button>
        )}
      </section>

      {/* Loading / Error States */}
      {errorMessage ? (
        <ErrorAlert message={errorMessage} onRetry={executeDemandFetch} />
      ) : isLoading ? (
        <LoadingSpinner message={t('app.loading', 'Querying SkillPulse Demand Index engine for matching records...')} />
      ) : (
        <>
          {/* Summary Metric Cards */}
          <section className="stats-cards-row">
            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('demand.matchingPairsTitle', 'Matching Pairs')}</span>
                <span className="stat-card-icon">📋</span>
              </div>
              <div className="stat-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {summaryMetrics.total}
              </div>
              <div className="stat-card-meta">
                {t('demand.pairsEvaluated', 'District-Occupation Pairs Evaluated')}
              </div>
              <div className="stat-card-subtext">
                {t('demand.periodBaseline', 'Period: {period} • Cross-sectional baseline', { period })}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('overview.highestDemandTitle', 'Highest Demand Intensity')}</span>
                <span className="stat-card-icon">🔥</span>
              </div>
              {summaryMetrics.highestItem ? (
                <>
                  <div className="stat-card-value">
                    {summaryMetrics.highestScore.toFixed(1)}
                    <span style={{ fontSize: '0.9rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                      /100
                    </span>
                  </div>
                  <div className="stat-card-meta">
                    {summaryMetrics.highestItem.occupation_title}
                  </div>
                  <div className="stat-card-subtext">
                    {getDistrictDisplayName(summaryMetrics.highestItem.district_name, isHindi)}, {getStateDisplayName(summaryMetrics.highestItem.state_code, isHindi)}
                  </div>
                </>
              ) : (
                <div className="stat-card-subtext">{t('overview.noQualifying', 'No records meet filter criteria')}</div>
              )}
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('demand.avgDemandScoreTitle', 'Average Demand Score')}</span>
                <span className="stat-card-icon">📊</span>
              </div>
              <div className="stat-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {summaryMetrics.total > 0 ? summaryMetrics.avgScore.toFixed(1) : t('common.na', 'N/A')}
                <span style={{ fontSize: '0.9rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                  /100
                </span>
              </div>
              <div className="stat-card-meta">
                {t('demand.cohortMeanScore', 'Filtered Cohort Mean Score')}
              </div>
              <div className="stat-card-subtext">
                {t('demand.normalizedRankDist', 'Normalized mid-point rank distribution')}
              </div>
            </div>
          </section>

          {/* Ranking Table */}
          <section className="card-panel">
            <div className="card-panel-header">
              <div className="card-title-group">
                <h2>{t('demand.tableTitle', 'Composite Demand Index Rankings')}</h2>
                <p>{t('demand.tableSubtitle', 'Click any row to inspect component breakdown, raw signal metrics, and driver weights.')}</p>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {t('common.showingRecords', 'Showing {count} records', { count: sortedResults.length })}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="th-sortable" style={{ width: '60px' }} onClick={() => handleSort('rank')}>
                      {t('demand.thRank', 'Rank')} {sortField === 'rank' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('occupation_title')}>
                      {t('demand.thOccupationTrade', 'Occupation & Trade')} {sortField === 'occupation_title' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('sector')}>
                      {t('demand.thSector', 'Sector')} {sortField === 'sector' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('district_name')}>
                      {t('demand.thDistrictState', 'District / State')} {sortField === 'district_name' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('composite_score')}>
                      {t('demand.thDemandScore', 'Demand Score')} {sortField === 'composite_score' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" style={{ textAlign: 'center' }} onClick={() => handleSort('data_coverage_pct')}>
                      {t('demand.thDataCoverage', 'Data Coverage')} {sortField === 'data_coverage_pct' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th>{t('demand.thDrivers', 'Key Explanatory Drivers')}</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>{t('common.action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                        {t('demand.noMatchingPairs', 'No district-occupation pairs match the selected filters.')}
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((row, idx) => {
                      const rowKey = `${row.district_id}-${row.occupation_id}`;
                      const isSelected = selectedRowId === rowKey;

                      return (
                        <tr
                          key={rowKey}
                          className={`clickable-row ${isSelected ? 'selected-row' : ''}`}
                          onClick={() => setSelectedRowId(rowKey)}
                        >
                          <td className="cell-rank">#{row.rank || idx + 1}</td>
                          <td>
                            <div className="cell-title">{row.occupation_title}</div>
                            <div className="cell-subtitle">{row.trade}</div>
                          </td>
                          <td>
                            <span className="spec-chip">{getSectorDisplayName(row.sector, isHindi)}</span>
                          </td>
                          <td>
                            <div className="cell-title">{getDistrictDisplayName(row.district_name, isHindi)}</div>
                            <div className="cell-subtitle">{getStateDisplayName(row.state_code, isHindi)}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="score-pill demand">
                              {row.composite_score.toFixed(1)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal-700)' }}>
                              {row.data_coverage_pct.toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ maxWidth: '340px' }}>
                            {row.key_drivers && row.key_drivers.length > 0 ? (
                              row.key_drivers.map((driver, dIdx) => (
                                <span key={dIdx} className="driver-chip" title={formatDemandDriver(driver, isHindi)}>
                                  {formatDemandDriver(driver, isHindi)}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>{t('demand.standardBaseline', 'Standard baseline')}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-refresh"
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                border: isSelected ? '1px solid var(--teal-600)' : '1px solid var(--slate-300)',
                                backgroundColor: isSelected ? 'var(--teal-50)' : '#ffffff',
                                color: isSelected ? 'var(--teal-800)' : 'var(--slate-700)',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowId(rowKey);
                              }}
                            >
                              {isSelected ? t('common.viewing', 'Viewing') : t('common.inspect', 'Inspect')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Component Breakdown Drawer for Selected Record */}
          {selectedItem && (
            <section className="inspection-drawer">
              <div className="inspection-header">
                <div className="inspection-title-block">
                  <h3>
                    {t('demand.drawerTitle', 'Component Breakdown: {occupation} ({district}, {state})', {
                      occupation: selectedItem.occupation_title,
                      district: getDistrictDisplayName(selectedItem.district_name, isHindi),
                      state: getStateDisplayName(selectedItem.state_code, isHindi),
                    })}
                  </h3>
                  <p>
                    {t('demand.drawerMeta', 'Sector: {sector} • Trade: {trade} • Composite Demand Score: {score}/100 (Rank #{rank})', {
                      sector: getSectorDisplayName(selectedItem.sector, isHindi),
                      trade: selectedItem.trade,
                      score: selectedItem.composite_score.toFixed(1),
                      rank: selectedItem.rank,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className="inspection-close-btn"
                  onClick={() => setSelectedRowId(null)}
                >
                  ✕ {t('common.closeBreakdown', 'Close Breakdown')}
                </button>
              </div>

              <div className="inspection-body">
                {/* 5 Component Diagnostics Cards */}
                <div className="components-grid">
                  {/* 1. Posting Volume */}
                  {selectedItem.components?.posting_volume && (
                    <div className="component-card">
                      <div className="component-card-top">
                        <span className="component-name">{t('demand.c1Name', '1. Online Posting Volume')}</span>
                        <span className="component-weight-badge">{t('demand.c1Weight', 'Weight: 30%')}</span>
                      </div>
                      <div className="component-value-row">
                        <span className="component-raw-val">
                          {selectedItem.components.posting_volume.raw_value} {t('demand.c1Unit', 'postings')}
                        </span>
                        <span className="component-score-val">
                          {selectedItem.components.posting_volume.score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="component-meter-bg">
                        <div
                          className="component-meter-fill"
                          style={{ width: `${Math.min(100, selectedItem.components.posting_volume.score)}%` }}
                        />
                      </div>
                      <div className="component-subtext">
                        {t('demand.c1Subtext', 'Contribution: {contrib} pts to composite index.', {
                          contrib: (selectedItem.components.posting_volume.score * 0.3).toFixed(2),
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Demand Growth Velocity */}
                  {selectedItem.components?.demand_growth && (
                    <div className="component-card">
                      <div className="component-card-top">
                        <span className="component-name">{t('demand.c2Name', '2. Demand Growth Velocity')}</span>
                        <span className="component-weight-badge">{t('demand.c2Weight', 'Weight: 25%')}</span>
                      </div>
                      <div className="component-value-row">
                        <span className="component-raw-val" style={{ color: selectedItem.components.demand_growth.raw_value >= 0 ? '#15803d' : '#b91c1c' }}>
                          {formatGrowth(selectedItem.components.demand_growth.raw_value)}
                        </span>
                        <span className="component-score-val">
                          {selectedItem.components.demand_growth.score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="component-meter-bg">
                        <div
                          className="component-meter-fill"
                          style={{ width: `${Math.min(100, selectedItem.components.demand_growth.score)}%` }}
                        />
                      </div>
                      <div className="component-subtext">
                        {t('demand.c2Subtext', 'Growth Interpretation: Trailing 3-month average vs preceding 3-month average. A fractional rate of {raw} indicates a {pct}% rate of growth.', {
                          raw: selectedItem.components.demand_growth.raw_value.toFixed(4),
                          pct: (selectedItem.components.demand_growth.raw_value * 100).toFixed(2),
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Vacancy Persistence */}
                  {selectedItem.components?.vacancy_persistence && (
                    <div className="component-card">
                      <div className="component-card-top">
                        <span className="component-name">{t('demand.c3Name', '3. Vacancy Persistence')}</span>
                        <span className="component-weight-badge">{t('demand.c3Weight', 'Weight: 15%')}</span>
                      </div>
                      <div className="component-value-row">
                        <span className="component-raw-val">
                          {selectedItem.components.vacancy_persistence.raw_value.toFixed(1)} {t('demand.c3Unit', 'pts')}
                        </span>
                        <span className="component-score-val">
                          {selectedItem.components.vacancy_persistence.score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="component-meter-bg">
                        <div
                          className="component-meter-fill"
                          style={{ width: `${Math.min(100, selectedItem.components.vacancy_persistence.score)}%` }}
                        />
                      </div>
                      <div className="component-subtext">
                        {t('demand.c3Subtext', 'Measures duration job postings remain active before fulfillment.')}
                      </div>
                    </div>
                  )}

                  {/* 4. Employer Diversity */}
                  {selectedItem.components?.employer_diversity && (
                    <div className="component-card">
                      <div className="component-card-top">
                        <span className="component-name">{t('demand.c4Name', '4. Employer Diversity')}</span>
                        <span className="component-weight-badge">{t('demand.c4Weight', 'Weight: 15%')}</span>
                      </div>
                      <div className="component-value-row">
                        <span className="component-raw-val">
                          {selectedItem.components.employer_diversity.raw_value} {t('demand.c4Unit', 'employers')}
                        </span>
                        <span className="component-score-val">
                          {selectedItem.components.employer_diversity.score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="component-meter-bg">
                        <div
                          className="component-meter-fill"
                          style={{ width: `${Math.min(100, selectedItem.components.employer_diversity.score)}%` }}
                        />
                      </div>
                      <div className="component-subtext">
                        {t('demand.c4Subtext', 'Number of unique distinct hiring employers posting vacancies.')}
                      </div>
                    </div>
                  )}

                  {/* 5. Wage Attractiveness */}
                  {selectedItem.components?.wage_attractiveness && (
                    <div className="component-card">
                      <div className="component-card-top">
                        <span className="component-name">{t('demand.c5Name', '5. Wage Attractiveness Index')}</span>
                        <span className="component-weight-badge">{t('demand.c5Weight', 'Weight: 15%')}</span>
                      </div>
                      <div className="component-value-row">
                        <span className="component-raw-val">
                          {selectedItem.components.wage_attractiveness.raw_value.toFixed(1)} {t('demand.c5Unit', 'index pts')}
                        </span>
                        <span className="component-score-val">
                          {selectedItem.components.wage_attractiveness.score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="component-meter-bg">
                        <div
                          className="component-meter-fill"
                          style={{ width: `${Math.min(100, selectedItem.components.wage_attractiveness.score)}%` }}
                        />
                      </div>
                      <div className="component-subtext">
                        {t('demand.c5Subtext', 'Offered wages normalized against regional cost-of-living baselines.')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanatory Factors & Provenance */}
                <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.4rem' }}>
                    {t('demand.driversHeader', 'Key Explanatory Drivers for this Occupation')}
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--slate-700)', lineHeight: 1.6 }}>
                    {selectedItem.key_drivers?.map((driver, kIdx) => (
                      <li key={kIdx}>{formatDemandDriver(driver, isHindi)}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <strong>{t('demand.provenanceLabel', 'Data Provenance:')}</strong>{' '}
                    {selectedItem.is_synthetic ? t('demand.syntheticPilot', 'Synthetic Pilot Observation') : t('demand.adminSignal', 'Validated Administrative Signal')} • {t('demand.missingSignalsLabel', 'Missing Signals:')}{' '}
                    {selectedItem.missing_signals?.length === 0 ? t('demand.noneComplete', 'None (100% complete)') : selectedItem.missing_signals.join(', ')}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Methodology & Policy Disclosure */}
          <section className="callout-box">
            <h4>
              <span>ℹ️</span>
              <span>{t('demand.methodologyTitle', 'Demand Index Methodology & Assumptions')}</span>
            </h4>
            <p>
              <strong>{t('demand.methodologyPercentileTitle', 'Cross-Sectional Percentile Index:')}</strong>{' '}
              {t(
                'demand.methodologyPercentileText',
                'All demand scores are relative percentile ranks (0 to 100) computed across all 54 monitored district-occupation pairs in the current reporting period. Scores indicate relative recruitment intensity, not an absolute number of open jobs.'
              )}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('demand.methodologyWeightsTitle', 'Prototype Weights:')}</strong>{' '}
              {t(
                'demand.methodologyWeightsText',
                'Component weights (Posting: 30%, Growth: 25%, Persistence: 15%, Diversity: 15%, Wage: 15%) are prototype policy assumptions designed to prioritize hiring volume and trajectory over spot signals.'
              )}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('demand.methodologyDemoTitle', 'Synthetic Demo Status:')}</strong>{' '}
              {t(
                'demand.methodologyDemoText',
                'Historical monthly job postings spanning October 2024 to September 2026 are synthetic demonstration data (not official statistics) for Smart India Hackathon decision-support prototyping.'
              )}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
