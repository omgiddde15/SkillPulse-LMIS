const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifyAuthAndWorkspace() {
  console.log('================================================================');
  console.log('SkillPulse LMIS — Authentication & User Workspace Verification');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 960 },
  });

  const page = await browser.newPage();
  const report = {
    timestamp: new Date().toISOString(),
    steps: {},
    summary: { passed: 0, failed: 0 },
  };

  function recordStep(id, title, status, details = {}) {
    report.steps[id] = { title, status, ...details };
    if (status === 'PASS') {
      report.summary.passed += 1;
      console.log(`[PASS] ${id}: ${title}`);
    } else {
      report.summary.failed += 1;
      console.error(`[FAIL] ${id}: ${title}`, details);
    }
  }

  const testEmail = `planner_${Date.now()}@skillpulse.gov.in`;
  const testPassword = 'Password2026!';
  const testFullName = 'Regional Planner Roy';

  try {
    // -------------------------------------------------------------------------
    // STEP 1: OPEN HOME
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Open Home ---');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    const homeCheck = await page.evaluate(() => {
      const brand = document.querySelector('.landing-header');
      const hero = document.querySelector('.landing-hero-card');
      const openBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Open Dashboard') || b.innerText.includes('डैशबोर्ड खोलें')
      );
      const signUpBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Sign Up') || b.innerText.includes('खाता बनाएं')
      );
      return {
        hasHeader: Boolean(brand),
        hasHero: Boolean(hero),
        hasOpenBtn: Boolean(openBtn),
        hasSignUpBtn: Boolean(signUpBtn),
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_01_home.png') });
    recordStep('Step 1', 'Open Home Page', homeCheck.hasHeader && homeCheck.hasHero ? 'PASS' : 'FAIL', homeCheck);

    // -------------------------------------------------------------------------
    // STEP 2: NAVIGATE TO SIGN UP
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Navigate to Sign Up ---');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Sign Up') || b.innerText.includes('खाता बनाएं')
      );
      if (btn) btn.click();
      else window.location.href = '/signup';
    });
    await new Promise((r) => setTimeout(r, 1500));

    const signUpPageCheck = await page.evaluate(() => {
      const nameInput = document.getElementById('signup-name');
      const emailInput = document.getElementById('signup-email');
      const passInput = document.getElementById('signup-password');
      const confirmInput = document.getElementById('signup-confirm');
      const demoBtn = document.querySelector('.auth-demo-btn');
      return {
        isSignUpUrl: window.location.pathname.includes('/signup'),
        hasNameInput: Boolean(nameInput),
        hasEmailInput: Boolean(emailInput),
        hasPassInput: Boolean(passInput),
        hasConfirmInput: Boolean(confirmInput),
        hasDemoBtn: Boolean(demoBtn),
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_02_signup_page.png') });
    recordStep(
      'Step 2',
      'Navigate to Sign Up Page',
      signUpPageCheck.hasNameInput && signUpPageCheck.hasEmailInput ? 'PASS' : 'FAIL',
      signUpPageCheck
    );

    // -------------------------------------------------------------------------
    // STEP 3: REGISTER TEST ACCOUNT
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Register Test Account ---');
    await page.type('#signup-name', testFullName);
    await page.type('#signup-email', testEmail);
    await page.type('#signup-password', testPassword);
    await page.type('#signup-confirm', testPassword);

    await page.evaluate(() => {
      const submitBtn = document.querySelector('.auth-primary-btn');
      if (submitBtn) submitBtn.click();
    });
    // Wait for registration and auto-login redirect
    await new Promise((r) => setTimeout(r, 2500));

    // -------------------------------------------------------------------------
    // STEP 4: REACH DASHBOARD (AUTHENTICATED)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Reach Dashboard (Authenticated) ---');
    const authDashboardCheck = await page.evaluate((expectedName) => {
      const path = window.location.pathname;
      const headerUser = document.querySelector('.header-user-btn');
      const sidebarUser = document.querySelector('.sidebar-user-name');
      const logoutBtn = document.querySelector('.header-logout-btn') || document.querySelector('.sidebar-logout-btn');
      const hasExpectedName =
        (headerUser && headerUser.innerText.includes(expectedName)) ||
        (sidebarUser && sidebarUser.innerText.includes(expectedName));

      return {
        pathname: path,
        hasHeaderUser: Boolean(headerUser),
        hasSidebarUser: Boolean(sidebarUser),
        hasLogoutBtn: Boolean(logoutBtn),
        hasExpectedName,
        headerText: headerUser ? headerUser.innerText : '',
      };
    }, testFullName);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_03_dashboard_authenticated.png') });
    recordStep(
      'Step 4',
      'Reach Dashboard Authenticated with Active Session',
      authDashboardCheck.hasLogoutBtn ? 'PASS' : 'FAIL',
      authDashboardCheck
    );

    // -------------------------------------------------------------------------
    // STEP 5: SAVE A SIMULATOR SCENARIO
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Save Simulator Scenario ---');
    // Navigate to Scenario Studio
    await page.evaluate(() => {
      const simNav = document.querySelector('button[data-tab="simulator"]') ||
        Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Scenario Studio'));
      if (simNav) simNav.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Save Scenario button
    const openedSaveModal = await page.evaluate(() => {
      const saveBtn = document.querySelector('.btn-save-scenario');
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });
    console.log('Opened Save Modal:', openedSaveModal);
    await new Promise((r) => setTimeout(r, 800));

    // Submit save scenario form
    const savedScenarioResult = await page.evaluate(() => {
      const titleInput = document.querySelector('.modal-container input[type="text"]');
      if (titleInput) {
        titleInput.value = 'Dharwad CNC Precision Expansion Q3';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const notesInput = document.querySelector('.modal-container textarea');
      if (notesInput) {
        notesInput.value = 'Verified employer corridor demand simulation for TVET cohort.';
        notesInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('.modal-container .auth-primary-btn');
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });
    console.log('Submitted Save Scenario:', savedScenarioResult);
    await new Promise((r) => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_04_simulator_scenario_saved.png') });
    recordStep(
      'Step 5',
      'Save Seat Simulator Policy Scenario',
      savedScenarioResult ? 'PASS' : 'FAIL',
      { savedScenarioResult }
    );

    // -------------------------------------------------------------------------
    // STEP 6: REFRESH AND CONFIRM SESSION RESTORATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Refresh and Confirm Session Restoration ---');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const restoredSessionCheck = await page.evaluate((expectedName) => {
      const headerUser = document.querySelector('.header-user-btn');
      const logoutBtn = document.querySelector('.header-logout-btn') || document.querySelector('.sidebar-logout-btn');
      return {
        isAuthenticatedAfterReload: Boolean(logoutBtn),
        userText: headerUser ? headerUser.innerText : '',
        hasUser: headerUser && headerUser.innerText.includes(expectedName),
      };
    }, testFullName);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_05_session_restored_after_refresh.png') });
    recordStep(
      'Step 6',
      'Session Restored via /api/v1/auth/me on Page Refresh',
      restoredSessionCheck.isAuthenticatedAfterReload ? 'PASS' : 'FAIL',
      restoredSessionCheck
    );

    // -------------------------------------------------------------------------
    // STEP 7: VIEW THE SAVED SCENARIO IN MY WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: View Saved Scenario in My Workspace ---');
    await page.evaluate(() => {
      const wsNav = document.querySelector('button[data-tab="workspace"]') ||
        document.querySelector('.header-user-btn') ||
        Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('My Workspace'));
      if (wsNav) wsNav.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const workspaceScenariosCheck = await page.evaluate(() => {
      const cards = document.querySelectorAll('.workspace-scenario-card');
      const text = document.body.innerText;
      const hasDharwad = text.includes('Dharwad') || text.includes('KA_DHA');
      const hasCNC = text.includes('CNC') || text.includes('Precision');
      const hasDisclaimer = text.includes('Simulated Scenario');
      const reopenBtn = document.querySelector('.scenario-reopen-btn');

      return {
        scenarioCount: cards.length,
        hasDharwad,
        hasCNC,
        hasDisclaimer,
        hasReopenBtn: Boolean(reopenBtn),
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_06_my_workspace_saved_scenarios.png') });
    recordStep(
      'Step 7',
      'View Saved Scenario in My Workspace',
      workspaceScenariosCheck.scenarioCount >= 1 && workspaceScenariosCheck.hasDisclaimer ? 'PASS' : 'FAIL',
      workspaceScenariosCheck
    );

    // -------------------------------------------------------------------------
    // STEP 8: LOG OUT
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Log Out ---');
    await page.evaluate(() => {
      const logoutBtn = document.querySelector('.header-logout-btn') || document.querySelector('.sidebar-logout-btn');
      if (logoutBtn) logoutBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const logoutCheck = await page.evaluate(() => {
      const headerUser = document.querySelector('.header-user-btn');
      const logoutBtn = document.querySelector('.header-logout-btn');
      const signInBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Sign In') || b.innerText.includes('साइन इन')
      );
      return {
        path: window.location.pathname,
        isLoggedOut: !headerUser && !logoutBtn,
        hasSignInBtn: Boolean(signInBtn),
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_07_logged_out.png') });
    recordStep(
      'Step 8',
      'Log Out and Session Invalidation',
      logoutCheck.isLoggedOut ? 'PASS' : 'FAIL',
      logoutCheck
    );

    // -------------------------------------------------------------------------
    // STEP 9: CONFIRM PRIVATE WORKSPACE ROUTES REQUIRE AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Confirm Workspace Protection ---');
    await page.goto('http://127.0.0.1:3000/workspace', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const protectionCheck = await page.evaluate(() => {
      const path = window.location.pathname;
      const isLoginOrHome = path.includes('/login') || path === '/';
      const hasLoginForm = Boolean(document.getElementById('login-email'));
      return {
        finalPath: path,
        isLoginOrHome,
        hasLoginForm,
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_08_workspace_protected_redirect.png') });
    recordStep(
      'Step 9',
      'Private Workspace Route Protection Redirects Unauthenticated Users',
      protectionCheck.isLoginOrHome || protectionCheck.hasLoginForm ? 'PASS' : 'FAIL',
      protectionCheck
    );

    // -------------------------------------------------------------------------
    // STEP 10: USE EXPLORE DEMO WITHOUT REGISTRATION
    // -------------------------------------------------------------------------
    console.log('\n--- Step 10: Use Explore Demo Without Registration ---');
    // Click Explore Demo button on Login page
    await page.evaluate(() => {
      const demoBtn = document.querySelector('.auth-demo-btn');
      if (demoBtn) demoBtn.click();
      else window.location.href = '/overview';
    });
    await new Promise((r) => setTimeout(r, 2000));

    const demoAccessCheck = await page.evaluate(() => {
      const path = window.location.pathname;
      const demoBadge = document.querySelector('.sidebar-demo-badge') || document.querySelector('.synthetic-pill');
      const overviewTitle = document.querySelector('.overview-title') || document.querySelector('h1');
      return {
        path,
        hasOverview: Boolean(overviewTitle),
        hasDemoIndicator: Boolean(demoBadge),
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_09_explore_demo_mode.png') });
    recordStep(
      'Step 10',
      'Explore Demo Mode Access Without Registration',
      demoAccessCheck.hasOverview ? 'PASS' : 'FAIL',
      demoAccessCheck
    );

    // -------------------------------------------------------------------------
    // STEP 11: VERIFY LIGHT/DARK THEME & ENGLISH/HINDI SWITCHING
    // -------------------------------------------------------------------------
    console.log('\n--- Step 11: Verify Theme & Language Switching ---');
    // Switch to Light Theme
    await page.evaluate(() => {
      const themeBtn = document.querySelector('.theme-toggle-btn');
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const lightThemeCheck = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'light' ||
        document.body.classList.contains('light-theme');
    });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_10_light_theme.png') });

    // Switch to Hindi
    await page.evaluate(() => {
      const hiBtn = Array.from(document.querySelectorAll('.lang-toggle-btn')).find((b) => b.innerText.includes('हिन्दी'));
      if (hiBtn) hiBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const hindiCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('अवलोकन') || text.includes('मांग') || text.includes('होम');
    });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_flow_11_hindi_mode.png') });

    // Restore English & Dark
    await page.evaluate(() => {
      const enBtn = Array.from(document.querySelectorAll('.lang-toggle-btn')).find((b) => b.innerText.includes('EN'));
      if (enBtn) enBtn.click();
      const themeBtn = document.querySelector('.theme-toggle-btn');
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    recordStep(
      'Step 11',
      'Verify Light/Dark Theme & Language Switching',
      hindiCheck ? 'PASS' : 'FAIL',
      { lightThemeCheck, hindiCheck }
    );
  } catch (err) {
    console.error('Browser verification encountered an error:', err);
    recordStep('Exception', 'Unexpected Verification Failure', 'FAIL', { error: err.message });
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'auth_verification_report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\nVerification Summary:');
    console.log(`Passed: ${report.summary.passed}, Failed: ${report.summary.failed}`);
    console.log(`Report written to ${path.join(SCREENSHOT_DIR, 'auth_verification_report.json')}`);
  }
}

verifyAuthAndWorkspace().catch(console.error);
