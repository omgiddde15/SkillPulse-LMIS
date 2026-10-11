/**
 * SkillPulse LMIS — Reusable CSV Export Utility
 *
 * Implements RFC 4180 compliant CSV formatting with:
 * - Proper escaping of commas, quotes, and newlines
 * - Safe handling of null and undefined values
 * - UTF-8 Byte Order Mark (BOM) for native Excel compatibility
 * - CSV-formula injection sanitization (=, +, -, @, \t, \r) for untrusted text
 *   without corrupting legitimate negative numbers or valid numeric values
 * - Filesystem-safe filename sanitization and browser download trigger
 */

/**
 * Format and sanitize a single cell value for CSV output according to RFC 4180.
 *
 * @param {unknown} value - Cell value to format.
 * @returns {string} RFC 4180 formatted CSV cell.
 */
export function formatCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Preserve pure numeric types directly without modification
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return '';
    }
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  let str = String(value);

  // CSV Formula Injection Mitigation:
  // Spreadsheet applications (Excel, Calc) execute formulas if a cell starts with =, +, -, @, \t, or \r.
  // We sanitize untrusted text cells while preserving legitimate signed numbers (e.g., -14.15 or +28.6).
  const trimmed = str.trim();
  if (/^[=\-+@\t\r]/.test(trimmed)) {
    // If the trimmed string is a valid finite number, it is legitimate numeric data, not a malicious formula
    const isPureNumber = !Number.isNaN(Number(trimmed)) && trimmed !== '';
    if (!isPureNumber) {
      // Neutralize formula execution by prefixing with a single quote (')
      str = `'${str}`;
    }
  }

  // RFC 4180: If the string contains comma, double-quote, carriage return, or newline,
  // enclose it in double quotes and escape internal double quotes by doubling them ("").
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Sanitize a string to be safely used as a filename across all operating systems.
 *
 * @param {string} rawName - Raw desired filename.
 * @returns {string} Filesystem-safe filename.
 */
export function sanitizeFilename(rawName) {
  if (!rawName) return 'export.csv';
  // Replace invalid filesystem characters: / \ : * ? " < > | and spaces
  const cleaned = rawName
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .trim();
  return cleaned.endsWith('.csv') ? cleaned : `${cleaned}.csv`;
}

/**
 * Trigger a browser download of CSV content using a UTF-8 Blob and object URL.
 *
 * @param {string} filename - Filename for the downloaded file.
 * @param {string} csvContent - Raw CSV text content.
 */
