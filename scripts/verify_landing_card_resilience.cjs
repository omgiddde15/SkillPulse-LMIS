const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runResilienceVerification() {
  console.log('Launching Chrome for Landing Card Resilience Verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 960 }
  });

  const page = await browser.newPage();
  const report = {};

  try {
    // =========================================================================
    // SCENARIO A: Normal Operation (API Available)
    // =========================================================================
    console.log('\n--- SCENARIO A: API Available ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const normalCard = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card');
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasUnavailableMsg: text.includes('Pilot metrics unavailable') || text.includes('पायलट मेट्रिक्स अनुपलब्ध'),
        hasLoadingMsg: text.includes('Loading live pilot metrics'),
        hasDemand73_1: text.includes('73.1'),
        hasSupply17_0: text.includes('17.0'),
        hasMismatch56_1: text.includes('+56.1'),
        hasCNC: text.includes('CNC Machine Operator'),
        hasDharwad: text.includes('Dharwad'),
        rawSnippet: text.slice(0, 200),
      };
    });

    console.log('Scenario A (API Available) Card State:', normalCard);
    report.scenarioA_available = normalCard;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'resilience_01_api_available.png') });

    // =========================================================================
    // SCENARIO B: Deliberate API Failure / Network Block
    // =========================================================================
    console.log('\n--- SCENARIO B: API Deliberately Blocked (HTTP 503) ---');
    await page.setRequestInterception(true);

    let blockApi = true;
    page.on('request', (req) => {
      if (blockApi && req.url().includes('/api/v1/gap-analysis')) {
        console.log('   [Mock] Intercepting and failing request:', req.url());
        req.respond({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Service Temporarily Unavailable (Simulated Outage)' }),
        });
      } else {
        req.continue();
      }
    });

    // Reload page under failure conditions
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const failedCard = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card');
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasUnavailableMsg: text.includes('Pilot metrics unavailable') || text.includes('पायलट मेट्रिक्स अनुपलब्ध'),
        hasRetryButton: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes('Retry') || b.innerText.includes('पुनः प्रयास करें')),
        // Check strictly that NO metrics numbers appear
        hasDemand73_1: text.includes('73.1'),
        hasSupply17_0: text.includes('17.0'),
        hasMismatch56_1: text.includes('56.1'),
        hasDemand84_2: text.includes('84.2'),
        hasSupply28_1: text.includes('28.1'),
        containsAnyFabricatedNumbers: text.includes('73.1') || text.includes('17.0') || text.includes('56.1') || text.includes('84.2') || text.includes('28.1'),
        cardText: text.trim(),
      };
    });

    console.log('Scenario B (API Blocked) Card State:', failedCard);
    report.scenarioB_unavailable = failedCard;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'resilience_02_api_unavailable.png') });

    // =========================================================================
    // SCENARIO C: Retry Recovery when API Restores
    // =========================================================================
    console.log('\n--- SCENARIO C: Retry Recovery when API Restores ---');
    blockApi = false; // Restore network

    const clickedRetry = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card');
      const retryBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes('Retry') || b.innerText.includes('पुनः प्रयास करें'));
      if (retryBtn) { retryBtn.click(); return true; }
      return false;
    });
    console.log('Clicked Retry button:', clickedRetry);
    await new Promise(r => setTimeout(r, 2000));

    const restoredCard = await page.evaluate(() => {
      const card = document.querySelector('.landing-hero-card');
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasUnavailableMsg: text.includes('Pilot metrics unavailable'),
        hasDemand73_1: text.includes('73.1'),
        hasSupply17_0: text.includes('17.0'),
        hasMismatch56_1: text.includes('+56.1'),
        hasCNC: text.includes('CNC Machine Operator'),
      };
    });

    console.log('Scenario C (After Retry) Card State:', restoredCard);
    report.scenarioC_retryRestored = restoredCard;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'resilience_03_retry_restored.png') });

    console.log('\n======================================================');
    console.log('RESILIENCE TEST SUMMARY:');
    console.log(JSON.stringify(report, null, 2));
    console.log('======================================================');

    fs.writeFileSync(path.resolve(SCREENSHOT_DIR, 'resilience_results.json'), JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('Resilience verification failed:', err);
  } finally {
    await browser.close();
    console.log('Chrome closed.');
  }
}

runResilienceVerification();
