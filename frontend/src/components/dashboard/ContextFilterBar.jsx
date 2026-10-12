import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getSectorDisplayName,
  getOccupationDisplayName,
} from '../../i18n/translations';

const PILOT_DISTRICTS = [
  { id: 'MH_PUN', name: 'Pune', state: 'MH' },
  { id: 'MH_MUM', name: 'Mumbai Suburban', state: 'MH' },
  { id: 'KA_BLR_U', name: 'Bengaluru Urban', state: 'KA' },
  { id: 'KA_DHA', name: 'Dharwad', state: 'KA' },
  { id: 'TS_HYD', name: 'Hyderabad', state: 'TS' },
  { id: 'TS_MED', name: 'Medchal-Malkajgiri', state: 'TS' },
];

const PILOT_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'TS', name: 'Telangana' },
];

const PILOT_SECTORS = ['IT/ITeS', 'Logistics', 'Manufacturing'];

const PILOT_OCCUPATIONS = [
  { id: 'OCC_IT_001', title: 'Cloud Infrastructure Associate', sector: 'IT/ITeS' },
  { id: 'OCC_IT_002', title: 'Data Quality Analyst', sector: 'IT/ITeS' },
  { id: 'OCC_IT_003', title: 'Full-Stack Web Developer', sector: 'IT/ITeS' },
  { id: 'OCC_MFG_001', title: 'CNC Machine Operator', sector: 'Manufacturing' },
  { id: 'OCC_MFG_002', title: 'Industrial Automation Technician', sector: 'Manufacturing' },
  { id: 'OCC_MFG_003', title: 'Electric Vehicle Assembly Technician', sector: 'Manufacturing' },
  { id: 'OCC_LOG_001', title: 'Warehouse Inventory Coordinator', sector: 'Logistics' },
  { id: 'OCC_LOG_002', title: 'Cold Chain Logistics Supervisor', sector: 'Logistics' },
  { id: 'OCC_LOG_003', title: 'Fleet Dispatcher', sector: 'Logistics' },
];

export default function ContextFilterBar({
  stateFilter = '',
  districtFilter = '',
  sectorFilter = '',
  occupationFilter = '',
  horizonFilter = 3,
  showHorizon = false,
  showOccupation = true,
  onStateChange = () => {},
  onDistrictChange = () => {},
  onSectorChange = () => {},
  onOccupationChange = () => {},
  onHorizonChange = () => {},
  onReset = () => {},
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  // Filter districts based on state selection
  const filteredDistricts = stateFilter
    ? PILOT_DISTRICTS.filter((d) => d.state === stateFilter)
    : PILOT_DISTRICTS;

  // Filter occupations based on sector selection
  const filteredOccupations = sectorFilter
    ? PILOT_OCCUPATIONS.filter((o) => o.sector === sectorFilter)
    : PILOT_OCCUPATIONS;

  const hasActiveFilters = Boolean(
    stateFilter || districtFilter || sectorFilter || occupationFilter || (showHorizon && horizonFilter !== 3)
  );

  return (
    <div
      className="context-filter-bar"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--slate-200)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.65rem',
          borderBottom: '1px solid var(--slate-100)',
          paddingBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem' }}>🎛️</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            {isHindi ? 'संदर्भ फ़िल्टर' : 'Context Filters'}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--slate-500)' }}>
            ({isHindi ? 'पायलट कार्यबल स्कोप' : 'Pilot Workforce Scope'})
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            style={{
              border: '1px solid var(--slate-300)',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-700)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>↺</span>
            <span>{t('common.resetFilters', 'Reset Filters')}</span>
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
          gap: '0.75rem',
          alignItems: 'flex-end',
        }}
      >
        {/* State Filter */}
        <div>
          <label
            htmlFor="filter-state"
            style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
          >
            {t('common.state', 'State')}
          </label>
          <select
            id="filter-state"
            value={stateFilter}
            onChange={(e) => {
              onStateChange(e.target.value);
              // Reset district if it doesn't belong to selected state
              if (e.target.value && districtFilter) {
                const match = PILOT_DISTRICTS.find((d) => d.id === districtFilter);
                if (match && match.state !== e.target.value) {
                  onDistrictChange('');
                }
              }
            }}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              fontSize: '0.78rem',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-800)',
              fontWeight: 500,
            }}
          >
            <option value="">{t('common.allStates', 'All States (3)')}</option>
            {PILOT_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {getStateDisplayName(s.code, isHindi)}
              </option>
            ))}
          </select>
        </div>

        {/* District Filter */}
        <div>
          <label
            htmlFor="filter-district"
            style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
          >
            {t('common.district', 'District')}
          </label>
          <select
            id="filter-district"
            value={districtFilter}
            onChange={(e) => onDistrictChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              fontSize: '0.78rem',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-800)',
              fontWeight: 500,
            }}
          >
            <option value="">{t('common.allDistricts', 'All Districts (6)')}</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {getDistrictDisplayName(d.name, isHindi)} ({d.state})
              </option>
            ))}
          </select>
        </div>

        {/* Sector Filter */}
        <div>
          <label
            htmlFor="filter-sector"
            style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
          >
            {t('common.sector', 'Sector')}
          </label>
          <select
            id="filter-sector"
            value={sectorFilter}
            onChange={(e) => {
              onSectorChange(e.target.value);
              // Reset occupation if it doesn't belong to sector
              if (e.target.value && occupationFilter) {
                const match = PILOT_OCCUPATIONS.find((o) => o.id === occupationFilter);
                if (match && match.sector !== e.target.value) {
                  onOccupationChange('');
                }
              }
            }}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              fontSize: '0.78rem',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-800)',
              fontWeight: 500,
            }}
          >
            <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
            {PILOT_SECTORS.map((s) => (
              <option key={s} value={s}>
                {getSectorDisplayName(s, isHindi)}
              </option>
            ))}
          </select>
        </div>

        {/* Occupation Filter */}
        {showOccupation && (
          <div>
            <label
              htmlFor="filter-occupation"
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
            >
              {t('common.occupation', 'Occupation')}
            </label>
            <select
              id="filter-occupation"
              value={occupationFilter}
              onChange={(e) => onOccupationChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--slate-300)',
                fontSize: '0.78rem',
                backgroundColor: 'var(--slate-50)',
                color: 'var(--slate-800)',
                fontWeight: 500,
              }}
            >
              <option value="">{isHindi ? 'सभी व्यवसाय (9)' : 'All Occupations (9)'}</option>
              {filteredOccupations.map((o) => (
                <option key={o.id} value={o.id}>
                  {getOccupationDisplayName(o.title, isHindi)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Horizon Filter (conditional) */}
        {showHorizon && (
          <div>
            <label
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
            >
              {t('common.horizon', 'Forecast Horizon')}
            </label>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--slate-100)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--slate-300)',
              }}
            >
              {[3, 6, 12].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onHorizonChange(h)}
                  style={{
                    flex: 1,
                    border: 'none',
                    backgroundColor: horizonFilter === h ? '#0d9488' : 'transparent',
                    color: horizonFilter === h ? '#ffffff' : 'var(--slate-600)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.3rem 0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  +{h}M
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
