import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import Icon from './Icon';
import { fetchAlerts } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

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

const CANONICAL_SECTORS = ['IT/ITeS', 'Manufacturing', 'Logistics'];

const ALERT_TYPES = [
  { id: 'demand_pressure', label: 'Demand Pressure (Single Horizon)' },
  { id: 'supply_pressure', label: 'Supply Pressure (Single Horizon)' },
  { id: 'persistent_demand_pressure', label: 'Persistent Demand Pressure (≥2 Horizons)' },
  { id: 'persistent_supply_pressure', label: 'Persistent Supply Pressure (≥2 Horizons)' },
  { id: 'accelerating_demand', label: 'Accelerating Demand Velocity' },
  { id: 'declining_demand', label: 'Declining Demand Trajectory' },
  { id: 'data_quality_warning', label: 'Data Quality / History Warning' },
];

const SEVERITY_LEVELS = [
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

export default function EarlyWarningAlerts({
  period = '2026-09',
  onPeriodChange,
  stateFilter,
  districtFilter,
  sectorFilter,
  occupationFilter,
  horizonFilter,
  onStateChange,
  onDistrictChange,
  onSectorChange,
  _onOccupationChange,
  onHorizonChange,
  onResetFilters,
  onNavigateToSimulator = () => {},
}) {
  const { t, isHindi } = useLanguage();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Filters
  const [selectedHorizon, setSelectedHorizon] = useState(horizonFilter ? String(horizonFilter) : '');
  const [selectedState, setSelectedState] = useState(stateFilter || '');
  const [selectedDistrict, setSelectedDistrict] = useState(districtFilter || '');
  const [selectedSector, setSelectedSector] = useState(sectorFilter || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');

  // Sync external filters from ContextFilterBar
  useEffect(() => {
    if (horizonFilter !== undefined) setSelectedHorizon(horizonFilter ? String(horizonFilter) : '');
  }, [horizonFilter]);

  useEffect(() => {
    if (stateFilter !== undefined) setSelectedState(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    if (districtFilter !== undefined) setSelectedDistrict(districtFilter);
  }, [districtFilter]);

  useEffect(() => {
    if (sectorFilter !== undefined) setSelectedSector(sectorFilter);
  }, [sectorFilter]);

  // Selected alert for Detail Drawer
  const [selectedAlertId, setSelectedAlertId] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('severity');
  const [sortDirection, setSortDirection] = useState('asc'); // severity order: critical > high > medium > low

  const executeAlertsFetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchAlerts({
        period,
        horizon: selectedHorizon ? Number(selectedHorizon) : undefined,
        state_code: selectedState || undefined,
        district_id: selectedDistrict || undefined,
        sector: selectedSector || undefined,
        alert_type: selectedType || undefined,
        severity: selectedSeverity || undefined,
        limit: 200,
      });
      setData(res);

      if (res?.results?.length > 0) {
        setSelectedAlertId(res.results[0].alert_id);
      } else {
        setSelectedAlertId(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to load Early-Warning Alerts from backend service.');
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedHorizon, selectedState, selectedDistrict, selectedSector, selectedType, selectedSeverity]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const res = await fetchAlerts({
          period,
          horizon: selectedHorizon ? Number(selectedHorizon) : undefined,
          state_code: selectedState || undefined,
          district_id: selectedDistrict || undefined,
          sector: selectedSector || undefined,
          alert_type: selectedType || undefined,
          severity: selectedSeverity || undefined,
          limit: 200,
        });
        if (ignore) return;
        setData(res);

        if (res?.results?.length > 0) {
          setSelectedAlertId(res.results[0].alert_id);
        } else {
          setSelectedAlertId(null);
        }
        setErrorMessage(null);
      } catch (err) {
        if (ignore) return;
        setErrorMessage(err.message || 'Unable to load Early-Warning Alerts from backend service.');
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
  }, [period, selectedHorizon, selectedState, selectedDistrict, selectedSector, selectedType, selectedSeverity]);

  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    onStateChange?.(newState);
    if (newState && selectedDistrict) {
      const match = DISTRICTS.find((d) => d.id === selectedDistrict && d.state === newState);
      if (!match) {
        setSelectedDistrict('');
        onDistrictChange?.('');
      }
    }
  };

  const resetFilters = () => {
    setSelectedHorizon('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedSector('');
    setSelectedType('');
    setSelectedSeverity('');
    onResetFilters?.();
  };

  const filteredDistricts = useMemo(() => {
    if (!selectedState) return DISTRICTS;
    return DISTRICTS.filter((d) => d.state === selectedState);
  }, [selectedState]);

  // Derive available sector options dynamically from API data with canonical fallback
  const sectorOptions = useMemo(() => {
    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      const fromData = Array.from(new Set(data.results.map((r) => r.sector).filter(Boolean)));
      if (fromData.length > 0) {
        return Array.from(new Set([...CANONICAL_SECTORS, ...fromData])).sort();
      }
    }
    return CANONICAL_SECTORS;
  }, [data]);

  // Client-side sorting and occupation filtering
  const sortedAlerts = useMemo(() => {
    if (!data?.results) return [];

    let list = [...data.results];
    if (occupationFilter) {
      list = list.filter((a) => a.occupation_id === occupationFilter);
    }

    const severityWeight = { critical: 1, high: 2, medium: 3, low: 4 };

    return list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'severity') {
        aVal = severityWeight[a.severity] || 99;
        bVal = severityWeight[b.severity] || 99;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (sortField === 'is_persistent') {
        aVal = a.key_values?.is_persistent ? 1 : 0;
        bVal = b.key_values?.is_persistent ? 1 : 0;
        return sortDirection === 'asc' ? bVal - aVal : aVal - bVal;
      }

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

  // Keep selected alert synchronized with filtered results
  useEffect(() => {
    if (sortedAlerts.length > 0) {
      const exists = sortedAlerts.some((a) => a.alert_id === selectedAlertId);
      if (!exists) {
        setSelectedAlertId(sortedAlerts[0].alert_id);
      }
    } else {
      setSelectedAlertId(null);
    }
  }, [sortedAlerts, selectedAlertId]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const selectedItem = useMemo(() => {
    if (!selectedAlertId || sortedAlerts.length === 0) return null;
    return sortedAlerts.find((a) => a.alert_id === selectedAlertId) || null;
  }, [sortedAlerts, selectedAlertId]);

  // Dynamic summary metrics calculated strictly from currently matching results
  const summaryMetrics = useMemo(() => {
    const list = sortedAlerts;
    const criticalCount = list.filter((a) => a.severity === 'critical').length;
    const highCount = list.filter((a) => a.severity === 'high').length;
    const qualityCount = list.filter((a) => a.alert_type === 'data_quality_warning').length;
    const persistentCount = list.filter((a) => a.key_values?.is_persistent).length;

    return {
      total: list.length,
      criticalCount,
      highCount,
      qualityCount,
      persistentCount,
    };
  }, [sortedAlerts]);

  const getStateDisplayName = (s) => {
    if (!isHindi) return `${s.name} (${s.code})`;
    if (s.code === 'KA') return 'कर्नाटक (KA)';
    if (s.code === 'MH') return 'महाराष्ट्र (MH)';
    if (s.code === 'TS') return 'तेलंगाना (TS)';
    return `${s.name} (${s.code})`;
  };

  const getDistrictDisplayName = (id, fallbackName) => {
    if (!isHindi) return fallbackName || id;
    if (id === 'KA_BLR_U') return 'बेंगलुरु शहरी (KA_BLR_U)';
    if (id === 'KA_DHA') return 'धारवाड़ (KA_DHA)';
    if (id === 'MH_MUM') return 'मुंबई उपनगरीय (MH_MUM)';
    if (id === 'MH_PUN') return 'पुणे (MH_PUN)';
    if (id === 'TS_HYD') return 'हैदराबाद (TS_HYD)';
    if (id === 'TS_MED') return 'मेदचल-मलकाजगिरि (TS_MED)';
    return fallbackName || id;
  };

  const getSectorDisplayName = (sec) => {
    if (!isHindi) return sec;
    if (sec === 'IT/ITeS') return 'आईटी / आईटीईएस (IT/ITeS)';
    if (sec === 'Manufacturing') return 'विनिर्माण (Manufacturing)';
    if (sec === 'Logistics') return 'लॉजिस्टिक्स (Logistics)';
    return sec;
  };

  const getAlertTypeName = (type) => {
    switch (type) {
      case 'persistent_demand_pressure': return t('alerts.typePersistentDemand', 'Persistent Demand Pressure');
      case 'persistent_supply_pressure': return t('alerts.typePersistentSupply', 'Persistent Supply Pressure');
      case 'demand_pressure': return t('alerts.typeSingleDemand', 'Single-Horizon Demand Pressure');
      case 'supply_pressure': return t('alerts.typeSingleSupply', 'Single-Horizon Supply Pressure');
      case 'accelerating_demand': return t('alerts.typeAcceleratingDemand', 'Demand Acceleration Warning');
      case 'declining_demand': return t('alerts.typeDecliningDemand', 'Demand Decline Warning');
      case 'data_quality_warning': return t('alerts.typeDataQuality', 'Data Quality / History Warning');
      default: return type;
    }
  };

  const getSeverityLabel = (sev) => {
    switch (sev) {
      case 'critical': return t('severity.critical', 'Critical');
      case 'high': return t('severity.high', 'High');
      case 'medium': return t('severity.medium', 'Medium');
      case 'low': return t('severity.low', 'Low');
      default: return sev;
    }
  };

  return (
    <div className="overview-grid">
      {/* Page Intro Header Banner */}
      <div className="page-intro-header">
        <h1 className="page-intro-title">{t('alerts.introTitle', 'SkillPulse Early-Warning Alerts Engine')}</h1>
        <p className="page-intro-desc">
          {t('alerts.introDesc', 'Automated decision-support heuristics detecting emerging regional labor market bottlenecks. Generates explainable triggers for persistent multi-horizon mismatches (≥2 horizons crossing ±15 thresholds), single-horizon pressures, accelerating demand velocity, and time-series data quality risks.')}
        </p>
      </div>

      {/* Filter Control Bar */}
      <section className="filter-bar-panel">
        <div className="filter-group">
          <label htmlFor="alert-period" className="filter-label">{t('common.reportingPeriod', 'Reporting Period')}</label>
          <select
            id="alert-period"
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
          <label htmlFor="alert-horizon" className="filter-label">{t('common.horizon', 'Horizon')}</label>
          <select
            id="alert-horizon"
            className="filter-select"
            value={selectedHorizon}
            onChange={(e) => {
              setSelectedHorizon(e.target.value);
              onHorizonChange?.(e.target.value ? Number(e.target.value) : 3);
            }}
          >
            <option value="">{t('common.allHorizons', 'All Horizons')}</option>
            <option value="3">3 {isHindi ? 'माह' : 'Months'}</option>
            <option value="6">6 {isHindi ? 'माह' : 'Months'}</option>
            <option value="12">12 {isHindi ? 'माह' : 'Months'}</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="alert-severity" className="filter-label">{t('common.severity', 'Severity')}</label>
          <select
            id="alert-severity"
            className="filter-select"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="">{t('common.allSeverities', 'All Severities')}</option>
            {SEVERITY_LEVELS.map((s) => (
              <option key={s.id} value={s.id}>{getSeverityLabel(s.id)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="alert-type" className="filter-label">{t('common.alertType', 'Alert Type')}</label>
          <select
            id="alert-type"
            className="filter-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">{t('common.allAlertTypes', 'All Alert Types')}</option>
            {ALERT_TYPES.map((tItem) => (
              <option key={tItem.id} value={tItem.id}>{getAlertTypeName(tItem.id)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="alert-state" className="filter-label">{t('common.state', 'State')}</label>
          <select
            id="alert-state"
            className="filter-select"
            value={selectedState}
            onChange={handleStateChange}
          >
            <option value="">{t('common.allStates', 'All States (3)')}</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>{getStateDisplayName(s)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="alert-district" className="filter-label">{t('common.district', 'District')}</label>
          <select
            id="alert-district"
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              onDistrictChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allDistricts', 'All Districts')} ({filteredDistricts.length})</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>{getDistrictDisplayName(d.id, d.name)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="alert-sector" className="filter-label">{t('common.sector', 'Sector')}</label>
          <select
            id="alert-sector"
            className="filter-select"
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              onSectorChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
            {sectorOptions.map((sec) => (
              <option key={sec} value={sec}>{getSectorDisplayName(sec)}</option>
            ))}
          </select>
        </div>

        {(selectedHorizon || selectedState || selectedDistrict || selectedSector || selectedType || selectedSeverity) && (
          <button type="button" className="btn-reset-filters" onClick={resetFilters}>
            <span>✕</span> {t('common.resetFilters', 'Reset Filters')}
          </button>
        )}
      </section>

      {/* Loading / Error States */}
      {errorMessage ? (
        <ErrorAlert message={errorMessage} onRetry={executeAlertsFetch} />
      ) : isLoading ? (
        <LoadingSpinner message={t('alerts.loadingMsg', 'Scanning early-warning triggers and persistence rules across horizons...')} />
      ) : (
        <>
          {/* Dynamic Summary Cards */}
          <section className="stats-cards-row">
            <div className="stat-card demand-pressure">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('alerts.cardCriticalTitle', 'Critical Severity')}</span>
                <span className="stat-card-icon"><Icon name="alert" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--status-danger-text)' }}>
                {summaryMetrics.criticalCount}
              </div>
              <div className="stat-card-meta">
                {t('alerts.cardCriticalMeta', 'High-Urgency Decision Signals')}
              </div>
              <div className="stat-card-subtext">
                {t('alerts.cardCriticalSub', 'Extreme mismatch (≥30 pts) or structural persistence')}
              </div>
            </div>

            <div className="stat-card supply-pressure">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('alerts.cardHighTitle', 'High Severity')}</span>
                <span className="stat-card-icon"><Icon name="warning" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--status-demand-text)' }}>
                {summaryMetrics.highCount}
              </div>
              <div className="stat-card-meta">
                {t('alerts.cardHighMeta', 'Standard Imbalance Triggers')}
              </div>
              <div className="stat-card-subtext">
                {t('alerts.cardHighSub', 'Crossed ±15 threshold at evaluated horizons')}
              </div>
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('alerts.cardPersistentTitle', 'Persistent Signals')}</span>
                <span className="stat-card-icon"><Icon name="refresh" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--accent-indigo)' }}>
                {summaryMetrics.persistentCount}
              </div>
              <div className="stat-card-meta">
                {t('alerts.cardPersistentMeta', 'Multi-Horizon Verified (≥2 Horizons)')}
              </div>
              <div className="stat-card-subtext">
                {t('alerts.cardPersistentSub', 'Requires same mismatch direction at 3m, 6m, 12m')}
              </div>
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('alerts.cardQualityTitle', 'Data Quality Warnings')}</span>
                <span className="stat-card-icon"><Icon name="shield" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: summaryMetrics.qualityCount > 0 ? 'var(--status-demand-text)' : 'var(--status-success-text)' }}>
                {summaryMetrics.qualityCount}
              </div>
              <div className="stat-card-meta">
                {t('alerts.cardQualityMeta', 'Telemetry & Model Guardrails')}
              </div>
              <div className="stat-card-subtext">
                {summaryMetrics.qualityCount === 0 ? t('alerts.cardQualitySubZero', 'Zero data quality or WAPE anomalies') : t('alerts.cardQualitySubElevated', 'Elevated backtesting error rate')}
              </div>
            </div>
          </section>

          {/* Alerts List Table */}
          <section className="card-panel">
            <div className="card-panel-header">
              <div className="card-title-group">
                <h2>{t('alerts.tableTitle', 'Active Early-Warning Telemetry Signals')}</h2>
                <p>{t('alerts.tableSubtitle', 'Click any alert row to inspect causal explanations, supporting horizon vectors, and suggested actions.')}</p>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('common.showingAlerts', { count: sortedAlerts.length }, `Showing ${sortedAlerts.length} active alerts`)}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="th-sortable" style={{ width: '90px' }} onClick={() => handleSort('severity')}>
                      {t('alerts.thSeverity', 'Severity')} {sortField === 'severity' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('alert_type')}>
                      {t('alerts.thAlertType', 'Alert Type')} {sortField === 'alert_type' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('is_persistent')}>
                      {t('alerts.thPersistence', 'Persistence')} {sortField === 'is_persistent' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('occupation_title')}>
                      {t('alerts.thOccupationSector', 'Occupation & Sector')} {sortField === 'occupation_title' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('district_name')}>
                      {t('alerts.thDistrictState', 'District / State')} {sortField === 'district_name' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th style={{ textAlign: 'center' }}>{t('alerts.thHorizon', 'Horizon')}</th>
                    <th>{t('alerts.thSummary', 'Supporting Summary')}</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>{t('common.action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        {t('alerts.noAlerts', 'No early-warning alerts match the selected filter criteria.')}
                      </td>
                    </tr>
                  ) : (
                    sortedAlerts.map((alert) => {
                      const isSelected = selectedAlertId === alert.alert_id;
                      const isPersistent = alert.key_values?.is_persistent;

                      return (
                        <tr
                          key={alert.alert_id}
                          className={`clickable-row ${isSelected ? 'selected-row' : ''}`}
                          onClick={() => setSelectedAlertId(alert.alert_id)}
                        >
                          <td>
                            <span className={`severity-badge ${alert.severity}`}>
                              {getSeverityLabel(alert.severity)}
                            </span>
                          </td>
                          <td>
                            <div className="cell-title" style={{ fontSize: '0.8rem' }}>
                              {getAlertTypeName(alert.alert_type)}
                            </div>
                            <div className="cell-subtitle" style={{ fontFamily: 'var(--font-mono)' }}>
                              {alert.alert_id.slice(0, 24)}...
                            </div>
                          </td>
                          <td>
                            {isPersistent ? (
                              <span className="persistence-badge persistent" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Icon name="refresh" size={12} /> {t('alerts.persistentBadge', 'Persistent')} ({alert.key_values?.supporting_horizons?.length} {isHindi ? 'क्षितिज' : 'horizons'})
                              </span>
                            ) : (
                              <span className="persistence-badge single">
                                {t('alerts.singleHorizonBadge', 'Single Horizon')} ({alert.horizon_months}m)
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="cell-title">{alert.occupation_title}</div>
                            <div className="cell-subtitle">{getSectorDisplayName(alert.sector)}</div>
                          </td>
                          <td>
                            <div className="cell-title">{getDistrictDisplayName(alert.district_id, alert.district_name)}</div>
                            <div className="cell-subtitle">{getStateDisplayName({ code: alert.state_code, name: alert.state_code })}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                            {alert.horizon_months ? `+${alert.horizon_months}m` : (isHindi ? 'बहु-क्षितिज (3m, 6m, 12m)' : 'Multi (3m, 6m, 12m)')}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                            {alert.key_values?.projected_mismatch_score !== undefined ? (
                              <span>{isHindi ? 'असंतुलन:' : 'Mismatch:'} <strong>{alert.key_values.projected_mismatch_score > 0 ? '+' : ''}{alert.key_values.projected_mismatch_score.toFixed(1)} {isHindi ? 'अंक' : 'pts'}</strong></span>
                            ) : isPersistent ? (
                              <span>{isHindi ? 'समर्थक:' : 'Supporting:'} {alert.key_values?.supporting_horizons?.map((h) => `${h}m`).join(', ')}</span>
                            ) : (
                              <span>{t('alerts.verifiedAnomaly', 'Verified anomaly trigger')}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-refresh"
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                border: isSelected ? '1px solid var(--teal-600)' : '1px solid var(--border-subtle)',
                                backgroundColor: isSelected ? 'var(--teal-50)' : 'var(--bg-surface)',
                                color: isSelected ? 'var(--teal-800)' : 'var(--text-secondary)',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAlertId(alert.alert_id);
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

          {/* Detailed Alert Inspection Drawer */}
          {selectedItem && (
            <section className="inspection-drawer">
              <div className="inspection-header">
                <div className="inspection-title-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                    <span className={`severity-badge ${selectedItem.severity}`}>
                      {getSeverityLabel(selectedItem.severity)}
                    </span>
                    <h3 style={{ margin: 0 }}>
                      {getAlertTypeName(selectedItem.alert_type)}: {selectedItem.occupation_title} ({getDistrictDisplayName(selectedItem.district_id, selectedItem.district_name)})
                    </h3>
                  </div>
                  <p style={{ margin: 0 }}>
                    {isHindi ? 'अलर्ट आईडी:' : 'Alert ID:'} <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedItem.alert_id}</span> • {t('common.reportingPeriod', 'Period')}: {selectedItem.period}
                  </p>
                </div>
                <button
                  type="button"
                  className="inspection-close-btn"
                  onClick={() => setSelectedAlertId(null)}
                >
                  ✕ {isHindi ? 'निदान बंद करें' : 'Close Diagnostics'}
                </button>
              </div>

              <div className="inspection-body">
                {/* 1. Persistence Rule & Supporting Horizons */}
                <div className="component-card">
                  <div className="component-card-top">
                    <span className="component-name">{t('alerts.persistenceHeader', 'Persistence Evaluation & Horizon Support')}</span>
                    {selectedItem.key_values?.is_persistent ? (
                      <span className="persistence-badge persistent">
                        {t('alerts.persistentConfirmed', '✓ Persistent Mismatch Confirmed')}
                      </span>
                    ) : (
                      <span className="persistence-badge single">
                        {t('alerts.singleSignalOnly', 'Single-Horizon Signal Only')}
                      </span>
                    )}
                  </div>

                  {selectedItem.key_values?.is_persistent ? (
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        <strong>{t('alerts.ruleApplied', 'Persistence Rule Applied:')}</strong> {selectedItem.key_values.persistence_rule || (isHindi ? '3m, 6m, 12m में से ≥2 समर्थित क्षितिजों पर समान दिशा में सीमा रेखा पार की।' : 'Mismatch crossed threshold in the same direction at >=2 supported horizons (3m, 6m, 12m).')}
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {selectedItem.key_values?.scores_by_horizon && (
                          Object.entries(selectedItem.key_values.scores_by_horizon).map(([h, score]) => (
                            <div key={h} className="spec-chip" style={{ background: 'var(--accent-indigo-bg)', borderColor: 'var(--accent-indigo-border)', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                              {isHindi ? 'क्षितिज' : 'Horizon'} +{h}m: {score > 0 ? '+' : ''}{Number(score).toFixed(1)} {isHindi ? 'अंक' : 'pts'}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t('alerts.singleHorizonNotice', { h: selectedItem.horizon_months, target: selectedItem.target_period, crossed: selectedItem.key_values?.supporting_horizon_count ?? 1 }, `This is a single-horizon signal evaluated at the +${selectedItem.horizon_months}-month horizon (${selectedItem.target_period}). Persistence rule requires threshold crossing at two or more supported horizons (${selectedItem.key_values?.supporting_horizon_count ?? 1} currently crossed).`)}
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Causal Narrative Explanation */}
                <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Icon name="search" size={15} />
                    <span>{t('alerts.causalExplanationTitle', 'Causal Explanation')}</span>
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {selectedItem.explanation}
                  </p>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <strong>{isHindi ? 'लागू सीमा रेखा:' : 'Threshold Applied:'}</strong> ±{selectedItem.key_values?.threshold_applied || 15.0} {isHindi ? 'अंक' : 'points'}
                  </div>
                </div>

                {/* 3. Suggested Policy / Planning Action */}
                <div style={{ background: 'var(--status-success-bg)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--status-success-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--status-success-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Icon name="target" size={15} />
                      <span>{t('alerts.suggestedActionTitle', 'Suggested TVET / Policy Planning Action')}</span>
                    </h4>
                    {onNavigateToSimulator && (
                      <button
                        type="button"
                        onClick={() => onNavigateToSimulator(selectedItem.district_id, selectedItem.occupation_id, selectedItem.horizon_months)}
                        style={{
                          backgroundColor: '#0d9488',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Icon name="sliders" size={14} />
                        <span>{isHindi ? 'परिदृश्य स्टूडियो में समाधान सिम्युलेट करें' : 'Simulate Fix in Scenario Studio'}</span>
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                    {selectedItem.suggested_action}
                  </p>
                </div>

                {/* 4. Limitations & Human-in-the-Loop Governance Notice */}
                <div className="callout-box" style={{ background: 'var(--status-demand-bg)', borderColor: 'var(--status-demand-border)', borderLeftColor: 'var(--status-demand)' }}>
                  <h4 style={{ color: 'var(--status-demand-text)' }}>
                    <Icon name="shield" size={15} />
                    <span>{t('alerts.humanLimitationsTitle', 'Human Decision-Support Limitations')}</span>
                  </h4>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {selectedItem.limitations}
                  </p>
                  <p style={{ color: 'var(--status-demand-text)', marginTop: '0.35rem', fontWeight: 600 }}>
                    {t('alerts.humanNotice', 'Alerts serve as decision-support signals requiring qualitative human review and field verification. They do NOT constitute automated budget allocations or administrative decrees.')}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Persistent Disclosures */}
          <section className="callout-box">
            <h4>
              <Icon name="info" size={15} />
              <span>{t('alerts.methodologyHeader', 'Early-Warning Classification Rules & Governance')}</span>
            </h4>
            <p>
              <strong>{t('alerts.multiHorizonRuleTitle', 'Multi-Horizon Persistence Rule:')}</strong> {t('alerts.multiHorizonRuleText', 'A labor market mismatch is only classified as Persistent when the projected relative mismatch crosses the threshold (≥ +15 for demand pressure, ≤ −15 for supply pressure) in the same direction at two or more of the 3-, 6-, and 12-month forecast horizons. Single-horizon signals are explicitly isolated as non-persistent to prevent premature intervention.')}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('gap.methodologyPlacementTitle', 'Placement Maturity Guardrail:')}</strong> {t('alerts.placementGuardrailText', 'Alerts strictly omit cohort placement rates when the standardized 90-day post-certification follow-up window remains open. Immature batches are never cited in pressure classifications.')}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
