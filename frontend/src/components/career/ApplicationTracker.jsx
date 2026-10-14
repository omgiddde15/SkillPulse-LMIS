import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchTrackedApplications,
  createTrackedApplication,
  updateTrackedApplication,
  deleteTrackedApplication,
} from '../../api/client';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';

const TRACKER_STAGES = [
  { id: 'all', labelKey: 'all', defaultLabel: 'All Stages' },
  { id: 'saved', labelKey: 'saved', defaultLabel: 'Saved', color: '#64748b' },
  { id: 'planning', labelKey: 'planning', defaultLabel: 'Planning', color: '#38bdf8' },
  { id: 'applied', labelKey: 'applied', defaultLabel: 'Applied', color: '#f59e0b' },
  { id: 'assessment', labelKey: 'assessment', defaultLabel: 'Assessment', color: '#c084fc' },
  { id: 'interview', labelKey: 'interview', defaultLabel: 'Interview', color: '#6366f1' },
  { id: 'offer', labelKey: 'offer', defaultLabel: 'Offer Received', color: '#10b981' },
  { id: 'rejected', labelKey: 'rejected', defaultLabel: 'Not Selected', color: '#ef4444' },
  { id: 'withdrawn', labelKey: 'withdrawn', defaultLabel: 'Withdrawn', color: '#94a3b8' },
];

