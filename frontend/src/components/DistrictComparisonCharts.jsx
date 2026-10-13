import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  getDistrictDisplayName,
  getSectorDisplayName,
} from '../i18n/translations';
import DistrictGeographicMap from './DistrictGeographicMap';
import Icon from './Icon';

// Master pilot geographies from data/sample/geographies.csv with verified coordinates
const PILOT_DISTRICTS = [
  { id: 'MH_PUN', name: 'Pune', state: 'MH', stateName: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
  { id: 'MH_MUM', name: 'Mumbai Suburban', state: 'MH', stateName: 'Maharashtra', lat: 19.0760, lon: 72.8777 },
  { id: 'KA_BLR_U', name: 'Bengaluru Urban', state: 'KA', stateName: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { id: 'KA_DHA', name: 'Dharwad', state: 'KA', stateName: 'Karnataka', lat: 15.4589, lon: 75.0078 },
  { id: 'TS_HYD', name: 'Hyderabad', state: 'TS', stateName: 'Telangana', lat: 17.3850, lon: 78.4867 },
  { id: 'TS_MED', name: 'Medchal-Malkajgiri', state: 'TS', stateName: 'Telangana', lat: 17.6297, lon: 78.4815 },
];

const SECTORS = ['All Sectors', 'IT/ITeS', 'Logistics', 'Manufacturing'];

export default function DistrictComparisonCharts({
  gapData,
  selectedDistrictId = null,
  onSelectDistrict = () => {},
  period = '2026-09',
  onExploreDistrict = () => {},
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [activeSector, setActiveSector] = useState('All Sectors');
  const [sortField, setSortField] = useState('demand'); // 'demand' | 'supply' | 'mismatch'
  const [activeView, setActiveView] = useState('charts'); // 'charts' | 'map'

  // Compute aggregated district metrics dynamically from gapData results
  const districtMetrics = useMemo(() => {
    const rawResults = gapData?.results || [];

    // Filter by activeSector if specified
    const filteredRecords = activeSector === 'All Sectors'
      ? rawResults
      : rawResults.filter((r) => r.sector === activeSector);

    return PILOT_DISTRICTS.map((geo) => {
      const records = filteredRecords.filter((r) => r.district_id === geo.id);

      if (records.length === 0) {
        return {
          ...geo,
          recordCount: 0,
          avgDemand: 0,
          avgSupply: 0,
          mismatch: 0,
          classification: 'Balanced / Monitor',
        };
      }

      const sumDemand = records.reduce((acc, r) => acc + (Number(r.demand_index_score) || 0), 0);
      const sumSupply = records.reduce((acc, r) => acc + (Number(r.supply_output_index) || 0), 0);
      const sumMismatch = records.reduce((acc, r) => acc + (Number(r.relative_mismatch_score) || 0), 0);

      const avgDemand = Math.round((sumDemand / records.length) * 10) / 10;
      const avgSupply = Math.round((sumSupply / records.length) * 10) / 10;
      const mismatch = Math.round((sumMismatch / records.length) * 10) / 10;

      let classification = 'Balanced / Monitor';
      if (mismatch >= 15.0) {
        classification = 'Demand Pressure';
      } else if (mismatch <= -15.0) {
        classification = 'Supply Pressure';
      }

      return {
        ...geo,
        recordCount: records.length,
        avgDemand,
        avgSupply,
        mismatch,
        classification,
      };
    });
  }, [gapData, activeSector]);

  // Sorted list for Chart A
  const sortedDistricts = useMemo(() => {
    return [...districtMetrics].sort((a, b) => {
      if (sortField === 'demand') return b.avgDemand - a.avgDemand;
      if (sortField === 'supply') return b.avgSupply - a.avgSupply;
      if (sortField === 'mismatch') return b.mismatch - a.mismatch;
      return 0;
    });
  }, [districtMetrics, sortField]);

  const formatScore = (val) => Number(val).toFixed(1);
  const formatMismatch = (val) => {
    const num = Number(val);
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}`;
  };

  const getClassificationBadge = (classification) => {
    if (classification === 'Demand Pressure') {
      return {
        iconName: 'zap',
        label: isHindi ? 'मांग दबाव' : 'Demand Pressure',
        color: 'var(--status-demand-text)',
        bg: 'var(--status-demand-bg)',
        border: 'var(--status-demand-border)',
      };
    }
    if (classification === 'Supply Pressure') {
      return {
        iconName: 'package',
        label: isHindi ? 'आपूर्ति दबाव' : 'Supply Pressure',
        color: 'var(--status-supply-text)',
        bg: 'var(--status-supply-bg)',
        border: 'var(--status-supply-border)',
      };
    }
    return {
      iconName: 'scale',
      label: isHindi ? 'संतुलित' : 'Balanced',
      color: 'var(--text-secondary)',
      bg: 'var(--bg-subtle)',
      border: 'var(--border-subtle)',
    };
  };

  return (
    <section
      className="card-panel glass-strong"
      style={{
        marginBottom: '1.5rem',
        borderLeft: '4px solid #0d9488',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Header & Filter Bar */}
      <div
        className="card-panel-header"
        style={{
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
        }}
      >
        <div className="card-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
              {t('overview.districtComparisonTitle', isHindi ? 'ज़िला-स्तरीय कार्यबल विश्लेषण एवं तुलना' : 'District-Wise Workforce Comparison Pack')}
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'var(--accent-soft-bg)',
                color: 'var(--accent-soft-text)',
                border: '1px solid var(--accent-soft-border)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {t('overview.districtComparisonScope', isHindi ? '6 पायलट ज़िले • 3 राज्य' : '6 Pilot Districts • 3 States')} • {period}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {isHindi
              ? 'कर्नाटक, महाराष्ट्र और तेलंगाना में औसत मांग सूचकांक, आपूर्ति सूचकांक और सापेक्ष असंतुलन की तुलना।'
              : 'Cross-district comparative intelligence evaluating average demand index, TVET supply output index, and relative mismatch scores.'}
          </p>
        </div>

        {/* View and Sector Filter Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sector Filter Pills */}
          <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            {SECTORS.map((sec) => (
              <button
                key={sec}
                type="button"
                style={{
                  border: 'none',
                  backgroundColor: activeSector === sec ? '#4f46e5' : 'transparent',
                  color: activeSector === sec ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: activeSector === sec ? 700 : 500,
                  boxShadow: activeSector === sec ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.72rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setActiveSector(sec)}
              >
                {sec === 'All Sectors'
                  ? (isHindi ? 'सभी क्षेत्र' : 'All Sectors')
                  : getSectorDisplayName(sec, isHindi)}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Charts vs Map */}
          <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: activeView === 'charts' ? 'var(--bg-surface)' : 'transparent',
                color: activeView === 'charts' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeView === 'charts' ? 700 : 500,
                boxShadow: activeView === 'charts' ? 'var(--shadow-sm)' : 'none',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => setActiveView('charts')}
            >
              <Icon name="chart-bar" size={13} />
              <span>{isHindi ? 'तुलनात्मक चार्ट (A & B)' : 'Comparison Charts (A & B)'}</span>
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: activeView === 'map' ? 'var(--bg-surface)' : 'transparent',
                color: activeView === 'map' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeView === 'map' ? 700 : 500,
                boxShadow: activeView === 'map' ? 'var(--shadow-sm)' : 'none',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => setActiveView('map')}
            >
              <Icon name="map" size={13} />
              <span>{isHindi ? 'स्थानिक पायलट मानचित्र' : 'Pilot Geographic Map'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected District Filter Reset Pill if active */}
      {selectedDistrictId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 0.75rem',
            margin: '0.75rem 1rem 0 1rem',
            backgroundColor: 'var(--accent-soft-bg)',
            border: '1px solid var(--accent-soft-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--accent-soft-text)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Icon name="map-pin" size={13} />
            <span>{isHindi ? 'सक्रिय ज़िला फ़िल्टर:' : 'Active District Filter:'}</span>
            <strong>{getDistrictDisplayName(PILOT_DISTRICTS.find((d) => d.id === selectedDistrictId)?.name, isHindi)}</strong> ({PILOT_DISTRICTS.find((d) => d.id === selectedDistrictId)?.state})
          </span>
          <button
            type="button"
            style={{ border: 'none', background: 'none', color: 'var(--accent-soft-text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.72rem' }}
            onClick={() => onSelectDistrict(null)}
          >
            ✕ {isHindi ? 'फ़िल्टर हटाएं' : 'Reset Filter'}
          </button>
        </div>
      )}

      {/* VIEW 1: Comparison Charts A and B */}
      {activeView === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', padding: '1rem' }}>
          {/* CHART A: Ranked Horizontal Bar Chart Comparing Demand and Supply Indices */}
          <div style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {t('overview.chartATitle', isHindi ? 'चार्ट A: मांग एवं आपूर्ति सूचकांक तुलना' : 'Chart A: Demand vs. Supply Index Comparison')}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {isHindi ? '0 से 100 अंक पर्सेंटाइल स्केल पर रैंक की गई तुलना' : 'Ranked cross-sectional percentile comparison (0 to 100 pts)'}
                </span>
              </div>

              {/* Sort Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                <span>{isHindi ? 'क्रम:' : 'Sort:'}</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="demand">{isHindi ? 'मांग सूचकांक' : 'Demand Index'}</option>
                  <option value="supply">{isHindi ? 'आपूर्ति सूचकांक' : 'Supply Index'}</option>
                  <option value="mismatch">{isHindi ? 'असंतुलन स्कोर' : 'Mismatch Score'}</option>
                </select>
              </div>
            </div>

            {/* Legend for Chart A */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '10px', backgroundColor: '#0d9488', borderRadius: '2px', display: 'inline-block' }} />
                <span>{isHindi ? 'नियोक्ता मांग सूचकांक (0–100 अंक)' : 'Employer Demand Index (0–100 pts)'}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '10px', backgroundColor: '#6366f1', borderRadius: '2px', display: 'inline-block' }} />
                <span>{isHindi ? 'TVET आपूर्ति आउटपुट सूचकांक (0–100 अंक)' : 'TVET Supply Output Index (0–100 pts)'}</span>
              </span>
            </div>

            {/* Rows of Paired Horizontal Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
              {sortedDistricts.map((d) => {
                const isSelected = selectedDistrictId === d.id;
                return (
                  <div
                    key={d.id}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--accent-soft-bg)' : 'var(--bg-surface)',
                      border: `1px solid ${isSelected ? '#0d9488' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    }}
                    onClick={() => onSelectDistrict(isSelected ? null : d.id)}
                    title={isHindi ? `${d.name} फ़िल्टर करने के लिए क्लिक करें` : `Click to filter rankings by ${d.name}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {getDistrictDisplayName(d.name, isHindi)}{' '}
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          ({d.state})
                        </span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        D: {formatScore(d.avgDemand)} | S: {formatScore(d.avgSupply)}
                      </span>
                    </div>

                    {/* Bar 1: Demand Index */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ width: '42px', fontSize: '0.65rem', color: 'var(--accent-soft-text)', fontWeight: 600 }}>
                        {isHindi ? 'मांग:' : 'Demand:'}
                      </span>
                      <div style={{ flexGrow: 1, height: '8px', backgroundColor: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, d.avgDemand))}%`,
                            height: '100%',
                            backgroundColor: '#0d9488',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <span style={{ width: '48px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-soft-text)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {formatScore(d.avgDemand)} pts
                      </span>
                    </div>

                    {/* Bar 2: Supply Output Index */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '42px', fontSize: '0.65rem', color: 'var(--accent-indigo-text)', fontWeight: 600 }}>
                        {isHindi ? 'आपूर्ति:' : 'Supply:'}
                      </span>
                      <div style={{ flexGrow: 1, height: '8px', backgroundColor: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, d.avgSupply))}%`,
                            height: '100%',
                            backgroundColor: '#6366f1',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <span style={{ width: '48px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-indigo-text)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {formatScore(d.avgSupply)} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Axis Title */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.35rem' }}>
              {isHindi ? 'अक्ष इकाई: क्रॉस-सेक्शनल पर्सेंटाइल सूचकांक स्कोर (0 से 100 अंक)' : 'Axis Unit: Cross-Sectional Percentile Index Score (0 to 100 pts)'}
            </div>
          </div>

          {/* CHART B: Centered Diverging Relative-Mismatch Chart (-100 to +100 with zero center) */}
          <div style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {t('overview.chartBTitle', isHindi ? 'चार्ट B: सापेक्ष मांग-आपूर्ति असंतुलन (शून्य-केंद्रित)' : 'Chart B: Relative Demand-Supply Mismatch (Zero-Centered)')}
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isHindi ? 'शून्य (0.0) पर आधारित विचलन चार्ट: बायीं ओर आपूर्ति दबाव | दायीं ओर मांग दबाव' : 'Diverging chart centered at zero (0.0): Left = Supply Pressure | Right = Demand Pressure'}
              </span>
            </div>

            {/* Legend & Threshold Annotation for Chart B */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--status-supply-text)' }}>
                <Icon name="package" size={12} />
                <span>{isHindi ? 'आपूर्ति दबाव (≤ −15)' : 'Supply Pressure (≤ −15)'}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                <Icon name="scale" size={12} />
                <span>{isHindi ? 'संतुलित (−15 से +15)' : 'Balanced Corridor (±15)'}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--status-demand-text)' }}>
                <Icon name="zap" size={12} />
                <span>{isHindi ? 'मांग दबाव (≥ +15)' : 'Demand Pressure (≥ +15)'}</span>
              </span>
            </div>

            {/* Diverging Bars Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
              {sortedDistricts.map((d) => {
                const badge = getClassificationBadge(d.classification);
                const isSelected = selectedDistrictId === d.id;
                const maxHalfScale = 50;
                const absVal = Math.min(maxHalfScale, Math.abs(d.mismatch));
                const barWidthPct = (absVal / maxHalfScale) * 100;
                const isPositive = d.mismatch > 0;
                const isNeutral = Math.abs(d.mismatch) < 15.0;

                return (
                  <div
                    key={d.id}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--accent-soft-bg)' : 'var(--bg-surface)',
                      border: `1px solid ${isSelected ? '#0d9488' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    }}
                    onClick={() => onSelectDistrict(isSelected ? null : d.id)}
                    title={isHindi ? `${d.name} फ़िल्टर करने के लिए क्लिक करें` : `Click to filter rankings by ${d.name}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {getDistrictDisplayName(d.name, isHindi)}{' '}
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({d.state})</span>
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: badge.color,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.border}`,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Icon name={badge.iconName} size={11} />
                        <span>{badge.label}</span>
                        <span>({formatMismatch(d.mismatch)} pts)</span>
                      </span>
                    </div>

                    {/* Zero-Centered Track */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2px 1fr', alignItems: 'center', height: '14px', backgroundColor: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      {/* Left Side (Negative Mismatch: Supply Pressure) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', height: '100%', width: '100%' }}>
                        {!isPositive && d.mismatch !== 0 && (
                          <div
                            style={{
                              width: `${barWidthPct}%`,
                              height: '100%',
                              backgroundColor: isNeutral ? '#64748b' : '#3b82f6',
                              borderTopLeftRadius: '3px',
                              borderBottomLeftRadius: '3px',
                            }}
                          />
                        )}
                      </div>

                      {/* Center Zero Axis Divider */}
                      <div style={{ width: '2px', height: '100%', backgroundColor: 'var(--border-strong)', zIndex: 2 }} />

                      {/* Right Side (Positive Mismatch: Demand Pressure) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-start', height: '100%', width: '100%' }}>
                        {isPositive && (
                          <div
                            style={{
                              width: `${barWidthPct}%`,
                              height: '100%',
                              backgroundColor: isNeutral ? '#f59e0b' : '#ea580c',
                              borderTopRightRadius: '3px',
                              borderBottomRightRadius: '3px',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Axis Title & Interpretation */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.35rem' }}>
              {isHindi
                ? 'सापेक्ष असंतुलन स्कोर = मांग रैंक − आपूर्ति रैंक (−100 से +100 अंक, शून्य = संतुलन)'
                : 'Relative Mismatch Score = Demand Rank − Supply Rank (−100 to +100 pts, 0.0 = Neutral)'}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Pilot District Geographic Basemap */}
      {activeView === 'map' && (
        <DistrictGeographicMap
          districts={districtMetrics}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={onSelectDistrict}
          period={period}
          isHindi={isHindi}
          onSwitchToCharts={() => setActiveView('charts')}
          onExploreDistrict={onExploreDistrict}
          gapRecords={gapData?.results || gapData?.records || []}
        />
      )}
    </section>
  );
}
