import React, { useState, useEffect } from 'react';
import { fetchMetadata } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { getOccupationDisplayName } from '../../i18n/translations';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const SSC_MAPPING = {
  'IT/ITeS': 'IT-ITeS Sector Skill Council (NASSCOM)',
  'Manufacturing': 'Capital Goods & Automotive Skill Councils (CGSC / ASDC)',
  'Logistics': 'Logistics Sector Skill Council (LSC)',
};

export default function QualificationsExplorer() {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [metadata, setMetadata] = useState(null);
  const [levelFilter, setLevelFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchMetadata();
        if (ignore) return;
        setMetadata(res);
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load qualification metadata.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  const occupations = metadata?.occupations || [];

  const filtered = occupations.filter((occ) => {
    if (!levelFilter) return true;
    return String(occ.nsqf_level) === levelFilter;
  });

  if (isLoading) {
    return <LoadingSpinner message={isHindi ? 'टीवीईटी योग्यताएं लोड हो रही हैं...' : 'Loading TVET qualifications and NSQF alignment records...'} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎓</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('qualifications.title', 'TVET Qualifications & NSQF Alignment')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: 'var(--teal-800)', border: '1px solid #99f6e4', fontWeight: 700 }}>
                NSQF Levels 3.0 to 6.0
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'qualifications.subtitle',
                'National Skills Qualification Framework (NSQF) levels, Qualification Packs (QP), and awarding bodies.'
              )}
            </p>
          </div>

          {/* Level Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="nsqf-filter" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)' }}>
              NSQF Level:
            </label>
            <select
              id="nsqf-filter"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--slate-300)', backgroundColor: 'var(--slate-50)' }}
            >
              <option value="">{isHindi ? 'सभी एनएसक्यूएफ स्तर' : 'All NSQF Levels'}</option>
              <option value="3.0">Level 3.0</option>
              <option value="4.0">Level 4.0</option>
              <option value="5.0">Level 5.0</option>
              <option value="6.0">Level 6.0</option>
            </select>
          </div>
        </div>
      </div>

      {/* Qualification Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        {filtered.map((occ) => (
          <div
            key={occ.occupation_id}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                  {occ.qp_code || 'QP Code Pending'}
                </span>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '100px', backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}>
                  NSQF {occ.nsqf_level != null ? occ.nsqf_level : 'N/A'}
                </span>
              </div>

              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.25rem 0' }}>
                {occ.qp_title || occ.occupation_title}
              </h3>

              <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', marginBottom: '0.75rem' }}>
                Maps to: <strong>{getOccupationDisplayName(occ.occupation_title, isHindi)}</strong> ({occ.occupation_id})
              </div>

              <div style={{ backgroundColor: 'var(--slate-50)', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--slate-200)', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div>
                  <span style={{ color: 'var(--slate-500)' }}>Sector Skill Body: </span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{SSC_MAPPING[occ.sector] || occ.sector}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)' }}>National Classification (NCO): </span>
                  <span style={{ fontWeight: 600, color: occ.nco_code ? 'var(--slate-700)' : 'var(--slate-400)' }}>
                    {occ.nco_code ? `${occ.nco_code} (${occ.nco_title})` : (isHindi ? 'अपुष्ट (मैप नहीं किया गया)' : 'Unverified (Not mapped)')}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--slate-500)', borderTop: '1px solid var(--slate-100)', paddingTop: '0.5rem' }}>
              Framework: National Skills Qualification Framework (MSDE / NCVET)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
