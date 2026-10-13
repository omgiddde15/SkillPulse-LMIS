import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';

/**
 * ForecastTimeSeriesChart
 *
 * Full time-series visualization plotting authentic monthly historical observations
 * (marked as synthetic), history-cutoff divider, future point forecast,
 * and empirical 80% prediction interval error bounds.
 */
export default function ForecastTimeSeriesChart({
  historicalSeries = [],
  pointForecast = null,
  predictionIntervalLower = null,
  predictionIntervalUpper = null,
  basePeriod = '2026-09',
  targetPeriod = '2026-12',
  horizonMonths = 3,
  modelSelected = 'linear_trend',
  backtestMae = null,
  backtestWape = null,
  quantityTitle = 'Job-Posting Demand',
  unit = 'postings',
  isPostings = true,
  color = '#0d9488', // teal-600
  accentColor = '#115e59', // teal-800
}) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const svgWidth = 720;
  const svgHeight = 270;
  const margin = { top: 32, right: 48, bottom: 48, left: 60 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const timelineData = useMemo(() => {
    if (!historicalSeries || historicalSeries.length === 0) return null;

    const hist = historicalSeries.map((d) => ({
      period: d.period,
      value: Number(d.value),
      isForecast: false,
    }));

    const forecastPt = {
      period: targetPeriod,
      value: pointForecast != null ? Number(pointForecast) : null,
      isForecast: true,
      lower: predictionIntervalLower != null ? Number(predictionIntervalLower) : null,
      upper: predictionIntervalUpper != null ? Number(predictionIntervalUpper) : null,
    };

    const histVals = hist.map((d) => d.value);
    const allVals = [...histVals];
    if (forecastPt.value != null) allVals.push(forecastPt.value);
    if (forecastPt.lower != null) allVals.push(forecastPt.lower);
    if (forecastPt.upper != null) allVals.push(forecastPt.upper);

    const minRaw = Math.min(...allVals);
    const maxRaw = Math.max(...allVals);
    const rangeSpan = maxRaw - minRaw || 10;
    const yMin = Math.max(0, Math.floor(minRaw - rangeSpan * 0.15));
    const yMax = Math.ceil(maxRaw + rangeSpan * 0.15);

    const periodsList = hist.map((d) => d.period);
    if (!periodsList.includes(targetPeriod)) {
      periodsList.push(targetPeriod);
    }

    return {
      hist,
      forecastPt,
      yMin,
      yMax,
      periodsList,
    };
  }, [historicalSeries, pointForecast, predictionIntervalLower, predictionIntervalUpper, targetPeriod]);

  if (!timelineData || timelineData.hist.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.85rem' }}>
        {isHindi ? 'समय-श्रृंखला डेटा लोड हो रहा है...' : 'Loading time-series observation data...'}
      </div>
    );
  }

  const { hist, forecastPt, yMin, yMax, periodsList } = timelineData;

  const getX = (periodStr) => {
    const idx = periodsList.indexOf(periodStr);
    if (idx === -1) return margin.left;
    return margin.left + (idx / (periodsList.length - 1)) * chartWidth;
  };

  const getY = (val) => {
    if (val == null) return margin.top + chartHeight;
    const ratio = (val - yMin) / (yMax - yMin || 1);
    return margin.top + chartHeight - ratio * chartHeight;
  };

  const histPoints = hist.map((d) => ({
    ...d,
    x: getX(d.period),
    y: getY(d.value),
  }));

  const histLinePath = histPoints.reduce((acc, pt, i) => {
    return `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const lastHistPoint = histPoints[histPoints.length - 1];

  const histAreaPath = `${histLinePath} L ${lastHistPoint.x.toFixed(1)} ${(margin.top + chartHeight).toFixed(1)} L ${histPoints[0].x.toFixed(1)} ${(margin.top + chartHeight).toFixed(1)} Z`;

  const forecastX = getX(targetPeriod);
  const forecastY = forecastPt.value != null ? getY(forecastPt.value) : null;
  const forecastLowerY = forecastPt.lower != null ? getY(forecastPt.lower) : null;
  const forecastUpperY = forecastPt.upper != null ? getY(forecastPt.upper) : null;

  const cutoffX = getX(basePeriod);

  const yTicks = [0, 1, 2, 3, 4].map((step) => {
    const val = yMin + (step / 4) * (yMax - yMin);
    return {
      value: isPostings ? Math.round(val) : Number(val.toFixed(1)),
      y: getY(val),
    };
  });

  const xTicks = periodsList
    .map((p, idx) => ({ period: p, idx, x: getX(p) }))
    .filter((d, i) => i % 5 === 0 || d.period === basePeriod || d.period === targetPeriod);

  const getModelDisplayName = (m) => {
    switch (m) {
      case 'linear_trend': return isHindi ? 'रैखिक प्रवृत्ति मॉडल (Linear Trend)' : 'Linear Trend Model';
      case 'ma3': return isHindi ? '3-माह गतिमान औसत (3M MA)' : '3-Month Moving Average';
      case 'naive': return isHindi ? 'अंतिम-प्रेक्षण (Naive)' : 'Last-Observation (Naive)';
      default: return m || 'Deterministic Baseline';
    }
  };

  return (
    <div className="forecast-timeseries-container" style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', padding: '1rem', marginTop: '0.75rem' }}>
      {/* Chart Top Header Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="trending-up" size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>{quantityTitle}</span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {isHindi ? '24-माह इतिहास + पूर्वानुमान' : '24M History + Forecast'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            {isHindi ? 'चयनित मॉडल:' : 'Model:'} <strong>{getModelDisplayName(modelSelected)}</strong> • {isHindi ? 'क्षितिज:' : 'Horizon:'} <strong>+{horizonMonths}M ({targetPeriod})</strong>
            {backtestMae != null && (
              <span> • MAE = {Number(backtestMae).toFixed(2)} {unit}</span>
            )}
            {backtestWape != null && (
              <span> • WAPE = {(Number(backtestWape) * 100).toFixed(1)}%</span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '3px', backgroundColor: color, display: 'inline-block' }} />
            <span>{isHindi ? 'प्रेक्षित इतिहास (सिंथेटिक)' : 'Observed History (Synthetic)'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '2px', borderTop: `2px dashed ${color}`, display: 'inline-block' }} />
            <span style={{ width: '7px', height: '7px', backgroundColor: 'var(--bg-surface)', border: `2px solid ${accentColor}`, borderRadius: '50%', display: 'inline-block' }} />
            <span>{isHindi ? 'बिंदु पूर्वानुमान' : 'Point Forecast'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: color, opacity: 0.25, display: 'inline-block', borderRadius: '2px' }} />
            <span>{isHindi ? '80% अनिश्चितता अंतराल' : '80% Prediction Interval'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '0', borderTop: '2px dashed #f59e0b', display: 'inline-block' }} />
            <span>{isHindi ? 'कटऑफ' : 'Cutoff'}</span>
          </span>
        </div>
      </div>

      {/* SVG Time-Series Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', minWidth: '580px', display: 'block' }}
        >
          <defs>
            <linearGradient id={`areaGrad-${isPostings ? 'postings' : 'certs'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Y-Gridlines */}
          {yTicks.map((t) => (
            <g key={t.value}>
              <line
                x1={margin.left}
                y1={t.y}
                x2={margin.left + chartWidth}
                y2={t.y}
                stroke="var(--border-subtle)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={margin.left - 8}
                y={t.y + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--text-muted)"
              >
                {t.value}
              </text>
            </g>
          ))}

          {/* Area Fill Under Historical Line */}
          <path d={histAreaPath} fill={`url(#areaGrad-${isPostings ? 'postings' : 'certs'})`} />

          {/* Solid Historical Trend Line */}
          <path
            d={histLinePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Historical Observation Point Dots */}
          {histPoints.map((pt) => {
            const isHovered = hoveredPoint?.period === pt.period;
            return (
              <circle
                key={pt.period}
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5 : 2.5}
                fill={isHovered ? accentColor : color}
                stroke="#ffffff"
                strokeWidth={isHovered ? 2 : 1}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredPoint({ ...pt, label: isHindi ? 'प्रेक्षित (सिंथेटिक)' : 'Observed (Synthetic)' })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* Vertical History Cutoff Divider Line */}
          <line
            x1={cutoffX}
            y1={margin.top - 8}
            x2={cutoffX}
            y2={margin.top + chartHeight}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Cutoff Marker Badge */}
          <g transform={`translate(${cutoffX}, ${margin.top - 12})`}>
            <rect
              x="-42"
              y="-12"
              width="84"
              height="16"
              rx="4"
              fill="#f59e0b"
              fillOpacity="0.16"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="var(--status-demand-text)"
            >
              {isHindi ? `कटऑफ (${basePeriod})` : `Cutoff (${basePeriod})`}
            </text>
          </g>

          {/* Forecast Area / Projection */}
          {forecastY != null && (
            <>
              <line
                x1={lastHistPoint.x}
                y1={lastHistPoint.y}
                x2={forecastX}
                y2={forecastY}
                stroke={color}
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {forecastLowerY != null && forecastUpperY != null && (
                <g>
                  <rect
                    x={forecastX - 8}
                    y={forecastUpperY}
                    width="16"
                    height={Math.max(2, forecastLowerY - forecastUpperY)}
                    rx="3"
                    fill={color}
                    opacity="0.22"
                  />

                  <line
                    x1={forecastX}
                    y1={forecastLowerY}
                    x2={forecastX}
                    y2={forecastUpperY}
                    stroke={accentColor}
                    strokeWidth="2.5"
                  />

                  <line
                    x1={forecastX - 6}
                    y1={forecastLowerY}
                    x2={forecastX + 6}
                    y2={forecastLowerY}
                    stroke={accentColor}
                    strokeWidth="2"
                  />

                  <line
                    x1={forecastX - 6}
                    y1={forecastUpperY}
                    x2={forecastX + 6}
                    y2={forecastUpperY}
                    stroke={accentColor}
                    strokeWidth="2"
                  />

                  <text
                    x={forecastX + 12}
                    y={forecastUpperY + 3}
                    fontSize="9"
                    fontWeight="600"
                    fill="var(--text-secondary)"
                    fontFamily="var(--font-mono)"
                  >
                    {isPostings ? Math.round(forecastPt.upper) : forecastPt.upper?.toFixed(1)}
                  </text>
                  <text
                    x={forecastX + 12}
                    y={forecastLowerY + 3}
                    fontSize="9"
                    fontWeight="600"
                    fill="var(--text-secondary)"
                    fontFamily="var(--font-mono)"
                  >
                    {isPostings ? Math.round(forecastPt.lower) : forecastPt.lower?.toFixed(1)}
                  </text>
                </g>
              )}

              <circle
                cx={forecastX}
                cy={forecastY}
                r={hoveredPoint?.period === targetPeriod ? 6.5 : 5}
                fill="#ffffff"
                stroke={accentColor}
                strokeWidth="3"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() =>
                  setHoveredPoint({
                    period: targetPeriod,
                    value: forecastPt.value,
                    lower: forecastPt.lower,
                    upper: forecastPt.upper,
                    x: forecastX,
                    y: forecastY,
                    label: isHindi ? `पूर्वानुमान (+${horizonMonths}M)` : `Forecast (+${horizonMonths}M)`,
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              />

              <g transform={`translate(${forecastX}, ${forecastY - 14})`}>
                <rect
                  x="-28"
                  y="-12"
                  width="56"
                  height="15"
                  rx="3"
                  fill={accentColor}
                />
                <text
                  x="0"
                  y="-1"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#ffffff"
                  fontFamily="var(--font-mono)"
                >
                  {isPostings ? Math.round(forecastPt.value) : forecastPt.value?.toFixed(1)}
                </text>
              </g>
            </>
          )}

          {/* X-Axis Horizontal Baseline */}
          <line
            x1={margin.left}
            y1={margin.top + chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="var(--border-strong)"
            strokeWidth="1.5"
          />

          {/* X-Axis Ticks & Period Labels */}
          {xTicks.map((t) => {
            const isTarget = t.period === targetPeriod;
            const isBase = t.period === basePeriod;
            return (
              <g key={t.period} transform={`translate(${t.x}, ${margin.top + chartHeight})`}>
                <line x1="0" y1="0" x2="0" y2="4" stroke="var(--border-strong)" strokeWidth="1" />
                <text
                  x="0"
                  y="16"
                  textAnchor="middle"
                  fontSize={isTarget || isBase ? '9.5' : '8.5'}
                  fontWeight={isTarget || isBase ? '700' : '500'}
                  fill={isTarget ? 'var(--accent-soft-text)' : isBase ? 'var(--status-demand-text)' : 'var(--text-secondary)'}
                  fontFamily="var(--font-mono)"
                >
                  {t.period}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Interactive Floating Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(svgWidth - 140, Math.max(margin.left, (hoveredPoint.x / svgWidth) * 100))}%`,
              top: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              color: '#ffffff',
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
              minWidth: '130px',
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.2rem', marginBottom: '0.25rem' }}>
              {hoveredPoint.period} • {hoveredPoint.label}
            </div>
            <div>
              {isHindi ? 'मान:' : 'Value:'} <strong>{isPostings ? Math.round(hoveredPoint.value) : Number(hoveredPoint.value).toFixed(1)}</strong> {unit}
            </div>
            {hoveredPoint.lower != null && hoveredPoint.upper != null && (
              <div style={{ fontSize: '0.65rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                80% Interval: [{isPostings ? Math.round(hoveredPoint.lower) : hoveredPoint.lower.toFixed(1)} – {isPostings ? Math.round(hoveredPoint.upper) : hoveredPoint.upper.toFixed(1)}]
              </div>
            )}
          </div>
        )}
      </div>

      {/* Uncertainty and Synthetic Data Disclaimer */}
      <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
        <Icon name="shield" size={13} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
        <em>
          <strong>{isHindi ? 'सिंथेटिक डेटा अस्वीकरण:' : 'Synthetic Data Disclosure:'}</strong> {isHindi
            ? 'ऐतिहासिक 24-माह प्रेक्षण (अक्टूबर 2024 - सितंबर 2026) SIH26246 बेंचमार्क प्रदर्शन डेटा हैं (आधिकारिक आंकड़े नहीं)। 80% प्रेडिक्शन इंटरवल बैकटेस्टिंग अवशिष्टों पर आधारित सांख्यिकीय मॉडल अनिश्चितता को दर्शाता है, गारंटी को नहीं।'
            : 'Historical 24-month observations (Oct 2024 – Sep 2026) are synthetic demonstration data for SIH26246 (not official statistics). The 80% prediction interval represents statistical uncertainty from rolling backtest residuals, not a guaranteed policy or market outcome.'}
        </em>
      </div>
    </div>
  );
}
