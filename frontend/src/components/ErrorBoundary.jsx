import React from 'react';
import { LanguageContext } from '../context/LanguageContext';

/**
 * Page-Level Error Boundary for SkillPulse LMIS
 *
 * Catches JavaScript rendering errors in child component trees,
 * prevents the application from unmounting to a blank screen,
 * and displays an accessible recovery interface with a Retry action.
 */
export default class ErrorBoundary extends React.Component {
  static contextType = LanguageContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`SkillPulse ErrorBoundary caught error in [${this.props.moduleName || 'Module'}]:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const { t } = this.context || { t: (k, fb) => fb || k };
      const moduleName = this.props.moduleName || 'Page';

      return (
        <div className="card-panel" style={{ margin: '1.5rem 0', borderColor: '#fca5a5' }}>
          <div className="error-banner" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="error-title" style={{ fontSize: '1.05rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚠️</span>
              <span>{t('error.moduleRenderNotice', { module: moduleName }, `Module Rendering Notice: ${moduleName} encountered an unexpected runtime error.`)}</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
              {t('error.appActive', 'The application dashboard and sidebar navigation remain fully active. You may switch to another module or retry rendering this page.')}
            </p>
            {this.state.error?.message && (
              <div style={{ backgroundColor: '#fee2e2', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fecaca', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#991b1b' }}>
                {t('error.detail', 'Error Detail:')} {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-refresh"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c', cursor: 'pointer' }}
                onClick={this.handleRetry}
              >
                {t('error.retryModule', { module: moduleName }, `🔄 Retry ${moduleName}`)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
