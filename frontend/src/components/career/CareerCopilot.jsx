import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  fetchCopilotConversations,
  createCopilotConversation,
  fetchCopilotConversation,
  deleteCopilotConversation,
  sendCopilotMessage,
  fetchCareerProfile,
  saveCareerProfile,
} from '../../api/client';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';

const STARTER_PROMPTS = [
  'What are my remaining skill gaps for my target role?',
  'Which verified government schemes or courses match my profile?',
  'How does my evidenced experience compare against the role benchmark?',
  'What should be my learning priority for the next 30 days?',
];

export default function CareerCopilot({ onNavigate, isHindi, t, isAuthenticated }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Consent status
  const [consentAiProcessing, setConsentAiProcessing] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  // Load candidate profile for AI consent
  const loadConsent = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const profRes = await fetchCareerProfile();
      if (profRes?.has_profile && profRes.profile) {
        setConsentAiProcessing(Boolean(profRes.profile.consent_ai_processing));
      }
    } catch {
      // Ignore background consent fetch error
    }
  }, [isAuthenticated]);

  // Load conversations list
  const loadConversations = useCallback(async (selectNewest = false) => {
    if (!isAuthenticated) {
      setIsLoadingList(false);
      return;
    }
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const res = await fetchCopilotConversations();
      const list = res?.conversations || [];
      setConversations(list);

      if (list.length > 0) {
        const targetId = selectNewest ? list[0].id : (activeConversationId || list[0].id);
        setActiveConversationId(targetId);
        await loadConversationDetail(targetId);
      } else {
        // Auto-create initial conversation if none exists
        const newConv = await createCopilotConversation({ title: 'Career Guidance' });
        if (newConv?.id) {
          setConversations([newConv]);
          setActiveConversationId(newConv.id);
          setActiveConversation(newConv);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load Copilot conversations.');
    } finally {
      setIsLoadingList(false);
    }
  }, [isAuthenticated, activeConversationId]);

  const loadConversationDetail = async (convId) => {
    setIsLoadingConv(true);
    setErrorMessage(null);
    try {
      const detail = await fetchCopilotConversation(convId);
      setActiveConversation(detail);
      setActiveConversationId(convId);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load conversation history.');
    } finally {
      setIsLoadingConv(false);
    }
  };

  useEffect(() => {
    loadConsent();
    loadConversations();
  }, [loadConsent, loadConversations]);

  // Toggle AI Consent
  const handleToggleConsent = async () => {
    setIsUpdatingConsent(true);
    try {
      const newConsent = !consentAiProcessing;
      await saveCareerProfile({ consent_ai_processing: newConsent });
      setConsentAiProcessing(newConsent);
      setFeedback({
        type: 'success',
        text: newConsent
          ? (isHindi ? 'एआई प्रसंस्करण सहमति सक्षम की गई।' : 'AI processing consent enabled.')
          : (isHindi ? 'एआई प्रसंस्करण सहमति अक्षम की गई। नियतात्मक मोड सक्रिय।' : 'AI processing consent disabled. Deterministic mode active.'),
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update AI consent settings.');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  // Start new conversation
  const handleCreateNew = async () => {
    try {
      const title = `Career Guidance ${new Date().toLocaleDateString()}`;
      const newConv = await createCopilotConversation({ title });
      if (newConv?.id) {
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        setActiveConversation(newConv);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create new conversation.');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    const confirmPrompt = isHindi
      ? 'क्या आप वाकई इस बातचीत को हटाना चाहते हैं?'
      : 'Are you sure you want to delete this conversation thread?';
    if (!window.confirm(confirmPrompt)) return;

    try {
      await deleteCopilotConversation(convId);
      const remaining = conversations.filter(c => c.id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          loadConversationDetail(remaining[0].id);
        } else {
          setActiveConversation(null);
          setActiveConversationId(null);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete conversation.');
    }
  };

  // Send message
  const handleSendMessage = async (textToSend = null) => {
    const content = (textToSend || inputContent).trim();
    if (!content || !activeConversationId || isSending) return;

    setInputContent('');
    setIsSending(true);
    setErrorMessage(null);

    // Optimistically append user message to local state
    const optimisticUserMsg = {
      id: Date.now(),
      conversation_id: activeConversationId,
      sender: 'user',
      content: content,
      sources: [],
      generation_mode: 'user',
      created_at: new Date().toISOString(),
    };

    setActiveConversation(prev => prev ? {
      ...prev,
      messages: [...(prev.messages || []), optimisticUserMsg],
    } : null);

    try {
      const reply = await sendCopilotMessage(activeConversationId, content);
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), reply],
      } : null);

      // Refresh list to update message counts & timestamps
      const listRes = await fetchCopilotConversations();
      if (listRes?.conversations) {
        setConversations(listRes.conversations);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to obtain answer from Copilot.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="workspace-empty-state" style={{ padding: '3.5rem 1rem' }}>
        <div className="workspace-empty-icon"><Icon name="lock" size={32} /></div>
        <h3>{isHindi ? 'प्रमाणीकरण आवश्यक है' : 'Candidate Authentication Required'}</h3>
        <p>
          {isHindi
            ? 'करियर कोपायलट मार्गदर्शन के लिए कृपया अपने उम्मीदवार खाते में साइन इन करें।'
            : 'Please sign in to access personalized, grounded Career Copilot guidance.'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '0.75rem' }}
          onClick={() => onNavigate && onNavigate('login')}
        >
          <Icon name="lock" size={13} />
          <span>{isHindi ? 'साइन इन करें' : 'Sign In to SkillPulse'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="copilot-container">
      {/* Top Controls / AI Consent Banner */}
      <div className="copilot-header-bar">
        <div className="copilot-header-info">
          <div className="copilot-title-row">
            <h2 className="copilot-title">
              <Icon name="message-square" size={18} />
              <span>{isHindi ? 'करियर कोपायलट (मार्गदर्शन सहायक)' : 'SkillPulse Career Copilot'}</span>
            </h2>
            <span className={`copilot-consent-badge ${consentAiProcessing ? 'ai-active' : 'deterministic'}`}>
              <Icon name={consentAiProcessing ? 'sparkles' : 'shield'} size={12} />
              <span>
                {consentAiProcessing
                  ? (isHindi ? 'एआई सहमति: स्वीकृत' : 'AI Processing: Permitted')
                  : (isHindi ? 'एआई सहमति: अस्वीकृत (नियतात्मक)' : 'AI Processing: Off (Deterministic)')}
              </span>
            </span>
          </div>
          <p className="copilot-subtitle">
            {isHindi
              ? 'प्रमाणित कौशल साक्ष्य, लक्षित भूमिका बेंचमार्क, और आधिकारिक कैटलॉग डेटा के आधार पर वस्तुनिष्ठ करियर परामर्श।'
              : 'Grounded career advice based on your verified skills, deterministic gap benchmarks, and official scheme catalogues.'}
          </p>
        </div>

        <div className="copilot-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToggleConsent}
            disabled={isUpdatingConsent}
            title={consentAiProcessing ? 'Revoke AI Processing Consent' : 'Grant AI Processing Consent'}
          >
            <Icon name={consentAiProcessing ? 'toggle-right' : 'toggle-left'} size={14} />
            <span>
              {consentAiProcessing
                ? (isHindi ? 'एआई सहमति वापस लें' : 'Revoke AI Consent')
                : (isHindi ? 'एआई सहमति दें' : 'Grant AI Consent')}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleCreateNew}
          >
            <Icon name="plus" size={13} />
            <span>{isHindi ? 'नई बातचीत' : 'New Thread'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`auth-alert ${feedback.type}`} style={{ marginBottom: '1rem' }}>
          <Icon name="check-circle" size={14} />
          <span>{feedback.text}</span>
        </div>
      )}

      {errorMessage && (
        <div className="auth-alert error" style={{ marginBottom: '1rem' }}>
          <Icon name="alert-triangle" size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Copilot Grid */}
      <div className="copilot-main-grid">
        {/* Left Sidebar: Conversation Threads */}
        <div className="copilot-sidebar">
          <div className="copilot-sidebar-header">
            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {isHindi ? 'बातचीत इतिहास' : 'Conversation Threads'}
            </span>
            <span className="career-tab-badge">{conversations.length}</span>
          </div>

          <div className="copilot-threads-list">
            {isLoadingList ? (
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {isHindi ? 'कोई पूर्व बातचीत नहीं मिली।' : 'No conversations recorded.'}
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`copilot-thread-item ${activeConversationId === c.id ? 'active' : ''}`}
                  onClick={() => loadConversationDetail(c.id)}
                >
                  <div className="copilot-thread-info">
                    <div className="copilot-thread-title">{c.title || 'Career Guidance'}</div>
                    {c.last_message_preview && (
                      <div className="copilot-thread-preview">{c.last_message_preview}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="copilot-thread-delete-btn"
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    title="Delete thread"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Chat Pane */}
        <div className="copilot-chat-pane">
          {isLoadingConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner message={isHindi ? 'बातचीत लोड हो रही है...' : 'Loading message history...'} />
            </div>
          ) : (
            <>
              {/* Messages Scroll Area */}
              <div className="copilot-messages-container">
                {activeConversation?.messages?.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {isHindi ? 'बातचीत शुरू करने के लिए कोई प्रश्न पूछें।' : 'Ask a question below to start your guidance session.'}
                  </div>
                ) : (
                  activeConversation?.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`copilot-message-row ${msg.sender === 'user' ? 'user' : 'assistant'}`}
                    >
                      <div className="copilot-message-bubble">
                        <div className="copilot-message-header">
                          <span className="copilot-sender-tag">
                            <Icon name={msg.sender === 'user' ? 'user' : 'compass'} size={12} />
                            <span>{msg.sender === 'user' ? (isHindi ? 'आप (उम्मीदवार)' : 'Candidate') : 'Career Copilot'}</span>
                          </span>

                          {msg.sender === 'assistant' && msg.generation_mode && (
                            <span className={`copilot-mode-tag ${msg.generation_mode}`}>
                              {msg.generation_mode === 'ai_assisted' ? 'AI-Assisted' : 'Deterministic'}
                            </span>
                          )}
                        </div>

                        <div className="copilot-message-text">
                          {msg.sender === 'assistant' ? (
                            <div className="copilot-message-markdown">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => {
                                    const isSafe = href && (href.startsWith('https://') || href.startsWith('http://'));
                                    if (!isSafe) {
                                      return <span>{children}</span>;
                                    }
                                    return (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="copilot-md-link"
                                      >
                                        {children}
                                      </a>
                                    );
                                  },
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="copilot-user-text">
                              {msg.content}
                            </div>
                          )}
                        </div>

                        {/* Grounded Source References */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="copilot-sources-container">
                            <div className="copilot-sources-label">
                              <Icon name="link" size={11} />
                              <span>{isHindi ? 'सत्यापित स्रोत एवं संदर्भ:' : 'Grounded References & Evidence:'}</span>
                            </div>
                            <div className="copilot-sources-list">
                              {msg.sources.map((src, sIdx) => (
                                <div key={sIdx} className="copilot-source-chip">
                                  <span className="copilot-source-kind">
                                    {src.kind === 'opportunity' ? 'Listing' : src.kind === 'skill_gap' ? 'Gap Benchmark' : 'Milestone'}
                                  </span>
                                  {src.url ? (
                                    <a
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="copilot-source-link"
                                    >
                                      <span>{src.title}</span>
                                      <Icon name="arrow-up-right" size={10} />
                                    </a>
                                  ) : (
                                    <span className="copilot-source-title">{src.title}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Starter Question Pills */}
              <div className="copilot-starter-pills">
                {STARTER_PROMPTS.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    className="copilot-starter-pill"
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isSending}
                  >
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>

              {/* Message Input Box */}
              <div className="copilot-input-area">
                <textarea
                  className="copilot-textarea"
                  rows={2}
                  placeholder={
                    isHindi
                      ? 'अपनी लक्षित भूमिका, कौशल अंतर, या सत्यापित अवसरों के बारे में पूछें (Enter से भेजें)...'
                      : 'Ask about target roles, missing skills, or verified opportunities (Press Enter to send)...'
                  }
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                  maxLength={1000}
                />
                <div className="copilot-input-footer">
                  <span className="copilot-char-count">{inputContent.length} / 1000</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSendMessage()}
                    disabled={!inputContent.trim() || isSending}
                  >
                    {isSending ? (
                      <span>{isHindi ? 'विश्लेषण जारी...' : 'Thinking...'}</span>
                    ) : (
                      <>
                        <Icon name="send" size={13} />
                        <span>{isHindi ? 'भेजें' : 'Send'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transparency & Integrity Disclaimer */}
      <div className="copilot-integrity-note">
        <Icon name="shield" size={15} />
        <div>
          <strong>{isHindi ? 'डेटा अखंडता एवं सुरक्षा आश्वासन:' : 'Integrity & Data Protection Assurance:'}</strong>{' '}
          {isHindi
            ? 'करियर कोपायलट केवल सत्यापित डेटा स्रोतों और उम्मीदवार की सहेजी गई प्रोफ़ाइल का उपयोग करता है। व्यक्तिगत पहचान योग्य जानकारी (PII) कभी भी बाहरी मॉडल को प्रेषित नहीं की जाती।'
            : 'Career Copilot strictly verifies responses against official schemes, catalogued openings, and deterministic skill benchmarks. PII is scrubbed before processing and responses never fabricate unverified vacancies.'}
        </div>
      </div>
    </div>
  );
}