export function triggerCsvDownload(filename, csvContent) {
  const safeName = sanitizeFilename(filename);

  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Microsoft Excel opens UTF-8 characters correctly
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // Check for modern browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeName);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Clean up DOM and memory
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Build a standard tabular CSV string from column specifications and data rows.
 *
 * @param {Array<{ key: string, label: string, format?: (val: any, row: any) => any }>} columns
 * @param {Array<Object>} rows
 * @param {Object} [options]
 * @param {string} [options.title] - Optional title banner line.
 * @param {Array<string>} [options.disclaimers] - Optional disclaimer lines appended at the end.
 * @returns {string}
 */
/**
 * Build a standard tabular CSV string from column specifications and data rows.
 *
 * Produces a strictly rectangular CSV where the first line is the common table header
 * and every subsequent row has the exact same number of columns. Any metadata key-value
 * pairs and governance disclaimers are seamlessly integrated as uniform columns so that
 * standard CSV loaders (e.g., pandas.read_csv) can parse the entire file without skiprows.
 *
 * @param {Array<{ key: string, label: string, format?: (val: any, row: any) => any }>} columns
 * @param {Array<Object>} rows
 * @param {Object} [options]
 * @param {Object} [options.metadata] - Key-value metadata integrated as uniform columns.
 * @param {Array<string>} [options.disclaimers] - Disclaimers integrated as uniform columns.
 * @returns {string} Pure rectangular RFC 4180 CSV string.
 */
export function buildTabularCsv(columns, rows, options = {}) {
  // Construct a single, unified list of columns that incorporates all data fields,
  // relevant metadata attributes, and governance disclaimers without jagged multi-part sections.
  const effectiveColumns = [...columns];

  if (options.metadata && typeof options.metadata === 'object') {
    Object.entries(options.metadata).forEach(([k, v]) => {
      // Avoid duplicate if column already exists in base definition
      const alreadyPresent = effectiveColumns.some(
        (c) => c.label.toLowerCase() === k.toLowerCase() || c.key.toLowerCase() === k.toLowerCase()
      );
      if (!alreadyPresent) {
        effectiveColumns.push({
          key: `_meta_${k}`,
          label: k,
          format: () => v,
        });
      }
    });
  }

  if (Array.isArray(options.disclaimers) && options.disclaimers.length > 0) {
    options.disclaimers.forEach((d, idx) => {
      let label = `Governance Disclaimer ${idx + 1}`;
      let text = d;
      // Extract a meaningful header if formatted as "Category: Notice"
      if (typeof d === 'string' && d.includes(':') && d.indexOf(':') < 45) {
        const colonIdx = d.indexOf(':');
        label = d.slice(0, colonIdx).trim();
        text = d.slice(colonIdx + 1).trim();
      }
      effectiveColumns.push({
        key: `_disc_${idx}`,
        label,
        format: () => text,
      });
    });
  }

  const lines = [];

  // Line 1: Common Table Header
  const headerRow = effectiveColumns.map((col) => formatCsvCell(col.label)).join(',');
  lines.push(headerRow);

  // Lines 2..N+1: Uniform Data Rows
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const rowLine = effectiveColumns
        .map((col) => {
          let rawVal;
          if (typeof col.format === 'function') {
            rawVal = col.format(row[col.key], row);
          } else if (col.key.includes('.')) {
            // Nested key support (e.g., 'throughput.certifications_3m')
            rawVal = col.key.split('.').reduce((acc, part) => acc?.[part], row);
          } else {
            rawVal = row[col.key];
          }
          return formatCsvCell(rawVal);
        })
        .join(',');
      lines.push(rowLine);
    });
  }

  return lines.join('\r\n');
}

/**
 * High-level export helper for standard data tables.
 *
 * @param {Object} params
 * @param {string} params.filename - Desired filename.
 * @param {Array<Object>} params.columns - Column definitions ({ key, label, format? }).
 * @param {Array<Object>} params.rows - Data rows to export.
 * @param {string} [params.title] - Optional title (ignored in rectangular mode).
 * @param {Object} [params.metadata] - Key-value metadata integrated as columns.
 * @param {Array<string>} [params.disclaimers] - Disclaimers integrated as columns.
 */
export function exportTableToCsv({
  filename,
  columns,
  rows,
  title,
  metadata,
  disclaimers,
}) {
  const csvContent = buildTabularCsv(columns, rows, {
    title,
    metadata,
    disclaimers,
  });
  triggerCsvDownload(filename, csvContent);
}

/**
 * Generate a strictly rectangular CSV string for the Training-Seat Allocation Scenario Plan.
 * Produces a single common header (8 columns) and uniform columns across all 5 sections,
 * preserving scenario parameters, baseline vs scenario comparative metrics, coverage sensitivity
 * assumptions (k and alpha), cohort funnel yield benchmarks, and statutory policy disclaimers.
 *
 * @param {Object} params
 * @param {Object} params.scenario - Current completed SeatSimulationResponse object.
 * @param {number} params.kMultiplier - Active posting-to-opening multiplier (k).
 * @param {number} params.alphaFactor - Active local candidate availability factor (alpha).
 * @param {Object} [params.scenarioCoverage] - Reactive coverage calculation object from frontend.
 * @param {boolean} [params.isHindi] - If true, export bilingual Hindi/English headers and notes.
 * @returns {string} Pure rectangular RFC 4180 CSV string.
 */
