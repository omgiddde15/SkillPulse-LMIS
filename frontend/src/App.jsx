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
import ContextFilterBar from './components/dashboard/ContextFilterBar';
import CopilotDrawer from './components/dashboard/CopilotDrawer';
import PlaceholderPage from './components/PlaceholderPage';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorAlert from './components/ErrorAlert';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchHealth, fetchDemandIndex, fetchGapAnalysis, fetchAlerts } from './api/client';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import MyWorkspace from './components/dashboard/MyWorkspace';
import CareerProfilePage from './components/career/CareerProfilePage';

const FILTERABLE_TABS = ['overview', 'demand', 'gap', 'forecasts', 'alerts'];

const PILOT_DISTRICTS = [
  { id: 'MH_PUN', state: 'MH' },
  { id: 'MH_MUM', state: 'MH' },
  { id: 'KA_BLR_U', state: 'KA' },
  { id: 'KA_DHA', state: 'KA' },
  { id: 'TS_HYD', state: 'TS' },
  { id: 'TS_MED', state: 'TS' },
];

const PILOT_OCCUPATIONS = [
  { id: 'OCC_IT_001', sector: 'IT/ITeS' },
  { id: 'OCC_IT_002', sector: 'IT/ITeS' },
  { id: 'OCC_IT_003', sector: 'IT/ITeS' },
  { id: 'OCC_MFG_001', sector: 'Manufacturing' },
  { id: 'OCC_MFG_002', sector: 'Manufacturing' },
  { id: 'OCC_MFG_003', sector: 'Manufacturing' },
  { id: 'OCC_LOG_001', sector: 'Logistics' },
  { id: 'OCC_LOG_002', sector: 'Logistics' },
  { id: 'OCC_LOG_003', sector: 'Logistics' },
];

