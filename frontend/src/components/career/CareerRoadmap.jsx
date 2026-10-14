import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchSupportedRoles,
  fetchCareerProfile,
  saveCareerProfile,
  fetchCareerRoadmaps,
  fetchCareerRoadmapDetails,
  generateCareerRoadmap,
  deleteCareerRoadmap,
  updateRoadmapMilestoneStatus,
} from '../../api/client';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';

const ACTION_COLORS = {
  learn: { bg: 'rgba(56, 189, 248, 0.12)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
  practise: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  build_project: { bg: 'rgba(168, 85, 247, 0.12)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
  review: { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
  apply: { bg: 'rgba(244, 63, 94, 0.12)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' },
};

export default function CareerRoadmap({ onNavigate, isHindi, t, isAuthenticated }) {
  // Roles and profile
  const [supportedRoles, setSupportedRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('ROLE_PY_BACKEND');
  const [horizonDays, setHorizonDays] = useState(30);
  const [consentAiProcessing, setConsentAiProcessing] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);

  // Roadmaps state
  const [roadmaps, setRoadmaps] = useState([]);
  const [activeRoadmap, setActiveRoadmap] = useState(null);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load initial roles, profile consent, and existing roadmaps
  const loadInitialData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoadingRoadmaps(false);
      return;
    }

    setIsLoadingRoadmaps(true);
    setErrorMessage(null);

    try {
      // 1. Fetch supported roles
      const rolesRes = await fetchSupportedRoles();
      const roles = rolesRes?.roles || [];
      setSupportedRoles(roles);

      // 2. Fetch career profile for AI consent
      const profRes = await fetchCareerProfile();
      if (profRes?.has_profile && profRes.profile) {
        setConsentAiProcessing(Boolean(profRes.profile.consent_ai_processing));
        if (profRes.profile.target_occupation_id) {
          const matched = roles.find(r => r.benchmark_occupation_id === profRes.profile.target_occupation_id);
          if (matched) setSelectedRoleId(matched.role_id);
        }
      }

      // 3. Fetch user's saved roadmaps
      const listRes = await fetchCareerRoadmaps();
      const userRoadmaps = listRes?.roadmaps || [];
      setRoadmaps(userRoadmaps);

      // Load latest active roadmap if available
      if (userRoadmaps.length > 0) {
        const detailRes = await fetchCareerRoadmapDetails(userRoadmaps[0].id);
        setActiveRoadmap(detailRes);
      } else {
        setActiveRoadmap(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load career roadmap data.');
    } finally {
      setIsLoadingRoadmaps(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
          : (isHindi ? 'एआई प्रसंस्करण सहमति अक्षम की गई।' : 'AI processing consent disabled.'),
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update AI consent preference.');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  // Generate new roadmap
  const handleGenerateRoadmap = async () => {
    if (!selectedRoleId) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const newRoadmap = await generateCareerRoadmap({
        target_role_id: selectedRoleId,
        horizon_days: horizonDays,
      });

      setActiveRoadmap(newRoadmap);

      // Refresh list
      const listRes = await fetchCareerRoadmaps();
      setRoadmaps(listRes?.roadmaps || []);

      setFeedback({
        type: 'success',
        text: isHindi
          ? 'व्यक्तिगत करियर रोडमैप सफलतापूर्वक तैयार किया गया!'
          : 'Personalized career roadmap generated successfully!',
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to generate roadmap.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Select a saved roadmap
  const handleSelectRoadmap = async (roadmapId) => {
    try {
      setIsLoadingRoadmaps(true);
      const detail = await fetchCareerRoadmapDetails(roadmapId);
      setActiveRoadmap(detail);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load selected roadmap.');
    } finally {
      setIsLoadingRoadmaps(false);
    }
  };

  // Delete a saved roadmap
  const handleDeleteRoadmap = async (roadmapId) => {
    const confirmPrompt = isHindi
      ? 'क्या आप वाकई इस सहेजे गए रोडमैप को हटाना चाहते हैं?'
      : 'Are you sure you want to delete this saved roadmap?';
    if (!window.confirm(confirmPrompt)) return;

    try {
      await deleteCareerRoadmap(roadmapId);
      const updatedList = roadmaps.filter((r) => r.id !== roadmapId);
      setRoadmaps(updatedList);

      if (activeRoadmap?.id === roadmapId) {
        if (updatedList.length > 0) {
          const detail = await fetchCareerRoadmapDetails(updatedList[0].id);
          setActiveRoadmap(detail);
        } else {
          setActiveRoadmap(null);
        }
      }

      setFeedback({
        type: 'success',
        text: isHindi ? 'रोडमैप हटा दिया गया।' : 'Roadmap deleted successfully.',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete roadmap.');
    }
  };

  // Toggle milestone completion
  const handleToggleMilestone = async (milestone) => {
    if (!activeRoadmap) return;
    setUpdatingMilestoneId(milestone.id);

    try {
      const nextStatus = !milestone.is_completed;
      const res = await updateRoadmapMilestoneStatus(activeRoadmap.id, milestone.id, nextStatus);

      // Update active roadmap in local state
      setActiveRoadmap((prev) => {
        if (!prev) return prev;
        const updatedMilestones = prev.milestones.map((m) =>
          m.id === milestone.id ? res.milestone : m
        );
        const completedCount = updatedMilestones.filter((m) => m.is_completed).length;
        const totalCount = updatedMilestones.length;
        const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0;

        return {
          ...prev,
          milestones: updatedMilestones,
          completed_milestones: completedCount,
          progress_percentage: progressPct,
        };
      });

      // Update list state
      setRoadmaps((prevList) =>
        prevList.map((r) => {
          if (r.id === activeRoadmap.id) {
            const nextCompleted = milestone.is_completed
              ? Math.max(0, r.completed_milestones - 1)
              : r.completed_milestones + 1;
            const nextPct = r.total_milestones > 0
              ? Math.round((nextCompleted / r.total_milestones) * 1000) / 10
              : 0;
            return {
              ...r,
              completed_milestones: nextCompleted,
              progress_percentage: nextPct,
            };
          }
          return r;
        })
      );
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update milestone status.');
    } finally {
      setUpdatingMilestoneId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="career-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Icon name="compass" size={36} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t('roadmap.title')}
        </h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0.5rem auto 1.5rem' }}>
          {isHindi
            ? 'व्यक्तिगत करियर रोडमैप तैयार करने, प्रगति ट्रैक करने और मील के पत्थर प्रबंधित करने के लिए साइन इन करें।'
            : 'Sign in to generate personalized AI-assisted career roadmaps, track milestone completion, and link verified skilling opportunities.'}
        </p>
        <button
          type="button"
          className="auth-primary-btn"
          style={{ padding: '0.6rem 1.4rem' }}
          onClick={() => onNavigate && onNavigate('login')}
        >
          <Icon name="lock" size={14} />
          <span>{isHindi ? 'साइन इन करें' : 'Sign In'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="roadmap-container">
      {/* Alerts */}
      {errorMessage && (
        <div className="auth-alert error" style={{ marginBottom: '1.25rem' }}>
          <Icon name="alert-triangle" size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {feedback && (
        <div className={`auth-alert ${feedback.type}`} style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Generator Control Card */}
      <div className="career-card" style={{ marginBottom: '1.5rem' }}>
        <div className="career-card-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 className="career-card-title">
              <Icon name="compass" size={18} />
              <span>{t('roadmap.title')}</span>
            </h2>
            <p className="career-card-subtitle">{t('roadmap.subtitle')}</p>
          </div>
        </div>

        <div className="roadmap-controls-grid">
          {/* Target Role Selector */}
          <div className="auth-field-group">
            <label className="auth-label">{t('roadmap.selectRole')}</label>
            <select
              className="auth-input"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={isGenerating}
            >
              {supportedRoles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {role.title} ({role.sector})
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div className="auth-field-group">
            <label className="auth-label">{t('roadmap.horizon')}</label>
            <div className="roadmap-horizon-pills">
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`roadmap-horizon-pill ${horizonDays === days ? 'active' : ''}`}
                  onClick={() => setHorizonDays(days)}
                  disabled={isGenerating}
                >
                  <Icon name="clock" size={13} />
                  <span>
                    {days === 30
                      ? t('roadmap.h30')
                      : days === 60
                      ? t('roadmap.h60')
                      : t('roadmap.h90')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Roadmap Context Callout */}
        {activeRoadmap && (
          <div className="roadmap-active-selection-callout">
            <div className="roadmap-active-selection-callout-icon">
              <Icon name="info" size={15} />
            </div>
            <div className="roadmap-active-selection-callout-content">
              <span className="roadmap-active-selection-callout-label">
                {isHindi ? 'वर्तमान में चयनित सहेजी गई योजना:' : 'Currently Inspected Saved Plan:'}
              </span>
              <strong> {activeRoadmap.role_title} ({activeRoadmap.horizon_days} {isHindi ? 'दिन' : 'Days'})</strong>
              <span className="roadmap-active-selection-callout-hint">
                {' — '}
                {isHindi
                  ? 'ऊपर दिए गए चयन को बदलने से सहेजी गई योजना पर तब तक कोई प्रभाव नहीं पड़ेगा जब तक आप नया रोडमैप तैयार नहीं करते।'
                  : 'Changing generator inputs above will not alter this saved plan until you click Generate.'}
              </span>
            </div>
          </div>
        )}

        {/* AI Consent Status & Toggle Bar */}
        <div className="roadmap-consent-bar">
          <div className="roadmap-consent-info">
            <div className={`roadmap-consent-indicator ${consentAiProcessing ? 'active' : 'inactive'}`} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                {t('roadmap.aiConsentTitle')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {consentAiProcessing ? t('roadmap.aiConsentActive') : t('roadmap.aiConsentDisabled')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="roadmap-consent-toggle-btn"
            onClick={handleToggleConsent}
            disabled={isUpdatingConsent || isGenerating}
          >
            <span>
              {consentAiProcessing
                ? (isHindi ? 'सहमति वापस लें' : 'Revoke AI Consent')
                : t('roadmap.enableConsent')}
            </span>
          </button>
        </div>

        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            className="auth-primary-btn"
            onClick={handleGenerateRoadmap}
            disabled={isGenerating || !selectedRoleId}
            style={{ padding: '0.6rem 1.4rem' }}
          >
            {isGenerating ? (
              <>
                <LoadingSpinner size={14} />
                <span>{t('roadmap.generatingBtn')}</span>
              </>
            ) : (
              <>
                <Icon name="zap" size={14} />
                <span>{activeRoadmap ? t('roadmap.regenerateBtn') : t('roadmap.generateBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="roadmap-workspace-layout">
        {/* Left Column: Saved Roadmaps Drawer */}
        <div className="roadmap-saved-col">
          <div className="career-card" style={{ height: '100%' }}>
            <div className="career-card-header" style={{ marginBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon name="calendar" size={14} />
                <span>{t('roadmap.savedRoadmaps')}</span>
                <span className="career-tab-badge" style={{ marginLeft: 'auto' }}>
                  {roadmaps.length}
                </span>
              </h3>
            </div>

            {roadmaps.length === 0 ? (
              <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {t('roadmap.noSaved')}
              </div>
            ) : (
              <div className="roadmap-saved-list">
                {roadmaps.map((rm) => {
                  const isCurrent = activeRoadmap?.id === rm.id;
                  return (
                    <div
                      key={rm.id}
                      className={`roadmap-saved-item ${isCurrent ? 'active' : ''}`}
                      onClick={() => handleSelectRoadmap(rm.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                          {rm.role_title}
                        </div>
                        <button
                          type="button"
                          className="roadmap-item-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoadmap(rm.id);
                          }}
                          title={isHindi ? 'रोडमैप हटाएं' : 'Delete roadmap'}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="roadmap-mini-pill horizon">
                          {rm.horizon_days}d
                        </span>
                        <span className={`roadmap-mini-pill mode ${rm.generation_mode}`}>
                          {rm.generation_mode === 'ai_assisted' ? 'AI' : 'Rules'}
                        </span>
                        <span className="roadmap-mini-pill progress">
                          {rm.completed_milestones}/{rm.total_milestones} ({rm.progress_percentage}%)
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
                        {new Date(rm.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Roadmap Detail */}
        <div className="roadmap-detail-col">
          {isLoadingRoadmaps ? (
            <div className="career-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <LoadingSpinner size={24} />
              <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {isHindi ? 'रोडमैप लोड हो रहा है...' : 'Loading career roadmap...'}
              </div>
            </div>
          ) : !activeRoadmap ? (
            <div className="career-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Icon name="compass" size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
                {t('roadmap.noSaved')}
              </h3>
            </div>
          ) : (
            <div className="career-card">
              {/* Header Card Info */}
              <div className="roadmap-active-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <span className="roadmap-inspected-plan-pill">
                      <Icon name="bookmark" size={11} />
                      <span>{isHindi ? 'सहेजी गई योजना' : 'Active Saved Plan'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {activeRoadmap.role_title}
                    </h3>
                    <span className={`roadmap-mode-badge ${activeRoadmap.generation_mode}`}>
                      <Icon name={activeRoadmap.generation_mode === 'ai_assisted' ? 'zap' : 'sliders'} size={12} />
                      <span>
                        {activeRoadmap.generation_mode === 'ai_assisted'
                          ? t('roadmap.modeAi')
                          : t('roadmap.modeDeterministic')}
                      </span>
                    </span>
                    <span className="roadmap-horizon-badge">
                      <Icon name="clock" size={12} />
                      <span>{activeRoadmap.horizon_days} Days Horizon</span>
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '0.4rem' }}>
                    {activeRoadmap.summary}
                  </p>
                </div>

                {/* Progress Metric */}
                <div className="roadmap-progress-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t('roadmap.progress')}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {activeRoadmap.completed_milestones} / {activeRoadmap.total_milestones} ({activeRoadmap.progress_percentage}%)
                    </span>
                  </div>
                  <div className="roadmap-progress-track">
                    <div
                      className="roadmap-progress-fill"
                      style={{ width: `${activeRoadmap.progress_percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Methodology Note Box */}
              <div className="roadmap-methodology-callout">
                <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Pillar Methodology</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>{activeRoadmap.methodology_note}</div>
                </div>
              </div>

              {/* Milestone Timeline List */}
              <div className="roadmap-milestones-timeline">
                {activeRoadmap.milestones.map((m) => {
                  const actionStyle = ACTION_COLORS[m.action_type] || ACTION_COLORS.practise;
                  const isUpdating = updatingMilestoneId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`roadmap-milestone-card ${m.is_completed ? 'completed' : ''}`}
                    >
                      {/* Left: Checkbox & Order */}
                      <div className="milestone-check-col">
                        <button
                          type="button"
                          className={`milestone-checkbox ${m.is_completed ? 'checked' : ''}`}
                          onClick={() => handleToggleMilestone(m)}
                          disabled={isUpdating}
                          title={m.is_completed ? (isHindi ? 'अपूर्ण चिह्नित करें' : 'Mark incomplete') : (isHindi ? 'पूर्ण चिह्नित करें' : 'Mark completed')}
                        >
                          {m.is_completed ? <Icon name="check-circle" size={16} /> : <span>{m.milestone_order}</span>}
                        </button>
                      </div>

                      {/* Right: Content */}
                      <div className="milestone-content-col">
                        <div className="milestone-content-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span
                              className="milestone-action-badge"
                              style={{
                                backgroundColor: actionStyle.bg,
                                color: actionStyle.text,
                                border: `1px solid ${actionStyle.border}`,
                              }}
                            >
                              {m.action_type === 'learn'
                                ? t('roadmap.actionLearn')
                                : m.action_type === 'practise'
                                ? t('roadmap.actionPractise')
                                : m.action_type === 'build_project'
                                ? t('roadmap.actionBuildProject')
                                : m.action_type === 'review'
                                ? t('roadmap.actionReview')
                                : t('roadmap.actionApply')}
                            </span>
                            <span className="milestone-duration-badge">
                              <Icon name="clock" size={11} />
                              <span>{t('roadmap.effortDays', { days: m.suggested_duration_days })}</span>
                            </span>
                            {m.is_completed && (
                              <span className="milestone-completed-badge">
                                <Icon name="check-circle" size={11} />
                                <span>{t('roadmap.completed')}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <h4 className="milestone-title">{m.title}</h4>
                        <p className="milestone-description">{m.description}</p>

                        {/* Target Competencies */}
                        {m.target_skill_keys && m.target_skill_keys.length > 0 && (
                          <div className="milestone-skills-row">
                            <span className="milestone-skills-label">{t('roadmap.targetSkills')}</span>
                            <div className="milestone-skill-tags">
                              {m.target_skill_keys.map((sk) => (
                                <span key={sk} className="milestone-skill-tag">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked Verified Opportunity Card */}
                        {m.linked_opportunity && (
                          <div className="milestone-opp-card">
                            <div className="milestone-opp-header">
                              <div>
                                <span className="milestone-opp-type-pill">
                                  {m.linked_opportunity.opportunity_type}
                                </span>
                                <h5 className="milestone-opp-title">
                                  {m.linked_opportunity.title}
                                </h5>
                                <div className="milestone-opp-provider">
                                  {m.linked_opportunity.provider_name}
                                </div>
                              </div>
                              <a
                                href={m.linked_opportunity.official_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="milestone-opp-link-btn"
                              >
                                <span>{isHindi ? 'आधिकारिक लिंक' : 'Official Portal'}</span>
                                <Icon name="external-link" size={12} />
                              </a>
                            </div>

                            {m.linked_opportunity.provenance_notes && (
                              <div className="milestone-opp-provenance">
                                <span style={{ fontWeight: 600 }}>{t('roadmap.sourceProvenance')} </span>
                                <span>{m.linked_opportunity.provenance_notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legal / Guidance Disclaimer */}
              <div className="roadmap-disclaimer-box">
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  {t('roadmap.disclaimerTitle')}
                </div>
                <div>{activeRoadmap.disclaimer || t('roadmap.disclaimer')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
