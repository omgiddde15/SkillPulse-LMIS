import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const MODULE_DETAILS = {
  demand: {
    title: 'Demand Intelligence Module',
    badge: 'Coming in Task 6B',
    icon: '📈',
    description:
      'Detailed drill-downs into employer online job posting volumes, trailing 3-month growth velocity, vacancy persistence, hiring employer diversity, and wage attractiveness index across monitored districts and trades.',
    specs: [
      'Multi-source posting volumes',
      'Trailing 3m vs prior 3m growth rates',
      'Cross-sectional percentile ranking',
      'Component driver decomposition',
    ],
  },
  gap: {
    title: 'Relative Gap Analysis & Mismatch Engine',
    badge: 'Coming in Task 6B',
    icon: '⚖️',
    description:
      'Granular comparative analysis between composite demand indices and cross-sectional training certification throughput. Includes cohort funnel rates, seat utilization, and strict 90-day placement maturity status.',
    specs: [
      'Demand vs Supply percentile scores',
      'Classification: Demand Pressure / Balanced / Supply Pressure',
      'Sanctioned seats & certification volumes',
      '90-Day post-completion tracking safeguard',
    ],
  },
  forecasts: {
    title: 'Time-Series Forecasting & Projected Mismatch',
    badge: 'Coming in Task 6C',
    icon: '🔮',
    description:
      'Rolling-origin backtested forecasts for monthly job postings and certified throughput across 3, 6, and 12-month horizons. Compares Naive, 3-Month Moving Average, and Linear Trend with 80% normal prediction intervals.',
    specs: [
      'Horizons: 3, 6, and 12 months',
      'Rolling-origin backtesting (MAE / WAPE)',
      'Deterministic model selection',
      'Future relative mismatch projection',
    ],
  },
  alerts: {
    title: 'Early-Warning Alerts & Signal Triggers',
    badge: 'Coming in Task 6C',
    icon: '🚨',
    description:
      'Explainable policy alerts identifying persistent demand pressures, emerging supply bottlenecks, and data coverage warnings. Formats human-in-the-loop decision-support recommendations with clear limitations.',
    specs: [
      'Persistent mismatch across >=2 horizons',
      'Severity tiers: Critical, High, Medium, Low',
      'Explainable drivers & suggested policy actions',
      'Data quality & small-sample warnings',
    ],
  },
  simulator: {
    title: 'Training-Seat Allocation Simulator',
    badge: 'Coming in Task 7',
    icon: '🎛️',
    description:
      'Interactive policy playground allowing TVET authorities and ITI administrators to simulate seat adjustments, projected candidate throughput changes, and estimated impact on regional mismatch scores.',
    specs: [
      'Interactive batch intake sliders',
      'Capacity constraint validation',
      'Real-time mismatch delta calculation',
      'Exportable state-level seat adjustment plans',
    ],
  },
};

export default function PlaceholderPage({ moduleId }) {
  const { isHindi } = useLanguage();
  const details = MODULE_DETAILS[moduleId] || {
    title: isHindi ? 'मॉड्यूल निर्माणाधीन है' : 'Module Under Development',
    badge: isHindi ? 'शीघ्र उपलब्ध' : 'Coming next',
    icon: '🚧',
    description: isHindi
      ? 'यह मॉड्यूल आगामी विकास चरणों में कार्यान्वयन हेतु निर्धारित है।'
      : 'This module is scheduled for implementation in upcoming development phases.',
    specs: [],
  };

  return (
    <div className="placeholder-panel">
      <div className="placeholder-icon">{details.icon}</div>
      <div className="placeholder-badge">{details.badge}</div>
      <h2 className="placeholder-title">{details.title}</h2>
      <p className="placeholder-description">{details.description}</p>
      {details.specs.length > 0 && (
        <div className="placeholder-specs">
          {details.specs.map((spec, idx) => (
            <span key={idx} className="spec-chip">
              ✓ {spec}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
