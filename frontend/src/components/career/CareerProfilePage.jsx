import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchCareerProfile,
  saveCareerProfile,
  uploadResumeFile,
  fetchLatestResume,
  reviewResumeParsedData,
  deleteResume,
  fetchMetadata,
} from '../../api/client';
import Icon from '../Icon';
import LoadingSpinner from '../LoadingSpinner';

const SECTORS = [
  'IT/ITeS',
  'Manufacturing',
  'Logistics',
  'Automotive & Mechatronics',
  'Aerospace & Defence',
  'Healthcare & Life Sciences',
  'Renewable Energy & Clean Tech',
  'Cross-Sector / Other',
];

const EDUCATION_LEVELS = [
  'B.Tech / B.E. (Bachelor of Technology / Engineering)',
  'Polytechnic / Vocational Diploma',
  'ITI (Industrial Training Institute)',
  'BCA (Bachelor of Computer Applications)',
  'MCA (Master of Computer Applications)',
  'M.Tech / M.E. (Master of Technology / Engineering)',
  'B.Sc / M.Sc (Science / Applied Sciences)',
  'B.Com / BBA / MBA (Commerce / Management)',
  'Higher Secondary (12th Grade / PUC)',
  'Secondary School (10th Grade / Matriculation)',
  'Other / Self-Taught',
];

