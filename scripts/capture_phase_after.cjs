const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_DIR = path.resolve(__dirname, '..', 'screenshots', 'reference-parity');
const AFTER_DIR = path.join(BASE_DIR, 'skillpulse-after');

if (!fs.existsSync(AFTER_DIR)) {
  fs.mkdirSync(AFTER_DIR, { recursive: true });
}

const ROUTES = [
  { key: '01_home', localPath: '/' },
  { key: '02_overview', localPath: '/overview' },
  { key: '03_demand', localPath: '/demand' },
  { key: '04_gaps', localPath: '/gaps' },
  { key: '05_forecasts', localPath: '/forecasts' },
  { key: '06_alerts', localPath: '/alerts' },
  { key: '07_recommendations', localPath: '/recommendations' },
  { key: '08_scenarios', localPath: '/scenarios' },
  { key: '09_districts', localPath: '/districts' },
  { key: '10_occupations', localPath: '/occupations' },
  { key: '11_qualifications', localPath: '/qualifications' },
  { key: '12_data_health', localPath: '/data-health' },
  { key: '13_api', localPath: '/api' },
  { key: '14_settings', localPath: '/settings' },
];

async function capturePhaseAfter() {
  console.log('================================================================');
  console.log('Phase G: Capturing SkillPulse (After) Reference-Parity Screens');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const afterInspection = {};

  for (const r of ROUTES) {
    const url = `http://localhost:3000${r.localPath}`;
    console.log(`Processing SkillPulse After: ${r.key} -> ${url}`);
    try {
      // Desktop Viewport (1440x1000)
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise((res) => setTimeout(res, 1800));

      const desktopShot = path.join(AFTER_DIR, `${r.key}_desktop.png`);
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
            document.body.innerText.includes('Copilot')
          ),
          kpis: Array.from(document.querySelectorAll('.kpi, [class*="kpi" i], [class*="stat" i], [class*="card" i]'))
            .map((el) => el.innerText.trim().slice(0, 80))
            .filter((t) => t.length > 5)
            .slice(0, 8),
          navButtons: Array.from(document.querySelectorAll('nav a, nav button, aside a, aside button'))
            .map((el) => el.innerText.trim())
            .filter(Boolean),
          bodySnippet: document.body.innerText.slice(0, 300),
        };
      });
      afterInspection[r.key] = { url, status: 'OK', ...meta };

      // Mobile Viewport (390x844)
      await page.setViewport({ width: 390, height: 844 });
      await new Promise((res) => setTimeout(res, 1000));
      const mobileShot = path.join(AFTER_DIR, `${r.key}_mobile.png`);
      await page.screenshot({ path: mobileShot, fullPage: false });
      console.log(`  Saved: ${r.key}_desktop.png and ${r.key}_mobile.png`);
    } catch (err) {
      console.error(`  Failed to capture SkillPulse After ${r.key}: ${err.message}`);
      afterInspection[r.key] = { url, status: 'ERROR', error: err.message };
    }
  }

  // Also capture Copilot Drawer Open on Overview
  try {
    console.log('\nCapturing Copilot Drawer Interaction on Overview...');
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://localhost:3000/overview', { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise((res) => setTimeout(res, 1500));

    // Click Copilot button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => b.innerText.includes('Copilot') || b.getAttribute('title')?.includes('Copilot'));
      if (target) target.click();
    });
    await new Promise((res) => setTimeout(res, 1000));
    const copilotShot = path.join(AFTER_DIR, '02b_copilot_drawer_open_desktop.png');
    await page.screenshot({ path: copilotShot, fullPage: false });
    console.log('  Saved: 02b_copilot_drawer_open_desktop.png');
  } catch (err) {
    console.warn('  Copilot interaction capture error:', err.message);
  }

  await browser.close();

  fs.writeFileSync(path.join(BASE_DIR, 'skillpulse_after_inspection.json'), JSON.stringify(afterInspection, null, 2), 'utf8');
  console.log('\nPhase G captures complete! After inspection logs written.');
}

capturePhaseAfter();
