import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  getDistrictDisplayName,
  getStateDisplayName,
  getOccupationDisplayName,
  getSectorDisplayName,
} from '../../i18n/translations';
import Icon from '../Icon';

const PILOT_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'TS', name: 'Telangana' },
];

const PILOT_DISTRICTS = [
  { id: 'KA_BLR_U', name: 'Bengaluru Urban', state: 'KA' },
  { id: 'KA_DHA', name: 'Dharwad', state: 'KA' },
  { id: 'MH_MUM', name: 'Mumbai Suburban', state: 'MH' },
  { id: 'MH_PUN', name: 'Pune', state: 'MH' },
  { id: 'TS_HYD', name: 'Hyderabad', state: 'TS' },
  { id: 'TS_MED', name: 'Medchal-Malkajgiri', state: 'TS' },
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

const MODULE_FILTER_VISIBILITY = {
  overview:        { state: true, district: true, sector: true, occupation: false, horizon: false },
  demand:          { state: true, district: true, sector: true, occupation: true,  horizon: false },
  gap:             { state: true, district: true, sector: true, occupation: true,  horizon: false },
  forecasts:       { state: true, district: true, sector: true, occupation: true,  horizon: true },
  alerts:          { state: true, district: true, sector: true, occupation: true,  horizon: true },
  recommendations: { state: false, district: false, sector: false, occupation: false, horizon: false },
  simulator:       { state: false, district: false, sector: false, occupation: false, horizon: false },
  districts:       { state: false, district: false, sector: false, occupation: false, horizon: false },
  occupations:     { state: false, district: false, sector: false, occupation: false, horizon: false },
  qualifications:  { state: false, district: false, sector: false, occupation: false, horizon: false },
  'data-health':   { state: false, district: false, sector: false, occupation: false, horizon: false },
  api:             { state: false, district: false, sector: false, occupation: false, horizon: false },
  settings:        { state: false, district: false, sector: false, occupation: false, horizon: false },
};

export default function ContextFilterBar({
  activeTab = 'overview',
  stateFilter = '',
  districtFilter = '',
  sectorFilter = '',
  occupationFilter = '',
  horizonFilter = 3,
  showOccupation,
  showHorizon,
  onStateChange,
  onDistrictChange,
  onSectorChange,
  onOccupationChange,
  onHorizonChange,
  onReset,
  onResetFilters,
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';
  const handleReset = onResetFilters || onReset;

  const baseVis = MODULE_FILTER_VISIBILITY[activeTab] || {
    state: true,
    district: true,
    sector: true,
    occupation: Boolean(showOccupation),
    horizon: Boolean(showHorizon),
  };

  const vis = {
    state: baseVis.state,
    district: baseVis.district,
    sector: baseVis.sector,
    occupation: showOccupation !== undefined ? Boolean(showOccupation) : baseVis.occupation,
    horizon: showHorizon !== undefined ? Boolean(showHorizon) : baseVis.horizon,
  };

  const hasAnyVisibleControl = vis.state || vis.district || vis.sector || vis.occupation || vis.horizon;
  if (!hasAnyVisibleControl) {
    return null;
  }

  const filteredDistricts = stateFilter
    ? PILOT_DISTRICTS.filter((d) => d.state === stateFilter)
    : PILOT_DISTRICTS;

  const filteredOccupations = sectorFilter
    ? PILOT_OCCUPATIONS.filter((o) => o.sector === sectorFilter)
    : PILOT_OCCUPATIONS;

  const hasActiveFilter = Boolean(
    (vis.state && stateFilter) ||
    (vis.district && districtFilter) ||
    (vis.sector && sectorFilter) ||
    (vis.occupation && occupationFilter) ||
    (vis.horizon && horizonFilter !== 3)
  );

  return (
    <div className="context-filter-bar">
      <div className="context-filter-header">
        <div className="context-filter-title">
          <Icon name="sliders" size={14} />
          <span>{isHindi ? 'संदर्भ फ़िल्टर' : 'Context Filters'}</span>
          <span className="context-filter-subtitle">
            ({isHindi ? 'पायलट कार्यबल दायरा' : 'Pilot Workforce Scope'})
          </span>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleReset}
            className="context-filter-reset-btn"
          >
            ✕ {t('common.resetFilters', 'Reset Filters')}
          </button>
        )}
      </div>

      <div className="context-filter-grid">
        {vis.state && (
          <div className="context-filter-field">
            <label htmlFor="filter-state" className="context-filter-label">
              {t('common.state', 'State')}
            </label>
            <select
              id="filter-state"
              value={stateFilter}
              onChange={(e) => {
                onStateChange(e.target.value);
                if (districtFilter) {
                  const dist = PILOT_DISTRICTS.find((d) => d.id === districtFilter);
                  if (dist && e.target.value && dist.state !== e.target.value) {
                    onDistrictChange('');
                  }
                }
              }}
              className="context-filter-select"
            >
              <option value="">{t('common.allStates', 'All States (3)')}</option>
              {PILOT_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {getStateDisplayName(s.code, isHindi)} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {vis.district && (
          <div className="context-filter-field">
            <label htmlFor="filter-district" className="context-filter-label">
              {t('common.district', 'District')}
            </label>
            <select
              id="filter-district"
              value={districtFilter}
              onChange={(e) => onDistrictChange(e.target.value)}
              className="context-filter-select"
            >
              <option value="">{t('common.allDistricts', 'All Districts')}</option>
              {filteredDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {getDistrictDisplayName(d.name, isHindi)} ({d.state})
                </option>
              ))}
            </select>
          </div>
        )}

        {vis.sector && (
          <div className="context-filter-field">
            <label htmlFor="filter-sector" className="context-filter-label">
              {t('common.sector', 'Sector')}
            </label>
            <select
              id="filter-sector"
              value={sectorFilter}
              onChange={(e) => {
                onSectorChange(e.target.value);
                if (occupationFilter) {
                  const occ = PILOT_OCCUPATIONS.find((o) => o.id === occupationFilter);
                  if (occ && e.target.value && occ.sector !== e.target.value) {
                    onOccupationChange('');
                  }
                }
              }}
              className="context-filter-select"
            >
              <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
              {PILOT_SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {getSectorDisplayName(sec, isHindi)}
                </option>
              ))}
            </select>
          </div>
        )}

        {vis.occupation && (
          <div className="context-filter-field">
            <label htmlFor="filter-occupation" className="context-filter-label">
              {t('common.occupation', 'Occupation')}
            </label>
            <select
              id="filter-occupation"
              value={occupationFilter}
              onChange={(e) => onOccupationChange(e.target.value)}
              className="context-filter-select"
            >
              <option value="">{isHindi ? 'सभी व्यवसाय (9)' : 'All Occupations (9)'}</option>
              {filteredOccupations.map((occ) => (
                <option key={occ.id} value={occ.id}>
                  {getOccupationDisplayName(occ.title, isHindi)}
                </option>
              ))}
            </select>
          </div>
        )}

        {vis.horizon && (
          <div className="context-filter-field">
            <label htmlFor="filter-horizon" className="context-filter-label">
              {t('common.horizon', 'Forecast Horizon')}
            </label>
            <select
              id="filter-horizon"
              value={horizonFilter}
              onChange={(e) => onHorizonChange(Number(e.target.value))}
              className="context-filter-select"
            >
              <option value={3}>+3 {isHindi ? 'माह (2026-12)' : 'Months (2026-12)'}</option>
              <option value={6}>+6 {isHindi ? 'माह (2027-03)' : 'Months (2027-03)'}</option>
              <option value={12}>+12 {isHindi ? 'माह (2027-09)' : 'Months (2027-09)'}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
