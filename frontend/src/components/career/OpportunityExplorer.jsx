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
  }, [selectedType, selectedFee, selectedMode, selectedKind, searchQuery]);

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
    const isFree = item.fee_status === 'free';
    const isPaid = item.fee_status === 'paid';

    return (
      <div key={item.id} className={`opportunity-card ${isDirectory ? 'directory-card' : 'listing-card'}`}>
        {/* Card Header Strip */}
        <div className="opportunity-card-header">
          <div className="opportunity-badge-row">
            <span className={`opp-kind-badge ${isDirectory ? 'directory' : 'listing'}`}>
              <Icon name={isDirectory ? 'globe' : 'check-circle'} size={12} />
              <span>{isDirectory ? t('opp.badgeDirectory') : t('opp.badgeListing')}</span>
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
            {!isFree && !isPaid && (
              <span className="opp-fee-badge unknown">
                <span>Fee Unspecified</span>
              </span>
            )}
            {item.verification_status === 'unconfirmed' && (
              <span className="opp-fee-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <span>Unconfirmed</span>
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

        {/* Card Title & Provider */}
        <h3 className="opportunity-title">{item.title}</h3>
        <div className="opportunity-provider">
          <Icon name="shield" size={13} />
          <span>{item.provider_name}</span>
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

        {/* Key Attributes Grid */}
        <div className="opportunity-meta-grid">
          {item.stipend_min !== null && item.stipend_min !== undefined && (
            <div className="opp-meta-item">
              <span className="opp-meta-label">{t('opp.stipend')}</span>
              <span className="opp-meta-value highlight">
                ₹{Number(item.stipend_min).toLocaleString()}
                {item.stipend_max && item.stipend_max !== item.stipend_min ? ` - ₹${Number(item.stipend_max).toLocaleString()}` : ''}
                {item.stipend_period ? ` / ${item.stipend_period}` : ''}
              </span>
            </div>
          )}

          <div className="opp-meta-item">
            <span className="opp-meta-label">Work Mode</span>
            <span className="opp-meta-value">{item.work_mode.replace('_', ' ').toUpperCase()}</span>
          </div>

          {item.location_state && (
            <div className="opp-meta-item">
              <span className="opp-meta-label">Location</span>
              <span className="opp-meta-value">{item.location_state}</span>
            </div>
          )}

          <div className="opp-meta-item">
            <span className="opp-meta-label">{t('opp.verifiedOn')}</span>
            <span className="opp-meta-value">{item.verified_at}</span>
          </div>
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
          <span className={`opp-status-pill ${item.listing_status}`}>
            {item.listing_status.replace('_', ' ')}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {isAuthenticated && item.id && (
              <button
                type="button"
                className={`opp-track-btn ${trackedOppIds.has(item.id) ? 'tracked' : ''}`}
                onClick={() => handleTrackOpportunity(item)}
                disabled={trackedOppIds.has(item.id) || trackingId === item.id}
                title={trackedOppIds.has(item.id) ? 'Already tracked' : 'Save to Application Tracker'}
              >
                <Icon name={trackedOppIds.has(item.id) ? 'check' : 'clipboard-list'} size={11} />
                <span>{trackedOppIds.has(item.id) ? 'Tracked' : (trackingId === item.id ? 'Saving...' : 'Track')}</span>
              </button>
            )}

            <a
              href={item.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`opp-cta-button ${isDirectory ? 'directory' : 'listing'}`}
            >
              <span>{isDirectory ? t('opp.openPortal') : t('opp.viewSource')}</span>
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
                <label className="opp-filter-label">Cost:</label>
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

              {(searchQuery || selectedType !== 'all' || selectedFee !== 'all' || selectedMode !== 'all' || selectedKind !== 'all') && (
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
    </div>
  );
}
