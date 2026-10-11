import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getDistrictDisplayName,
  getStateDisplayName,
} from '../i18n/translations';

/**
 * DistrictGeographicMap
 *
 * Interactive Leaflet basemap rendering authentic pilot district centroid locations
 * across Maharashtra, Karnataka, and Telangana with OpenStreetMap tiles.
 */
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
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [tilesOffline, setTilesOffline] = useState(false);

  // Currently selected district object
  const activeDistrict = districts.find((d) => d.id === selectedDistrictId);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any stale map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Centered over South-Central India covering MH, KA, and TS
    const map = L.map(mapContainerRef.current, {
      center: [16.5, 76.2],
      zoom: 6,
      minZoom: 5,
      maxZoom: 13,
      scrollWheelZoom: false, // Prevents intercepting dashboard page scroll
    });

    mapInstanceRef.current = map;

    // OpenStreetMap Tile Layer with explicit attribution
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });

    osmLayer.on('tileerror', () => {
      setTilesOffline(true);
    });

    osmLayer.addTo(map);

    // Feature group for markers
    const markersGroup = L.featureGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Invalidate size to ensure complete canvas render after mount
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const markersRef = useRef({});

  // Render Markers once per district dataset / language change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup || districts.length === 0) return;

    markersGroup.clearLayers();
    markersRef.current = {};

    districts.forEach((d) => {
      const badge = getClassificationBadge(d.classification, isHindi);
      const isDemand = d.classification === 'Demand Pressure';
      const isSupply = d.classification === 'Supply Pressure';
      const pinColor = isDemand ? '#ea580c' : isSupply ? '#2563eb' : '#475569';

      // Custom DivIcon for clean, responsive vector pins
      const markerHtml = `
        <div class="pilot-district-marker-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        ">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: ${pinColor};
            border: 2px solid #ffffff;
            box-shadow: 0 3px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
          ">
            ${badge.icon}
          </div>
          <div style="
            margin-top: 3px;
            background-color: rgba(15, 23, 42, 0.90);
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2);
          ">
            ${getDistrictDisplayName(d.name, isHindi)}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'pilot-district-marker-pin',
        iconSize: [40, 56],
        iconAnchor: [20, 24],
        popupAnchor: [0, -24],
      });

      const marker = L.marker([d.lat, d.lon], { icon: customIcon });

      // Rich popup with full API metrics
      const popupContent = `
        <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="font-size: 14px; color: #0f172a;">${getDistrictDisplayName(d.name, isHindi)}</strong>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${getStateDisplayName(d.state, isHindi)} (${d.state})</span>
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

    // Fit bounds across all pilot district coordinates
    if (districts.length > 0) {
      const latLngs = districts.map((d) => [d.lat, d.lon]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 8 });
    }
  }, [districts, period, isHindi, onSelectDistrict]);

  // Synchronize popup with selectedDistrictId
  useEffect(() => {
    if (!selectedDistrictId) {
      mapInstanceRef.current?.closePopup();
      return;
    }
    const targetMarker = markersRef.current[selectedDistrictId];
    if (targetMarker && mapInstanceRef.current) {
      targetMarker.openPopup();
    }
  }, [selectedDistrictId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      {/* Top Map Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0 }}>
              🗺️ {isHindi ? 'पायलट ज़िला भौगोलिक मानचित्र (कर्नाटक, महाराष्ट्र, तेलंगाना)' : 'Pilot District Geographic Basemap (Karnataka, Maharashtra, Telangana)'}
            </h3>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: '#f0fdfa', color: 'var(--teal-800)', border: '1px solid var(--teal-200)', fontWeight: 600 }}>
              {isHindi ? 'ओपनस्ट्रीटमैप टाइल्स • 6 ज़िला केंद्रक' : 'OpenStreetMap Basemap • 6 District Centroids'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
            {isHindi
              ? 'आधिकारिक भौगोलिक स्थिति (अक्षांश/देशांतर केंद्रक) पर स्थित 6 पायलट ज़िलों का वास्तविक मानचित्र। मार्कर पर क्लिक करके विवरण देखें और तालिका फ़िल्टर करें।'
              : 'Interactive geographic basemap showing authentic pilot district coordinates. Click any marker to inspect labour-market metrics and filter rankings.'}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--slate-700)', backgroundColor: 'var(--slate-50)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
            <span>⚡ {isHindi ? 'मांग दबाव (≥ +15)' : 'Demand Pressure (≥ +15)'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#475569', display: 'inline-block' }} />
            <span>⚖️ {isHindi ? 'संतुलित (±15)' : 'Balanced (±15)'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }} />
            <span>📦 {isHindi ? 'आपूर्ति दबाव (≤ −15)' : 'Supply Pressure (≤ −15)'}</span>
          </span>
        </div>
      </div>

      {/* Offline / Tile Fallback Warning if tiles fail */}
      {tilesOffline && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            ⚠️ {isHindi
              ? 'नेटवर्क टाइल सर्वर अनुपलब्ध है। ज़िला केंद्रक मार्कर और विश्लेषणात्मक डेटा पूरी तरह सक्रिय हैं।'
              : 'Network map tile server is unavailable. District centroid coordinates and analytics remain fully interactive.'}
          </span>
          <button
            type="button"
            onClick={onSwitchToCharts}
            style={{ border: 'none', background: 'none', color: '#b45309', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
          >
            {isHindi ? 'तुलनात्मक चार्ट पर वापस जाएं' : 'Switch to Comparison Charts'}
          </button>
        </div>
      )}

      {/* Main Map + Selected Inspector Row */}
      <div style={{ display: 'grid', gridTemplateColumns: activeDistrict ? '1fr 300px' : '1fr', gap: '1rem', alignItems: 'stretch' }}>
        {/* Leaflet Map Canvas */}
        <div
          ref={mapContainerRef}
          style={{
            height: '480px',
            width: '100%',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--slate-300)',
            backgroundColor: '#e2e8f0',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            zIndex: 1,
          }}
        />

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
                  {getStateDisplayName(activeDistrict.state, isHindi)} ({activeDistrict.state}) • ID: {activeDistrict.id}
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
                <strong style={{ color: getClassificationBadge(activeDistrict.classification).color, fontFamily: 'var(--font-mono)' }}>
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

            {/* Filter Active Notice */}
            <div style={{ fontSize: '0.72rem', color: 'var(--teal-800)', backgroundColor: '#f0fdfa', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>✓</span>
              <span>{isHindi ? 'नीचे दी गई रैंकिंग तालिका इस ज़िले के लिए फ़िल्टर की गई है।' : 'Rankings table below is filtered to this district.'}</span>
            </div>

            <button
              type="button"
              onClick={() => onSelectDistrict(null)}
              style={{ border: '1px solid var(--slate-300)', backgroundColor: '#ffffff', color: 'var(--slate-700)', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: 'auto' }}
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
            : 'Basemap tiles rendered via OpenStreetMap contributors. Markers represent official centroid locations for the six pilot districts across Maharashtra, Karnataka, and Telangana. Individual district boundary polygons are omitted to avoid unverified or approximate GIS geometry. Mismatch scores indicate relative cross-sectional percentile differences, not headcount deficits.'}
        </div>
      </div>
    </div>
  );
}
