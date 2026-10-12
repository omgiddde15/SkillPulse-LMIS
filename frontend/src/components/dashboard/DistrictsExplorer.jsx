import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
} from '../../i18n/translations';
import DistrictGeographicMap from '../DistrictGeographicMap';
import DistrictComparisonCharts from '../DistrictComparisonCharts';

const PILOT_COORDINATES = {
  MH_PUN: { lat: 18.52, lon: 73.86 },
  MH_MUM: { lat: 19.08, lon: 72.88 },
  KA_BLR_U: { lat: 12.97, lon: 77.59 },
  KA_DHA: { lat: 15.46, lon: 75.01 },
  TS_HYD: { lat: 17.39, lon: 78.49 },
  TS_MED: { lat: 17.63, lon: 78.48 },
};

export default function DistrictsExplorer({
  gapData = null,
  period = '2026-09',
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'charts'
  const [selectedDistrictId, setSelectedDistrictId] = useState(null);
  const [stateFilter, setStateFilter] = useState('');

  // Aggregate district-level statistics from gapData records
  const districtSummaries = useMemo(() => {
    if (!gapData || !gapData.records) return [];

    const map = {};
    gapData.records.forEach((r) => {
      if (!map[r.district_id]) {
        map[r.district_id] = {
          id: r.district_id,
          name: r.district_name,
          state: r.state,
          lat: PILOT_COORDINATES[r.district_id]?.lat || 0,
          lon: PILOT_COORDINATES[r.district_id]?.lon || 0,
          demandTotal: 0,
          supplyTotal: 0,
          mismatchTotal: 0,
          count: 0,
          classifications: {},
        };
      }
      map[r.district_id].demandTotal += r.demand_index || 0;
      map[r.district_id].supplyTotal += r.supply_index || 0;
      map[r.district_id].mismatchTotal += r.mismatch || 0;
      map[r.district_id].count += 1;
      map[r.district_id].classifications[r.classification] =
        (map[r.district_id].classifications[r.classification] || 0) + 1;
    });

    return Object.values(map).map((d) => {
      const avgMismatch = d.count > 0 ? d.mismatchTotal / d.count : 0;
      let classification = 'Balanced';
      if (avgMismatch >= 15) classification = 'Demand Pressure';
      else if (avgMismatch <= -15) classification = 'Supply Pressure';

      return {
        id: d.id,
        name: d.name,
        state: d.state,
        lat: d.lat,
        lon: d.lon,
        avgDemand: d.count > 0 ? d.demandTotal / d.count : 0,
        avgSupply: d.count > 0 ? d.supplyTotal / d.count : 0,
        mismatch: avgMismatch,
        classification,
        count: d.count,
      };
    });
  }, [gapData]);

  // Filter districts by state if chosen
  const filteredDistricts = useMemo(() => {
    if (!stateFilter) return districtSummaries;
    return districtSummaries.filter((d) => d.state === stateFilter);
  }, [districtSummaries, stateFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Controls Card */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🗺️</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('districts.title', 'Pilot Districts Intelligence')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: 'var(--teal-800)', border: '1px solid #99f6e4', fontWeight: 700 }}>
                6 {isHindi ? 'पायलट ज़िले' : 'Pilot Districts'} • 3 {isHindi ? 'राज्य' : 'States'}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'districts.subtitle',
                'Spatial workforce mismatch and geographic distribution across Karnataka, Maharashtra, and Telangana.'
              )}
            </p>
          </div>

          {/* View Mode Toggle & State Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* State Filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--slate-300)', backgroundColor: 'var(--slate-50)' }}
            >
              <option value="">{t('common.allStates', 'All States (3)')}</option>
              <option value="KA">Karnataka (KA)</option>
              <option value="MH">Maharashtra (MH)</option>
              <option value="TS">Telangana (TS)</option>
            </select>

            {/* View Toggle */}
            <div style={{ display: 'inline-flex', backgroundColor: 'var(--slate-100)', padding: '2px', borderRadius: '6px', border: '1px solid var(--slate-200)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                style={{
                  border: 'none',
                  backgroundColor: activeTab === 'map' ? '#0d9488' : 'transparent',
                  color: activeTab === 'map' ? '#ffffff' : 'var(--slate-600)',
                  fontWeight: activeTab === 'map' ? 700 : 500,
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                🗺️ {isHindi ? 'मानचित्र' : 'Geographic Map'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                style={{
                  border: 'none',
                  backgroundColor: activeTab === 'charts' ? '#0d9488' : 'transparent',
                  color: activeTab === 'charts' ? '#ffffff' : 'var(--slate-600)',
                  fontWeight: activeTab === 'charts' ? 700 : 500,
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                📊 {isHindi ? 'तुलनात्मक चार्ट' : 'Comparison Charts'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Container */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {activeTab === 'map' ? (
          <DistrictGeographicMap
            districts={filteredDistricts}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            period={period}
            isHindi={isHindi}
            onSwitchToCharts={() => setActiveTab('charts')}
          />
        ) : (
          <DistrictComparisonCharts
            districts={filteredDistricts}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            isHindi={isHindi}
          />
        )}
      </div>

      {/* District KPI Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
        {filteredDistricts.map((d) => {
          const isSelected = selectedDistrictId === d.id;
          return (
            <div
              key={d.id}
              onClick={() => setSelectedDistrictId(isSelected ? null : d.id)}
              style={{
                backgroundColor: '#ffffff',
                border: isSelected ? '2px solid #0d9488' : '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                cursor: 'pointer',
                boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  📍 {getDistrictDisplayName(d.name, isHindi)}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                  {getStateDisplayName(d.state, isHindi)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--slate-100)' }}>
                <div>
                  <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Demand</div>
                  <div style={{ fontWeight: 800, color: '#0f766e', fontFamily: 'var(--font-mono)' }}>{d.avgDemand.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Supply</div>
                  <div style={{ fontWeight: 800, color: 'var(--slate-700)', fontFamily: 'var(--font-mono)' }}>{d.avgSupply.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Mismatch</div>
                  <div style={{ fontWeight: 800, color: d.mismatch >= 15 ? '#c2410c' : d.mismatch <= -15 ? '#1d4ed8' : '#475569', fontFamily: 'var(--font-mono)' }}>
                    {d.mismatch > 0 ? `+${d.mismatch.toFixed(1)}` : d.mismatch.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
