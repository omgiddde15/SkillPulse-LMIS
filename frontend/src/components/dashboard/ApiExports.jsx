import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  exportDemandIndexCsv,
  exportGapAnalysisCsv,
  exportForecastsCsv,
  exportEarlyWarningAlertsCsv,
} from '../../utils/exportCsv';
import { fetchDemandIndex, fetchGapAnalysis, fetchForecasts, fetchAlerts } from '../../api/client';

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/demand-index',
    description: 'Computes explainable composite demand index scores and component percentiles across occupations and districts.',
    params: 'period (YYYY-MM), state_code, district_id, sector, limit',
  },
  {
    method: 'GET',
    path: '/api/v1/gap-analysis',
    description: 'Calculates relative demand-supply mismatch centered on zero with heuristic ±15 threshold classifications.',
    params: 'period (YYYY-MM), state_code, district_id, sector, classification, limit',
  },
  {
    method: 'GET',
    path: '/api/v1/forecasts',
    description: 'Walk-forward rolling-origin projections across 3M, 6M, 12M horizons with 80% prediction intervals.',
    params: 'period (YYYY-MM), horizon (3, 6, 12), state_code, district_id, sector, limit',
  },
  {
    method: 'GET',
    path: '/api/v1/alerts',
    description: 'Multi-tiered early-warning indicators categorised by severity (low, medium, high, critical).',
    params: 'period (YYYY-MM), severity, alert_type, horizon, state_code, district_id, sector',
  },
  {
    method: 'POST',
    path: '/api/v1/simulations/seat-allocation',
    description: 'Simulates training-seat capacity adjustments under linear donor non-depletion constraints.',
    params: 'JSON: { period, horizon_months, district_id, occupation_id, proposed_seats_per_cohort }',
  },
  {
    method: 'GET',
    path: '/api/v1/metadata',
    description: 'Returns official 9-occupation taxonomy, 6 pilot districts, coordinates, and longitudinal time bounds.',
    params: 'None (Returns full master metadata registry)',
  },
];

export default function ApiExports({ period = '2026-09' }) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [exportingType, setExportingType] = useState(null);
  const [exportMessage, setExportMessage] = useState(null);

  const handleExport = async (type) => {
    setExportingType(type);
    setExportMessage(null);
    try {
      if (type === 'demand') {
        const res = await fetchDemandIndex({ period, limit: 100 });
        exportDemandIndexCsv(res.results || res.records || [], period, isHindi);
      } else if (type === 'gap') {
        const res = await fetchGapAnalysis({ period, limit: 100 });
        exportGapAnalysisCsv(res.results || res.records || [], period, isHindi);
      } else if (type === 'forecasts') {
        const res = await fetchForecasts({ period, horizon: 3, limit: 100 });
        exportForecastsCsv(res.results || res.records || [], period, 3, isHindi);
      } else if (type === 'alerts') {
        const res = await fetchAlerts({ period, limit: 100 });
        exportEarlyWarningAlertsCsv(res.results || res.alerts || [], period, isHindi);
      }
      setExportMessage(isHindi ? 'सीएसवी सफलतापूर्वक डाउनलोड किया गया।' : 'CSV successfully exported with synthetic data disclosure.');
    } catch (err) {
      setExportMessage(`Export error: ${err.message}`);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚡</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('apiExports.title', 'Developer API & CSV Data Exports')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: 'var(--teal-800)', border: '1px solid #99f6e4', fontWeight: 700 }}>
                FastAPI v0.1.0 • OpenAPI 3.1
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'apiExports.subtitle',
                'RESTful query endpoints, integration schemas, and transparent data exports with synthetic disclosures.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* CSV Export Hub Card */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
              📥 {isHindi ? 'सीधा सीएसवी डेटा निर्यात' : 'Direct CSV Data Exports'}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: '0.2rem 0 0 0' }}>
              {isHindi ? 'सभी निर्यातों में स्वचालित रूप से सिंथेटिक डेटा प्रकटीकरण हेडर शामिल होता है।' : 'All exports automatically include synthetic data disclosures and timestamped metadata.'}
            </p>
          </div>
          {exportMessage && (
            <span style={{ fontSize: '0.72rem', color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0.25rem 0.65rem', borderRadius: '4px', border: '1px solid #99f6e4', fontWeight: 600 }}>
              {exportMessage}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <button
            type="button"
            disabled={exportingType === 'demand'}
            onClick={() => handleExport('demand')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              backgroundColor: 'var(--slate-50)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)' }}>📈 Demand Index CSV</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Rankings, percentiles &amp; drivers</span>
          </button>

          <button
            type="button"
            disabled={exportingType === 'gap'}
            onClick={() => handleExport('gap')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              backgroundColor: 'var(--slate-50)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)' }}>⚖️ Gap Analysis CSV</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Mismatch scores &amp; classifications</span>
          </button>

          <button
            type="button"
            disabled={exportingType === 'forecasts'}
            onClick={() => handleExport('forecasts')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              backgroundColor: 'var(--slate-50)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)' }}>🔮 Forecasts (+3M) CSV</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Model projections &amp; intervals</span>
          </button>

          <button
            type="button"
            disabled={exportingType === 'alerts'}
            onClick={() => handleExport('alerts')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              backgroundColor: 'var(--slate-50)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)' }}>🚨 Early-Warning Alerts CSV</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Active risk tiers &amp; indicators</span>
          </button>
        </div>
      </div>

      {/* REST API Endpoints Catalog */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 1rem 0' }}>
          🌐 {isHindi ? 'लाइव रेस्ट एपीआई एंडपॉइंट्स' : 'Live REST API Endpoints'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {API_ENDPOINTS.map((ep, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--slate-50)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: ep.method === 'GET' ? '#0d9488' : '#2563eb',
                    color: '#ffffff',
                  }}
                >
                  {ep.method}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--slate-900)' }}>
                  {ep.path}
                </span>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', margin: '0 0 0.45rem 0', lineHeight: 1.4 }}>
                {ep.description}
              </p>

              <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                <strong>Query Parameters: </strong> {ep.params}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