export function buildSimulationPlanCsv({
  scenario,
  kMultiplier,
  alphaFactor,
  scenarioCoverage,
  isHindi = false,
}) {
  if (!scenario) return '';

  const p = scenario.parameters || {};
  const baseAlloc = scenario.baseline_seat_allocation || {};
  const propAlloc = scenario.proposed_seat_allocation || {};
  const funnel = scenario.funnel_metrics || {};
  const baseProj = scenario.baseline_projection || {};
  const scenProj = scenario.scenario_projection || {};
  const impact = scenario.impact_summary || {};
  const cov = scenarioCoverage || scenario.coverage_scenario || {};

  const k = Number(kMultiplier) || 1.0;
  const alpha = Number(alphaFactor) || 1.0;

  const lines = [];

  // Line 1: Single Common Table Header (8 Columns)
  lines.push(
    isHindi
      ? 'अनुभाग (Section),श्रेणी (Category),मीट्रिक या पैरामीटर नाम (Metric or Parameter Name),ऐतिहासिक आधार रेखा (Historical Baseline),प्रस्तावित परिदृश्य (Proposed Scenario),परिवर्तन (Shift / Delta),इकाई या पैमाना (Unit or Scale),टिप्पणियां एवं नीतिगत अस्वीकरण (Notes and Policy Disclaimers)'
      : 'Section,Category,Metric or Parameter Name,Historical Baseline,Proposed Scenario,Shift / Delta,Unit or Scale,Notes and Policy Disclaimers'
  );

  function makeRow(section, category, name, baseline, scenarioVal, delta, unit, notes) {
    return [
      formatCsvCell(section),
      formatCsvCell(category),
      formatCsvCell(name),
      formatCsvCell(baseline),
      formatCsvCell(scenarioVal),
      formatCsvCell(delta),
      formatCsvCell(unit),
      formatCsvCell(notes),
    ].join(',');
  }

  // 1. Scenario Parameters & Reference Metadata
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Identifiers', 'Scenario ID', 'N/A', scenario.scenario_id, 'N/A', 'Identifier Code', 'Unique deterministic scenario identifier'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Status', 'Simulation Status', 'N/A', scenario.status, 'N/A', 'Validation Status', 'Model validation and execution status'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Provenance', 'Synthetic Data Flag', 'TRUE', scenario.is_synthetic ? 'TRUE' : 'FALSE', 'N/A', 'Boolean Flag', 'Synthetic demonstration dataset for SIH26246 (not official statistics)'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Timeline', 'Base Reporting Period', p.period, p.period, '0', 'Period (YYYY-MM)', 'Historical baseline cutoff'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Timeline', 'Forecast Horizon', `${p.horizon_months} Months Ahead`, `${p.horizon_months} Months Ahead`, '0', 'Evaluation Window', 'Evaluation forward horizon'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Timeline', 'Target Evaluation Period', p.target_period, p.target_period, '0', 'Period (YYYY-MM)', 'Target future cohort conclusion month'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Geography', 'State', `${p.state_name || ''} (${p.state_code || ''})`, `${p.state_name || ''} (${p.state_code || ''})`, 'Unchanged', 'State Jurisdiction', 'Administrative state jurisdiction'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Geography', 'District', `${p.district_name || ''} (${p.district_id || ''})`, `${p.district_name || ''} (${p.district_id || ''})`, 'Unchanged', 'District Jurisdiction', 'Target training district'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Sector', 'Industry Sector', p.sector, p.sector, 'Unchanged', 'Economic Sector', 'Target economic sector'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Sector', 'Vocational Trade', p.trade, p.trade, 'Unchanged', 'Trade Cluster', 'Specialized trade cluster'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Occupation', 'Occupation Code', p.occupation_id, p.occupation_id, 'Unchanged', 'Master Code', 'Internal master occupation code'));
  lines.push(makeRow('1. SCENARIO IDENTIFICATION & PARAMETERS', 'Occupation', 'Occupation Title', p.occupation_title, p.occupation_title, 'Unchanged', 'Job Role', 'Canonical descriptive job role'));

  // 2. Comparative Impact: Baseline Architecture vs Proposed Scenario
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Training Intake', 'Sanctioned Batch Capacity', baseAlloc.baseline_avg_seats_per_cohort, propAlloc.proposed_seats_per_cohort, propAlloc.absolute_seat_delta >= 0 ? `+${propAlloc.absolute_seat_delta}` : propAlloc.absolute_seat_delta, 'seats per cohort', 'Sanctioned batch capacity per instructional cycle'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Training Intake', 'Percentage Seat Capacity Adjustment', '0.0%', `${propAlloc.percentage_seat_change >= 0 ? '+' : ''}${propAlloc.percentage_seat_change}%`, `${propAlloc.percentage_seat_change >= 0 ? '+' : ''}${propAlloc.percentage_seat_change}%`, 'percent change', 'Proportional capacity change relative to baseline intake'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Training Intake', 'Pipeline Capacity Scaling Ratio', '1.0000x', `${propAlloc.scaling_ratio?.toFixed(4)}x`, `${((propAlloc.scaling_ratio || 1) - 1).toFixed(4)}x`, 'proportional multiplier', 'Proportional scaling multiplier applied to stabilized throughput'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Graduate Supply', 'Monthly Certified Candidate Output', baseProj.forecast_supply_throughput, scenProj.scenario_supply_throughput, impact.supply_throughput_delta >= 0 ? `+${impact.supply_throughput_delta}` : impact.supply_throughput_delta, 'certified candidates / month', 'Projected monthly certified candidate output at evaluated target horizon'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Graduate Supply', 'Throughput Percentage Change', '0.0%', `${impact.supply_throughput_pct_change >= 0 ? '+' : ''}${impact.supply_throughput_pct_change}%`, `${impact.supply_throughput_pct_change >= 0 ? '+' : ''}${impact.supply_throughput_pct_change}%`, 'percent change', 'Percentage change in monthly certified output'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Market Alignment', 'Regional Supply Percentile Rank', baseProj.forecast_supply_rank, scenProj.scenario_supply_rank, impact.supply_rank_delta >= 0 ? `+${impact.supply_rank_delta}` : impact.supply_rank_delta, 'percentile rank (0 to 100)', 'Supply percentile rank relative to peer comparison population for target horizon'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Market Alignment', 'Forecast Demand Postings Count', baseProj.forecast_demand_postings, baseProj.forecast_demand_postings, 0, 'online recruitment postings', 'Discrete point forecast online postings at evaluated target horizon'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Market Alignment', 'Forecast Demand Postings Rank', baseProj.forecast_demand_rank, baseProj.forecast_demand_rank, 0, 'percentile rank (0 to 100)', 'Cross-sectional percentile rank of forecast employer job postings'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Market Alignment', 'Projected Relative Mismatch Score', baseProj.mismatch_score, scenProj.scenario_mismatch_score, impact.mismatch_score_delta >= 0 ? `+${impact.mismatch_score_delta}` : impact.mismatch_score_delta, 'points (-100 to +100)', 'Projected relative mismatch score: Forecast Demand Rank minus Supply Rank'));
  lines.push(makeRow('2. COMPARATIVE CAPACITY & LABOUR MARKET IMPACT', 'Market Alignment', 'Mismatch Policy Classification', baseProj.classification, scenProj.scenario_classification, impact.classification_transition, 'prototype decision classification', 'Decision classification relative to +/-15 prototype decision thresholds'));

  // 3. Assumption-Adjusted Pipeline Coverage Scenario
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Sensitivity Assumption', 'Posting-to-Opening Multiplier (k)', k.toFixed(2), k.toFixed(2), '0.00', 'ratio (0.50 to 1.50)', 'Assumed realization multiplier converting online postings to actual openings'));
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Sensitivity Assumption', 'Local Candidate Availability Share (alpha)', `${(alpha * 100).toFixed(0)}%`, `${(alpha * 100).toFixed(0)}%`, '0%', 'share (40% to 100%)', 'Assumed share of certified candidates actively seeking local employment'));
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Market Demand Signal', 'Forecast Online Job Postings', cov.postings ?? baseProj.forecast_demand_postings, cov.postings ?? baseProj.forecast_demand_postings, 0, 'postings', 'Discrete point forecast online postings at target horizon'));
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Market Demand Signal', 'Estimated Job Openings', cov.estimatedOpenings ?? cov.estimated_openings, cov.estimatedOpenings ?? cov.estimated_openings, 0, 'openings', 'Forecast Postings multiplied by k'));
  const bEff = cov.baselineEffectiveOutput ?? cov.baseline_effective_output;
  const sEff = cov.scenarioEffectiveOutput ?? cov.scenario_effective_output;
  const dEff = (sEff != null && bEff != null) ? (sEff - bEff) : null;
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Pipeline Supply Signal', 'Effective Local Output', bEff, sEff, dEff != null ? (dEff >= 0 ? `+${dEff.toFixed(1)}` : dEff.toFixed(1)) : '0.0', 'candidates / month', 'Projected throughput multiplied by alpha'));
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Coverage Estimate', 'Pipeline Coverage Rate', `${(cov.baselineCoveragePct ?? cov.baseline_coverage_pct ?? 0).toFixed(1)}%`, `${(cov.scenarioCoveragePct ?? cov.scenario_coverage_pct ?? 0).toFixed(1)}%`, `${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0) >= 0 ? '+' : ''}${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0).toFixed(1)} pts`, 'percent', 'Effective Local Output / Estimated Openings * 100'));
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Coverage Estimate', 'Pipeline Coverage Shift (Delta)', '0.0 pts', `${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0) >= 0 ? '+' : ''}${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0).toFixed(1)} pts`, `${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0) >= 0 ? '+' : ''}${(cov.coveragePctDelta ?? cov.coverage_pct_delta ?? 0).toFixed(1)} pts`, 'percentage points', 'Proposed Scenario Coverage minus Baseline Coverage'));
  const bRatio = cov.baselineBenchmarkRatio ?? cov.baseline_benchmark_ratio ?? 0;
  const sRatio = cov.scenarioBenchmarkRatio ?? cov.scenario_benchmark_ratio ?? 0;
  const dRatio = sRatio - bRatio;
  lines.push(makeRow('3. ASSUMPTION-ADJUSTED PIPELINE COVERAGE SCENARIO', 'Descriptive Benchmark', 'Training-to-Posting Benchmark Ratio', `${bRatio.toFixed(1)} per 100 postings`, `${sRatio.toFixed(1)} per 100 postings`, `${dRatio >= 0 ? '+' : ''}${dRatio.toFixed(1)} pts`, 'ratio', 'Raw unadjusted certified throughput / forecast postings * 100'));

  // 4. Empirical Cohort Funnel Yield Metrics
  lines.push(makeRow('4. EMPIRICAL COHORT FUNNEL YIELD METRICS', 'Cohort Funnel', '1. Seat Utilisation Rate', `${((funnel.seat_utilization_rate || 0) * 100).toFixed(1)}%`, `${((funnel.seat_utilization_rate || 0) * 100).toFixed(1)}%`, '0.0% (Constant)', 'percent', 'Enrolments / Sanctioned Seats'));
  lines.push(makeRow('4. EMPIRICAL COHORT FUNNEL YIELD METRICS', 'Cohort Funnel', '2. Course Completion Rate', `${((funnel.completion_rate || 0) * 100).toFixed(1)}%`, `${((funnel.completion_rate || 0) * 100).toFixed(1)}%`, '0.0% (Constant)', 'percent', 'Completions / Enrolments'));
  lines.push(makeRow('4. EMPIRICAL COHORT FUNNEL YIELD METRICS', 'Cohort Funnel', '3. Assessment Pass Rate', `${((funnel.certification_rate || 0) * 100).toFixed(1)}%`, `${((funnel.certification_rate || 0) * 100).toFixed(1)}%`, '0.0% (Constant)', 'percent', 'Certifications / Completions'));
  lines.push(makeRow('4. EMPIRICAL COHORT FUNNEL YIELD METRICS', 'Cohort Funnel', '4. Cumulative Pipeline Yield', `${((funnel.overall_yield_rate || 0) * 100).toFixed(1)}%`, `${((funnel.overall_yield_rate || 0) * 100).toFixed(1)}%`, '0.0% (Constant)', 'percent', 'Certifications / Sanctioned Seats (utilization x completion x pass rate)'));

  // 5. Governance, Methodological Disclaimers & Limitations
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Methodology Notice', 'Constant-Yield Pipeline Assumption', 'Active Assumption', 'Active Assumption', 'N/A', 'Operational Rule', scenario.assumptions || 'Training pipeline yield is assumed constant across simulated capacity adjustments. Models future stabilized cohort throughput and does NOT assume instantaneous labor market entry.'));
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Governance Notice', 'Percentile-Rank Saturation Notice', 'Active Notice', 'Active Notice', 'N/A', 'Statistical Rule', 'Supply percentile rank is cross-sectionally capped at 100.0 relative to the peer comparison population for the selected horizon. When throughput exceeds all regional series, the rank-based mismatch score plateaus.'));
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Policy Caveat', 'Pipeline Lead-Time & Headcount Caveat', 'Active Caveat', 'Active Caveat', 'N/A', 'Administrative Rule', 'Sanctioned seat adjustments affect future graduating cohorts after instructional cycles (e.g. 6-12 months). Administrative seat changes do not inject certified workers immediately. Mismatch scores denote relative screening ranks, NOT verified headcount deficits.'));
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Sensitivity Disclaimer', 'Coverage Scenario Sensitivity Disclaimer', 'Active Disclaimer', 'Active Disclaimer', 'N/A', 'Decision-Support Rule', scenario.coverage_scenario?.methodology_disclaimer || 'Assumption-adjusted pipeline scenario is an exploratory decision-support simulation. It does NOT represent actual vacancy fulfillment, a verified worker shortage headcount, or guaranteed employment.'));
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Decision Threshold Heuristic', 'Prototype Decision Thresholds (+/-15 Points)', 'Active Heuristic', 'Active Heuristic', 'N/A', 'Threshold Rule', 'The +/-15.0 score thresholds are prototype heuristic thresholds (±15), not empirically calibrated policy rules.'));
  lines.push(makeRow('5. METHODOLOGICAL GOVERNANCE & POLICY DISCLAIMERS', 'Data Provenance', 'Synthetic Demonstration Dataset', 'Active Flag', 'Active Flag', 'N/A', 'Provenance Flag', 'All simulation metrics are computed on synthetic pilot observations; scenario outputs are planning illustrations, not predictions.'));

  return lines.join('\r\n');
}