export default function ApplicationTracker({ onNavigate, isHindi, t, isAuthenticated }) {
  const [items, setItems] = useState([]);
  const [selectedStage, setSelectedStage] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Modal state for manual entry or editing notes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOrg, setModalOrg] = useState('');
  const [modalStage, setModalStage] = useState('saved');
  const [modalDateApplied, setModalDateApplied] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load tracked items
  const loadTrackedItems = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchTrackedApplications();
      setItems(res?.items || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load tracked applications.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadTrackedItems();
  }, [loadTrackedItems]);

  // Stage change handler
  const handleUpdateStage = async (item, newStage) => {
    try {
      await updateTrackedApplication(item.id, { stage: newStage });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stage: newStage } : i));
      setFeedback({
        type: 'success',
        text: isHindi ? 'स्थिति सफलतापूर्वक अद्यतन की गई।' : `Application status updated to ${newStage}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update stage.');
    }
  };

  // Open modal for manual creation
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setModalTitle('');
    setModalOrg('');
    setModalStage('saved');
    setModalDateApplied('');
    setModalNotes('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setModalTitle(item.custom_title || item.linked_opportunity?.title || '');
    setModalOrg(item.custom_organization || item.linked_opportunity?.organization_name || '');
    setModalStage(item.stage || 'saved');
    setModalDateApplied(item.date_applied || '');
    setModalNotes(item.notes || '');
    setIsModalOpen(true);
  };

  // Save modal data
  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim() && !editingItem?.opportunity_id) {
      setErrorMessage(isHindi ? 'कृपया पद का नाम दर्ज करें।' : 'Please enter an opportunity or role title.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (editingItem) {
        await updateTrackedApplication(editingItem.id, {
          custom_title: modalTitle.trim() || null,
          custom_organization: modalOrg.trim() || null,
          stage: modalStage,
          date_applied: modalDateApplied.trim() || null,
          notes: modalNotes.trim() || null,
        });
        setFeedback({
          type: 'success',
          text: isHindi ? 'आवेदन विवरण अद्यतन किया गया।' : 'Application record updated successfully.',
        });
      } else {
        await createTrackedApplication({
          custom_title: modalTitle.trim(),
          custom_organization: modalOrg.trim() || null,
          stage: modalStage,
          date_applied: modalDateApplied.trim() || null,
          notes: modalNotes.trim() || null,
        });
        setFeedback({
          type: 'success',
          text: isHindi ? 'नया आवेदन ट्रैकर में जोड़ा गया।' : 'New application added to tracker.',
        });
      }

      setIsModalOpen(false);
      await loadTrackedItems();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save application.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete tracked item
  const handleDeleteItem = async (item) => {
    const title = item.linked_opportunity?.title || item.custom_title || 'Application';
    const confirmPrompt = isHindi
      ? `क्या आप वाकई "${title}" को ट्रैकर से हटाना चाहते हैं?`
      : `Are you sure you want to remove "${title}" from your application tracker?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await deleteTrackedApplication(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setFeedback({
        type: 'success',
        text: isHindi ? 'आवेदन सफलतापूर्वक हटाया गया।' : 'Application removed from tracker.',
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete application.');
    }
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (selectedStage !== 'all' && item.stage !== selectedStage) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (item.linked_opportunity?.title || item.custom_title || '').toLowerCase();
      const org = (item.linked_opportunity?.organization_name || item.custom_organization || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      return title.includes(q) || org.includes(q) || notes.includes(q);
    }
    return true;
  });

  // Calculate counts per stage
  const stageCounts = items.reduce((acc, curr) => {
    acc[curr.stage] = (acc[curr.stage] || 0) + 1;
    return acc;
  }, {});

  if (!isAuthenticated) {
    return (
      <div className="workspace-empty-state" style={{ padding: '3.5rem 1rem' }}>
        <div className="workspace-empty-icon"><Icon name="lock" size={32} /></div>
        <h3>{isHindi ? 'प्रमाणीकरण आवश्यक है' : 'Candidate Authentication Required'}</h3>
        <p>
          {isHindi
            ? 'अवसरों और आवेदनों को ट्रैक करने के लिए कृपया अपने उम्मीदवार खाते में साइन इन करें।'
            : 'Sign in to access your personal application tracker, monitor stages, and record submission dates.'}
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
    <div className="tracker-container">
      {/* Top Header */}
      <div className="workspace-header-row" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div className="workspace-title-row">
            <h2 className="workspace-title" style={{ fontSize: '1.25rem' }}>
              <Icon name="clipboard-list" size={18} />
              <span>{isHindi ? 'अवसर एवं आवेदन ट्रैकर' : 'Application & Opportunity Tracker'}</span>
            </h2>
            <span className="workspace-role-badge">
              <Icon name="shield" size={12} />
              <span>{isHindi ? 'उम्मीदवार निजी लॉग' : 'Private Candidate Pipeline'}</span>
            </span>
          </div>
          <p className="workspace-subtitle">
            {isHindi
              ? 'सत्यापित कैटलॉग अवसरों को सहेजें, बाहरी आवेदनों को दर्ज करें, और चरण प्रगति की निगरानी करें।'
              : 'Track verified catalogue schemes, internships, and external enterprise applications from discovery to offer.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate && onNavigate('opportunities')}
          >
            <Icon name="search" size={13} />
            <span>{isHindi ? 'कैटलॉग खोजें' : 'Explore Catalogue'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreateModal}
          >
            <Icon name="plus" size={13} />
            <span>{isHindi ? 'नया आवेदन जोड़ें' : 'Track Application'}</span>
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

      {/* Stage Filter Pills & Search */}
      <div className="tracker-controls-bar">
        <div className="tracker-stage-pills">
          {TRACKER_STAGES.map((st) => {
            const count = st.id === 'all' ? items.length : (stageCounts[st.id] || 0);
            return (
              <button
                key={st.id}
                type="button"
                className={`tracker-stage-pill ${selectedStage === st.id ? 'active' : ''}`}
                onClick={() => setSelectedStage(st.id)}
              >
                <span>{st.defaultLabel}</span>
                <span className="tracker-stage-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="tracker-search-box">
          <Icon name="search" size={13} />
          <input
            type="text"
            className="tracker-search-input"
            placeholder={isHindi ? 'आवेदन या संगठन खोजें...' : 'Filter by title, company, or notes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="chip-remove-btn"
              onClick={() => setSearchQuery('')}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingSpinner message={isHindi ? 'आवेदन डेटा लोड हो रहा है...' : 'Loading tracked applications...'} />
      ) : filteredItems.length === 0 ? (
        <div className="workspace-empty-state" style={{ padding: '3rem 1rem' }}>
          <div className="workspace-empty-icon"><Icon name="inbox" size={32} /></div>
          <h3>{isHindi ? 'कोई आवेदन नहीं मिला' : 'No Applications Recorded in this Stage'}</h3>
          <p>
            {isHindi
              ? 'सत्यापित पोर्टल से अवसर सहेजें या कस्टम बाहरी आवेदन मैन्युअल रूप से जोड़ें।'
              : 'Add an external application manually or track verified opportunities from the curated catalogue.'}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreateModal}
            >
              <Icon name="plus" size={13} />
              <span>{isHindi ? 'मैन्युअल आवेदन जोड़ें' : 'Add External Application'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate && onNavigate('opportunities')}
            >
              <Icon name="search" size={13} />
              <span>{isHindi ? 'कैटलॉग खोजें' : 'Explore Opportunities'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tracker-grid">
          {filteredItems.map((item) => {
            const isLinked = Boolean(item.linked_opportunity);
            const title = isLinked ? item.linked_opportunity.title : (item.custom_title || 'Untitled');
            const org = isLinked
              ? item.linked_opportunity.organization_name
              : (item.custom_organization || 'Direct Employer');
            const oppType = isLinked ? item.linked_opportunity.opportunity_type : 'external_job';
            const officialUrl = isLinked ? item.linked_opportunity.official_url : null;

            return (
              <div key={item.id} className="tracker-card">
                <div className="tracker-card-top">
                  <div className="tracker-card-badges">
                    <span className="tracker-type-badge">{oppType.replace('_', ' ')}</span>
                    {isLinked && (
                      <span className="tracker-verified-badge">
                        <Icon name="check-circle" size={10} />
                        <span>Verified Portal</span>
                      </span>
                    )}
                  </div>

                  <div className="tracker-stage-selector">
                    <label className="tracker-stage-label">Stage:</label>
                    <select
                      className="form-select form-select-sm tracker-stage-select"
                      value={item.stage}
                      onChange={(e) => handleUpdateStage(item, e.target.value)}
                    >
                      <option value="saved">Saved</option>
                      <option value="planning">Planning</option>
                      <option value="applied">Applied</option>
                      <option value="assessment">Assessment</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="rejected">Not Selected</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>
                </div>

                <h3 className="tracker-card-title">{title}</h3>
                <div className="tracker-card-org">
                  <Icon name="briefcase" size={12} />
                  <span>{org}</span>
                </div>

                {item.date_applied && (
                  <div className="tracker-card-date">
                    <Icon name="calendar" size={12} />
                    <span>Applied on: {item.date_applied}</span>
                  </div>
                )}

                {item.notes && (
                  <div className="tracker-card-notes">
                    <div className="tracker-notes-label">Notes:</div>
                    <div className="tracker-notes-content">{item.notes}</div>
                  </div>
                )}

                <div className="tracker-card-footer">
                  <div className="tracker-card-actions-left">
                    {officialUrl && (
                      <a
                        href={officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-xs"
                      >
                        <span>Official Portal</span>
                        <Icon name="arrow-up-right" size={11} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit application details"
                    >
                      <Icon name="edit" size={11} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-danger"
                    onClick={() => handleDeleteItem(item)}
                    title="Remove from tracker"
                  >
                    <Icon name="trash" size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="skill-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="skill-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Icon name={editingItem ? 'edit' : 'plus'} size={16} />
                <span>{editingItem ? 'Edit Tracked Application' : 'Track New Application'}</span>
              </h3>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => setIsModalOpen(false)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '1rem' }}>
              {/* Role / Opportunity Title */}
              <div className="form-group">
                <label className="form-label">Role or Opportunity Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Junior Python Developer, DRDO Graduate Apprentice"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  disabled={Boolean(editingItem?.opportunity_id) || isSaving}
                  required={!editingItem?.opportunity_id}
                />
              </div>

              {/* Organization */}
              <div className="form-group">
                <label className="form-label">Company / Organization (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Infosys, TCS, AICTE, ISRO"
                  value={modalOrg}
                  onChange={(e) => setModalOrg(e.target.value)}
                  disabled={Boolean(editingItem?.opportunity_id) || isSaving}
                />
              </div>

              {/* Stage */}
              <div className="form-group">
                <label className="form-label">Current Pipeline Stage</label>
                <select
                  className="form-select"
                  value={modalStage}
                  onChange={(e) => setModalStage(e.target.value)}
                  disabled={isSaving}
                >
                  <option value="saved">Saved (Exploring)</option>
                  <option value="planning">Planning (Preparing Resume/Skills)</option>
                  <option value="applied">Applied (Submitted)</option>
                  <option value="assessment">Assessment (Online Test / Coding Exam)</option>
                  <option value="interview">Interview (Technical / HR Scheduled)</option>
                  <option value="offer">Offer (Received Letter of Intent)</option>
                  <option value="rejected">Not Selected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              {/* Date Applied */}
              <div className="form-group">
                <label className="form-label">Date Applied (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={modalDateApplied}
                  onChange={(e) => setModalDateApplied(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes & Follow-ups (Optional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Contacted recruiter on LinkedIn; Next round is DSA on Monday."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  disabled={isSaving}
                  maxLength={2000}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="auth-ghost-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="auth-primary-btn"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Icon name="check" size={13} />
                      <span>{editingItem ? 'Update Application' : 'Save Application'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
