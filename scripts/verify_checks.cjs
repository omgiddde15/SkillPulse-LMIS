const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runFocusedVerification() {
  console.log('Launching Chrome for focused verification checks...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 960 }
  });

  const page = await browser.newPage();
  const results = {
    check1_landing_metrics: {},
    check2_context_filters: {},
    check3_integrity_preservation: {},
  };

  try {
    // =========================================================================
    // CHECK 1: LANDING PAGE METRICS
    // =========================================================================
    console.log('\n--- CHECK 1: Landing Page Metrics ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const landingMetrics = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card') || document.body;
      const text = card.innerText;
      return {
        cardFound: Boolean(document.querySelector('.landing-hero-card')),
        rawText: text,
        hasDemand73_1: text.includes('73.1'),
        hasSupply17_0: text.includes('17.0'),
        hasMismatch56_1: text.includes('+56.1') || text.includes('56.1'),
        hasDharwad: text.includes('Dharwad'),
        hasCNC: text.includes('CNC Machine Operator'),
        hasDemandPressure: text.includes('Demand Pressure'),
        hasPeriod2026_09: text.includes('2026-09'),
        hasSyntheticNotice: text.includes('Synthetic') || text.includes('सिंथेटिक'),
      };
    });

    results.check1_landing_metrics = landingMetrics;
    console.log('Landing card values verified:', landingMetrics);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk1_landing_dharwad_card.png'), fullPage: false });

    // =========================================================================
    // CHECK 2: GLOBAL CONTEXT FILTERS
    // =========================================================================
    console.log('\n--- CHECK 2: Global Context Filters ---');

    // 2.1 Navigate into Dashboard Overview
    const openBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Open Dashboard') || b.innerText.includes('डैशबोर्ड खोलें'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Clicked Open Dashboard button:', openBtn);
    await new Promise(r => setTimeout(r, 2000));

    // Check ContextFilterBar presence on Overview
    const overviewFilterBar = await page.evaluate(() => {
      const bar = document.querySelector('.context-filter-bar');
      const stateSelect = document.getElementById('filter-state');
      const distSelect = document.getElementById('filter-district');
      return {
        barVisible: Boolean(bar),
        stateCount: stateSelect ? stateSelect.options.length : 0,
        distCount: distSelect ? distSelect.options.length : 0,
      };
    });
    results.check2_context_filters.overviewBar = overviewFilterBar;
    console.log('Overview ContextFilterBar:', overviewFilterBar);

    // Test State filter cascading to District options on Overview
    await page.select('#filter-state', 'KA');
    await new Promise(r => setTimeout(r, 600));

    const kaDistricts = await page.evaluate(() => {
      const distSelect = document.getElementById('filter-district');
      const opts = Array.from(distSelect.options).map(o => ({ value: o.value, text: o.text }));
      return opts;
    });
    results.check2_context_filters.kaDistrictsCascading = kaDistricts;
    console.log('District options when State=KA:', kaDistricts);

    // Test Reset filter button
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset Filters'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const resetDistCount = await page.evaluate(() => {
      const distSelect = document.getElementById('filter-district');
      const stateSelect = document.getElementById('filter-state');
      return {
        stateVal: stateSelect ? stateSelect.value : null,
        distCount: distSelect ? distSelect.options.length : 0,
      };
    });
    results.check2_context_filters.resetBehavior = resetDistCount;
    console.log('After Reset Filters:', resetDistCount);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_overview_filter_bar.png') });

    // 2.2 Test Demand Intelligence View
    console.log('\n--- 2.2 Testing Demand Intelligence View ---');
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a, button')).find(el => el.innerText.includes('Demand Intelligence') || el.innerText.includes('मांग इंटेलिजेंस'));
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Apply State = KA and Occupation = OCC_MFG_001
    await page.select('#filter-state', 'KA');
    await new Promise(r => setTimeout(r, 800));
    await page.select('#filter-occupation', 'OCC_MFG_001');
    await new Promise(r => setTimeout(r, 800));

    const demandFilteredRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText);
      const statVal = document.querySelector('.stats-cards-row .stat-card-value')?.innerText;
      return {
        matchingRowsCount: rows.length,
        firstRowText: rows[0] || 'None',
        matchingPairsEvaluated: statVal,
      };
    });
    results.check2_context_filters.demandFiltered = demandFilteredRows;
    console.log('Demand Intelligence with State=KA & Occupation=OCC_MFG_001:', demandFilteredRows);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_demand_filtered.png') });

    // 2.3 Test Gap Analysis View
    console.log('\n--- 2.3 Testing Gap Analysis View ---');
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a, button')).find(el => el.innerText.includes('Gap Analysis') || el.innerText.includes('अंतर विश्लेषण'));
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Reset filters first
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset Filters'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Filter by Sector = Manufacturing and Occupation = OCC_MFG_001
    await page.select('#filter-sector', 'Manufacturing');
    await new Promise(r => setTimeout(r, 600));
    await page.select('#filter-occupation', 'OCC_MFG_001');
    await new Promise(r => setTimeout(r, 800));

    const gapFiltered = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText);
      return {
        count: rows.length,
        hasCNC: rows.every(r => r.includes('CNC Machine Operator')),
        firstRow: rows[0] || 'None',
      };
    });
    results.check2_context_filters.gapFiltered = gapFiltered;
    console.log('Gap Analysis with Sector=Manufacturing & Occupation=OCC_MFG_001:', gapFiltered);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_gap_filtered.png') });

    // 2.4 Test Forecasts View & Forecast Horizon filter
    console.log('\n--- 2.4 Testing Forecasts View & Horizon Switching ---');
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a, button')).find(el => el.innerText.includes('Forecasts') || el.innerText.includes('पूर्वानुमान'));
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Reset filters
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset Filters'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Check default horizon +3M target period
    const defaultHorizonState = await page.evaluate(() => {
      const text = document.body.innerText;
      const target2026_12 = text.includes('2026-12');
      return {
        hasTargetPeriod2026_12: target2026_12,
      };
    });
    console.log('Forecast default horizon (+3M):', defaultHorizonState);

    // Switch to +6M horizon via ContextFilterBar button
    const click6M = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn6m = btns.find(b => b.innerText.trim() === '+6M');
      if (btn6m) { btn6m.click(); return true; }
      return false;
    });
    console.log('Clicked +6M horizon button:', click6M);
    await new Promise(r => setTimeout(r, 2000));

    const horizon6mState = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTargetPeriod2027_03: text.includes('2027-03'),
      };
    });
    console.log('Forecast +6M horizon state:', horizon6mState);

    // Switch to +12M horizon
    const click12M = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn12m = btns.find(b => b.innerText.trim() === '+12M');
      if (btn12m) { btn12m.click(); return true; }
      return false;
    });
    console.log('Clicked +12M horizon button:', click12M);
    await new Promise(r => setTimeout(r, 2000));

    const horizon12mState = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTargetPeriod2027_09: text.includes('2027-09'),
      };
    });
    console.log('Forecast +12M horizon state:', horizon12mState);

    results.check2_context_filters.forecastHorizons = {
      default3M: defaultHorizonState,
      horizon6M: horizon6mState,
      horizon12M: horizon12mState,
    };
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_forecasts_12m.png') });

    // 2.5 Test Early-Warning Alerts View
    console.log('\n--- 2.5 Testing Early-Warning Alerts View ---');
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a, button')).find(el => el.innerText.includes('Early-Warning Alerts') || el.innerText.includes('प्रारंभिक चेतावनी'));
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const alertsContextBar = await page.evaluate(() => {
      return {
        barVisible: Boolean(document.querySelector('.context-filter-bar')),
        alertCount: document.querySelectorAll('table tbody tr').length,
      };
    });
    results.check2_context_filters.alertsBar = alertsContextBar;
    console.log('Early-Warning Alerts bar visible:', alertsContextBar);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_alerts_view.png') });

    // 2.6 Test Irrelevant Views (Simulator, Districts, Settings, Data Health)
    console.log('\n--- 2.6 Testing Irrelevant Views (Filter Bar should NOT be present) ---');

    // Simulator
    await page.click('button[data-tab="simulator"]');
    await new Promise(r => setTimeout(r, 1500));
    const simulatorHasBar = await page.evaluate(() => Boolean(document.querySelector('.context-filter-bar')));
    console.log('Training-Seat Simulator has ContextFilterBar:', simulatorHasBar);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk2_irrelevant_simulator.png') });

    // Pilot Districts
    await page.click('button[data-tab="districts"]');
    await new Promise(r => setTimeout(r, 1500));
    const districtsHasBar = await page.evaluate(() => Boolean(document.querySelector('.context-filter-bar')));
    console.log('Pilot Districts Explorer has ContextFilterBar:', districtsHasBar);

    // Data Health
    await page.click('button[data-tab="data-health"]');
    await new Promise(r => setTimeout(r, 1500));
    const healthHasBar = await page.evaluate(() => Boolean(document.querySelector('.context-filter-bar')));
    console.log('Data Health has ContextFilterBar:', healthHasBar);

    // Settings
    await page.click('button[data-tab="settings"]');
    await new Promise(r => setTimeout(r, 1500));
    const settingsHasBar = await page.evaluate(() => Boolean(document.querySelector('.context-filter-bar')));
    console.log('Settings has ContextFilterBar:', settingsHasBar);

    results.check2_context_filters.irrelevantViews = {
      simulatorHasBar,
      districtsHasBar,
      healthHasBar,
      settingsHasBar,
      allCorrectlyOmitted: !simulatorHasBar && !districtsHasBar && !healthHasBar && !settingsHasBar,
    };

    // =========================================================================
    // CHECK 3: INTEGRITY & LOCALIZATION PRESERVATION
    // =========================================================================
    console.log('\n--- CHECK 3: Integrity Preservation (Leaflet map & Hindi toggle) ---');

    // Back to Overview for Leaflet Map check
    await page.click('button[data-tab="overview"]');
    await new Promise(r => setTimeout(r, 2000));

    // Toggle to "Pilot Geographic Map" view
    const clickedMapToggle = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const mapBtn = btns.find(b => b.innerText.includes('Pilot Geographic Map') || b.innerText.includes('स्थानिक पायलट मानचित्र'));
      if (mapBtn) { mapBtn.click(); return true; }
      return false;
    });
    console.log('Clicked Pilot Geographic Map toggle:', clickedMapToggle);
    await new Promise(r => setTimeout(r, 3000));

    // Scroll down to the map
    await page.evaluate(() => {
      const mapEl = document.querySelector('.leaflet-container');
      if (mapEl) mapEl.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 1500));

    const mapCheck = await page.evaluate(() => {
      const mapContainer = document.querySelector('.leaflet-container');
      const tiles = document.querySelectorAll('.leaflet-tile');
      const markers = document.querySelectorAll('.leaflet-marker-icon');
      return {
        mapMounted: Boolean(mapContainer),
        tilesLoadedCount: tiles.length,
        markerCount: markers.length,
      };
    });
    console.log('Leaflet map check:', mapCheck);
    results.check3_integrity_preservation.map = mapCheck;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk3_overview_leaflet_map.png') });

    // Test Hindi toggle
    await page.evaluate(() => {
      const hiBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('हिन्दी') || b.innerText.includes('HI'));
      if (hiBtn) hiBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const hindiCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHindiOverview: text.includes('श्रम बाजार अवलोकन') || text.includes('स्किलपल्स'),
        hasHindiProvenance: text.includes('सिंथेटिक'),
      };
    });
    console.log('Hindi localization check:', hindiCheck);
    results.check3_integrity_preservation.hindi = hindiCheck;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'chk3_hindi_overview.png') });

    console.log('\n======================================================');
    console.log('FINAL RESULTS JSON:');
    console.log(JSON.stringify(results, null, 2));
    console.log('======================================================');

    fs.writeFileSync(path.resolve(__dirname, '..', 'screenshots', 'verification_results.json'), JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
    console.log('Chrome closed. Verification complete.');
  }
}

runFocusedVerification();
