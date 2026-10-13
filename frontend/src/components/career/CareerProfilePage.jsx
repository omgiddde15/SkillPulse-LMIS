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
  fetchUserSkills,
  addUserSkill,
  updateUserSkill,
  deleteUserSkill,
  fetchSupportedRoles,
  fetchSkillGapAnalysis,
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

const SKILL_CATEGORIES = [
  'Programming Languages',
  'Web & Frontend',
  'Backend & APIs',
  'Databases & Storage',
  'Cloud & DevOps',
  'Embedded Systems & Hardware',
  'Data Science & Analytics',
  'Quality Assurance & Testing',
  'Tools & Frameworks',
  'Domain Knowledge',
  'General',
];

export default function CareerProfilePage({ onNavigate }) {
  const { user, isAuthenticated, isDemo } = useAuth();
  const { t, isHindi } = useLanguage();

  // Navigation tab state: 'profile' | 'skills' | 'gaps'
  const [activeTab, setActiveTab] = useState('profile');

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

  // Skills state (Phase 2)
  const [userSkills, setUserSkills] = useState([]);
  const [skillsFilter, setSkillsFilter] = useState('all');
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [modalSkillName, setModalSkillName] = useState('');
  const [modalSkillCategory, setModalSkillCategory] = useState('Programming Languages');
  const [modalSkillStatus, setModalSkillStatus] = useState('claimed');
  const [modalSkillContext, setModalSkillContext] = useState('');
  const [isSavingSkill, setIsSavingSkill] = useState(false);

  // Skill Gap Analysis state (Phase 2)
  const [supportedRoles, setSupportedRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [isLoadingGaps, setIsLoadingGaps] = useState(false);

  // UI state
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [resumeFeedback, setResumeFeedback] = useState(null);
  const [skillsFeedback, setSkillsFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Helper to load skills
  const refreshUserSkills = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsSkillsLoading(true);
      const res = await fetchUserSkills();
      setUserSkills(res?.skills || []);
    } catch {
      // Non-blocking if fails
    } finally {
      setIsSkillsLoading(false);
    }
  }, [isAuthenticated]);

  // Helper to load gap analysis
  const loadGapAnalysis = useCallback(async (roleId) => {
    if (!roleId || !isAuthenticated) return;
    try {
      setIsLoadingGaps(true);
      const res = await fetchSkillGapAnalysis(roleId);
      setGapAnalysis(res);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load skill-gap analysis.');
    } finally {
      setIsLoadingGaps(false);
    }
  }, [isAuthenticated]);

  // Load initial metadata and data
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

        // 4. User skills
        const skillsRes = await fetchUserSkills();
        setUserSkills(skillsRes?.skills || []);

        // 5. Supported roles
        const rolesRes = await fetchSupportedRoles();
        const roles = rolesRes?.roles || [];
        setSupportedRoles(roles);

        // Pick default role: match user target occupation if possible, or first role
        let initialRoleId = roles[0]?.role_id || '';
        if (profRes?.profile?.target_occupation_id) {
          const matchedRole = roles.find((r) => r.benchmark_occupation_id === profRes.profile.target_occupation_id);
          if (matchedRole) {
            initialRoleId = matchedRole.role_id;
          }
        }
        setSelectedRoleId(initialRoleId);

        if (initialRoleId) {
          try {
            const gapRes = await fetchSkillGapAnalysis(initialRoleId);
            setGapAnalysis(gapRes);
          } catch {
            // Non-blocking initial gap load
          }
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

      await saveCareerProfile(payload);
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
      await refreshUserSkills();
      if (selectedRoleId) {
        await loadGapAnalysis(selectedRoleId);
      }
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
      await refreshUserSkills();
      if (selectedRoleId) {
        await loadGapAnalysis(selectedRoleId);
      }
      setResumeFeedback({
        type: 'success',
        text: isHindi
          ? 'समीक्षा विवरण सफलतापूर्वक सहेजे और पुष्टि किए गए! कौशल सूची अद्यतन की गई।'
          : 'Reviewed extraction saved and confirmed successfully! Skill evidence catalog updated.',
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
        ? 'निकाले गए विवरण प्रोफ़ाइल फ़ॉर्म में लागू किए गए। सहेजने के लिए "करियर प्रोफ़ाइल सहेजें" पर क्लिक करें।'
        : 'Extracted details applied to profile form. Click "Save Career Profile" to persist.',
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
      await refreshUserSkills();
      if (selectedRoleId) {
        await loadGapAnalysis(selectedRoleId);
      }
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

  // Add/remove location chip
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
  const handleAddReviewSkill = () => {
    const clean = newSkillInput.trim();
    if (clean && !reviewSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setReviewSkills([...reviewSkills, clean]);
      setNewSkillInput('');
    }
  };

  const handleRemoveReviewSkill = (skill) => {
    setReviewSkills(reviewSkills.filter((s) => s !== skill));
  };

  // Skills modal handlers
  const handleOpenAddSkill = () => {
    setEditingSkill(null);
    setModalSkillName('');
    setModalSkillCategory('Programming Languages');
    setModalSkillStatus('claimed');
    setModalSkillContext('');
    setIsSkillModalOpen(true);
  };

  const handleOpenEditSkill = (sk) => {
    setEditingSkill(sk);
    setModalSkillName(sk.skill_name);
    setModalSkillCategory(sk.category || 'General');
    setModalSkillStatus(sk.evidence_status === 'evidenced' ? 'evidenced' : 'claimed');
    setModalSkillContext(sk.source_context || '');
    setIsSkillModalOpen(true);
  };

  const handleSaveModalSkill = async (e) => {
    e.preventDefault();
    if (!modalSkillName.trim()) {
      setErrorMessage(isHindi ? 'कृपया कौशल का नाम दर्ज करें।' : 'Please enter a skill name.');
      return;
    }

    setIsSavingSkill(true);
    setErrorMessage(null);
    setSkillsFeedback(null);

    try {
      if (editingSkill) {
        await updateUserSkill(editingSkill.id, {
          evidence_status: modalSkillStatus,
          category: modalSkillCategory,
          source_context: modalSkillContext.trim() || null,
          verified_by_user: true,
        });
        setSkillsFeedback(isHindi ? 'कौशल साक्ष्य सफलतापूर्वक अद्यतन किया गया!' : 'Skill evidence updated successfully!');
      } else {
        await addUserSkill({
          skill_name: modalSkillName.trim(),
          category: modalSkillCategory,
          evidence_status: modalSkillStatus,
          source_context: modalSkillContext.trim() || null,
        });
        setSkillsFeedback(isHindi ? 'कौशल सफलतापूर्वक जोड़ा गया!' : 'Skill added successfully!');
      }

      setIsSkillModalOpen(false);
      await refreshUserSkills();
      if (selectedRoleId) {
        await loadGapAnalysis(selectedRoleId);
      }
      setTimeout(() => setSkillsFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save skill.');
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (sk) => {
    const confirmPrompt = isHindi
      ? `क्या आप वाकई "${sk.skill_name}" को अपनी कौशल सूची से हटाना चाहते हैं?`
      : `Are you sure you want to delete "${sk.skill_name}" from your skills list?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await deleteUserSkill(sk.id);
      await refreshUserSkills();
      if (selectedRoleId) {
        await loadGapAnalysis(selectedRoleId);
      }
      setSkillsFeedback(isHindi ? 'कौशल सफलतापूर्वक हटा दिया गया।' : 'Skill deleted successfully.');
      setTimeout(() => setSkillsFeedback(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete skill.');
    }
  };

  // Role change in gap analysis
  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setSelectedRoleId(roleId);
    loadGapAnalysis(roleId);
  };

  // Skill filter counts
  const totalSkillsCount = userSkills.length;
  const evidencedCount = userSkills.filter((s) => s.evidence_status === 'evidenced').length;
  const claimedCount = userSkills.filter((s) => s.evidence_status === 'claimed').length;
  const unconfirmedCount = userSkills.filter((s) => s.evidence_status === 'unconfirmed').length;

  const filteredSkills = userSkills.filter((s) => {
    if (skillsFilter === 'all') return true;
    return s.evidence_status === skillsFilter;
  });

  if (isLoadingInitial) {
    return <LoadingSpinner message={isHindi ? 'करियर प्रोफ़ाइल एवं कौशल डेटा लोड हो रहा है...' : 'Loading candidate career profile and skills intelligence...'} />;
  }

  return (
    <div className="career-profile-container">
      {/* Page Header */}
      <div className="workspace-header-row">
        <div>
          <div className="workspace-title-row">
            <h1 className="workspace-title">
              {isHindi ? 'उम्मीदवार करियर प्रोफ़ाइल एवं कौशल कार्यक्षेत्र' : 'Candidate Career Profile & Skills Workspace'}
            </h1>
            <span className="workspace-role-badge">
              <Icon name="briefcase" size={13} />
              <span>{isAuthenticated ? (isHindi ? 'प्रमाणीकृत उम्मीदवार' : 'Authenticated Candidate') : 'Demo Visitor'}</span>
            </span>
          </div>
          <p className="workspace-subtitle">
            {isHindi
              ? 'करियर लक्ष्य निर्धारित करें, डिजिटल पीडीएफ रिज्यूमे अपलोड करें, कौशलों को प्रमाणित करें, और लक्षित भूमिका अंतर का विश्लेषण करें।'
              : 'Configure career goals, upload digital PDF resumes, manage verified skill evidence, and evaluate role gap benchmarks.'}
          </p>
        </div>

        {isAuthenticated && (
          <button
            type="button"
            className="btn-refresh"
            onClick={loadData}
            title={isHindi ? 'रिफ्रेश करें' : 'Refresh profile, skills, and gaps'}
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
                  ? 'व्यक्तिगत करियर प्रोफ़ाइल सहेजने, निजी रिज्यूमे अपलोड करने, और कौशल अंतर विश्लेषण के लिए एक निःशुल्क खाता आवश्यक है।'
                  : 'Creating a personalized career profile, uploading private PDF resumes, and running skill-gap analysis requires an authenticated account.'}
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

      {skillsFeedback && (
        <div className="auth-alert success" style={{ marginBottom: '1.25rem' }}>
          <Icon name="check-circle" size={16} />
          <span>{skillsFeedback}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="career-tabs-nav">
        <button
          type="button"
          className={`career-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Icon name="user" size={15} />
          <span>{t('career.tab.profile')}</span>
        </button>

        <button
          type="button"
          className={`career-tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          <Icon name="award" size={15} />
          <span>{t('career.tab.skills')}</span>
          <span className="career-tab-badge">{userSkills.length}</span>
        </button>

        <button
          type="button"
          className={`career-tab-btn ${activeTab === 'gaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('gaps')}
        >
          <Icon name="target" size={15} />
          <span>{t('career.tab.gapAnalysis')}</span>
          {gapAnalysis?.coverage_metrics && (
            <span className="career-tab-badge">{gapAnalysis.coverage_metrics.evidence_coverage_percentage}%</span>
          )}
        </button>
      </div>

      {/* TAB 1: Profile & Resume */}
      {activeTab === 'profile' && (
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
                    : 'Optional for partial profiles. You can save education and location first, and set target role anytime.'}
                </span>
              </div>

              {/* Benchmark Pilot Occupation */}
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
                        ? 'भविष्य के व्यक्तिगत कौशल रोडमैप के लिए स्पष्ट ऑप्ट-इन सहमति। डिफ़ॉल्ट: बंद। फ़ेज़ 2 में कोई बाहरी एआई कॉल नहीं होती।'
                        : 'Explicit user opt-in consent for future AI skill-roadmap recommendations. Default: Off. No external AI processing occurs in Phase 2.'}
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

            {/* Upload Dropzone */}
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
                            onClick={() => handleRemoveReviewSkill(sk)}
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
                            handleAddReviewSkill();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="auth-ghost-btn compact"
                        onClick={handleAddReviewSkill}
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
      )}

      {/* TAB 2: Verified Skills & Evidence */}
      {activeTab === 'skills' && (
        <div className="career-skills-view">
          {/* Summary KPI Strip */}
          <div className="skills-summary-row">
            <div className="skills-kpi-card">
              <span className="skills-kpi-val">{totalSkillsCount}</span>
              <span className="skills-kpi-lbl">{t('career.skills.total')}</span>
            </div>
            <div className="skills-kpi-card" style={{ borderColor: 'var(--status-success-border)' }}>
              <span className="skills-kpi-val" style={{ color: 'var(--accent-primary)' }}>{evidencedCount}</span>
              <span className="skills-kpi-lbl">{t('career.skills.evidenced')}</span>
            </div>
            <div className="skills-kpi-card" style={{ borderColor: 'var(--status-supply-border)' }}>
              <span className="skills-kpi-val" style={{ color: 'var(--status-supply-text)' }}>{claimedCount}</span>
              <span className="skills-kpi-lbl">{t('career.skills.claimed')}</span>
            </div>
            <div className="skills-kpi-card" style={{ borderColor: 'var(--status-demand-border)' }}>
              <span className="skills-kpi-val" style={{ color: 'var(--status-demand-text)' }}>{unconfirmedCount}</span>
              <span className="skills-kpi-lbl">{t('career.skills.unconfirmed')}</span>
            </div>
          </div>

          {/* Evidence Classification Standard Notice */}
          <div className="resume-notice-box" style={{ marginBottom: '1.25rem' }}>
            <Icon name="info" size={16} />
            <div>
              <strong>{isHindi ? 'साक्ष्य वर्गीकरण मानक:' : 'Evidence Classification Standard:'}</strong>{' '}
              {t('career.skills.statusNotice')}
            </div>
          </div>

          {/* Table Controls & Filter Bar */}
          <div className="career-card" style={{ padding: '1.25rem' }}>
            <div className="skills-controls-bar">
              <div className="skills-filter-group">
                <button
                  type="button"
                  className={`skills-filter-btn ${skillsFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSkillsFilter('all')}
                >
                  {t('career.skills.filterAll')} ({totalSkillsCount})
                </button>
                <button
                  type="button"
                  className={`skills-filter-btn ${skillsFilter === 'evidenced' ? 'active' : ''}`}
                  onClick={() => setSkillsFilter('evidenced')}
                >
                  {t('career.skills.evidenced')} ({evidencedCount})
                </button>
                <button
                  type="button"
                  className={`skills-filter-btn ${skillsFilter === 'claimed' ? 'active' : ''}`}
                  onClick={() => setSkillsFilter('claimed')}
                >
                  {t('career.skills.claimed')} ({claimedCount})
                </button>
                <button
                  type="button"
                  className={`skills-filter-btn ${skillsFilter === 'unconfirmed' ? 'active' : ''}`}
                  onClick={() => setSkillsFilter('unconfirmed')}
                >
                  {t('career.skills.unconfirmed')} ({unconfirmedCount})
                </button>
              </div>

              {isAuthenticated && (
                <button
                  type="button"
                  className="auth-primary-btn"
                  style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
                  onClick={handleOpenAddSkill}
                >
                  <Icon name="plus" size={13} />
                  <span>{t('career.skills.addSkill')}</span>
                </button>
              )}
            </div>

            {/* Skills Table */}
            {filteredSkills.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="skills-data-table">
                  <thead>
                    <tr>
                      <th>{t('career.skills.thSkill')}</th>
                      <th>{t('career.skills.thCategory')}</th>
                      <th>{t('career.skills.thStatus')}</th>
                      <th>{t('career.skills.thContext')}</th>
                      <th style={{ textAlign: 'right' }}>{t('career.skills.thActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkills.map((sk) => (
                      <tr key={sk.id}>
                        <td style={{ fontWeight: 600 }}>{sk.skill_name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                          {sk.category || 'General'}
                        </td>
                        <td>
                          <span className={`badge-status ${sk.evidence_status}`}>
                            {sk.evidence_status === 'evidenced' && <Icon name="check-circle" size={11} />}
                            {sk.evidence_status === 'claimed' && <Icon name="user" size={11} />}
                            {sk.evidence_status === 'unconfirmed' && <Icon name="clock" size={11} />}
                            <span>{t(`career.skills.badge${sk.evidence_status.charAt(0).toUpperCase() + sk.evidence_status.slice(1)}`)}</span>
                          </span>
                        </td>
                        <td style={{ maxWidth: '320px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                          {sk.source_context ? (
                            <span>{sk.source_context}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {sk.evidence_status === 'unconfirmed'
                                ? (isHindi ? 'रिज्यूमे निष्कर्षण से प्राप्त' : 'Extracted from resume text')
                                : (isHindi ? 'कोई संदर्भ संलग्न नहीं है' : 'No supporting context provided')}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isAuthenticated && (
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="auth-ghost-btn compact"
                                onClick={() => handleOpenEditSkill(sk)}
                                title={isHindi ? 'साक्ष्य विवरण संपादित करें' : 'Edit evidence context'}
                              >
                                <span>{isHindi ? 'संपादित करें' : 'Edit'}</span>
                              </button>
                              <button
                                type="button"
                                className="scenario-delete-btn"
                                onClick={() => handleDeleteSkill(sk)}
                                title={isHindi ? 'कौशल हटाएं' : 'Delete skill'}
                              >
                                <Icon name="trash" size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="workspace-empty-state" style={{ padding: '2.5rem 1rem' }}>
                <div className="workspace-empty-icon">
                  <Icon name="award" size={28} />
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
                  {isHindi ? 'इस फ़िल्टर में कोई कौशल नहीं मिला' : 'No skills found for this filter'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                  {t('career.skills.empty')}
                </p>
                {isAuthenticated && (
                  <button
                    type="button"
                    className="auth-primary-btn"
                    style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
                    onClick={handleOpenAddSkill}
                  >
                    <Icon name="plus" size={13} />
                    <span>{t('career.skills.addSkill')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Explainable Skill-Gap Analysis */}
      {activeTab === 'gaps' && (
        <div className="career-gaps-view">
          {/* Role Selector Card */}
          <div className="gaps-role-selector-card">
            <div className="role-header-line">
              <div>
                <label htmlFor="target-role-select" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  {t('career.gaps.selectRole')}
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('career.gaps.subtitle')}
                </p>
              </div>

              <div style={{ minWidth: '280px' }}>
                <select
                  id="target-role-select"
                  className="form-select"
                  value={selectedRoleId}
                  onChange={handleRoleChange}
                >
                  {supportedRoles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_title} ({r.role_family} • {r.sector})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Provenance Box */}
            {gapAnalysis && (
              <div className="gaps-provenance-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {gapAnalysis.role_title} ({gapAnalysis.role_id})
                  </div>
                  <div className="gaps-provenance-tags">
                    <span className="provenance-tag">{gapAnalysis.provenance?.sector}</span>
                    <span className="provenance-tag">NSQF Level {gapAnalysis.provenance?.nsqf_level}</span>
                    <span className="provenance-tag">{gapAnalysis.provenance?.benchmark_occupation_title}</span>
                    <span className="provenance-tag">v{gapAnalysis.provenance?.version}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  <strong>{isHindi ? 'मानक संदर्भ:' : 'Curriculum Provenance:'}</strong> {gapAnalysis.provenance?.reference_standard} • {gapAnalysis.provenance?.attribution}
                </div>
              </div>
            )}
          </div>

          {/* Coverage KPI & Metric Strip */}
          {isLoadingGaps ? (
            <LoadingSpinner message={isHindi ? 'कौशल अंतर विश्लेषण की गणना की जा रही है...' : 'Evaluating candidate skill evidence against target role...'} />
          ) : gapAnalysis?.coverage_metrics ? (
            <>
              <div className="coverage-metric-banner">
                <div className="coverage-metric-top">
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('career.gaps.covScore')}
                    </div>
                    <div className="coverage-percentage-huge">
                      {gapAnalysis.coverage_metrics.evidence_coverage_percentage}%
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <strong>{gapAnalysis.coverage_metrics.required_evidenced_count}</strong> {isHindi ? 'में से' : 'of'}{' '}
                      <strong>{gapAnalysis.coverage_metrics.total_required_skills}</strong> {isHindi ? 'मूल आवश्यक योग्यताएं प्रमाणित' : 'core required competencies evidenced'}
                    </div>
                  </div>

                  <div className="coverage-tally-strip">
                    <span className="badge-status evidenced">
                      <Icon name="check-circle" size={11} />
                      <span>{gapAnalysis.coverage_metrics.required_evidenced_count} {t('career.gaps.badgeEvidenced')}</span>
                    </span>
                    <span className="badge-status claimed">
                      <Icon name="user" size={11} />
                      <span>{gapAnalysis.coverage_metrics.required_claimed_count} {t('career.gaps.badgeClaimed')}</span>
                    </span>
                    <span className="badge-status unconfirmed">
                      <Icon name="clock" size={11} />
                      <span>{gapAnalysis.coverage_metrics.required_unconfirmed_count} {t('career.gaps.badgeUnconfirmed')}</span>
                    </span>
                    <span className="badge-status missing">
                      <Icon name="x" size={11} />
                      <span>{gapAnalysis.coverage_metrics.required_missing_count} {t('career.gaps.badgeMissing')}</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="coverage-progress-track">
                  <div
                    className="coverage-progress-fill"
                    style={{ width: `${Math.min(gapAnalysis.coverage_metrics.evidence_coverage_percentage, 100)}%` }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span>{t('career.gaps.covFormula')}</span>
                  <span>{t('career.gaps.covNotice')}</span>
                </div>
              </div>

              {/* Core Required Competencies Card */}
              <div className="career-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon name="shield" size={16} />
                    <span>{t('career.gaps.reqSkillsTitle')}</span>
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {isHindi
                      ? 'इस भूमिका के लिए आवश्यक मुख्य दक्षताएं। यदि आपने इन कौशलों का उपयोग किया है, तो "कौशल एवं साक्ष्य" टैब में परियोजना संदर्भ संलग्न करें।'
                      : 'Essential competencies defined by the curriculum. Evidenced requires citing specific project or experience context.'}
                  </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="gaps-table">
                    <thead>
                      <tr>
                        <th>{t('career.gaps.thReqSkill')}</th>
                        <th>{t('career.gaps.thMatch')}</th>
                        <th>{t('career.gaps.thRoleRationale')}</th>
                        <th>{t('career.gaps.thEvidenceSummary')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapAnalysis.required_skills?.map((item) => (
                        <tr key={item.skill_key}>
                          <td style={{ fontWeight: 600 }}>
                            <div>{item.skill_name}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {item.category || 'Core'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-status ${item.match_status}`}>
                              {item.match_status === 'evidenced' && <Icon name="check-circle" size={11} />}
                              {item.match_status === 'claimed' && <Icon name="user" size={11} />}
                              {item.match_status === 'unconfirmed' && <Icon name="clock" size={11} />}
                              {item.match_status === 'missing' && <Icon name="x" size={11} />}
                              <span>{t(`career.gaps.badge${item.match_status.charAt(0).toUpperCase() + item.match_status.slice(1)}`)}</span>
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                            {item.role_justification}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                            {item.match_status === 'missing' ? (
                              <span style={{ color: 'var(--status-danger-text)', fontStyle: 'italic' }}>
                                {isHindi ? 'कोई उम्मीदवार साक्ष्य नहीं मिला' : 'No candidate evidence found'}
                              </span>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.matched_user_skill_name}
                                </div>
                                {item.supporting_context ? (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    "{item.supporting_context}"
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                                    {isHindi ? 'स्व-दावाकृत (कोई परियोजना संदर्भ नहीं)' : 'Self-claimed without project context'}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preferred & Secondary Competencies Card */}
              {gapAnalysis.preferred_skills && gapAnalysis.preferred_skills.length > 0 && (
                <div className="career-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon name="sparkles" size={16} />
                      <span>{t('career.gaps.prefSkillsTitle')}</span>
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {isHindi
                        ? 'पूरक योग्यताएं जो उम्मीदवार की प्रोफाइल को मजबूत करती हैं (कवरेज स्कोर में शामिल नहीं)।'
                        : 'Complementary advantages and advanced tool competencies (tracked separately from core coverage).'}
                    </p>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="gaps-table">
                      <thead>
                        <tr>
                          <th>{t('career.gaps.thReqSkill')}</th>
                          <th>{t('career.gaps.thMatch')}</th>
                          <th>{t('career.gaps.thRoleRationale')}</th>
                          <th>{t('career.gaps.thEvidenceSummary')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gapAnalysis.preferred_skills.map((item) => (
                          <tr key={item.skill_key}>
                            <td style={{ fontWeight: 600 }}>
                              <div>{item.skill_name}</div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {item.category || 'Preferred'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-status ${item.match_status}`}>
                                {item.match_status === 'evidenced' && <Icon name="check-circle" size={11} />}
                                {item.match_status === 'claimed' && <Icon name="user" size={11} />}
                                {item.match_status === 'unconfirmed' && <Icon name="clock" size={11} />}
                                {item.match_status === 'missing' && <Icon name="x" size={11} />}
                                <span>{t(`career.gaps.badge${item.match_status.charAt(0).toUpperCase() + item.match_status.slice(1)}`)}</span>
                              </span>
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                              {item.role_justification}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                              {item.match_status === 'missing' ? (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  {isHindi ? 'अनुपलब्ध' : 'Not yet demonstrated'}
                                </span>
                              ) : (
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {item.matched_user_skill_name}
                                  </div>
                                  {item.supporting_context && (
                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                      "{item.supporting_context}"
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Methodology & Policy Disclaimer */}
              <div className="resume-notice-box">
                <Icon name="shield" size={16} />
                <div>
                  <strong>{isHindi ? 'पारदर्शी पद्धति प्रकटीकरण:' : 'Methodology & Policy Transparency:'}</strong>{' '}
                  {gapAnalysis.disclaimer || t('career.gaps.disclaimer')}
                </div>
              </div>
            </>
          ) : (
            <div className="workspace-empty-state" style={{ padding: '2.5rem 1rem' }}>
              <div className="workspace-empty-icon">
                <Icon name="target" size={32} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
                {t('career.gaps.noRoleSelected')}
              </h3>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add or Edit Skill */}
      {isSkillModalOpen && (
        <div className="skill-modal-overlay" onClick={() => setIsSkillModalOpen(false)}>
          <div className="skill-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Icon name={editingSkill ? 'award' : 'plus'} size={16} />
                <span>{editingSkill ? t('career.skills.editTitle') : t('career.skills.addTitle')}</span>
              </h3>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => setIsSkillModalOpen(false)}
                title="Close modal"
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveModalSkill} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {/* Skill Name */}
              <div className="form-group">
                <label className="form-label">{t('career.skills.nameLabel')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Python, Docker, FastApi, React"
                  value={modalSkillName}
                  onChange={(e) => setModalSkillName(e.target.value)}
                  disabled={Boolean(editingSkill) || isSavingSkill}
                  required
                />
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">{t('career.skills.categoryLabel')}</label>
                <select
                  className="form-select"
                  value={modalSkillCategory}
                  onChange={(e) => setModalSkillCategory(e.target.value)}
                  disabled={isSavingSkill}
                >
                  {SKILL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Evidence Status */}
              <div className="form-group">
                <label className="form-label">{t('career.skills.statusLabel')}</label>
                <select
                  className="form-select"
                  value={modalSkillStatus}
                  onChange={(e) => setModalSkillStatus(e.target.value)}
                  disabled={isSavingSkill}
                >
                  <option value="claimed">
                    {t('career.skills.badgeClaimed')} ({isHindi ? 'स्व-दावाकृत' : 'Self-Reported'})
                  </option>
                  <option value="evidenced">
                    {t('career.skills.badgeEvidenced')} ({isHindi ? 'परियोजना/कार्य साक्ष्य के साथ' : 'With Project Context'})
                  </option>
                </select>
              </div>

              {/* Supporting Context Text Area */}
              <div className="form-group">
                <label className="form-label">{t('career.skills.contextLabel')}</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder={
                    isHindi
                      ? 'उदा. 6-महीने की इंटर्नशिप के दौरान जेनगो और पोस्टग्रेस में ऑटोमेटेड रेस्ट एपीआई विकसित की'
                      : 'e.g. Built automated REST APIs in FastAPI & PostgreSQL during 6-month capstone project'
                  }
                  value={modalSkillContext}
                  onChange={(e) => setModalSkillContext(e.target.value)}
                  disabled={isSavingSkill}
                />
                <span className="field-hint">{t('career.skills.contextHint')}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="auth-ghost-btn"
                  onClick={() => setIsSkillModalOpen(false)}
                  disabled={isSavingSkill}
                >
                  <span>{isHindi ? 'रद्द करें' : 'Cancel'}</span>
                </button>
                <button
                  type="submit"
                  className="auth-primary-btn"
                  disabled={isSavingSkill}
                >
                  {isSavingSkill ? (
                    <span>{isHindi ? 'सहेजा जा रहा है...' : 'Saving...'}</span>
                  ) : (
                    <>
                      <Icon name="check" size={13} />
                      <span>{editingSkill ? t('career.skills.updateBtn') : t('career.skills.saveBtn')}</span>
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
