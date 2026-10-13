import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { fetchSavedScenarios, deleteSavedScenario } from '../../api/client';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';

export default function MyWorkspace({ onNavigate, onReopenScenario }) {
  const { user, isAuthenticated, isDemo } = useAuth();
  const { t, isHindi } = useLanguage();

  const [scenarios, setScenarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const loadScenarios = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchSavedScenarios();
      setScenarios(res?.results || []);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (isHindi
            ? 'सहेजे गए परिदृश्यों को लोड करने में असमर्थ।'
            : 'Unable to load saved scenarios from backend.')
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isHindi]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const handleDelete = async (scenarioId, title) => {
    const confirmText = isHindi
      ? `क्या आप वाकई परिदृश्य "${title}" को हटाना चाहते हैं?`
      : `Are you sure you want to delete the scenario "${title}"?`;
    if (!window.confirm(confirmText)) return;

    setDeletingId(scenarioId);
    setFeedbackMessage(null);
    try {
      await deleteSavedScenario(scenarioId);
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
      setFeedbackMessage(
        isHindi
          ? `परिदृश्य "${title}" सफलतापूर्वक हटाया गया।`
          : `Scenario "${title}" deleted successfully.`
      );
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete scenario.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReopen = (scenario) => {
    if (onReopenScenario) {
      onReopenScenario(scenario);
    } else {
      onNavigate('simulator');
    }
  };

  return (
    <div className="my-workspace-container">
      {/* Page Header */}
      <div className="workspace-header-row">
        <div>
          <div className="workspace-title-row">
            <h1 className="workspace-title">
              {isHindi ? 'मेरा व्यक्तिगत कार्यक्षेत्र' : 'My Personal Workspace'}
            </h1>
            <span className="workspace-role-badge">
              <Icon name="shield" size={13} />
              <span>{isAuthenticated ? (isHindi ? 'प्रमाणीकृत नीति नियोजक' : 'Authenticated Policy Planner') : 'Demo Visitor'}</span>
            </span>
          </div>
          <p className="workspace-subtitle">
            {isHindi
              ? 'प्रशिक्षण-सीट सिमुलेटर परिदृश्यों को प्रबंधित एवं पुनः परीक्षण करें'
              : 'Review, compare, and reopen custom Training-Seat Simulator planning scenarios'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isAuthenticated && (
            <button
              type="button"
              className="btn-refresh"
              onClick={loadScenarios}
              disabled={isLoading}
              title="Refresh saved scenarios"
            >
              <Icon name="refresh" size={14} />
              <span>{isHindi ? 'रिफ्रेश करें' : 'Refresh'}</span>
            </button>
          )}

          <button
            type="button"
            className="auth-primary-btn"
            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
            onClick={() => onNavigate('simulator')}
          >
            <Icon name="sliders" size={14} />
            <span>{isHindi ? 'नया परिदृश्य बनाएं' : 'New Scenario'}</span>
          </button>
        </div>
      </div>

      {/* Demo Mode Notice Banner if unauthenticated or demo */}
      {!isAuthenticated && (
        <div className="workspace-demo-notice-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="workspace-notice-icon">
              <Icon name="info" size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {isHindi
                  ? 'डेमो मोड सक्रिय है — परिदृश्य सहेजने के लिए साइन इन करें'
                  : 'Demo Mode Active — Read-Only Exploration'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {isHindi
                  ? 'आप परिदृश्य सिमुलेटर का परीक्षण कर सकते हैं, लेकिन अपने अनुकूलित परिदृश्यों को स्थायी रूप से सहेजने के लिए एक निःशुल्क खाता आवश्यक है।'
                  : 'You can test the Training-Seat Simulator freely, but saving and persisting custom policy scenarios requires signing in.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="auth-primary-btn"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
              onClick={() => onNavigate('login')}
            >
              <Icon name="lock" size={13} />
              <span>{isHindi ? 'साइन इन करें' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              className="auth-ghost-btn"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}
              onClick={() => onNavigate('signup')}
            >
              <span>{isHindi ? 'खाता बनाएं' : 'Create Account'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Authenticated User Profile Summary Card */}
      {isAuthenticated && user && (
        <div className="workspace-user-card">
          <div className="workspace-avatar">
            <Icon name="user" size={24} />
          </div>
          <div className="workspace-user-details">
            <div className="workspace-user-name">{user.full_name}</div>
            <div className="workspace-user-email">{user.email}</div>
          </div>
          <div className="workspace-meta-stat">
            <div className="workspace-stat-num">{scenarios.length}</div>
            <div className="workspace-stat-label">
              {isHindi ? 'सहेजे गए परिदृश्य' : 'Saved Scenarios'}
            </div>
          </div>
        </div>
      )}

      {/* Success / Feedback Alert */}
      {feedbackMessage && (
        <div className="auth-alert success" style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="auth-alert error" style={{ marginBottom: '1.25rem' }}>
          <Icon name="alert-triangle" size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Scenarios List Section */}
      {isLoading ? (
        <LoadingSpinner message={isHindi ? 'परिदृश्य लोड हो रहे हैं...' : 'Loading your saved scenarios...'} />
      ) : scenarios.length === 0 ? (
        <div className="workspace-empty-state">
          <div className="workspace-empty-icon">
            <Icon name="bookmark" size={32} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            {isHindi ? 'कोई सहेजा गया परिदृश्य नहीं मिला' : 'No saved scenarios yet'}
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
            {isHindi
              ? 'परिदृश्य स्टूडियो में जाएं, किसी भी ज़िले और व्यवसाय के लिए सीट आवंटन सिमुलेशन चलाएं, और उसे अपने कार्यक्षेत्र में सहेजें।'
              : 'Open the Training-Seat Simulator, simulate training seat reallocations for any district and occupation, then click "Save Scenario" to track them here.'}
          </p>
          <button
            type="button"
            className="auth-primary-btn"
            style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem' }}
            onClick={() => onNavigate('simulator')}
          >
            <Icon name="sliders" size={14} />
            <span>{isHindi ? 'सिमुलेटर खोलें' : 'Open Scenario Studio'}</span>
          </button>
        </div>
      ) : (
        <div className="workspace-scenarios-grid">
          {scenarios.map((scen) => {
            const results = scen.results || {};
            const baselineMismatch =
              results?.baseline_projection?.projected_relative_mismatch ??
              results?.baseline_projection?.relative_mismatch_score ??
              null;
            const scenarioMismatch =
              results?.scenario_projection?.projected_relative_mismatch ??
              results?.scenario_projection?.relative_mismatch_score ??
              null;
            const mismatchDelta =
              results?.comparative_impact?.relative_mismatch_point_change ??
              (baselineMismatch != null && scenarioMismatch != null
                ? Math.round((scenarioMismatch - baselineMismatch) * 10) / 10
                : null);

            const isDeleting = deletingId === scen.id;

            return (
              <div key={scen.id} className="workspace-scenario-card">
                {/* Card Top: Title & Date */}
                <div className="scenario-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="scenario-card-title">{scen.title}</h3>
                    <div className="scenario-card-meta">
                      <span>{new Date(scen.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span>•</span>
                      <span>{scen.period}</span>
                      <span>•</span>
                      <span>{scen.horizon_months}M Horizon</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="scenario-delete-btn"
                    onClick={() => handleDelete(scen.id, scen.title)}
                    disabled={isDeleting}
                    title={isHindi ? 'परिदृश्य हटाएं' : 'Delete scenario'}
                    aria-label="Delete scenario"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>

                {/* Notes if present */}
                {scen.notes && (
                  <p className="scenario-card-notes">{scen.notes}</p>
                )}

                {/* Entity Pills */}
                <div className="scenario-entity-pills">
                  <span className="scenario-pill district">
                    <Icon name="map-pin" size={12} />
                    <span>{scen.district_name || scen.district_id} ({scen.state_code || scen.district_id.split('_')[0]})</span>
                  </span>
                  <span className="scenario-pill occupation">
                    <Icon name="briefcase" size={12} />
                    <span>{scen.occupation_title || scen.occupation_id}</span>
                  </span>
                  <span className="scenario-pill seats">
                    <Icon name="sliders" size={12} />
                    <span>+{scen.proposed_seats_per_cohort} seats/cohort</span>
                  </span>
                </div>

                {/* Metric Summary Grid */}
                <div className="scenario-metrics-strip">
                  <div className="scenario-metric-box">
                    <div className="scenario-metric-label">{isHindi ? 'प्रस्तावित सीटें' : 'Proposed Seats'}</div>
                    <div className="scenario-metric-val">{scen.proposed_seats_per_cohort}</div>
                  </div>
                  <div className="scenario-metric-box">
                    <div className="scenario-metric-label">{isHindi ? 'पूर्वानुमान अवधि' : 'Target Month'}</div>
                    <div className="scenario-metric-val" style={{ fontSize: '0.85rem' }}>
                      {scen.inputs?.target_period || `${scen.horizon_months} Months`}
                    </div>
                  </div>
                  <div className="scenario-metric-box">
                    <div className="scenario-metric-label">{isHindi ? 'अंतराल प्रभाव' : 'Mismatch Impact'}</div>
                    <div
                      className="scenario-metric-val"
                      style={{
                        color:
                          mismatchDelta != null
                            ? mismatchDelta < 0
                              ? 'var(--accent-primary)'
                              : mismatchDelta > 0
                              ? '#ef4444'
                              : 'inherit'
                            : 'inherit',
                      }}
                    >
                      {mismatchDelta != null ? `${mismatchDelta > 0 ? '+' : ''}${mismatchDelta} pts` : 'Simulated'}
                    </div>
                  </div>
                </div>

                {/* Scientific Planning Disclaimer */}
                <div className="scenario-disclaimer-banner">
                  <Icon name="info" size={12} />
                  <span>{scen.disclaimer || 'Simulated Scenario — Policy Planning Projection'}</span>
                </div>

                {/* Card Actions */}
                <div className="scenario-card-actions">
                  <button
                    type="button"
                    className="scenario-reopen-btn"
                    onClick={() => handleReopen(scen)}
                  >
                    <Icon name="sliders" size={13} />
                    <span>{isHindi ? 'सिमुलेटर में फिर से खोलें' : 'Reopen in Simulator'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
