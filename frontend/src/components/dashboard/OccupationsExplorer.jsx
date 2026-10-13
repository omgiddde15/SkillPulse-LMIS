import React, { useState, useEffect } from 'react';
import { fetchMetadata } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import {
  getOccupationDisplayName,
  getSectorDisplayName,
} from '../../i18n/translations';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import Icon from '../Icon';

export default function OccupationsExplorer() {
  const { language, t } = useLanguage();
  const isHindi = language === 'hi';

  const [metadata, setMetadata] = useState(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOccupation, setSelectedOccupation] = useState(null);
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
        if (!ignore) setError(err.message || 'Failed to load occupation metadata.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  const occupations = metadata?.occupations || [];

  const filteredOccupations = occupations.filter((occ) => {
    const matchSector = !selectedSector || occ.sector === selectedSector;
    const matchSearch =
      !searchQuery ||
      occ.occupation_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      occ.occupation_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (occ.nco_code && occ.nco_code.includes(searchQuery));
    return matchSector && matchSearch;
  });

  if (isLoading) {
    return <LoadingSpinner message={isHindi ? 'व्यावसायिक वर्गीकरण लोड हो रहा है...' : 'Loading occupational taxonomy and qualification registry...'} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', color: 'var(--accent-primary)' }}><Icon name="briefcase" size={20} /></span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                {t('occupations.title', 'Occupational Taxonomy & Registry')}
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--teal-800)', border: '1px solid var(--accent-soft-border)', fontWeight: 700 }}>
                9 {isHindi ? 'मानक व्यवसाय' : 'Standard Occupations'} • 3 {isHindi ? 'क्षेत्र' : 'Sectors'}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
              {t(
                'occupations.subtitle',
                'Standardised 9 pilot occupations mapped to National Classification of Occupations (NCO) and Qualification Packs (QP).'
              )}
            </p>
          </div>

          {/* Search & Sector Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={isHindi ? 'व्यवसाय खोजें...' : 'Search occupation or NCO...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--slate-300)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                width: '180px',
              }}
            />
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid var(--slate-300)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('common.allSectors', 'All Sectors (3)')}</option>
              <option value="IT/ITeS">IT/ITeS</option>
              <option value="Logistics">Logistics</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', color: 'var(--slate-600)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '0.75rem 1rem' }}>ID & Title</th>
              <th style={{ padding: '0.75rem 1rem' }}>Sector & Trade</th>
              <th style={{ padding: '0.75rem 1rem' }}>NCO-2015 Code</th>
              <th style={{ padding: '0.75rem 1rem' }}>QP Code & Title</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>NSQF Level</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOccupations.map((occ, idx) => (
              <tr
                key={occ.occupation_id}
                style={{
                  borderBottom: '1px solid var(--slate-100)',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--slate-50)',
                  transition: 'background-color 0.15s',
                }}
              >
                {/* ID & Title */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                    {getOccupationDisplayName(occ.occupation_title, isHindi)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                    {occ.occupation_id}
                  </div>
                </td>

                {/* Sector & Trade */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ display: 'inline-block', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--slate-700)', fontWeight: 600, border: '1px solid var(--slate-200)', marginBottom: '0.2rem' }}>
                    {getSectorDisplayName(occ.sector, isHindi)}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>{occ.trade}</div>
                </td>

                {/* NCO-2015 Code */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  {occ.nco_code ? (
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-800)', fontSize: '0.75rem', backgroundColor: 'var(--accent-soft-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--accent-soft-border)' }}>
                        {occ.nco_code}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '0.2rem' }}>
                        {occ.nco_title}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {isHindi ? 'मैप नहीं किया गया (अपुष्ट)' : 'Not mapped (Unverified)'}
                    </span>
                  )}
                </td>

                {/* QP Code & Title */}
                <td style={{ padding: '0.85rem 1rem' }}>
                  {occ.qp_code ? (
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-supply-text)', fontSize: '0.75rem', backgroundColor: 'var(--status-supply-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--status-supply-border)' }}>
                        {occ.qp_code}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '0.2rem' }}>
                        {occ.qp_title}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {isHindi ? 'अनुपलब्ध' : 'None recorded'}
                    </span>
                  )}
                </td>

                {/* NSQF Level */}
                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                  {occ.nsqf_level != null ? (
                    <span style={{ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '100px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--slate-300)', fontWeight: 800, fontSize: '0.75rem', color: 'var(--slate-800)', fontFamily: 'var(--font-mono)' }}>
                      Level {occ.nsqf_level}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>N/A</span>
                  )}
                </td>

                {/* Action */}
                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedOccupation(occ)}
                    style={{
                      border: '1px solid var(--slate-300)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--slate-700)',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.inspect', 'Inspect')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Occupation Detail Modal / Panel */}
      {selectedOccupation && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '2px solid var(--teal-600)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--slate-100)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--teal-700)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                {isHindi ? 'व्यवसाय विवरण' : 'Taxonomy Record Inspection'}
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0.2rem 0 0 0' }}>
                {getOccupationDisplayName(selectedOccupation.occupation_title, isHindi)} ({selectedOccupation.occupation_id})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedOccupation(null)}
              style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--slate-400)' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.78rem' }}>
            <div>
              <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '0.2rem' }}>Sector & Trade:</span>
              <strong style={{ color: 'var(--slate-800)' }}>{selectedOccupation.sector} • {selectedOccupation.trade}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '0.2rem' }}>NCO-2015 Classification:</span>
              <strong style={{ color: 'var(--slate-800)' }}>
                {selectedOccupation.nco_code ? `${selectedOccupation.nco_code} (${selectedOccupation.nco_title})` : (isHindi ? 'अपुष्ट (मैप नहीं किया गया)' : 'Unverified (Not mapped)')}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '0.2rem' }}>Qualification Pack (QP):</span>
              <strong style={{ color: 'var(--slate-800)' }}>
                {selectedOccupation.qp_code ? `${selectedOccupation.qp_code} (${selectedOccupation.qp_title})` : 'N/A'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--slate-500)', display: 'block', marginBottom: '0.2rem' }}>NSQF Framework Level:</span>
              <strong style={{ color: 'var(--teal-700)' }}>
                {selectedOccupation.nsqf_level != null ? `NSQF Level ${selectedOccupation.nsqf_level}` : 'Unassigned'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
