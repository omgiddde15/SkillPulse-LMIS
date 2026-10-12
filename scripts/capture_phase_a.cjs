const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_DIR = path.resolve(__dirname, '..', 'screenshots', 'reference-parity');
const REF_DIR = path.join(BASE_DIR, 'reference');
const BEFORE_DIR = path.join(BASE_DIR, 'skillpulse-before');

[REF_DIR, BEFORE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ROUTES = [
  { key: '01_home', refPath: '/', localPath: '/' },
  { key: '02_overview', refPath: '/overview', localPath: '/overview' },
  { key: '03_demand', refPath: '/intelligence', localPath: '/demand' },
  { key: '04_gaps', refPath: '/gaps', localPath: '/gaps' },
  { key: '05_forecasts', refPath: '/forecasts', localPath: '/forecasts' },
  { key: '06_alerts', refPath: '/alerts', localPath: '/alerts' },
  { key: '07_recommendations', refPath: '/recommendations', localPath: '/recommendations' },
  { key: '08_scenarios', refPath: '/scenarios', localPath: '/scenarios' },
  { key: '09_districts', refPath: '/districts', localPath: '/districts' },
  { key: '10_occupations', refPath: '/occupations', localPath: '/occupations' },
  { key: '11_qualifications', refPath: '/qualifications', localPath: '/qualifications' },
  { key: '12_data_health', refPath: '/data-health', localPath: '/data-health' },
  { key: '13_api', refPath: '/api', localPath: '/api' },
  { key: '14_settings', refPath: '/settings', localPath: '/settings' },
];

async function capturePhaseA() {
  console.log('================================================================');
  console.log('Phase A: Capturing Reference and SkillPulse (Before) Screens');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const refInspection = {};
  const beforeInspection = {};

  // 1. Capture Reference Site
  console.log('\n--- 1. Capturing Reference (KaushalPulse) ---');
  for (const r of ROUTES) {
    const url = `https://kaushalpulse.vercel.app${r.refPath}`;
    console.log(`Processing reference: ${r.key} -> ${url}`);
    try {
      // Desktop Viewport
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
      await new Promise((res) => setTimeout(res, 2000));

      const desktopShot = path.join(REF_DIR, `${r.key}_desktop.png`);
      await page.screenshot({ path: desktopShot, fullPage: false });

      // Extract metadata
      const meta = await page.evaluate(() => {
        return {
          title: document.title,
          h1: Array.from(document.querySelectorAll('h1')).map((el) => el.innerText.trim()),
          h2: Array.from(document.querySelectorAll('h2')).map((el) => el.innerText.trim()).slice(0, 10),
          h3: Array.from(document.querySelectorAll('h3')).map((el) => el.innerText.trim()).slice(0, 10),
          hasCopilot: Boolean(
            document.querySelector('[aria-label*="copilot" i]') ||
            document.querySelector('[aria-label*="assistant" i]') ||
            document.querySelector('.copilot') ||
            document.body.innerText.includes('Copilot') ||
            document.body.innerText.includes('AI Assistant')
          ),
          kpis: Array.from(document.querySelectorAll('.kpi, [class*="kpi" i], [class*="stat" i], [class*="card" i]'))
            .map((el) => el.innerText.trim().slice(0, 80))
            .filter((t) => t.length > 5)
            .slice(0, 8),
          navButtons: Array.from(document.querySelectorAll('nav a, nav button, aside a, aside button'))
            .map((el) => el.innerText.trim())
            .filter(Boolean),
        };
      });
      refInspection[r.key] = { url, status: 'OK', ...meta };

      // Mobile Viewport
      await page.setViewport({ width: 390, height: 844 });
      await new Promise((res) => setTimeout(res, 800));
      const mobileShot = path.join(REF_DIR, `${r.key}_mobile.png`);
      await page.screenshot({ path: mobileShot, fullPage: false });
      console.log(`  Saved: ${r.key}_desktop.png and ${r.key}_mobile.png`);
    } catch (err) {
      console.error(`  Failed to capture reference ${r.key}: ${err.message}`);
      refInspection[r.key] = { url, status: 'ERROR', error: err.message };
    }
  }

  // 2. Capture SkillPulse (Before)
  console.log('\n--- 2. Capturing SkillPulse (Before) ---');
  for (const r of ROUTES) {
    const url = `http://localhost:3000${r.localPath}`;
    console.log(`Processing SkillPulse before: ${r.key} -> ${url}`);
    try {
      // Desktop Viewport
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise((res) => setTimeout(res, 1500));

      const desktopShot = path.join(BEFORE_DIR, `${r.key}_desktop.png`);
      await page.screenshot({ path: desktopShot, fullPage: false });

      // Extract metadata
      const meta = await page.evaluate(() => {
        return {
          title: document.title,
          h1: Array.from(document.querySelectorAll('h1')).map((el) => el.innerText.trim()),
          h2: Array.from(document.querySelectorAll('h2')).map((el) => el.innerText.trim()).slice(0, 10),
          h3: Array.from(document.querySelectorAll('h3')).map((el) => el.innerText.trim()).slice(0, 10),
          bodySnippet: document.body.innerText.slice(0, 300),
        };
      });
      beforeInspection[r.key] = { url, status: 'OK', ...meta };

      // Mobile Viewport
      await page.setViewport({ width: 390, height: 844 });
      await new Promise((res) => setTimeout(res, 800));
      const mobileShot = path.join(BEFORE_DIR, `${r.key}_mobile.png`);
      await page.screenshot({ path: mobileShot, fullPage: false });
      console.log(`  Saved: ${r.key}_desktop.png and ${r.key}_mobile.png`);
    } catch (err) {
      console.error(`  Failed to capture SkillPulse ${r.key}: ${err.message}`);
      beforeInspection[r.key] = { url, status: 'ERROR', error: err.message };
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(BASE_DIR, 'reference_inspection.json'), JSON.stringify(refInspection, null, 2), 'utf8');
  fs.writeFileSync(path.join(BASE_DIR, 'skillpulse_before_inspection.json'), JSON.stringify(beforeInspection, null, 2), 'utf8');
  console.log('\nPhase A captures complete! Inspection logs written.');
}

capturePhaseA();