const ROUTE_TO_PATH = {
  home: '/',
  login: '/login',
  signup: '/signup',
  workspace: '/workspace',
  career: '/career',
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
  '/login': 'login',
  '/signin': 'login',
  '/signup': 'signup',
  '/register': 'signup',
  '/workspace': 'workspace',
  '/my-workspace': 'workspace',
  '/career': 'career',
  '/profile': 'career',
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
  const { user, isAuthenticated, isDemo, isLoadingAuth, enterDemo } = useAuth();
  const [reopenedScenario, setReopenedScenario] = useState(null);
  const [activeTab, setActiveTab] = useState(getRouteFromLocation);
  const [period, setPeriod] = useState('2026-09');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking' });
  const [demandData, setDemandData] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [simulatorTarget, setSimulatorTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Global Context Filter State
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [occupationFilter, setOccupationFilter] = useState('');
  const [horizonFilter, setHorizonFilter] = useState(3);

  const handleStateChange = useCallback((newState) => {
    setStateFilter(newState);
    if (newState && districtFilter) {
      const match = PILOT_DISTRICTS.find((d) => d.id === districtFilter && d.state === newState);
      if (!match) setDistrictFilter('');
    }
  }, [districtFilter]);

  const handleSectorChange = useCallback((newSector) => {
    setSectorFilter(newSector);
    if (newSector && occupationFilter) {
      const match = PILOT_OCCUPATIONS.find((o) => o.id === occupationFilter && o.sector === newSector);
      if (!match) setOccupationFilter('');
    }
  }, [occupationFilter]);

  const handleResetFilters = useCallback(() => {
    setStateFilter('');
    setDistrictFilter('');
    setSectorFilter('');
    setOccupationFilter('');
    setHorizonFilter(3);
  }, []);

  // Synchronize browser history on route changes
  const handleNavigate = useCallback((tabId) => {
    setActiveTab(tabId);
    const targetPath = ROUTE_TO_PATH[tabId] || '/overview';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Context-aware deep-linking across modules
  const handleNavigateWithContext = useCallback((tabId, context = {}) => {
    if (context.state !== undefined) setStateFilter(context.state);
    if (context.district !== undefined) setDistrictFilter(context.district);
    if (context.sector !== undefined) setSectorFilter(context.sector);
    if (context.occupation !== undefined) setOccupationFilter(context.occupation);
    if (context.horizon !== undefined) setHorizonFilter(context.horizon);
    if (tabId === 'simulator') {
      setSimulatorTarget(context);
    }
    handleNavigate(tabId);
  }, [handleNavigate]);

  // Listen for browser forward/backward buttons
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Redirect authenticated user away from login/signup
  useEffect(() => {
    if ((activeTab === 'login' || activeTab === 'signup') && isAuthenticated) {
      handleNavigate('overview');
    }
  }, [activeTab, isAuthenticated, handleNavigate]);

  // Protect private workspace and career routes
  useEffect(() => {
    if ((activeTab === 'workspace' || activeTab === 'career') && !isLoadingAuth && !isAuthenticated && !isDemo) {
      handleNavigate('login');
    }
  }, [activeTab, isLoadingAuth, isAuthenticated, isDemo, handleNavigate]);


  // Initial and reactive data load on period change
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const healthRes = await fetchHealth();
        if (ignore) return;
        setBackendHealth(healthRes);

        const [demandRes, gapRes, alertsRes] = await Promise.all([
          fetchDemandIndex({ period, limit: 500 }),
          fetchGapAnalysis({ period, limit: 500 }),
          fetchAlerts({ period, limit: 500 }),
        ]);

        if (ignore) return;
        setDemandData(demandRes);
        setGapData(gapRes);
        setAlertsData(alertsRes);
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

      const [demandRes, gapRes, alertsRes] = await Promise.all([
        fetchDemandIndex({ period, limit: 500 }),
        fetchGapAnalysis({ period, limit: 500 }),
        fetchAlerts({ period, limit: 500 }),
      ]);

      setDemandData(demandRes);
      setGapData(gapRes);
      setAlertsData(alertsRes);
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

      const [demandRes, gapRes, alertsRes] = await Promise.all([
        fetchDemandIndex({ period, limit: 500 }),
        fetchGapAnalysis({ period, limit: 500 }),
        fetchAlerts({ period, limit: 500 }),
      ]);

      setDemandData(demandRes);
      setGapData(gapRes);
      setAlertsData(alertsRes);
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
        onEnterDashboard={() => {
          enterDemo();
          handleNavigate('overview');
        }}
        onNavigateToModule={handleNavigate}
        onNavigateToSimulatorWithContext={(district, occupation) =>
          handleNavigateWithContext('simulator', { district, occupation })
        }
        backendHealth={backendHealth}
      />
    );
  }

  // If activeTab is 'login', render dedicated Login page
  if (activeTab === 'login') {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onEnterDemo={() => {
          enterDemo();
          handleNavigate('overview');
        }}
      />
    );
  }

  // If activeTab is 'signup', render dedicated Sign Up page
  if (activeTab === 'signup') {
    return (
      <SignUpPage
        onNavigate={handleNavigate}
        onEnterDemo={() => {
          enterDemo();
          handleNavigate('overview');
        }}
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
        onOpenCopilot={() => setIsCopilotOpen(true)}
        alertsCount={alertsData?.results?.length}
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
          onOpenCopilot={() => setIsCopilotOpen(true)}
          isRefreshing={isRefreshing}
          backendHealth={backendHealth}
          onNavigate={handleNavigate}
        />

        {/* Dynamic Page Content */}
        <main className="page-content" style={{ padding: '1.25rem', overflowY: 'auto' }}>
          {/* Global Context Filter Bar for analytical pages */}
          {FILTERABLE_TABS.includes(activeTab) && (
            <ContextFilterBar
              stateFilter={stateFilter}
              districtFilter={districtFilter}
              sectorFilter={sectorFilter}
              occupationFilter={occupationFilter}
              horizonFilter={horizonFilter}
              showHorizon={activeTab === 'forecasts' || activeTab === 'alerts'}
              showOccupation={activeTab !== 'overview'}
              onStateChange={handleStateChange}
              onDistrictChange={setDistrictFilter}
              onSectorChange={handleSectorChange}
              onOccupationChange={setOccupationFilter}
              onHorizonChange={setHorizonFilter}
              onReset={handleResetFilters}
            />
          )}

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
                  alertsData={alertsData}
                  backendHealth={backendHealth}
                  period={period}
                  stateFilter={stateFilter}
                  districtFilter={districtFilter}
                  sectorFilter={sectorFilter}
                  onNavigate={handleNavigate}
                  onNavigateWithContext={handleNavigateWithContext}
                />
              )}
            </ErrorBoundary>
          )}

          {activeTab === 'demand' && (
            <ErrorBoundary moduleName="Demand Intelligence">
              <DemandIntelligence
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                stateFilter={stateFilter}
                districtFilter={districtFilter}
                sectorFilter={sectorFilter}
                occupationFilter={occupationFilter}
                onStateChange={handleStateChange}
                onDistrictChange={setDistrictFilter}
                onSectorChange={handleSectorChange}
                onOccupationChange={setOccupationFilter}
                onResetFilters={handleResetFilters}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'gap' && (
            <ErrorBoundary moduleName="Gap Analysis">
              <GapAnalysis
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                stateFilter={stateFilter}
                districtFilter={districtFilter}
                sectorFilter={sectorFilter}
                occupationFilter={occupationFilter}
                onStateChange={handleStateChange}
                onDistrictChange={setDistrictFilter}
                onSectorChange={handleSectorChange}
                onOccupationChange={setOccupationFilter}
                onResetFilters={handleResetFilters}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'forecasts' && (
            <ErrorBoundary moduleName="Forecasts">
              <Forecasts
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                stateFilter={stateFilter}
                districtFilter={districtFilter}
                sectorFilter={sectorFilter}
                occupationFilter={occupationFilter}
                horizonFilter={horizonFilter}
                onStateChange={handleStateChange}
                onDistrictChange={setDistrictFilter}
                onSectorChange={handleSectorChange}
                onOccupationChange={setOccupationFilter}
                onHorizonChange={setHorizonFilter}
                onResetFilters={handleResetFilters}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'alerts' && (
            <ErrorBoundary moduleName="Early-Warning Alerts">
              <EarlyWarningAlerts
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                stateFilter={stateFilter}
                districtFilter={districtFilter}
                sectorFilter={sectorFilter}
                occupationFilter={occupationFilter}
                horizonFilter={horizonFilter}
                onStateChange={handleStateChange}
                onDistrictChange={setDistrictFilter}
                onSectorChange={handleSectorChange}
                onOccupationChange={setOccupationFilter}
                onHorizonChange={setHorizonFilter}
                onResetFilters={handleResetFilters}
                onNavigateToSimulator={(dist, occ, h) =>
                  handleNavigateWithContext('simulator', { district: dist, occupation: occ, horizon: h })
                }
              />
            </ErrorBoundary>
          )}

          {activeTab === 'recommendations' && (
            <ErrorBoundary moduleName="Recommendations">
              <Recommendations
                period={period}
                onNavigateToSimulator={(_districtId, _occupationId) => {
                  handleNavigateWithContext('simulator', { district: _districtId, occupation: _occupationId });
                }}
                onNavigateWithContext={handleNavigateWithContext}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'simulator' && (
            <ErrorBoundary moduleName="Training-Seat Simulator">
              <SeatSimulator
                period={period}
                onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                initialDistrict={simulatorTarget?.district}
                initialOccupation={simulatorTarget?.occupation}
                initialHorizon={simulatorTarget?.horizon}
                initialScenario={reopenedScenario}
                onNavigate={handleNavigate}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'workspace' && (
            <ErrorBoundary moduleName="My Workspace">
              <MyWorkspace
                onNavigate={handleNavigate}
                onReopenScenario={(scenario) => {
                  setReopenedScenario(scenario);
                  handleNavigate('simulator');
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'career' && (
            <ErrorBoundary moduleName="Career Profile">
              <CareerProfilePage onNavigate={handleNavigate} />
            </ErrorBoundary>
          )}

          {activeTab === 'districts' && (
            <ErrorBoundary moduleName="Districts">
              <DistrictsExplorer
                gapData={gapData}
                period={period}
                onNavigateWithContext={handleNavigateWithContext}
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
            activeTab !== 'workspace' &&
            activeTab !== 'career' &&
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

      {/* Grounded Analytical Policy Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        gapData={gapData}
        demandData={demandData}
        alertsData={alertsData}
        period={period}
        onNavigateToTab={handleNavigate}
        onNavigateWithContext={handleNavigateWithContext}
      />
    </div>
  );
}
