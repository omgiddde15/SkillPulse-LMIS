import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import { fetchGapAnalysis } from '../api/client';
import { exportTableToCsv } from '../utils/exportCsv';
import { useLanguage } from '../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
  formatExplanatoryFactor,
} from '../i18n/translations';
import Icon from './Icon';

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

export default function GapAnalysis({
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
  const { t, isHindi } = useLanguage();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Filters
  const [selectedState, setSelectedState] = useState(stateFilter || '');
  const [selectedDistrict, setSelectedDistrict] = useState(districtFilter || '');
  const [selectedSector, setSelectedSector] = useState(sectorFilter || '');
  const [selectedClassification, setSelectedClassification] = useState('');

  // Sync external filters from ContextFilterBar
  useEffect(() => {
    if (stateFilter !== undefined) setSelectedState(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    if (districtFilter !== undefined) setSelectedDistrict(districtFilter);
  }, [districtFilter]);

  useEffect(() => {
    if (sectorFilter !== undefined) setSelectedSector(sectorFilter);
  }, [sectorFilter]);

  // Selected row for Detail View
  const [selectedRowId, setSelectedRowId] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('relative_mismatch_score');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const executeGapFetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchGapAnalysis({
        period,
        state_code: selectedState || undefined,
        district_id: selectedDistrict || undefined,
        sector: selectedSector || undefined,
        classification: selectedClassification || undefined,
        limit: 100,
      });
      setData(res);

      if (res?.results?.length > 0) {
        setSelectedRowId(`${res.results[0].district_id}-${res.results[0].occupation_id}`);
      } else {
        setSelectedRowId(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to load Gap Analysis data from backend service.');
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedState, selectedDistrict, selectedSector, selectedClassification]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const res = await fetchGapAnalysis({
          period,
          state_code: selectedState || undefined,
          district_id: selectedDistrict || undefined,
          sector: selectedSector || undefined,
          classification: selectedClassification || undefined,
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
        setErrorMessage(err.message || 'Unable to load Gap Analysis data from backend service.');
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
  }, [period, selectedState, selectedDistrict, selectedSector, selectedClassification]);

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
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedSector('');
    setSelectedClassification('');
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

  const handleExportCsv = useCallback(() => {
    if (!sortedResults || sortedResults.length === 0) return;

    const columns = isHindi
      ? [
          { key: 'period', label: 'रिपोर्टिंग अवधि (Reporting Period)' },
          { key: 'state_code', label: 'राज्य कोड (State Code)' },
          { key: 'state_name', label: 'राज्य का नाम (State Name)' },
          { key: 'district_id', label: 'ज़िला कोड (District ID)' },
          { key: 'district_name', label: 'ज़िला (District Name)' },
          { key: 'sector', label: 'उद्योग क्षेत्र (Industry Sector)' },
          { key: 'trade', label: 'व्यावसायिक ट्रेड (Vocational Trade)' },
          { key: 'occupation_id', label: 'व्यवसाय आईडी (Occupation ID)' },
          { key: 'occupation_title', label: 'व्यवसाय शीर्षक (Occupation Title)' },
          { key: 'nco_code', label: 'एनसीओ कोड (NCO Code)', format: (val) => val || 'N/A' },
          { key: 'demand_index_score', label: 'समग्र मांग स्कोर (Demand Composite Score 0-100)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          { key: 'supply_output_index', label: 'आपूर्ति आउटपुट रैंक (Supply Output Rank 0-100)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          { key: 'relative_mismatch_score', label: 'सापेक्ष असंतुलन स्कोर (Relative Mismatch Score -100 to +100)', format: (val) => (val != null ? Number(val).toFixed(2) : '') },
          { key: 'classification', label: 'असंतुलन नीतिगत वर्गीकरण (Classification)' },
          { key: 'alert_level', label: 'अलर्ट गंभीरता (Alert Level)' },
          { key: 'throughput_3m', label: '3-माह प्रमाणीकरण संख्या (3-Month Certifications)', format: (_, r) => r.throughput?.certifications_3m ?? '' },
          { key: 'throughput_6m', label: '6-माह प्रमाणीकरण संख्या (6-Month Certifications)', format: (_, r) => r.throughput?.certifications_6m ?? '' },
          { key: 'seat_utilization', label: 'सीट उपयोगिता दर (Seat Utilisation Rate %)', format: (_, r) => (r.funnel_rates?.seat_utilization_rate?.value != null ? (r.funnel_rates.seat_utilization_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'completion_rate', label: 'पाठ्यक्रम पूर्णता दर (Completion Rate %)', format: (_, r) => (r.funnel_rates?.completion_rate?.value != null ? (r.funnel_rates.completion_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'certification_rate', label: 'मूल्यांकन प्रमाणीकरण दर (Certification Rate %)', format: (_, r) => (r.funnel_rates?.certification_rate?.value != null ? (r.funnel_rates.certification_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'placement_rate', label: 'प्लेसमेंट दर (Placement Rate %)', format: (_, r) => (r.funnel_rates?.placement_rate?.value != null ? (r.funnel_rates.placement_rate.value * 100).toFixed(1) + '%' : 'Pending (Immature)') },
          { key: 'placement_status', label: 'प्लेसमेंट 90-दिवसीय स्थिति (Placement Status)', format: (_, r) => r.funnel_rates?.placement_rate?.placement_status || (r.funnel_rates?.placement_rate?.value != null ? 'complete' : 'pending') },
          { key: 'index_data_coverage_pct', label: 'डेटा कवरेज (Data Coverage %)', format: (val, r) => (val ?? r.data_coverage_pct ?? 100).toFixed(0) + '%' },
          { key: 'is_synthetic', label: 'सिंथेटिक पायलट ध्वज (Synthetic Pilot Flag)', format: (val) => (val ? 'TRUE' : 'FALSE') },
          { key: 'explanatory_factors', label: 'प्रमुख व्याख्यात्मक कारक (Principal Factors)', format: (val) => (Array.isArray(val) ? val.join(' | ') : '') },
        ]
      : [
          { key: 'period', label: 'Reporting Period' },
          { key: 'state_code', label: 'State Code' },
          { key: 'state_name', label: 'State Name' },
          { key: 'district_id', label: 'District ID' },
          { key: 'district_name', label: 'District Name' },
          { key: 'sector', label: 'Industry Sector' },
          { key: 'trade', label: 'Vocational Trade' },
          { key: 'occupation_id', label: 'Occupation ID' },
          { key: 'occupation_title', label: 'Occupation Title' },
          { key: 'nco_code', label: 'NCO Code', format: (val) => val || 'N/A' },
          { key: 'demand_index_score', label: 'Demand Composite Score (0-100)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          { key: 'supply_output_index', label: 'Supply Output Percentile Rank (0-100)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          { key: 'relative_mismatch_score', label: 'Relative Mismatch Score (-100 to +100)', format: (val) => (val != null ? Number(val).toFixed(2) : '') },
          { key: 'classification', label: 'Mismatch Policy Classification' },
          { key: 'alert_level', label: 'Alert Severity Level' },
          { key: 'throughput_3m', label: '3-Month Certification Volume', format: (_, r) => r.throughput?.certifications_3m ?? '' },
          { key: 'throughput_6m', label: '6-Month Certification Volume', format: (_, r) => r.throughput?.certifications_6m ?? '' },
          { key: 'seat_utilization', label: 'Seat Utilisation Rate (%)', format: (_, r) => (r.funnel_rates?.seat_utilization_rate?.value != null ? (r.funnel_rates.seat_utilization_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'completion_rate', label: 'Curriculum Completion Rate (%)', format: (_, r) => (r.funnel_rates?.completion_rate?.value != null ? (r.funnel_rates.completion_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'certification_rate', label: 'Assessment Certification Rate (%)', format: (_, r) => (r.funnel_rates?.certification_rate?.value != null ? (r.funnel_rates.certification_rate.value * 100).toFixed(1) + '%' : '') },
          { key: 'placement_rate', label: 'Placement Rate (%)', format: (_, r) => (r.funnel_rates?.placement_rate?.value != null ? (r.funnel_rates.placement_rate.value * 100).toFixed(1) + '%' : 'Pending (Immature)') },
          { key: 'placement_status', label: 'Placement 90-Day Follow-Up Status', format: (_, r) => r.funnel_rates?.placement_rate?.placement_status || (r.funnel_rates?.placement_rate?.value != null ? 'complete' : 'pending') },
          { key: 'index_data_coverage_pct', label: 'Input Data Coverage (%)', format: (val, r) => (val ?? r.data_coverage_pct ?? 100).toFixed(0) + '%' },
          { key: 'is_synthetic', label: 'Synthetic Pilot Flag', format: (val) => (val ? 'TRUE' : 'FALSE') },
          { key: 'explanatory_factors', label: 'Principal Explanatory Factors', format: (val) => (Array.isArray(val) ? val.join(' | ') : '') },
        ];

    const filterDescriptor = [
      period,
      selectedState,
      selectedDistrict,
      selectedSector,
      selectedClassification,
    ].filter(Boolean).join('-');

    const filename = `skillpulse-gap-analysis-${filterDescriptor || period}.csv`;

    const disclaimers = isHindi
      ? [
          'डेटा स्रोत: SIH26246 के लिए सिंथेटिक प्रदर्शन डेटासेट (आधिकारिक आंकड़े नहीं)। सभी मेट्रिक्स प्रायोगिक प्रेक्षणों पर परिकलित हैं।',
          'वर्तमान अवधि असंतुलन सूत्र: समग्र मांग स्कोर (0-100) − आपूर्ति आउटपुट पर्सेंटाइल रैंक (0-100)। सीमा: -100 से +100 अंक।',
          'समग्र मांग स्कोर विज्ञापन मात्रा (30%), मांग वृद्धि (25%), रिक्ति स्थायित्व (15%), नियोक्ता विविधता (15%) और वेतन आकर्षण (15%) को संश्लेषित करता है।',
          'असंतुलन स्कोर क्षेत्रीय श्रृंखलाओं में सापेक्ष रैंकिंग असंतुलन को दर्शाते हैं, श्रमिकों की निरपेक्ष कमी या अधिशेष को नहीं।',
          'प्रोटोटाइप नीति सीमाएं: स्कोर सीमाएं प्रोटोटाइप ह्युरिस्टिक सीमाएं (±15) हैं, न कि अनुभवजन्य रूप से कैलिब्रेट किए गए नीति नियम।',
          'TVET रिपोर्टिंग मानकों के तहत, उम्मीदवार रोजगार ट्रैकिंग हेतु 90-दिवसीय अनुवर्ती विंडो आवश्यक है। अपरिपक्व बैच लंबित चिह्नित हैं।',
        ]
      : [
          'Data Provenance: Synthetic demonstration dataset for SIH26246 (not official statistics). All gap analysis metrics are computed on synthetic pilot observations.',
          'Current-Period Mismatch Formula: Demand Composite Score (0-100) - Supply Output Percentile Rank (0-100). Range: -100 to +100 points.',
          'Demand Composite Score synthesizes posting volume (30%), demand growth (25%), vacancy persistence (15%), employer diversity (15%), and wage attractiveness (15%).',
          'Mismatch scores denote relative ranking imbalances across regional pilot series, NOT an absolute shortage or surplus of worker headcounts.',
          'Prototype Decision Thresholds: Alerts and classifications operate on prototype heuristic thresholds (±15), not empirically calibrated policy rules.',
          'Under TVET reporting standards, candidate employment tracking requires a 90-day post-certification follow-up window. Immature cohorts are marked pending.',
        ];

    exportTableToCsv({
      filename,
      columns,
      rows: sortedResults,
      title: isHindi
        ? 'स्किलपल्स (SkillPulse LMIS) — सापेक्ष मांग-आपूर्ति अंतर विश्लेषण निर्यात'
        : 'SkillPulse LMIS — Relative Demand-Supply Gap Analysis Export',
      metadata: isHindi
        ? {
            'डेटा स्रोत (Data Provenance)': 'SIH26246 के लिए सिंथेटिक प्रदर्शन डेटासेट (आधिकारिक आंकड़े नहीं)',
            'रिपोर्टिंग अवधि (Reporting Period)': period,
            'निर्यात समय (Export Timestamp)': new Date().toISOString(),
            'कुल फ़िल्टर रिकॉर्ड (Total Records)': String(sortedResults.length),
            'सक्रिय राज्य फ़िल्टर (Active State)': selectedState || 'सभी राज्य',
            'सक्रिय ज़िला फ़िल्टर (Active District)': selectedDistrict || 'सभी ज़िले',
            'सक्रिय क्षेत्र फ़िल्टर (Active Sector)': selectedSector || 'सभी क्षेत्र',
            'सक्रिय वर्गीकरण फ़िल्टर (Active Classification)': selectedClassification || 'सभी वर्गीकरण',
            'क्रमबद्ध फ़ील्ड (Sort Field)': sortField,
            'क्रमबद्ध दिशा (Sort Direction)': sortDirection,
          }
        : {
            'Data Provenance': 'Synthetic demonstration dataset for SIH26246 (not official statistics)',
            'Reporting Period': period,
            'Export Timestamp': new Date().toISOString(),
            'Total Filtered Records': String(sortedResults.length),
            'Active State Filter': selectedState || 'All States',
            'Active District Filter': selectedDistrict || 'All Districts',
            'Active Sector Filter': selectedSector || 'All Sectors',
            'Active Classification Filter': selectedClassification || 'All Classifications',
            'Sort Field': sortField,
            'Sort Direction': sortDirection,
          },
      disclaimers,
    });
  }, [sortedResults, period, selectedState, selectedDistrict, selectedSector, selectedClassification, sortField, sortDirection, isHindi]);

  const selectedItem = useMemo(() => {
    if (!selectedRowId || sortedResults.length === 0) return null;
    return sortedResults.find((r) => `${r.district_id}-${r.occupation_id}` === selectedRowId) || null;
  }, [sortedResults, selectedRowId]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const list = sortedResults;
    const demandCount = list.filter((r) => r.classification === 'Demand Pressure' || r.relative_mismatch_score >= 15.0).length;
    const supplyCount = list.filter((r) => r.classification === 'Supply Pressure' || r.relative_mismatch_score <= -15.0).length;
    const balancedCount = list.filter(
      (r) => r.relative_mismatch_score > -15.0 && r.relative_mismatch_score < 15.0
    ).length;

    return {
      total: list.length,
      demandCount,
      supplyCount,
      balancedCount,
    };
  }, [sortedResults]);

  const getClassificationBadgeClass = (classification) => {
    if (classification === 'Demand Pressure') return 'demand-pressure';
    if (classification === 'Supply Pressure') return 'supply-pressure';
    return 'balanced';
  };

  const formatMismatch = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const num = Number(val);
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}`;
  };

  return (
    <div className="overview-grid">
      {/* Page Intro Header Banner */}
      <div className="page-intro-header">
        <h1 className="page-intro-title">{t('gap.introTitle', 'SkillPulse Relative Gap Analysis & Mismatch Engine')}</h1>
        <p className="page-intro-desc">
          {t('gap.introDesc')}
        </p>
      </div>

      {/* Filter Control Bar */}
      <section className="filter-bar-panel">
        <div className="filter-group">
          <label htmlFor="gap-period" className="filter-label">{t('common.reportingPeriod')}</label>
          <select
            id="gap-period"
            className="filter-select"
            value={period}
            onChange={(e) => onPeriodChange && onPeriodChange(e.target.value)}
          >
            <option value="2026-09">2026-09 ({t('common.activePilot')})</option>
            <option value="2026-08">2026-08</option>
            <option value="2026-07">2026-07</option>
            <option value="2026-06">2026-06</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="gap-state" className="filter-label">{t('common.state')}</label>
          <select
            id="gap-state"
            className="filter-select"
            value={selectedState}
            onChange={handleStateChange}
          >
            <option value="">{t('common.allStates')}</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>{getStateDisplayName(s.code, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="gap-district" className="filter-label">{t('common.district')}</label>
          <select
            id="gap-district"
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              onDistrictChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allDistricts')} ({filteredDistricts.length})</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>{getDistrictDisplayName(d.name, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="gap-sector" className="filter-label">{t('common.sector')}</label>
          <select
            id="gap-sector"
            className="filter-select"
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              onSectorChange?.(e.target.value);
            }}
          >
            <option value="">{t('common.allSectors')}</option>
            {SECTORS.map((sec) => (
              <option key={sec} value={sec}>{getSectorDisplayName(sec, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="gap-classification" className="filter-label">{t('common.classification')}</label>
          <select
            id="gap-classification"
            className="filter-select"
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
          >
            <option value="">{t('common.allClassifications')}</option>
            <option value="Demand Pressure">{t('class.demandPressure')} ({t('gap.scoreThresholdPos')})</option>
            <option value="Balanced">{t('class.balanced')} / Monitor ({t('gap.neutralBand')})</option>
            <option value="Supply Pressure">{t('class.supplyPressure')} ({t('gap.scoreThresholdNeg')})</option>
          </select>
        </div>

        {(selectedState || selectedDistrict || selectedSector || selectedClassification) && (
          <button type="button" className="btn-reset-filters" onClick={resetFilters}>
            <span>✕</span> {t('common.resetFilters')}
          </button>
        )}
      </section>

      {/* Loading / Error States */}
      {errorMessage ? (
        <ErrorAlert message={errorMessage} onRetry={executeGapFetch} />
      ) : isLoading ? (
        <LoadingSpinner message={t('app.loading')} />
      ) : (
        <>
          {/* Summary Metric Cards */}
          <section className="stats-cards-row">
            <div className="stat-card demand-pressure">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('class.demandPressure')}</span>
                <span className="stat-card-icon"><Icon name="zap" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--status-demand-text)' }}>
                {summaryMetrics.demandCount}
              </div>
              <div className="stat-card-meta">
                {t('gap.scoreThresholdPos')}
              </div>
              <div className="stat-card-subtext">
                {t('gap.demandCardSubtext')}
              </div>
            </div>

            <div className="stat-card supply-pressure">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('class.supplyPressure')}</span>
                <span className="stat-card-icon"><Icon name="package" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--status-supply-text)' }}>
                {summaryMetrics.supplyCount}
              </div>
              <div className="stat-card-meta">
                {t('gap.scoreThresholdNeg')}
              </div>
              <div className="stat-card-subtext">
                {t('gap.supplyCardSubtext')}
              </div>
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('class.balanced')} / Monitor</span>
                <span className="stat-card-icon"><Icon name="scale" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--status-success-text)' }}>
                {summaryMetrics.balancedCount}
              </div>
              <div className="stat-card-meta">
                {t('gap.neutralBand')}
              </div>
              <div className="stat-card-subtext">
                {t('gap.balancedCardSubtext')}
              </div>
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('gap.totalPairs')}</span>
                <span className="stat-card-icon"><Icon name="file-text" size={16} /></span>
              </div>
              <div className="stat-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {summaryMetrics.total}
              </div>
              <div className="stat-card-meta">
                {t('gap.filteredCases')}
              </div>
              <div className="stat-card-subtext">
                {t('common.reportingPeriod')}: {period}
              </div>
            </div>
          </section>

          {/* Sortable Gap Ranking Table */}
          <section className="card-panel">
            <div className="card-panel-header">
              <div className="card-title-group">
                <h2>{t('gap.tableTitle')}</h2>
                <p>{t('gap.tableSubtitle')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('common.showingRecords', { count: sortedResults.length })}
                </span>
                <button
                  type="button"
                  className="btn-export"
                  disabled={sortedResults.length === 0}
                  onClick={handleExportCsv}
                  title={t('common.exportCsv')}
                >
                  <Icon name="download" size={14} />
                  <span>{t('common.exportCsv')}</span>
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="th-sortable" onClick={() => handleSort('occupation_title')}>
                      {t('table.occupationSector', 'Occupation & Sector')} {sortField === 'occupation_title' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('district_name')}>
                      {t('table.districtState', 'District / State')} {sortField === 'district_name' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('demand_index_score')}
                      title="Demand Composite Score (0–100): Weighted multi-signal demand index synthesizing posting volume (30%), demand growth (25%), vacancy persistence (15%), employer diversity (15%), and wage attractiveness (15%)."
                    >
                      {t('gap.thDemandComposite')} {sortField === 'demand_index_score' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('supply_output_index')}
                      title="Supply Output Rank (0–100): Cross-sectional percentile rank of trailing 3-month certification volume across all regional pilot series in this period."
                    >
                      {t('gap.thSupplyRank')} {sortField === 'supply_output_index' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('relative_mismatch_score')}
                      title="Current-Period Relative Mismatch Score = Demand Composite Score (0–100) − Supply Output Percentile Rank (0–100). Range: −100 to +100 points."
                    >
                      {t('gap.thMismatch')} {sortField === 'relative_mismatch_score' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" onClick={() => handleSort('classification')}>
                      {t('common.classification')} {sortField === 'classification' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" style={{ textAlign: 'center' }} onClick={() => handleSort('index_data_coverage_pct')}>
                      {t('gap.indexCoverage')} {sortField === 'index_data_coverage_pct' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th style={{ width: '80px', textAlign: 'center' }}>{t('common.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        {t('common.noData', 'No records match the selected filter criteria.')}
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((row) => {
                      const rowKey = `${row.district_id}-${row.occupation_id}`;
                      const isSelected = selectedRowId === rowKey;
                      const mismatchVal = row.relative_mismatch_score;
                      const isPositive = mismatchVal > 0;
                      const localizedClassification = row.classification === 'Demand Pressure'
                        ? t('class.demandPressure')
                        : row.classification === 'Supply Pressure'
                        ? t('class.supplyPressure')
                        : t('class.balanced');

                      return (
                        <tr
                          key={rowKey}
                          className={`clickable-row ${isSelected ? 'selected-row' : ''}`}
                          onClick={() => setSelectedRowId(rowKey)}
                        >
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
                              {row.demand_index_score.toFixed(1)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="score-pill supply">
                              {row.supply_output_index.toFixed(1)}
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
                            <span className={`badge-classification ${getClassificationBadgeClass(row.classification)}`}>
                              {localizedClassification}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal-700)' }}>
                              {(row.index_data_coverage_pct || row.data_coverage_pct || 100).toFixed(0)}%
                            </span>
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
                                setSelectedRowId(rowKey);
                              }}
                            >
                              {isSelected ? t('common.viewing') : t('common.inspect')}
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

          {/* Detailed Inspection View Panel for Selected Row */}
          {selectedItem && (
            <section className="inspection-drawer">
              <div className="inspection-header">
                <div className="inspection-title-block">
                  <h3>
                    {isHindi ? 'सापेक्ष अंतर निदान:' : 'Relative Gap Diagnostics:'} {selectedItem.occupation_title} ({getDistrictDisplayName(selectedItem.district_name, isHindi)}, {getStateDisplayName(selectedItem.state_code, isHindi)})
                  </h3>
                  <p>
                    {t('common.classification')}: {selectedItem.classification === 'Demand Pressure' ? t('class.demandPressure') : selectedItem.classification === 'Supply Pressure' ? t('class.supplyPressure') : t('class.balanced')} • {t('gap.relativeMismatchScore')}: {formatMismatch(selectedItem.relative_mismatch_score)} {t('common.pts')} ({t('gap.thDemandComposite')}: {selectedItem.demand_index_score.toFixed(1)} vs {t('gap.thSupplyRank')}: {selectedItem.supply_output_index.toFixed(1)})
                  </p>
                </div>
                <button
                  type="button"
                  className="inspection-close-btn"
                  onClick={() => setSelectedRowId(null)}
                >
                  {t('gap.closeDiagnostics')}
                </button>
              </div>

              <div className="inspection-body">
                {/* Section A: Certification Throughput Metrics */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                    {t('gap.section1Title')}
                  </h4>
                  <div className="funnel-grid">
                    <div className="funnel-card highlight">
                      <span className="funnel-header">{t('gap.certVolume3m')}</span>
                      <span className="funnel-rate-value" style={{ color: 'var(--teal-800)' }}>
                        {selectedItem.throughput?.certifications_3m ?? t('common.na')}
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}> {t('gap.certifiedCandidates')}</span>
                      </span>
                      <span className="funnel-subtext" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {t('gap.window')} {selectedItem.throughput?.window_periods_3m?.join(', ') || 'Recent 3 months'}
                      </span>
                    </div>

                    <div className="funnel-card">
                      <span className="funnel-header">{t('gap.certVolume6m')}</span>
                      <span className="funnel-rate-value">
                        {selectedItem.throughput?.certifications_6m ?? t('common.na')}
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}> {t('gap.certifiedCandidates')}</span>
                      </span>
                      <span className="funnel-subtext" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {t('gap.window')} {selectedItem.throughput?.window_periods_6m?.slice(0, 3).join(', ')}... (6 months)
                      </span>
                    </div>

                    <div className="funnel-card">
                      <span className="funnel-header">{t('gap.supplyOutputRank')}</span>
                      <span className="funnel-rate-value">
                        {selectedItem.supply_output_index.toFixed(1)}
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}> /100</span>
                      </span>
                      <span className="funnel-subtext" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {isHindi
                          ? 'सभी क्षेत्रीय पायलट श्रृंखलाओं में 3-माह के प्रमाणीकरण थ्रूपुट का क्रॉस-सेक्शनल पर्सेंटाइल रैंक'
                          : 'Cross-sectional percentile rank of trailing 3-month certification volume across all pilot series'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B: Cohort Training Funnel Efficiency */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                    {t('gap.section2Title')}
                  </h4>
                  <div className="funnel-grid">
                    {/* Seat Utilisation Rate */}
                    {selectedItem.funnel_rates?.seat_utilization_rate && (
                      <div className="funnel-card">
                        <span className="funnel-header">{t('gap.seatUtilization')}</span>
                        <span className="funnel-rate-value">
                          {(selectedItem.funnel_rates.seat_utilization_rate.value * 100).toFixed(1)}%
                        </span>
                        <span className="funnel-formula">
                          {t('gap.formula')} {selectedItem.funnel_rates.seat_utilization_rate.formula}
                        </span>
                        <span className="funnel-counts">
                          {t('gap.enrolledSanctioned', {
                            n: selectedItem.funnel_rates.seat_utilization_rate.numerator,
                            d: selectedItem.funnel_rates.seat_utilization_rate.denominator_value,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Completion Rate */}
                    {selectedItem.funnel_rates?.completion_rate && (
                      <div className="funnel-card">
                        <span className="funnel-header">{t('gap.courseCompletion')}</span>
                        <span className="funnel-rate-value">
                          {(selectedItem.funnel_rates.completion_rate.value * 100).toFixed(1)}%
                        </span>
                        <span className="funnel-formula">
                          {t('gap.formula')} {selectedItem.funnel_rates.completion_rate.formula}
                        </span>
                        <span className="funnel-counts">
                          {t('gap.completedEnrolled', {
                            n: selectedItem.funnel_rates.completion_rate.numerator,
                            d: selectedItem.funnel_rates.completion_rate.denominator_value,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Certification Rate */}
                    {selectedItem.funnel_rates?.certification_rate && (
                      <div className="funnel-card">
                        <span className="funnel-header">{t('gap.assessmentCertification')}</span>
                        <span className="funnel-rate-value">
                          {(selectedItem.funnel_rates.certification_rate.value * 100).toFixed(1)}%
                        </span>
                        <span className="funnel-formula">
                          {t('gap.formula')} {selectedItem.funnel_rates.certification_rate.formula}
                        </span>
                        <span className="funnel-counts">
                          {t('gap.certifiedCompleted', {
                            n: selectedItem.funnel_rates.certification_rate.numerator,
                            d: selectedItem.funnel_rates.certification_rate.denominator_value,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Placement Rate with 90-Day Follow-Up Safeguard */}
                    <div className="funnel-card">
                      <span className="funnel-header">{t('gap.placementTracking')}</span>
                      {selectedItem.funnel_rates?.placement_rate?.value !== null && selectedItem.funnel_rates?.placement_rate?.value !== undefined ? (
                        <>
                          <span className="funnel-rate-value">
                            {(selectedItem.funnel_rates.placement_rate.value * 100).toFixed(1)}%
                          </span>
                          <span className="badge-matured-followup">
                            {t('gap.maturedCohort', {
                              n: selectedItem.funnel_rates.placement_rate.numerator,
                              d: selectedItem.funnel_rates.placement_rate.denominator_value,
                            })}
                          </span>
                        </>
                      ) : (
                        <>
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="badge-pending-followup">
                              {t('gap.pendingFollowup')}
                            </span>
                          </div>
                          <span className="funnel-subtext" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                            {t('gap.pendingFollowupNote')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section C: Principal Explanatory Factors & Coverage */}
                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {t('gap.primaryDrivers')}
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {selectedItem.explanatory_factors?.map((factor, fIdx) => (
                      <li key={fIdx}>{formatExplanatoryFactor(factor, isHindi)}</li>
                    ))}
                  </ul>

                  <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <strong>{t('gap.inputCoverage')}</strong> {(selectedItem.index_data_coverage_pct || selectedItem.data_coverage_pct || 100).toFixed(0)}% •
                    {' '}{t('gap.missingSignals')} {selectedItem.missing_index_signals?.length === 0 ? t('gap.noneComplete') : selectedItem.missing_index_signals.join(', ')} •
                    {' '}{t('gap.trackingWindow')}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Methodology & Threshold Disclosures */}
          <section className="callout-box">
            <h4>
              <Icon name="info" size={16} />
              <span>{t('gap.methodologyTitle')}</span>
            </h4>
            <p>
              <strong>{t('gap.methodologyFormulaTitle')}</strong> {t('gap.methodologyFormulaText')}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('gap.methodologyDistinctionTitle')}</strong> {t('gap.methodologyDistinctionText')}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('gap.methodologyThresholdTitle')}</strong> {t('gap.methodologyThresholdText')}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{t('gap.methodologyPlacementTitle')}</strong> {t('gap.methodologyPlacementText')}
            </p>
            <p style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <strong>{t('gap.methodologySyntheticTitle')}</strong> {t('gap.methodologySyntheticText')}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
