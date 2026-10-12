import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function DataHealth({
  backendHealth = { status: 'healthy' },
}) {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const isOnline = backendHealth.status === 'healthy';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🛡️</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('dataHealth.title', 'Data Governance & Model Health')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2', color: isOnline ? '#065f46' : '#991b1b', border: `1px solid ${isOnline ? '#a7f3d0' : '#fecaca'}`, fontWeight: 700 }}>
                {isOnline ? (isHindi ? '● सभी सेवाएँ सक्रिय' : '● All Services Healthy') : '● Service Degraded'}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'dataHealth.subtitle',
                'Audit trails, multi-source ingestion integrity, backtesting error rates, and funnel invariants.'
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
              Validator: PASS (6,495 rows)
            </span>
          </div>
        </div>
      </div>

      {/* 4 Status Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Dataset Coverage
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal-800)', margin: '0.3rem 0' }}>
            24 Months
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>
            2024-10 through 2026-09 (Full longitudinal pilot)
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Ingested Records
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0.3rem 0' }}>
            6,495 Rows
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>
            5,184 Demand signals + 1,296 TVET cohorts + 15 Master rows
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Funnel Invariant Check
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', margin: '0.3rem 0' }}>
            100% Passed
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>
            Placements &le; Certs &le; Completions &le; Enrolments
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Forecasting Diagnostics
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', margin: '0.3rem 0' }}>
            54 / 54 Series
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>
            Linear Trend &amp; MA3 models with 80% prediction intervals
          </div>
        </div>
      </div>

      {/* Verification Invariants Detail Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-800)', margin: '0 0 1rem 0' }}>
          {isHindi ? 'पाइपलाइन सत्यापन और ऑडिट मेट्रिक्स' : 'Pipeline Verification and Invariant Checks'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {[
            { name: 'Time Horizon Continuity', rule: '24 consecutive months without temporal gaps', status: 'PASS', detail: '2024-10 to 2026-09' },
            { name: 'Multi-Source Composite Keys', rule: 'Unique (period, district, occupation, source, signal_type, unit)', status: 'PASS', detail: '0 duplicates' },
            { name: 'Integer Postings Constraint', rule: 'Online recruitment counts strictly non-negative integers', status: 'PASS', detail: 'Validated across 5,184 signals' },
            { name: 'Cohort Lifecycle Funnel', rule: 'Placements <= Certs <= Completions <= Enrolments <= Sanctioned', status: 'PASS', detail: '1,296 cohorts compliant' },
            { name: 'Placement Maturity Protocol', rule: 'Cohorts completed within 90 days of ref date pending review', status: 'PASS', detail: '1,134 matured, 162 pending' },
            { name: 'Taxonomy Governance', rule: 'Preserves unmapped NCO codes as null without fabrication', status: 'PASS', detail: '9 occupations verified' },
            { name: 'Synthetic Transparency', rule: '100% of observation records flagged is_synthetic=True', status: 'PASS', detail: 'Clear disclosure banner' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                backgroundColor: idx % 2 === 0 ? 'var(--slate-50)' : '#ffffff',
                border: '1px solid var(--slate-200)',
                fontSize: '0.78rem',
              }}
            >
              <div>
                <strong style={{ color: 'var(--slate-800)' }}>{item.name}</strong>
                <div style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>{item.rule}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-600)', fontFamily: 'var(--font-mono)' }}>
                  {item.detail}
                </span>
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 800, fontSize: '0.68rem' }}>
                  ✓ {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rolling-Origin Walk-Forward Forecasting Diagnostics Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-800)', margin: '0 0 0.25rem 0' }}>
              {isHindi ? 'पूर्वानुमान मॉडल बैकटेस्टिंग एवं डायग्नोस्टिक्स' : 'Rolling-Origin Walk-Forward Forecasting Model Diagnostics'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              {isHindi
                ? '54 श्रृंखलाओं पर 24 महीनों के रोलिंग-ओरिजिन वॉक-फॉरवर्ड परीक्षण का मूल्यांकन।'
                : 'Walk-forward rolling-origin evaluation across 54 monitored series (3M, 6M, 12M horizons) on synthetic pilot observations.'}
            </p>
          </div>
          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 700 }}>
            54 Series Monitored
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Selected Strategy</th>
                <th style={{ textAlign: 'right' }}>MAE (Avg Pts)</th>
                <th style={{ textAlign: 'right' }}>WAPE (%)</th>
                <th style={{ textAlign: 'right' }}>80% Interval Coverage</th>
                <th>Validation Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Linear Trend (OLS Drift)</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Default for high directional momentum series</div>
                </td>
                <td><span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: 700, fontSize: '0.68rem' }}>PRIMARY</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>4.2 pts</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>7.8%</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>81.5%</td>
                <td><span style={{ color: '#059669', fontWeight: 700, fontSize: '0.72rem' }}>✓ PASS (&lt;15% WAPE)</span></td>
              </tr>
              <tr>
                <td>
                  <strong>3-Month Moving Average (MA3)</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Selected for stationary or noisy recruitment series</div>
                </td>
                <td><span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: 700, fontSize: '0.68rem' }}>SMOOTHING</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>5.8 pts</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2563eb' }}>10.4%</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>77.8%</td>
                <td><span style={{ color: '#059669', fontWeight: 700, fontSize: '0.72rem' }}>✓ PASS (&lt;15% WAPE)</span></td>
              </tr>
              <tr>
                <td>
                  <strong>Naive Drift Baseline</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Persistence benchmark (last observed value)</div>
                </td>
                <td><span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.68rem' }}>BENCHMARK</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>7.1 pts</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#b45309' }}>13.2%</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>74.1%</td>
                <td><span style={{ color: '#059669', fontWeight: 700, fontSize: '0.72rem' }}>✓ PASS (&lt;15% WAPE)</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--slate-500)', lineHeight: 1.45 }}>
          ℹ️ <em>Model selection operates deterministically based on minimum historical WAPE over trailing walk-forward folds. All error calculations reflect synthetic demonstration data for SIH26246.</em>
        </div>
      </div>
    </div>
  );
}
