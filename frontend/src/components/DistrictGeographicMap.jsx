import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getDistrictDisplayName,
  getStateDisplayName,
} from '../i18n/translations';

/**
 * Directional anchor offsets to prevent any marker or label overlap
 * especially for geographically adjacent pairs:
 * - Mumbai Suburban (West) vs. Pune (Southeast)
 * - Medchal-Malkajgiri (North) vs. Hyderabad (South)
 */
const DISTRICT_ANCHOR_OFFSETS = {
  MH_MUM: { labelPos: 'left', offsetX: -110, offsetY: 2 },
  MH_PUN: { labelPos: 'right', offsetX: 36, offsetY: 8 },
  TS_MED: { labelPos: 'top', offsetX: -52, offsetY: -30 },
  TS_HYD: { labelPos: 'bottom', offsetX: -36, offsetY: 34 },
  KA_DHA: { labelPos: 'left', offsetX: -78, offsetY: 2 },
  KA_BLR_U: { labelPos: 'right', offsetX: 36, offsetY: 2 },
};

const formatScore = (val) => (val != null ? Number(val).toFixed(1) : 'N/A');
const formatMismatch = (val) => {
  if (val == null) return 'N/A';
  const num = Number(val);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}`;
};

const getClassificationBadge = (classification, isHindi = false) => {
  if (classification === 'Demand Pressure') {
    return {
      icon: '⚡',
      label: isHindi ? 'मांग दबाव' : 'Demand Pressure',
      color: '#c2410c',
      bg: '#fff7ed',
      border: '#ffedd5',
    };
  }
  if (classification === 'Supply Pressure') {
    return {
      icon: '📦',
      label: isHindi ? 'आपूर्ति दबाव' : 'Supply Pressure',
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#dbeafe',
    };
  }
  return {
    icon: '⚖️',
    label: isHindi ? 'संतुलित' : 'Balanced',
    color: '#475569',
    bg: '#f8fafc',
    border: '#e2e8f0',
  };
};

export default function DistrictGeographicMap({
  districts = [],
  selectedDistrictId = null,
  onSelectDistrict = () => {},
  period = '2026-09',
  isHindi = false,
  onSwitchToCharts = () => {},
  onExploreDistrict = () => {},
  gapRecords = [],
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersRef = useRef({});
  const failedTileCountRef = useRef(0);

  const [mapMode, setMapMode] = useState('basemap'); // 'basemap' | 'schematic'
  const [tilesOffline, setTilesOffline] = useState(false);
  const [intelligenceLayer, setIntelligenceLayer] = useState('shortage'); // 'shortage' | 'demand' | 'supply'

  // Active district metrics object
  const activeDistrict = districts.find((d) => d.id === selectedDistrictId);

  // Trades for selected district
  const districtGapItems = React.useMemo(() => {
    if (!activeDistrict || !gapRecords.length) return [];
    return gapRecords.filter((r) => r.district_id === activeDistrict.id);
  }, [activeDistrict, gapRecords]);

  const shortageTrades = React.useMemo(() => {
    return [...districtGapItems]
      .filter((r) => Number(r.relative_mismatch_score) > 0)
      .sort((a, b) => Number(b.relative_mismatch_score) - Number(a.relative_mismatch_score))
      .slice(0, 2);
  }, [districtGapItems]);

  const oversuppliedTrades = React.useMemo(() => {
    return [...districtGapItems]
      .filter((r) => Number(r.relative_mismatch_score) < 0)
      .sort((a, b) => Number(a.relative_mismatch_score) - Number(b.relative_mismatch_score))
      .slice(0, 2);
  }, [districtGapItems]);

  // Initialize Leaflet Interactive Basemap
  useEffect(() => {
    if (mapMode !== 'basemap' || !mapContainerRef.current) return;

    // Remove any previous map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    failedTileCountRef.current = 0;

    // Centered over South-Central India covering MH, KA, and TS
    const map = L.map(mapContainerRef.current, {
      center: [16.2, 75.8],
      zoom: 6,
      minZoom: 5,
      maxZoom: 13,
      scrollWheelZoom: false, // Prevents intercepting dashboard page scroll
    });

    mapInstanceRef.current = map;

    // Primary: OpenStreetMap standard tiles (Clean, reliable, no API key watermark)
    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }
    );

    osmLayer.on('tileerror', () => {
      failedTileCountRef.current += 1;
      // If repeated tile failures occur (e.g. offline environment), notify user
      if (failedTileCountRef.current >= 6) {
        setTilesOffline(true);
      }
    });

    osmLayer.on('load', () => {
      if (failedTileCountRef.current < 6) {
        setTilesOffline(false);
      }
    });

    osmLayer.addTo(map);

    // Feature group for markers
    const markersGroup = L.featureGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Use ResizeObserver to ensure Leaflet container size stays accurate
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    // Initial resize trigger
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapMode]);

  // Render Leaflet Markers with Directional Non-Overlapping Labels
  useEffect(() => {
    if (mapMode !== 'basemap') return;
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup || districts.length === 0) return;

    markersGroup.clearLayers();
    markersRef.current = {};

    districts.forEach((d) => {
      const isSelected = selectedDistrictId === d.id;
      const badge = getClassificationBadge(d.classification, isHindi);
      let pinColor = '#475569';
      if (intelligenceLayer === 'shortage') {
        const isDemand = d.classification === 'Demand Pressure';
        const isSupply = d.classification === 'Supply Pressure';
        pinColor = isDemand ? '#ea580c' : isSupply ? '#2563eb' : '#475569';
      } else if (intelligenceLayer === 'demand') {
        pinColor = d.avgDemand >= 60 ? '#ea580c' : d.avgDemand >= 40 ? '#0d9488' : '#64748b';
      } else if (intelligenceLayer === 'supply') {
        pinColor = d.avgSupply >= 60 ? '#2563eb' : d.avgSupply >= 40 ? '#0d9488' : '#64748b';
      }
      const cfg = DISTRICT_ANCHOR_OFFSETS[d.id] || { offsetX: 36, offsetY: 4 };

      // Custom DivIcon with directional label placement preventing collisions
      const markerHtml = `
        <div class="pilot-district-marker-anchor" style="position: relative; width: 32px; height: 32px; cursor: pointer;">
          <!-- Central Pin Bubble -->
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: ${pinColor};
            border: ${isSelected ? '3px solid #0d9488' : '2px solid #ffffff'};
            box-shadow: 0 3px 10px rgba(0,0,0,0.38);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            position: absolute;
            top: 0;
            left: 0;
            transition: transform 0.15s ease;
            ${isSelected ? 'transform: scale(1.18); z-index: 20;' : ''}
          ">
            ${badge.icon}
          </div>

          <!-- Directional Offset Label Badge (Never Collides) -->
          <div style="
            position: absolute;
            left: ${cfg.offsetX}px;
            top: ${cfg.offsetY}px;
            background-color: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.25);
            pointer-events: none;
            z-index: 10;
          ">
            ${getDistrictDisplayName(d.name, isHindi)}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'pilot-district-marker-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([d.lat, d.lon], { icon: customIcon });

      // Rich popup with full API metrics
      const popupContent = `
        <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="font-size: 14px; color: #0f172a;">${getDistrictDisplayName(d.name, isHindi)}</strong>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${getStateDisplayName(d.state, isHindi)}</span>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: ${badge.color}; background-color: ${badge.bg}; border: 1px solid ${badge.border}; margin-bottom: 8px;">
            <span>${badge.icon}</span>
            <span>${badge.label}</span>
            <span>(${formatMismatch(d.mismatch)} pts)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
            <tr>
              <td style="color: #64748b; padding: 2px 0;">${isHindi ? 'रिपोर्टिंग अवधि:' : 'Reporting Cycle:'}</td>
              <td style="text-align: right; font-weight: 600; font-family: monospace;">${period}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">${isHindi ? 'मांग सूचकांक:' : 'Demand Index:'}</td>
              <td style="text-align: right; font-weight: 700; color: #0f766e; font-family: monospace;">${formatScore(d.avgDemand)} pts</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">${isHindi ? 'आपूर्ति आउटपुट सूचकांक:' : 'Supply Output Index:'}</td>
              <td style="text-align: right; font-weight: 700; color: #475569; font-family: monospace;">${formatScore(d.avgSupply)} pts</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">${isHindi ? 'सापेक्ष असंतुलन:' : 'Relative Mismatch:'}</td>
              <td style="text-align: right; font-weight: 700; color: ${badge.color}; font-family: monospace;">${formatMismatch(d.mismatch)} pts</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">${isHindi ? 'स्थानिक निर्देशांक:' : 'Centroid Coordinates:'}</td>
              <td style="text-align: right; color: #64748b; font-family: monospace; font-size: 10px;">${d.lat.toFixed(2)}°N, ${d.lon.toFixed(2)}°E</td>
            </tr>
          </table>
          <div style="font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 4px;">
            ${isHindi ? 'तालिका फ़िल्टर करने के लिए क्लिक करें' : 'Click marker to filter table'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { offset: [0, -18] });

      marker.on('click', () => {
        onSelectDistrict(d.id);
        marker.openPopup();
      });

      markersGroup.addLayer(marker);
      markersRef.current[d.id] = marker;
    });

    // Ensure entire latitude span from Bengaluru (12.97°N) to Mumbai (19.08°N) fits comfortably
    if (districts.length > 0) {
      const southWest = L.latLng(12.0, 71.8);
      const northEast = L.latLng(19.8, 79.5);
      map.fitBounds(L.latLngBounds(southWest, northEast), {
        paddingTopLeft: [25, 25],
        paddingBottomRight: [25, 25],
        maxZoom: 7,
      });
    }
  }, [districts, mapMode, period, isHindi, onSelectDistrict, selectedDistrictId, intelligenceLayer]);

  // Synchronize Leaflet popup with selectedDistrictId
  useEffect(() => {
    if (mapMode !== 'basemap') return;
    if (!selectedDistrictId) {
      mapInstanceRef.current?.closePopup();
      return;
    }
    const targetMarker = markersRef.current[selectedDistrictId];
    if (targetMarker && mapInstanceRef.current) {
      targetMarker.openPopup();
    }
  }, [selectedDistrictId, mapMode]);

  // Schematic SVG Map Coordinate Projection Helpers
  // Bounding Box: Lon 71.5°E to 80.5°E (9° span), Lat 12.0°N to 20.5°N (8.5° span)
  const svgW = 680;
  const svgH = 480;
  const projX = (lon) => 50 + ((lon - 71.5) / 9.0) * (svgW - 100);
  const projY = (lat) => 35 + ((20.5 - lat) / 8.5) * (svgH - 70);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      {/* Top Map Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              🗺️ {isHindi ? 'पायलट ज़िला भौगोलिक मानचित्र (कर्नाटक, महाराष्ट्र, तेलंगाना)' : 'Pilot District Geographic Map (Karnataka, Maharashtra, Telangana)'}
            </h3>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(13, 148, 136, 0.15)', color: '#2dd4bf', border: '1px solid rgba(13, 148, 136, 0.35)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {isHindi ? '6 ज़िला केंद्रक • 3 राज्य' : '6 District Centroids • 3 States'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            {isHindi
              ? 'आधिकारिक भौगोलिक केंद्रक (अक्षांश/देशांतर) पर स्थित 6 पायलट ज़िले। सभी मार्कर और लेबल ओवरलैप-रहित संरेखित हैं।'
              : 'Authentic pilot district locations plotted at official centroid coordinates. Directional labels prevent overlap.'}
          </p>
        </div>

        {/* Map View Mode Switcher + Intelligence Layer + Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Intelligence Layer Switcher */}
          <div style={{ display: 'inline-flex', backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94a3b8', padding: '0.2rem 0.35rem', alignSelf: 'center' }}>
              LAYER:
            </span>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: intelligenceLayer === 'shortage' ? 'rgba(234, 88, 12, 0.25)' : 'transparent',
                color: intelligenceLayer === 'shortage' ? '#fb923c' : '#94a3b8',
                fontWeight: intelligenceLayer === 'shortage' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIntelligenceLayer('shortage')}
            >
              {isHindi ? 'असंतुलन' : 'Shortage Severity'}
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: intelligenceLayer === 'demand' ? 'rgba(13, 148, 136, 0.25)' : 'transparent',
                color: intelligenceLayer === 'demand' ? '#2dd4bf' : '#94a3b8',
                fontWeight: intelligenceLayer === 'demand' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIntelligenceLayer('demand')}
            >
              {isHindi ? 'मांग' : 'Demand Intensity'}
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: intelligenceLayer === 'supply' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                color: intelligenceLayer === 'supply' ? '#93c5fd' : '#94a3b8',
                fontWeight: intelligenceLayer === 'supply' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIntelligenceLayer('supply')}
            >
              {isHindi ? 'आपूर्ति' : 'Effective Supply'}
            </button>
          </div>

          {/* Mode Toggle: Basemap vs Schematic */}
          <div style={{ display: 'inline-flex', backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: mapMode === 'basemap' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                color: mapMode === 'basemap' ? '#ffffff' : '#94a3b8',
                fontWeight: mapMode === 'basemap' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setMapMode('basemap')}
            >
              🌐 {isHindi ? 'इंटरैक्टिव बेसमैप' : 'Basemap'}
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: mapMode === 'schematic' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                color: mapMode === 'schematic' ? '#ffffff' : '#94a3b8',
                fontWeight: mapMode === 'schematic' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setMapMode('schematic')}
            >
              📍 {isHindi ? 'स्थानिक लोकेशन' : 'Schematic'}
            </button>
          </div>

          {/* Classification Legend */}
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: '#cbd5e1', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
              <span>⚡ {isHindi ? 'मांग दबाव' : 'Demand Pressure'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
              <span>⚖️ {isHindi ? 'संतुलित' : 'Balanced'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }} />
              <span>📦 {isHindi ? 'आपूर्ति दबाव' : 'Supply Pressure'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Offline Alert with Quick Switcher if Basemap tiles fail */}
      {tilesOffline && mapMode === 'basemap' && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            ⚠️ {isHindi
              ? 'नेटवर्क टाइल सर्वर धीमी प्रतिक्रिया दे रहा है। आप नीचे दिए गए बटन से स्थानिक लोकेशन मैप पर स्विच कर सकते हैं।'
              : 'Network map tile server is slow or unavailable. You can switch to the self-contained Schematic Location Map.'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setMapMode('schematic')}
              style={{ border: 'none', backgroundColor: '#d97706', color: '#ffffff', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}
            >
              📍 {isHindi ? 'लोकेशन मैप देखें' : 'View Location Map'}
            </button>
            <button
              type="button"
              onClick={onSwitchToCharts}
              style={{ border: 'none', background: 'none', color: '#b45309', fontWeight: 600, cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}
            >
              {isHindi ? 'तुलनात्मक चार्ट पर जाएं' : 'Comparison Charts'}
            </button>
          </div>
        </div>
      )}

      {/* Main Map Canvas + Selected Inspector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: activeDistrict ? '1fr 310px' : '1fr', gap: '1rem', alignItems: 'stretch' }}>
        {/* VIEW A: Interactive Leaflet Basemap */}
        {mapMode === 'basemap' && (
          <div
            ref={mapContainerRef}
            style={{
              height: '520px',
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--slate-300)',
              backgroundColor: '#f1f5f9',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
              position: 'relative',
              zIndex: 1,
            }}
          />
        )}

        {/* VIEW B: Self-Contained Geographically Proportionate Location Map (Schematic Mode) */}
        {mapMode === 'schematic' && (
          <div
            style={{
              height: '520px',
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--slate-300)',
              backgroundColor: '#f8fafc',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* SVG Geographical Location Canvas */}
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              style={{ width: '100%', height: '100%', display: 'block', backgroundColor: '#f1f5f9' }}
            >
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
                {/* Subtle drop shadow for pins */}
                <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Background grid */}
              <rect width={svgW} height={svgH} fill="url(#gridPattern)" />

              {/* Arabian Sea Coastal Indicator on the West */}
              <path
                d={`M 0,0 L ${projX(72.7)},0 L ${projX(72.8)},${projY(19.0)} L ${projX(73.5)},${projY(15.5)} L ${projX(74.5)},${svgH} L 0,${svgH} Z`}
                fill="#e0f2fe"
                opacity="0.55"
              />
              <text x="25" y={svgH - 25} fill="#0284c7" fontSize="11" fontWeight="700" letterSpacing="0.08em" opacity="0.8">
                ARABIAN SEA
              </text>

              {/* Geographically Proportionate State Regional Zones (Schematic Location Context) */}
              {/* Maharashtra Zone (North / Northwest) */}
              <path
                d={`M ${projX(72.8)},${projY(19.5)} L ${projX(79.5)},${projY(20.2)} L ${projX(80.2)},${projY(18.5)} L ${projX(76.5)},${projY(17.8)} L ${projX(73.5)},${projY(16.5)} Z`}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <text x={projX(76.0)} y={projY(19.2)} fill="#64748b" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                MAHARASHTRA (MH)
              </text>

              {/* Karnataka Zone (South / Southwest) */}
              <path
                d={`M ${projX(73.8)},${projY(16.2)} L ${projX(77.2)},${projY(17.5)} L ${projX(78.2)},${projY(13.5)} L ${projX(76.5)},${projY(12.2)} L ${projX(74.5)},${projY(14.2)} Z`}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <text x={projX(75.8)} y={projY(14.2)} fill="#64748b" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                KARNATAKA (KA)
              </text>

              {/* Telangana Zone (East / Central-East) */}
              <path
                d={`M ${projX(77.4)},${projY(18.8)} L ${projX(80.5)},${projY(18.5)} L ${projX(79.8)},${projY(16.2)} L ${projX(77.5)},${projY(16.2)} Z`}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <text x={projX(79.0)} y={projY(17.2)} fill="#64748b" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                TELANGANA (TS)
              </text>

              {/* Latitude / Longitude Grid Markings */}
              {[14, 16, 18, 20].map((lat) => (
                <g key={`lat-${lat}`}>
                  <line x1="45" y1={projY(lat)} x2={svgW - 25} y2={projY(lat)} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x="35" y={projY(lat) + 4} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
                    {lat}°N
                  </text>
                </g>
              ))}
              {[73, 75, 77, 79].map((lon) => (
                <g key={`lon-${lon}`}>
                  <line x1={projX(lon)} y1="30" x2={projX(lon)} y2={svgH - 30} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={projX(lon)} y={svgH - 12} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">
                    {lon}°E
                  </text>
                </g>
              ))}

              {/* The Six Verified Pilot District Centroid Pins */}
              {districts.map((d) => {
                const px = projX(d.lon);
                const py = projY(d.lat);
                const isSelected = selectedDistrictId === d.id;
                let pinColor = '#475569';
                if (intelligenceLayer === 'shortage') {
                  const isDemand = d.classification === 'Demand Pressure';
                  const isSupply = d.classification === 'Supply Pressure';
                  pinColor = isDemand ? '#ea580c' : isSupply ? '#2563eb' : '#475569';
                } else if (intelligenceLayer === 'demand') {
                  pinColor = d.avgDemand >= 60 ? '#ea580c' : d.avgDemand >= 40 ? '#0d9488' : '#64748b';
                } else if (intelligenceLayer === 'supply') {
                  pinColor = d.avgSupply >= 60 ? '#2563eb' : d.avgSupply >= 40 ? '#0d9488' : '#64748b';
                }
                const cfg = DISTRICT_ANCHOR_OFFSETS[d.id] || { offsetX: 20, offsetY: 0 };

                // Directional label text anchor & box
                const labelX = px + cfg.offsetX;
                const labelY = py + cfg.offsetY;

                return (
                  <g
                    key={d.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectDistrict(isSelected ? null : d.id)}
                  >
                    {/* Leader Line connecting Pin to Label */}
                    <line
                      x1={px}
                      y1={py}
                      x2={labelX + 30}
                      y2={labelY + 8}
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />

                    {/* District Pin Bubble */}
                    <circle
                      cx={px}
                      cy={py}
                      r={isSelected ? 16 : 14}
                      fill={pinColor}
                      stroke={isSelected ? '#0d9488' : '#ffffff'}
                      strokeWidth={isSelected ? 3 : 2}
                      filter="url(#pinShadow)"
                    />
                    <text
                      x={px}
                      y={py + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {badge.icon}
                    </text>

                    {/* Directional Non-Overlapping Label Badge */}
                    <rect
                      x={labelX - 4}
                      y={labelY - 5}
                      width={getDistrictDisplayName(d.name, isHindi).length * 8 + 18}
                      height="20"
                      rx="4"
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke={isSelected ? '#0d9488' : 'rgba(255,255,255,0.3)'}
                      strokeWidth="1"
                    />
                    <text
                      x={labelX + 5}
                      y={labelY + 9}
                      fill="#ffffff"
                      fontSize="10.5"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {getDistrictDisplayName(d.name, isHindi)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Schematic Provenance Notice Strip */}
            <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid var(--slate-200)', padding: '0.35rem 0.75rem', fontSize: '0.68rem', color: 'var(--slate-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                📍 {isHindi ? 'स्थानिक क्षेत्रीय लोकेशन मैप (सटीक अक्षांश/देशांतर केंद्रक • आधिकारिक सीमा नहीं)' : 'Schematic Regional Location Map (Geographically Proportionate Centroids • Not an Official Boundary Map)'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>12.0°N–20.5°N, 71.5°E–80.5°E</span>
            </div>
          </div>
        )}

        {/* Selected District Detail Card (Sidebar) */}
        {activeDistrict && (
          <div style={{ backgroundColor: '#ffffff', border: '2px solid var(--teal-600)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--slate-100)', paddingBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {isHindi ? 'सक्रिय चयनित ज़िला' : 'Selected District'}
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-900)', margin: '0.1rem 0 0 0' }}>
                  📍 {getDistrictDisplayName(activeDistrict.name, isHindi)}
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-600)' }}>
                  {getStateDisplayName(activeDistrict.state, isHindi)} • ID: {activeDistrict.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectDistrict(null)}
                style={{ border: 'none', background: 'none', color: 'var(--slate-400)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}
                title={isHindi ? 'चयन हटाएं' : 'Clear selection'}
              >
                ✕
              </button>
            </div>

            {/* Classification Badge */}
            <div>
              {(() => {
                const b = getClassificationBadge(activeDistrict.classification, isHindi);
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, color: b.color, backgroundColor: b.bg, border: `1px solid ${b.border}` }}>
                    <span>{b.icon}</span>
                    <span>{b.label}</span>
                    <span>({formatMismatch(activeDistrict.mismatch)} pts)</span>
                  </span>
                );
              })()}
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--slate-50)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--slate-200)', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-600)' }}>{isHindi ? 'रिपोर्टिंग अवधि:' : 'Reporting Cycle:'}</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{period}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-600)' }}>{isHindi ? 'औसत मांग सूचकांक:' : 'Avg Demand Index:'}</span>
                <strong style={{ color: 'var(--teal-800)', fontFamily: 'var(--font-mono)' }}>{formatScore(activeDistrict.avgDemand)} pts</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-600)' }}>{isHindi ? 'औसत आपूर्ति सूचकांक:' : 'Avg Supply Index:'}</span>
                <strong style={{ color: '#475569', fontFamily: 'var(--font-mono)' }}>{formatScore(activeDistrict.avgSupply)} pts</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-600)' }}>{isHindi ? 'सापेक्ष असंतुलन स्कोर:' : 'Relative Mismatch:'}</span>
                <strong style={{ color: getClassificationBadge(activeDistrict.classification, isHindi).color, fontFamily: 'var(--font-mono)' }}>
                  {formatMismatch(activeDistrict.mismatch)} pts
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--slate-200)', paddingTop: '0.35rem' }}>
                <span style={{ color: 'var(--slate-500)', fontSize: '0.7rem' }}>{isHindi ? 'केंद्रक निर्देशांक:' : 'Centroid Lat/Lon:'}</span>
                <span style={{ color: 'var(--slate-600)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                  {activeDistrict.lat.toFixed(2)}° N, {activeDistrict.lon.toFixed(2)}° E
                </span>
              </div>
            </div>

            {/* Top Shortage Trades */}
            {shortageTrades.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>⚡</span>
                  <span>{isHindi ? 'शीर्ष कमी वाले ट्रेड:' : 'TOP SHORTAGE TRADES:'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {shortageTrades.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0.25rem 0.5rem', backgroundColor: '#fff7ed', borderRadius: '4px', border: '1px solid #ffedd5' }}>
                      <span style={{ fontWeight: 600, color: '#9a3412', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {t.occupation_title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#c2410c', fontSize: '0.68rem' }}>
                        +{Number(t.relative_mismatch_score).toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Oversupplied Trades */}
            {oversuppliedTrades.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>📦</span>
                  <span>{isHindi ? 'अधिशेष आपूर्ति वाले ट्रेड:' : 'OVERSUPPLIED TRADES:'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {oversuppliedTrades.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0.25rem 0.5rem', backgroundColor: '#eff6ff', borderRadius: '4px', border: '1px solid #dbeafe' }}>
                      <span style={{ fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {t.occupation_title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', fontSize: '0.68rem' }}>
                        {Number(t.relative_mismatch_score).toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Active Notice */}
            <div style={{ fontSize: '0.72rem', color: 'var(--teal-800)', backgroundColor: '#f0fdfa', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>✓</span>
              <span>{isHindi ? 'नीचे दी गई तालिका इस ज़िले के लिए फ़िल्टर की गई है।' : 'Rankings table below is filtered to this district.'}</span>
            </div>

            {/* Explore Complete Dossier Button */}
            {onExploreDistrict && (
              <button
                type="button"
                onClick={() => onExploreDistrict(activeDistrict.id)}
                style={{
                  width: '100%',
                  backgroundColor: '#0d9488',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0d9488')}
              >
                {isHindi ? `${getDistrictDisplayName(activeDistrict.name, isHindi)} पूर्ण डॉसियर देखें →` : `Explore Complete ${activeDistrict.name} Dossier →`}
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectDistrict(null)}
              style={{ border: '1px solid var(--slate-300)', backgroundColor: '#ffffff', color: 'var(--slate-700)', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem' }}
            >
              ✕ {isHindi ? 'फ़िल्टर हटाएं (सभी ज़िले देखें)' : 'Clear Filter (Show All Districts)'}
            </button>
          </div>
        )}
      </div>

      {/* Cartographic & Boundary Provenance Disclosure */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', fontSize: '0.72rem', color: '#92400e', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
          <span>ℹ️</span>
          <span>{isHindi ? 'मानचित्र स्रोत एवं सीमा प्रकटीकरण:' : 'Cartographic Provenance & Boundary Notice:'}</span>
        </div>
        <div>
          {isHindi
            ? 'मानचित्र ओपनस्ट्रीटमैप टाइल्स का उपयोग करता है। मार्कर 6 पायलट ज़िलों (पुणे, मुंबई उपनगर, बेंगलुरु शहरी, धारवाड़, हैदराबाद, मेडचल-मलकाजगिरि) के आधिकारिक केंद्रक निर्देशांकों का प्रतिनिधित्व करते हैं। मनगढ़ंत या अनुमानित सीमाएं खींचने से बचने के लिए ज़िला बहुभुज सीमाएं नहीं बनाई गई हैं। प्रदर्शित असंतुलन स्कोर सापेक्ष क्रॉस-सेक्शनल पर्सेंटाइल अंतर हैं।'
            : 'Basemap rendered via OpenStreetMap contributors. Markers represent official centroid locations for the six pilot districts across Maharashtra, Karnataka, and Telangana. Individual district boundary polygons are omitted to avoid unverified or approximate GIS geometry. Mismatch scores indicate relative cross-sectional percentile differences, not headcount deficits.'}
        </div>
      </div>
    </div>
  );
}
