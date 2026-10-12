import React, { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/landing/LandingPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './components/Overview';
import DemandIntelligence from './components/DemandIntelligence';
import GapAnalysis from './components/GapAnalysis';
import Forecasts from './components/Forecasts';
import EarlyWarningAlerts from './components/EarlyWarningAlerts';
import SeatSimulator from './components/SeatSimulator';
import Recommendations from './components/dashboard/Recommendations';
import DistrictsExplorer from './components/dashboard/DistrictsExplorer';
import OccupationsExplorer from './components/dashboard/OccupationsExplorer';
import QualificationsExplorer from './components/dashboard/QualificationsExplorer';
import DataHealth from './components/dashboard/DataHealth';
import ApiExports from './components/dashboard/ApiExports';
import Settings from './components/dashboard/Settings';
import PlaceholderPage from './components/PlaceholderPage';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorAlert from './components/ErrorAlert';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchHealth, fetchDemandIndex, fetchGapAnalysis } from './api/client';
import { useLanguage } from './context/LanguageContext';

const ROUTE_TO_PATH = {
  home: '/',
  overview: '/overview',
  demand: '/demand',
  forecasts: '/forecasts',
  gap: '/gaps',
  alerts: '/alerts',
  recommendations: '/recommendations',
  simulator: '/scenarios',
  districts: '/districts',
  occupations: '/occupations',
  qualifications: '/qualifications',
  'data-health': '/data-health',
  api: '/api',
  settings: '/settings',
};

const PATH_TO_ROUTE = {
  '/': 'home',
  '': 'home',
  '/overview': 'overview',
  '/demand': 'demand',
  '/intelligence': 'demand',
  '/forecasts': 'forecasts',
  '/gaps': 'gap',
  '/gap': 'gap',
  '/alerts': 'alerts',
  '/recommendations': 'recommendations',
  '/scenarios': 'simulator',
  '/simulator': 'simulator',
  '/districts': 'districts',
  '/occupations': 'occupations',
  '/qualifications': 'qualifications',
  '/data-health': 'data-health',
  '/api': 'api',
  '/settings': 'settings',
};

function getRouteFromLocation() {
  if (typeof window === 'undefined') return 'home';
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  return PATH_TO_ROUTE[pathname] || 'home';
}

