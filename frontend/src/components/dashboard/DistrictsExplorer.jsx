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
  onNavigateWithContext = () => {},
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'charts'
  const [selectedDistrictId, setSelectedDistrictId] = useState(null);
  const [stateFilter, setStateFilter] = useState('');

  // Aggregate district-level statistics from gapData results or records
  const districtSummaries = useMemo(() => {
    const rawList = gapData?.results || gapData?.records || [];
    if (!rawList.length) return [];

    const map = {};
    rawList.forEach((r) => {
      const distId = r.district_id;
      if (!map[distId]) {
        map[distId] = {
          id: distId,
          name: r.district_name,
          state: r.state_code || r.state,
          lat: PILOT_COORDINATES[distId]?.lat || 0,
          lon: PILOT_COORDINATES[distId]?.lon || 0,
          demandTotal: 0,
          supplyTotal: 0,
          mismatchTotal: 0,
          count: 0,
          records: [],
        };
      }
      map[distId].demandTotal += Number(r.demand_index_score ?? r.demand_index ?? 0);
      map[distId].supplyTotal += Number(r.supply_output_index ?? r.supply_index ?? 0);
      map[distId].mismatchTotal += Number(r.relative_mismatch_score ?? r.mismatch ?? 0);
      map[distId].count += 1;
      map[distId].records.push(r);
    });

    return Object.values(map).map((d) => {
      const avgMismatch = d.count > 0 ? d.mismatchTotal / d.count : 0;
      let classification = 'Balanced';
      if (avgMismatch >= 15) classification = 'Demand Pressure';
      else if (avgMismatch <= -15) classification = 'Supply Pressure';

      // Find top shortage and oversupply trade
      const sortedByMismatch = [...d.records].sort(
        (a, b) => Number(b.relative_mismatch_score ?? b.mismatch ?? 0) - Number(a.relative_mismatch_score ?? a.mismatch ?? 0)
      );

      const topShortage = sortedByMismatch[0] || null;
      const topSurplus = sortedByMismatch[sortedByMismatch.length - 1] || null;

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
        topShortage,
        topSurplus,
        records: d.records,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            onExploreDistrict={(distId) => setSelectedDistrictId(distId)}
            gapRecords={gapData?.results || gapData?.records || []}
          />
        ) : (
          <DistrictComparisonCharts
            gapData={gapData}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            period={period}
            onExploreDistrict={(distId) => setSelectedDistrictId(distId)}
          />
        )}
      </div>

      {/* District Dossier Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {filteredDistricts.map((d) => {
          const isSelected = selectedDistrictId === d.id;
          const topShortageScore = Number(d.topShortage?.relative_mismatch_score ?? d.topShortage?.mismatch ?? 0);
          const topSurplusScore = Number(d.topSurplus?.relative_mismatch_score ?? d.topSurplus?.mismatch ?? 0);

          return (
            <div
              key={d.id}
              style={{
                backgroundColor: '#ffffff',
                border: isSelected ? '2px solid #0d9488' : '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    📍 {getDistrictDisplayName(d.name, isHindi)}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                    {getStateDisplayName(d.state, isHindi)} • {d.id}
                  </span>
                </div>

                {/* 3 Metric Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem', marginTop: '0.5rem', padding: '0.5rem 0', borderTop: '1px solid var(--slate-100)', borderBottom: '1px solid var(--slate-100)' }}>
                  <div>
                    <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Demand Avg</div>
                    <div style={{ fontWeight: 800, color: '#0f766e', fontFamily: 'var(--font-mono)' }}>{d.avgDemand.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Supply Avg</div>
                    <div style={{ fontWeight: 800, color: 'var(--slate-700)', fontFamily: 'var(--font-mono)' }}>{d.avgSupply.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--slate-500)', fontSize: '0.65rem' }}>Net Mismatch</div>
                    <div style={{ fontWeight: 800, color: d.mismatch >= 15 ? '#c2410c' : d.mismatch <= -15 ? '#1d4ed8' : '#475569', fontFamily: 'var(--font-mono)' }}>
                      {d.mismatch > 0 ? `+${d.mismatch.toFixed(1)}` : d.mismatch.toFixed(1)} pts
                    </div>
                  </div>
                </div>

                {/* Key Corridors Breakdown */}
                <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem' }}>
                  {d.topShortage && topShortageScore > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7ed', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ffedd5' }}>
                      <span style={{ color: '#9a3412', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                        ⚡ {d.topShortage.occupation_title}
                      </span>
                      <strong style={{ color: '#c2410c', fontFamily: 'var(--font-mono)' }}>
                        +{topShortageScore.toFixed(1)}
                      </strong>
                    </div>
                  )}

                  {d.topSurplus && topSurplusScore < 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #dbeafe' }}>
                      <span style={{ color: '#1e40af', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                        📦 {d.topSurplus.occupation_title}
                      </span>
                      <strong style={{ color: '#1d4ed8', fontFamily: 'var(--font-mono)' }}>
                        {topSurplusScore.toFixed(1)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--slate-100)', paddingTop: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigateWithContext('gap', { district: d.id, state: d.state })}
                  style={{
                    border: '1px solid var(--slate-300)',
                    backgroundColor: '#ffffff',
                    color: 'var(--slate-700)',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isHindi ? 'गैप विवरण' : 'Inspect Gaps'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateWithContext('simulator', {
                      district: d.id,
                      occupation: d.topShortage?.occupation_id,
                      state: d.state,
                    })
                  }
                  style={{
                    border: 'none',
                    backgroundColor: '#0d9488',
                    color: '#ffffff',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isHindi ? 'सिम्युलेट करें' : 'Test in Simulator'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
