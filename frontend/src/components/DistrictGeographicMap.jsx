import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getDistrictDisplayName,
  getStateDisplayName,
} from '../i18n/translations';
import Icon from './Icon';

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
      iconName: 'zap',
      markerCode: 'D',
      label: isHindi ? 'मांग दबाव' : 'Demand Pressure',
      color: 'var(--status-demand-text)',
      bg: 'var(--status-demand-bg)',
      border: 'var(--status-demand-border)',
      hexColor: '#c2410c',
      hexBg: '#fff7ed',
      hexBorder: '#ffedd5',
    };
  }
  if (classification === 'Supply Pressure') {
    return {
      iconName: 'package',
      markerCode: 'S',
      label: isHindi ? 'आपूर्ति दबाव' : 'Supply Pressure',
      color: 'var(--status-supply-text)',
      bg: 'var(--status-supply-bg)',
      border: 'var(--status-supply-border)',
      hexColor: '#1d4ed8',
      hexBg: '#eff6ff',
      hexBorder: '#dbeafe',
    };
  }
  return {
    iconName: 'scale',
    markerCode: 'B',
    label: isHindi ? 'संतुलित' : 'Balanced',
    color: 'var(--text-secondary)',
    bg: 'var(--bg-subtle)',
    border: 'var(--border-subtle)',
    hexColor: '#475569',
    hexBg: '#f8fafc',
    hexBorder: '#e2e8f0',
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

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    failedTileCountRef.current = 0;

    const map = L.map(mapContainerRef.current, {
      center: [16.2, 75.8],
      zoom: 6,
      minZoom: 5,
      maxZoom: 13,
      scrollWheelZoom: false,
    });

    mapInstanceRef.current = map;

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

    const markersGroup = L.featureGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

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

      const markerHtml = `
        <div class="pilot-district-marker-anchor" style="position: relative; width: 32px; height: 32px; cursor: pointer;">
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
            font-size: 12px;
            font-weight: 800;
            font-family: monospace;
            position: absolute;
            top: 0;
            left: 0;
            transition: transform 0.15s ease;
            ${isSelected ? 'transform: scale(1.18); z-index: 20;' : ''}
          ">
            ${badge.markerCode}
          </div>

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

      const popupContent = `
        <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="font-size: 14px; color: #0f172a;">${getDistrictDisplayName(d.name, isHindi)}</strong>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${getStateDisplayName(d.state, isHindi)}</span>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: ${badge.hexColor}; background-color: ${badge.hexBg}; border: 1px solid ${badge.hexBorder}; margin-bottom: 8px;">
            <span>[${badge.markerCode}]</span>
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
              <td style="text-align: right; font-weight: 700; color: ${badge.hexColor}; font-family: monospace;">${formatMismatch(d.mismatch)} pts</td>
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

  const svgW = 680;
  const svgH = 480;
  const projX = (lon) => 50 + ((lon - 71.5) / 9.0) * (svgW - 100);
  const projY = (lat) => 35 + ((20.5 - lat) / 8.5) * (svgH - 70);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      {/* Top Map Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="map" size={16} />
              <span>{isHindi ? 'पायलट ज़िला भौगोलिक मानचित्र (कर्नाटक, महाराष्ट्र, तेलंगाना)' : 'Pilot District Geographic Map (Karnataka, Maharashtra, Telangana)'}</span>
            </h3>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--accent-soft-bg)', color: 'var(--accent-soft-text)', border: '1px solid var(--accent-soft-border)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {isHindi ? '6 ज़िला केंद्रक • 3 राज्य' : '6 District Centroids • 3 States'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {isHindi
              ? 'आधिकारिक भौगोलिक केंद्रक (अक्षांश/देशांतर) पर स्थित 6 पायलट ज़िले। सभी मार्कर और लेबल ओवरलैप-रहित संरेखित हैं।'
              : 'Authentic pilot district locations plotted at official centroid coordinates. Directional labels prevent overlap.'}
          </p>
        </div>

        {/* Map View Mode Switcher + Intelligence Layer + Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Intelligence Layer Switcher */}
          <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', padding: '0.2rem 0.35rem', alignSelf: 'center' }}>
              LAYER:
            </span>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: intelligenceLayer === 'shortage' ? 'var(--status-demand-bg)' : 'transparent',
                color: intelligenceLayer === 'shortage' ? 'var(--status-demand-text)' : 'var(--text-secondary)',
                fontWeight: intelligenceLayer === 'shortage' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIntelligenceLayer('shortage')}
            >
              {isHindi ? 'असंतुलन' : 'Relative Mismatch'}
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: intelligenceLayer === 'demand' ? 'var(--accent-soft-bg)' : 'transparent',
                color: intelligenceLayer === 'demand' ? 'var(--accent-soft-text)' : 'var(--text-secondary)',
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
                backgroundColor: intelligenceLayer === 'supply' ? 'var(--status-supply-bg)' : 'transparent',
                color: intelligenceLayer === 'supply' ? 'var(--status-supply-text)' : 'var(--text-secondary)',
                fontWeight: intelligenceLayer === 'supply' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIntelligenceLayer('supply')}
            >
              {isHindi ? 'आपूर्ति' : 'Supply Output'}
            </button>
          </div>

          {/* Mode Toggle: Basemap vs Schematic */}
          <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: mapMode === 'basemap' ? 'var(--bg-surface)' : 'transparent',
                color: mapMode === 'basemap' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: mapMode === 'basemap' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              onClick={() => setMapMode('basemap')}
            >
              <Icon name="globe" size={12} />
              <span>{isHindi ? 'इंटरैक्टिव बेसमैप' : 'Basemap'}</span>
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                backgroundColor: mapMode === 'schematic' ? 'var(--bg-surface)' : 'transparent',
                color: mapMode === 'schematic' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: mapMode === 'schematic' ? 700 : 500,
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              onClick={() => setMapMode('schematic')}
            >
              <Icon name="map-pin" size={12} />
              <span>{isHindi ? 'स्थानिक लोकेशन' : 'Schematic'}</span>
            </button>
          </div>

          {/* Classification Legend */}
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
              <Icon name="zap" size={11} />
              <span>{isHindi ? 'मांग दबाव' : 'Demand Pressure'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
              <Icon name="scale" size={11} />
              <span>{isHindi ? 'संतुलित' : 'Balanced'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }} />
              <Icon name="package" size={11} />
              <span>{isHindi ? 'आपूर्ति दबाव' : 'Supply Pressure'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Offline Alert with Quick Switcher if Basemap tiles fail */}
      {tilesOffline && mapMode === 'basemap' && (
        <div style={{ backgroundColor: 'var(--status-demand-bg)', border: '1px solid var(--status-demand-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--status-demand-text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Icon name="alert-triangle" size={14} />
            <span>
              {isHindi
                ? 'नेटवर्क टाइल सर्वर धीमी प्रतिक्रिया दे रहा है। आप नीचे दिए गए बटन से स्थानिक लोकेशन मैप पर स्विच कर सकते हैं।'
                : 'Network map tile server is slow or unavailable. You can switch to the self-contained Schematic Location Map.'}
            </span>
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setMapMode('schematic')}
              style={{ border: 'none', backgroundColor: '#d97706', color: '#ffffff', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Icon name="map-pin" size={12} />
              <span>{isHindi ? 'लोकेशन मैप देखें' : 'View Location Map'}</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToCharts}
              style={{ border: 'none', background: 'none', color: 'var(--status-demand-text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}
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
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-subtle)',
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
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-subtle)',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* SVG Geographical Location Canvas */}
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              style={{ width: '100%', height: '100%', display: 'block', backgroundColor: 'var(--bg-subtle)' }}
            >
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-subtle)" strokeWidth="1" />
                </pattern>
                <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.3" />
                </filter>
              </defs>

              <rect width={svgW} height={svgH} fill="url(#gridPattern)" />

              {/* Arabian Sea Coastal Indicator on the West */}
              <path
                d={`M 0,0 L ${projX(72.7)},0 L ${projX(72.8)},${projY(19.0)} L ${projX(73.5)},${projY(15.5)} L ${projX(74.5)},${svgH} L 0,${svgH} Z`}
                fill="#0284c7"
                opacity="0.14"
              />
              <text x="25" y={svgH - 25} fill="#0284c7" fontSize="11" fontWeight="700" letterSpacing="0.08em" opacity="0.8">
                ARABIAN SEA
              </text>

              {/* Maharashtra Zone */}
              <path
                d={`M ${projX(72.8)},${projY(19.5)} L ${projX(79.5)},${projY(20.2)} L ${projX(80.2)},${projY(18.5)} L ${projX(76.5)},${projY(17.8)} L ${projX(73.5)},${projY(16.5)} Z`}
                fill="var(--bg-surface)"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text x={projX(76.0)} y={projY(19.2)} fill="var(--text-secondary)" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                MAHARASHTRA (MH)
              </text>

              {/* Karnataka Zone */}
              <path
                d={`M ${projX(73.8)},${projY(16.2)} L ${projX(77.2)},${projY(17.5)} L ${projX(78.2)},${projY(13.5)} L ${projX(76.5)},${projY(12.2)} L ${projX(74.5)},${projY(14.2)} Z`}
                fill="var(--bg-surface)"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text x={projX(75.8)} y={projY(14.2)} fill="var(--text-secondary)" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                KARNATAKA (KA)
              </text>

              {/* Telangana Zone */}
              <path
                d={`M ${projX(77.4)},${projY(18.8)} L ${projX(80.5)},${projY(18.5)} L ${projX(79.8)},${projY(16.2)} L ${projX(77.5)},${projY(16.2)} Z`}
                fill="var(--bg-surface)"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text x={projX(79.0)} y={projY(17.2)} fill="var(--text-secondary)" fontSize="12" fontWeight="700" letterSpacing="0.06em" textAnchor="middle">
                TELANGANA (TS)
              </text>

              {/* Latitude / Longitude Grid Markings */}
              {[14, 16, 18, 20].map((lat) => (
                <g key={`lat-${lat}`}>
                  <line x1="45" y1={projY(lat)} x2={svgW - 25} y2={projY(lat)} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <text x="35" y={projY(lat) + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
                    {lat}°N
                  </text>
                </g>
              ))}
              {[73, 75, 77, 79].map((lon) => (
                <g key={`lon-${lon}`}>
                  <line x1={projX(lon)} y1="30" x2={projX(lon)} y2={svgH - 30} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <text x={projX(lon)} y={svgH - 12} fill="var(--text-muted)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">
                    {lon}°E
                  </text>
                </g>
              ))}

              {/* The Six Verified Pilot District Centroid Pins */}
              {districts.map((d) => {
                const px = projX(d.lon);
                const py = projY(d.lat);
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
                const cfg = DISTRICT_ANCHOR_OFFSETS[d.id] || { offsetX: 20, offsetY: 0 };

                const labelX = px + cfg.offsetX;
                const labelY = py + cfg.offsetY;

                return (
                  <g
                    key={d.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectDistrict(isSelected ? null : d.id)}
                  >
                    <line
                      x1={px}
                      y1={py}
                      x2={labelX + 30}
                      y2={labelY + 8}
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />

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
                      fontFamily="var(--font-mono)"
                      pointerEvents="none"
                    >
                      {badge.markerCode}
                    </text>

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
            <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: '0.35rem 0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Icon name="map-pin" size={12} />
                <span>{isHindi ? 'स्थानिक क्षेत्रीय लोकेशन मैप (सटीक अक्षांश/देशांतर केंद्रक • आधिकारिक सीमा नहीं)' : 'Schematic Regional Location Map (Geographically Proportionate Centroids • Not an Official Boundary Map)'}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>12.0°N–20.5°N, 71.5°E–80.5°E</span>
            </div>
          </div>
        )}

        {/* Selected District Detail Card (Sidebar) */}
        {activeDistrict && (
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '2px solid #0d9488', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {isHindi ? 'सक्रिय चयनित ज़िला' : 'Selected District'}
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.1rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Icon name="map-pin" size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span>{getDistrictDisplayName(activeDistrict.name, isHindi)}</span>
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {getStateDisplayName(activeDistrict.state, isHindi)} • ID: {activeDistrict.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectDistrict(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}
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
                    <Icon name={b.iconName} size={13} />
                    <span>{b.label}</span>
                    <span>({formatMismatch(activeDistrict.mismatch)} pts)</span>
                  </span>
                );
              })()}
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{isHindi ? 'रिपोर्टिंग अवधि:' : 'Reporting Cycle:'}</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{period}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{isHindi ? 'औसत मांग सूचकांक:' : 'Avg Demand Index:'}</span>
                <strong style={{ color: 'var(--accent-soft-text)', fontFamily: 'var(--font-mono)' }}>{formatScore(activeDistrict.avgDemand)} pts</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{isHindi ? 'औसत आपूर्ति सूचकांक:' : 'Avg Supply Index:'}</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatScore(activeDistrict.avgSupply)} pts</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{isHindi ? 'सापेक्ष असंतुलन स्कोर:' : 'Relative Mismatch:'}</span>
                <strong style={{ color: getClassificationBadge(activeDistrict.classification, isHindi).color, fontFamily: 'var(--font-mono)' }}>
                  {formatMismatch(activeDistrict.mismatch)} pts
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{isHindi ? 'केंद्रक निर्देशांक:' : 'Centroid Lat/Lon:'}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                  {activeDistrict.lat.toFixed(2)}° N, {activeDistrict.lon.toFixed(2)}° E
                </span>
              </div>
            </div>

            {/* Top Demand-Pressure Trades */}
            {shortageTrades.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--status-demand-text)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Icon name="zap" size={12} />
                  <span>{isHindi ? 'शीर्ष मांग-दबाव वाले ट्रेड:' : 'TOP DEMAND-PRESSURE TRADES:'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {shortageTrades.map((tItem, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--status-demand-bg)', borderRadius: '4px', border: '1px solid var(--status-demand-border)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {tItem.occupation_title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-demand-text)', fontSize: '0.68rem' }}>
                        +{Number(tItem.relative_mismatch_score).toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supply-Pressure Trades */}
            {oversuppliedTrades.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--status-supply-text)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Icon name="package" size={12} />
                  <span>{isHindi ? 'आपूर्ति-दबाव वाले ट्रेड:' : 'SUPPLY-PRESSURE TRADES:'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {oversuppliedTrades.map((tItem, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--status-supply-bg)', borderRadius: '4px', border: '1px solid var(--status-supply-border)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {tItem.occupation_title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-supply-text)', fontSize: '0.68rem' }}>
                        {Number(tItem.relative_mismatch_score).toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Active Notice */}
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-soft-text)', backgroundColor: 'var(--accent-soft-bg)', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--accent-soft-border)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Icon name="check-circle" size={13} />
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
              >
                {isHindi ? `${getDistrictDisplayName(activeDistrict.name, isHindi)} पूर्ण डॉसियर देखें →` : `Explore Complete ${activeDistrict.name} Dossier →`}
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectDistrict(null)}
              style={{ border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem' }}
            >
              ✕ {isHindi ? 'फ़िल्टर हटाएं (सभी ज़िले देखें)' : 'Clear Filter (Show All Districts)'}
            </button>
          </div>
        )}
      </div>

      {/* Cartographic & Boundary Provenance Disclosure */}
      <div style={{ backgroundColor: 'var(--status-demand-bg)', border: '1px solid var(--status-demand-border)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', color: 'var(--status-demand-text)' }}>
          <Icon name="info" size={14} />
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