export default function App() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(getRouteFromLocation);
  const [period, setPeriod] = useState('2026-09');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking' });
  const [demandData, setDemandData] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Synchronize browser history on route changes
  const handleNavigate = useCallback((tabId) => {
    setActiveTab(tabId);
    const targetPath = ROUTE_TO_PATH[tabId] || '/overview';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Listen for browser forward/backward buttons
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Initial and reactive data load on period change
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const healthRes = await fetchHealth();
        if (ignore) return;
        setBackendHealth(healthRes);

        const [demandRes, gapRes] = await Promise.all([
          fetchDemandIndex({ period, limit: 100 }),
          fetchGapAnalysis({ period, limit: 100 }),
        ]);

        if (ignore) return;
        setDemandData(demandRes);
        setGapData(gapRes);
        setErrorMessage(null);
      } catch (err) {
        if (ignore) return;
        setBackendHealth({ status: 'offline', error: err.message });
        setErrorMessage(
          err.message || 'Unable to load workforce analytics data from backend service.'
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [period]);

  // User explicit refresh trigger
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const healthRes = await fetchHealth();
      setBackendHealth(healthRes);

      const [demandRes, gapRes] = await Promise.all([
        fetchDemandIndex({ period, limit: 100 }),
        fetchGapAnalysis({ period, limit: 100 }),
      ]);

      setDemandData(demandRes);
      setGapData(gapRes);
    } catch (err) {
      setBackendHealth({ status: 'offline', error: err.message });
      setErrorMessage(
        err.message || 'Unable to refresh workforce analytics data from backend.'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [period]);

  // Retry from error state
  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const healthRes = await fetchHealth();
      setBackendHealth(healthRes);

      const [demandRes, gapRes] = await Promise.all([
        fetchDemandIndex({ period, limit: 100 }),
        fetchGapAnalysis({ period, limit: 100 }),
      ]);

      setDemandData(demandRes);
      setGapData(gapRes);
    } catch (err) {
      setBackendHealth({ status: 'offline', error: err.message });
      setErrorMessage(
        err.message || 'Unable to load workforce analytics data from backend service.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // If activeTab is 'home', render the full public Landing Page
  if (activeTab === 'home') {
    return (
      <LandingPage
        onNavigate={handleNavigate}
        backendHealth={backendHealth}
      />
    );
  }

  // Otherwise render Dashboard Shell with Grouped Navigation and Modules
  return (
    <div className="app-container">
      {/* Grouped Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleNavigate}
        backendHealth={backendHealth}
      />

      {/* Main Workspace Area */}
      <div className="app-main">
        {/* Dashboard Header with breadcrumbs and compact provenance badge */}
        <Header
          period={period}
          activeTab={activeTab}
          onPeriodChange={(newPeriod) => {
            setIsLoading(true);
            setPeriod(newPeriod);
          }}
          onRefresh={handleRefresh}
          onNavigateHome={() => handleNavigate('home')}
          isRefreshing={isRefreshing}
          backendHealth={backendHealth}
        />

        {/* Dynamic Page Content */}
        <main className="page-content" style={{ padding: '1.25rem', overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <ErrorBoundary moduleName="Overview" onRetry={handleRetry}>
              {errorMessage ? (
                <ErrorAlert message={errorMessage} onRetry={handleRetry} />
              ) : isLoading ? (
                <LoadingSpinner message={t('app.loading', 'Querying SkillPulse LMIS backend for reporting period...')} />
              ) : (
                <Overview
                  demandData={demandData}
                  gapData={gapData}
                  backendHealth={backendHealth}
                  period={period}
                />
              )}
            </ErrorBoundary>
          )}

          {activeTab === 'demand' && (
            <ErrorBoundary moduleName="Demand Intelligence">
              <DemandIntelligence
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'gap' && (
            <ErrorBoundary moduleName="Gap Analysis">
              <GapAnalysis
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'forecasts' && (
            <ErrorBoundary moduleName="Forecasts">
              <Forecasts
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'alerts' && (
            <ErrorBoundary moduleName="Early-Warning Alerts">
              <EarlyWarningAlerts
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'recommendations' && (
            <ErrorBoundary moduleName="Recommendations">
              <Recommendations
                period={period}
                onNavigateToSimulator={(_districtId, _occupationId) => {
                  handleNavigate('simulator');
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'simulator' && (
            <ErrorBoundary moduleName="Training-Seat Simulator">
              <SeatSimulator
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'districts' && (
            <ErrorBoundary moduleName="Districts">
              <DistrictsExplorer
                gapData={gapData}
                period={period}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'occupations' && (
            <ErrorBoundary moduleName="Occupations">
              <OccupationsExplorer />
            </ErrorBoundary>
          )}

          {activeTab === 'qualifications' && (
            <ErrorBoundary moduleName="Qualifications">
              <QualificationsExplorer />
            </ErrorBoundary>
          )}

          {activeTab === 'data-health' && (
            <ErrorBoundary moduleName="Data & Model Health">
              <DataHealth backendHealth={backendHealth} />
            </ErrorBoundary>
          )}

          {activeTab === 'api' && (
            <ErrorBoundary moduleName="API & Exports">
              <ApiExports period={period} />
            </ErrorBoundary>
          )}

          {activeTab === 'settings' && (
            <ErrorBoundary moduleName="Settings">
              <Settings
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              />
            </ErrorBoundary>
          )}

          {activeTab !== 'overview' &&
            activeTab !== 'demand' &&
            activeTab !== 'gap' &&
            activeTab !== 'forecasts' &&
            activeTab !== 'alerts' &&
            activeTab !== 'recommendations' &&
            activeTab !== 'simulator' &&
            activeTab !== 'districts' &&
            activeTab !== 'occupations' &&
            activeTab !== 'qualifications' &&
            activeTab !== 'data-health' &&
            activeTab !== 'api' &&
            activeTab !== 'settings' && (
              <ErrorBoundary moduleName="Module">
                <PlaceholderPage moduleId={activeTab} />
              </ErrorBoundary>
            )}
        </main>
      </div>
    </div>
  );
}
