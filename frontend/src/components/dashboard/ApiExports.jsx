import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  exportDemandIndexCsv,
  exportGapAnalysisCsv,
  exportForecastsCsv,
  exportEarlyWarningAlertsCsv,
} from '../../utils/exportCsv';
import {
  fetchDemandIndex,
  fetchGapAnalysis,
  fetchForecasts,
  fetchAlerts,
  fetchMetadata,
  postSeatAllocation,
} from '../../api/client';
import Icon from '../Icon';

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
    description: 'Simulates training-seat capacity adjustments using empirical cohort funnel yields and cross-sectional supply re-ranking.',
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

  // Interactive Live Endpoint Tester State
  const [testedEndpoint, setTestedEndpoint] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState(null);
  const [testError, setTestError] = useState(null);

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

  const handleTestEndpoint = async (endpointPath) => {
    if (testedEndpoint === endpointPath && testResponse) {
      // Toggle collapse if already open
      setTestedEndpoint(null);
      return;
    }

    setTestedEndpoint(endpointPath);
    setTestLoading(true);
    setTestResponse(null);
    setTestError(null);

    try {
      let data = null;
      if (endpointPath === '/api/v1/demand-index') {
        data = await fetchDemandIndex({ period, limit: 2 });
      } else if (endpointPath === '/api/v1/gap-analysis') {
        data = await fetchGapAnalysis({ period, limit: 2 });
      } else if (endpointPath === '/api/v1/forecasts') {
        data = await fetchForecasts({ period, horizon: 3, limit: 2 });
      } else if (endpointPath === '/api/v1/alerts') {
        data = await fetchAlerts({ period, limit: 2 });
      } else if (endpointPath === '/api/v1/metadata') {
        data = await fetchMetadata();
      } else if (endpointPath === '/api/v1/simulations/seat-allocation') {
        data = await postSeatAllocation({
          period,
          horizon_months: 3,
          district_id: 'KA_DHA',
          occupation_id: 'OCC_MFG_001',
          proposed_seats_per_cohort: 150,
        });
      }
      setTestResponse(data);
    } catch (err) {
      setTestError(err.message || 'Endpoint execution error');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', color: 'var(--accent-primary)' }}><Icon name="zap" size={20} /></span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('apiExports.title', 'Developer API & CSV Data Exports')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--teal-800)', border: '1px solid var(--accent-soft-border)', fontWeight: 700 }}>
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
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="download" size={16} />
              <span>{isHindi ? 'सीधा सीएसवी डेटा निर्यात' : 'Direct CSV Data Exports'}</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: '0.2rem 0 0 0' }}>
              {isHindi ? 'सभी निर्यातों में स्वचालित रूप से सिंथेटिक डेटा प्रकटीकरण हेडर शामिल होता है।' : 'All exports automatically include synthetic data disclosures and timestamped metadata.'}
            </p>
          </div>
          {exportMessage && (
            <span style={{ fontSize: '0.72rem', color: 'var(--teal-800)', backgroundColor: 'var(--accent-soft-bg)', padding: '0.25rem 0.65rem', borderRadius: '4px', border: '1px solid var(--accent-soft-border)', fontWeight: 600 }}>
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
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Icon name="trendUp" size={14} />
              <span>Demand Index CSV</span>
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Composite scores &amp; vacancy indicators</span>
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
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Icon name="scale" size={14} />
              <span>Skill Gap Analysis CSV</span>
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Relative mismatch scores &amp; ranks</span>
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
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Icon name="chart" size={14} />
              <span>Projections CSV (3M)</span>
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Point forecasts &amp; 80% intervals</span>
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
            <strong style={{ fontSize: '0.82rem', color: 'var(--slate-800)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Icon name="alert" size={14} />
              <span>Early-Warning Alerts CSV</span>
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Active risk tiers &amp; indicators</span>
          </button>
        </div>
      </div>

      {/* REST API Endpoints Catalog & Live Playground */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="globe" size={16} />
              <span>{isHindi ? 'लाइव रेस्ट एपीआई एंडपॉइंट्स एवं परीक्षण कंसोल' : 'Live REST API Endpoints & Interactive Playground'}</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: '0.2rem 0 0 0' }}>
              {isHindi ? 'वर्तमान बैकएंड सेवा पर सीधे परीक्षण करने के लिए "परीक्षण करें" पर क्लिक करें।' : 'Click "Test Endpoint" on any route to inspect live JSON responses from FastAPI.'}
            </p>
          </div>
          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--teal-700)', fontWeight: 600 }}>
            Base: http://127.0.0.1:8000
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {API_ENDPOINTS.map((ep, idx) => {
            const isCurrentlyTested = testedEndpoint === ep.path;

            return (
              <div
                key={idx}
                style={{
                  border: isCurrentlyTested ? '1px solid var(--teal-600)' : '1px solid var(--slate-200)',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  backgroundColor: isCurrentlyTested ? 'var(--accent-soft-bg)' : 'var(--slate-50)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                  <button
                    type="button"
                    onClick={() => handleTestEndpoint(ep.path)}
                    style={{
                      backgroundColor: isCurrentlyTested ? '#0d9488' : 'var(--bg-surface)',
                      color: isCurrentlyTested ? '#ffffff' : 'var(--teal-800)',
                      border: '1px solid var(--teal-600)',
                      borderRadius: '4px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Icon name="zap" size={13} />
                    <span>{isCurrentlyTested && testResponse ? (isHindi ? 'बंद करें' : 'Hide Response') : (isHindi ? 'परीक्षण करें' : 'Test Endpoint')}</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', margin: '0 0 0.45rem 0', lineHeight: 1.4 }}>
                  {ep.description}
                </p>

                <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                  <strong>Parameters: </strong> {ep.params}
                </div>

                {/* Live JSON Response Preview Drawer */}
                {isCurrentlyTested && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--slate-200)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-700)', fontFamily: 'var(--font-mono)' }}>
                        LIVE RESPONSE STATUS: {testLoading ? 'QUERYING...' : testError ? 'ERROR' : 'HTTP 200 OK'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        Reporting Period: {period}
                      </span>
                    </div>

                    {testLoading && (
                      <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        Executing query against live backend...
                      </div>
                    )}

                    {testError && (
                      <div style={{ padding: '0.5rem', backgroundColor: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--status-danger-text)', fontFamily: 'var(--font-mono)' }}>
                        {testError}
                      </div>
                    )}

                    {testResponse && (
                      <pre
                        style={{
                          margin: 0,
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-code)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          maxHeight: '260px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(testResponse, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