/**
 * Specialized CSV exporter for the Training-Seat Allocation Scenario Plan.
 * Formats scenario metadata, side-by-side baseline vs scenario comparisons,
 * assumption-adjusted pipeline coverage metrics, and complete policy guardrails.
 *
 * @param {Object} params
 * @param {Object} params.scenario - Current completed SeatSimulationResponse object.
 * @param {number} params.kMultiplier - Active posting-to-opening multiplier (k).
 * @param {number} params.alphaFactor - Active local candidate availability factor (alpha).
 * @param {Object} [params.scenarioCoverage] - Reactive coverage calculation object from frontend.
 * @param {boolean} [params.isHindi] - If true, export bilingual Hindi/English headers and notes.
 * @param {string} [params.filename] - Optional custom filename.
 */
export function exportSimulationPlanCsv({
  scenario,
  kMultiplier,
  alphaFactor,
  scenarioCoverage,
  isHindi = false,
  filename,
}) {
  if (!scenario) return;

  const p = scenario.parameters || {};
  const propAlloc = scenario.proposed_seat_allocation || {};
  const defaultFilename = `skillpulse-seat-simulation-${p.district_id || 'district'}-${p.occupation_id || 'occupation'}-${p.period || 'period'}-H${p.horizon_months || 3}-S${propAlloc.proposed_seats_per_cohort || 0}.csv`;
  const finalFilename = filename || defaultFilename;

  const csvContent = buildSimulationPlanCsv({
    scenario,
    kMultiplier,
    alphaFactor,
    scenarioCoverage,
    isHindi,
  });

  triggerCsvDownload(finalFilename, csvContent);
}
