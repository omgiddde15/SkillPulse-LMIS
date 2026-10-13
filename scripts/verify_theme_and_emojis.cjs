const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:3000';
const SCREENSHOT_BASE = path.resolve(__dirname, '..', 'screenshots', 'theme-upgrade');
const LIGHT_DIR = path.join(SCREENSHOT_BASE, 'after-light');
const DARK_DIR = path.join(SCREENSHOT_BASE, 'after-dark');

fs.mkdirSync(LIGHT_DIR, { recursive: true });
fs.mkdirSync(DARK_DIR, { recursive: true });

const DASHBOARD_TABS = [
  { id: 'overview', filePrefix: '02_overview', label: 'Overview' },
  { id: 'demand', filePrefix: '03_demand', label: 'Demand Intelligence' },
  { id: 'gap', filePrefix: '04_supply_gaps', label: 'Supply & Gaps' },
  { id: 'forecasts', filePrefix: '05_forecasts', label: 'Forecasts' },
  { id: 'alerts', filePrefix: '06_alerts', label: 'Early Warnings' },
  { id: 'recommendations', filePrefix: '07_recommendations', label: 'Recommendations' },
  { id: 'simulator', filePrefix: '08_simulator', label: 'Scenario Studio' },
  { id: 'districts', filePrefix: '09_districts', label: 'Districts' },
  { id: 'occupations', filePrefix: '10_occupations', label: 'Occupations' },
  { id: 'qualifications', filePrefix: '11_qualifications', label: 'Qualifications' },
  { id: 'data-health', filePrefix: '12_data_health', label: 'Data & Model Health' },
  { id: 'api', filePrefix: '13_api_exports', label: 'API & Exports' },
  { id: 'settings', filePrefix: '14_settings', label: 'Settings' },
];

