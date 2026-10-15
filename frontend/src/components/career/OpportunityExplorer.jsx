import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import {
  fetchOpportunities,
  fetchOpportunityRecommendations,
  fetchTrackedApplications,
  createTrackedApplication,
} from '../../api/client';

export default function OpportunityExplorer({ onNavigate }) {
  const { t, isHindi } = useLanguage();
  const { isAuthenticated } = useAuth();

  // Primary view tabs: 'personalized' (if authenticated) vs 'catalogue'
  const [activeView, setActiveView] = useState(isAuthenticated ? 'personalized' : 'catalogue');

  // Catalogue data state
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);

  // Recommendations data state
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedFee, setSelectedFee] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedKind, setSelectedKind] = useState('all');
  const [selectedWorkArrangement, setSelectedWorkArrangement] = useState('all');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Selected vacancy modal state
  const [selectedVacancy, setSelectedVacancy] = useState(null);

  // Error and feedback state
  const [errorMessage, setErrorMessage] = useState(null);
  const [trackerFeedback, setTrackerFeedback] = useState(null);

  // Tracked opportunities set
  const [trackedOppIds, setTrackedOppIds] = useState(new Set());
  const [trackingId, setTrackingId] = useState(null);

  // Load candidate's tracked opportunities
  const loadTrackedList = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetchTrackedApplications();
      const ids = new Set((res?.items || []).map(i => i.opportunity_id).filter(Boolean));
      setTrackedOppIds(ids);
    } catch {
      // Ignore background fetch error
    }
  }, [isAuthenticated]);

  // Load recommendations for authenticated user
  const loadRecommendations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingRecs(true);
    setErrorMessage(null);
    try {
      const res = await fetchOpportunityRecommendations();
      if (res && res.status === 'success') {
        setRecommendationsData(res);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load personalized recommendations.');
    } finally {
      setIsLoadingRecs(false);
    }
  }, [isAuthenticated]);

  const handleTrackOpportunity = async (opp) => {
    if (!isAuthenticated) {
      if (onNavigate) onNavigate('login');
      return;
    }
    if (!opp?.id || trackedOppIds.has(opp.id)) return;

    setTrackingId(opp.id);
    try {
      await createTrackedApplication({
        opportunity_id: opp.id,
        stage: 'saved',
      });
      setTrackedOppIds(prev => new Set([...prev, opp.id]));
      setTrackerFeedback(isHindi ? `"${opp.title}" को आवेदन ट्रैकर में सहेजा गया!` : `"${opp.title}" saved to Application Tracker!`);
      setTimeout(() => setTrackerFeedback(null), 3500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to track opportunity.');
    } finally {
      setTrackingId(null);
    }
  };

  // Load catalogue items
  const loadCatalogue = useCallback(async () => {
    setIsLoadingCatalogue(true);
    setErrorMessage(null);
    try {
      const params = { limit: 100 };
      if (selectedType !== 'all') params.opportunity_type = selectedType;
      if (selectedFee !== 'all') params.fee_status = selectedFee;
      if (selectedMode !== 'all') params.work_mode = selectedMode;
      if (selectedKind !== 'all') params.record_kind = selectedKind;
      if (selectedWorkArrangement !== 'all') params.work_arrangement = selectedWorkArrangement;
      if (selectedIndustry !== 'all') params.industry = selectedIndustry;
      if (selectedLocation !== 'all') params.location_city = selectedLocation;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchOpportunities(params);
      if (res && res.status === 'success') {
        setCatalogueItems(res.items || []);
        setTotalCount(res.total || 0);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to query opportunity catalogue.');
    } finally {
      setIsLoadingCatalogue(false);
    }
  }, [selectedType, selectedFee, selectedMode, selectedKind, selectedWorkArrangement, selectedIndustry, selectedLocation, searchQuery]);

  // Initial loads
  useEffect(() => {
    if (isAuthenticated) {
      loadRecommendations();
      loadTrackedList();
    }
  }, [isAuthenticated, loadRecommendations, loadTrackedList]);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  // Debounced search reset
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedFee('all');
    setSelectedMode('all');
    setSelectedKind('all');
    setSelectedWorkArrangement('all');
    setSelectedIndustry('all');
    setSelectedLocation('all');
  };

  // Types definitions with counts
  const opportunityTypes = [
    { id: 'all', labelKey: 'opp.filterTypeAll', defaultLabel: 'All Types' },
    { id: 'course', labelKey: 'opp.typeCourse', defaultLabel: 'Courses', icon: 'award' },
    { id: 'internship', labelKey: 'opp.typeInternship', defaultLabel: 'Internships', icon: 'briefcase' },
    { id: 'apprenticeship', labelKey: 'opp.typeApprenticeship', defaultLabel: 'Apprenticeships', icon: 'sliders' },
    { id: 'job', labelKey: 'opp.typeJob', defaultLabel: 'Jobs', icon: 'trending-up' },
    { id: 'scheme', labelKey: 'opp.typeScheme', defaultLabel: 'Government Schemes', icon: 'shield' },
  ];

  // Helper to render an individual opportunity card
  const renderOpportunityCard = (item, matchMeta = null) => {
    const isDirectory = item.record_kind === 'portal_directory';
    const isCuratedPilot = item.record_kind === 'curated_pilot_listing';
    const isCurriculum = item.record_kind === 'curriculum_standard';
    const isClosed = item.record_kind === 'closed_listing' || item.listing_status === 'closed' || item.is_deadline_passed;
    const isScheme = item.record_kind === 'scheme_reference' || item.opportunity_type === 'scheme';
    const isFree = item.fee_status === 'free';
    const isPaid = item.fee_status === 'paid';

    let kindBadgeClass = 'listing';
    let kindBadgeIcon = 'check-circle';
    let kindBadgeLabel = item.opportunity_type === 'course' ? t('opp.badgeCourse') : t('opp.badgeVerifiedVacancy');

    if (isDirectory) {
      kindBadgeClass = 'directory';
      kindBadgeIcon = 'globe';
      kindBadgeLabel = t('opp.badgeDirectory');
    } else if (isCuratedPilot) {
      kindBadgeClass = 'curated-pilot';
      kindBadgeIcon = 'alert-circle';
      kindBadgeLabel = t('opp.badgeCuratedPilot');
    } else if (isCurriculum) {
      kindBadgeClass = 'curriculum';
      kindBadgeIcon = 'book-open';
      kindBadgeLabel = t('opp.badgeCurriculum');
    } else if (isClosed) {
      kindBadgeClass = 'closed';
      kindBadgeIcon = 'clock';
      kindBadgeLabel = t('opp.badgeClosed');
    } else if (isScheme) {
      kindBadgeClass = 'scheme';
      kindBadgeIcon = 'shield';
      kindBadgeLabel = t('opp.badgeScheme');
    }

    return (
      <div key={item.id} className={`opportunity-card ${isDirectory ? 'directory-card' : 'listing-card'}`}>
        {/* Card Header Strip */}
        <div className="opportunity-card-header">
          <div className="opportunity-badge-row">
            <span className={`opp-kind-badge ${kindBadgeClass}`}>
              <Icon name={kindBadgeIcon} size={12} />
              <span>{kindBadgeLabel}</span>
            </span>

            <span className={`opp-type-badge ${item.opportunity_type}`}>
              <span>{item.opportunity_type.toUpperCase()}</span>
            </span>

            {/* Fee badge */}
            {isFree && (
              <span className="opp-fee-badge free">
                <span>{t('opp.free')}</span>
              </span>
            )}
            {isPaid && item.fee_amount !== null && (
              <span className="opp-fee-badge paid">
                <span>₹{Number(item.fee_amount).toLocaleString()}</span>
              </span>
            )}
            {!isFree && !isPaid && item.opportunity_type === 'course' && (
              <span className="opp-fee-badge unknown">
                <span>Fee Unspecified</span>
              </span>
            )}
            {item.verification_status === 'unconfirmed' && (
              <span className="opp-fee-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <span>Unconfirmed</span>
              </span>
            )}
            {isCuratedPilot && (
              <span className="opp-fee-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <span>Pilot Benchmark</span>
              </span>
            )}
          </div>

          {matchMeta && matchMeta.match_score > 0 && (
            <div className="opp-match-pill">
              <Icon name="sparkles" size={12} />
              <span>{matchMeta.match_score}% Match</span>
            </div>
          )}
        </div>

        {/* Card Title & Provider / Employer */}
        <h3 className="opportunity-title">{item.title}</h3>
        <div className="opportunity-provider">
          <Icon name={item.employer_name ? "briefcase" : "shield"} size={13} />
          <span>{item.employer_name || item.provider_name}</span>
          {item.employer_name && item.provider_name && item.employer_name !== item.provider_name && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>via {item.provider_name}</span>
          )}
        </div>

        {/* Description */}
        <p className="opportunity-description">{item.description}</p>

        {/* Personalization Rationale Pills */}
        {matchMeta && matchMeta.reasons && matchMeta.reasons.length > 0 && (
          <div className="opp-reasons-strip">
            {matchMeta.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className={`opp-reason-tag ${r.code}`}>
                <Icon name="check" size={11} />
                <span>{r.message}</span>
              </span>
            ))}
          </div>
        )}

        {/* Missing Skills in Recommendations */}
        {matchMeta?.missing_required_skills?.length > 0 && (
          <div className="opp-missing-skills-strip">
            <span className="opp-missing-skills-label">
              <Icon name="alert-triangle" size={11} />
              <span>{t('opp.missingReqSkills')}</span>
            </span>
            <div className="opp-missing-pills">
              {matchMeta.missing_required_skills.map((sk, idx) => (
                <span key={idx} className="opp-missing-pill">{sk.replace('_', ' ').toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}

        {matchMeta?.missing_preferred_skills?.length > 0 && (
          <div className="opp-missing-skills-strip">
            <span className="opp-missing-pref-label">
              <Icon name="info" size={11} />
              <span>{t('opp.missingPrefSkills')}</span>
            </span>
            <div className="opp-missing-pills">
              {matchMeta.missing_preferred_skills.map((sk, idx) => (
                <span key={idx} className="opp-missing-pill pref">{sk.replace('_', ' ').toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}

        {/* Key Attributes Grid */}
        <div className="opportunity-meta-grid">
          {item.salary_min !== null && item.salary_min !== undefined ? (
            <div className="opp-meta-item">
              <span className="opp-meta-label">{t('opp.salary')}</span>
              <span className="opp-meta-value highlight">
                ₹{Number(item.salary_min).toLocaleString()}
                {item.salary_max && item.salary_max !== item.salary_min ? ` - ₹${Number(item.salary_max).toLocaleString()}` : ''}
                {item.salary_period ? ` / ${item.salary_period}` : ''}
              </span>
            </div>
          ) : (item.stipend_min !== null && item.stipend_min !== undefined) ? (
            <div className="opp-meta-item">
              <span className="opp-meta-label">{t('opp.stipend')}</span>
              <span className="opp-meta-value highlight">
                ₹{Number(item.stipend_min).toLocaleString()}
                {item.stipend_max && item.stipend_max !== item.stipend_min ? ` - ₹${Number(item.stipend_max).toLocaleString()}` : ''}
                {item.stipend_period ? ` / ${item.stipend_period}` : ''}
              </span>
            </div>
          ) : (
            <div className="opp-meta-item">
              <span className="opp-meta-label">Pay / Fee</span>
              <span className="opp-meta-value">{isFree ? t('opp.free') : (isPaid && item.fee_amount ? `₹${Number(item.fee_amount).toLocaleString()}` : t('opp.notDisclosed'))}</span>
            </div>
          )}

          <div className="opp-meta-item">
            <span className="opp-meta-label">Arrangement</span>
            <span className="opp-meta-value">{(item.work_arrangement || item.work_mode).replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="opp-meta-item">
            <span className="opp-meta-label">Location</span>
            <span className="opp-meta-value">{item.location_city ? `${item.location_city}, ${item.location_state || ''}` : (item.location_state || 'All-India')}</span>
          </div>

          <div className="opp-meta-item">
            <span className="opp-meta-label">{t('opp.verifiedOn')}</span>
            <span className="opp-meta-value">{item.verified_at}</span>
          </div>

          {item.application_deadline && (
            <div className="opp-meta-item" style={{ gridColumn: 'span 2' }}>
              <span className="opp-meta-label">Deadline</span>
              <span className="opp-meta-value" style={{ color: item.is_deadline_passed ? '#ef4444' : 'inherit' }}>
                {item.application_deadline} {item.is_deadline_passed ? `(${t('opp.deadlinePassed')})` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Published Eligibility Criteria if present */}
        {item.eligibility && Object.keys(item.eligibility).length > 0 && (
          <div className="opportunity-eligibility-box">
            <div className="opp-eligibility-header">
              <Icon name="user" size={11} />
              <span>{t('opp.eligibilityLabel')}</span>
            </div>
            <div className="opp-eligibility-text">
              {item.eligibility.qualification && <div><strong>Education:</strong> {item.eligibility.qualification}</div>}
              {item.eligibility.age_min && (
                <div><strong>Age Limit:</strong> {item.eligibility.age_min} to {item.eligibility.age_max || 'NA'} years</div>
              )}
              {item.eligibility.prerequisites && <div><strong>Prerequisites:</strong> {item.eligibility.prerequisites}</div>}
              {item.eligibility.notes && <div>{item.eligibility.notes}</div>}
              {item.eligibility.exclusions && (
                <div style={{ color: 'var(--status-danger-text)', marginTop: '0.2rem' }}>
                  <strong>Exclusions:</strong> {item.eligibility.exclusions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact info if officially published */}
        {(item.published_contact_email || item.published_contact_phone) && (
          <div className="opportunity-contact-line">
            <span>Official Helpdesk:</span>
            {item.published_contact_email && <span>{item.published_contact_email}</span>}
            {item.published_contact_phone && <span>{item.published_contact_phone}</span>}
          </div>
        )}

        {/* Card Action Footer */}
        <div className="opportunity-card-footer">
          <span className={`opp-status-pill ${item.is_deadline_passed ? 'closed' : item.listing_status}`}>
            {item.is_deadline_passed ? 'closed' : item.listing_status.replace('_', ' ')}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {!isDirectory && (
              <button
                type="button"
                className="opp-details-btn"
                onClick={() => setSelectedVacancy(item)}
                title={t('opp.viewDetails')}
              >
                <Icon name="info" size={12} />
                <span>{isHindi ? 'विवरण' : 'Details'}</span>
              </button>
            )}

            {isAuthenticated && item.id && (
              <button
                type="button"
                className={`opp-track-btn ${trackedOppIds.has(item.id) ? 'tracked' : ''}`}
                onClick={() => handleTrackOpportunity(item)}
                disabled={trackedOppIds.has(item.id) || trackingId === item.id}
                title={trackedOppIds.has(item.id) ? 'Already tracked' : 'Save to Application Tracker'}
              >
                <Icon name={trackedOppIds.has(item.id) ? 'check' : 'clipboard-list'} size={11} />
                <span>{trackedOppIds.has(item.id) ? t('opp.trackedBtn') : (trackingId === item.id ? t('opp.savingTrack') : t('opp.trackBtn'))}</span>
              </button>
            )}

            <a
              href={item.vacancy_url || item.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`opp-cta-button ${isDirectory ? 'directory' : 'listing'}`}
            >
              <span>{isDirectory ? t('opp.openPortal') : t('opp.applyOfficial')}</span>
              <Icon name="arrow-up-right" size={13} />
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="opportunity-explorer-container">
      {/* Top Header */}
      <div className="workspace-header-row">
        <div>
          <div className="workspace-title-row">
            <h1 className="workspace-title">{t('opp.title')}</h1>
            <span className="workspace-role-badge">
              <Icon name="shield" size={13} />
              <span>Official Government & Partner Portals</span>
            </span>
          </div>
          <p className="workspace-subtitle">{t('opp.subtitle')}</p>
        </div>

        {/* Auth status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isAuthenticated ? (
            <span className="candidate-auth-tag verified">
              <Icon name="check-circle" size={12} />
              <span>{isHindi ? 'प्रमाणीकृत प्रोफ़ाइल सक्रिय' : 'Candidate Profile Active'}</span>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate && onNavigate('login')}
            >
              <Icon name="lock" size={13} />
              <span>{t('opp.signInBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="career-tab-bar" style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
        {isAuthenticated && (
          <button
            type="button"
            className={`career-tab-btn ${activeView === 'personalized' ? 'active' : ''}`}
            onClick={() => setActiveView('personalized')}
          >
            <Icon name="sparkles" size={15} />
            <span>{t('opp.tabPersonalized')}</span>
            {recommendationsData?.user_gaps_addressed_count > 0 && (
              <span className="career-tab-badge">
                {recommendationsData.user_gaps_addressed_count} Gaps
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          className={`career-tab-btn ${activeView === 'catalogue' ? 'active' : ''}`}
          onClick={() => setActiveView('catalogue')}
        >
          <Icon name="compass" size={15} />
          <span>{t('opp.tabCatalogue')}</span>
          <span className="career-tab-badge">{totalCount}</span>
        </button>
      </div>

      {/* Tracker Feedback Banner */}
      {trackerFeedback && (
        <div className="auth-alert success" style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{trackerFeedback}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div style={{ marginBottom: '1.25rem' }}>
          <ErrorAlert message={errorMessage} onRetry={loadCatalogue} />
        </div>
      )}

      {/* VIEW 1: PERSONALIZED RECOMMENDATIONS */}
      {activeView === 'personalized' && isAuthenticated && (
        <div className="opportunity-personalized-view">
          {isLoadingRecs ? (
            <LoadingSpinner message={isHindi ? 'कौशल अंतर के आधार पर अनुशंसाओं की गणना की जा रही है...' : 'Calculating personalized skill-gap course recommendations...'} />
          ) : (
            <>
              {/* Profile Context Banner */}
              <div className="opportunity-context-banner">
                <div className="context-banner-left">
                  <div className="context-banner-role-title">
                    <Icon name="target" size={16} />
                    <span>
                      {t('opp.targetRole')} <strong>{recommendationsData?.user_target_role_title || 'General Technology Track'}</strong>
                    </span>
                  </div>
                  <div className="context-banner-meta">
                    <span>
                      {t('opp.addressedGaps')} <strong>{recommendationsData?.user_gaps_addressed_count || 0} gaps targeted</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigate && onNavigate('career')}
                >
                  <Icon name="user" size={13} />
                  <span>{isHindi ? 'कौशल प्रोफ़ाइल संपादित करें' : 'Edit Skill Evidence'}</span>
                </button>
              </div>

              {/* Section 1: Skill-Gap Targeted Courses */}
              <div className="opportunity-section">
                <div className="opportunity-section-header">
                  <div>
                    <h2 className="opportunity-section-title">
                      <Icon name="award" size={17} />
                      <span>{t('opp.recCoursesTitle')}</span>
                    </h2>
                    <p className="opportunity-section-subtitle">
                      {t('opp.recCoursesDesc')}
                    </p>
                  </div>
                </div>

                {recommendationsData?.recommended_courses?.length > 0 ? (
                  <div className="opportunity-cards-grid">
                    {recommendationsData.recommended_courses.map((rec) =>
                      renderOpportunityCard(rec.opportunity, rec)
                    )}
                  </div>
                ) : (
                  <div className="workspace-empty-state">
                    <div className="workspace-empty-icon"><Icon name="check-circle" size={32} /></div>
                    <h3>{isHindi ? 'कोई अधूरा कौशल अंतर नहीं मिला' : 'No Missing Skill Gaps Identified'}</h3>
                    <p>{isHindi ? 'आपकी वर्तमान लक्षित भूमिका के सभी आवश्यक कौशल प्रमाणित हैं या कैटलॉग में कोई नया पाठ्यक्रम लंबित नहीं है।' : 'All required competencies for your current benchmark role are evidenced.'}</p>
                  </div>
                )}
              </div>

              {/* Section 2: Flagship Schemes & Opportunities */}
              <div className="opportunity-section" style={{ marginTop: '2rem' }}>
                <div className="opportunity-section-header">
                  <div>
                    <h2 className="opportunity-section-title">
                      <Icon name="shield" size={17} />
                      <span>{t('opp.recOppsTitle')}</span>
                    </h2>
                    <p className="opportunity-section-subtitle">
                      {t('opp.recOppsDesc')}
                    </p>
                  </div>
                </div>

                {recommendationsData?.recommended_opportunities?.length > 0 ? (
                  <div className="opportunity-cards-grid">
                    {recommendationsData.recommended_opportunities.map((rec) =>
                      renderOpportunityCard(rec.opportunity, rec)
                    )}
                  </div>
                ) : (
                  <div className="workspace-empty-state">
                    <div className="workspace-empty-icon"><Icon name="briefcase" size={32} /></div>
                    <h3>{isHindi ? 'कोई सीधा अवसर मिलान नहीं' : 'No Specific Listing Match'}</h3>
                    <p>{isHindi ? 'नीचे दिए गए आधिकारिक राष्ट्रीय पोर्टलों पर व्यापक रिक्तियां खोजें।' : 'Explore official search directories below to discover live enterprise openings.'}</p>
                  </div>
                )}
              </div>

              {/* Section 3: Official Search Portals */}
              <div className="opportunity-section" style={{ marginTop: '2rem' }}>
                <div className="opportunity-section-header">
                  <div>
                    <h2 className="opportunity-section-title">
                      <Icon name="globe" size={17} />
                      <span>{t('opp.portalsTitle')}</span>
                    </h2>
                    <p className="opportunity-section-subtitle">
                      {t('opp.portalsDesc')}
                    </p>
                  </div>
                </div>

                <div className="opportunity-cards-grid">
                  {recommendationsData?.portal_directories?.map((dir) =>
                    renderOpportunityCard(dir)
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: FULL CATALOGUE & OFFICIAL DIRECTORIES */}
      {(activeView === 'catalogue' || !isAuthenticated) && (
        <div className="opportunity-catalogue-view">
          {/* Unauthenticated Explanatory Notice */}
          {!isAuthenticated && (
            <div className="opportunity-auth-prompt-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="auth-prompt-icon">
                  <Icon name="sparkles" size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.2rem', color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    {isHindi ? 'वैयक्तिकृत कौशल अंतर अनुशंसाएं अनलॉक करें' : 'Unlock Personalized Skill-Gap Course Matching'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('opp.authPrompt')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate && onNavigate('login')}
              >
                <span>{t('opp.signInBtn')}</span>
                <Icon name="arrow-right" size={13} />
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="opportunity-filter-toolbar">
            {/* Search Input */}
            <div className="opp-search-box">
              <Icon name="search" size={15} />
              <input
                type="text"
                className="opp-search-input"
                placeholder={t('opp.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>

            {/* Type Filter Pills */}
            <div className="opp-type-pills">
              {opportunityTypes.map((typ) => (
                <button
                  key={typ.id}
                  type="button"
                  className={`opp-filter-pill ${selectedType === typ.id ? 'active' : ''}`}
                  onClick={() => setSelectedType(typ.id)}
                >
                  {typ.icon && <Icon name={typ.icon} size={12} />}
                  <span>{t(typ.labelKey, typ.defaultLabel)}</span>
                </button>
              ))}
            </div>

            {/* Secondary Select Dropdowns */}
            <div className="opp-secondary-filters">
              {/* Cost / Fee Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">{t('opp.fee')}</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedFee}
                  onChange={(e) => setSelectedFee(e.target.value)}
                >
                  <option value="all">{t('opp.filterFeeAll')}</option>
                  <option value="free">{t('opp.feeFree')}</option>
                  <option value="paid">{t('opp.feePaid')}</option>
                </select>
              </div>

              {/* Work Arrangement Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">{t('opp.filterArrangement')}</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedWorkArrangement}
                  onChange={(e) => setSelectedWorkArrangement(e.target.value)}
                >
                  <option value="all">{t('opp.filterArrangementAll')}</option>
                  <option value="onsite">{t('opp.arrOnsite')}</option>
                  <option value="hybrid">{t('opp.arrHybrid')}</option>
                  <option value="remote">{t('opp.arrRemote')}</option>
                </select>
              </div>

              {/* Industry Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">{t('opp.filterIndustry')}</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                >
                  <option value="all">{t('opp.filterIndustryAll')}</option>
                  <option value="IT/ITeS">IT / ITeS</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Aerospace & Defence">Aerospace & Defence</option>
                </select>
              </div>

              {/* Location Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">{t('opp.filterLocation')}</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="all">{t('opp.filterLocationAll')}</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Pune">Pune</option>
                  <option value="Dharwad">Dharwad</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Mumbai">Mumbai</option>
                </select>
              </div>

              {/* Work Mode Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">Mode:</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                >
                  <option value="all">{t('opp.filterModeAll')}</option>
                  <option value="online">{t('opp.modeOnline')}</option>
                  <option value="in_person">{t('opp.modeInPerson')}</option>
                  <option value="all_india">{t('opp.modeAllIndia')}</option>
                </select>
              </div>

              {/* Record Kind Filter */}
              <div className="opp-filter-group">
                <label className="opp-filter-label">Listing Kind:</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedKind}
                  onChange={(e) => setSelectedKind(e.target.value)}
                >
                  <option value="all">{t('opp.filterKindAll')}</option>
                  <option value="individual_listing">{t('opp.kindListing')}</option>
                  <option value="portal_directory">{t('opp.kindDirectory')}</option>
                </select>
              </div>

              {(searchQuery || selectedType !== 'all' || selectedFee !== 'all' || selectedMode !== 'all' || selectedKind !== 'all' || selectedWorkArrangement !== 'all' || selectedIndustry !== 'all' || selectedLocation !== 'all') && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetFilters}
                  style={{ height: '32px' }}
                >
                  <Icon name="rotate-ccw" size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid or Loading */}
          {isLoadingCatalogue ? (
            <LoadingSpinner message={isHindi ? 'सत्यापित अवसर कैटलॉग लोड हो रहा है...' : 'Querying verified opportunity registry...'} />
          ) : catalogueItems.length > 0 ? (
            <div className="opportunity-cards-grid">
              {catalogueItems.map((item) => renderOpportunityCard(item))}
            </div>
          ) : (
            <div className="workspace-empty-state" style={{ padding: '3.5rem 1rem' }}>
              <div className="workspace-empty-icon"><Icon name="search" size={32} /></div>
              <h3>{t('opp.noResults')}</h3>
              <p>{isHindi ? 'अधिक परिणाम देखने के लिए खोज कीवर्ड या फ़िल्टर समायोजित करें।' : 'Try clearing filters or searching for another keyword.'}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                style={{ marginTop: '0.75rem' }}
              >
                <span>Reset All Filters</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transparent Methodology & Integrity Footer */}
      <div className="opportunity-integrity-box">
        <Icon name="shield" size={16} />
        <div>
          <strong>{isHindi ? 'सत्यापन नीति एवं प्रकटीकरण:' : 'Verification Standard & Data Integrity Policy:'}</strong>{' '}
          {t('opp.disclaimer')}
        </div>
      </div>

      {/* Vacancy Detail Modal / Dialog */}
      {selectedVacancy && (
        <div className="vacancy-modal-backdrop" onClick={() => setSelectedVacancy(null)}>
          <div className="vacancy-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="vacancy-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span className={`opp-kind-badge ${selectedVacancy.record_kind === 'curated_pilot_listing' ? 'curated-pilot' : (selectedVacancy.record_kind === 'closed_listing' ? 'closed' : (selectedVacancy.record_kind === 'curriculum_standard' ? 'curriculum' : (selectedVacancy.record_kind === 'scheme_reference' ? 'scheme' : 'listing')))}`}>
                    <Icon name={selectedVacancy.record_kind === 'curated_pilot_listing' ? 'alert-circle' : (selectedVacancy.record_kind === 'closed_listing' ? 'clock' : 'check-circle')} size={12} />
                    <span>
                      {selectedVacancy.record_kind === 'curated_pilot_listing'
                        ? t('opp.badgeCuratedPilot')
                        : (selectedVacancy.record_kind === 'closed_listing'
                            ? t('opp.badgeClosed')
                            : (selectedVacancy.record_kind === 'curriculum_standard' ? t('opp.badgeCurriculum') : (selectedVacancy.record_kind === 'scheme_reference' ? t('opp.badgeScheme') : t('opp.badgeVerifiedVacancy'))))}
                    </span>
                  </span>
                  <span className={`opp-type-badge ${selectedVacancy.opportunity_type}`}>
                    {selectedVacancy.opportunity_type.toUpperCase()}
                  </span>
                  {selectedVacancy.work_arrangement && (
                    <span className="opp-type-badge" style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}>
                      {selectedVacancy.work_arrangement.toUpperCase()}
                    </span>
                  )}
                  <span className={`opp-status-pill ${selectedVacancy.listing_status}`}>
                    {selectedVacancy.listing_status.toUpperCase()}
                  </span>
                </div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  {selectedVacancy.title}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <Icon name="briefcase" size={14} />
                  <strong>{selectedVacancy.employer_name || selectedVacancy.provider_name}</strong>
                  {selectedVacancy.industry && <span>• {selectedVacancy.industry}</span>}
                </div>
              </div>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => setSelectedVacancy(null)}
                style={{ width: '28px', height: '28px' }}
                title="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="vacancy-modal-body">
              {/* Pilot Disclosure Alert if curated/unverified */}
              {selectedVacancy.record_kind === 'curated_pilot_listing' && (
                <div style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  gap: '0.65rem',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <Icon name="alert-triangle" size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: '#b45309', display: 'block', marginBottom: '0.2rem' }}>
                      {t('opp.badgeCuratedPilot')}
                    </strong>
                    {t('opp.curatedPilotNotice')}
                  </div>
                </div>
              )}

              {/* Job / Position Overview */}
              <div className="vacancy-section">
                <span className="vacancy-section-title">
                  <Icon name="file-text" size={13} />
                  <span>Position & Role Overview</span>
                </span>
                <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  {selectedVacancy.description}
                </p>
                {selectedVacancy.official_company_website && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
                    <a
                      href={selectedVacancy.official_company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Icon name="globe" size={12} />
                      <span>{t('opp.companyWebsite')}</span>
                      <Icon name="arrow-up-right" size={11} />
                    </a>
                  </div>
                )}
              </div>

              {/* Work Conditions & Location */}
              <div className="vacancy-section">
                <span className="vacancy-section-title">
                  <Icon name="map-pin" size={13} />
                  <span>{t('opp.workConditions')}</span>
                </span>
                <div className="vacancy-grid-2">
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Location</span>
                    <span className="vacancy-field-value">
                      {selectedVacancy.location_city ? `${selectedVacancy.location_city}, ${selectedVacancy.location_state || ''}` : (selectedVacancy.location_state || 'All-India')}
                    </span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Work Arrangement</span>
                    <span className="vacancy-field-value">
                      {selectedVacancy.work_arrangement ? selectedVacancy.work_arrangement.toUpperCase() : 'Onsite'}
                    </span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Workplace Address</span>
                    <span className="vacancy-field-value">{selectedVacancy.workplace_address || t('opp.notDisclosed')}</span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Working Hours & Schedule</span>
                    <span className="vacancy-field-value">
                      {selectedVacancy.working_hours ? `${selectedVacancy.working_hours} (${selectedVacancy.weekly_working_days || '5 days/week'})` : t('opp.notDisclosed')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compensation & Eligibility */}
              <div className="vacancy-section">
                <span className="vacancy-section-title">
                  <Icon name="award" size={13} />
                  <span>{t('opp.compensation')} & {t('opp.qualifications')}</span>
                </span>
                <div className="vacancy-grid-2">
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">{t('opp.salary')}</span>
                    <span className="vacancy-field-value" style={{ color: '#10b981' }}>
                      {selectedVacancy.salary_min !== null
                        ? `₹${Number(selectedVacancy.salary_min).toLocaleString()} - ₹${Number(selectedVacancy.salary_max).toLocaleString()} / ${selectedVacancy.salary_period || 'month'}`
                        : (selectedVacancy.stipend_min !== null
                            ? `Stipend: ₹${Number(selectedVacancy.stipend_min).toLocaleString()} / ${selectedVacancy.stipend_period || 'month'}`
                            : t('opp.notDisclosed'))
                      }
                    </span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">{t('opp.experienceReq')}</span>
                    <span className="vacancy-field-value">
                      {selectedVacancy.experience_years_min !== null
                        ? `${selectedVacancy.experience_years_min} to ${selectedVacancy.experience_years_max ?? selectedVacancy.experience_years_min} years`
                        : 'Entry level / Fresher (0-1 yrs)'}
                    </span>
                  </div>
                  <div className="vacancy-field" style={{ gridColumn: 'span 2' }}>
                    <span className="vacancy-field-label">Education Criteria</span>
                    <span className="vacancy-field-value">
                      {selectedVacancy.education_requirements || (selectedVacancy.eligibility?.qualification || t('opp.notDisclosed'))}
                    </span>
                  </div>
                </div>

                {/* Skills tags */}
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {selectedVacancy.skill_keys?.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('opp.requiredSkills')}:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                        {selectedVacancy.skill_keys.map((sk, idx) => (
                          <span key={idx} className="opp-reason-tag">
                            <Icon name="check" size={11} />
                            <span>{sk.replace('_', ' ').toUpperCase()}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedVacancy.preferred_skills?.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('opp.preferredSkills')}:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                        {selectedVacancy.preferred_skills.map((sk, idx) => (
                          <span key={idx} className="opp-reason-tag" style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', borderColor: 'rgba(148, 163, 184, 0.25)' }}>
                            <Icon name="plus" size={11} />
                            <span>{sk.replace('_', ' ').toUpperCase()}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Application Process & Instructions */}
              <div className="vacancy-section">
                <span className="vacancy-section-title">
                  <Icon name="clipboard-list" size={13} />
                  <span>{t('opp.appInstructions')}</span>
                </span>
                <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  {selectedVacancy.application_instructions || 'Review eligibility and apply directly on the official employer vacancy portal.'}
                </p>

                {/* Selection stages */}
                {selectedVacancy.selection_stages?.length > 0 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                      {t('opp.selectionStages')}:
                    </span>
                    <div className="vacancy-stages-flow">
                      {selectedVacancy.selection_stages.map((stg, idx) => (
                        <React.Fragment key={idx}>
                          <span className="vacancy-stage-badge">
                            <span>{idx + 1}. {stg}</span>
                          </span>
                          {idx < selectedVacancy.selection_stages.length - 1 && (
                            <Icon name="arrow-right" size={12} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required Documents */}
                {selectedVacancy.required_documents?.length > 0 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                      {t('opp.reqDocuments')}:
                    </span>
                    <div className="vacancy-docs-list">
                      {selectedVacancy.required_documents.map((doc, idx) => (
                        <div key={idx} className="vacancy-doc-item">
                          <Icon name="check-circle" size={12} style={{ color: '#10b981' }} />
                          <span>{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recruitment Contacts & Anti-Fraud Disclaimer */}
              <div className="vacancy-section">
                <span className="vacancy-section-title">
                  <Icon name="shield" size={13} />
                  <span>{t('opp.recruiterContact')} & Provenance</span>
                </span>
                <div className="vacancy-grid-2">
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">{t('opp.recruiterEmail')}</span>
                    <span className="vacancy-field-value">{selectedVacancy.recruitment_contact_email || t('opp.notDisclosed')}</span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">{t('opp.recruiterPhone')}</span>
                    <span className="vacancy-field-value">{selectedVacancy.recruitment_contact_phone || t('opp.notDisclosed')}</span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Verified At</span>
                    <span className="vacancy-field-value">{selectedVacancy.verified_at}</span>
                  </div>
                  <div className="vacancy-field">
                    <span className="vacancy-field-label">Application Deadline</span>
                    <span className="vacancy-field-value" style={{ color: selectedVacancy.is_deadline_passed ? '#ef4444' : 'inherit' }}>
                      {selectedVacancy.application_deadline ? `${selectedVacancy.application_deadline}${selectedVacancy.is_deadline_passed ? ' (Closed)' : ''}` : 'Open'}
                    </span>
                  </div>
                </div>

                {/* 4-Point Grounding Audit */}
                <div style={{ marginTop: '0.75rem', padding: '0.65rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
                    {t('opp.verificationMetaTitle')}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem', fontSize: '0.76rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Icon name={selectedVacancy.source_portal_reachable ? 'check-circle' : 'x-circle'} size={13} style={{ color: selectedVacancy.source_portal_reachable ? '#10b981' : '#ef4444' }} />
                      <span>{t('opp.metaPortalReachable')}: <strong>{selectedVacancy.source_portal_reachable ? 'Yes' : 'No'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Icon name={selectedVacancy.exact_listing_retrieved ? 'check-circle' : 'alert-circle'} size={13} style={{ color: selectedVacancy.exact_listing_retrieved ? '#10b981' : '#f59e0b' }} />
                      <span>{t('opp.metaExactListing')}: <strong>{selectedVacancy.exact_listing_retrieved ? 'Yes' : 'No'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Icon name={selectedVacancy.vacancy_status_checked ? 'check-circle' : 'alert-circle'} size={13} style={{ color: selectedVacancy.vacancy_status_checked ? '#10b981' : '#f59e0b' }} />
                      <span>{t('opp.metaStatusChecked')}: <strong>{selectedVacancy.vacancy_status_checked ? 'Yes' : 'No'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Icon name={selectedVacancy.individual_fields_verified ? 'check-circle' : 'alert-circle'} size={13} style={{ color: selectedVacancy.individual_fields_verified ? '#10b981' : '#f59e0b' }} />
                      <span>{t('opp.metaFieldsVerified')}: <strong>{selectedVacancy.individual_fields_verified ? 'Yes' : 'No'}</strong></span>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem', marginTop: '0.4rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <Icon name="alert-triangle" size={13} style={{ color: '#ef4444', marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
                  {t('opp.fraudWarning')}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="vacancy-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedVacancy(null)}
              >
                <span>Close</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isAuthenticated && (
                  <button
                    type="button"
                    className={`btn btn-secondary btn-sm ${trackedOppIds.has(selectedVacancy.id) ? 'tracked' : ''}`}
                    onClick={() => handleTrackOpportunity(selectedVacancy)}
                    disabled={trackedOppIds.has(selectedVacancy.id) || trackingId === selectedVacancy.id}
                  >
                    <Icon name={trackedOppIds.has(selectedVacancy.id) ? 'check' : 'clipboard-list'} size={13} />
                    <span>{trackedOppIds.has(selectedVacancy.id) ? t('opp.trackedBtn') : (trackingId === selectedVacancy.id ? t('opp.savingTrack') : t('opp.trackBtn'))}</span>
                  </button>
                )}

                <a
                  href={selectedVacancy.vacancy_url || selectedVacancy.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <span>{t('opp.applyOfficial')}</span>
                  <Icon name="arrow-up-right" size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
