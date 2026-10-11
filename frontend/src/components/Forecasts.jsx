import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import { fetchForecasts } from '../api/client';
import { exportTableToCsv } from '../utils/exportCsv';
import { useLanguage } from '../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
} from '../i18n/translations';
import ForecastTimeSeriesChart from './ForecastTimeSeriesChart';

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

export default function Forecasts({ period = '2026-09', onPeriodChange }) {
  const { t, isHindi } = useLanguage();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Filters
  const [selectedHorizon, setSelectedHorizon] = useState(3);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSector, setSelectedSector] = useState('');

  // Selected row for Detail Drawer
  const [selectedRowId, setSelectedRowId] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('projected_mismatch_score');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [activeTrendSeries, setActiveTrendSeries] = useState('demand'); // 'demand' | 'supply'


  const executeForecastFetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchForecasts({
        period,
        horizon: selectedHorizon,
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
      setErrorMessage(err.message || 'Unable to load Forecasts from backend service.');
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedHorizon, selectedState, selectedDistrict, selectedSector]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const res = await fetchForecasts({
          period,
          horizon: selectedHorizon,
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
        setErrorMessage(err.message || 'Unable to load Forecasts from backend service.');
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
  }, [period, selectedHorizon, selectedState, selectedDistrict, selectedSector]);

  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    if (newState && selectedDistrict) {
      const match = DISTRICTS.find((d) => d.id === selectedDistrict && d.state === newState);
      if (!match) setSelectedDistrict('');
    }
  };

  const resetFilters = () => {
    setSelectedHorizon(3);
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedSector('');
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

  // Client-side sorting
  const sortedResults = useMemo(() => {
    if (!data?.results) return [];
    return [...data.results].sort((a, b) => {
      let aVal;
      let bVal;

      if (sortField === 'projected_mismatch_score') {
        aVal = a.projected_mismatch?.projected_mismatch_score;
        bVal = b.projected_mismatch?.projected_mismatch_score;
      } else if (sortField === 'forecast_demand_rank') {
        aVal = a.projected_mismatch?.forecast_demand_rank;
        bVal = b.projected_mismatch?.forecast_demand_rank;
      } else if (sortField === 'forecast_supply_rank') {
        aVal = a.projected_mismatch?.forecast_supply_rank;
        bVal = b.projected_mismatch?.forecast_supply_rank;
      } else if (sortField === 'demand_point_forecast') {
        aVal = a.demand_forecast?.point_forecast_integer;
        bVal = b.demand_forecast?.point_forecast_integer;
      } else if (sortField === 'supply_point_forecast') {
        aVal = a.supply_forecast?.point_forecast;
        bVal = b.supply_forecast?.point_forecast;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = aVal === null || aVal === undefined ? -999999 : Number(aVal);
      bVal = bVal === null || bVal === undefined ? -999999 : Number(bVal);
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExportForecasts = useCallback(() => {
    if (!sortedResults || sortedResults.length === 0) return;

    const columns = isHindi
      ? [
          { key: 'base_period', label: 'आधार अवधि (Base Period)' },
          { key: 'target_period', label: 'लक्षित पूर्वानुमान अवधि (Target Forecast Period)' },
          { key: 'horizon_months', label: 'पूर्वानुमान क्षितिज माह (Horizon Months)' },
          { key: 'state_code', label: 'राज्य कोड (State Code)' },
          { key: 'district_id', label: 'ज़िला कोड (District ID)' },
          { key: 'district_name', label: 'ज़िला नाम (District Name)' },
          { key: 'sector', label: 'उद्योग क्षेत्र (Industry Sector)' },
          { key: 'trade', label: 'व्यावसायिक ट्रेड (Vocational Trade)' },
          { key: 'occupation_id', label: 'व्यवसाय आईडी (Occupation ID)' },
          { key: 'occupation_title', label: 'व्यवसाय शीर्षक (Occupation Title)' },
          // Demand Forecast
          { key: 'demand_model', label: 'चयनित मांग मॉडल (Demand Model)', format: (_, r) => r.demand_forecast?.model_selected || '' },
          { key: 'demand_observed_history', label: 'मांग प्रेक्षित इतिहास (सिंथेटिक) (Demand Observed History)', format: (_, r) => r.demand_forecast?.last_observed_value ?? '' },
          { key: 'demand_forecast_postings', label: 'पूर्वानुमानित ऑनलाइन जॉब विज्ञापन (Forecast Postings)', format: (_, r) => r.demand_forecast?.point_forecast_integer ?? '' },
          { key: 'demand_lower', label: 'मांग 80% अंतराल निचली सीमा (Demand Lower Bound)', format: (_, r) => r.demand_forecast?.prediction_interval_lower ?? '' },
          { key: 'demand_upper', label: 'मांग 80% अंतराल ऊपरी सीमा (Demand Upper Bound)', format: (_, r) => r.demand_forecast?.prediction_interval_upper ?? '' },
          { key: 'demand_mae', label: 'मांग बैकटेस्ट MAE (Demand Backtest MAE)', format: (_, r) => (r.demand_forecast?.backtest_mae != null ? Number(r.demand_forecast.backtest_mae).toFixed(2) : '') },
          { key: 'demand_wape', label: 'मांग बैकटेस्ट WAPE (Demand Backtest WAPE)', format: (_, r) => (r.demand_forecast?.backtest_wape != null ? (Number(r.demand_forecast.backtest_wape) * 100).toFixed(1) + '%' : '') },
          // Supply Forecast
          { key: 'supply_model', label: 'चयनित आपूर्ति मॉडल (Supply Model)', format: (_, r) => r.supply_forecast?.model_selected || '' },
          { key: 'supply_observed_history', label: 'आपूर्ति प्रेक्षित इतिहास (सिंथेटिक) (Supply Observed History)', format: (_, r) => (r.supply_forecast?.last_observed_value != null ? Number(r.supply_forecast.last_observed_value).toFixed(1) : '') },
          { key: 'supply_forecast_throughput', label: 'पूर्वानुमानित प्रमाणित आउटपुट (Forecast Throughput /mo)', format: (_, r) => (r.supply_forecast?.point_forecast != null ? Number(r.supply_forecast.point_forecast).toFixed(1) : '') },
          { key: 'supply_lower', label: 'आपूर्ति 80% अंतराल निचली सीमा (Supply Lower Bound)', format: (_, r) => (r.supply_forecast?.prediction_interval_lower != null ? Number(r.supply_forecast.prediction_interval_lower).toFixed(1) : '') },
          { key: 'supply_upper', label: 'आपूर्ति 80% अंतराल ऊपरी सीमा (Supply Upper Bound)', format: (_, r) => (r.supply_forecast?.prediction_interval_upper != null ? Number(r.supply_forecast.prediction_interval_upper).toFixed(1) : '') },
          { key: 'supply_mae', label: 'आपूर्ति बैकटेस्ट MAE (Supply Backtest MAE)', format: (_, r) => (r.supply_forecast?.backtest_mae != null ? Number(r.supply_forecast.backtest_mae).toFixed(2) : '') },
          { key: 'supply_wape', label: 'आपूर्ति बैकटेस्ट WAPE (Supply Backtest WAPE)', format: (_, r) => (r.supply_forecast?.backtest_wape != null ? (Number(r.supply_forecast.backtest_wape) * 100).toFixed(1) + '%' : '') },
          // Projected Mismatch & Ranks
          { key: 'demand_rank', label: 'पूर्वानुमान मांग रैंक (Forecast Demand Rank 0-100)', format: (_, r) => (r.projected_mismatch?.forecast_demand_rank != null ? Number(r.projected_mismatch.forecast_demand_rank).toFixed(1) : '') },
          { key: 'supply_rank', label: 'पूर्वानुमान आपूर्ति रैंक (Forecast Supply Rank 0-100)', format: (_, r) => (r.projected_mismatch?.forecast_supply_rank != null ? Number(r.projected_mismatch.forecast_supply_rank).toFixed(1) : '') },
          { key: 'projected_mismatch_score', label: 'प्रत्याशित सापेक्ष असंतुलन स्कोर (Projected Mismatch Score -100 to +100)', format: (_, r) => (r.projected_mismatch?.projected_mismatch_score != null ? Number(r.projected_mismatch.projected_mismatch_score).toFixed(2) : '') },
          { key: 'classification', label: 'प्रत्याशित असंतुलन नीतिगत वर्गीकरण (Classification)', format: (_, r) => r.projected_mismatch?.classification || '' },
          // Benchmark Ratio
          { key: 'benchmark_ratio', label: 'प्रशिक्षण-से-विज्ञापन मानक अनुपात (Benchmark Ratio per 100 Postings)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          // Metadata
          { key: 'data_coverage_pct', label: 'डेटा कवरेज (Data Coverage %)', format: (val) => (val != null ? Number(val).toFixed(0) + '%' : '100%') },
          { key: 'is_synthetic', label: 'सिंथेटिक पायलट ध्वज (Synthetic Pilot Flag)', format: () => 'TRUE' },
        ]
      : [
          { key: 'base_period', label: 'Base Period' },
          { key: 'target_period', label: 'Target Forecast Period' },
          { key: 'horizon_months', label: 'Forecast Horizon (Months)' },
          { key: 'state_code', label: 'State Code' },
          { key: 'district_id', label: 'District ID' },
          { key: 'district_name', label: 'District Name' },
          { key: 'sector', label: 'Industry Sector' },
          { key: 'trade', label: 'Vocational Trade' },
          { key: 'occupation_id', label: 'Occupation ID' },
          { key: 'occupation_title', label: 'Occupation Title' },
          // Demand Forecast
          { key: 'demand_model', label: 'Demand Model Selected', format: (_, r) => r.demand_forecast?.model_selected || '' },
          { key: 'demand_observed_history', label: 'Demand Observed History (Synthetic)', format: (_, r) => r.demand_forecast?.last_observed_value ?? '' },
          { key: 'demand_forecast_postings', label: 'Forecast Online Postings (Integer)', format: (_, r) => r.demand_forecast?.point_forecast_integer ?? '' },
          { key: 'demand_lower', label: 'Demand 80% Interval Lower Bound', format: (_, r) => r.demand_forecast?.prediction_interval_lower ?? '' },
          { key: 'demand_upper', label: 'Demand 80% Interval Upper Bound', format: (_, r) => r.demand_forecast?.prediction_interval_upper ?? '' },
          { key: 'demand_mae', label: 'Demand Backtest MAE', format: (_, r) => (r.demand_forecast?.backtest_mae != null ? Number(r.demand_forecast.backtest_mae).toFixed(2) : '') },
          { key: 'demand_wape', label: 'Demand Backtest WAPE', format: (_, r) => (r.demand_forecast?.backtest_wape != null ? (Number(r.demand_forecast.backtest_wape) * 100).toFixed(1) + '%' : '') },
          // Supply Forecast
          { key: 'supply_model', label: 'Supply Model Selected', format: (_, r) => r.supply_forecast?.model_selected || '' },
          { key: 'supply_observed_history', label: 'Supply Observed History (Synthetic)', format: (_, r) => (r.supply_forecast?.last_observed_value != null ? Number(r.supply_forecast.last_observed_value).toFixed(1) : '') },
          { key: 'supply_forecast_throughput', label: 'Forecast Certified Throughput (/mo)', format: (_, r) => (r.supply_forecast?.point_forecast != null ? Number(r.supply_forecast.point_forecast).toFixed(1) : '') },
          { key: 'supply_lower', label: 'Supply 80% Interval Lower Bound', format: (_, r) => (r.supply_forecast?.prediction_interval_lower != null ? Number(r.supply_forecast.prediction_interval_lower).toFixed(1) : '') },
          { key: 'supply_upper', label: 'Supply 80% Interval Upper Bound', format: (_, r) => (r.supply_forecast?.prediction_interval_upper != null ? Number(r.supply_forecast.prediction_interval_upper).toFixed(1) : '') },
          { key: 'supply_mae', label: 'Supply Backtest MAE', format: (_, r) => (r.supply_forecast?.backtest_mae != null ? Number(r.supply_forecast.backtest_mae).toFixed(2) : '') },
          { key: 'supply_wape', label: 'Supply Backtest WAPE', format: (_, r) => (r.supply_forecast?.backtest_wape != null ? (Number(r.supply_forecast.backtest_wape) * 100).toFixed(1) + '%' : '') },
          // Projected Mismatch & Ranks
          { key: 'demand_rank', label: 'Forecast Demand Postings Rank (0-100)', format: (_, r) => (r.projected_mismatch?.forecast_demand_rank != null ? Number(r.projected_mismatch.forecast_demand_rank).toFixed(1) : '') },
          { key: 'supply_rank', label: 'Forecast Supply Throughput Rank (0-100)', format: (_, r) => (r.projected_mismatch?.forecast_supply_rank != null ? Number(r.projected_mismatch.forecast_supply_rank).toFixed(1) : '') },
          { key: 'projected_mismatch_score', label: 'Projected Relative Mismatch Score (-100 to +100)', format: (_, r) => (r.projected_mismatch?.projected_mismatch_score != null ? Number(r.projected_mismatch.projected_mismatch_score).toFixed(2) : '') },
          { key: 'classification', label: 'Projected Mismatch Policy Classification', format: (_, r) => r.projected_mismatch?.classification || '' },
          // Benchmark Ratio
          { key: 'benchmark_ratio', label: 'Training-to-Posting Benchmark Ratio (per 100 Postings)', format: (val) => (val != null ? Number(val).toFixed(1) : '') },
          // Metadata
          { key: 'data_coverage_pct', label: 'Data Coverage (%)', format: (val) => (val != null ? Number(val).toFixed(0) + '%' : '100%') },
          { key: 'is_synthetic', label: 'Synthetic Pilot Flag', format: () => 'TRUE' },
        ];

    const filterDescriptor = [
      period,
      `h${selectedHorizon}`,
      selectedState,
      selectedDistrict,
      selectedSector,
    ].filter(Boolean).join('-');

    const filename = `skillpulse-forecasts-${filterDescriptor}.csv`;

    const disclaimers = isHindi
      ? [
          'डेटा स्रोत: SIH26246 के लिए सिंथेटिक प्रदर्शन डेटासेट (आधिकारिक आंकड़े नहीं)। सभी पूर्वानुमान मेट्रिक्स प्रायोगिक प्रेक्षणों पर परिकलित हैं।',
          'प्रत्याशित असंतुलन सूत्र: पूर्वानुमान मांग विज्ञापन रैंक (0-100) − पूर्वानुमान आपूर्ति थ्रूपुट रैंक (0-100)। सीमा: -100 से +100 अंक।',
          'मेट्रिक भेद: प्रत्याशित असंतुलन एकल-मात्रा विज्ञापन रैंक बनाम थ्रूपुट रैंक का मूल्यांकन करता है, जो वर्तमान अंतर विश्लेषण बहु-संकेत मांग सूचकांक से भिन्न है।',
          'प्रशिक्षण-से-विज्ञापन मानक अनुपात: (पूर्वानुमान आपूर्ति थ्रूपुट / पूर्वानुमान मांग विज्ञापन) × 100। प्रति 100 ऑनलाइन विज्ञापनों पर प्रमाणित उम्मीदवारों के रूप में व्यक्त।',
          'वर्णनात्मक मानक सूचना: यह अनुपात एक प्रशासनिक मानक है जो विज्ञापनों के विरुद्ध थ्रूपुट की तुलना करता है। यह रिक्ति-पूर्ति दर या कौशल कमी का प्रमाण नहीं है।',
          'प्रेडिक्शन इंटरवल्स: 80% प्रेडिक्शन इंटरवल बिंदु पूर्वानुमान ± 1.282 × आउट-ऑफ़-सैंपल RMSE के रूप में परिकलित हैं।',
          'प्रोटोटाइप निर्णय सीमाएं: अलर्ट और वर्गीकरण प्रोटोटाइप ह्युरिस्टिक सीमाओं (±15) पर संचालित होते हैं, न कि अनुभवजन्य रूप से कैलिब्रेट किए गए नीति नियमों पर।',
        ]
      : [
          'Data Provenance: Synthetic demonstration dataset for SIH26246 (not official statistics). All forecast metrics are computed on synthetic pilot observations.',
          'Projected Mismatch Formula: Forecast Demand Postings Rank (0-100) - Forecast Supply Throughput Rank (0-100). Range: -100 to +100 points.',
          'Metric Distinction: Projected mismatch evaluates single-quantity posting ranks vs throughput ranks, differing from current-period Gap Analysis multi-signal demand composite.',
          'Training-to-Posting Benchmark Ratio: (Forecast Supply Throughput / Forecast Demand Postings) * 100. Expressed as certified candidates per 100 online postings.',
          'Descriptive Benchmark Notice: This ratio is an administrative benchmark comparing projected certification throughput against online postings. It is NOT an empirical vacancy-coverage rate, market clearance measure, or proof of a skill shortage.',
          'Prediction Intervals: 80% prediction intervals calculated as point forecast +/- 1.282 * out-of-sample RMSE based on 16 rolling-origin backtest residuals.',
          'Prototype Decision Thresholds: Alerts and classifications operate on prototype heuristic thresholds (±15), not empirically calibrated policy rules.',
        ];

    exportTableToCsv({
      filename,
      columns,
      rows: sortedResults,
      title: isHindi
        ? 'स्किलपल्स (SkillPulse LMIS) — समय-श्रृंखला कार्यबल मांग एवं आपूर्ति पूर्वानुमान निर्यात'
        : 'SkillPulse LMIS — Time-Series Workforce Demand & Supply Forecasts Export',
      metadata: isHindi
        ? {
            'डेटा स्रोत (Data Provenance)': 'SIH26246 के लिए सिंथेटिक प्रदर्शन डेटासेट (आधिकारिक आंकड़े नहीं)',
            'आधार रिपोर्टिंग अवधि (Base Period)': period,
            'पूर्वानुमान क्षितिज (Forecast Horizon)': `${selectedHorizon} माह आगे (+${selectedHorizon}M)`,
            'निर्यात समय (Export Timestamp)': new Date().toISOString(),
            'कुल फ़िल्टर रिकॉर्ड (Total Records)': String(sortedResults.length),
            'सक्रिय राज्य फ़िल्टर (Active State)': selectedState || 'सभी राज्य',
            'सक्रिय ज़िला फ़िल्टर (Active District)': selectedDistrict || 'सभी ज़िले',
            'सक्रिय क्षेत्र फ़िल्टर (Active Sector)': selectedSector || 'सभी क्षेत्र',
            'क्रमबद्ध फ़ील्ड (Sort Field)': sortField,
            'क्रमबद्ध दिशा (Sort Direction)': sortDirection,
          }
        : {
            'Data Provenance': 'Synthetic demonstration dataset for SIH26246 (not official statistics)',
            'Base Reporting Period': period,
            'Forecast Horizon': `${selectedHorizon} Months Ahead`,
            'Export Timestamp': new Date().toISOString(),
            'Total Filtered Records': String(sortedResults.length),
            'Active State Filter': selectedState || 'All States',
            'Active District Filter': selectedDistrict || 'All Districts',
            'Active Sector Filter': selectedSector || 'All Sectors',
            'Sort Field': sortField,
            'Sort Direction': sortDirection,
          },
      disclaimers,
    });
  }, [sortedResults, period, selectedHorizon, selectedState, selectedDistrict, selectedSector, sortField, sortDirection, isHindi]);

  const selectedItem = useMemo(() => {
    if (!selectedRowId || !data?.results) return null;
    return data.results.find((r) => `${r.district_id}-${r.occupation_id}` === selectedRowId) || null;
  }, [data, selectedRowId]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const list = data?.results || [];
    const validCount = list.filter((r) => r.demand_forecast?.status === 'valid' && r.supply_forecast?.status === 'valid').length;
    const insufficientCount = list.length - validCount;

    // Highest demand projection
    const highestDemandItem = list.length > 0
      ? list.reduce((max, cur) => {
          const curVal = cur.projected_mismatch?.forecast_demand_rank ?? 0;
          const maxVal = max?.projected_mismatch?.forecast_demand_rank ?? 0;
          return curVal > maxVal ? cur : max;
        }, list[0])
      : null;

    return {
      total: list.length,
      validCount,
      insufficientCount,
      highestDemandItem,
    };
  }, [data]);

  const formatMismatch = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const num = Number(val);
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}`;
  };

  const getClassificationBadgeClass = (classification) => {
    if (!classification) return 'balanced';
    if (classification.includes('Demand Pressure')) return 'demand-pressure';
    if (classification.includes('Supply Pressure')) return 'supply-pressure';
    return 'balanced';
  };

  const getModelLabel = (modelCode) => {
    switch (modelCode) {
      case 'linear_trend': return 'Linear Trend Model';
      case 'ma3': return '3-Month Moving Average';
      case 'naive': return 'Last-Observation (Naive)';
      default: return modelCode || 'Deterministic Baseline';
    }
  };

  const renderIntervalTrack = (lower, point, upper, observed, isPostings) => {
    if (lower == null || point == null || upper == null) {
      return (
        <div className="interval-visualizer">
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textAlign: 'center' }}>
            {isHindi ? 'प्रेडिक्शन इंटरवल उपलब्ध नहीं' : 'Prediction interval unavailable'}
          </div>
        </div>
      );
    }

    const minBound = Math.min(lower, observed != null ? observed : lower);
    const maxBound = Math.max(upper, observed != null ? observed : upper);
    const margin = Math.max((maxBound - minBound) * 0.1, 1);
    const domainMin = Math.max(0, minBound - margin);
    const domainMax = maxBound + margin;
    const span = domainMax - domainMin || 1;

    const lowerPct = Math.max(0, Math.min(100, ((lower - domainMin) / span) * 100));
    const upperPct = Math.max(0, Math.min(100, ((upper - domainMin) / span) * 100));
    const pointPct = Math.max(0, Math.min(100, ((point - domainMin) / span) * 100));
    const observedPct = observed != null ? Math.max(0, Math.min(100, ((observed - domainMin) / span) * 100)) : null;

    const fillLeft = lowerPct;
    const fillWidth = Math.max(2, upperPct - lowerPct);

    return (
      <div className="interval-visualizer" style={{ padding: '0.65rem 0.85rem' }}>
        <div className="interval-labels" style={{ fontSize: '0.72rem' }}>
          <span>
            {isHindi ? 'निचली (80%):' : 'Lower (80%):'} {isPostings ? Math.round(lower) : Number(lower).toFixed(1)}
          </span>
          <strong style={{ color: isPostings ? 'var(--teal-800)' : 'var(--slate-800)' }}>
            {isHindi ? 'बिंदु अनुमान:' : 'Point Forecast:'} {isPostings ? Math.round(point) : Number(point).toFixed(1)}
          </strong>
          <span>
            {isHindi ? 'ऊपरी (80%):' : 'Upper (80%):'} {isPostings ? Math.round(upper) : Number(upper).toFixed(1)}
          </span>
        </div>

        <div className="interval-range-track" style={{ position: 'relative', height: '10px', backgroundColor: 'var(--slate-200)', borderRadius: '9999px', overflow: 'visible', margin: '0.45rem 0' }}>
          {/* 80% Confidence Interval Fill */}
          <div
            className="interval-range-fill"
            style={{
              position: 'absolute',
              left: `${fillLeft}%`,
              width: `${fillWidth}%`,
              top: 0,
              bottom: 0,
              background: isPostings
                ? 'linear-gradient(90deg, #99f6e4, #0d9488)'
                : 'linear-gradient(90deg, #cbd5e1, #64748b)',
              borderRadius: '9999px',
            }}
            title={`80% Prediction Interval: [${lower}, ${upper}]`}
          />

          {/* Point Forecast Marker */}
          <div
            style={{
              position: 'absolute',
              left: `${pointPct}%`,
              top: '-3px',
              bottom: '-3px',
              width: '3px',
              backgroundColor: isPostings ? '#115e59' : '#1e293b',
              borderRadius: '2px',
              transform: 'translateX(-50%)',
              zIndex: 3,
            }}
            title={`Point Forecast: ${point}`}
          />

          {/* Observed History Marker (if within range) */}
          {observedPct != null && (
            <div
              style={{
                position: 'absolute',
                left: `${observedPct}%`,
                top: '-4px',
                bottom: '-4px',
                width: '3px',
                backgroundColor: '#f59e0b',
                borderRadius: '2px',
                transform: 'translateX(-50%)',
                zIndex: 2,
              }}
              title={`${isHindi ? 'प्रेक्षित इतिहास (सिंथेटिक)' : 'Observed History (Synthetic)'}: ${observed}`}
            />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
          {observed != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
              <span>{isHindi ? 'प्रेक्षित इतिहास:' : 'Observed History:'} {isPostings ? Math.round(observed) : Number(observed).toFixed(1)}</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: isPostings ? '#0d9488' : '#64748b', borderRadius: '2px' }}></span>
            <span>{isHindi ? '80% सांख्यिकीय अनिश्चितता बैंड' : '80% Statistical Uncertainty Band'}</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="overview-grid">
      {/* Page Intro Header Banner */}
      <div className="page-intro-header">
        <h1 className="page-intro-title">{t('forecasts.introTitle', 'SkillPulse Time-Series Forecasting Engine')}</h1>
        <p className="page-intro-desc">
          {t('forecasts.introDesc', 'Projects monthly online job postings and certified candidate throughput across 3, 6, and 12-month future horizons using rolling-origin backtested models (Naive, 3-Month Moving Average, Linear Trend). Calculates Projected Relative Mismatch = Forecast Demand Rank (0-100) - Forecast Supply Rank (0-100).')}
        </p>
      </div>

      {/* Filter Control Bar */}
      <section className="filter-bar-panel">
        <div className="filter-group">
          <label htmlFor="forecast-period" className="filter-label">{t('forecasts.thBasePeriod', 'Base Period')}</label>
          <select
            id="forecast-period"
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
          <label htmlFor="forecast-horizon" className="filter-label">{t('common.horizon', 'Forecast Horizon')}</label>
          <select
            id="forecast-horizon"
            className="filter-select"
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(Number(e.target.value))}
          >
            <option value={3}>{isHindi ? '3 माह आगे (अल्पकालिक)' : '3 Months Ahead (Short-Term)'}</option>
            <option value={6}>{isHindi ? '6 माह आगे (मध्यकालिक)' : '6 Months Ahead (Medium-Term)'}</option>
            <option value={12}>{isHindi ? '12 माह आगे (वार्षिक रणनीतिक)' : '12 Months Ahead (Strategic Annual)'}</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="forecast-state" className="filter-label">{t('common.state', 'State')}</label>
          <select
            id="forecast-state"
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
          <label htmlFor="forecast-district" className="filter-label">{t('common.district', 'District')}</label>
          <select
            id="forecast-district"
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="">{t('common.allDistricts', 'All Districts')} ({filteredDistricts.length})</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>{getDistrictDisplayName(d.name, isHindi)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="forecast-sector" className="filter-label">{t('common.sector', 'Sector')}</label>
          <select
            id="forecast-sector"
            className="filter-select"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <option value="">{t('common.allSectors', 'All Sectors (3)')} ({sectorOptions.length})</option>
            {sectorOptions.map((sec) => (
              <option key={sec} value={sec}>{getSectorDisplayName(sec, isHindi)}</option>
            ))}
          </select>
        </div>

        {(selectedHorizon !== 3 || selectedState || selectedDistrict || selectedSector) && (
          <button type="button" className="btn-reset-filters" onClick={resetFilters}>
            <span>✕</span> {t('common.resetFilters', 'Reset Filters')}
          </button>
        )}
      </section>

      {/* Loading / Error States */}
      {errorMessage ? (
        <ErrorAlert message={errorMessage} onRetry={executeForecastFetch} />
      ) : isLoading ? (
        <LoadingSpinner message={t('app.loading', 'Querying SkillPulse LMIS backend for reporting period...')} />
      ) : (
        <>
          {/* Summary Metric Cards */}
          <section className="stats-cards-row">
            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('common.horizon', 'Forecast Horizon')}</span>
                <span className="stat-card-icon">🔮</span>
              </div>
              <div className="stat-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                +{selectedHorizon}m
              </div>
              <div className="stat-card-meta">
                {isHindi ? 'लक्ष्य अवधि:' : 'Target:'} {data?.results?.[0]?.target_period || `+${selectedHorizon} months`}
              </div>
              <div className="stat-card-subtext">
                {t('forecasts.thBasePeriod', 'Base Period')}: {period} • Rolling Origin Backtest
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">{isHindi ? 'वैध पूर्वानुमान मॉडल' : 'Valid Forecast Models'}</span>
                <span className="stat-card-icon">✅</span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--teal-800)' }}>
                {summaryMetrics.validCount}
                <span style={{ fontSize: '0.9rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                  /{summaryMetrics.total}
                </span>
              </div>
              <div className="stat-card-meta">
                {isHindi ? 'चयनित डिटरमिनिस्टिक मॉडल' : 'Deterministic Model Selected'}
              </div>
              <div className="stat-card-subtext">
                {isHindi ? 'न्यूनतम इतिहास जांच उत्तीर्ण (T ≥ 6 माह)' : 'Passed minimum history check (T ≥ 6 months)'}
              </div>
            </div>

            <div className="stat-card neutral">
              <div className="stat-card-header">
                <span className="stat-card-title">{isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient History'}</span>
                <span className="stat-card-icon">⚠️</span>
              </div>
              <div className="stat-card-value" style={{ color: summaryMetrics.insufficientCount > 0 ? '#ea580c' : '#15803d' }}>
                {summaryMetrics.insufficientCount}
              </div>
              <div className="stat-card-meta">
                {isHindi ? 'गैर-मूल्यांकित श्रृंखलाएं' : 'Non-Evaluated Series'}
              </div>
              <div className="stat-card-subtext">
                {summaryMetrics.insufficientCount === 0 ? (isHindi ? 'पूर्ण 24-माह पायलट कवरेज' : 'Full 24-month pilot coverage') : (isHindi ? 'डेटा संग्रह हेतु चिह्नित' : 'Flagged for data collection')}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">{t('forecasts.highestDemandTitle', 'Top Projected Demand')}</span>
                <span className="stat-card-icon">📈</span>
              </div>
              {summaryMetrics.highestDemandItem ? (
                <>
                  <div className="stat-card-value">
                    {summaryMetrics.highestDemandItem.projected_mismatch?.forecast_demand_rank?.toFixed(1) ?? 'N/A'}
                    <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 500 }}> {isHindi ? 'पर्सेंटाइल' : 'percentile'}</span>
                  </div>
                  <div className="stat-card-meta">
                    {summaryMetrics.highestDemandItem.occupation_title}
                  </div>
                  <div className="stat-card-subtext">
                    {summaryMetrics.highestDemandItem.district_name}, {summaryMetrics.highestDemandItem.state_code}
                  </div>
                </>
              ) : (
                <div className="stat-card-subtext">{isHindi ? 'कोई रिकॉर्ड फ़िल्टर से मेल नहीं खाता' : 'No records meet filter criteria'}</div>
              )}
            </div>
          </section>

          {/* Sortable Forecasts Table */}
          <section className="card-panel">
            <div className="card-panel-header">
              <div className="card-title-group">
                <h2>{isHindi ? `क्रॉस-सेक्शनल कार्यबल अनुमान (${selectedHorizon}-माह क्षितिज)` : `Cross-Sectional Workforce Projections (${selectedHorizon}-Month Horizon)`}</h2>
                <p>{t('forecasts.tableSubtitle', 'Multi-horizon predictive mismatch indicators combining regression and time-series extrapolation.')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  {t('common.showingRecords', 'Showing {count} records', { count: sortedResults.length })}
                </span>
                <button
                  type="button"
                  className="btn-export"
                  disabled={sortedResults.length === 0}
                  onClick={handleExportForecasts}
                  title={t('common.exportCsv', 'Export CSV')}
                >
                  <span>📥</span>
                  <span>{t('common.exportCsv', 'Export CSV')}</span>
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
                    <th style={{ textAlign: 'center' }}>{t('forecasts.thTargetPeriod', 'Target Period')}</th>
                    <th className="th-sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('demand_point_forecast')}>
                      {t('forecasts.thDemandForecast', 'Forecast Postings')} {sortField === 'demand_point_forecast' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="th-sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('supply_point_forecast')}>
                      {t('forecasts.thSupplyForecast', 'Forecast Throughput')} {sortField === 'supply_point_forecast' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('forecast_demand_rank')}
                      title="Demand Rank (0–100): Cross-sectional percentile rank of point forecast online job postings."
                    >
                      {t('forecasts.thDemandRank', 'Demand Rank')} {sortField === 'forecast_demand_rank' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('forecast_supply_rank')}
                      title="Supply Rank (0–100): Cross-sectional percentile rank of point forecast certified candidate throughput."
                    >
                      {t('forecasts.thSupplyRank', 'Supply Rank')} {sortField === 'forecast_supply_rank' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th
                      className="th-sortable"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('projected_mismatch_score')}
                      title="Projected Relative Mismatch Score = Forecast Demand Postings Rank (0–100) − Forecast Supply Throughput Rank (0–100). Range: −100 to +100 points."
                    >
                      {t('forecasts.thProjectedMismatch', 'Projected Mismatch')} {sortField === 'projected_mismatch_score' && <span className="sort-icon">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th>{t('common.classification', 'Classification')}</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>{t('common.action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                        {t('common.noData', 'No forecast records match the selected filter criteria.')}
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((row) => {
                      const rowKey = `${row.district_id}-${row.occupation_id}`;
                      const isSelected = selectedRowId === rowKey;
                      const pm = row.projected_mismatch;
                      const mismatchVal = pm?.projected_mismatch_score;
                      const isPositive = mismatchVal !== null && mismatchVal !== undefined && mismatchVal > 0;
                      const localizedClassification = pm?.classification?.includes('Demand Pressure')
                        ? t('class.demandPressure', 'Demand Pressure')
                        : pm?.classification?.includes('Supply Pressure')
                        ? t('class.supplyPressure', 'Supply Pressure')
                        : t('class.balanced', 'Balanced');

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
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                            {row.target_period}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {row.demand_forecast?.status === 'valid' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--slate-900)' }}>
                                {row.demand_forecast.point_forecast_integer}
                                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 400 }}> {isHindi ? 'विज्ञापन' : 'jobs'}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>{isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient history'}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {row.supply_forecast?.status === 'valid' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--slate-700)' }}>
                                {row.supply_forecast.point_forecast?.toFixed(1)}
                                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 400 }}> {isHindi ? 'प्रमाणित' : 'certs'}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>{isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient history'}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="score-pill demand">
                              {pm?.forecast_demand_rank !== null && pm?.forecast_demand_rank !== undefined ? pm.forecast_demand_rank.toFixed(1) : 'N/A'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="score-pill supply">
                              {pm?.forecast_supply_rank !== null && pm?.forecast_supply_rank !== undefined ? pm.forecast_supply_rank.toFixed(1) : 'N/A'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {mismatchVal !== null && mismatchVal !== undefined ? (
                              <span
                                className={`score-pill ${isPositive ? 'positive' : 'negative'}`}
                                style={{
                                  backgroundColor: isPositive ? '#fff7ed' : '#eff6ff',
                                  border: `1px solid ${isPositive ? '#ffedd5' : '#dbeafe'}`,
                                }}
                              >
                                {formatMismatch(mismatchVal)}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td>
                            <span className={`badge-classification ${getClassificationBadgeClass(pm?.classification)}`}>
                              {localizedClassification}
                            </span>
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

          {/* Detailed Forecast Diagnostics Panel for Selected Record */}
          {selectedItem && (
            <section className="inspection-drawer">
              <div className="inspection-header">
                <div className="inspection-title-block">
                  <h3>
                    {isHindi ? 'पूर्वानुमान निदान:' : 'Forecast Diagnostics:'} {selectedItem.occupation_title} ({getDistrictDisplayName(selectedItem.district_name, isHindi)}, {getStateDisplayName(selectedItem.state_code, isHindi)})
                  </h3>
                  <p>
                    {t('forecasts.thTargetPeriod', 'Target Period')}: {selectedItem.target_period} (+{selectedItem.horizon_months} {isHindi ? 'माह' : 'Months'}) • {t('forecasts.thProjectedMismatch', 'Projected Mismatch')}: {formatMismatch(selectedItem.projected_mismatch?.projected_mismatch_score)} {t('common.pts')} ({selectedItem.projected_mismatch?.classification})
                  </p>
                </div>
                <button
                  type="button"
                  className="inspection-close-btn"
                  onClick={() => setSelectedRowId(null)}
                >
                  {isHindi ? '✕ विश्लेषण बंद करें' : '✕ Close Diagnostics'}
                </button>
              </div>

              <div className="inspection-body">
                {/* Check for Insufficient History State */}
                {selectedItem.demand_forecast?.status !== 'valid' || selectedItem.supply_forecast?.status !== 'valid' ? (
                  <div className="error-banner" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <div className="error-title">
                      <span>⚠️</span>
                      <span>{isHindi ? 'अपर्याप्त समय-श्रृंखला इतिहास' : 'Insufficient Time-Series History'}</span>
                    </div>
                    <div className="error-message">
                      {isHindi
                        ? `इस श्रृंखला के लिए उपलब्ध ऐतिहासिक अवलोकन विंडो अनुरोधित ${selectedItem.horizon_months}-माह के क्षितिज पर रोलिंग-ओरिजिन बैकटेस्टिंग करने के लिए अपर्याप्त है। कटऑफ से पहले कम से कम 6 अवलोकनों का प्रशिक्षण क्रम आवश्यक है। कोई बिंदु पूर्वानुमान निर्मित नहीं किया गया है।`
                        : `The available historical observation window for this series is insufficient to perform rolling-origin backtesting at the requested ${selectedItem.horizon_months}-month horizon. A minimum training sequence of 6 observations prior to origin cutoff is required. No point forecast is fabricated.`}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Grid of Diagnostics: Demand vs Supply Forecast */}
                    <div className="components-grid">
                      {/* Demand Forecast Diagnostic Card */}
                      <div className="component-card">
                        <div className="component-card-top">
                          <div>
                            <span className="component-name">{isHindi ? '1. जॉब-विज्ञापन मांग अनुमान' : '1. Job-Posting Demand Projection'}</span>
                            <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span className="model-badge">
                                {isHindi ? 'मॉडल:' : 'Model:'} {getModelLabel(selectedItem.demand_forecast?.model_selected)}
                              </span>
                              <span className="model-badge" style={{ backgroundColor: '#f1f5f9', color: 'var(--slate-700)' }}>
                                +{selectedItem.horizon_months}M ({selectedItem.target_period})
                              </span>
                            </div>
                          </div>
                          <span className={`uncertainty-badge ${selectedItem.demand_forecast?.uncertainty_evidence_status === 'adequate_sample' ? 'adequate' : 'limited'}`}>
                            {selectedItem.demand_forecast?.uncertainty_evidence_status === 'adequate_sample'
                              ? `${isHindi ? 'पर्याप्त नमूना' : 'Adequate Sample'} (N=${selectedItem.demand_forecast?.residual_sample_size ?? 'N/A'})`
                              : `${isHindi ? 'सीमित नमूना' : 'Limited Sample'} (N=${selectedItem.demand_forecast?.residual_sample_size ?? 'N/A'})`}
                          </span>
                        </div>

                        {/* Observed History vs Forecast Point Side-by-Side Comparison */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.5rem 0', padding: '0.5rem 0.65rem', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                          <div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                              {t('forecasts.observedHistorySynthetic', 'Observed History (Synthetic)')}
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-700)', fontFamily: 'var(--font-mono)' }}>
                              {selectedItem.demand_forecast?.last_observed_value ?? 'N/A'}
                              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--slate-500)' }}> {isHindi ? 'विज्ञापन' : 'postings'}</span>
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-400)' }}>
                              {isHindi ? 'आधार अवधि:' : 'Base:'} {selectedItem.base_period}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                              {t('forecasts.pointForecastLabel', 'Point Forecast')}
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--teal-800)', fontFamily: 'var(--font-mono)' }}>
                              {selectedItem.demand_forecast?.point_forecast_integer ?? 'N/A'}
                              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--teal-600)' }}> {isHindi ? 'विज्ञापन' : 'postings'}</span>
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--teal-600)' }}>
                              {isHindi ? 'लक्षित अवधि:' : 'Target:'} {selectedItem.target_period} (+{selectedItem.horizon_months}M)
                            </div>
                          </div>
                        </div>

                        <div className="component-value-row" style={{ marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                            {isHindi ? 'क्रॉस-सेक्शनल पर्सेंटाइल:' : 'Cross-Sectional Rank:'}
                          </span>
                          <span className="component-score-val">
                            {t('common.rank', 'Rank')}: {selectedItem.projected_mismatch?.forecast_demand_rank !== null && selectedItem.projected_mismatch?.forecast_demand_rank !== undefined ? selectedItem.projected_mismatch.forecast_demand_rank.toFixed(1) : 'N/A'}/100
                          </span>
                        </div>

                        {/* Accurate 80% Prediction Interval Visualizer */}
                        {renderIntervalTrack(
                          selectedItem.demand_forecast?.prediction_interval_lower,
                          selectedItem.demand_forecast?.point_forecast_integer,
                          selectedItem.demand_forecast?.prediction_interval_upper,
                          selectedItem.demand_forecast?.last_observed_value,
                          true
                        )}

                        <div className="component-subtext" style={{ marginTop: '0.4rem' }}>
                          <strong>{isHindi ? 'बैकटेस्टिंग त्रुटि:' : 'Backtesting Error:'}</strong> MAE = {selectedItem.demand_forecast?.backtest_mae !== null && selectedItem.demand_forecast?.backtest_mae !== undefined ? selectedItem.demand_forecast.backtest_mae.toFixed(2) : 'N/A'} {isHindi ? 'विज्ञापन' : 'postings'} • WAPE = {selectedItem.demand_forecast?.backtest_wape !== null && selectedItem.demand_forecast?.backtest_wape !== undefined ? `${(selectedItem.demand_forecast.backtest_wape * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="component-subtext" style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                          ℹ️ {t('forecasts.predictionIntervalNote', 'The 80% prediction interval represents statistical model uncertainty based on backtest residuals, not a guaranteed policy or market outcome.')}
                        </div>
                        <div className="component-subtext" style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginTop: '0.15rem' }}>
                          <em>{selectedItem.demand_forecast?.interval_disclaimer || 'Normal error distribution approximation on out-of-sample RMSE.'}</em>
                        </div>
                      </div>

                      {/* Supply Throughput Diagnostic Card */}
                      <div className="component-card">
                        <div className="component-card-top">
                          <div>
                            <span className="component-name">{isHindi ? '2. प्रमाणीकरण आउटपुट आपूर्ति अनुमान' : '2. Certification Throughput Projection'}</span>
                            <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span className="model-badge">
                                {isHindi ? 'मॉडल:' : 'Model:'} {getModelLabel(selectedItem.supply_forecast?.model_selected)}
                              </span>
                              <span className="model-badge" style={{ backgroundColor: '#f1f5f9', color: 'var(--slate-700)' }}>
                                +{selectedItem.horizon_months}M ({selectedItem.target_period})
                              </span>
                            </div>
                          </div>
                          <span className={`uncertainty-badge ${selectedItem.supply_forecast?.uncertainty_evidence_status === 'adequate_sample' ? 'adequate' : 'limited'}`}>
                            {selectedItem.supply_forecast?.uncertainty_evidence_status === 'adequate_sample'
                              ? `${isHindi ? 'पर्याप्त नमूना' : 'Adequate Sample'} (N=${selectedItem.supply_forecast?.residual_sample_size ?? 'N/A'})`
                              : `${isHindi ? 'सीमित नमूना' : 'Limited Sample'} (N=${selectedItem.supply_forecast?.residual_sample_size ?? 'N/A'})`}
                          </span>
                        </div>

                        {/* Observed History vs Forecast Point Side-by-Side Comparison */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.5rem 0', padding: '0.5rem 0.65rem', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                          <div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                              {t('forecasts.observedHistorySynthetic', 'Observed History (Synthetic)')}
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-700)', fontFamily: 'var(--font-mono)' }}>
                              {selectedItem.supply_forecast?.last_observed_value != null ? selectedItem.supply_forecast.last_observed_value.toFixed(1) : 'N/A'}
                              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--slate-500)' }}> {isHindi ? 'उम्मीदवार' : 'candidates'}</span>
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-400)' }}>
                              {isHindi ? 'आधार अवधि:' : 'Base:'} {selectedItem.base_period}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                              {t('forecasts.pointForecastLabel', 'Point Forecast')}
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-800)', fontFamily: 'var(--font-mono)' }}>
                              {selectedItem.supply_forecast?.point_forecast !== null && selectedItem.supply_forecast?.point_forecast !== undefined ? selectedItem.supply_forecast.point_forecast.toFixed(1) : 'N/A'}
                              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--slate-600)' }}> {isHindi ? 'उम्मीदवार' : 'candidates'}</span>
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--slate-600)' }}>
                              {isHindi ? 'लक्षित अवधि:' : 'Target:'} {selectedItem.target_period} (+{selectedItem.horizon_months}M)
                            </div>
                          </div>
                        </div>

                        <div className="component-value-row" style={{ marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                            {isHindi ? 'क्रॉस-सेक्शनल पर्सेंटाइल:' : 'Cross-Sectional Rank:'}
                          </span>
                          <span className="component-score-val">
                            {t('common.rank', 'Rank')}: {selectedItem.projected_mismatch?.forecast_supply_rank !== null && selectedItem.projected_mismatch?.forecast_supply_rank !== undefined ? selectedItem.projected_mismatch.forecast_supply_rank.toFixed(1) : 'N/A'}/100
                          </span>
                        </div>

                        {/* Accurate 80% Prediction Interval Visualizer */}
                        {renderIntervalTrack(
                          selectedItem.supply_forecast?.prediction_interval_lower,
                          selectedItem.supply_forecast?.point_forecast,
                          selectedItem.supply_forecast?.prediction_interval_upper,
                          selectedItem.supply_forecast?.last_observed_value,
                          false
                        )}

                        <div className="component-subtext" style={{ marginTop: '0.4rem' }}>
                          <strong>{isHindi ? 'बैकटेस्टिंग त्रुटि:' : 'Backtesting Error:'}</strong> MAE = {selectedItem.supply_forecast?.backtest_mae !== null && selectedItem.supply_forecast?.backtest_mae !== undefined ? selectedItem.supply_forecast.backtest_mae.toFixed(2) : 'N/A'} {isHindi ? 'प्रमाणित' : 'certs'} • WAPE = {selectedItem.supply_forecast?.backtest_wape !== null && selectedItem.supply_forecast?.backtest_wape !== undefined ? `${(selectedItem.supply_forecast.backtest_wape * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="component-subtext" style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                          ℹ️ {t('forecasts.predictionIntervalNote', 'The 80% prediction interval represents statistical model uncertainty based on backtest residuals, not a guaranteed policy or market outcome.')}
                        </div>
                        <div className="component-subtext" style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginTop: '0.15rem' }}>
                          <em>{selectedItem.supply_forecast?.interval_disclaimer || 'Normal error distribution approximation on out-of-sample RMSE.'}</em>
                        </div>
                      </div>

                      {/* Training-to-Posting Benchmark Ratio Diagnostic Card */}
                      <div className="component-card" style={{ gridColumn: '1 / -1', borderLeft: '4px solid var(--teal-600)', backgroundColor: '#ffffff' }}>
                        <div className="component-card-top">
                          <div>
                            <span className="component-name">{isHindi ? '3. प्रशिक्षण-से-विज्ञापन मानक अनुपात' : '3. Training-to-Posting Benchmark Ratio'}</span>
                            <div style={{ marginTop: '0.2rem' }}>
                              <span className="model-badge" style={{ backgroundColor: '#f1f5f9', color: 'var(--slate-700)' }}>
                                {isHindi ? 'वर्णनात्मक मानक अनुपात' : 'Descriptive Benchmark Ratio'}
                              </span>
                            </div>
                          </div>
                          <span className="uncertainty-badge adequate" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
                            {isHindi ? 'लक्षित क्षितिज:' : 'Target Horizon:'} +{selectedItem.horizon_months}M ({selectedItem.target_period})
                          </span>
                        </div>

                        <div className="component-value-row">
                          <span className="component-raw-val" style={{ color: 'var(--teal-800)' }}>
                            {selectedItem.demand_forecast?.point_forecast_integer && selectedItem.demand_forecast.point_forecast_integer > 0 && selectedItem.supply_forecast?.point_forecast !== null && selectedItem.supply_forecast?.point_forecast !== undefined
                              ? `${((selectedItem.supply_forecast.point_forecast / selectedItem.demand_forecast.point_forecast_integer) * 100).toFixed(1)} ${isHindi ? 'प्रमाणित उम्मीदवार प्रति 100 ऑनलाइन विज्ञापन' : 'candidates per 100 online postings'}`
                              : 'N/A'}
                          </span>
                          <span className="component-score-val" style={{ fontFamily: 'var(--font-mono)' }}>
                            {selectedItem.demand_forecast?.point_forecast_integer && selectedItem.demand_forecast.point_forecast_integer > 0 && selectedItem.supply_forecast?.point_forecast !== null && selectedItem.supply_forecast?.point_forecast !== undefined
                              ? `${isHindi ? 'अनुपात:' : 'Ratio:'} ${(selectedItem.supply_forecast.point_forecast / selectedItem.demand_forecast.point_forecast_integer).toFixed(2)} : 1`
                              : ''}
                          </span>
                        </div>

                        <div className="component-subtext" style={{ fontSize: '0.74rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                          <strong>{isHindi ? 'गणना सूत्र:' : 'Calculation:'}</strong>{' '}
                          {selectedItem.demand_forecast?.point_forecast_integer && selectedItem.demand_forecast.point_forecast_integer > 0 && selectedItem.supply_forecast?.point_forecast !== null && selectedItem.supply_forecast?.point_forecast !== undefined ? (
                            <code>
                              {selectedItem.supply_forecast.point_forecast.toFixed(1)} {isHindi ? 'थ्रूपुट' : 'certified throughput'} / {selectedItem.demand_forecast.point_forecast_integer} {isHindi ? 'विज्ञापन' : 'postings'} × 100 = {((selectedItem.supply_forecast.point_forecast / selectedItem.demand_forecast.point_forecast_integer) * 100).toFixed(1)}
                            </code>
                          ) : (
                            'N/A'
                          )}
                        </div>

                        <div className="component-subtext" style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                          <em>
                            ⚠️ <strong>{isHindi ? 'केवल वर्णनात्मक मानक:' : 'Descriptive Benchmark Only:'}</strong> {isHindi
                              ? 'यह अनुपात लक्षित माह के लिए ऑनलाइन जॉब विज्ञापनों के विरुद्ध अनुमानित TVET प्रमाणीकरण थ्रूपुट की सीधी तुलना प्रदान करता है। यह रिक्ति-कवरेज दर, बाजार संतुलन उपाय या कौशल कमी का प्रमाण नहीं है।'
                              : 'This ratio provides a transparent comparison of projected TVET certification throughput against online job posting volumes for the target month. It is NOT an empirical vacancy-coverage rate, a measure of labor market clearance, or proof of a skill shortage.'}
                          </em>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Full Time-Series Observation & Forecast Trend Chart */}
                    <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>📈</span>
                          <span>{isHindi ? 'विस्तृत समय-श्रृंखला रुझान एवं अनिश्चितता चार्ट' : 'Time-Series Observation & Horizon Forecast Trend'}</span>
                        </h4>
                        <div style={{ display: 'inline-flex', backgroundColor: 'var(--slate-100)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                          <button
                            type="button"
                            style={{
                              border: 'none',
                              backgroundColor: activeTrendSeries === 'demand' ? '#ffffff' : 'transparent',
                              color: activeTrendSeries === 'demand' ? 'var(--teal-800)' : 'var(--slate-600)',
                              fontWeight: activeTrendSeries === 'demand' ? 700 : 500,
                              boxShadow: activeTrendSeries === 'demand' ? 'var(--shadow-sm)' : 'none',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.74rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setActiveTrendSeries('demand')}
                          >
                            {isHindi ? '1. मांग (ऑनलाइन विज्ञापन)' : '1. Demand (Online Postings)'}
                          </button>
                          <button
                            type="button"
                            style={{
                              border: 'none',
                              backgroundColor: activeTrendSeries === 'supply' ? '#ffffff' : 'transparent',
                              color: activeTrendSeries === 'supply' ? 'var(--slate-900)' : 'var(--slate-600)',
                              fontWeight: activeTrendSeries === 'supply' ? 700 : 500,
                              boxShadow: activeTrendSeries === 'supply' ? 'var(--shadow-sm)' : 'none',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.74rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setActiveTrendSeries('supply')}
                          >
                            {isHindi ? '2. आपूर्ति (प्रमाणित आउटपुट)' : '2. Supply (Certified Throughput)'}
                          </button>
                        </div>
                      </div>

                      {activeTrendSeries === 'demand' ? (
                        <ForecastTimeSeriesChart
                          historicalSeries={selectedItem.demand_forecast?.historical_series || []}
                          pointForecast={selectedItem.demand_forecast?.point_forecast_integer}
                          predictionIntervalLower={selectedItem.demand_forecast?.prediction_interval_lower}
                          predictionIntervalUpper={selectedItem.demand_forecast?.prediction_interval_upper}
                          basePeriod={selectedItem.base_period}
                          targetPeriod={selectedItem.target_period}
                          horizonMonths={selectedItem.horizon_months}
                          modelSelected={selectedItem.demand_forecast?.model_selected}
                          backtestMae={selectedItem.demand_forecast?.backtest_mae}
                          backtestWape={selectedItem.demand_forecast?.backtest_wape}
                          quantityTitle={isHindi ? 'ऑनलाइन जॉब-विज्ञापन मांग समय-श्रृंखला' : 'Online Job-Postings Demand Historical Series & Forecast'}
                          unit={isHindi ? 'विज्ञापन' : 'postings'}
                          isPostings={true}
                          color="#0d9488"
                          accentColor="#115e59"
                        />
                      ) : (
                        <ForecastTimeSeriesChart
                          historicalSeries={selectedItem.supply_forecast?.historical_series || []}
                          pointForecast={selectedItem.supply_forecast?.point_forecast}
                          predictionIntervalLower={selectedItem.supply_forecast?.prediction_interval_lower}
                          predictionIntervalUpper={selectedItem.supply_forecast?.prediction_interval_upper}
                          basePeriod={selectedItem.base_period}
                          targetPeriod={selectedItem.target_period}
                          horizonMonths={selectedItem.horizon_months}
                          modelSelected={selectedItem.supply_forecast?.model_selected}
                          backtestMae={selectedItem.supply_forecast?.backtest_mae}
                          backtestWape={selectedItem.supply_forecast?.backtest_wape}
                          quantityTitle={isHindi ? 'प्रमाणित उम्मीदवार आपूर्ति आउटपुट समय-श्रृंखला' : 'TVET Certified Throughput Historical Series & Forecast'}
                          unit={isHindi ? 'उम्मीदवार' : 'candidates'}
                          isPostings={false}
                          color="#475569"
                          accentColor="#1e293b"
                        />
                      )}
                    </div>

                    {/* Mismatch & Methodological Summary Callout */}
                    <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.35rem' }}>
                        {isHindi ? 'प्रत्याशित क्रॉस-सेक्शनल पर्सेंटाइल संरेखण' : 'Projected Cross-Sectional Percentile Alignment'}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--slate-700)', lineHeight: 1.5 }}>
                        {isHindi ? (
                          <>
                            {selectedItem.horizon_months}-माह के क्षितिज ({selectedItem.target_period}) पर, प्रत्याशित भर्ती मांग <strong>{selectedItem.projected_mismatch?.forecast_demand_rank !== null && selectedItem.projected_mismatch?.forecast_demand_rank !== undefined ? selectedItem.projected_mismatch.forecast_demand_rank.toFixed(1) : 'N/A'} पर्सेंटाइल</strong> पर है, जबकि प्रत्याशित प्रमाणीकरण थ्रूपुट <strong>{selectedItem.projected_mismatch?.forecast_supply_rank !== null && selectedItem.projected_mismatch?.forecast_supply_rank !== undefined ? selectedItem.projected_mismatch.forecast_supply_rank.toFixed(1) : 'N/A'} पर्सेंटाइल</strong> पर है। परिणामी प्रत्याशित सापेक्ष असंतुलन स्कोर <strong>{formatMismatch(selectedItem.projected_mismatch?.projected_mismatch_score)} अंक</strong> ({selectedItem.projected_mismatch?.classification}) है।
                          </>
                        ) : (
                          <>
                            At the {selectedItem.horizon_months}-month horizon ({selectedItem.target_period}), projected recruitment demand ranks at the <strong>{selectedItem.projected_mismatch?.forecast_demand_rank !== null && selectedItem.projected_mismatch?.forecast_demand_rank !== undefined ? selectedItem.projected_mismatch.forecast_demand_rank.toFixed(1) : 'N/A'} percentile</strong>, while projected certified throughput ranks at the <strong>{selectedItem.projected_mismatch?.forecast_supply_rank !== null && selectedItem.projected_mismatch?.forecast_supply_rank !== undefined ? selectedItem.projected_mismatch.forecast_supply_rank.toFixed(1) : 'N/A'} percentile</strong>. Resulting projected relative mismatch score is <strong>{formatMismatch(selectedItem.projected_mismatch?.projected_mismatch_score)} points</strong> ({selectedItem.projected_mismatch?.classification}).
                          </>
                        )}
                      </p>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                        <strong>{isHindi ? 'पूर्णांकन नियम:' : 'Rounding Rule:'}</strong> {isHindi ? 'जॉब विज्ञापन संख्याओं को मध्य-बिंदु पूर्णांकन का उपयोग करके निकटतम गैर-ऋणात्मक पूर्णांकों में पूर्णांकित किया जाता है।' : 'Job posting counts are rounded to nearest non-negative integers using midpoint rounding. Candidate throughput is expressed as an expected continuous candidate count (1 decimal place).'}
                      </div>
                      <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--slate-600)', background: '#f8fafc', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--slate-200)' }}>
                        <strong>{isHindi ? 'मेट्रिक दायरा:' : 'Metric Scope:'}</strong> {isHindi ? 'प्रत्याशित असंतुलन एकल-मात्रा पूर्वानुमान श्रृंखला (विज्ञापन बनाम उम्मीदवार आउटपुट) के बीच भविष्य के रैंक अंतर का मूल्यांकन करता है।' : 'Projected mismatch evaluates future rank differences between single-quantity forecast series (postings vs candidate throughput). It does not include wage benchmarks or employer diversity factors present in current-period Gap Analysis.'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Methodology & Uncertainty Disclosures */}
          <section className="callout-box">
            <h4>
              <span>ℹ️</span>
              <span>{t('forecasts.methodologyTitle', 'Forecast Methodology & Backtesting Governance Disclosure')}</span>
            </h4>
            <p>
              <strong>{isHindi ? 'रोलिंग-ओरिजिन बैकटेस्टिंग:' : 'Rolling-Origin Backtesting:'}</strong> {isHindi
                ? 'मॉडलों की तुलना बिना किसी भविष्य-डेटा लीकेज या शफ़लिंग के समय-क्रमबद्ध रोलिंग कटऑफ के माध्यम से की जाती है। मॉडल चयन न्यूनतम आउट-ऑफ़-सैंपल MAE पर आधारित डिटरमिनिस्टिक है।'
                : 'Models are compared through time-ordered rolling cutoffs with zero future-data leakage or shuffling. For training history up to index t-1 (history[:t]), horizon h forecasts target index t + h - 1. Model selection is deterministic based on minimum out-of-sample MAE.'}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{isHindi ? 'प्रेडिक्शन इंटरवल विशिष्टता:' : 'Prediction Interval Specification:'}</strong> {isHindi
                ? 'प्रेडिक्शन इंटरवल की गणना नाममात्र 80% गाऊसी सन्निकटन के तहत बिंदु पूर्वानुमान ± 1.282 × RMSE के रूप में की जाती है।'
                : 'Prediction intervals are computed as point forecast ± 1.282 × RMSE derived from out-of-sample backtest errors under a nominal 80% Gaussian approximation. They are not direct empirical quantile intervals.'}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{isHindi ? 'प्रत्याशित असंतुलन बनाम वर्तमान अंतर विश्लेषण:' : 'Projected Mismatch vs. Current Gap Analysis:'}</strong> {isHindi
                ? 'प्रत्याशित असंतुलन एक सममित रैंक-रैंक अंतर (मांग विज्ञापन रैंक − आपूर्ति थ्रूपुट रैंक) है। इसके विपरीत, वर्तमान अंतर विश्लेषण एक भारित बहु-संकेत मांग सूचकांक का उपयोग करता है। दोनों संकेतक विभिन्न सूत्रों और सांख्यिकीय वितरणों का उपयोग करते हैं।'
                : 'Projected Mismatch is a symmetric rank-rank difference (Demand Postings Rank − Supply Throughput Rank). In contrast, current-period Gap Analysis uses a weighted multi-signal demand index (Demand Composite Score − Supply Rank). The two indicators use different formulas and statistical distributions, and should not be cross-compared as identical numeric scores.'}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{isHindi ? 'प्रोटोटाइप नीति सीमाएं (±15 अंक):' : 'Prototype Policy Thresholds (±15 Points):'}</strong> {isHindi
                ? 'मांग दबाव और आपूर्ति दबाव को सीमांकित करने वाली सीमाएं प्रोटोटाइप ह्युरिस्टिक सीमाएं (±15) हैं, न कि अनुभवजन्य रूप से कैलिब्रेट किए गए नीति नियम।'
                : 'The threshold boundaries demarcating Demand Pressure and Supply Pressure are prototype heuristic thresholds (±15), not empirically calibrated policy rules.'}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              <strong>{isHindi ? 'सिंथेटिक पायलट आधार रेखा:' : 'Synthetic Pilot Baseline:'}</strong> {isHindi
                ? 'सभी पूर्वानुमान और प्रत्याशित असंतुलन स्कोर SIH26246 के लिए सिंथेटिक प्रदर्शन डेटासेट (आधिकारिक आंकड़े नहीं) पर आधारित हैं। अनुमान सापेक्ष रैंक अंतर दर्शाते हैं, प्रत्यक्ष कर्मी कमी या अधिशेष नहीं।'
                : 'All forecasts and projected mismatch scores are computed on synthetic demonstration datasets for SIH26246 (not official statistics). Projections denote relative rank differences, not an absolute worker shortage or surplus headcount.'}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
