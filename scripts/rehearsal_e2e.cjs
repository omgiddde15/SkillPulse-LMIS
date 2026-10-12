const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const DOWNLOAD_DIR = path.resolve(__dirname, '..', 'downloads');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Clean old downloads
fs.readdirSync(DOWNLOAD_DIR).forEach(f => {
  try { fs.unlinkSync(path.join(DOWNLOAD_DIR, f)); } catch {}
});

async function runEndToEndRehearsal() {
  console.log('================================================================');
  console.log('SkillPulse LMIS — SIH National Finale Freeze Candidate Rehearsal');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 960 }
  });

  const page = await browser.newPage();

  // Configure CDP download behavior
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  const rehearsalReport = {
    timestamp: new Date().toISOString(),
    stages: {},
    summary: { passed: 0, failed: 0 }
  };

  function recordStage(id, name, status, details = {}) {
    rehearsalReport.stages[id] = { name, status, ...details };
    if (status === 'PASS') {
      rehearsalReport.summary.passed += 1;
      console.log(`[PASS] ${id}: ${name}`);
    } else {
      rehearsalReport.summary.failed += 1;
      console.error(`[FAIL] ${id}: ${name}`, details);
    }
  }

  try {
    // =========================================================================
    // STAGE A: LANDING PAGE
    // =========================================================================
    console.log('\n--- Running Stage A: Landing Page ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const stageA = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card');
      if (!card) return { passed: false, error: 'Landing hero card not found' };
      const text = card.innerText;
      const hasDharwad = text.includes('Dharwad') || text.includes('धारवाड़');
      const hasCNC = text.includes('CNC Machine Operator') || text.includes('सीएनसी मशीन ऑपरेटर');
      const hasPeriod = text.includes('2026-09');
      const hasDemand = text.includes('73.1');
      const hasSupply = text.includes('17.0');
      const hasMismatch = text.includes('+56.1') || text.includes('56.1');
      const hasUnavailable = text.includes('Pilot metrics unavailable') || text.includes('पायलट मेट्रिक्स अनुपलब्ध');
      const hasLoading = text.includes('Loading live pilot metrics');

      const passed = hasDharwad && hasCNC && hasPeriod && hasDemand && hasSupply && hasMismatch && !hasUnavailable && !hasLoading;
      return {
        passed,
        hasDharwad,
        hasCNC,
        hasPeriod,
        hasDemand,
        hasSupply,
        hasMismatch,
        hasUnavailable,
        hasLoading,
        cardSnippet: text.slice(0, 300)
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_01_landing_page.png') });
    recordStage('Stage A', 'Landing Page Live Pilot Observation Card', stageA.passed ? 'PASS' : 'FAIL', stageA);

    // =========================================================================
    // STAGE B: DISTRICT MAP
    // =========================================================================
    console.log('\n--- Running Stage B: District Map ---');
    // Navigate into Dashboard Overview
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('Launch Intelligence Platform') ||
        b.innerText.includes('Open Dashboard') ||
        b.innerText.includes('डैशबोर्ड खोलें')
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // In Overview, switch view to Geographic Map
    const switchedToMap = await page.evaluate(() => {
      const mapBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('Pilot Geographic Map') ||
        b.innerText.includes('स्थानिक पायलट मानचित्र')
      );
      if (mapBtn) {
        mapBtn.click();
        return true;
      }
      return false;
    });
    console.log('Switched to Geographic Map view:', switchedToMap);
    await new Promise(r => setTimeout(r, 1500));

    // Verify 6 Leaflet markers and map canvas
    const mapState = await page.evaluate(() => {
      const mapContainer = document.querySelector('.pilot-district-leaflet-canvas') || document.querySelector('.leaflet-container');
      const markers = Array.from(document.querySelectorAll('.pilot-district-marker-pin'));
      return {
        hasMapContainer: Boolean(mapContainer),
        markerCount: markers.length,
      };
    });
    console.log('Leaflet Map State:', mapState);

    // Test Marker 1: Pune (MH_PUN)
    const puneCheck = await page.evaluate(() => {
      const markers = Array.from(document.querySelectorAll('.pilot-district-marker-anchor'));
      const puneMarker = markers.find(m => m.innerText.includes('Pune') || m.innerText.includes('पुणे'));
      if (puneMarker) {
        puneMarker.parentElement.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    await new Promise(r => setTimeout(r, 800));

    const punePopup = await page.evaluate(() => {
      const popup = document.querySelector('.leaflet-popup-content');
      const text = popup ? popup.innerText : '';
      return {
        hasPopup: Boolean(popup),
        hasPune: text.includes('Pune') || text.includes('पुणे'),
        hasStateMH: text.includes('Maharashtra') || text.includes('महाराष्ट्र') || text.includes('MH'),
        hasMismatch: text.includes('pts') || text.includes('अंक'),
        popupText: text.slice(0, 200)
      };
    });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_02_map_pune.png') });
    console.log('Pune Marker Popup:', punePopup);

    // Test Marker 2: Bengaluru Urban (KA_BLR_U)
    const blrCheck = await page.evaluate(() => {
      const markers = Array.from(document.querySelectorAll('.pilot-district-marker-anchor'));
      const blrMarker = markers.find(m => m.innerText.includes('Bengaluru') || m.innerText.includes('बेंगलुरु'));
      if (blrMarker) {
        blrMarker.parentElement.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    await new Promise(r => setTimeout(r, 800));

    const blrPopup = await page.evaluate(() => {
      const popup = document.querySelector('.leaflet-popup-content');
      const text = popup ? popup.innerText : '';
      return {
        hasPopup: Boolean(popup),
        hasBlr: text.includes('Bengaluru') || text.includes('बेंगलुरु'),
        hasStateKA: text.includes('Karnataka') || text.includes('कर्नाटक') || text.includes('KA'),
        hasMismatch: text.includes('pts') || text.includes('अंक'),
        popupText: text.slice(0, 200)
      };
    });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_03_map_bengaluru.png') });
    console.log('Bengaluru Marker Popup:', blrPopup);

    const stageBPassed = mapState.hasMapContainer && mapState.markerCount === 6 && punePopup.hasPune && blrPopup.hasBlr;
    recordStage('Stage B', 'District Map with 6 Markers, Pune & Bengaluru Popups', stageBPassed ? 'PASS' : 'FAIL', {
      mapState,
      punePopup,
      blrPopup
    });

    // =========================================================================
    // STAGE C: DEMAND INTELLIGENCE & GAP ANALYSIS
    // =========================================================================
    console.log('\n--- Running Stage C: Demand Intelligence & Gap Analysis ---');
    // Navigate to Demand tab
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="demand"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Reset filters first
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset Filters') || b.innerText.includes('फ़िल्टर रीसेट'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Apply Filter: State = KA and Occupation = OCC_MFG_001
    await page.select('#filter-state', 'KA');
    await new Promise(r => setTimeout(r, 800));
    await page.select('#filter-occupation', 'OCC_MFG_001');
    await new Promise(r => setTimeout(r, 1000));

    const demandRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText);
      return {
        count: rows.length,
        hasDharwad: rows.some(r => r.includes('Dharwad') || r.includes('धारवाड़')),
        hasBengaluru: rows.some(r => r.includes('Bengaluru') || r.includes('बेंगलुरु')),
        allAreCNC: rows.every(r => r.includes('CNC Machine Operator') || r.includes('सीएनसी मशीन')),
        rowsSnippet: rows.slice(0, 3)
      };
    });
    console.log('Demand Intelligence Filtered State=KA & CNC:', demandRows);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_04_demand_filtered.png') });

    // Navigate to Gap Analysis tab
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="gap"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Verify Gap rows and non-absolute-shortage disclaimer
    const gapCheck = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText);
      const calloutText = document.querySelector('.callout-box')?.innerText || document.body.innerText;
      const hasNonAbsoluteDisclaimer = calloutText.includes('relative') || calloutText.includes('सापेक्ष') ||
        calloutText.includes('absolute shortage') || calloutText.includes('एकल-मात्रा') || calloutText.includes('Distinction');
      return {
        rowCount: rows.length,
        hasDharwad: rows.some(r => r.includes('Dharwad') || r.includes('धारवाड़')),
        hasBengaluru: rows.some(r => r.includes('Bengaluru') || r.includes('बेंगलुरु')),
        allAreCNC: rows.every(r => r.includes('CNC Machine Operator') || r.includes('सीएनसी मशीन')),
        hasNonAbsoluteDisclaimer,
        calloutSnippet: calloutText.slice(0, 300)
      };
    });
    console.log('Gap Analysis Filtered State=KA & CNC:', gapCheck);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_05_gap_filtered.png') });

    const stageCPassed = demandRows.count === 2 && demandRows.allAreCNC && gapCheck.rowCount === 2 && gapCheck.allAreCNC;
    recordStage('Stage C', 'Demand Intelligence & Gap Analysis with State=KA + CNC Filter', stageCPassed ? 'PASS' : 'FAIL', {
      demandRows,
      gapCheck
    });

    // =========================================================================
    // STAGE D: FORECASTS
    // =========================================================================
    console.log('\n--- Running Stage D: Forecasts Multi-Horizon Diagnostics ---');
    // Navigate to Forecasts tab
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="forecasts"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Reset filters to have all rows
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset Filters') || b.innerText.includes('फ़िल्टर रीसेट'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Open diagnostic drawer for first row
    const openedForecastDrawer = await page.evaluate(() => {
      const inspectBtn = document.querySelector('table tbody tr td button.btn-refresh');
      if (inspectBtn) {
        inspectBtn.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1000));

    // Verify 3M Horizon Drawer Details
    const drawer3M = await page.evaluate(() => {
      const drawer = document.querySelector('.inspection-drawer');
      if (!drawer) return { found: false };
      const text = drawer.innerText;
      return {
        found: true,
        hasObservedHistory: text.includes('Observed History (Synthetic)') || text.includes('अवलोकन इतिहास (सिंथेटिक)'),
        hasPointForecast: text.includes('Point Forecast') || text.includes('बिंदु अनुमान'),
        hasTargetPeriod: text.includes('Target Period') || text.includes('लक्षित अवधि'),
        hasPredictionInterval: text.includes('80%') || text.includes('निचली (80%)'),
        hasModelBadge: text.includes('Model:') || text.includes('मॉडल:'),
        hasMAE: text.includes('MAE') || text.includes('Backtesting Error'),
        hasWAPE: text.includes('WAPE'),
        hasUncertaintyNote: text.includes('uncertainty') || text.includes('अनिश्चितता') || text.includes('guaranteed policy'),
        snippet: text.slice(0, 400)
      };
    });
    console.log('Forecast 3M Drawer:', drawer3M);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_06_forecast_drawer_3m.png') });

    // Cycle to 6M Horizon
    await page.select('#forecast-horizon', '6');
    await new Promise(r => setTimeout(r, 1500));

    const drawer6M = await page.evaluate(() => {
      const drawer = document.querySelector('.inspection-drawer');
      const text = drawer ? drawer.innerText : '';
      return {
        found: Boolean(drawer),
        has6M: text.includes('+6') || text.includes('6M') || text.includes('6 माह'),
        hasTargetPeriod: text.includes('2027-03'),
        hasMAE: text.includes('MAE'),
        hasWAPE: text.includes('WAPE')
      };
    });
    console.log('Forecast 6M Cycle:', drawer6M);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_07_forecast_drawer_6m.png') });

    // Cycle to 12M Horizon
    await page.select('#forecast-horizon', '12');
    await new Promise(r => setTimeout(r, 1500));

    const drawer12M = await page.evaluate(() => {
      const drawer = document.querySelector('.inspection-drawer');
      const text = drawer ? drawer.innerText : '';
      return {
        found: Boolean(drawer),
        has12M: text.includes('+12') || text.includes('12M') || text.includes('12 माह'),
        hasTargetPeriod: text.includes('2027-09'),
        hasMAE: text.includes('MAE'),
        hasWAPE: text.includes('WAPE')
      };
    });
    console.log('Forecast 12M Cycle:', drawer12M);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_08_forecast_drawer_12m.png') });

    const stageDPassed = drawer3M.found && drawer3M.hasObservedHistory && drawer3M.hasPointForecast &&
      drawer3M.hasPredictionInterval && drawer3M.hasMAE && drawer6M.hasTargetPeriod && drawer12M.hasTargetPeriod;
    recordStage('Stage D', 'Forecasts Diagnostics (Observed vs Forecast, 80% Interval, MAE/WAPE, 3M/6M/12M Cycling)', stageDPassed ? 'PASS' : 'FAIL', {
      drawer3M,
      drawer6M,
      drawer12M
    });

    // =========================================================================
    // STAGE E: EARLY-WARNING ALERTS
    // =========================================================================
    console.log('\n--- Running Stage E: Early-Warning Alerts ---');
    // Navigate to Alerts tab
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="alerts"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Open first alert diagnostic drawer
    await page.evaluate(() => {
      const inspectBtn = document.querySelector('table tbody tr td button.btn-refresh');
      if (inspectBtn) inspectBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const alertDetails = await page.evaluate(() => {
      const drawer = document.querySelector('.inspection-drawer');
      if (!drawer) return { found: false };
      const text = drawer.innerText;
      // Case-insensitive check for severity level
      const hasSeverity = /critical|high|medium|low/i.test(text);
      return {
        found: true,
        hasSeverity,
        hasCausalExplanation: text.includes('Causal Explanation') || text.includes('कारणात्मक स्पष्टीकरण'),
        hasSuggestedAction: text.includes('Suggested') || text.includes('सिफारिश') || text.includes('Policy Planning Action'),
        hasLimitations: text.includes('Limitations') || text.includes('सीमाएं') || text.includes('Decision-Support'),
        hasHumanNotice: text.includes('qualitative human review') || text.includes('decision-support signals') || text.includes('निर्णय-सहायता'),
        snippet: text.slice(0, 400)
      };
    });
    console.log('Alert Inspection Details:', alertDetails);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_09_alert_inspection.png') });

    const stageEPassed = alertDetails.found && alertDetails.hasSeverity && alertDetails.hasCausalExplanation &&
      alertDetails.hasSuggestedAction && alertDetails.hasLimitations;
    recordStage('Stage E', 'Early-Warning Alerts Reason, Severity, Action, Limitations', stageEPassed ? 'PASS' : 'FAIL', alertDetails);

    // =========================================================================
    // STAGE F: SEAT SIMULATOR
    // =========================================================================
    console.log('\n--- Running Stage F: Seat Simulator Dynamic Recalculation ---');
    // Navigate to Simulator tab
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="simulator"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Set scenario parameters:
    // Period: 2026-09, District: KA_BLR_U, Sector: Logistics, Occupation: OCC_LOG_001, Horizon: 6, Seats: 100
    await page.select('#sim-base-period', '2026-09');
    await new Promise(r => setTimeout(r, 300));
    await page.select('#sim-state', 'KA');
    await new Promise(r => setTimeout(r, 500));
    await page.select('#sim-district', 'KA_BLR_U');
    await new Promise(r => setTimeout(r, 500));
    await page.select('#sim-sector', 'Logistics');
    await new Promise(r => setTimeout(r, 500));
    await page.select('#sim-occupation', 'OCC_LOG_001');
    await new Promise(r => setTimeout(r, 500));
    await page.select('#sim-horizon', '6');
    await new Promise(r => setTimeout(r, 500));

    // Update Proposed Seats to 100 via React prototype setter
    await page.evaluate((val) => {
      const input = document.getElementById('sim-seats');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(val));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 100);
    await new Promise(r => setTimeout(r, 400));

    // Run first simulation (100 seats)
    await page.evaluate(() => {
      const runBtn = document.querySelector('.btn-primary-simulator');
      if (runBtn) runBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    const sim100 = await page.evaluate(() => {
      const kpis = Array.from(document.querySelectorAll('.scenario-kpi-card')).map(card => card.innerText);
      const text = document.body.innerText;
      return {
        kpiCount: kpis.length,
        has100Seats: kpis.some(k => k.includes('100')),
        kpisText: kpis,
        hasThroughput: text.includes('/mo') || text.includes('/माह'),
        hasMismatch: text.includes('pts') || text.includes('अंक'),
        hasClassification: text.includes('Pressure') || text.includes('Balanced') || text.includes('दबाव')
      };
    });
    console.log('Seat Simulator 100 Seats Result:', sim100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_10_simulator_100_seats.png') });

    // Scenario 2: Proposed Seats = 180
    await page.evaluate((val) => {
      const input = document.getElementById('sim-seats');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(val));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 180);
    await new Promise(r => setTimeout(r, 400));

    // Run second simulation (180 seats)
    await page.evaluate(() => {
      const runBtn = document.querySelector('.btn-primary-simulator');
      if (runBtn) runBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    const sim180 = await page.evaluate(() => {
      const kpis = Array.from(document.querySelectorAll('.scenario-kpi-card')).map(card => card.innerText);
      const prevBanner = document.querySelector('.prev-scenario-banner')?.innerText || '';
      return {
        has180Seats: kpis.some(k => k.includes('180')),
        hasPrevComparisonBanner: prevBanner.includes('100') && prevBanner.includes('180'),
        prevBannerText: prevBanner,
        kpisText: kpis
      };
    });
    console.log('Seat Simulator 180 Seats Result with Comparison Banner:', sim180);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_11_simulator_180_seats.png') });

    const stageFPassed = sim100.has100Seats && sim180.has180Seats && sim180.hasPrevComparisonBanner;
    recordStage('Stage F', 'Seat Simulator 100-Seat then 180-Seat Comparison & Recalculation', stageFPassed ? 'PASS' : 'FAIL', {
      sim100,
      sim180
    });

    // =========================================================================
    // STAGE G: CSV EXPORT RECTANGULAR SHAPE & DISCLAIMERS
    // =========================================================================
    console.log('\n--- Running Stage G: CSV Export Shape & Disclaimers Verification ---');

    // Trigger CSV download from Seat Simulator
    console.log('Triggering Seat Simulator CSV Export download...');
    await page.evaluate(() => {
      const exportBtn = document.querySelector('.btn-export');
      if (exportBtn) exportBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Trigger CSV download from Gap Analysis
    console.log('Triggering Gap Analysis CSV Export download...');
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="gap"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const exportBtn = document.querySelector('.btn-export');
      if (exportBtn) exportBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Trigger CSV download from Forecasts
    console.log('Triggering Forecasts CSV Export download...');
    await page.evaluate(() => {
      const tabBtn = document.querySelector('button[data-tab="forecasts"]');
      if (tabBtn) tabBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const exportBtn = document.querySelector('.btn-export');
      if (exportBtn) exportBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Verify downloaded CSV files in DOWNLOAD_DIR
    const downloadedFiles = fs.readdirSync(DOWNLOAD_DIR);
    console.log('Downloaded CSV files:', downloadedFiles);

    const verifiedCsvFiles = [];
    for (const f of downloadedFiles) {
      if (!f.endsWith('.csv')) continue;
      const fullPath = path.join(DOWNLOAD_DIR, f);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

      // Check header row column count
      // Simple parse of comma outside quotes
      function countCsvColumns(line) {
        let cols = 1;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === ',' && !inQuotes) cols++;
        }
        return cols;
      }

      const headerCols = countCsvColumns(lines[0]);
      let isRectangular = true;
      let nonMatchingLine = null;

      for (let i = 1; i < lines.length; i++) {
        const c = countCsvColumns(lines[i]);
        if (c !== headerCols) {
          isRectangular = false;
          nonMatchingLine = { lineIdx: i, expected: headerCols, actual: c };
          break;
        }
      }

      const hasSyntheticNotice = content.includes('Synthetic demonstration dataset for SIH26246') ||
        content.includes('not official statistics') ||
        content.includes('synthetic pilot observations') ||
        content.includes('सिंथेटिक प्रदर्शन डेटासेट');

      const hasNegativeValues = content.includes('-,') || /-\d+\.\d+/.test(content);

      verifiedCsvFiles.push({
        filename: f,
        totalRows: lines.length,
        columnCount: headerCols,
        isRectangular,
        nonMatchingLine,
        hasSyntheticNotice,
        hasNegativeValues,
      });
    }

    console.log('Verified Downloaded CSV Files:', verifiedCsvFiles);

    // Also verify backend API responses directly via Node native fetch
    const gapApiRes = await fetch('http://127.0.0.1:8000/api/v1/gap-analysis?period=2026-09&limit=10').then(r => r.json());
    const forecastApiRes = await fetch('http://127.0.0.1:8000/api/v1/forecasts?period=2026-09&horizon=3&limit=10').then(r => r.json());

    const apiVerification = {
      gapRecords: gapApiRes.results?.length,
      forecastRecords: forecastApiRes.results?.length,
      hasNegativeMismatches: gapApiRes.results?.some(r => r.relative_mismatch_score < 0) ||
                             forecastApiRes.results?.some(r => r.projected_mismatch?.projected_mismatch_score < 0)
    };

    const stageGPassed = verifiedCsvFiles.length >= 2 &&
      verifiedCsvFiles.every(v => v.isRectangular && v.hasSyntheticNotice) &&
      apiVerification.hasNegativeMismatches;

    recordStage('Stage G', 'CSV Export Rectangular Shape, Preserved Negative Numbers & Synthetic Disclaimers', stageGPassed ? 'PASS' : 'FAIL', {
      downloadedCount: verifiedCsvFiles.length,
      verifiedCsvFiles,
      apiVerification
    });

    // =========================================================================
    // STAGE H: ENGLISH/HINDI TRANSLATIONS & PERSISTENCE
    // =========================================================================
    console.log('\n--- Running Stage H: English/Hindi Language Toggle & Persistence ---');
    // Toggle to Hindi
    const toggledToHindi = await page.evaluate(() => {
      const hiBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'हिन्दी');
      if (hiBtn) {
        hiBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Hindi toggle button:', toggledToHindi);
    await new Promise(r => setTimeout(r, 1200));

    // Verify Hindi rendered without raw translation keys
    const hindiState = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const rawKeys = bodyText.match(/[a-z]{2,8}\.[a-zA-Z0-9_]{3,25}/g) || [];
      const hasOverviewHindi = bodyText.includes('अवलोकन');
      const hasSyntheticPill = bodyText.includes('सिंथेटिक डेमो डेटा') || bodyText.includes('सिंथेटिक');
      const storedLang = localStorage.getItem('skillpulse_lang');
      return {
        storedLang,
        hasOverviewHindi,
        hasSyntheticPill,
        rawKeysCount: rawKeys.length,
        sampleRawKeys: rawKeys.slice(0, 5)
      };
    });
    console.log('Hindi Interface State:', hindiState);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_12_dashboard_hindi.png') });

    // Reload page to test persistence
    console.log('Reloading page to test Hindi persistence across reload...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const persistenceCheck = await page.evaluate(() => {
      const storedLang = localStorage.getItem('skillpulse_lang');
      const bodyText = document.body.innerText;
      const isStillHindi = storedLang === 'hi' && (bodyText.includes('अवलोकन') || bodyText.includes('सिंथेटिक') || bodyText.includes('होम'));
      return {
        storedLang,
        isStillHindi
      };
    });
    console.log('Persistence Check Result:', persistenceCheck);

    // Switch back to English
    await page.evaluate(() => {
      const enBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'EN');
      if (enBtn) enBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const restoredEnglish = await page.evaluate(() => {
      const storedLang = localStorage.getItem('skillpulse_lang');
      const bodyText = document.body.innerText;
      const isEnglish = storedLang === 'en' && bodyText.includes('Overview');
      return {
        storedLang,
        isEnglish
      };
    });
    console.log('Restored English State:', restoredEnglish);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rehearsal_13_restored_english.png') });

    const stageHPassed = hindiState.storedLang === 'hi' && hindiState.rawKeysCount === 0 &&
      persistenceCheck.isStillHindi && restoredEnglish.isEnglish;
    recordStage('Stage H', 'Hindi Toggle, Zero Raw Translation Keys, Reload Persistence, and English Restore', stageHPassed ? 'PASS' : 'FAIL', {
      hindiState,
      persistenceCheck,
      restoredEnglish
    });

  } catch (error) {
    console.error('Exception during rehearsal:', error);
    recordStage('REHEARSAL_ERROR', 'Rehearsal script runtime exception', 'FAIL', { error: error.message, stack: error.stack });
  } finally {
    await browser.close();
  }

  // Save report
  const reportPath = path.join(SCREENSHOT_DIR, 'rehearsal_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(rehearsalReport, null, 2), 'utf8');
  console.log(`\nRehearsal complete. Report saved to: ${reportPath}`);
  console.log(`Summary: Passed: ${rehearsalReport.summary.passed}, Failed: ${rehearsalReport.summary.failed}`);
}

runEndToEndRehearsal();