export default function CareerProfilePage({ onNavigate }) {
  const { user, isAuthenticated, isDemo } = useAuth();
  const { t, isHindi } = useLanguage();

  // Reference metadata
  const [occupations, setOccupations] = useState([]);
  const [districts, setDistricts] = useState([]);

  // Profile form state
  const [targetRoleTitle, setTargetRoleTitle] = useState('');
  const [targetOccupationId, setTargetOccupationId] = useState('');
  const [targetSector, setTargetSector] = useState('');
  const [currentEducationLevel, setCurrentEducationLevel] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [yearsExperience, setYearsExperience] = useState(0);
  const [currentState, setCurrentState] = useState('');
  const [currentDistrict, setCurrentDistrict] = useState('');
  const [preferredLocations, setPreferredLocations] = useState([]);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [consentAiProcessing, setConsentAiProcessing] = useState(false);

  // Resume state
  const [resumeData, setResumeData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);

  // Review editable fields
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [reviewEducation, setReviewEducation] = useState('');
  const [reviewInstitution, setReviewInstitution] = useState('');
  const [reviewGradYear, setReviewGradYear] = useState('');
  const [reviewSkills, setReviewSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [reviewExpYears, setReviewExpYears] = useState('');
  const [reviewExpSummary, setReviewExpSummary] = useState('');

  // UI state
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [resumeFeedback, setResumeFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load metadata and user profile on mount
  const loadData = useCallback(async () => {
    setIsLoadingInitial(true);
    setErrorMessage(null);

    try {
      // 1. Reference metadata
      const metaRes = await fetchMetadata();
      setOccupations(metaRes?.occupations || []);
      setDistricts(metaRes?.geographies || []);

      if (isAuthenticated) {
        // 2. Career profile
        const profRes = await fetchCareerProfile();
        if (profRes?.has_profile && profRes.profile) {
          const p = profRes.profile;
          setTargetRoleTitle(p.target_role_title || '');
          setTargetOccupationId(p.target_occupation_id || '');
          setTargetSector(p.target_sector || '');
          setCurrentEducationLevel(p.current_education_level || '');
          setInstitutionName(p.institution_name || '');
          setGraduationYear(p.graduation_year ? String(p.graduation_year) : '');
          setYearsExperience(p.years_experience || 0);
          setCurrentState(p.current_state || '');
          setCurrentDistrict(p.current_district || '');
          setPreferredLocations(p.preferred_locations || []);
          setConsentAiProcessing(Boolean(p.consent_ai_processing));
        }

        // 3. Latest resume
        const resRes = await fetchLatestResume();
        if (resRes?.has_resume && resRes.resume) {
          syncResumeToReviewState(resRes.resume);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load career profile data.');
    } finally {
      setIsLoadingInitial(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const syncResumeToReviewState = (res) => {
    setResumeData(res);
    const parsed = res.parsed_data || {};
    setReviewName(parsed.candidate_name || '');
    setReviewEmail(parsed.email || '');
    setReviewPhone(parsed.phone || '');
    setReviewEducation(parsed.education_level || '');
    setReviewInstitution(parsed.institution || '');
    setReviewGradYear(parsed.graduation_year ? String(parsed.graduation_year) : '');
    setReviewSkills(parsed.detected_skills || []);
    setReviewExpYears(parsed.experience_years !== undefined && parsed.experience_years !== null ? String(parsed.experience_years) : '');
    setReviewExpSummary(parsed.experience_summary || '');
  };

  // Profile save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const hasAnyDetail =
      Boolean(targetRoleTitle.trim()) ||
      Boolean(targetSector) ||
      Boolean(targetOccupationId) ||
      Boolean(currentEducationLevel) ||
      Boolean(institutionName.trim()) ||
      Boolean(graduationYear) ||
      Boolean(parseFloat(yearsExperience) > 0) ||
      Boolean(currentState) ||
      Boolean(currentDistrict) ||
      preferredLocations.length > 0;

    if (!hasAnyDetail) {
      setErrorMessage(
        isHindi
          ? 'कृपया प्रोफ़ाइल सहेजने से पहले कम से कम एक विवरण (भूमिका, शिक्षा, अनुभव या स्थान) दर्ज करें।'
          : 'Please enter at least one detail (role, education, experience, or location) before saving.'
      );
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);
    setErrorMessage(null);

    try {
      const payload = {
        target_role_title: targetRoleTitle.trim() || null,
        target_occupation_id: targetOccupationId || null,
        target_sector: targetSector || null,
        current_education_level: currentEducationLevel || null,
        institution_name: institutionName.trim() || null,
        graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
        years_experience: parseFloat(yearsExperience) || 0.0,
        current_state: currentState || null,
        current_district: currentDistrict || null,
        preferred_locations: preferredLocations,
        consent_ai_processing: consentAiProcessing,
      };

      const res = await saveCareerProfile(payload);
      setProfileFeedback({
        type: 'success',
        text: isHindi ? 'करियर प्रोफ़ाइल सफलतापूर्वक सहेजी गई!' : 'Career profile saved successfully!',
      });
      setTimeout(() => setProfileFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save career profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Resume upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validations
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(isHindi ? 'केवल पीडीएफ फाइलें समर्थित हैं (.pdf)।' : 'Only PDF documents are supported (.pdf).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        isHindi
          ? 'फ़ाइल का आकार 5 एमबी की अधिकतम सीमा से अधिक है।'
          : 'File size exceeds the 5 MiB maximum limit.'
      );
      return;
    }

    setIsUploading(true);
    setResumeFeedback(null);
    setErrorMessage(null);

    try {
      const res = await uploadResumeFile(file);
      syncResumeToReviewState(res.resume);
      setResumeFeedback({
        type: 'success',
        text: isHindi
          ? 'रिज्यूमे अपलोड और निकाला गया! कृपया नीचे निकाले गए विवरणों की पुष्टि करें।'
          : 'Resume uploaded and parsed successfully! Please review the extracted details below.',
      });
      setTimeout(() => setResumeFeedback(null), 6000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and parse resume.');
    } finally {
      setIsUploading(false);
      // Reset input value so re-uploading same file works
      e.target.value = '';
    }
  };

  // Review save handler
  const handleSaveReview = async () => {
    if (!resumeData) return;
    setIsSavingReview(true);
    setResumeFeedback(null);
    setErrorMessage(null);

    try {
      const reviewedPayload = {
        candidate_name: reviewName.trim() || null,
        email: reviewEmail.trim() || null,
        phone: reviewPhone.trim() || null,
        education_level: reviewEducation.trim() || null,
        institution: reviewInstitution.trim() || null,
        graduation_year: reviewGradYear ? parseInt(reviewGradYear, 10) : null,
        detected_skills: reviewSkills,
        experience_years: reviewExpYears ? parseFloat(reviewExpYears) : null,
        experience_summary: reviewExpSummary.trim() || null,
      };

      const res = await reviewResumeParsedData(resumeData.id, reviewedPayload);
      syncResumeToReviewState(res.resume);
      setResumeFeedback({
        type: 'success',
        text: isHindi
          ? 'समीक्षा विवरण सफलतापूर्वक सहेजे और पुष्टि किए गए!'
          : 'Reviewed extraction saved and confirmed successfully!',
      });
      setTimeout(() => setResumeFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save reviewed resume details.');
    } finally {
      setIsSavingReview(false);
    }
  };

  // Apply parsed info to profile form
  const handleApplyToProfile = () => {
    if (!resumeData) return;
    if (reviewEducation && !currentEducationLevel) {
      // Find matching education level if possible
      const match = EDUCATION_LEVELS.find((l) => l.toLowerCase().includes(reviewEducation.toLowerCase()));
      setCurrentEducationLevel(match || reviewEducation);
    }
    if (reviewInstitution && !institutionName) {
      setInstitutionName(reviewInstitution);
    }
    if (reviewGradYear && !graduationYear) {
      setGraduationYear(reviewGradYear);
    }
    if (reviewExpYears && (!yearsExperience || yearsExperience === 0)) {
      setYearsExperience(parseFloat(reviewExpYears) || 0);
    }

    setProfileFeedback({
      type: 'success',
      text: isHindi
        ? 'निकाले गए विवरण प्रोफ़ाइल फ़ॉर्म में लागू किए गए। सहेजने के लिए "प्रोफ़ाइल सहेजें" पर क्लिक करें।'
        : 'Extracted details applied to profile form. Click "Save Profile" to persist.',
    });
    setTimeout(() => setProfileFeedback(null), 5000);
  };

  // Delete resume
  const handleDeleteResume = async () => {
    if (!resumeData) return;
    const confirmPrompt = isHindi
      ? `क्या आप वाकई "${resumeData.original_filename}" को हटाना चाहते हैं?`
      : `Are you sure you want to delete your resume "${resumeData.original_filename}"?`;
    if (!window.confirm(confirmPrompt)) return;

    setIsDeletingResume(true);
    setResumeFeedback(null);
    setErrorMessage(null);

    try {
      await deleteResume(resumeData.id);
      setResumeData(null);
      setReviewName('');
      setReviewEmail('');
      setReviewPhone('');
      setReviewEducation('');
      setReviewInstitution('');
      setReviewGradYear('');
      setReviewSkills([]);
      setReviewExpYears('');
      setReviewExpSummary('');
      setResumeFeedback({
        type: 'success',
        text: isHindi ? 'रिज्यूमे फ़ाइल सफलतापूर्वक हटा दी गई।' : 'Resume file deleted successfully.',
      });
      setTimeout(() => setResumeFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete resume.');
    } finally {
      setIsDeletingResume(false);
    }
  };

  // Add/remove preferred location chip
  const handleAddLocation = (loc) => {
    const clean = loc.trim();
    if (clean && !preferredLocations.includes(clean)) {
      setPreferredLocations([...preferredLocations, clean]);
      setNewLocationInput('');
    }
  };

  const handleRemoveLocation = (loc) => {
    setPreferredLocations(preferredLocations.filter((l) => l !== loc));
  };

  // Add/remove skill chip in review
  const handleAddSkill = () => {
    const clean = newSkillInput.trim();
    if (clean && !reviewSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setReviewSkills([...reviewSkills, clean]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setReviewSkills(reviewSkills.filter((s) => s !== skill));
  };

  if (isLoadingInitial) {
    return <LoadingSpinner message={isHindi ? 'करियर प्रोफ़ाइल डेटा लोड हो रहा है...' : 'Loading candidate career profile and resume records...'} />;
  }

  return (
    <div className="career-profile-container">
      {/* Page Header */}
      <div className="workspace-header-row">
        <div>
          <div className="workspace-title-row">
            <h1 className="workspace-title">
              {isHindi ? 'उम्मीदवार करियर प्रोफ़ाइल एवं रिज्यूमे कार्यक्षेत्र' : 'Candidate Career Profile & Resume Workspace'}
            </h1>
            <span className="workspace-role-badge">
              <Icon name="briefcase" size={13} />
              <span>{isAuthenticated ? (isHindi ? 'प्रमाणीकृत उम्मीदवार' : 'Authenticated Candidate') : 'Demo Visitor'}</span>
            </span>
          </div>
          <p className="workspace-subtitle">
            {isHindi
              ? 'अपनी करियर प्राथमिकताएं निर्धारित करें, टेक्स्ट-आधारित पीडीएफ रिज्यूमे अपलोड करें, और निकाले गए कौशल की समीक्षा करें'
              : 'Configure career goals, upload digital PDF resumes, and verify extracted skills for future pathway matching'}
          </p>
        </div>

        {isAuthenticated && (
          <button
            type="button"
            className="btn-refresh"
            onClick={loadData}
            title={isHindi ? 'रिफ्रेश करें' : 'Refresh profile and resume'}
          >
            <Icon name="refresh" size={14} />
            <span>{isHindi ? 'रिफ्रेश' : 'Refresh'}</span>
          </button>
        )}
      </div>

      {/* Guest / Demo Notice Banner */}
      {!isAuthenticated && (
        <div className="workspace-demo-notice-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="workspace-notice-icon">
              <Icon name="info" size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {isHindi ? 'डेमो मोड सक्रिय — केवल अवलोकन' : 'Demo Mode Active — Read-Only Exploration'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {isHindi
                  ? 'व्यक्तिगत करियर प्रोफ़ाइल सहेजने और निजी रिज्यूमे अपलोड करने के लिए एक निःशुल्क खाता आवश्यक है।'
                  : 'Creating a personalized career profile and uploading private PDF resumes requires an authenticated account.'}
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

      {/* Global Alerts */}
      {errorMessage && (
        <div className="auth-alert error" style={{ marginBottom: '1.25rem' }}>
          <Icon name="alert-triangle" size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {profileFeedback && (
        <div className={`auth-alert ${profileFeedback.type}`} style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{profileFeedback.text}</span>
        </div>
      )}

      {resumeFeedback && (
        <div className={`auth-alert ${resumeFeedback.type}`} style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{resumeFeedback.text}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="career-grid-layout">
        {/* LEFT COLUMN: Career Profile Form */}
        <div className="career-card profile-form-card">
          <div className="career-card-header">
            <div>
              <h2 className="career-card-title">
                <Icon name="user" size={16} />
                <span>{isHindi ? 'करियर लक्ष्य एवं प्राथमिकताएं' : 'Career Goals & Preferences'}</span>
              </h2>
              <p className="career-card-subtitle">
                {isHindi
                  ? 'अपनी लक्षित भूमिका, योग्यता, और पसंदीदा कार्य स्थान दर्ज करें'
                  : 'Define your desired job role, qualification background, and location targets'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="career-form">
            {/* Target Role Title */}
            <div className="form-group">
              <label htmlFor="target-role-title" className="form-label">
                {isHindi ? 'लक्षित करियर भूमिका (वैकल्पिक)' : 'Target Career Role (Optional)'}
              </label>
              <input
                id="target-role-title"
                type="text"
                className="form-input"
                placeholder={isHindi ? 'उदा. Embedded Software Engineer, Python Developer' : 'e.g. Embedded Software Engineer, Python Developer'}
                value={targetRoleTitle}
                onChange={(e) => setTargetRoleTitle(e.target.value)}
                disabled={!isAuthenticated || isSavingProfile}
              />
              <span className="field-hint">
                {isHindi
                  ? 'वैकल्पिक। आप पहले शिक्षा और स्थान सहेज सकते हैं, या एक विशिष्ट लक्ष्य भूमिका दर्ज कर सकते हैं।'
                  : 'Optional for partial profiles. You can save your education and location first, and define target role anytime.'}
              </span>
            </div>

            {/* Canonical Pilot Occupation Mapping (Optional) */}
            <div className="form-group">
              <label htmlFor="target-occupation-id" className="form-label">
                {isHindi ? 'पायलट संदर्भ व्यवसाय (वैकल्पिक)' : 'Benchmark Pilot Occupation (Optional)'}
              </label>
              <select
                id="target-occupation-id"
                className="form-select"
                value={targetOccupationId}
                onChange={(e) => setTargetOccupationId(e.target.value)}
                disabled={!isAuthenticated || isSavingProfile}
              >
                <option value="">
                  {isHindi ? '-- कस्टम भूमिका / कोई विशिष्ट पायलट मैपिंग नहीं --' : '-- Custom Role / No Specific Pilot Benchmark --'}
                </option>
                {occupations.map((occ) => (
                  <option key={occ.occupation_id} value={occ.occupation_id}>
                    {occ.occupation_title} ({occ.occupation_id} • NSQF {occ.nsqf_level || 'N/A'})
                  </option>
                ))}
              </select>
              <span className="field-hint">
                {isHindi
                  ? 'आप 9 पायलट व्यवसायों तक सीमित नहीं हैं। यदि आपका लक्ष्य भिन्न है तो कस्टम चुनें।'
                  : 'Aligning with a benchmark occupation connects your profile to live TVET demand intelligence.'}
              </span>
            </div>

            {/* Target Sector */}
            <div className="form-group">
              <label htmlFor="target-sector" className="form-label">
                {isHindi ? 'लक्षित उद्योग क्षेत्र' : 'Target Industry Sector'}
              </label>
              <select
                id="target-sector"
                className="form-select"
                value={targetSector}
                onChange={(e) => setTargetSector(e.target.value)}
                disabled={!isAuthenticated || isSavingProfile}
              >
                <option value="">{isHindi ? 'क्षेत्र चुनें...' : 'Select Sector...'}</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Education Level & Institution */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="education-level" className="form-label">
                  {isHindi ? 'वर्तमान उच्चतम योग्यता' : 'Highest Qualification'}
                </label>
                <select
                  id="education-level"
                  className="form-select"
                  value={currentEducationLevel}
                  onChange={(e) => setCurrentEducationLevel(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                >
                  <option value="">{isHindi ? 'योग्यता चुनें...' : 'Select Qualification...'}</option>
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="institution-name" className="form-label">
                  {isHindi ? 'संस्थान / कॉलेज का नाम' : 'Institution / College'}
                </label>
                <input
                  id="institution-name"
                  type="text"
                  className="form-input"
                  placeholder={isHindi ? 'उदा. National Institute of Technology' : 'e.g. National Institute of Technology'}
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                />
              </div>
            </div>

            {/* Graduation Year & Experience */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="graduation-year" className="form-label">
                  {isHindi ? 'स्नातक वर्ष' : 'Graduation Year'}
                </label>
                <input
                  id="graduation-year"
                  type="number"
                  min="1970"
                  max="2035"
                  className="form-input"
                  placeholder="2025"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                />
              </div>

              <div className="form-group">
                <label htmlFor="years-experience" className="form-label">
                  {isHindi ? 'अनुभव (वर्ष)' : 'Years of Experience'}
                </label>
                <input
                  id="years-experience"
                  type="number"
                  step="0.5"
                  min="0"
                  max="40"
                  className="form-input"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                />
              </div>
            </div>

            {/* Current State & District */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="current-state" className="form-label">
                  {isHindi ? 'वर्तमान राज्य' : 'Current State'}
                </label>
                <select
                  id="current-state"
                  className="form-select"
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                >
                  <option value="">{isHindi ? 'राज्य चुनें...' : 'Select State...'}</option>
                  <option value="KA">Karnataka (KA)</option>
                  <option value="MH">Maharashtra (MH)</option>
                  <option value="TS">Telangana (TS)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="current-district" className="form-label">
                  {isHindi ? 'वर्तमान ज़िला' : 'Current District'}
                </label>
                <select
                  id="current-district"
                  className="form-select"
                  value={currentDistrict}
                  onChange={(e) => setCurrentDistrict(e.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                >
                  <option value="">{isHindi ? 'ज़िला चुनें...' : 'Select District...'}</option>
                  {districts
                    .filter((d) => !currentState || d.state_code === currentState)
                    .map((d) => (
                      <option key={d.district_id} value={d.district_id}>
                        {d.district_name} ({d.state_code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Preferred Locations Chip Selector */}
            <div className="form-group">
              <label className="form-label">
                {isHindi ? 'पसंदीदा कार्य / प्रशिक्षण स्थान' : 'Preferred Working / Training Locations'}
              </label>
              <div className="chips-container">
                {preferredLocations.map((loc) => (
                  <span key={loc} className="chip">
                    <span>{loc}</span>
                    {isAuthenticated && (
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => handleRemoveLocation(loc)}
                        title="Remove location"
                      >
                        <Icon name="x" size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isAuthenticated && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder={isHindi ? 'उदा. Bengaluru Urban, Pune...' : 'Add city or district...'}
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLocation(newLocationInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="auth-ghost-btn"
                    style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => handleAddLocation(newLocationInput)}
                  >
                    <Icon name="plus" size={12} />
                    <span>{isHindi ? 'जोड़ें' : 'Add'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Privacy & AI Consent Toggle */}
            <div className="consent-box">
              <label className="consent-toggle-label">
                <input
                  type="checkbox"
                  checked={consentAiProcessing}
                  onChange={(e) => setConsentAiProcessing(e.target.checked)}
                  disabled={!isAuthenticated || isSavingProfile}
                  className="consent-checkbox"
                />
                <div>
                  <div className="consent-title">
                    {isHindi ? 'एआई करियर सहायक प्रसंस्करण की अनुमति दें (पूर्वावलोकन)' : 'Enable AI Career Copilot Assistance (Phase 4+ Preview)'}
                  </div>
                  <div className="consent-desc">
                    {isHindi
                      ? 'भविष्य के व्यक्तिगत कौशल रोडमैप के लिए स्पष्ट ऑप्ट-इन सहमति। डिफ़ॉल्ट: बंद। फ़ेज़ 1 में कोई बाहरी एआई कॉल नहीं होती।'
                      : 'Explicit user opt-in consent for future AI skill-roadmap recommendations. Default: Off. No external AI processing occurs in Phase 1.'}
                  </div>
                </div>
              </label>
            </div>

            {/* Save Profile Action */}
            <div style={{ marginTop: '1.25rem' }}>
              <button
                type="submit"
                className="auth-primary-btn"
                style={{ width: '100%', padding: '0.65rem 1.25rem' }}
                disabled={!isAuthenticated || isSavingProfile}
              >
                {isSavingProfile ? (
                  <span>{isHindi ? 'सहेजा जा रहा है...' : 'Saving Profile...'}</span>
                ) : (
                  <>
                    <Icon name="check" size={14} />
                    <span>{isHindi ? 'करियर प्रोफ़ाइल सहेजें' : 'Save Career Profile'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Resume Upload & Extraction Review */}
        <div className="career-card resume-card">
          <div className="career-card-header">
            <div>
              <h2 className="career-card-title">
                <Icon name="file-text" size={16} />
                <span>{isHindi ? 'डिजिटल रिज्यूमे एवं निष्कर्षण समीक्षा' : 'Digital Resume & Extraction Review'}</span>
              </h2>
              <p className="career-card-subtitle">
                {isHindi
                  ? 'टेक्स्ट-आधारित पीडीएफ रिज्यूमे अपलोड करें और निकाले गए विवरणों की पुष्टि करें'
                  : 'Upload a text-based PDF resume (< 5 MiB) to inspect and verify extracted profile data'}
              </p>
            </div>
          </div>

          {/* Scanned PDF Limitation Notice */}
          <div className="resume-notice-box">
            <Icon name="info" size={15} />
            <div>
              <strong>{isHindi ? 'महत्वपूर्ण सूचना:' : 'Notice:'}</strong>{' '}
              {isHindi
                ? 'निकाले गए विवरण नियम-आधारित सुझाव हैं। स्कैन किए गए या इमेज-ओनली पीडीएफ समर्थित नहीं हैं। कृपया चयन योग्य टेक्स्ट वाला डिजिटल पीडीएफ अपलोड करें।'
                : 'Automatic heuristic extraction provides initial suggestions for your review. Scanned or image-only PDFs are not supported yet. Please upload a digital PDF with selectable text.'}
            </div>
          </div>

          {/* Upload Dropzone / Button */}
          {isAuthenticated && (
            <div className="resume-upload-zone">
              <label htmlFor="resume-file-input" className="upload-dropzone-label">
                <div className="upload-icon-circle">
                  <Icon name="upload" size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                  {isUploading
                    ? (isHindi ? 'टेक्स्ट निकाला जा रहा है...' : 'Extracting text and analyzing resume...')
                    : (isHindi ? 'पीडीएफ रिज्यूमे अपलोड करें (अधिकतम 5 एमबी)' : 'Upload PDF Resume (Max 5 MiB)')}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {isHindi ? 'ब्राउज़ करने के लिए क्लिक करें या फ़ाइल यहाँ छोड़ें' : 'Click to select or drag and drop your text-based .pdf'}
                </div>
                <input
                  id="resume-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}

          {/* Uploaded Resume Status Banner */}
          {resumeData ? (
            <div className="uploaded-resume-section">
              <div className="resume-meta-strip">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div className="resume-file-icon">
                    <Icon name="file-text" size={18} />
                  </div>
                  <div>
                    <div className="resume-filename">{resumeData.original_filename}</div>
                    <div className="resume-filesize">
                      {(resumeData.file_size_bytes / 1024).toFixed(1)} KB •{' '}
                      {new Date(resumeData.uploaded_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`review-status-pill ${resumeData.is_reviewed ? 'confirmed' : 'pending'}`}>
                    {resumeData.is_reviewed
                      ? (isHindi ? 'सत्यापित एवं स्वीकृत' : 'Reviewed & Confirmed')
                      : (isHindi ? 'समीक्षा लंबित' : 'Pending Verification')}
                  </span>
                  <button
                    type="button"
                    className="scenario-delete-btn"
                    onClick={handleDeleteResume}
                    disabled={isDeletingResume}
                    title={isHindi ? 'रिज्यूमे हटाएं' : 'Delete Resume'}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>

              {/* Extraction Review Section */}
              <div className="extraction-review-container">
                <div className="review-section-header">
                  <h3 className="review-title">
                    <Icon name="check-circle" size={14} />
                    <span>{isHindi ? 'निकाले गए विवरणों की समीक्षा एवं सुधार' : 'Review & Correct Extracted Details'}</span>
                  </h3>
                  <button
                    type="button"
                    className="apply-profile-btn"
                    onClick={handleApplyToProfile}
                    title={isHindi ? 'प्रोफ़ाइल फ़ॉर्म में लागू करें' : 'Copy details into Career Profile Form'}
                  >
                    <Icon name="arrow-right" size={12} />
                    <span>{isHindi ? 'प्रोफ़ाइल में कॉपी करें' : 'Apply to Profile Form'}</span>
                  </button>
                </div>

                {/* Editable review form */}
                <div className="review-fields-grid">
                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'उम्मीदवार का नाम' : 'Candidate Name'}</label>
                    <input
                      type="text"
                      className="form-input compact"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'ईमेल पता' : 'Email Address'}</label>
                    <input
                      type="email"
                      className="form-input compact"
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'फ़ोन नंबर' : 'Phone Number'}</label>
                    <input
                      type="text"
                      className="form-input compact"
                      value={reviewPhone}
                      onChange={(e) => setReviewPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'पता लगाई गई योग्यता' : 'Detected Qualification'}</label>
                    <input
                      type="text"
                      className="form-input compact"
                      value={reviewEducation}
                      onChange={(e) => setReviewEducation(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'संस्थान' : 'Detected Institution'}</label>
                    <input
                      type="text"
                      className="form-input compact"
                      value={reviewInstitution}
                      onChange={(e) => setReviewInstitution(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="review-field-label">{isHindi ? 'स्नातक वर्ष' : 'Graduation Year'}</label>
                    <input
                      type="number"
                      className="form-input compact"
                      value={reviewGradYear}
                      onChange={(e) => setReviewGradYear(e.target.value)}
                    />
                  </div>
                </div>

                {/* Detected Skills Tags */}
                <div className="form-group" style={{ marginTop: '0.65rem' }}>
                  <label className="review-field-label">
                    {isHindi ? 'पता लगाए गए कौशल' : 'Detected Skills'} ({reviewSkills.length})
                  </label>
                  <div className="skills-chips-wrapper">
                    {reviewSkills.map((sk) => (
                      <span key={sk} className="skill-chip">
                        <span>{sk}</span>
                        <button
                          type="button"
                          className="skill-remove-btn"
                          onClick={() => handleRemoveSkill(sk)}
                          title="Remove skill"
                        >
                          <Icon name="x" size={10} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.45rem' }}>
                    <input
                      type="text"
                      className="form-input compact"
                      style={{ flex: 1 }}
                      placeholder={isHindi ? 'नया कौशल जोड़ें...' : 'Add custom skill...'}
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="auth-ghost-btn compact"
                      onClick={handleAddSkill}
                    >
                      <Icon name="plus" size={12} />
                      <span>{isHindi ? 'जोड़ें' : 'Add'}</span>
                    </button>
                  </div>
                </div>

                {/* Review Confirm Button */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="auth-primary-btn"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                    onClick={handleSaveReview}
                    disabled={isSavingReview}
                  >
                    {isSavingReview ? (
                      <span>{isHindi ? 'सहेजा जा रहा है...' : 'Saving Review...'}</span>
                    ) : (
                      <>
                        <Icon name="check" size={13} />
                        <span>{isHindi ? 'समीक्षा विवरण की पुष्टि करें एवं सहेजें' : 'Save & Confirm Review'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="workspace-empty-state" style={{ padding: '2rem 1rem' }}>
              <div className="workspace-empty-icon">
                <Icon name="file-text" size={32} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
                {isHindi ? 'कोई सक्रिय रिज्यूमे अपलोड नहीं है' : 'No active resume uploaded'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.5 }}>
                {isHindi
                  ? 'टेक्स्ट-आधारित पीडीएफ रिज्यूमे अपलोड करके कौशल और शिक्षा का स्वचालित रूप से पता लगाएं।'
                  : 'Upload your digital PDF resume above to inspect heuristic skill extraction and pre-fill your career profile.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
