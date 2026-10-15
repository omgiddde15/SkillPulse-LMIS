import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import Icon from './Icon';
import { postSeatAllocation, createSavedScenario } from '../api/client';
import { exportSimulationPlanCsv } from '../utils/exportCsv';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'TS', name: 'Telangana' },
];

const DISTRICTS = [
  { id: 'KA_BLR_U', name: 'Bengaluru Urban', state: 'KA', stateName: 'Karnataka' },
  { id: 'KA_DHA', name: 'Dharwad', state: 'KA', stateName: 'Karnataka' },
  { id: 'MH_MUM', name: 'Mumbai Suburban', state: 'MH', stateName: 'Maharashtra' },
  { id: 'MH_PUN', name: 'Pune', state: 'MH', stateName: 'Maharashtra' },
  { id: 'TS_HYD', name: 'Hyderabad', state: 'TS', stateName: 'Telangana' },
  { id: 'TS_MED', name: 'Medchal-Malkajgiri', state: 'TS', stateName: 'Telangana' },
];

const SECTORS = ['IT/ITeS', 'Manufacturing', 'Logistics'];

const OCCUPATIONS = [
  { id: 'OCC_IT_001', title: 'Cloud Infrastructure Associate', sector: 'IT/ITeS', trade: 'Cloud Computing' },
  { id: 'OCC_IT_002', title: 'Data Quality Analyst', sector: 'IT/ITeS', trade: 'Data & Analytics' },
  { id: 'OCC_IT_003', title: 'Full-Stack Web Developer', sector: 'IT/ITeS', trade: 'Software Engineering' },
  { id: 'OCC_MFG_001', title: 'CNC Machine Operator', sector: 'Manufacturing', trade: 'Precision Machining' },
  { id: 'OCC_MFG_002', title: 'Industrial Automation Technician', sector: 'Manufacturing', trade: 'Mechatronics' },
  { id: 'OCC_MFG_003', title: 'Electric Vehicle Assembly Technician', sector: 'Manufacturing', trade: 'Automotive' },
  { id: 'OCC_LOG_001', title: 'Warehouse Inventory Coordinator', sector: 'Logistics', trade: 'Warehousing' },
  { id: 'OCC_LOG_002', title: 'Cold Chain Logistics Supervisor', sector: 'Logistics', trade: 'Cold Chain' },
  { id: 'OCC_LOG_003', title: 'Fleet Dispatcher', sector: 'Logistics', trade: 'Fleet Management' },
];

const AVAILABLE_PERIODS = ['2026-09', '2026-08', '2026-07', '2026-06'];

/**
 * Calculates target evaluation period from base period and horizon months
 */
