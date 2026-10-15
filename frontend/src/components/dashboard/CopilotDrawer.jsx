import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../context/LanguageContext';
import { sendPolicyCopilotQuery } from '../../api/client';
import Icon from '../Icon';

const GUIDE_INQUIRIES = [
  {
    id: 'how_to_use',
    icon: 'compass',
    labelEn: 'How do I use this site?',
    labelHi: 'इस साइट का उपयोग कैसे करें?',
  },
  {
    id: 'where_skill_gaps',
    icon: 'search',
    labelEn: 'Where can I find skill gaps?',
    labelHi: 'कौशल अंतर कहाँ खोजें?',
  },
  {
    id: 'how_simulate_seats',
    icon: 'sliders',
    labelEn: 'How do I simulate changing training seats?',
    labelHi: 'प्रशिक्षण सीटों का सिमुलेशन कैसे करें?',
  },
  {
    id: 'explain_mismatch',
    icon: 'file-text',
    labelEn: 'Explain the relative mismatch score.',
    labelHi: 'सापेक्ष असंतुलन स्कोर का विवरण दें।',
  },
  {
    id: 'check_data_quality',
    icon: 'check-circle',
    labelEn: 'How do I check data quality & health?',
    labelHi: 'डेटा गुणवत्ता एवं स्वास्थ्य की जांच कैसे करें?',
  },
  {
    id: 'find_opportunities',
    icon: 'award',
    labelEn: 'How do I find learning opportunities & apprenticeships?',
    labelHi: 'सीखने के अवसर एवं अप्रेन्टिसशिप कैसे खोजें?',
  },
];

const ANALYTICS_INQUIRIES = [
  {
    id: 'highest_pressure',
    icon: 'zap',
    labelEn: 'Which district has the highest demand pressure in this cycle?',
    labelHi: 'इस चक्र में किस ज़िले में सबसे अधिक मांग दबाव है?',
  },
  {
    id: 'top_alerts',
    icon: 'alert-triangle',
    labelEn: 'What are the top persistent alerts across the pilot corridors?',
    labelHi: 'पायलट गलियारों में प्रमुख निरंतर अलर्ट कौन से हैं?',
  },
  {
    id: 'dharwad_cnc',
    icon: 'activity',
    labelEn: 'Explain the CNC Machine Operator skill gap in Dharwad.',
    labelHi: 'धारवाड़ में सीएनसी मशीन ऑपरेटर कौशल अंतर का विवरण दें।',
  },
  {
    id: 'bengaluru_logistics',
    icon: 'layers',
    labelEn: 'What seat planning scenario can be evaluated for Bengaluru Urban Logistics?',
    labelHi: 'बेंगलुरु शहरी लॉजिस्टिक्स के लिए किस सीट योजना परिदृश्य का मूल्यांकन किया जा सकता है?',
  },
  {
    id: 'forecast_comparison',
    icon: 'chart-bar',
    labelEn: 'Compare forecast accuracy across forecasting models.',
    labelHi: 'पूर्वानुमान मॉडलों में सटीकता की तुलना करें।',
  },
  {
    id: 'pilot_limitations',
    icon: 'shield',
    labelEn: 'What are the methodological limitations of this pilot dataset?',
    labelHi: 'इस पायलट डेटासेट की पद्धतिगत सीमाएं क्या हैं?',
  },
];

