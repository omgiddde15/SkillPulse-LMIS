import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemeToggle from '../ThemeToggle';
import Icon from '../Icon';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage({ onNavigate, onEnterDemo }) {
  const { register } = useAuth();
  const { language, setLanguage, t, isHindi } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Real-time password requirement checks
  const pwCriteria = useMemo(() => {
    return {
      hasMinLen: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      matchesConfirm: confirmPassword.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage(
        isHindi
          ? 'कृपया अपना पूरा नाम दर्ज करें (न्यूनतम 2 वर्ण)।'
          : 'Please enter your full name (at least 2 characters).'
      );
      return;
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage(
        isHindi
          ? 'कृपया एक मान्य ईमेल पता दर्ज करें।'
          : 'Please enter a valid email address.'
      );
      return;
    }
    if (!pwCriteria.hasMinLen || !pwCriteria.hasLetter || !pwCriteria.hasNumber) {
      setErrorMessage(
        isHindi
          ? 'पासवर्ड न्यूनतम 8 वर्ण, कम से कम एक अक्षर और एक संख्या का होना चाहिए।'
          : 'Password must be at least 8 characters and contain at least one letter and one number.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(
        isHindi
          ? 'पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते हैं।'
          : 'Password and confirmation password do not match.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await register({
        full_name: trimmedName,
        email: trimmedEmail,
        password,
        confirm_password: confirmPassword,
      });
      setIsSuccess(true);
      setTimeout(() => {
        onNavigate('overview');
      }, 600);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (isHindi
            ? 'पंजीकरण विफल रहा। कृपया विवरण जांचें और पुनः प्रयास करें।'
            : 'Registration failed. Please check the details and try again.')
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Top Bar with Brand, Theme and Language switch */}
      <header className="auth-header-bar">
        <div
          className="auth-brand-logo"
          onClick={() => onNavigate('home')}
          style={{ cursor: 'pointer' }}
          title={isHindi ? 'होम पेज पर वापस जाएं' : 'Return to Home'}
        >
          <div className="brand-logo" style={{ width: '34px', height: '34px', fontSize: '0.9rem' }}>
            SP
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              SkillPulse
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              LMIS ENGINE • SIH26246
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          <div className="lang-toggle-group" role="group" aria-label="Language selector">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`lang-toggle-btn ${language === 'en' ? 'active' : ''}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`lang-toggle-btn ${language === 'hi' ? 'active' : ''}`}
            >
              हिन्दी
            </button>
          </div>
          <button
            type="button"
            className="auth-ghost-btn"
            onClick={() => onNavigate('home')}
            title="Return to Landing Page"
          >
            <span>&larr;</span>
            <span>{isHindi ? 'होम' : 'Home'}</span>
          </button>
        </div>
      </header>

      {/* Main Centered Card */}
      <main className="auth-card-wrapper">
        <div className="auth-glass-card">
          {/* Card Header */}
          <div className="auth-card-header">
            <div className="auth-icon-badge">
              <Icon name="user" size={20} />
            </div>
            <h1 className="auth-card-title">
              {isHindi ? 'नया खाता बनाएं' : 'Create SkillPulse Account'}
            </h1>
            <p className="auth-card-subtitle">
              {isHindi
                ? 'सिमुलेशन परिदृश्य सहेजें और व्यक्तिगत कार्यक्षेत्र तक पहुँचें'
                : 'Save custom simulator scenarios and manage personal policy workspace'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="auth-alert error" role="alert">
              <Icon name="alert-triangle" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {isSuccess && (
            <div className="auth-alert success" role="status">
              <Icon name="check-circle" size={16} />
              <span>
                {isHindi
                  ? 'खाता सफलतापूर्वक बनाया गया! कार्यक्षेत्र खुल रहा है...'
                  : 'Account created successfully! Loading your workspace...'}
              </span>
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field-group">
              <label htmlFor="signup-name" className="auth-label">
                {isHindi ? 'पूरा नाम' : 'Full name'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="user" size={16} className="auth-input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Dr. Rajesh Verma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-email" className="auth-label">
                {isHindi ? 'ईमेल पता' : 'Email address'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="file-text" size={16} className="auth-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  className="auth-input"
                  placeholder="r.verma@dept.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-password" className="auth-label">
                {isHindi ? 'पासवर्ड' : 'Password'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="lock" size={16} className="auth-input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading || isSuccess}
                  required
                />
                <button
                  type="button"
                  className="auth-show-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? (isHindi ? 'पासवर्ड छिपाएं' : 'Hide password') : (isHindi ? 'पासवर्ड दिखाएं' : 'Show password')}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={15} />
                </button>
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-confirm" className="auth-label">
                {isHindi ? 'पासवर्ड की पुष्टि करें' : 'Confirm password'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="lock" size={16} className="auth-input-icon" />
                <input
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </div>

            {/* Password Requirements Guide */}
            <div className="auth-requirements-box">
              <div className="auth-req-title">
                {isHindi ? 'पासवर्ड सुरक्षा आवश्यकताएं:' : 'Password requirements:'}
              </div>
              <ul className="auth-req-list">
                <li className={pwCriteria.hasMinLen ? 'met' : ''}>
                  <Icon name={pwCriteria.hasMinLen ? 'check' : 'info'} size={12} />
                  <span>{isHindi ? 'कम से कम 8 वर्ण' : 'At least 8 characters'}</span>
                </li>
                <li className={pwCriteria.hasLetter ? 'met' : ''}>
                  <Icon name={pwCriteria.hasLetter ? 'check' : 'info'} size={12} />
                  <span>{isHindi ? 'कम से कम एक अक्षर (A-Z)' : 'At least one letter (a-z, A-Z)'}</span>
                </li>
                <li className={pwCriteria.hasNumber ? 'met' : ''}>
                  <Icon name={pwCriteria.hasNumber ? 'check' : 'info'} size={12} />
                  <span>{isHindi ? 'कम से कम एक संख्या (0-9)' : 'At least one number (0-9)'}</span>
                </li>
                {confirmPassword && (
                  <li className={pwCriteria.matchesConfirm ? 'met' : 'unmet'}>
                    <Icon name={pwCriteria.matchesConfirm ? 'check' : 'alert-triangle'} size={12} />
                    <span>{isHindi ? 'पासवर्ड मेल खाते हैं' : 'Passwords match'}</span>
                  </li>
                )}
              </ul>
            </div>

            <button
              type="submit"
              className="auth-primary-btn"
              disabled={isLoading || isSuccess}
            >
              {isLoading ? (
                <>
                  <Icon name="refresh" size={16} className="spinning-icon" />
                  <span>{isHindi ? 'खाता बनाया जा रहा है...' : 'Creating Account...'}</span>
                </>
              ) : isSuccess ? (
                <>
                  <Icon name="check" size={16} />
                  <span>{isHindi ? 'सफल!' : 'Account Created!'}</span>
                </>
              ) : (
                <>
                  <span>{isHindi ? 'खाता बनाएं एवं जारी रखें' : 'Create Account & Continue'}</span>
                  <Icon name="arrow-right" size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>{isHindi ? 'या' : 'or'}</span>
          </div>

          {/* Explore Demo CTA */}
          <button
            type="button"
            className="auth-demo-btn"
            onClick={() => {
              if (onEnterDemo) onEnterDemo();
              else onNavigate('overview');
            }}
            title="Inspect analytical dashboard in read-only demo mode"
          >
            <Icon name="compass" size={15} />
            <span>{isHindi ? 'डेमो मोड एक्सप्लोर करें (पंजीकरण के बिना)' : 'Explore Demo Mode (No Registration Required)'}</span>
          </button>

          {/* Card Footer: Sign In Link */}
          <div className="auth-card-footer">
            <span>{isHindi ? 'पहले से खाता है?' : 'Already have an account?'}</span>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => onNavigate('login')}
            >
              {isHindi ? 'साइन इन करें' : 'Sign In'}
            </button>
          </div>
        </div>

        {/* Provenance note */}
        <div className="auth-footer-note">
          <Icon name="shield" size={13} />
          <span>
            {isHindi
              ? 'स्मार्ट इंडिया हैकथॉन 2026 (PS SIH26246) — सिमुलेशन एवं नीति निर्माण उपकरण'
              : 'Smart India Hackathon 2026 (PS SIH26246) — Regional Workforce Intelligence Prototype'}
          </span>
        </div>
      </main>
    </div>
  );
}
