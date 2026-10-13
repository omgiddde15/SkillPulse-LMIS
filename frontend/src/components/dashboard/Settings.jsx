import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import Icon from '../Icon';

export default function Settings({
  period = '2026-09',
  onPeriodChange = () => {},
}) {
  const { language, setLanguage, t } = useLanguage();
  const { theme } = useTheme();
  const isHindi = language === 'hi';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent-primary)' }}><Icon name="settings" size={20} /></span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
            {t('settings.title', 'Platform & Preferences Settings')}
          </h2>
        </div>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '720px' }}>
          {t(
            'settings.subtitle',
            'Localization preferences, reporting period configuration, and system parameters.'
          )}
        </p>
      </div>

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* Language & Localization Card */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="globe" size={16} />
            <span>{isHindi ? 'भाषा एवं स्थानीयकरण' : 'Language & Localization'}</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', margin: '0 0 1rem 0' }}>
            {isHindi ? 'समस्त डैशबोर्ड और निर्यात के लिए भाषा प्राथमिकता चुनें।' : 'Choose preferred language for dashboard UI, charts, and CSV export headers.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '6px',
                border: language === 'en' ? '2px solid #0d9488' : '1px solid var(--slate-300)',
                backgroundColor: language === 'en' ? 'var(--accent-soft-bg)' : 'var(--bg-elevated)',
                color: language === 'en' ? 'var(--teal-900)' : 'var(--slate-700)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              English (EN)
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '6px',
                border: language === 'hi' ? '2px solid #0d9488' : '1px solid var(--slate-300)',
                backgroundColor: language === 'hi' ? 'var(--accent-soft-bg)' : 'var(--bg-elevated)',
                color: language === 'hi' ? 'var(--teal-900)' : 'var(--slate-700)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              हिन्दी (HI)
            </button>
          </div>
        </div>

        {/* Reporting Period Configuration */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="calendar" size={16} />
            <span>{isHindi ? 'सक्रिय रिपोर्टिंग अवधि' : 'Default Reporting Cycle'}</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', margin: '0 0 1rem 0' }}>
            {isHindi ? 'कार्यबल विश्लेषण और पूर्वानुमान के लिए बेसलाइन महीना चुनें।' : 'Select base reference month for cross-sectional ranking and forecasting origin.'}
          </p>

          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '6px',
              border: '1px solid var(--slate-300)',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="2026-09">2026-09 ({isHindi ? 'सक्रिय पायलट' : 'Active Pilot'})</option>
            <option value="2026-08">2026-08</option>
            <option value="2026-07">2026-07</option>
            <option value="2026-06">2026-06</option>
          </select>
        </div>

        {/* System Theme & Visual Identity Card */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
              <span>{isHindi ? 'विज़ुअल थीम एवं डिज़ाइन सिस्टम' : 'Visual Identity & Theme'}</span>
            </h3>
            <ThemeToggle variant="settings" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', display: 'inline-block' }} />
            <span style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--accent-primary)', display: 'inline-block' }} />
            <span style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--status-supply)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-700)', fontWeight: 600 }}>
              {theme === 'dark'
                ? (isHindi ? 'डार्क नेवी और एंटरप्राइज़ टील सक्रिय' : 'Dark Navy & Enterprise Teal Active')
                : (isHindi ? 'लाइट सरफेस और उच्च-कंट्रास्ट स्लेट सक्रिय' : 'Light Surface & High-Contrast Slate Active')}
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--slate-500)', margin: 0, lineHeight: 1.5 }}>
            {isHindi
              ? 'थीम चयन स्वचालित रूप से ब्राउज़र में सहेजा जाता है और होम तथा सभी डैशबोर्ड मॉड्यूल में सिंक रहता है।'
              : 'Theme preference is persisted in localStorage and stays synchronized across Home and all dashboard modules.'}
          </p>
        </div>

        {/* Data Governance & Disclosures Card */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="scale" size={16} />
            <span>{isHindi ? 'डेटा प्रकटीकरण एवं वैधता' : 'Data Provenance & Bounds'}</span>
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--slate-600)', margin: 0, lineHeight: 1.6 }}>
            {isHindi
              ? 'सभी 6,495 अवलोकन रिकॉर्ड SIH26246 के लिए सिंथेटिक प्रदर्शन डेटा हैं। कोई भी व्यक्तिगत नौकरी रिक्ति वास्तविक नहीं है।'
              : 'All 6,495 observation records represent synthetic demonstration data for Smart India Hackathon 2026 (PS SIH26246). Not official census statistics.'}
          </p>
        </div>
      </div>
    </div>
  );
}