export default function CopilotDrawer({
  isOpen,
  onClose,
  gapData,
  demandData,
  alertsData,
  period = '2026-09',
  onNavigateToTab,
  onNavigateWithContext,
  initialQuery = null,
  onClearInitialQuery,
}) {
  const { isHindi } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const [presetCategory, setPresetCategory] = useState('guide'); // 'guide' | 'analytics'

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const hasExecutedInitialRef = useRef(false);
  const isSubmittingRef = useRef(false);

  // Initialize initial welcome message
  const getInitialAssistantMessage = () => ({
    id: 'msg-init',
    role: 'assistant',
    title: isHindi ? 'स्किलपल्स सारथी एआई सहायक (SkillPulse Saarthi AI Assistant)' : 'SkillPulse Saarthi AI Assistant',
    badge: 'PLATFORM GUIDE & ANALYTICS',
    badge_color: 'var(--accent-primary)',
    intent: 'platform_guide',
    answer: isHindi
      ? 'नमस्ते! मैं **स्किलपल्स सारथी** हूँ — 6 पायलट ज़िलों में प्लेटफ़ॉर्म नेविगेशन और श्रम बाज़ार विश्लेषण के लिए आपका मार्गदर्शक।\n\n' +
        '**मेरी दो प्रमुख क्षमताएं हैं:**\n' +
        '1. **प्लेटफ़ॉर्म गाइड:** साइट के सभी 18 मॉड्यूल, नेविगेशन पथ, परिदृश्य सीट सिमुलेशन, और मेट्रिक सूत्रों (जैसे सापेक्ष असंतुलन) को समझें।\n' +
        '2. **नीतिगत विश्लेषण:** वास्तविक मांग दबाव, कौशल अंतर, पूर्वानुमान मॉडल और प्रारंभिक चेतावनी अलर्ट पर नियतात्मक उत्तर प्राप्त करें।\n\n' +
        'नीचे दिए गए त्वरित प्रश्नों में से चुनें या अपना प्रश्न टाइप करें।'
      : 'Hello! I am **SkillPulse Saarthi** — your guide to the platform and labour-market intelligence across our 6 pilot districts.\n\n' +
        '**I provide two primary capabilities:**\n' +
        '1. **Platform Guide:** Learn how to navigate all 18 modules, run TVET seat simulations in Scenario Studio, and understand metric formulas.\n' +
        '2. **Policy Analytics:** Get factually grounded answers on regional demand pressure, occupational skill gaps, early-warning alerts, and forecasting models.\n\n' +
        'Select a starter question below or type your inquiry in the composer.',
    evidence: {
      pilot_districts: 6,
      active_period: period,
      capabilities: 'Dual-Engine Platform Guide & Policy Analytics',
    },
    action_label: isHindi ? 'कार्यकारी अवलोकन खोलें' : 'Explore Executive Overview',
    action_route: 'overview',
    action_tab: 'overview',
    guide_topic: 'getting_started',
    suggested_followups: [
      isHindi ? 'इस साइट का उपयोग कैसे करें?' : 'How do I use this site?',
      isHindi ? 'इस चक्र में किस ज़िले में सबसे अधिक मांग दबाव है?' : 'Which district has the highest demand pressure this cycle?',
      isHindi ? 'प्रशिक्षण सीटों का सिमुलेशन कैसे करें?' : 'How do I simulate changing training seats?',
      isHindi ? 'सापेक्ष असंतुलन स्कोर का विवरण दें।' : 'Explain the relative mismatch score.',
    ],
    sources: [
      { kind: 'metadata', title: 'SkillPulse Reference Architecture', url: '/api/v1/metadata' },
    ],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Reset or setup initial message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([getInitialAssistantMessage()]);
    }
  }, [period, isHindi]);

  // Handle incoming initialQuery cleanly without duplicate submission
  useEffect(() => {
    if (isOpen && initialQuery && !hasExecutedInitialRef.current) {
      hasExecutedInitialRef.current = true;
      handleSend(initialQuery);
      onClearInitialQuery?.();
    }
    if (!isOpen) {
      hasExecutedInitialRef.current = false;
    }
  }, [isOpen, initialQuery, onClearInitialQuery]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleResetConversation = () => {
    setMessages([getInitialAssistantMessage()]);
    setInputQuery('');
    setShowPresets(true);
  };

  const handleSend = async (queryText) => {
    if (isSubmittingRef.current) return;
    const textToSend = (queryText !== undefined ? queryText : inputQuery).trim();
    if (!textToSend || isLoading) return;

    isSubmittingRef.current = true;
    setIsLoading(true);

    const userMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');

    try {
      // Build conversation history for entity memory
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.role === 'user' ? m.content : m.answer || m.content || m.title || '',
        }));

      const response = await sendPolicyCopilotQuery({
        query: textToSend,
        period,
        history: historyPayload,
        language: isHindi ? 'hi' : 'en',
      });

      const assistantMessage = {
        id: `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        title: response.title,
        badge: response.badge,
        badge_color: response.badge_color || 'var(--accent-primary)',
        intent: response.intent,
        guide_topic: response.guide_topic,
        answer: response.answer,
        evidence: response.evidence || {},
        action_label: response.action_label,
        action_route: response.action_route || response.action_tab,
        action_tab: response.action_tab || response.action_route,
        action_context: response.action_context,
        sources: response.sources || [],
        suggested_followups: response.suggested_followups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        title: isHindi ? 'विश्लेषणात्मक त्रुटि' : 'Assistant Query Error',
        badge: 'QUERY ERROR',
        badge_color: 'var(--status-danger)',
        answer: isHindi
          ? `अनुरोध संसाधित करने में त्रुटि: ${err.message || 'अज्ञात सर्वर त्रुटि'}`
          : `Failed to evaluate inquiry: ${err.message || 'Unknown server error'}. Please verify the FastAPI backend server is accessible.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmittingRef.current && !isLoading) {
        handleSend();
      }
    }
  };

  const handleActionClick = (msg) => {
    const targetRoute = msg.action_route || msg.action_tab;
    if (!targetRoute) return;
    onClose?.();
    if (msg.action_context) {
      onNavigateWithContext?.(targetRoute, msg.action_context);
    } else {
      onNavigateToTab?.(targetRoute);
    }
  };

  if (!isOpen) return null;

  const currentPresets = presetCategory === 'guide' ? GUIDE_INQUIRIES : ANALYTICS_INQUIRIES;

  return (
    <div
      className="copilot-drawer-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="copilot-drawer"
        style={{
          width: '100%',
          maxWidth: '540px',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-lg)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Saarthi identity and dual-role subtitle */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle)',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ display: 'inline-flex', color: 'var(--accent-primary)' }}>
                <Icon name="compass" size={22} />
              </span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {isHindi ? 'स्किलपल्स सारथी' : 'SkillPulse Saarthi'}
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0.35rem 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {isHindi
                ? 'प्लेटफ़ॉर्म और श्रम बाज़ार विश्लेषण के लिए आपका मार्गदर्शक।'
                : 'Your guide to the platform and labour-market intelligence.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-soft-bg)',
                  color: 'var(--teal-800)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--accent-soft-border)',
                }}
              >
                DUAL-ENGINE ASSISTANT
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Cycle {period}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleResetConversation}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title={isHindi ? 'नई बातचीत शुरू करें' : 'Reset Conversation'}
            >
              <Icon name="refresh" size={12} />
              <span>{isHindi ? 'रीसेट' : 'Clear'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                lineHeight: 1,
              }}
              title={isHindi ? 'बंद करें' : 'Close'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Governance Transparency Banner */}
        <div
          style={{
            padding: '0.6rem 1.25rem',
            backgroundColor: 'var(--accent-soft-bg)',
            borderBottom: '1px solid var(--accent-soft-border)',
            fontSize: '0.72rem',
            color: 'var(--teal-800)',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
            flexShrink: 0,
          }}
        >
          <span style={{ marginTop: '0.1rem', flexShrink: 0 }}>
            <Icon name="shield" size={14} />
          </span>
          <div>
            <strong>{isHindi ? 'पारदर्शिता गारंटी:' : 'Deterministic, Source-Grounded Responses:'}</strong>{' '}
            {isHindi
              ? 'प्लेटफ़ॉर्म निर्देश सत्यापित विनिर्देशों से हैं। विश्लेषण 6 पायलट ज़िलों के डेटाबेस मॉडलों से सीधे व्युत्पन्न हैं। कोई काल्पनिक निष्कर्ष नहीं।'
              : 'Platform guidance is synthesized from verified module specifications. Analytics are computed directly from backend database models across 6 pilot corridors without LLM hallucination.'}
          </div>
        </div>

        {/* Scrollable Conversation Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Quick Presets Section with Dual Category Switcher */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                marginBottom: showPresets ? '0.5rem' : 0,
              }}
              onClick={() => setShowPresets((p) => !p)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isHindi ? 'त्वरित प्रश्न:' : 'Starter Inquiries:'}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {showPresets ? '▲' : '▼'}
              </span>
            </div>

            {showPresets && (
              <div>
                {/* Category Switcher Tabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.35rem',
                    marginBottom: '0.6rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0.4rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPresetCategory('guide');
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: presetCategory === 'guide' ? 700 : 500,
                      backgroundColor: presetCategory === 'guide' ? 'var(--teal-600)' : 'transparent',
                      color: presetCategory === 'guide' ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon name="compass" size={11} />
                    <span>{isHindi ? 'प्लेटफ़ॉर्म गाइड' : 'Platform Guide'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPresetCategory('analytics');
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: presetCategory === 'analytics' ? 700 : 500,
                      backgroundColor: presetCategory === 'analytics' ? 'var(--teal-600)' : 'transparent',
                      color: presetCategory === 'analytics' ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon name="activity" size={11} />
                    <span>{isHindi ? 'नीतिगत विश्लेषण' : 'Policy Analytics'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {currentPresets.map((inq) => {
                    const label = isHindi ? inq.labelHi : inq.labelEn;
                    return (
                      <button
                        key={inq.id}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSend(label)}
                        style={{
                          textAlign: 'left',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isLoading) {
                            e.currentTarget.style.backgroundColor = 'var(--teal-50)';
                            e.currentTarget.style.borderColor = 'var(--teal-400)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                      >
                        <Icon name={inq.icon} size={13} />
                        <span style={{ flex: 1 }}>{label}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Messages Stream */}
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    marginLeft: '2rem',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px 12px 2px 12px',
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      boxShadow: 'var(--shadow-sm)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', paddingRight: '0.25rem' }}>
                    {msg.timestamp}
                  </span>
                </div>
              );
            }

            // Assistant Response Card
            const isGuide = msg.intent === 'platform_guide' || Boolean(msg.guide_topic);
            const isClarification = msg.intent === 'clarification';

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  marginRight: '0.5rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: `1px solid ${
                      msg.isError
                        ? 'var(--status-danger)'
                        : isGuide
                        ? 'var(--accent-soft-border)'
                        : 'var(--border-subtle)'
                    }`,
                    borderRadius: '8px',
                    padding: '1.1rem',
                    boxShadow: 'var(--shadow-sm)',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Top Badge & Capability Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: isGuide ? '#0d9488' : msg.badge_color || 'var(--accent-primary)',
                          backgroundColor: isGuide ? '#f0fdfa' : 'var(--accent-soft-bg)',
                          border: `1px solid ${isGuide ? '#99f6e4' : 'var(--accent-soft-border)'}`,
                          padding: '2px 8px',
                          borderRadius: '100px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Icon name={isGuide ? 'compass' : isClarification ? 'info' : 'activity'} size={11} />
                        <span>{msg.badge || (isGuide ? 'PLATFORM GUIDE' : 'ANALYTICS')}</span>
                      </span>
                    </div>

                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginTop: 0,
                      marginBottom: '0.6rem',
                      lineHeight: 1.35,
                    }}
                  >
                    {msg.title}
                  </h3>

                  {/* Formatted Markdown Body */}
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      marginBottom: msg.evidence && Object.keys(msg.evidence).length > 0 ? '0.75rem' : '0.5rem',
                    }}
                  >
                    <ReactMarkdown>{msg.answer || msg.content}</ReactMarkdown>
                  </div>

                  {/* Grounded Evidence Box (if available) */}
                  {msg.evidence && Object.keys(msg.evidence).length > 0 && (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '0.75rem',
                        fontSize: '0.72rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Icon name="check-circle" size={12} />
                        <span>{isHindi ? 'सत्यापित साक्ष्य मीट्रिक:' : 'Grounded Evidence Attributes:'}</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '0.35rem',
                        }}
                      >
                        {Object.entries(msg.evidence).map(([k, v]) => {
                          if (v === null || v === undefined || typeof v === 'object') return null;
                          const formattedKey = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <div
                              key={k}
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                padding: '3px 6px',
                              }}
                            >
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{formattedKey}</div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {String(v)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Navigation Action Pill */}
                  {msg.action_label && (
                    <button
                      type="button"
                      onClick={() => handleActionClick(msg)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.9rem',
                        backgroundColor: '#0d9488',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        marginBottom: msg.suggested_followups?.length ? '0.75rem' : 0,
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0f766e';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#0d9488';
                      }}
                    >
                      <Icon name="compass" size={13} />
                      <span>{msg.action_label}</span>
                      <span>→</span>
                    </button>
                  )}

                  {/* Sources List */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600 }}>{isHindi ? 'स्रोत दस्तावेज़: ' : 'Sources: '}</span>
                      {msg.sources.map((src, idx) => (
                        <span key={idx} style={{ marginRight: '0.4rem' }}>
                          <code style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', padding: '1px 4px', borderRadius: '3px' }}>
                            {src.title}
                          </code>
                          {idx < msg.sources.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggested Follow-ups */}
                  {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        {isHindi ? 'सुझाए गए अनुवर्ती प्रश्न:' : 'Suggested Follow-up Inquiries:'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {msg.suggested_followups.map((followup, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSend(followup)}
                            style={{
                              textAlign: 'left',
                              background: 'none',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '4px',
                              padding: '0.35rem 0.55rem',
                              fontSize: '0.7rem',
                              color: 'var(--teal-700)',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'var(--bg-subtle)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isLoading) {
                                e.currentTarget.style.backgroundColor = 'var(--teal-50)';
                                e.currentTarget.style.borderColor = 'var(--teal-400)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                              e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            }}
                          >
                            <span>{followup}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--teal-600)' }}>+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                <Icon name="refresh" size={14} />
              </span>
              <span>{isHindi ? 'सत्यापित मॉडलों से उत्तर तैयार किया जा रहा है...' : 'Evaluating grounded specifications and analytics...'}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Chat Composer at Bottom */}
        <div
          style={{
            flexShrink: 0,
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              rows={2}
              maxLength={1000}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={
                isHindi
                  ? 'सारथी से प्लेटफ़ॉर्म नेविगेशन, मेट्रिक सूत्रों या श्रम बाज़ार विश्लेषण के बारे में पूछें...'
                  : 'Ask Saarthi about platform navigation, metric formulas, or labour market analytics...'
              }
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                borderRadius: '6px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.45rem',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>{inputQuery.length}/1000</span>
              <span style={{ marginLeft: '0.4rem', display: 'inline-block' }}>
                {isHindi ? 'Enter से भेजें, Shift+Enter से नई पंक्ति' : 'Enter to send, Shift+Enter for newline'}
              </span>
            </div>

            <button
              type="button"
              disabled={!inputQuery.trim() || isLoading}
              onClick={() => handleSend()}
              style={{
                padding: '0.45rem 0.95rem',
                backgroundColor: !inputQuery.trim() || isLoading ? 'var(--border-strong)' : 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: !inputQuery.trim() || isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>{isHindi ? 'भेजें' : 'Send'}</span>
              <Icon name="send" size={13} />
            </button>
          </div>
        </div>

        {/* Footer info banner */}
        <div
          style={{
            padding: '0.5rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-subtle)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span>SkillPulse LMIS • SIH26246</span>
          <span>SkillPulse Saarthi AI Assistant v2.0</span>
        </div>
      </div>
    </div>
  );
}