function parseRgbLuminance(rgbStr) {
  if (!rgbStr) return null;
  const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

async function runVerification() {
  console.log('================================================================');
  console.log('SkillPulse LMIS — Theme Switch, Emoji Audit & Claims Verification');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 1000 },
  });

  const page = await browser.newPage();
  const report = {
    timestamp: new Date().toISOString(),
    checks: [],
    routesChecked: [],
    intentionalUnicodeSummary: {},
    passed: 0,
    failed: 0,
  };

  function assertCheck(name, condition, details = {}) {
    const status = condition ? 'PASS' : 'FAIL';
    report.checks.push({ name, status, details });
    if (condition) {
      report.passed += 1;
      console.log(`[PASS] ${name}`);
    } else {
      report.failed += 1;
      console.error(`[FAIL] ${name}`, JSON.stringify(details));
    }
  }

  try {
    // 1. Clear localStorage and load Home page — verify default Dark theme
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    const defaultThemeState = await page.evaluate(() => {
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyColor = getComputedStyle(document.body).color;
      const darkBtn = document.querySelector('[data-testid="theme-toggle-dark"]');
      const lightBtn = document.querySelector('[data-testid="theme-toggle-light"]');
      return {
        htmlTheme,
        bodyBg,
        bodyColor,
        hasToggle: Boolean(darkBtn && lightBtn),
        darkAriaPressed: darkBtn?.getAttribute('aria-pressed'),
        lightAriaPressed: lightBtn?.getAttribute('aria-pressed'),
      };
    });

    assertCheck(
      '1. Default theme is Dark on Home with accessible toggle state',
      defaultThemeState.htmlTheme === 'dark' &&
        defaultThemeState.hasToggle &&
        defaultThemeState.darkAriaPressed === 'true' &&
        defaultThemeState.lightAriaPressed === 'false' &&
        parseRgbLuminance(defaultThemeState.bodyBg) < 0.15 &&
        parseRgbLuminance(defaultThemeState.bodyColor) > 0.85,
      defaultThemeState
    );

    // 2. Activate Light theme on Home page & verify surface/text color change + localStorage
    await page.click('[data-testid="theme-toggle-light"]');
    await new Promise((r) => setTimeout(r, 600));

    const homeLightState = await page.evaluate(() => {
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      const stored = localStorage.getItem('skillpulse_theme');
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyColor = getComputedStyle(document.body).color;
      const heroCard = document.querySelector('.landing-hero-card');
      const heroCardBg = heroCard ? getComputedStyle(heroCard).backgroundColor : null;
      const darkBtn = document.querySelector('[data-testid="theme-toggle-dark"]');
      const lightBtn = document.querySelector('[data-testid="theme-toggle-light"]');
      return {
        htmlTheme,
        stored,
        bodyBg,
        bodyColor,
        heroCardBg,
        darkAriaPressed: darkBtn?.getAttribute('aria-pressed'),
        lightAriaPressed: lightBtn?.getAttribute('aria-pressed'),
      };
    });

    assertCheck(
      '2. Light theme activates on Home and changes surfaces & text colors',
      homeLightState.htmlTheme === 'light' &&
        homeLightState.stored === 'light' &&
        homeLightState.lightAriaPressed === 'true' &&
        homeLightState.darkAriaPressed === 'false' &&
        parseRgbLuminance(homeLightState.bodyBg) > 0.85 &&
        parseRgbLuminance(homeLightState.bodyColor) < 0.25 &&
        parseRgbLuminance(homeLightState.heroCardBg) > 0.85,
      homeLightState
    );

    // 3. Verify persistence across full browser reload
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    const postReloadLight = await page.evaluate(() => ({
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('skillpulse_theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    }));

    assertCheck(
      '3. Selected Light theme persists after full browser reload',
      postReloadLight.htmlTheme === 'light' &&
        postReloadLight.stored === 'light' &&
        parseRgbLuminance(postReloadLight.bodyBg) > 0.85,
      postReloadLight
    );

    // 4. Test keyboard operation on ThemeToggle (ArrowRight switches to Dark, ArrowLeft switches back to Light)
    await page.focus('[data-testid="theme-toggle-light"]');
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 300));
    const afterArrowRight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await page.keyboard.press('ArrowLeft');
    await new Promise((r) => setTimeout(r, 300));
    const afterArrowLeft = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    assertCheck(
      '4. ThemeToggle supports keyboard operation (ArrowRight -> dark, ArrowLeft -> light)',
      afterArrowRight === 'dark' && afterArrowLeft === 'light',
      { afterArrowRight, afterArrowLeft }
    );

    // Capture Light Home screenshots (desktop + mobile)
    await page.setViewport({ width: 1440, height: 1000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(LIGHT_DIR, '01_home_desktop.png'), fullPage: true });

    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(LIGHT_DIR, '01_home_mobile.png'), fullPage: true });
    await page.setViewport({ width: 1440, height: 1000 });
    await new Promise((r) => setTimeout(r, 400));

    // Check Home page for emojis & unsupported claims in EN and HI
    async function auditRouteContent(routeName, expectedTheme) {
      const result = await page.evaluate((expTheme) => {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const bodyColor = getComputedStyle(document.body).color;
        const text = document.body.innerText;

        // Visible emoji check (Extended_Pictographic + miscellaneous decorative symbols, excluding standard copyright/trademark U+00A9/U+00AE/U+2122)
        const emojiRegex = /[\p{Extended_Pictographic}\u23F3\u2696\u26A0\u26A1\u2699]/gu;
        const emojisFound = Array.from(
          new Set((text.match(emojiRegex) || []).filter((ch) => !['\u00A9', '\u00AE', '\u2122'].includes(ch)))
        );

        // Unsupported claims check
        const unsupportedRegex = /SARIMA|LightGBM|Random Forest|Gradient Boosting|11\.8%|88%\s*6M|SHAP|LP\s+Solver|Official\s+SIH\s+Dataset|NATIONAL\s+INTELLIGENCE\s+DASHBOARD|18\.6%\s*6M|0\.70\s*Readiness|STRUCTURAL\s+SHORTFALL|Severe\s+Shortfall|linear\s+donor\s+non-depletion/gi;
        const unsupportedFound = Array.from(new Set(text.match(unsupportedRegex) || []));

        // Check major surface elements for theme consistency
        const panels = Array.from(document.querySelectorAll('.card-panel, .stat-card, .landing-hero-card, .app-header, .app-sidebar'));
        let stuckCount = 0;
        const stuckSamples = [];
        for (const el of panels.slice(0, 15)) {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) {
            const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255;
            if (expTheme === 'light' && lum < 0.25) {
              stuckCount += 1;
              stuckSamples.push({ className: el.className, bg });
            } else if (expTheme === 'dark' && lum > 0.75) {
              stuckCount += 1;
              stuckSamples.push({ className: el.className, bg });
            }
          }
        }

        // Collect non-ASCII non-Devanagari technical Unicode characters for reporting
        const nonAscii = Array.from(new Set(Array.from(text).filter((ch) => {
          const cp = ch.codePointAt(0);
          return cp > 127 && !(cp >= 0x0900 && cp <= 0x097F);
        })));

        return {
          htmlTheme,
          bodyBg,
          bodyColor,
          emojisFound,
          unsupportedFound,
          stuckCount,
          stuckSamples,
          nonAscii,
        };
      }, expectedTheme);

      for (const ch of result.nonAscii) {
        report.intentionalUnicodeSummary[ch] = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
      }

      return result;
    }

    const homeEnLightAudit = await auditRouteContent('home (EN, light)', 'light');
    assertCheck(
      '5. Home page (EN, Light) has zero emojis, zero unsupported claims, and no stuck dark panels',
      homeEnLightAudit.emojisFound.length === 0 &&
        homeEnLightAudit.unsupportedFound.length === 0 &&
        homeEnLightAudit.stuckCount === 0,
      homeEnLightAudit
    );

    // Navigate from Home into Dashboard Overview — verify Light theme stays consistent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Launch Intelligence Platform') || b.innerText.includes('Open Dashboard')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1800));

    const overviewAfterNav = await page.evaluate(() => ({
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      headerHasToggle: Boolean(document.querySelector('.app-header [data-testid="theme-toggle"]')),
      lightPressed: document.querySelector('.app-header [data-testid="theme-toggle-light"]')?.getAttribute('aria-pressed'),
    }));

    assertCheck(
      '6. Theme stays consistent (Light) when navigating from Home into Dashboard Overview',
      overviewAfterNav.htmlTheme === 'light' &&
        overviewAfterNav.headerHasToggle &&
        overviewAfterNav.lightPressed === 'true',
      overviewAfterNav
    );

    // Audit all 13 Dashboard Modules in LIGHT theme (English) + capture desktop & mobile screenshots
    for (const tab of DASHBOARD_TABS) {
      await page.evaluate((tabId) => {
        const btn = document.querySelector(`button[data-tab="${tabId}"]`);
        if (btn) btn.click();
      }, tab.id);
      await new Promise((r) => setTimeout(r, 1400));

      // Open interactive sub-views where applicable so below-the-fold drawers are audited too
      if (tab.id === 'forecasts' || tab.id === 'alerts') {
        await page.evaluate(() => {
          const btn = document.querySelector('table tbody tr td button.btn-refresh');
          if (btn) btn.click();
        });
        await new Promise((r) => setTimeout(r, 500));
      }

      const audit = await auditRouteContent(`${tab.id} (EN, light)`, 'light');
      report.routesChecked.push({ route: tab.id, lang: 'en', theme: 'light', emojis: audit.emojisFound.length, stuckPanels: audit.stuckCount });

      assertCheck(
        `Route [${tab.label}] (EN, Light): theme active, 0 emojis, 0 unsupported claims, 0 stuck panels`,
        audit.htmlTheme === 'light' &&
          audit.emojisFound.length === 0 &&
          audit.unsupportedFound.length === 0 &&
          audit.stuckCount === 0,
        audit
      );

      await page.setViewport({ width: 1440, height: 1000 });
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: path.join(LIGHT_DIR, `${tab.filePrefix}_desktop.png`), fullPage: true });

      await page.setViewport({ width: 390, height: 844 });
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: path.join(LIGHT_DIR, `${tab.filePrefix}_mobile.png`), fullPage: true });
      await page.setViewport({ width: 1440, height: 1000 });
    }

    // Also open & audit Copilot Drawer in Light theme
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.app-header button')).find((b) =>
        b.innerText.includes('Copilot') || b.innerText.includes('सह-पायलट')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const copilotLightAudit = await auditRouteContent('copilot-drawer (EN, light)', 'light');
    assertCheck(
      'Copilot Drawer (EN, Light): 0 emojis, 0 unsupported claims, readable light surface',
      copilotLightAudit.emojisFound.length === 0 && copilotLightAudit.unsupportedFound.length === 0,
      copilotLightAudit
    );
    await page.screenshot({ path: path.join(LIGHT_DIR, '15_copilot_drawer_desktop.png') });
    // Close Copilot
    await page.evaluate(() => {
      const overlay = document.querySelector('.copilot-drawer-overlay');
      if (overlay) overlay.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Switch to DARK theme using Header toggle & verify persistence across reload
    await page.click('.app-header [data-testid="theme-toggle-dark"]');
    await new Promise((r) => setTimeout(r, 600));
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1400));

    const darkRestoreCheck = await page.evaluate(() => ({
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('skillpulse_theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
    }));

    assertCheck(
      '7. Dark theme activates from Header and persists across reload',
      darkRestoreCheck.htmlTheme === 'dark' &&
        darkRestoreCheck.stored === 'dark' &&
        parseRgbLuminance(darkRestoreCheck.bodyBg) < 0.15 &&
        parseRgbLuminance(darkRestoreCheck.bodyColor) > 0.85,
      darkRestoreCheck
    );

    // Audit all 13 Dashboard Modules in DARK theme + capture desktop & mobile screenshots
    for (const tab of DASHBOARD_TABS) {
      await page.evaluate((tabId) => {
        const btn = document.querySelector(`button[data-tab="${tabId}"]`);
        if (btn) btn.click();
      }, tab.id);
      await new Promise((r) => setTimeout(r, 1200));

      const audit = await auditRouteContent(`${tab.id} (EN, dark)`, 'dark');
      report.routesChecked.push({ route: tab.id, lang: 'en', theme: 'dark', emojis: audit.emojisFound.length, stuckPanels: audit.stuckCount });

      assertCheck(
        `Route [${tab.label}] (EN, Dark): theme active, 0 emojis, 0 unsupported claims, 0 stuck panels`,
        audit.htmlTheme === 'dark' &&
          audit.emojisFound.length === 0 &&
          audit.unsupportedFound.length === 0 &&
          audit.stuckCount === 0,
        audit
      );

      await page.setViewport({ width: 1440, height: 1000 });
      await new Promise((r) => setTimeout(r, 250));
      await page.screenshot({ path: path.join(DARK_DIR, `${tab.filePrefix}_desktop.png`), fullPage: true });

      await page.setViewport({ width: 390, height: 844 });
      await new Promise((r) => setTimeout(r, 250));
      await page.screenshot({ path: path.join(DARK_DIR, `${tab.filePrefix}_mobile.png`), fullPage: true });
      await page.setViewport({ width: 1440, height: 1000 });
    }

    // Open & capture Copilot Drawer in Dark theme
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.app-header button')).find((b) =>
        b.innerText.includes('Copilot') || b.innerText.includes('कोपायलट')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const copilotDarkAudit = await auditRouteContent('copilot-drawer (EN, dark)', 'dark');
    assertCheck(
      'Copilot Drawer (EN, Dark): 0 emojis, 0 unsupported claims, readable dark surface',
      copilotDarkAudit.emojisFound.length === 0 && copilotDarkAudit.unsupportedFound.length === 0,
      copilotDarkAudit
    );
    await page.screenshot({ path: path.join(DARK_DIR, '15_copilot_drawer_desktop.png') });
    await page.evaluate(() => {
      const overlay = document.querySelector('.copilot-drawer-overlay');
      if (overlay) overlay.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Switch to Hindi ('hi') and audit all 13 Dashboard Modules + Home for emojis in Hindi
    await page.evaluate(() => {
      const hiBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'हिन्दी');
      if (hiBtn) hiBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    for (const tab of DASHBOARD_TABS) {
      await page.evaluate((tabId) => {
        const btn = document.querySelector(`button[data-tab="${tabId}"]`);
        if (btn) btn.click();
      }, tab.id);
      await new Promise((r) => setTimeout(r, 900));

      const auditHi = await auditRouteContent(`${tab.id} (HI, dark)`, 'dark');
      report.routesChecked.push({ route: tab.id, lang: 'hi', theme: 'dark', emojis: auditHi.emojisFound.length, stuckPanels: auditHi.stuckCount });

      assertCheck(
        `Route [${tab.label}] (HI, Dark): 0 emojis in Hindi`,
        auditHi.emojisFound.length === 0,
        { emojisFound: auditHi.emojisFound }
      );
    }

    // Navigate back to Home in Hindi, verify 0 emojis on Home in Hindi, then switch back to English and capture Dark Home screenshots
    await page.evaluate(() => {
      const homeBtn = Array.from(document.querySelectorAll('.app-header button')).find((b) =>
        b.innerText.includes('Home') || b.innerText.includes('होम')
      );
      if (homeBtn) homeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const homeHiAudit = await auditRouteContent('home (HI, dark)', 'dark');
    report.routesChecked.push({ route: 'home', lang: 'hi', theme: 'dark', emojis: homeHiAudit.emojisFound.length, stuckPanels: homeHiAudit.stuckCount });
    assertCheck(
      'Route [Home] (HI, Dark): 0 emojis in Hindi',
      homeHiAudit.emojisFound.length === 0,
      { emojisFound: homeHiAudit.emojisFound }
    );

    await page.evaluate(() => {
      const enBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'EN');
      if (enBtn) enBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.setViewport({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(DARK_DIR, '01_home_desktop.png'), fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(DARK_DIR, '01_home_mobile.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SCREENSHOT_BASE, 'verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n================================================================');
  console.log(`Verification Complete: ${report.passed} passed, ${report.failed} failed`);
  console.log('Intentional technical Unicode characters retained:', report.intentionalUnicodeSummary);
  console.log(`Report written to: ${reportPath}`);
  console.log('================================================================');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runVerification();
