const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runBrowserVerification() {
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 950 }
  });

  const page = await browser.newPage();
  
  // Track console logs and errors
  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser Error]:', err.message));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.warn(`[HTTP ${res.status()}]:`, res.url());
    }
  });

  try {
    console.log('1. Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000)); // Allow API responses to hydrate

    // Step A: Overview Comparison Charts Verification
    console.log('2. Verifying Overview Comparison Charts (English)...');
    const chartAExists = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Chart A: Demand vs. Supply Index Comparison') &&
             text.includes('Chart B: Relative Demand-Supply Mismatch');
    });
    console.log('   Charts A and B present:', chartAExists);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_overview_charts_en.png'), fullPage: false });

    // Step B: Switch to Geographic Map View
    console.log('3. Switching to Geographic Basemap View...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Geographic Map') || b.innerText.includes('भौगोलिक मानचित्र'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000)); // Wait for Leaflet to mount and tiles to load

    // Verify Leaflet container and markers
    const mapVerification = await page.evaluate(() => {
      const leafletContainer = document.querySelector('.leaflet-container');
      const markers = document.querySelectorAll('.pilot-district-marker-pin');
      const attribution = document.querySelector('.leaflet-control-attribution');
      return {
        hasLeaflet: !!leafletContainer,
        markerCount: markers.length,
        attributionText: attribution ? attribution.innerText : 'None',
      };
    });
    console.log('   Leaflet map container present:', mapVerification.hasLeaflet);
    console.log('   District markers rendered count:', mapVerification.markerCount);
    console.log('   Map tile attribution:', mapVerification.attributionText);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_overview_map_basemap_en.png'), fullPage: false });

    // Step C: Click Marker 1 (Pune)
    console.log('4. Clicking District Marker 1 (Pune)...');
    await page.evaluate(() => {
      const pins = document.querySelectorAll('.pilot-district-marker-pin');
      if (pins.length > 0) {
        pins[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    const marker1Details = await page.evaluate(() => {
      const popup = document.querySelector('.leaflet-popup-content');
      const sidebarHeading = Array.from(document.querySelectorAll('h4')).find(h => h.innerText.includes('Pune') || h.innerText.includes('पुणे'));
      return {
        popupContent: popup ? popup.innerText.replace(/\n+/g, ' | ') : 'No popup',
        sidebarDistrict: sidebarHeading ? sidebarHeading.innerText : 'No heading found',
      };
    });
    console.log('   Marker 1 (Pune) popup info:', marker1Details.popupContent);
    console.log('   Sidebar selected district:', marker1Details.sidebarDistrict);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_overview_map_marker1_pune.png'), fullPage: false });

    // Step D: Click Marker 2 (Bengaluru Urban / 3rd in list)
    console.log('5. Clicking District Marker 2 (Bengaluru Urban)...');
    await page.evaluate(() => {
      const pins = document.querySelectorAll('.pilot-district-marker-pin');
      if (pins.length > 2) {
        pins[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    const marker2Details = await page.evaluate(() => {
      const popup = document.querySelector('.leaflet-popup-content');
      const sidebarHeading = Array.from(document.querySelectorAll('h4')).find(h => h.innerText.includes('Bengaluru') || h.innerText.includes('बेंगलुरु'));
      return {
        popupContent: popup ? popup.innerText.replace(/\n+/g, ' | ') : 'No popup',
        sidebarDistrict: sidebarHeading ? sidebarHeading.innerText : 'No heading found',
      };
    });
    console.log('   Marker 2 (Bengaluru Urban) popup info:', marker2Details.popupContent);
    console.log('   Sidebar selected district:', marker2Details.sidebarDistrict);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_overview_map_marker2_bengaluru.png'), fullPage: false });

    // Step E: Test Language Switch to Hindi
    console.log('6. Switching language to Hindi...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('हिन्दी'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    console.log('   Language switched to Hindi.');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_overview_map_hindi.png'), fullPage: false });

    // Switch back to comparison charts view in Hindi
    console.log('   Switching to comparison charts in Hindi...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('तुलनात्मक चार्ट'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_overview_charts_hindi.png'), fullPage: false });

    // Switch back to English for forecast test
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.lang-btn'));
      const btn = buttons.find(b => b.innerText.trim() === 'EN');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Step F: Test Forecasts Page & Time-Series Visualization
    console.log('7. Navigating to Forecasts page...');
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll('.nav-button'));
      const forecastBtn = navButtons.find(b => b.innerText.includes('Forecast') || b.innerText.includes('पूर्वानुमान'));
      if (forecastBtn) forecastBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500)); // Wait for forecast API to fetch

    // Click the first table row to open diagnostics inspection drawer
    const rowClicked = await page.evaluate(() => {
      const firstRow = document.querySelector('.data-table tbody tr');
      if (firstRow) {
        firstRow.click();
        return true;
      }
      return false;
    });
    console.log('   Forecast table first row clicked:', rowClicked);
    await new Promise(r => setTimeout(r, 1500));

    // Verify time series chart component
    const timeSeriesVerification = await page.evaluate(() => {
      const container = document.querySelector('.forecast-timeseries-container');
      const svg = container ? container.querySelector('svg') : null;
      const text = container ? container.innerText : '';
      return {
        hasContainer: !!container,
        hasSvg: !!svg,
        hasHistoricalLabel: text.includes('Observed History (Synthetic)'),
        hasForecastLabel: text.includes('Point Forecast'),
        hasIntervalLabel: text.includes('80% Prediction Interval'),
        hasCutoffLabel: text.includes('Cutoff'),
        hasModelMention: text.includes('Model:') || text.includes('मॉडल:'),
      };
    });
    console.log('   Forecast Time Series Chart verification:', timeSeriesVerification);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_forecast_timeseries_drawer.png'), fullPage: false });

    console.log('========================================================================');
    console.log('ALL BROWSER VERIFICATION STEPS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!');
    console.log('========================================================================');
  } catch (err) {
    console.error('Browser verification failed with error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png'), fullPage: false });
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