function calculateTargetPeriod(basePeriod, horizonMonths) {
  if (!basePeriod || !basePeriod.includes('-')) return '';
  const [yearStr, monthStr] = basePeriod.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + parseInt(horizonMonths, 10);
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function SeatSimulator({
  period = '2026-09',
  onPeriodChange,
  initialDistrict,
  initialOccupation,
  initialHorizon,
  initialScenario,
  onNavigate,
}) {
  const { t, isHindi } = useLanguage();
  const { isAuthenticated } = useAuth();

  // Save Scenario State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Form State
  const [basePeriod, setBasePeriod] = useState(period);
  const [prevPeriodProp, setPrevPeriodProp] = useState(period);
  const [horizonMonths, setHorizonMonths] = useState(initialHorizon ? Number(initialHorizon) : 3);
  const [selectedState, setSelectedState] = useState(() => {
    if (initialDistrict) {
      const match = DISTRICTS.find((d) => d.id === initialDistrict);
      if (match) return match.state;
    }
    return 'KA';
  });
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict || 'KA_BLR_U');
  const [selectedSector, setSelectedSector] = useState(() => {
    if (initialOccupation) {
      const match = OCCUPATIONS.find((o) => o.id === initialOccupation);
      if (match) return match.sector;
    }
    return 'IT/ITeS';
  });
  const [selectedOccupation, setSelectedOccupation] = useState(initialOccupation || 'OCC_IT_001');
  const [proposedSeats, setProposedSeats] = useState(150);

  // Synchronize when initial props change externally
  useEffect(() => {
    if (initialDistrict) {
      const match = DISTRICTS.find((d) => d.id === initialDistrict);
      if (match) {
        setSelectedState(match.state);
        setSelectedDistrict(initialDistrict);
      }
    }
  }, [initialDistrict]);

  useEffect(() => {
    if (initialOccupation) {
      const match = OCCUPATIONS.find((o) => o.id === initialOccupation);
      if (match) {
        setSelectedSector(match.sector);
        setSelectedOccupation(initialOccupation);
      }
    }
  }, [initialOccupation]);

  useEffect(() => {
    if (initialHorizon) {
      setHorizonMonths(Number(initialHorizon));
    }
  }, [initialHorizon]);


  // Localization display helpers
  const getStateDisplayName = (s) => {
    if (!isHindi) return `${s.name} (${s.code})`;
    if (s.code === 'KA') return 'कर्नाटक (KA)';
    if (s.code === 'MH') return 'महाराष्ट्र (MH)';
    if (s.code === 'TS') return 'तेलंगाना (TS)';
    return `${s.name} (${s.code})`;
  };

  const getDistrictDisplayName = (d) => {
    if (!isHindi) return `${d.name} (${d.id})`;
    if (d.id === 'KA_BLR_U') return 'बेंगलुरु शहरी (KA_BLR_U)';
    if (d.id === 'KA_DHA') return 'धारवाड़ (KA_DHA)';
    if (d.id === 'MH_MUM') return 'मुंबई उपनगरीय (MH_MUM)';
    if (d.id === 'MH_PUN') return 'पुणे (MH_PUN)';
    if (d.id === 'TS_HYD') return 'हैदराबाद (TS_HYD)';
    if (d.id === 'TS_MED') return 'मेदचल-मलकाजगिरि (TS_MED)';
    return `${d.name} (${d.id})`;
  };

  const getSectorDisplayName = (sec) => {
    if (!isHindi) return sec;
    if (sec === 'IT/ITeS') return 'आईटी / आईटीईएस (IT/ITeS)';
    if (sec === 'Manufacturing') return 'विनिर्माण (Manufacturing)';
    if (sec === 'Logistics') return 'लॉजिस्टिक्स (Logistics)';
    return sec;
  };

  const getClassificationLabel = (cls) => {
    if (!cls) return '';
    if (!isHindi) return cls;
    const lower = cls.toLowerCase();
    if (lower.includes('demand')) return t('class.demandPressure');
    if (lower.includes('supply')) return t('class.supplyPressure');
    if (lower.includes('balanced')) return t('class.balanced');
    return cls;
  };

  // Assumption-Adjusted Pipeline Scenario Parameters (Neutral baseline defaults)
  const [kMultiplier, setKMultiplier] = useState(1.0);
  const [alphaFactor, setAlphaFactor] = useState(1.0);

  // Execution & API State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [previousScenario, setPreviousScenario] = useState(null);

  // Load external saved scenario if reopened from My Workspace
  useEffect(() => {
    if (initialScenario) {
      if (initialScenario.period) setBasePeriod(initialScenario.period);
      if (initialScenario.horizon_months) setHorizonMonths(Number(initialScenario.horizon_months));
      if (initialScenario.district_id) {
        setSelectedDistrict(initialScenario.district_id);
        const match = DISTRICTS.find((d) => d.id === initialScenario.district_id);
        if (match) setSelectedState(match.state);
      }
      if (initialScenario.occupation_id) {
        setSelectedOccupation(initialScenario.occupation_id);
        const match = OCCUPATIONS.find((o) => o.id === initialScenario.occupation_id);
        if (match) setSelectedSector(match.sector);
      }
      if (initialScenario.proposed_seats_per_cohort) {
        setProposedSeats(initialScenario.proposed_seats_per_cohort);
      }
      if (initialScenario.posting_to_opening_multiplier != null) {
        setKMultiplier(initialScenario.posting_to_opening_multiplier);
      }
      if (initialScenario.local_availability_factor != null) {
        setAlphaFactor(initialScenario.local_availability_factor);
      }
      if (initialScenario.results) {
        setCurrentScenario(initialScenario.results);
      }
    }
  }, [initialScenario]);

  // Sync prop period if changed externally during render
  if (period !== prevPeriodProp) {
    setPrevPeriodProp(period);
    setBasePeriod(period);
  }

  // Filtered district options based on selected state
  const availableDistricts = useMemo(() => {
    if (!selectedState) return DISTRICTS;
    return DISTRICTS.filter((d) => d.state === selectedState);
  }, [selectedState]);

  // Filtered occupation options based on selected sector
  const availableOccupations = useMemo(() => {
    if (!selectedSector) return OCCUPATIONS;
    return OCCUPATIONS.filter((o) => o.sector === selectedSector);
  }, [selectedSector]);

  // Selected entities for display
  const currentDistrictObj = useMemo(() => {
    return DISTRICTS.find((d) => d.id === selectedDistrict) || null;
  }, [selectedDistrict]);

  const currentOccupationObj = useMemo(() => {
    return OCCUPATIONS.find((o) => o.id === selectedOccupation) || null;
  }, [selectedOccupation]);

  const projectedTargetMonth = useMemo(() => {
    return calculateTargetPeriod(basePeriod, horizonMonths);
  }, [basePeriod, horizonMonths]);

  // Immediate reactive calculation for Assumption-Adjusted Pipeline Scenario
  const scenarioCoverage = useMemo(() => {
    if (!currentScenario?.baseline_projection) return null;
    const postings = currentScenario.baseline_projection.forecast_demand_postings;
    const baseSupply = currentScenario.baseline_projection.forecast_supply_throughput;
    const scenSupply = currentScenario.scenario_projection?.scenario_supply_throughput;

    const k = Number(kMultiplier) || 1.0;
    const alpha = Number(alphaFactor) || 1.0;

    if (postings === null || postings === undefined || postings <= 0 || baseSupply == null || scenSupply == null) {
      return {
        isValid: false,
        k,
        alpha,
        postings: postings ?? 0,
        estimatedOpenings: postings && postings > 0 ? Math.round(postings * k * 10) / 10 : null,
        baselineEffectiveOutput: baseSupply != null ? Math.round(baseSupply * alpha * 10) / 10 : null,
        scenarioEffectiveOutput: scenSupply != null ? Math.round(scenSupply * alpha * 10) / 10 : null,
        baselineCoveragePct: null,
        scenarioCoveragePct: null,
        coveragePctDelta: null,
        baselineBenchmarkRatio: null,
        scenarioBenchmarkRatio: null,
        benchmarkRatioDelta: null,
      };
    }

    const estimatedOpenings = Math.round(postings * k * 10) / 10;
    const baseEffective = Math.round(baseSupply * alpha * 10) / 10;
    const scenEffective = Math.round(scenSupply * alpha * 10) / 10;

    const baseCov = estimatedOpenings > 0 ? Math.round((baseEffective / estimatedOpenings) * 1000) / 10 : 0;
    const scenCov = estimatedOpenings > 0 ? Math.round((scenEffective / estimatedOpenings) * 1000) / 10 : 0;
    const covDelta = Math.round((scenCov - baseCov) * 10) / 10;

    const baseRatio = Math.round((baseSupply / postings) * 1000) / 10;
    const scenRatio = Math.round((scenSupply / postings) * 1000) / 10;
    const ratioDelta = Math.round((scenRatio - baseRatio) * 10) / 10;

    return {
      isValid: true,
      k,
      alpha,
      postings,
      estimatedOpenings,
      baselineSupply: baseSupply,
      scenarioSupply: scenSupply,
      baselineEffectiveOutput: baseEffective,
      scenarioEffectiveOutput: scenEffective,
      baselineCoveragePct: baseCov,
      scenarioCoveragePct: scenCov,
      coveragePctDelta: covDelta,
      baselineBenchmarkRatio: baseRatio,
      scenarioBenchmarkRatio: scenRatio,
      benchmarkRatioDelta: ratioDelta,
    };
  }, [currentScenario, kMultiplier, alphaFactor]);

  // Handle cascading state change
  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    const matchingDistricts = newState ? DISTRICTS.filter((d) => d.state === newState) : DISTRICTS;
    if (matchingDistricts.length > 0) {
      const currentStillValid = matchingDistricts.some((d) => d.id === selectedDistrict);
      if (!currentStillValid) {
        setSelectedDistrict(matchingDistricts[0].id);
      }
    } else {
      setSelectedDistrict('');
    }
  };

  // Handle cascading sector change
  const handleSectorChange = (e) => {
    const newSector = e.target.value;
    setSelectedSector(newSector);
    const matchingOccupations = newSector ? OCCUPATIONS.filter((o) => o.sector === newSector) : OCCUPATIONS;
    if (matchingOccupations.length > 0) {
      const currentStillValid = matchingOccupations.some((o) => o.id === selectedOccupation);
      if (!currentStillValid) {
        setSelectedOccupation(matchingOccupations[0].id);
      }
    } else {
      setSelectedOccupation('');
    }
  };

  // Preset adjustments for proposed seats
  const adjustSeats = (delta) => {
    setProposedSeats((prev) => {
      const val = Number(prev) || 0;
      const nextVal = Math.max(1, Math.min(5000, Math.round(val + delta)));
      return nextVal;
    });
  };

  const scaleSeatsPercent = (pct) => {
    setProposedSeats((prev) => {
      const val = Number(prev) || 0;
      const nextVal = Math.max(1, Math.min(5000, Math.round(val * (1 + pct / 100))));
      return nextVal;
    });
  };

  // Form submission / simulation trigger
  const handleRunScenario = useCallback(async () => {
    // Client-side validations
    const seatNum = parseInt(proposedSeats, 10);
    if (isNaN(seatNum) || seatNum < 1 || seatNum > 5000) {
      setErrorMessage('Proposed seats must be a positive integer between 1 and 5,000.');
      return;
    }
    if (!selectedDistrict) {
      setErrorMessage('Please select a valid district.');
      return;
    }
    if (!selectedOccupation) {
      setErrorMessage('Please select a valid occupation.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const payload = {
      period: basePeriod,
      horizon_months: Number(horizonMonths),
      district_id: selectedDistrict,
      occupation_id: selectedOccupation,
      proposed_seats_per_cohort: seatNum,
      posting_to_opening_multiplier: Number(kMultiplier),
      local_availability_factor: Number(alphaFactor),
    };

    try {
      const result = await postSeatAllocation(payload);
      // Keep previous scenario for reference if different
      if (currentScenario) {
        setPreviousScenario(currentScenario);
      }
      setCurrentScenario(result);
    } catch (err) {
      setErrorMessage(err.message || 'Simulation request failed. Please verify API availability.');
    } finally {
      setIsLoading(false);
    }
  }, [basePeriod, horizonMonths, selectedDistrict, selectedOccupation, proposedSeats, kMultiplier, alphaFactor, currentScenario]);

  const handleExportPlan = useCallback(() => {
    if (!currentScenario) return;
    exportSimulationPlanCsv({
      scenario: currentScenario,
      kMultiplier: Number(kMultiplier) || 1.0,
      alphaFactor: Number(alphaFactor) || 1.0,
      scenarioCoverage,
      isHindi,
    });
  }, [currentScenario, kMultiplier, alphaFactor, scenarioCoverage, isHindi]);

  const handleOpenSaveModal = () => {
    if (!isAuthenticated) {
      setIsAuthPromptOpen(true);
      return;
    }
    const distName = currentDistrictObj?.name || selectedDistrict;
    const occTitle = currentOccupationObj?.title || selectedOccupation;
    setSaveTitle(`${distName} — ${occTitle} (+${proposedSeats} seats)`);
    setSaveNotes('');
    setSaveError(null);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!saveTitle.trim()) {
      setSaveError(isHindi ? 'परिदृश्य शीर्षक आवश्यक है।' : 'Scenario title is required.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        title: saveTitle.trim(),
        notes: saveNotes.trim(),
        period: basePeriod,
        district_id: selectedDistrict,
        district_name: currentDistrictObj?.name || selectedDistrict,
        state_code: selectedState,
        occupation_id: selectedOccupation,
        occupation_title: currentOccupationObj?.title || selectedOccupation,
        horizon_months: Number(horizonMonths),
        proposed_seats_per_cohort: Number(proposedSeats),
        posting_to_opening_multiplier: Number(kMultiplier),
        local_availability_factor: Number(alphaFactor),
        inputs: {
          period: basePeriod,
          district_id: selectedDistrict,
          occupation_id: selectedOccupation,
          horizon_months: Number(horizonMonths),
          target_period: projectedTargetMonth,
          proposed_seats_per_cohort: Number(proposedSeats),
          posting_to_opening_multiplier: Number(kMultiplier),
          local_availability_factor: Number(alphaFactor),
        },
        results: currentScenario,
      };
      await createSavedScenario(payload);
      setSaveFeedback(
        isHindi
          ? 'परिदृश्य आपके व्यक्तिगत कार्यक्षेत्र में सहेजा गया!'
          : 'Scenario saved to your personal workspace successfully!'
      );
      setIsSaveModalOpen(false);
      setTimeout(() => setSaveFeedback(null), 5000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save scenario.');
    } finally {
      setIsSaving(false);
    }
  };

  // Automatically execute default simulation on initial component mount
  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const payload = {
          period: basePeriod,
          horizon_months: Number(horizonMonths),
          district_id: selectedDistrict,
          occupation_id: selectedOccupation,
          proposed_seats_per_cohort: 150,
          posting_to_opening_multiplier: 1.0,
          local_availability_factor: 1.0,
        };
        const res = await postSeatAllocation(payload);
        if (!ignore) {
          setCurrentScenario(res);
        }
      } catch {
        // Safe fallback; user can click Run Seat Simulation
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form to defaults and clear results
  const handleReset = () => {
    setBasePeriod(period || '2026-09');
    setHorizonMonths(3);
    setSelectedState('KA');
    setSelectedDistrict('KA_BLR_U');
    setSelectedSector('IT/ITeS');
    setSelectedOccupation('OCC_IT_001');
    setProposedSeats(150);
    setKMultiplier(1.0);
    setAlphaFactor(1.0);
    setErrorMessage(null);
    setCurrentScenario(null);
    setPreviousScenario(null);
  };

  // Helper for mismatch classification styling
  const getClassificationBadgeClass = (classification) => {
    if (!classification) return 'badge-classification';
    const lower = classification.toLowerCase();
    if (lower.includes('demand')) return 'badge-classification demand-pressure';
    if (lower.includes('supply')) return 'badge-classification supply-pressure';
    return 'badge-classification balanced';
  };

  return (
    <div className="simulator-container">
      {/* Intro Header */}
      <div className="page-intro-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="page-intro-title">{t('simulator.introTitle')}</h2>
          <span className="badge-coming-soon" style={{ backgroundColor: 'var(--teal-50)', color: 'var(--teal-800)', border: '1px solid var(--teal-200)' }}>
            {t('simulator.badge')}
          </span>
        </div>
        <p className="page-intro-desc">
          {t('simulator.introDesc')}
        </p>
      </div>

      {/* Simulator Parameter Configuration Form */}
      <div className="simulator-config-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('simulator.parametersHeader')}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('simulator.parametersDesc')}
            </p>
          </div>
          <button
            type="button"
            className="chip-btn"
            onClick={handleReset}
            title="Reset form to default values"
          >
            {t('simulator.resetDefaults')}
          </button>
        </div>

        <div className="simulator-config-grid">
          {/* Base Period */}
          <div className="simulator-field">
            <label htmlFor="sim-base-period" className="simulator-label">
              <span>{t('simulator.basePeriod')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.trailingCohorts')}</span>
            </label>
            <select
              id="sim-base-period"
              className="simulator-select"
              value={basePeriod}
              onChange={(e) => {
                setBasePeriod(e.target.value);
                if (onPeriodChange) onPeriodChange(e.target.value);
              }}
              disabled={isLoading}
            >
              {AVAILABLE_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p} {p === '2026-09' ? `(${t('common.activePilot')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Forecast Horizon */}
          <div className="simulator-field">
            <label htmlFor="sim-horizon" className="simulator-label">
              <span>{t('common.horizon')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.evaluationWindow')}</span>
            </label>
            <select
              id="sim-horizon"
              className="simulator-select"
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value))}
              disabled={isLoading}
            >
              <option value={3}>{isHindi ? '3 माह आगे' : '3 Months Ahead'}</option>
              <option value={6}>{isHindi ? '6 माह आगे' : '6 Months Ahead'}</option>
              <option value={12}>{isHindi ? '12 माह आगे' : '12 Months Ahead'}</option>
            </select>
          </div>

          {/* State */}
          <div className="simulator-field">
            <label htmlFor="sim-state" className="simulator-label">
              <span>{t('simulator.stateMission')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.geography')}</span>
            </label>
            <select
              id="sim-state"
              className="simulator-select"
              value={selectedState}
              onChange={handleStateChange}
              disabled={isLoading}
            >
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {getStateDisplayName(s)}
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div className="simulator-field">
            <label htmlFor="sim-district" className="simulator-label">
              <span>{t('common.district')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.localMarket')}</span>
            </label>
            <select
              id="sim-district"
              className="simulator-select"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={isLoading}
            >
              {availableDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {getDistrictDisplayName(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div className="simulator-field">
            <label htmlFor="sim-sector" className="simulator-label">
              <span>{t('common.sector')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.industry')}</span>
            </label>
            <select
              id="sim-sector"
              className="simulator-select"
              value={selectedSector}
              onChange={handleSectorChange}
              disabled={isLoading}
            >
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {getSectorDisplayName(sec)}
                </option>
              ))}
            </select>
          </div>

          {/* Occupation / Trade */}
          <div className="simulator-field">
            <label htmlFor="sim-occupation" className="simulator-label">
              <span>{t('simulator.occupationTrade')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.curriculum')}</span>
            </label>
            <select
              id="sim-occupation"
              className="simulator-select"
              value={selectedOccupation}
              onChange={(e) => setSelectedOccupation(e.target.value)}
              disabled={isLoading}
            >
              {availableOccupations.map((occ) => (
                <option key={occ.id} value={occ.id}>
                  {occ.title} ({occ.trade})
                </option>
              ))}
            </select>
          </div>

          {/* Proposed Seats */}
          <div className="simulator-field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="sim-seats" className="simulator-label">
              <span>{t('simulator.proposedSeatsLabel')}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t('simulator.seatsRange')}</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="sim-seats"
                type="number"
                min="1"
                max="5000"
                step="5"
                className="simulator-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, width: '160px' }}
                value={proposedSeats}
                onChange={(e) => setProposedSeats(e.target.value)}
                disabled={isLoading}
              />
              <div className="simulator-preset-chips">
                <button type="button" className="chip-btn" onClick={() => adjustSeats(-20)} disabled={isLoading}>-20</button>
                <button type="button" className="chip-btn" onClick={() => adjustSeats(-10)} disabled={isLoading}>-10</button>
                <button type="button" className="chip-btn" onClick={() => adjustSeats(+10)} disabled={isLoading}>+10</button>
                <button type="button" className="chip-btn" onClick={() => adjustSeats(+25)} disabled={isLoading}>+25</button>
                <button type="button" className="chip-btn" onClick={() => adjustSeats(+50)} disabled={isLoading}>+50</button>
                <button type="button" className="chip-btn" onClick={() => scaleSeatsPercent(+25)} disabled={isLoading}>+25%</button>
                <button type="button" className="chip-btn" onClick={() => scaleSeatsPercent(+50)} disabled={isLoading}>+50%</button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Target Context Preview Banner */}
        <div className="simulator-context-preview">
          <div className="preview-target-info">
            <span className="preview-tag">
              <Icon name="pin" size={13} /> <strong>{currentDistrictObj ? (isHindi ? getDistrictDisplayName(currentDistrictObj) : currentDistrictObj.name) : selectedDistrict}</strong> ({currentDistrictObj ? (isHindi ? getStateDisplayName({ code: currentDistrictObj.state, name: currentDistrictObj.stateName }) : currentDistrictObj.stateName) : selectedState})
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="preview-tag">
              <Icon name="briefcase" size={13} /> <strong>{currentOccupationObj ? currentOccupationObj.title : selectedOccupation}</strong> ({currentOccupationObj ? currentOccupationObj.trade : ''})
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="preview-tag">
              <Icon name="calendar" size={13} /> {t('simulator.basePeriod')}: <strong>{basePeriod}</strong> &rarr; {t('simulator.targetPeriod')}: <strong>{projectedTargetMonth}</strong> (+{horizonMonths}m)
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="preview-tag">
              <Icon name="target" size={13} /> {t('simulator.proposedIntake')}: <strong>{proposedSeats || 0}</strong> {t('simulator.seatsUnits', { count: '' }).trim()}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {t('simulator.code')} {selectedDistrict} / {selectedOccupation}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="simulator-actions-row">
          {currentScenario && (
            <button
              type="button"
              className="btn-secondary-simulator"
              onClick={handleReset}
              disabled={isLoading}
            >
              {t('simulator.clearResults')}
            </button>
          )}

          <button
            type="button"
            className="btn-primary-simulator"
            onClick={handleRunScenario}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                <span>{t('simulator.simulatingBtn')}</span>
              </>
            ) : (
              <>
                <span>{t('simulator.simulateBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert Display */}
      {errorMessage && (
        <ErrorAlert
          message={errorMessage}
          onRetry={handleRunScenario}
        />
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <LoadingSpinner message={t('simulator.spinnerMsg')} />
      )}

      {/* Simulation Results Display */}
      {currentScenario && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metadata Banner & Previous Run Comparison */}
          <div className="scenario-meta-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="scenario-id-tag">ID: {currentScenario.scenario_id}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('simulator.metaEvaluated', { target: currentScenario.parameters?.target_period, h: currentScenario.parameters?.horizon_months })}
              </span>
              <span className="badge-coming-soon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', border: '1px solid var(--status-success-border)' }}>
                {t('simulator.status', { status: currentScenario.status?.toUpperCase() })}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{t('simulator.scalingRatio', { ratio: currentScenario.proposed_seat_allocation?.scaling_ratio?.toFixed(4) })}</span>
              </div>
              <button
                type="button"
                className="btn-export"
                onClick={handleExportPlan}
                title={t('simulator.exportPlanTitle')}
              >
                <Icon name="download" size={14} />
                <span>{t('simulator.exportBtn')}</span>
              </button>

              <button
                type="button"
                className="btn-save-scenario"
                onClick={handleOpenSaveModal}
                title={isAuthenticated ? (isHindi ? 'परिदृश्य सहेजें' : 'Save Scenario to Workspace') : (isHindi ? 'सहेजने के लिए साइन इन करें' : 'Sign In to Save Scenario')}
              >
                <Icon name="bookmark" size={14} />
                <span>{isHindi ? 'परिदृश्य सहेजें' : 'Save Scenario'}</span>
              </button>
            </div>
          </div>

          {/* Save Scenario Feedback Alert */}
          {saveFeedback && (
            <div className="auth-alert success" style={{ margin: '0.25rem 0' }}>
              <Icon name="check-circle" size={16} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>{saveFeedback}</span>
                {onNavigate && (
                  <button
                    type="button"
                    className="auth-link-btn"
                    style={{ fontSize: '0.8rem', fontWeight: 700 }}
                    onClick={() => onNavigate('workspace')}
                  >
                    {isHindi ? 'कार्यक्षेत्र में देखें →' : 'View in My Workspace →'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Previous Run Comparison Diff Banner (if user iterated) */}
          {previousScenario && previousScenario.scenario_id !== currentScenario.scenario_id && (
            <div className="prev-scenario-banner">
              <div>
                <strong>{isHindi ? 'पुनरावृत्ति परिदृश्य तुलना:' : 'Iterative Scenario Comparison:'}</strong> {isHindi ? `पिछले परीक्षण में ${previousScenario.proposed_seat_allocation?.proposed_seats_per_cohort} सीटें थीं (असंतुलन: ${previousScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} अंक) → वर्तमान परीक्षण में ${currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort} सीटें हैं (असंतुलन: ${currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} अंक)।` : `Previous test had ${previousScenario.proposed_seat_allocation?.proposed_seats_per_cohort} seats (Mismatch: ${previousScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} pt) → Current run evaluates ${currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort} seats (Mismatch: ${currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} pt).`}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-800)' }}>
                &Delta; Output: {(currentScenario.scenario_projection?.scenario_supply_throughput - previousScenario.scenario_projection?.scenario_supply_throughput).toFixed(1)} {isHindi ? '/माह' : '/mo'}
              </div>
            </div>
          )}

          {/* Top KPI Ribbon */}
          <div className="scenario-kpi-grid">
            {/* Sanctioned Seats KPI */}
            <div className="scenario-kpi-card accent-delta-pos">
              <div className="kpi-title">{t('simulator.kpiBatchCapacity')}</div>
              <div className="kpi-metric-row">
                <span className="kpi-metric-val">
                  {currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort}
                </span>
                <span className={`kpi-metric-delta ${currentScenario.proposed_seat_allocation?.absolute_seat_delta >= 0 ? 'positive' : 'negative'}`}>
                  {currentScenario.proposed_seat_allocation?.absolute_seat_delta >= 0 ? '+' : ''}
                  {currentScenario.proposed_seat_allocation?.absolute_seat_delta?.toFixed(1)}
                  {' '}({currentScenario.proposed_seat_allocation?.percentage_seat_change >= 0 ? '+' : ''}{currentScenario.proposed_seat_allocation?.percentage_seat_change?.toFixed(1)}%)
                </span>
              </div>
              <div className="kpi-subtext">
                {t('simulator.kpiBaselineAvg', { avg: currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort?.toFixed(1) })}
              </div>
            </div>

            {/* Candidate Throughput KPI */}
            <div className="scenario-kpi-card accent-delta-pos">
              <div className="kpi-title">{t('simulator.kpiCertifiedOutput')}</div>
              <div className="kpi-metric-row">
                <span className="kpi-metric-val">
                  {currentScenario.scenario_projection?.scenario_supply_throughput?.toFixed(1)}
                </span>
                <span className={`kpi-metric-delta ${currentScenario.impact_summary?.supply_throughput_delta >= 0 ? 'positive' : 'negative'}`}>
                  {currentScenario.impact_summary?.supply_throughput_delta >= 0 ? '+' : ''}
                  {currentScenario.impact_summary?.supply_throughput_delta?.toFixed(1)}/mo
                  {' '}({currentScenario.impact_summary?.supply_throughput_pct_change >= 0 ? '+' : ''}{currentScenario.impact_summary?.supply_throughput_pct_change?.toFixed(1)}%)
                </span>
              </div>
              <div className="kpi-subtext">
                {t('simulator.kpiBaselineOutput', { base: currentScenario.baseline_projection?.forecast_supply_throughput?.toFixed(1) })}
              </div>
            </div>

            {/* Regional Supply Rank KPI */}
            <div className="scenario-kpi-card accent-delta-neg">
              <div className="kpi-title">{t('simulator.kpiSupplyRank')}</div>
              <div className="kpi-metric-row">
                <span className="kpi-metric-val">
                  {currentScenario.scenario_projection?.scenario_supply_rank?.toFixed(1)}
                </span>
                <span className={`kpi-metric-delta ${currentScenario.impact_summary?.supply_rank_delta >= 0 ? 'positive' : 'neutral'}`}>
                  {currentScenario.impact_summary?.supply_rank_delta >= 0 ? '+' : ''}
                  {currentScenario.impact_summary?.supply_rank_delta?.toFixed(1)} {t('common.pts')}
                </span>
              </div>
              <div className="kpi-subtext">
                {t('simulator.kpiBaselineRank', { rank: currentScenario.baseline_projection?.forecast_supply_rank?.toFixed(1) })}
              </div>
            </div>

            {/* Relative Mismatch Score KPI */}
            <div
              className="scenario-kpi-card accent-transition"
              title="Projected Mismatch = Baseline Demand Postings Rank (0–100) − Scenario Supply Throughput Rank (0–100). Range: −100 to +100 points."
            >
              <div className="kpi-title">{t('simulator.kpiProjectedMismatch')}</div>
              <div className="kpi-metric-row">
                <span className="kpi-metric-val">
                  {currentScenario.scenario_projection?.scenario_mismatch_score >= 0 ? '+' : ''}
                  {currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)}
                </span>
                <span className={`kpi-metric-delta ${currentScenario.impact_summary?.mismatch_score_delta < 0 ? 'negative' : 'positive'}`}>
                  {currentScenario.impact_summary?.mismatch_score_delta >= 0 ? '+' : ''}
                  {currentScenario.impact_summary?.mismatch_score_delta?.toFixed(2)} {t('common.pts')}
                </span>
              </div>
              <div className="kpi-subtext">
                {t('common.classification')}: {getClassificationLabel(currentScenario.scenario_projection?.scenario_classification)} • {t('simulator.baselineLabel')} {currentScenario.baseline_projection?.mismatch_score >= 0 ? '+' : ''}{currentScenario.baseline_projection?.mismatch_score?.toFixed(2)} {t('common.pts')}
              </div>
            </div>
          </div>

          {/* Section A & B: Side-by-Side Detailed Breakdown */}
          <div className="comparison-layout">
            {/* Box 1: Baseline Architecture */}
            <div className="comparison-box">
              <div className="comparison-box-header baseline">
                <span className="comparison-box-title">{t('simulator.boxHistoricalBaseline')}</span>
                <span className={getClassificationBadgeClass(currentScenario.baseline_projection?.classification)}>
                  {getClassificationLabel(currentScenario.baseline_projection?.classification)}
                </span>
              </div>
              <table className="comparison-table">
                <tbody>
                  <tr>
                    <td className="col-label">{t('simulator.thConcludingCohorts')}</td>
                    <td className="col-val">
                      {currentScenario.baseline_seat_allocation?.recent_cohort_periods?.join(', ') || 'N/A'} (3 {isHindi ? 'अवधियां' : 'periods'})
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thAvgSanctionedSeats')}</td>
                    <td className="col-val">
                      {currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort?.toFixed(2)} {t('simulator.seatsUnits', { count: '' }).trim()}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thTotalSeatsBaseline', 'Total Seats in Baseline Window')}</td>
                    <td className="col-val">
                      {currentScenario.baseline_seat_allocation?.total_seats_in_window} {t('simulator.seatsUnits', { count: '' }).trim()}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thRecentMonthlyThroughput')}</td>
                    <td className="col-val">
                      {currentScenario.funnel_metrics?.current_monthly_throughput?.toFixed(1)} {isHindi ? 'प्रमाणित / माह' : 'certified / mo'}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thForecastDemandPostings', { h: currentScenario.parameters?.horizon_months })}</td>
                    <td className="col-val">
                      {currentScenario.baseline_projection?.forecast_demand_postings} {isHindi ? 'विज्ञापन' : 'postings'} ({t('common.rank')} {currentScenario.baseline_projection?.forecast_demand_rank?.toFixed(1)})
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thForecastCandidateOutput', { h: currentScenario.parameters?.horizon_months })}</td>
                    <td className="col-val">
                      {currentScenario.baseline_projection?.forecast_supply_throughput?.toFixed(1)} {isHindi ? 'प्रमाणित / माह' : 'certified / mo'}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thBaselineSupplyRank')}</td>
                    <td className="col-val">
                      {currentScenario.baseline_projection?.forecast_supply_rank?.toFixed(2)} {t('simulator.percentileUnits', { count: '' }).trim()}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thBaselineMismatchScore')}</td>
                    <td className="col-val" style={{ color: currentScenario.baseline_projection?.mismatch_score >= 15 ? '#c2410c' : currentScenario.baseline_projection?.mismatch_score <= -15 ? '#1d4ed8' : 'var(--text-primary)' }}>
                      {currentScenario.baseline_projection?.mismatch_score >= 0 ? '+' : ''}
                      {currentScenario.baseline_projection?.mismatch_score?.toFixed(2)} {t('common.pts')}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                        ({isHindi ? 'मांग रैंक' : 'Demand Rank'} {currentScenario.baseline_projection?.forecast_demand_rank?.toFixed(1)} − {isHindi ? 'आपूर्ति रैंक' : 'Supply Rank'} {currentScenario.baseline_projection?.forecast_supply_rank?.toFixed(1)})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Box 2: Proposed Scenario Model */}
            <div className="comparison-box">
              <div className="comparison-box-header scenario">
                <span className="comparison-box-title">{t('simulator.boxProposedScenario')}</span>
                <span className={getClassificationBadgeClass(currentScenario.scenario_projection?.scenario_classification)}>
                  {getClassificationLabel(currentScenario.scenario_projection?.scenario_classification)}
                </span>
              </div>
              <table className="comparison-table">
                <tbody>
                  <tr>
                    <td className="col-label">{t('simulator.thProposedBatchSeats')}</td>
                    <td className="col-val" style={{ color: 'var(--teal-800)' }}>
                      {currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort} {t('simulator.seatsUnits', { count: '' }).trim()}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thSeatCapacityAdjustment')}</td>
                    <td className="col-val">
                      {currentScenario.proposed_seat_allocation?.absolute_seat_delta >= 0 ? '+' : ''}
                      {currentScenario.proposed_seat_allocation?.absolute_seat_delta?.toFixed(1)} {t('simulator.seatsUnits', { count: '' }).trim()} ({currentScenario.proposed_seat_allocation?.percentage_seat_change >= 0 ? '+' : ''}{currentScenario.proposed_seat_allocation?.percentage_seat_change?.toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thCapacityScalingRatio')}</td>
                    <td className="col-val">
                      {currentScenario.proposed_seat_allocation?.scaling_ratio?.toFixed(4)}{t('simulator.baselineThroughputSuffix')}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thSimulatedOutput')}</td>
                    <td className="col-val" style={{ color: 'var(--teal-800)' }}>
                      {currentScenario.scenario_projection?.scenario_supply_throughput?.toFixed(1)} {isHindi ? 'प्रमाणित / माह' : 'certified / mo'}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thOutputShift')}</td>
                    <td className="col-val">
                      {currentScenario.impact_summary?.supply_throughput_delta >= 0 ? '+' : ''}
                      {currentScenario.impact_summary?.supply_throughput_delta?.toFixed(1)} {isHindi ? '/माह' : '/ mo'} ({currentScenario.impact_summary?.supply_throughput_pct_change >= 0 ? '+' : ''}{currentScenario.impact_summary?.supply_throughput_pct_change?.toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thProjectedSupplyRank')}</td>
                    <td className="col-val">
                      {currentScenario.scenario_projection?.scenario_supply_rank?.toFixed(2)} {t('simulator.percentileUnits', { count: '' }).trim()} (&Delta; {currentScenario.impact_summary?.supply_rank_delta >= 0 ? '+' : ''}{currentScenario.impact_summary?.supply_rank_delta?.toFixed(2)} {t('common.pts')})
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thProjectedMismatchScore')}</td>
                    <td className="col-val" style={{ color: currentScenario.scenario_projection?.scenario_mismatch_score >= 15 ? '#c2410c' : currentScenario.scenario_projection?.scenario_mismatch_score <= -15 ? '#1d4ed8' : 'var(--text-primary)' }}>
                      {currentScenario.scenario_projection?.scenario_mismatch_score >= 0 ? '+' : ''}
                      {currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} {t('common.pts')}
                    </td>
                  </tr>
                  <tr>
                    <td className="col-label">{t('simulator.thClassificationTransition')}</td>
                    <td className="col-val" style={{ fontWeight: 700 }}>
                      {currentScenario.impact_summary?.classification_transition}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section C: Assumption-Adjusted Pipeline Scenario Card */}
          <div className="card-panel" style={{ borderLeft: '4px solid var(--teal-600)' }}>
            <div className="card-panel-header" style={{ alignItems: 'flex-start' }}>
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2>{t('simulator.coverageTitle')}</h2>
                  <span className="badge-coming-soon" style={{ backgroundColor: 'var(--teal-50)', color: 'var(--teal-800)', border: '1px solid var(--teal-200)', fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                    {t('simulator.coverageBadge')}
                  </span>
                </div>
                <p>
                  {t('simulator.coverageDesc')}
                </p>
              </div>
              <button
                type="button"
                className="chip-btn"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                onClick={() => {
                  setKMultiplier(1.0);
                  setAlphaFactor(1.0);
                }}
                title="Reset scenario multipliers to neutral baseline (k=1.0, alpha=1.0)"
              >
                {t('simulator.resetAssumptions')}
              </button>
            </div>

            <div className="card-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Sliders Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                {/* Slider 1: k (posting-to-opening multiplier) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <label htmlFor="k-slider" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('simulator.sliderK')}
                    </label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-800)', backgroundColor: 'var(--bg-surface)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--teal-200)' }}>
                      {Number(kMultiplier).toFixed(2)}x
                    </span>
                  </div>
                  <input
                    id="k-slider"
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={kMultiplier}
                    onChange={(e) => setKMultiplier(parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--teal-600)', width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span>{t('simulator.sliderKLow')}</span>
                    <span>{t('simulator.sliderKMid')}</span>
                    <span>{t('simulator.sliderKHigh')}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                    {t('simulator.sliderKNote', { postings: scenarioCoverage?.postings ?? 'N/A', openings: scenarioCoverage?.estimatedOpenings ?? 'N/A' })}
                  </p>
                </div>

                {/* Slider 2: alpha (local availability factor) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <label htmlFor="alpha-slider" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('simulator.sliderAlpha')}
                    </label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-800)', backgroundColor: 'var(--bg-surface)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--teal-200)' }}>
                      {(Number(alphaFactor) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    id="alpha-slider"
                    type="range"
                    min="0.4"
                    max="1.0"
                    step="0.05"
                    value={alphaFactor}
                    onChange={(e) => setAlphaFactor(parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--teal-600)', width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span>{t('simulator.sliderAlphaLow')}</span>
                    <span>70%</span>
                    <span>{t('simulator.sliderAlphaHigh')}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                    {t('simulator.sliderAlphaNote')}
                  </p>
                </div>
              </div>

              {/* Scenario Coverage Metric KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {/* Metric 1: Estimated Openings */}
                <div className="funnel-step" style={{ backgroundColor: 'var(--bg-surface)', textAlign: 'left', padding: '0.85rem' }}>
                  <span className="funnel-step-name">{t('simulator.covEstOpenings')}</span>
                  <span className="funnel-step-rate" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                    {scenarioCoverage?.estimatedOpenings !== null && scenarioCoverage?.estimatedOpenings !== undefined ? `${scenarioCoverage.estimatedOpenings}` : 'N/A'}
                  </span>
                  <span className="funnel-step-desc">
                    {scenarioCoverage?.postings ?? 'N/A'} {isHindi ? 'विज्ञापन' : 'postings'} &times; {Number(kMultiplier).toFixed(2)}k
                  </span>
                </div>

                {/* Metric 2: Baseline Coverage */}
                <div className="funnel-step" style={{ backgroundColor: 'var(--bg-surface)', textAlign: 'left', padding: '0.85rem' }}>
                  <span className="funnel-step-name">{t('simulator.covBaseline')}</span>
                  <span className="funnel-step-rate" style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
                    {scenarioCoverage?.baselineCoveragePct !== null && scenarioCoverage?.baselineCoveragePct !== undefined ? `${scenarioCoverage.baselineCoveragePct.toFixed(1)}%` : 'N/A'}
                  </span>
                  <span className="funnel-step-desc">
                    {t('simulator.covLocalEffPerOpenings', { eff: scenarioCoverage?.baselineEffectiveOutput?.toFixed(1) ?? 'N/A', openings: scenarioCoverage?.estimatedOpenings ?? 'N/A' })}
                  </span>
                </div>

                {/* Metric 3: Proposed Scenario Coverage */}
                <div className="funnel-step" style={{ backgroundColor: 'var(--teal-50)', borderColor: 'var(--teal-200)', textAlign: 'left', padding: '0.85rem' }}>
                  <span className="funnel-step-name" style={{ color: 'var(--teal-800)' }}>{t('simulator.covProposed')}</span>
                  <span className="funnel-step-rate" style={{ color: 'var(--teal-900)', fontSize: '1.25rem' }}>
                    {scenarioCoverage?.scenarioCoveragePct !== null && scenarioCoverage?.scenarioCoveragePct !== undefined ? `${scenarioCoverage.scenarioCoveragePct.toFixed(1)}%` : 'N/A'}
                  </span>
                  <span className="funnel-step-desc" style={{ color: 'var(--teal-700)' }}>
                    {t('simulator.covLocalEffPerOpenings', { eff: scenarioCoverage?.scenarioEffectiveOutput?.toFixed(1) ?? 'N/A', openings: scenarioCoverage?.estimatedOpenings ?? 'N/A' })}
                  </span>
                </div>

                {/* Metric 4: Coverage Delta Shift */}
                <div className="funnel-step" style={{ backgroundColor: 'var(--bg-surface)', textAlign: 'left', padding: '0.85rem' }}>
                  <span className="funnel-step-name">{t('simulator.covShift')}</span>
                  <span className="funnel-step-rate" style={{ color: (scenarioCoverage?.coveragePctDelta ?? 0) >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)', fontSize: '1.25rem' }}>
                    {scenarioCoverage?.coveragePctDelta !== null && scenarioCoverage?.coveragePctDelta !== undefined ? `${scenarioCoverage.coveragePctDelta >= 0 ? '+' : ''}${scenarioCoverage.coveragePctDelta.toFixed(1)} ${t('common.pts')}` : 'N/A'}
                  </span>
                  <span className="funnel-step-desc">
                    {t('simulator.covShiftSub')}
                  </span>
                </div>
              </div>

              {/* Descriptive Training-to-Posting Benchmark Ratio Sub-row */}
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t('simulator.benchmarkRatioHeader')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {t('simulator.benchmarkRatioSub')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('simulator.baselineLabel')} </span>
                    <strong>{scenarioCoverage?.baselineBenchmarkRatio !== null && scenarioCoverage?.baselineBenchmarkRatio !== undefined ? `${scenarioCoverage.baselineBenchmarkRatio.toFixed(1)} ${t('simulator.candidatesPer100Postings')}` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--teal-700)', fontSize: '0.72rem' }}>{t('simulator.proposedLabel')} </span>
                    <strong style={{ color: 'var(--teal-800)' }}>{scenarioCoverage?.scenarioBenchmarkRatio !== null && scenarioCoverage?.scenarioBenchmarkRatio !== undefined ? `${scenarioCoverage.scenarioBenchmarkRatio.toFixed(1)} ${t('simulator.candidatesPer100Postings')}` : 'N/A'}</strong>
                    <span style={{ marginLeft: '0.35rem', color: (scenarioCoverage?.benchmarkRatioDelta ?? 0) >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)', fontWeight: 700 }}>
                      ({(scenarioCoverage?.benchmarkRatioDelta ?? 0) >= 0 ? '+' : ''}{scenarioCoverage?.benchmarkRatioDelta?.toFixed(1) ?? '0.0'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Guardrails and Disclaimers */}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>
                  {t('simulator.coverageCaveat')}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Empirical TVET Training Funnel Yields */}
          <div className="card-panel">
            <div className="card-panel-header">
              <div className="card-title-group">
                <h2>{t('simulator.funnelHeader')}</h2>
                <p>
                  {t('simulator.funnelDesc', { occupation: currentOccupationObj?.title, district: isHindi ? getDistrictDisplayName(currentDistrictObj) : currentDistrictObj?.name })}
                </p>
              </div>
            </div>
            <div className="funnel-container">
              <div className="funnel-step">
                <span className="funnel-step-name">{t('simulator.funnelSeatUtil')}</span>
                <span className="funnel-step-rate">
                  {currentScenario.funnel_metrics?.seat_utilization_rate !== null ? `${(currentScenario.funnel_metrics?.seat_utilization_rate * 100).toFixed(1)}%` : 'N/A'}
                </span>
                <span className="funnel-step-desc">{t('simulator.funnelEnrolSanctioned')}</span>
              </div>

              <div className="funnel-step">
                <span className="funnel-step-name">{t('simulator.funnelCompletion')}</span>
                <span className="funnel-step-rate">
                  {currentScenario.funnel_metrics?.completion_rate !== null ? `${(currentScenario.funnel_metrics?.completion_rate * 100).toFixed(1)}%` : 'N/A'}
                </span>
                <span className="funnel-step-desc">{t('simulator.funnelCompEnrol')}</span>
              </div>

              <div className="funnel-step">
                <span className="funnel-step-name">{t('simulator.funnelPass')}</span>
                <span className="funnel-step-rate">
                  {currentScenario.funnel_metrics?.certification_rate !== null ? `${(currentScenario.funnel_metrics?.certification_rate * 100).toFixed(1)}%` : 'N/A'}
                </span>
                <span className="funnel-step-desc">{t('simulator.funnelCertComp')}</span>
              </div>

              <div className="funnel-step" style={{ backgroundColor: 'var(--teal-50)', borderColor: 'var(--teal-200)' }}>
                <span className="funnel-step-name" style={{ color: 'var(--teal-800)' }}>{t('simulator.funnelYield')}</span>
                <span className="funnel-step-rate" style={{ color: 'var(--teal-900)' }}>
                  {currentScenario.funnel_metrics?.overall_yield_rate !== null ? `${(currentScenario.funnel_metrics?.overall_yield_rate * 100).toFixed(1)}%` : 'N/A'}
                </span>
                <span className="funnel-step-desc">{t('simulator.funnelCertSeats')}</span>
              </div>
            </div>
          </div>

          {/* Section D: Comparative Visualizer Bars */}
          <div className="visual-comparison-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('simulator.visualHeader')}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('simulator.visualDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#64748b', borderRadius: '2px' }}></span> {t('simulator.legendBaseline')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#0f766e', borderRadius: '2px' }}></span> {t('simulator.legendProposed')}
                </span>
              </div>
            </div>

            {/* 1. Sanctioned Seats Bar */}
            <div className="visual-row">
              <div className="visual-row-header">
                <span>{t('simulator.barSeats')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  &Delta; {currentScenario.proposed_seat_allocation?.absolute_seat_delta >= 0 ? '+' : ''}{currentScenario.proposed_seat_allocation?.absolute_seat_delta?.toFixed(1)} {t('simulator.seatsUnits', { count: '' }).trim()}
                </span>
              </div>
              <div className="visual-bars-pair">
                {/* Baseline Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag">{t('simulator.legendBaseline')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill baseline-color"
                      style={{
                        width: `${Math.min(100, Math.max(5, (currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort / Math.max(currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort, currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort, 200)) * 100))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text">
                    {currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort?.toFixed(1)}
                  </span>
                </div>
                {/* Scenario Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag" style={{ color: 'var(--teal-800)' }}>{t('simulator.legendProposed')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill scenario-color"
                      style={{
                        width: `${Math.min(100, Math.max(5, (currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort / Math.max(currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort, currentScenario.baseline_seat_allocation?.baseline_avg_seats_per_cohort, 200)) * 100))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text" style={{ color: 'var(--teal-800)' }}>
                    {currentScenario.proposed_seat_allocation?.proposed_seats_per_cohort}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Monthly Certified Throughput Bar */}
            <div className="visual-row">
              <div className="visual-row-header">
                <span>{t('simulator.barThroughput')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  &Delta; {currentScenario.impact_summary?.supply_throughput_delta >= 0 ? '+' : ''}{currentScenario.impact_summary?.supply_throughput_delta?.toFixed(1)} {isHindi ? '/माह' : '/ mo'}
                </span>
              </div>
              <div className="visual-bars-pair">
                {/* Baseline Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag">{t('simulator.legendBaseline')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill baseline-color"
                      style={{
                        width: `${Math.min(100, Math.max(5, (currentScenario.baseline_projection?.forecast_supply_throughput / Math.max(currentScenario.scenario_projection?.scenario_supply_throughput, currentScenario.baseline_projection?.forecast_supply_throughput, 150)) * 100))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text">
                    {currentScenario.baseline_projection?.forecast_supply_throughput?.toFixed(1)}
                  </span>
                </div>
                {/* Scenario Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag" style={{ color: 'var(--teal-800)' }}>{t('simulator.legendProposed')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill scenario-color"
                      style={{
                        width: `${Math.min(100, Math.max(5, (currentScenario.scenario_projection?.scenario_supply_throughput / Math.max(currentScenario.scenario_projection?.scenario_supply_throughput, currentScenario.baseline_projection?.forecast_supply_throughput, 150)) * 100))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text" style={{ color: 'var(--teal-800)' }}>
                    {currentScenario.scenario_projection?.scenario_supply_throughput?.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Regional Supply Percentile Rank Bar (0 to 100 scale) */}
            <div className="visual-row">
              <div className="visual-row-header">
                <span>{t('simulator.barSupplyRank')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  &Delta; {currentScenario.impact_summary?.supply_rank_delta >= 0 ? '+' : ''}{currentScenario.impact_summary?.supply_rank_delta?.toFixed(2)} {t('common.pts')}
                </span>
              </div>
              <div className="visual-bars-pair">
                {/* Baseline Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag">{t('simulator.legendBaseline')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill baseline-color"
                      style={{
                        width: `${Math.min(100, Math.max(2, currentScenario.baseline_projection?.forecast_supply_rank))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text">
                    {currentScenario.baseline_projection?.forecast_supply_rank?.toFixed(1)}
                  </span>
                </div>
                {/* Scenario Bar */}
                <div className="bar-track-wrapper">
                  <span className="bar-label-tag" style={{ color: 'var(--teal-800)' }}>{t('simulator.legendProposed')}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill scenario-color"
                      style={{
                        width: `${Math.min(100, Math.max(2, currentScenario.scenario_projection?.scenario_supply_rank))}%`,
                      }}
                    ></div>
                  </div>
                  <span className="bar-val-text" style={{ color: 'var(--teal-800)' }}>
                    {currentScenario.scenario_projection?.scenario_supply_rank?.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Relative Mismatch Score Gauge (-100 to +100 Scale) */}
            <div className="visual-row">
              <div className="visual-row-header">
                <span>{t('simulator.barMismatch')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  &Delta; {currentScenario.impact_summary?.mismatch_score_delta >= 0 ? '+' : ''}{currentScenario.impact_summary?.mismatch_score_delta?.toFixed(2)} {t('common.pts')}
                </span>
              </div>
              <div style={{ position: 'relative', width: '100%' }}>
                <div className="mismatch-scale-track">
                  {/* Baseline Marker */}
                  <div
                    className="mismatch-marker baseline"
                    style={{
                      left: `${Math.min(99, Math.max(1, ((currentScenario.baseline_projection?.mismatch_score + 100) / 200) * 100))}%`,
                    }}
                    title={`Baseline Score: ${currentScenario.baseline_projection?.mismatch_score?.toFixed(2)}`}
                  ></div>
                  {/* Scenario Marker */}
                  <div
                    className="mismatch-marker scenario"
                    style={{
                      left: `${Math.min(99, Math.max(1, ((currentScenario.scenario_projection?.scenario_mismatch_score + 100) / 200) * 100))}%`,
                    }}
                    title={`Scenario Score: ${currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)}`}
                  ></div>
                </div>

                <div className="mismatch-scale-legend">
                  <span style={{ color: 'var(--status-supply-text)' }}>{t('simulator.gaugeMaxSupply')}</span>
                  <span style={{ color: 'var(--status-supply)' }}>{t('simulator.gaugeThreshSupply')}</span>
                  <span style={{ color: 'var(--status-success-text)', fontWeight: 700 }}>{t('simulator.gaugeParity')}</span>
                  <span style={{ color: 'var(--status-demand)' }}>{t('simulator.gaugeThreshDemand')}</span>
                  <span style={{ color: 'var(--status-demand-text)' }}>{t('simulator.gaugeMaxDemand')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
                  <span>{t('simulator.legendBaseline')}: <strong>{currentScenario.baseline_projection?.mismatch_score?.toFixed(2)} {t('common.pts')}</strong> ({getClassificationLabel(currentScenario.baseline_projection?.classification)})</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#0d9488', display: 'inline-block' }} />
                  <span>{t('simulator.legendProposed')}: <strong>{currentScenario.scenario_projection?.scenario_mismatch_score?.toFixed(2)} {t('common.pts')}</strong> ({getClassificationLabel(currentScenario.scenario_projection?.scenario_classification)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Methodology, Constant-Yield Assumptions, & Policy Disclaimers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {/* Methodology & Assumptions */}
            <div className="callout-box" style={{ borderLeftColor: 'var(--teal-600)' }}>
              <h4>{t('simulator.calloutConstantYield')}</h4>
              <p style={{ marginBottom: '0.5rem', lineHeight: 1.5 }}>
                {currentScenario.assumptions}
              </p>
              <div style={{ backgroundColor: 'var(--accent-soft-bg)', border: '1px solid var(--accent-soft-border)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.6rem', fontSize: '0.73rem', color: 'var(--teal-800)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Icon name="sliders" size={14} />
                  <span>REAL SIMULATOR CALCULATION EQUATIONS:</span>
                </div>
                <div>1. Baseline Intake: S_baseline = Avg Sanctioned Seats across trailing 3 concluding cohorts</div>
                <div>2. Pipeline Funnel Yield: &eta; = Enrolment Rate &times; Completion Rate &times; Certification Rate</div>
                <div>3. Scaled Throughput: Scenario Output = Baseline Output &times; (Proposed Seats / S_baseline)</div>
                <div>4. Supply Percentile Rank: Cross-sectional rank recalculated across all 54 pilot series</div>
                <div>5. Projected Mismatch = Baseline Demand Rank (0–100) &minus; Scenario Supply Rank (0–100)</div>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                <strong>{t('simulator.calloutMethodology')}</strong> {currentScenario.methodology}
              </p>
            </div>

            {/* Decision-Support Caveats & Governance */}
            <div className="callout-box" style={{ borderLeftColor: 'var(--status-demand)', backgroundColor: 'var(--status-demand-bg)' }}>
              <h4 style={{ color: 'var(--status-demand-text)' }}>{t('simulator.calloutLeadTime')}</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {t('simulator.calloutLeadTimeDesc')}
              </p>
              <p style={{ fontSize: '0.74rem', color: 'var(--status-demand-text)' }}>
                <strong>{t('simulator.calloutIndexInterp')}</strong> {currentScenario.policy_disclaimer}
              </p>
            </div>
          </div>

          {/* Prototype Threshold Notice & Strategic Limitations */}
          <div className="callout-box" style={{ borderLeftColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}>
            <h4>{t('simulator.calloutThresholds')}</h4>
            <p style={{ marginBottom: '0.35rem' }}>
              {t('simulator.calloutThresholdsDesc')}
            </p>
            <p style={{ marginBottom: '0.35rem' }}>
              <strong>{t('simulator.calloutSaturation')}</strong> {t('simulator.calloutSaturationDesc')}
            </p>
            <p style={{ marginBottom: '0.35rem' }}>
              <strong>{t('simulator.calloutDistinction')}</strong> {t('simulator.calloutDistinctionDesc')}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <strong>{t('simulator.calloutLimitations')}</strong> {currentScenario.limitations}
            </p>
          </div>
        </div>
      )}

      {/* Save Scenario Modal for Authenticated Users */}
      {isSaveModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSaveModalOpen(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="auth-icon-badge" style={{ width: '32px', height: '32px' }}>
                  <Icon name="bookmark" size={16} />
                </div>
                <h3 className="modal-title">
                  {isHindi ? 'परिदृश्य सहेजें' : 'Save Scenario to Workspace'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSaveModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="auth-form" style={{ padding: '1.25rem' }}>
              {saveError && (
                <div className="auth-alert error" style={{ marginBottom: '1rem' }}>
                  <Icon name="alert-triangle" size={15} />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="auth-field-group">
                <label className="auth-label">
                  {isHindi ? 'परिदृश्य शीर्षक *' : 'Scenario Title *'}
                </label>
                <input
                  type="text"
                  className="auth-input"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Dharwad CNC Machining Q4 Expansion"
                  maxLength={150}
                  required
                  autoFocus
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-label">
                  {isHindi ? 'विवरण / योजना नोट्स (वैकल्पिक)' : 'Notes / Policy Rationale (Optional)'}
                </label>
                <textarea
                  className="auth-input"
                  rows={3}
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder={
                    isHindi
                      ? 'परिकल्पनाओं, बजट अनुमोदन या साझेदार आईटीआई का संदर्भ...'
                      : 'Reference target ITIs, budget allocation phase, or employer consortium agreements...'
                  }
                  maxLength={1000}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Summary tags */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.45rem',
                  fontSize: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span><strong>District:</strong> {currentDistrictObj?.name || selectedDistrict}</span>
                <span>•</span>
                <span><strong>Occupation:</strong> {currentOccupationObj?.title || selectedOccupation}</span>
                <span>•</span>
                <span><strong>Seats:</strong> +{proposedSeats}</span>
                <span>•</span>
                <span><strong>Horizon:</strong> {horizonMonths}M</span>
              </div>

              {/* Scientific Disclaimer Note */}
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                  marginBottom: '1.25rem',
                }}
              >
                <em>
                  Note: Saved scenarios represent mathematical training capacity projections based on pilot parameters, not verified real-world operational changes.
                </em>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="auth-ghost-btn"
                  onClick={() => setIsSaveModalOpen(false)}
                  disabled={isSaving}
                >
                  {isHindi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="auth-primary-btn"
                  style={{ padding: '0.55rem 1.25rem' }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Icon name="refresh" size={14} className="spinning-icon" />
                      <span>{isHindi ? 'सहेजा जा रहा है...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="bookmark" size={14} />
                      <span>{isHindi ? 'सहेजें' : 'Save Scenario'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal for Demo Visitors */}
      {isAuthPromptOpen && (
        <div className="modal-backdrop" onClick={() => setIsAuthPromptOpen(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="auth-icon-badge" style={{ width: '32px', height: '32px' }}>
                  <Icon name="lock" size={16} />
                </div>
                <h3 className="modal-title">
                  {isHindi ? 'साइन इन आवश्यक है' : 'Sign In Required'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAuthPromptOpen(false)}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.25rem' }}>
                {isHindi
                  ? 'आप वर्तमान में डेमो मोड में अन्वेषण कर रहे हैं। अनुकूलित परिदृश्यों को नाम देने, सहेजने और अपने व्यक्तिगत कार्यक्षेत्र में ट्रैक करने के लिए कृपया साइन इन करें।'
                  : 'You are currently testing the platform in Demo Mode. To save, name, compare, and preserve custom policy scenarios in your personal workspace, please sign in or create an account.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="auth-primary-btn"
                  onClick={() => {
                    setIsAuthPromptOpen(false);
                    if (onNavigate) onNavigate('login');
                  }}
                >
                  <Icon name="lock" size={14} />
                  <span>{isHindi ? 'साइन इन करें' : 'Sign In'}</span>
                </button>

                <button
                  type="button"
                  className="auth-demo-btn"
                  onClick={() => {
                    setIsAuthPromptOpen(false);
                    if (onNavigate) onNavigate('signup');
                  }}
                >
                  <Icon name="user" size={14} />
                  <span>{isHindi ? 'नया खाता बनाएं' : 'Create Free Account'}</span>
                </button>

                <button
                  type="button"
                  className="auth-ghost-btn"
                  style={{ alignSelf: 'center', marginTop: '0.25rem', fontSize: '0.78rem' }}
                  onClick={() => setIsAuthPromptOpen(false)}
                >
                  {isHindi ? 'डेमो मोड जारी रखें' : 'Continue in Demo Mode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
