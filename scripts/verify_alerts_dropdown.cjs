/**
 * Browser Verification Script for Early-Warning Alerts Dropdowns
 */

const assert = require('assert');
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:3000/alerts';

async function run() {
  console.log('================================================================');
  console.log('SkillPulse LMIS - Early-Warning Alerts Dropdowns Verification');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the alerts filter bar
    await page.waitForSelector('#alert-sector', { timeout: 15000 });

    // Function to read all default options
    const getDropdownOptions = async () => {
      return page.evaluate(() => {
        return {
          sector: document.querySelector('#alert-sector option:first-child')?.textContent.trim(),
          state: document.querySelector('#alert-state option:first-child')?.textContent.trim(),
          district: document.querySelector('#alert-district option:first-child')?.textContent.trim(),
          severity: document.querySelector('#alert-severity option:first-child')?.textContent.trim(),
          alertType: document.querySelector('#alert-type option:first-child')?.textContent.trim(),
          horizon: document.querySelector('#alert-horizon option:first-child')?.textContent.trim(),
        };
      });
    };

    // 1. Initial English State
    console.log('TEST 1: Initial English Dropdown Options...');
    let options = await getDropdownOptions();
    console.log('  -> Sector:', options.sector);
    console.log('  -> State:', options.state);
    console.log('  -> District:', options.district);
    console.log('  -> Severity:', options.severity);
    console.log('  -> Alert Type:', options.alertType);

    assert.strictEqual(options.sector, 'All Sectors (3)', "Sector option must be 'All Sectors (3)' without duplicate count");
    assert(!options.sector.includes('(3) (3)'), "Sector option must NOT contain duplicated '(3) (3)'");
    assert.strictEqual(options.state, 'All States (3)');
    assert.strictEqual(options.district, 'All Districts (6)');
    assert.strictEqual(options.severity, 'All Severity Tiers (4)');
    console.log('  ✓ PASS: English dropdowns display clean, non-duplicated counts.\n');

    // 2. Select State and verify District updates dynamically without duplication
    console.log('TEST 2: Changing State Filter to Maharashtra (MH)...');
    await page.select('#alert-state', 'MH');
    await new Promise((r) => setTimeout(r, 400));
    options = await getDropdownOptions();
    console.log('  -> Sector:', options.sector);
    console.log('  -> State:', options.state);
    console.log('  -> District (filtered by MH):', options.district);
    assert.strictEqual(options.sector, 'All Sectors (3)');
    assert.strictEqual(options.district, 'All Districts (2)');
    console.log('  ✓ PASS: District option dynamically adjusts to (2) without duplication.\n');

    // 3. Reset filters
    console.log('TEST 3: Resetting Filters...');
    await page.click('.btn-reset-filters');
    await new Promise((r) => setTimeout(r, 400));
    options = await getDropdownOptions();
    console.log('  -> Sector after reset:', options.sector);
    console.log('  -> District after reset:', options.district);
    assert.strictEqual(options.sector, 'All Sectors (3)');
    assert.strictEqual(options.district, 'All Districts (6)');
    console.log('  ✓ PASS: Filters reset cleanly.\n');

    // 4. Hindi Localization
    console.log('TEST 4: Hindi Localization Verification...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.lang-toggle-btn'));
      const hiBtn = btns.find((b) => b.textContent.includes('हिन्दी'));
      if (hiBtn) hiBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    options = await getDropdownOptions();
    console.log('  -> Sector (HI):', options.sector);
    console.log('  -> State (HI):', options.state);
    console.log('  -> District (HI):', options.district);
    console.log('  -> Severity (HI):', options.severity);

    assert.strictEqual(options.sector, 'सभी क्षेत्र (3)', "Hindi sector option must be 'सभी क्षेत्र (3)'");
    assert(!options.sector.includes('(3) (3)'), "Hindi sector option must NOT contain duplicated '(3) (3)'");
    assert.strictEqual(options.state, 'सभी राज्य (3)');
    assert.strictEqual(options.district, 'सभी ज़िले (6)');
    assert.strictEqual(options.severity, 'सभी गंभीरता स्तर (4)');
    console.log('  ✓ PASS: Hindi dropdowns display clean, non-duplicated counts.\n');

    // 5. Also check Forecasts page sector dropdown
    console.log('TEST 5: Checking Forecasts Page Sector Dropdown...');
    await page.goto('http://127.0.0.1:3000/forecasts', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#forecast-sector', { timeout: 15000 });
    const forecastSectorOption = await page.$eval('#forecast-sector option:first-child', (el) => el.textContent.trim());
    console.log('  -> Forecasts Sector Option (HI):', forecastSectorOption);
    assert(!forecastSectorOption.includes('(3) (3)'), "Forecasts sector dropdown must NOT contain '(3) (3)'");
    console.log('  ✓ PASS: Forecasts page sector dropdown verified.\n');

    console.log('================================================================');
    console.log('ALL DROPDOWN VERIFICATION TESTS PASSED (5/5)');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION ERROR:', err);
  process.exit(1);
});
