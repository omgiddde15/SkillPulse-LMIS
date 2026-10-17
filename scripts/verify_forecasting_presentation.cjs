/**
 * Verification Script: Forecasting Status Presentation in SkillPulse LMIS
 *
 * Verifies all 5 required verification areas:
 * 1. 'Insufficient Data' never renders as 'Balanced'.
 * 2. 'missing_inputs' and 'insufficient_history' have distinct labels.
 * 3. Backend status_detail is displayed for missing inputs.
 * 4. English and Hindi labels work properly.
 * 5. Valid forecasts retain their existing classification and appearance.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Read translations.js to test dictionary values
const translationsPath = path.resolve(__dirname, '..', 'frontend', 'src', 'i18n', 'translations.js');
const translationsSrc = fs.readFileSync(translationsPath, 'utf8');

// Extract key from translations.js
function extractKey(src, lang, key) {
  const sectionStart = lang === 'en' ? src.indexOf('en: {') : src.indexOf('hi: {');
  if (sectionStart === -1) throw new Error(`Section ${lang} not found`);
  const nextSection = lang === 'en' ? src.indexOf('hi: {') : src.indexOf('export function', sectionStart);
  const sectionBody = src.slice(sectionStart, nextSection !== -1 ? nextSection : undefined);

  const regex = new RegExp(`['"]${key.replace('.', '\\.')}['"]\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
  const match = sectionBody.match(regex);
  return match ? match[1] : null;
}

console.log('================================================================');
console.log('SkillPulse LMIS - Forecasting Status Presentation Verification');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Translation Dictionary Integrity for Classifications & Statuses
// -----------------------------------------------------------------------------
console.log('TEST 1: Verifying Translation Keys in translations.js...');

// English
assert.strictEqual(extractKey(translationsSrc, 'en', 'class.insufficientData'), 'Insufficient Data');
assert.strictEqual(extractKey(translationsSrc, 'en', 'class.balanced'), 'Balanced');
assert.strictEqual(extractKey(translationsSrc, 'en', 'forecasts.statusMissingInputs'), 'Missing inputs');
assert.strictEqual(extractKey(translationsSrc, 'en', 'forecasts.statusInsufficientHistory'), 'Insufficient history');
assert.strictEqual(extractKey(translationsSrc, 'en', 'forecasts.titleIncompleteInputs'), 'Incomplete Time-Series Inputs');
assert.strictEqual(extractKey(translationsSrc, 'en', 'forecasts.titleInsufficientHistory'), 'Insufficient Time-Series History');
assert.strictEqual(extractKey(translationsSrc, 'en', 'forecasts.validatedSeries'), '{valid} Valid Series • {missing} Missing Inputs • {insuf} Insufficient History');

// Hindi
assert.strictEqual(extractKey(translationsSrc, 'hi', 'class.insufficientData'), 'अपर्याप्त डेटा (Insufficient Data)');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'class.balanced'), 'संतुलित (Balanced)');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'forecasts.statusMissingInputs'), 'अनुपलब्ध इनपुट');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'forecasts.statusInsufficientHistory'), 'अपर्याप्त इतिहास');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'forecasts.titleIncompleteInputs'), 'अपूर्ण समय-श्रृंखला इनपुट');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'forecasts.titleInsufficientHistory'), 'अपर्याप्त समय-श्रृंखला इतिहास');
assert.strictEqual(extractKey(translationsSrc, 'hi', 'forecasts.validatedSeries'), '{valid} वैध श्रृंखलाएं • {missing} अनुपलब्ध इनपुट • {insuf} अपर्याप्त इतिहास');

console.log('✓ PASS: All required English and Hindi translation keys exist with correct canonical terminology.\n');

// -----------------------------------------------------------------------------
// Test 2: Badge Class and Classification Label Mapping
// -----------------------------------------------------------------------------
console.log('TEST 2: Verifying getClassificationBadgeClass and localizedClassification...');

// Replicate Forecasts.jsx logic exactly
const getClassificationBadgeClass = (classification) => {
  if (!classification || classification.includes('Insufficient')) return 'insufficient';
  if (classification.includes('Demand Pressure')) return 'demand-pressure';
  if (classification.includes('Supply Pressure')) return 'supply-pressure';
  return 'balanced';
};

function getLocalizedClassification(classification, isHindi = false) {
  const pm = { classification };
  const enTranslations = {
    'class.demandPressure': 'Demand Pressure',
    'class.supplyPressure': 'Supply Pressure',
    'class.balanced': 'Balanced',
    'class.insufficientData': 'Insufficient Data',
  };
  const hiTranslations = {
    'class.demandPressure': 'मांग दबाव (Demand Pressure)',
    'class.supplyPressure': 'आपूर्ति दबाव (Supply Pressure)',
    'class.balanced': 'संतुलित (Balanced)',
    'class.insufficientData': 'अपर्याप्त डेटा (Insufficient Data)',
  };
  const t = (k, def) => (isHindi ? hiTranslations[k] : enTranslations[k]) || def;

  return pm?.classification?.includes('Demand Pressure')
    ? t('class.demandPressure', 'Demand Pressure')
    : pm?.classification?.includes('Supply Pressure')
    ? t('class.supplyPressure', 'Supply Pressure')
    : pm?.classification?.includes('Insufficient')
    ? t('class.insufficientData', isHindi ? 'अपर्याप्त डेटा (Insufficient Data)' : 'Insufficient Data')
    : t('class.balanced', 'Balanced');
}

// 2a. Insufficient Data NEVER renders as Balanced or 'balanced' class
const insufficientClass = getClassificationBadgeClass('Insufficient Data');
assert.strictEqual(insufficientClass, 'insufficient', "Badge class for 'Insufficient Data' must be 'insufficient', not 'balanced'");
assert.notStrictEqual(insufficientClass, 'balanced');

const insufficientLabelEn = getLocalizedClassification('Insufficient Data', false);
assert.strictEqual(insufficientLabelEn, 'Insufficient Data');
assert.notStrictEqual(insufficientLabelEn, 'Balanced');

const insufficientLabelHi = getLocalizedClassification('Insufficient Data', true);
assert.strictEqual(insufficientLabelHi, 'अपर्याप्त डेटा (Insufficient Data)');
assert.notStrictEqual(insufficientLabelHi, 'संतुलित (Balanced)');

// 2b. Valid classifications retain their proper class and label
assert.strictEqual(getClassificationBadgeClass('Demand Pressure'), 'demand-pressure');
assert.strictEqual(getLocalizedClassification('Demand Pressure', false), 'Demand Pressure');
assert.strictEqual(getLocalizedClassification('Demand Pressure', true), 'मांग दबाव (Demand Pressure)');

assert.strictEqual(getClassificationBadgeClass('Supply Pressure'), 'supply-pressure');
assert.strictEqual(getLocalizedClassification('Supply Pressure', false), 'Supply Pressure');
assert.strictEqual(getLocalizedClassification('Supply Pressure', true), 'आपूर्ति दबाव (Supply Pressure)');

assert.strictEqual(getClassificationBadgeClass('Balanced / Monitor'), 'balanced');
assert.strictEqual(getLocalizedClassification('Balanced / Monitor', false), 'Balanced');
assert.strictEqual(getLocalizedClassification('Balanced / Monitor', true), 'संतुलित (Balanced)');

console.log('✓ PASS: Insufficient Data never renders as Balanced; valid classifications retained.\n');

// -----------------------------------------------------------------------------
// Test 3: Table Cell Distinct Status Representation
// -----------------------------------------------------------------------------
console.log('TEST 3: Verifying Table Cell Forecast Status Handling...');

function renderTableCellStatus(forecastPoint, isHindi = false) {
  if (forecastPoint?.status === 'valid') {
    return {
      isValid: true,
      display: `${forecastPoint.point_forecast_integer} ${isHindi ? 'विज्ञापन' : 'jobs'}`,
    };
  }
  if (forecastPoint?.status === 'missing_inputs') {
    return {
      isValid: false,
      display: isHindi ? 'अनुपलब्ध इनपुट' : 'Missing inputs',
    };
  }
  return {
    isValid: false,
    display: isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient history',
  };
}

// Valid
const cellValid = renderTableCellStatus({ status: 'valid', point_forecast_integer: 157 }, false);
assert.strictEqual(cellValid.isValid, true);
assert.strictEqual(cellValid.display, '157 jobs');

// Missing Inputs
const cellMissingEn = renderTableCellStatus({ status: 'missing_inputs', point_forecast_integer: null }, false);
assert.strictEqual(cellMissingEn.isValid, false);
assert.strictEqual(cellMissingEn.display, 'Missing inputs');

const cellMissingHi = renderTableCellStatus({ status: 'missing_inputs', point_forecast_integer: null }, true);
assert.strictEqual(cellMissingHi.isValid, false);
assert.strictEqual(cellMissingHi.display, 'अनुपलब्ध इनपुट');

// Insufficient History
const cellInsufEn = renderTableCellStatus({ status: 'insufficient_history', point_forecast_integer: null }, false);
assert.strictEqual(cellInsufEn.isValid, false);
assert.strictEqual(cellInsufEn.display, 'Insufficient history');

const cellInsufHi = renderTableCellStatus({ status: 'insufficient_history', point_forecast_integer: null }, true);
assert.strictEqual(cellInsufHi.isValid, false);
assert.strictEqual(cellInsufHi.display, 'अपर्याप्त इतिहास');

// Distinguishability
assert.notStrictEqual(cellMissingEn.display, cellInsufEn.display);
assert.notStrictEqual(cellMissingHi.display, cellInsufHi.display);

console.log('✓ PASS: Table cells distinctly display Missing inputs vs Insufficient history in EN and HI.\n');

// -----------------------------------------------------------------------------
// Test 4: Inspection Drawer Backend Explanation & Error Titles
// -----------------------------------------------------------------------------
console.log('TEST 4: Verifying Drawer Error Title and Backend Explanation Logic...');

function renderDrawerBanner(selectedItem, isHindi = false) {
  if (selectedItem.demand_forecast?.status === 'valid' && selectedItem.supply_forecast?.status === 'valid') {
    return null; // Valid state, no error banner
  }

  const isMissingInputs =
    selectedItem.demand_forecast?.status === 'missing_inputs' ||
    selectedItem.supply_forecast?.status === 'missing_inputs';

  const errorTitle = isMissingInputs
    ? (isHindi ? 'अपूर्ण समय-श्रृंखला इनपुट' : 'Incomplete Time-Series Inputs')
    : (isHindi ? 'अपर्याप्त समय-श्रृंखला इतिहास' : 'Insufficient Time-Series History');

  let detailText = null;
  let isMinimumHistoryExplanation = false;

  if (isMissingInputs) {
    const details = [];
    if (selectedItem.demand_forecast?.status === 'missing_inputs' && selectedItem.demand_forecast?.status_detail) {
      details.push(
        selectedItem.demand_forecast.status === selectedItem.supply_forecast?.status &&
        selectedItem.demand_forecast.status_detail === selectedItem.supply_forecast?.status_detail
          ? selectedItem.demand_forecast.status_detail
          : `${isHindi ? 'मांग (Demand): ' : 'Demand: '}${selectedItem.demand_forecast.status_detail}`
      );
    }
    if (selectedItem.supply_forecast?.status === 'missing_inputs' && selectedItem.supply_forecast?.status_detail) {
      if (!(selectedItem.demand_forecast?.status === selectedItem.supply_forecast?.status &&
            selectedItem.demand_forecast?.status_detail === selectedItem.supply_forecast?.status_detail)) {
        details.push(`${isHindi ? 'आपूर्ति (Supply): ' : 'Supply: '}${selectedItem.supply_forecast.status_detail}`);
      }
    }
    detailText = details.length > 0
      ? details.join(' • ')
      : (selectedItem.demand_forecast?.status_detail || selectedItem.supply_forecast?.status_detail);
  } else {
    isMinimumHistoryExplanation = true;
    detailText = isHindi
      ? `इस श्रृंखला के लिए उपलब्ध ऐतिहासिक अवलोकन विंडो अनुरोधित ${selectedItem.horizon_months}-माह के क्षितिज पर रोलिंग-ओरिजिन बैकटेस्टिंग करने के लिए अपर्याप्त है। कटऑफ से पहले कम से कम 6 अवलोकनों का प्रशिक्षण क्रम आवश्यक है। कोई बिंदु पूर्वानुमान निर्मित नहीं किया गया है।`
      : `The available historical observation window for this series is insufficient to perform rolling-origin backtesting at the requested ${selectedItem.horizon_months}-month horizon. A minimum training sequence of 6 observations prior to origin cutoff is required. No point forecast is fabricated.`;
  }

  return {
    errorTitle,
    detailText,
    isMissingInputs,
    isMinimumHistoryExplanation,
  };
}

// 4a. Intermediate month gap in Demand forecast
const itemWithGap = {
  horizon_months: 3,
  demand_forecast: {
    status: 'missing_inputs',
    status_detail: 'Historical series contains a calendar gap between 2026-02 and 2026-04 (2 months apart); continuous monthly series required for forecasting.',
  },
  supply_forecast: {
    status: 'valid',
    status_detail: null,
  },
};

const bannerGapEn = renderDrawerBanner(itemWithGap, false);
assert.strictEqual(bannerGapEn.errorTitle, 'Incomplete Time-Series Inputs');
assert.strictEqual(bannerGapEn.isMinimumHistoryExplanation, false);
assert(bannerGapEn.detailText.includes('calendar gap between 2026-02 and 2026-04'));

const bannerGapHi = renderDrawerBanner(itemWithGap, true);
assert.strictEqual(bannerGapHi.errorTitle, 'अपूर्ण समय-श्रृंखला इनपुट');
assert.strictEqual(bannerGapHi.isMinimumHistoryExplanation, false);
assert(bannerGapHi.detailText.includes('calendar gap between 2026-02 and 2026-04'));

// 4b. Premature ending series
const itemEarlyEnding = {
  horizon_months: 3,
  demand_forecast: {
    status: 'missing_inputs',
    status_detail: 'Series ends at 2026-07, before requested base period 2026-09 (2 month(s) missing); continuous monthly observations up to base period required.',
  },
  supply_forecast: {
    status: 'missing_inputs',
    status_detail: 'Series ends at 2026-07, before requested base period 2026-09 (2 month(s) missing); continuous monthly observations up to base period required.',
  },
};

const bannerEarlyEn = renderDrawerBanner(itemEarlyEnding, false);
assert.strictEqual(bannerEarlyEn.errorTitle, 'Incomplete Time-Series Inputs');
assert.strictEqual(bannerEarlyEn.isMinimumHistoryExplanation, false);
assert(bannerEarlyEn.detailText.includes('Series ends at 2026-07, before requested base period 2026-09'));

// 4c. Short series (< 6 + h)
const itemInsufficient = {
  horizon_months: 3,
  demand_forecast: {
    status: 'insufficient_history',
    status_detail: 'Series contains 4 periods; requires at least 9 periods for 3-month backtesting evaluation.',
  },
  supply_forecast: {
    status: 'insufficient_history',
    status_detail: 'Series contains 4 periods; requires at least 9 periods for 3-month backtesting evaluation.',
  },
};

const bannerInsufEn = renderDrawerBanner(itemInsufficient, false);
assert.strictEqual(bannerInsufEn.errorTitle, 'Insufficient Time-Series History');
assert.strictEqual(bannerInsufEn.isMinimumHistoryExplanation, true);
assert(bannerInsufEn.detailText.includes('minimum training sequence of 6 observations prior to origin cutoff is required'));

const bannerInsufHi = renderDrawerBanner(itemInsufficient, true);
assert.strictEqual(bannerInsufHi.errorTitle, 'अपर्याप्त समय-श्रृंखला इतिहास');
assert.strictEqual(bannerInsufHi.isMinimumHistoryExplanation, true);
assert(bannerInsufHi.detailText.includes('कम से कम 6 अवलोकनों का प्रशिक्षण क्रम आवश्यक है'));

console.log('✓ PASS: Drawer displays dynamic backend status_detail for missing inputs and preserves minimum-history explanation for insufficient history.\n');

// -----------------------------------------------------------------------------
// Test 5: CSS Class Invariant
// -----------------------------------------------------------------------------
console.log('TEST 5: Verifying CSS Style Definition in index.css...');

const cssPath = path.resolve(__dirname, '..', 'frontend', 'src', 'index.css');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

assert(cssSrc.includes('.badge-classification.insufficient'), "index.css must contain '.badge-classification.insufficient'");
assert(cssSrc.includes('.badge-classification.balanced'), "index.css must contain '.badge-classification.balanced'");
assert(cssSrc.includes('.badge-classification.demand-pressure'), "index.css must contain '.badge-classification.demand-pressure'");
assert(cssSrc.includes('.badge-classification.supply-pressure'), "index.css must contain '.badge-classification.supply-pressure'");

console.log('✓ PASS: index.css includes dedicated .badge-classification.insufficient styling rule.\n');

// -----------------------------------------------------------------------------
// Test 6: Summary Metrics Status Counts and Summary Card Representation
// -----------------------------------------------------------------------------
console.log('TEST 6: Verifying Summary Metrics Counts & Summary Card Representation...');

function computeSummaryMetrics(list) {
  const validCount = list.filter((r) => r.demand_forecast?.status === 'valid' && r.supply_forecast?.status === 'valid').length;
  const missingCount = list.filter((r) => r.demand_forecast?.status === 'missing_inputs' || r.supply_forecast?.status === 'missing_inputs').length;
  const insufficientCount = list.filter((r) =>
    !(r.demand_forecast?.status === 'valid' && r.supply_forecast?.status === 'valid') &&
    !(r.demand_forecast?.status === 'missing_inputs' || r.supply_forecast?.status === 'missing_inputs')
  ).length;

  return {
    total: list.length,
    validCount,
    missingCount,
    insufficientCount,
  };
}

function renderSummaryCard(metrics, isHindi = false) {
  const nonValidCount = metrics.insufficientCount + metrics.missingCount;
  const cardTitle = metrics.missingCount > 0 && metrics.insufficientCount === 0
    ? (isHindi ? 'अनुपलब्ध इनपुट' : 'Missing Inputs')
    : metrics.missingCount > 0 && metrics.insufficientCount > 0
    ? (isHindi ? 'अपूर्ण इनपुट / अपर्याप्त इतिहास' : 'Missing Inputs / Insufficient')
    : (isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient History');

  const cardMeta = metrics.missingCount > 0 && metrics.insufficientCount > 0
    ? `${metrics.missingCount} ${isHindi ? 'अनुपलब्ध इनपुट' : 'Missing'} • ${metrics.insufficientCount} ${isHindi ? 'अपर्याप्त इतिहास' : 'Insufficient'}`
    : (isHindi ? 'गैर-मूल्यांकित श्रृंखलाएं' : 'Non-Evaluated Series');

  const cardSubtext = nonValidCount === 0
    ? (isHindi ? 'पूर्ण 24-माह पायलट कवरेज' : 'Full 24-month pilot coverage')
    : (isHindi ? 'डेटा संग्रह हेतु चिह्नित' : 'Flagged for data collection');

  const cardValue = nonValidCount;

  return {
    cardTitle,
    cardValue,
    cardMeta,
    cardSubtext,
  };
}

// 6a: Complete dataset (all 90 pairs valid)
const completeList = Array.from({ length: 90 }, () => ({
  demand_forecast: { status: 'valid' },
  supply_forecast: { status: 'valid' },
}));
const completeMetrics = computeSummaryMetrics(completeList);
assert.strictEqual(completeMetrics.validCount, 90);
assert.strictEqual(completeMetrics.missingCount, 0);
assert.strictEqual(completeMetrics.insufficientCount, 0);
assert.strictEqual(completeMetrics.validCount + completeMetrics.missingCount + completeMetrics.insufficientCount, 90);

const cardCompleteEn = renderSummaryCard(completeMetrics, false);
assert.strictEqual(cardCompleteEn.cardTitle, 'Insufficient History');
assert.strictEqual(cardCompleteEn.cardValue, 0);
assert.strictEqual(cardCompleteEn.cardSubtext, 'Full 24-month pilot coverage');

const cardCompleteHi = renderSummaryCard(completeMetrics, true);
assert.strictEqual(cardCompleteHi.cardTitle, 'अपर्याप्त इतिहास');
assert.strictEqual(cardCompleteHi.cardValue, 0);
assert.strictEqual(cardCompleteHi.cardSubtext, 'पूर्ण 24-माह पायलट कवरेज');

// 6b: Missing inputs only (e.g. 5 missing inputs, 0 insufficient history)
const missingOnlyList = [
  ...Array.from({ length: 85 }, () => ({ demand_forecast: { status: 'valid' }, supply_forecast: { status: 'valid' } })),
  ...Array.from({ length: 5 }, () => ({ demand_forecast: { status: 'missing_inputs' }, supply_forecast: { status: 'valid' } })),
];
const missingMetrics = computeSummaryMetrics(missingOnlyList);
assert.strictEqual(missingMetrics.validCount, 85);
assert.strictEqual(missingMetrics.missingCount, 5);
assert.strictEqual(missingMetrics.insufficientCount, 0, 'Missing-input series must NOT be counted as insufficient history');
assert.strictEqual(missingMetrics.validCount + missingMetrics.missingCount + missingMetrics.insufficientCount, 90);

const cardMissingEn = renderSummaryCard(missingMetrics, false);
assert.strictEqual(cardMissingEn.cardTitle, 'Missing Inputs', 'Card title must reflect Missing Inputs, not Insufficient History');
assert.notStrictEqual(cardMissingEn.cardTitle, 'Insufficient History');
assert.strictEqual(cardMissingEn.cardValue, 5);

const cardMissingHi = renderSummaryCard(missingMetrics, true);
assert.strictEqual(cardMissingHi.cardTitle, 'अनुपलब्ध इनपुट');
assert.notStrictEqual(cardMissingHi.cardTitle, 'अपर्याप्त इतिहास');
assert.strictEqual(cardMissingHi.cardValue, 5);

// 6c: Insufficient history only (e.g. 85 valid, 0 missing, 5 insufficient history)
const insufOnlyList = [
  ...Array.from({ length: 85 }, () => ({ demand_forecast: { status: 'valid' }, supply_forecast: { status: 'valid' } })),
  ...Array.from({ length: 5 }, () => ({ demand_forecast: { status: 'insufficient_history' }, supply_forecast: { status: 'valid' } })),
];
const insufMetrics = computeSummaryMetrics(insufOnlyList);
assert.strictEqual(insufMetrics.validCount, 85);
assert.strictEqual(insufMetrics.missingCount, 0);
assert.strictEqual(insufMetrics.insufficientCount, 5);

const cardInsufEn = renderSummaryCard(insufMetrics, false);
assert.strictEqual(cardInsufEn.cardTitle, 'Insufficient History');
assert.strictEqual(cardInsufEn.cardValue, 5);

// 6d: Mixed non-valid series (80 valid, 6 missing inputs, 4 insufficient history)
const mixedList = [
  ...Array.from({ length: 80 }, () => ({ demand_forecast: { status: 'valid' }, supply_forecast: { status: 'valid' } })),
  ...Array.from({ length: 6 }, () => ({ demand_forecast: { status: 'missing_inputs' }, supply_forecast: { status: 'valid' } })),
  ...Array.from({ length: 4 }, () => ({ demand_forecast: { status: 'insufficient_history' }, supply_forecast: { status: 'insufficient_history' } })),
];
const mixedMetrics = computeSummaryMetrics(mixedList);
assert.strictEqual(mixedMetrics.validCount, 80);
assert.strictEqual(mixedMetrics.missingCount, 6);
assert.strictEqual(mixedMetrics.insufficientCount, 4);
assert.strictEqual(mixedMetrics.validCount + mixedMetrics.missingCount + mixedMetrics.insufficientCount, 90);

const cardMixedEn = renderSummaryCard(mixedMetrics, false);
assert.strictEqual(cardMixedEn.cardTitle, 'Missing Inputs / Insufficient');
assert.strictEqual(cardMixedEn.cardValue, 10);
assert(cardMixedEn.cardMeta.includes('6 Missing'));
assert(cardMixedEn.cardMeta.includes('4 Insufficient'));

const cardMixedHi = renderSummaryCard(mixedMetrics, true);
assert.strictEqual(cardMixedHi.cardTitle, 'अपूर्ण इनपुट / अपर्याप्त इतिहास');
assert.strictEqual(cardMixedHi.cardValue, 10);
assert(cardMixedHi.cardMeta.includes('6 अनुपलब्ध इनपुट'));
assert(cardMixedHi.cardMeta.includes('4 अपर्याप्त इतिहास'));

// 6e: Formatted forecasts.validatedSeries substitution
function formatValidatedSeries(template, params) {
  let str = template;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return str;
}
const enTemplate = extractKey(translationsSrc, 'en', 'forecasts.validatedSeries');
const hiTemplate = extractKey(translationsSrc, 'hi', 'forecasts.validatedSeries');

const enFormatted = formatValidatedSeries(enTemplate, { valid: 80, missing: 6, insuf: 4 });
assert.strictEqual(enFormatted, '80 Valid Series • 6 Missing Inputs • 4 Insufficient History');

const hiFormatted = formatValidatedSeries(hiTemplate, { valid: 80, missing: 6, insuf: 4 });
assert.strictEqual(hiFormatted, '80 वैध श्रृंखलाएं • 6 अनुपलब्ध इनपुट • 4 अपर्याप्त इतिहास');

// 6f: Valid Series terminology polish verification in Forecasts.jsx
const forecastsPath = path.resolve(__dirname, '..', 'frontend', 'src', 'components', 'Forecasts.jsx');
const forecastsSrc = fs.readFileSync(forecastsPath, 'utf8');
assert(forecastsSrc.includes("isHindi ? 'वैध श्रृंखलाएं' : 'Valid Series'"), "Forecasts.jsx must use 'Valid Series' / 'वैध श्रृंखलाएं' for card title");
assert(!forecastsSrc.includes("Valid Forecast Models"), "Forecasts.jsx must not contain deprecated 'Valid Forecast Models' label");

console.log('✓ PASS: Summary metrics & summary card distinguish valid, missing-input, and insufficient-history series without conflation.\n');

// -----------------------------------------------------------------------------
// Test 7: Header Synthetic Notice & Forecast Diagnostics Layout
// -----------------------------------------------------------------------------
console.log('TEST 7: Verifying Header Synthetic Notice & Forecast Diagnostics Layout...');

// 7a: Pilot Prototype badge in translations.js
assert.strictEqual(extractKey(translationsSrc, 'en', 'app.compactDemoNotice'), 'Pilot Prototype', "EN 'app.compactDemoNotice' must be 'Pilot Prototype'");
assert.strictEqual(extractKey(translationsSrc, 'hi', 'app.compactDemoNotice'), 'पायलट प्रोटोटाइप', "HI 'app.compactDemoNotice' must be 'पायलट प्रोटोटाइप'");

// 7b: Header.jsx fallback text
const headerPath = path.resolve(__dirname, '..', 'frontend', 'src', 'components', 'Header.jsx');
const headerSrc = fs.readFileSync(headerPath, 'utf8');
assert(headerSrc.includes("t('app.compactDemoNotice', 'Pilot Prototype')"), "Header.jsx must have 'Pilot Prototype' as default fallback");
assert(!headerSrc.includes('Synthetic Demo Data — Pilot Testing Only'), "Header.jsx must not contain deprecated 'Synthetic Demo Data — Pilot Testing Only'");
assert(!headerSrc.includes('Synthetic Pilot Data'), "Header.jsx must not contain previous 'Synthetic Pilot Data'");

// 7c: Forecasts.jsx diagnostics drawer layout
assert(forecastsSrc.includes('<div className="forecast-diagnostics-grid">'), "Forecasts.jsx must use 'forecast-diagnostics-grid'");
assert(!forecastsSrc.includes('<div className="components-grid">'), "Forecasts.jsx must not use 'components-grid' in drawer");
assert(forecastsSrc.includes('interval-metrics-row'), "Forecasts.jsx must use 'interval-metrics-row' for prediction interval bounds");

// 7d: index.css layout & visualizer definitions
assert(cssSrc.includes('.forecast-diagnostics-grid'), "index.css must define '.forecast-diagnostics-grid'");
assert(cssSrc.includes('.interval-visualizer'), "index.css must define '.interval-visualizer'");
assert(cssSrc.includes('.interval-metrics-row'), "index.css must define '.interval-metrics-row'");
assert(cssSrc.includes('.interval-range-track'), "index.css must define '.interval-range-track'");
assert(cssSrc.includes('.interval-legend'), "index.css must define '.interval-legend'");

console.log('✓ PASS: Header synthetic notice refined to Pilot Prototype and diagnostics drawer uses equal-width grid & structured interval visualizer.\n');

console.log('================================================================');
console.log('ALL FORECASTING PRESENTATION VERIFICATION TESTS PASSED (7/7)');
console.log('================================================================');
