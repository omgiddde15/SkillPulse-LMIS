import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './components/Overview';
import DemandIntelligence from './components/DemandIntelligence';
import GapAnalysis from './components/GapAnalysis';
import Forecasts from './components/Forecasts';
import EarlyWarningAlerts from './components/EarlyWarningAlerts';
import SeatSimulator from './components/SeatSimulator';
import PlaceholderPage from './components/PlaceholderPage';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorAlert from './components/ErrorAlert';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchHealth, fetchDemandIndex, fetchGapAnalysis } from './api/client';
import { useLanguage } from './context/LanguageContext';

export default function App() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('2026-09');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking' });
  const [demandData, setDemandData] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Initial and reactive load on period change
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

  // Explicit user refresh trigger
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

  // Full retry from error state
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

  return (
    <div className="app-container">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        backendHealth={backendHealth}
      />

      {/* Main Content Area */}
      <div className="app-main">
        {/* Application Header */}
        <Header
          period={period}
          onPeriodChange={(newPeriod) => {
            setIsLoading(true);
            setPeriod(newPeriod);
          }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          backendHealth={backendHealth}
        />

        {/* Dynamic Page Content */}
        <main className="page-content">
          {activeTab === 'overview' && (
            <ErrorBoundary moduleName="Overview" onRetry={handleRetry}>
              {errorMessage ? (
                <ErrorAlert
                  message={errorMessage}
                  onRetry={handleRetry}
                />
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
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'gap' && (
            <ErrorBoundary moduleName="Gap Analysis">
              <GapAnalysis
                period={period}
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'forecasts' && (
            <ErrorBoundary moduleName="Forecasts">
              <Forecasts
                period={period}
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'alerts' && (
            <ErrorBoundary moduleName="Early-Warning Alerts">
              <EarlyWarningAlerts
                period={period}
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'simulator' && (
            <ErrorBoundary moduleName="Training-Seat Simulator">
              <SeatSimulator
                period={period}
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                }}
              />
            </ErrorBoundary>
          )}

          {activeTab !== 'overview' &&
            activeTab !== 'demand' &&
            activeTab !== 'gap' &&
            activeTab !== 'forecasts' &&
            activeTab !== 'alerts' &&
            activeTab !== 'simulator' && (
              <ErrorBoundary moduleName="Module">
                <PlaceholderPage moduleId={activeTab} />
              </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
