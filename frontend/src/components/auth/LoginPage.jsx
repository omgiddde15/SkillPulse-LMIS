import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemeToggle from '../ThemeToggle';
import Icon from '../Icon';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onNavigate, onEnterDemo }) {
  const { login } = useAuth();
  const { language, setLanguage, t, isHindi } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(isHindi ? 'कृपया अपना ईमेल दर्ज करें।' : 'Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage(isHindi ? 'कृपया एक मान्य ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage(isHindi ? 'कृपया अपना पासवर्ड दर्ज करें।' : 'Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login({
        email: trimmedEmail,
        password,
        remember_me: rememberMe,
      });
      setIsSuccess(true);
      setTimeout(() => {
        onNavigate('overview');
      }, 600);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (isHindi
            ? 'अमान्य ईमेल या पासवर्ड। कृपया पुनः प्रयास करें।'
            : 'Invalid email or password. Please try again.')
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
              <Icon name="lock" size={20} />
            </div>
            <h1 className="auth-card-title">
              {isHindi ? 'कार्यक्षेत्र में साइन इन करें' : 'Sign in to SkillPulse'}
            </h1>
            <p className="auth-card-subtitle">
              {isHindi
                ? 'श्रम बाज़ार आसूचना, पूर्वानुमान एवं सीट सिमुलेटर कार्यक्षेत्र'
                : 'Regional labour market intelligence, forecasts and scenario workspace'}
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
                {isHindi ? 'प्रमाणीकरण सफल! डैशबोर्ड लोड हो रहा है...' : 'Authentication successful! Redirecting to workspace...'}
              </span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field-group">
              <label htmlFor="login-email" className="auth-label">
                {isHindi ? 'ईमेल पता' : 'Email address'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="user" size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="auth-input"
                  placeholder="analyst@skillpulse.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="login-password" className="auth-label">
                {isHindi ? 'पासवर्ड' : 'Password'}
              </label>
              <div className="auth-input-wrapper">
                <Icon name="lock" size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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

            <div className="auth-options-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading || isSuccess}
                />
                <span>{isHindi ? 'सत्र याद रखें (30 दिन)' : 'Remember session (30 days)'}</span>
              </label>
            </div>

            <button
              type="submit"
              className="auth-primary-btn"
              disabled={isLoading || isSuccess}
            >
              {isLoading ? (
                <>
                  <Icon name="refresh" size={16} className="spinning-icon" />
                  <span>{isHindi ? 'साइन इन हो रहा है...' : 'Signing in...'}</span>
                </>
              ) : isSuccess ? (
                <>
                  <Icon name="check" size={16} />
                  <span>{isHindi ? 'सफल!' : 'Success!'}</span>
                </>
              ) : (
                <>
                  <span>{isHindi ? 'साइन इन करें' : 'Sign In'}</span>
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

          {/* Card Footer: Sign Up Link */}
          <div className="auth-card-footer">
            <span>{isHindi ? 'खाता नहीं है?' : "Don't have an account?"}</span>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => onNavigate('signup')}
            >
              {isHindi ? 'नया खाता बनाएं' : 'Create Account'}
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
