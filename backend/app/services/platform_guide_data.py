"""SkillPulse Saarthi — Platform Knowledge Catalogue & Verified Architecture Metadata.

Authoritative source of product knowledge, feature definitions, mathematical formulas,
navigation routes, workflows, data boundaries, and methodology for SkillPulse LMIS.
All entries are verified against actual codebase routes, schemas, and services.
"""

from typing import Any, Dict, List, Optional

# Authoritative frontend navigation routes mapped to their internal identifiers
VALID_NAVIGATION_ROUTES = {
    "home": "Landing Page / Public Portal",
    "overview": "Executive Overview",
    "demand": "Demand Intelligence",
    "gap": "Skill Gaps & Pipeline Analysis",
    "forecasts": "Predictive Forecasts",
    "alerts": "Early-Warning Alerts",
    "recommendations": "Policy Recommendations",
    "simulator": "Scenario Studio / Seat Simulator",
    "workspace": "My Workspace",
    "career": "Career Profile & Career Navigator",
    "opportunities": "Opportunity Explorer",
    "districts": "Districts Explorer",
    "occupations": "Occupations Explorer",
    "qualifications": "Qualifications Explorer",
    "data-health": "Data & Model Health",
    "api": "API & Data Exports",
    "settings": "System Settings",
}

# -----------------------------------------------------------------------------
# Module Catalogue (18 Verified Modules)
# -----------------------------------------------------------------------------
PLATFORM_MODULES_CATALOG: Dict[str, Dict[str, Any]] = {
    "home": {
        "module_id": "home",
        "route": "home",
        "display_name": "Landing Page & Getting Started",
        "category": "PUBLIC",
        "purpose": "Public introduction to SkillPulse LMIS, highlighting the national labour-market friction problem, live pilot observation, analytical pillars, and role-based entrypoints.",
        "intended_users": ["All Visitors", "Policymakers", "Students & Job Seekers", "SIH Hackathon Evaluators"],
        "workflow": [
            "Review the national LMIS problem statement and pilot scope in the Hero section.",
            "Choose a role-based pathway: Policymakers, Candidates, or Technical Evaluators.",
            "Interact with the dynamic live pilot observation card for Dharwad CNC Machinists.",
            "Test example Saarthi questions or launch the platform directly to explore as guest or signed-in user."
        ],
        "filters_and_inputs": ["Language Toggle (English/Hindi)", "Theme Toggle (Dark/Light)"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/gap-analysis"],
        "data_coverage_and_limitations": "Presents summary indicators from reporting cycle 2026-09 across the 6 pilot districts.",
        "related_pages": ["overview", "career", "data-health"],
        "example_queries": ["What is SkillPulse?", "How do I use this site?", "What does this platform do?"]
    },
    "overview": {
        "module_id": "overview",
        "route": "overview",
        "display_name": "Executive Overview",
        "category": "INTELLIGENCE",
        "purpose": "Executive dashboard providing high-level situational awareness: aggregate mismatch index, active alert volume, demand growth, and regional pressure distributions.",
        "intended_users": ["Executive Decision Makers", "State Skill Development Directors", "Policy Advisors"],
        "workflow": [
            "Use the top filter bar to set District (All or 6 pilot districts), Sector, or Occupation.",
            "Review the 4 core KPI cards: Aggregate Mismatch Index, Active Alerts, Demand Growth, and TVET Utilization.",
            "Analyze the District Pressure Matrix comparing high-deficit vs high-surplus regional clusters.",
            "Click on any KPI card or regional alert to drill down into Skill Gaps or Early-Warning Alerts."
        ],
        "filters_and_inputs": ["District", "Sector", "Occupation", "Reporting Period (2026-09)"],
        "formulas_and_metrics": "Aggregates regional demand scores, relative mismatch scores, and active alert severity counts across filtered dimensions.",
        "backend_endpoints": ["GET /api/v1/demand", "GET /api/v1/gap-analysis", "GET /api/v1/alerts"],
        "data_coverage_and_limitations": "Data is bounded by the 6 pilot districts and 9 benchmark occupations.",
        "related_pages": ["demand", "gap", "alerts", "simulator"],
        "example_queries": ["Show me the executive summary", "Which district has the highest pressure?", "What is the overall mismatch?"]
    },
    "demand": {
        "module_id": "demand",
        "route": "demand",
        "display_name": "Demand Intelligence",
        "category": "INTELLIGENCE",
        "purpose": "Multi-dimensional employer demand monitoring tracking hiring signals, posting velocity, wage premiums, and employer concentration.",
        "intended_users": ["Labour Economists", "Industry Liaison Officers", "Curriculum Planners"],
        "workflow": [
            "Select target District, Sector, and Occupation.",
            "Inspect the 5-component Composite Demand Score breakdown.",
            "Examine historical 21-month demand trajectories (2025-01 through 2026-09).",
            "Review hiring concentration (Herfindahl-Hirschman Index) and top hiring clusters."
        ],
        "filters_and_inputs": ["District", "Sector", "Occupation", "Time Window"],
        "formulas_and_metrics": "Composite Demand Score = (Posting Volume * 0.30) + (Posting Growth * 0.25) + (Posting Persistence * 0.15) + (Employer Breadth * 0.15) + (Wage Premium * 0.15). Bounded [0, 100].",
        "backend_endpoints": ["GET /api/v1/demand", "GET /api/v1/demand/trends"],
        "data_coverage_and_limitations": "Captures formal hiring signals; informal MSME demand is calibrated via regional expansion multipliers.",
        "related_pages": ["gap", "forecasts", "occupations"],
        "example_queries": ["How is demand score calculated?", "What is Pune hiring demand?", "Show me posting growth trends"]
    },
    "gap": {
        "module_id": "gap",
        "route": "gap",
        "display_name": "Skill Gaps (Gap Analysis)",
        "category": "INTELLIGENCE",
        "purpose": "Quantitative evaluation of labour market mismatch comparing employer demand intensity against TVET supply throughput.",
        "intended_users": ["TVET Planners", "Vocational Training Directors", "Workforce Analysts"],
        "workflow": [
            "Select a target district (e.g., Dharwad or Pune) and target occupation (e.g., CNC Machinist).",
            "Inspect the Relative Mismatch Score badge (+100 severe deficit, -100 severe surplus).",
            "Examine the 4-stage TVET Funnel: Enrolments -> Completions -> Certifications -> Placements.",
            "Verify the 90-day placement maturity flag to distinguish emerging shortages from maturing cohorts."
        ],
        "filters_and_inputs": ["District", "Occupation", "Reporting Period"],
        "formulas_and_metrics": "Relative Mismatch Score = Demand Score - Supply Score (bounded [-100, +100]). Funnel monotonicity: Placements <= Certifications <= Completions <= Enrolments.",
        "backend_endpoints": ["GET /api/v1/gap-analysis", "GET /api/v1/gap-analysis/funnel"],
        "data_coverage_and_limitations": "Relative scores reflect calibrated supply-demand ratios, not absolute physical headcount tallies.",
        "related_pages": ["simulator", "alerts", "forecasts", "recommendations"],
        "example_queries": ["Where can I find skill gaps?", "Explain the relative mismatch score", "Why is Dharwad CNC in deficit?"]
    },
    "forecasts": {
        "module_id": "forecasts",
        "route": "forecasts",
        "display_name": "Predictive Forecasts",
        "category": "INTELLIGENCE",
        "purpose": "Statistical projections of future demand and supply across 3 horizons (3M, 6M, 12M) with explicit confidence intervals.",
        "intended_users": ["Strategic Policy Planners", "State Skill Directors", "Budget Allocation Committees"],
        "workflow": [
            "Select district and occupation from the filters.",
            "Toggle projection horizons between 3-month (3M), 6-month (6M), and 12-month (12M).",
            "Switch between forecasting models: Moving Average (MA-3), Linear Trend Regression, or Naive Baseline.",
            "Inspect 80% prediction interval bands and review model backtesting RMSE across 16 rolling origin folds."
        ],
        "filters_and_inputs": ["District", "Occupation", "Horizon (3M, 6M, 12M)", "Model Architecture (MA-3, Linear Trend, Naive)"],
        "formulas_and_metrics": "80% Prediction Interval = Forecast +/- (1.282 * RMSE). Validated across 16 rolling-origin cross-validation splits.",
        "backend_endpoints": ["GET /api/v1/forecasts", "GET /api/v1/forecasts/models"],
        "data_coverage_and_limitations": "Projections assume continuation of historical structural trends; black-swan economic disruptions are not modeled.",
        "related_pages": ["alerts", "gap", "simulator"],
        "example_queries": ["How do I generate a forecast?", "Compare 3M and 12M forecasts", "Which forecasting model is most accurate?"]
    },
    "alerts": {
        "module_id": "alerts",
        "route": "alerts",
        "display_name": "Early-Warning Alerts",
        "category": "INTELLIGENCE",
        "purpose": "Automated detection of persistent, multi-horizon skill deficits and surpluses before they manifest as critical industrial bottlenecks.",
        "intended_users": ["State Skill Commissioners", "ITI Regional Joint Directors", "Industry Associations"],
        "workflow": [
            "Filter alerts by severity: Critical (Red), Warning (Amber), Advisory (Blue).",
            "Verify persistence criteria: alert fires only if mismatch magnitude >= 15 pts across >= 2 forecast horizons.",
            "Click on an alert card to open its detailed root-cause dossier.",
            "Click 'Simulate Remedy' to automatically pass the alert parameters into Scenario Studio."
        ],
        "filters_and_inputs": ["Severity (Critical, Warning, Advisory)", "District", "Horizon"],
        "formulas_and_metrics": "Persistence Rule: |Mismatch Score| >= 15 points across at least 2 consecutive forecast horizons (e.g., 3M and 6M).",
        "backend_endpoints": ["GET /api/v1/alerts", "GET /api/v1/alerts/{alert_id}"],
        "data_coverage_and_limitations": "Suppresses single-month transitory spikes to prevent policy over-correction.",
        "related_pages": ["recommendations", "simulator", "gap"],
        "example_queries": ["What are the active alerts?", "Show me critical alerts in Pune", "Why was this alert triggered?"]
    },
    "recommendations": {
        "module_id": "recommendations",
        "route": "recommendations",
        "display_name": "Policy Recommendations",
        "category": "INTELLIGENCE",
        "purpose": "Algorithmic policy action dossiers translating skill gap and alert findings into actionable training seat reallocations and curriculum interventions.",
        "intended_users": ["Vocational Education Councils", "State Planning Boards", "ITI Principals"],
        "workflow": [
            "Review prioritized policy cards ranked by feasibility and projected deficit reduction.",
            "Inspect projected impact: e.g., 'Add 120 seats to ITI Dharwad CNC Machinist trade'.",
            "Review identified donor trades that can release capacity without creating local shortages.",
            "Click 'Apply to Scenario Studio' to immediately test the recommendation in the simulator."
        ],
        "filters_and_inputs": ["Sector", "District", "Feasibility Tier"],
        "formulas_and_metrics": "Projected Deficit Reduction = (Adjusted Placements / Historical Demand Deficit) * 100.",
        "backend_endpoints": ["GET /api/v1/alerts", "GET /api/v1/gap-analysis"],
        "data_coverage_and_limitations": "Assumes standard equipment availability and certified trainer availability in target institutes.",
        "related_pages": ["simulator", "alerts", "gap"],
        "example_queries": ["What are the recommended policy actions?", "How should we resolve Dharwad deficit?"]
    },
    "simulator": {
        "module_id": "simulator",
        "route": "simulator",
        "display_name": "Scenario Studio (Seat Simulator)",
        "category": "ACTION",
        "purpose": "Interactive sandbox allowing TVET administrators to simulate shifting training seat allocations between trades and measure projected placement and deficit impacts.",
        "intended_users": ["TVET Directors", "ITI Principals", "Apprenticeship Advisers"],
        "workflow": [
            "Select target District (e.g., Dharwad or Pune) and TVET Institute.",
            "Select a donor trade (surplus capacity) and a recipient trade (deficit role).",
            "Adjust the seat delta slider to reallocate capacity.",
            "Review constant-yield placement projections and verify donor trade non-depletion checks (>= 30% baseline retained).",
            "Click 'Save Scenario' to persist the simulation into My Workspace."
        ],
        "filters_and_inputs": ["District", "Source Trade (Donor)", "Target Trade (Recipient)", "Seat Delta Slider", "Time Horizon (3M, 6M, 12M)"],
        "formulas_and_metrics": "Delta Placements = Delta Seats * Historical Completion Rate * Historical Placement Rate. Donor retention check: Remaining Seats >= 0.30 * Baseline Seats.",
        "backend_endpoints": ["POST /api/v1/seat-simulator/simulate", "POST /api/v1/scenarios"],
        "data_coverage_and_limitations": "Simulations apply constant-yield scaling; new workshop construction lead-times are modeled with a 3-month activation delay.",
        "related_pages": ["workspace", "gap", "recommendations"],
        "example_queries": ["How do I simulate changing training seats?", "How does the seat simulator work?", "What happens if we add 100 CNC seats?"]
    },
    "workspace": {
        "module_id": "workspace",
        "route": "workspace",
        "display_name": "My Workspace",
        "category": "ACTION",
        "purpose": "Personalized management hub storing saved policy scenarios, candidate job application tracking pipelines, and bookmarked career roadmaps.",
        "intended_users": ["All Authenticated Users", "Policy Analysts", "Job Seekers"],
        "workflow": [
            "Switch between tabs: Saved Policy Scenarios, Application Tracker, and Career Roadmaps.",
            "Compare saved scenarios side-by-side against baseline mismatch indices.",
            "Re-open any saved scenario directly into Scenario Studio with one click.",
            "Track job application progress (Applied, Interview Scheduled, Offer Extended)."
        ],
        "filters_and_inputs": ["Entity Type Tabs (Scenarios, Applications, Roadmaps)"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/scenarios", "GET /api/v1/career/tracker", "GET /api/v1/career/roadmaps"],
        "data_coverage_and_limitations": "Records are private and isolated to the authenticated user account.",
        "related_pages": ["simulator", "career", "opportunities"],
        "example_queries": ["Where are my saved scenarios?", "Where can I track my applications?", "How do I review saved roadmaps?"]
    },
    "career": {
        "module_id": "career",
        "route": "career",
        "display_name": "Career Profile & Career Navigator",
        "category": "ACTION",
        "purpose": "Comprehensive candidate career advancement portal with profile management, verified skill auditing, NSQF target role gap analysis, milestone roadmaps, and the dedicated SkillPulse Career Navigator assistant.",
        "intended_users": ["Job Seekers", "ITI Students", "Polytechnic Graduates", "Career Counselors"],
        "workflow": [
            "Sub-tab 1 (Profile / Education): Enter education, NSQF level, and current occupation.",
            "Sub-tab 2 (Skills & Evidence): Audit skills with verifiable certification credentials.",
            "Sub-tab 3 (Target Role Gap Analysis): Compare candidate competencies against target roles (e.g. Python Backend Developer or CNC Machinist).",
            "Sub-tab 4 (Milestone Roadmap): Generate sequenced 4-milestone progression roadmaps.",
            "Sub-tab 5 (Career Navigator): Chat with the candidate assistant powered by Google Gemini or IBM watsonx.ai (with deterministic fallback).",
            "Sub-tab 6 (Application Tracker): Monitor employment pipelines."
        ],
        "filters_and_inputs": ["Target Role", "AI Consent Toggle", "AI Provider (Gemini / watsonx.ai)"],
        "formulas_and_metrics": "Skill Match % = (Matched Verified Skills / Target Role Required Skills) * 100.",
        "backend_endpoints": ["GET/POST /api/v1/career/profile", "POST /api/v1/career/gap-analysis", "POST /api/v1/career/roadmap", "POST /api/v1/career/copilot"],
        "data_coverage_and_limitations": "AI features require user consent and valid backend API credentials; falls back gracefully to deterministic rule-based roadmaps if unconfigured.",
        "related_pages": ["opportunities", "workspace", "occupations"],
        "example_queries": ["How do I build a career roadmap?", "What is SkillPulse Career Navigator?", "How do I analyze my skill gaps?"]
    },
    "opportunities": {
        "module_id": "opportunities",
        "route": "opportunities",
        "display_name": "Opportunity Explorer",
        "category": "ACTION",
        "purpose": "Verified directory of active apprenticeships, vocational courses, and jobs aggregated from official Government of India portals: SWAYAM Plus, NAPS, and NCS.",
        "intended_users": ["Job Seekers", "Apprentices", "Students"],
        "workflow": [
            "Filter opportunities by Portal Source (SWAYAM Plus, NAPS, NCS), Sector, District, and NSQF Level.",
            "Type keywords (e.g., 'CNC', 'Python', 'Logistics') in the search bar.",
            "Inspect duration, stipend/salary, credential type, and qualification requirements.",
            "Click 'Apply on Official Portal' to proceed externally, or 'Track in Workspace' to save."
        ],
        "filters_and_inputs": ["Source Portal (SWAYAM, NAPS, NCS)", "District", "Sector", "Search Query", "NSQF Level"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/career/opportunities"],
        "data_coverage_and_limitations": "Catalogue of verified sample opportunities mapped to official Government of India portal schemas.",
        "related_pages": ["career", "workspace", "qualifications"],
        "example_queries": ["How do I find learning opportunities?", "Where are NAPS apprenticeships?", "Show me SWAYAM courses"]
    },
    "districts": {
        "module_id": "districts",
        "route": "districts",
        "display_name": "Districts Explorer",
        "category": "EXPLORE",
        "purpose": "Geospatial intelligence module with an interactive Leaflet map and benchmark charts across the 6 pilot districts.",
        "intended_users": ["Regional Planners", "State Skill Officials", "Researchers"],
        "workflow": [
            "Interact with the vector map of India centered on Maharashtra, Karnataka, and Telangana.",
            "Click on district markers: Pune, Mumbai Suburban, Bengaluru Urban, Dharwad, Hyderabad, Medchal-Malkajgiri.",
            "Review district profile: industrial focus, operational TVET institutes, total demand postings, and aggregate mismatch.",
            "Use comparative charts to benchmark two or more districts side-by-side."
        ],
        "filters_and_inputs": ["District Selection", "State Filter", "Indicator Benchmark Selector"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/metadata/districts", "GET /api/v1/demand"],
        "data_coverage_and_limitations": "Covers the 6 official pilot districts: MH_PUN, MH_MUM, KA_BLR_U, KA_DHA, TS_HYD, TS_MED.",
        "related_pages": ["overview", "demand", "gap"],
        "example_queries": ["Show me the map of districts", "Compare Pune and Dharwad", "Which districts are in the pilot?"]
    },
    "occupations": {
        "module_id": "occupations",
        "route": "occupations",
        "display_name": "Occupations Explorer",
        "category": "EXPLORE",
        "purpose": "Labour taxonomy explorer mapping 9 pilot occupations to National Classification of Occupations (NCO-2015) codes, Qualification Packs, and skill matrices.",
        "intended_users": ["Vocational Counselors", "Curriculum Developers", "Employers"],
        "workflow": [
            "Select an industrial sector: IT-ITeS, Manufacturing, or Logistics.",
            "Inspect occupation cards (e.g., OCC_MFG_001: CNC Operator / Machining Technician).",
            "Review NCO-2015 code, standard job role description, average entry wage, and demand intensity.",
            "Inspect associated skill competencies (foundational vs. specialized technical skills)."
        ],
        "filters_and_inputs": ["Sector Selector", "Search Query", "NSQF Level Tier"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/metadata/occupations"],
        "data_coverage_and_limitations": "Standardized across 9 benchmark pilot occupations for the hackathon scope.",
        "related_pages": ["qualifications", "gap", "career"],
        "example_queries": ["What occupations are tracked?", "What is the NCO code for CNC Machinist?", "Show manufacturing roles"]
    },
    "qualifications": {
        "module_id": "qualifications",
        "route": "qualifications",
        "display_name": "Qualifications Explorer",
        "category": "EXPLORE",
        "purpose": "National Skills Qualification Framework (NSQF) registry detailing Qualification Packs, awarding bodies, and credit levels.",
        "intended_users": ["Training Assessors", "Students", "Curriculum Planners"],
        "workflow": [
            "Review qualification profiles spanning NSQF Levels 3.0 through 6.0.",
            "Inspect awarding Sector Skill Council (SSC) accreditation (NASSCOM, CGSC/ASDC, LSC).",
            "Review theory/practical credit hours and minimum educational entry criteria.",
            "Evaluate vertical mobility pathways (e.g., Level 4 Operator to Level 5 Supervisor)."
        ],
        "filters_and_inputs": ["NSQF Level", "Awarding Body", "Sector"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["GET /api/v1/metadata/qualifications"],
        "data_coverage_and_limitations": "Aligned with official NCVET and NSQF qualification standards.",
        "related_pages": ["occupations", "career", "opportunities"],
        "example_queries": ["What is NSQF Level 4?", "Show qualifications for logistics", "Which awarding bodies are listed?"]
    },
    "data-health": {
        "module_id": "data-health",
        "route": "data-health",
        "display_name": "Data & Model Health",
        "category": "SYSTEM",
        "purpose": "Data governance, pipeline integrity verification, and statistical audit dashboard ensuring zero invalid or corrupted records enter the analytical pipeline.",
        "intended_users": ["SIH Evaluators", "Data Engineers", "Auditors"],
        "workflow": [
            "Review dataset completeness metrics across 6,495 rows (5,184 demand, 1,296 TVET cohorts, 15 master metadata).",
            "Verify 100% adherence to TVET Funnel Invariants: Placements <= Certifications <= Completions <= Enrolments.",
            "Inspect forecast backtesting error distribution across 16 rolling origin folds (RMSE, MAE, Mean Directional Accuracy).",
            "Audit synthetic data calibration parameters and seed reproducibility."
        ],
        "filters_and_inputs": ["Pipeline Stage", "Error Category", "Metric Type"],
        "formulas_and_metrics": "Funnel Invariant: Placements <= Certifications <= Completions <= Enrolments. Evaluation metric: RMSE across 16 rolling-origin splits.",
        "backend_endpoints": ["GET /api/v1/metadata/health"],
        "data_coverage_and_limitations": "Audits SQLite database tables and in-memory evaluation logs.",
        "related_pages": ["api", "settings", "forecasts"],
        "example_queries": ["How do I check data quality?", "Is the data valid?", "What are the funnel invariants?"]
    },
    "api": {
        "module_id": "api",
        "route": "api",
        "display_name": "API & Data Exports",
        "category": "SYSTEM",
        "purpose": "Developer and researcher portal providing interactive API documentation, executable code snippets, and raw dataset exports in JSON and CSV formats.",
        "intended_users": ["Developers", "Academic Researchers", "System Integrators"],
        "workflow": [
            "Review interactive documentation for all 10 REST API routes.",
            "Inspect copy-to-clipboard code snippets in curl, JavaScript fetch, and Python requests.",
            "Generate and test live query parameters directly in the browser.",
            "Download raw analytical slices in JSON and CSV formats."
        ],
        "filters_and_inputs": ["Endpoint Selector", "Output Format (JSON/CSV)", "Slicing Parameters"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["OpenAPI /docs", "/api/v1/demand", "/api/v1/gap-analysis", "/api/v1/forecasts", "/api/v1/alerts"],
        "data_coverage_and_limitations": "Exports adhere to rate limits and sanitization standards.",
        "related_pages": ["data-health", "settings"],
        "example_queries": ["How do I export data?", "Where is the API documentation?", "How do I query demand via API?"]
    },
    "settings": {
        "module_id": "settings",
        "route": "settings",
        "display_name": "System Settings",
        "category": "SYSTEM",
        "purpose": "User preference and governance control panel managing UI localization, appearance themes, reporting period selection, and privacy/consent toggles.",
        "intended_users": ["All Users"],
        "workflow": [
            "Select UI language: English or Hindi.",
            "Choose appearance: Light, Dark, or System Default.",
            "Inspect active reporting period (2026-09) and model calibration date.",
            "Configure AI Processing Consent and clear cached local state."
        ],
        "filters_and_inputs": ["Language Selector (EN/HI)", "Theme Selector", "Privacy Toggles"],
        "formulas_and_metrics": None,
        "backend_endpoints": ["Client local storage synchronized with settings context"],
        "data_coverage_and_limitations": "Settings are persisted in the user's browser local storage.",
        "related_pages": ["overview", "career"],
        "example_queries": ["How do I switch to Hindi?", "How do I toggle dark mode?", "Where do I manage consent?"]
    },
    "saarthi": {
        "module_id": "saarthi",
        "route": "overview",  # opened as global drawer
        "display_name": "SkillPulse Saarthi",
        "category": "ASSISTANT",
        "purpose": "Global platform guide and labour-market intelligence assistant offering step-by-step navigation help and grounded analytical decision support.",
        "intended_users": ["All Users", "Policymakers", "Students", "Evaluators"],
        "workflow": [
            "Click the 'Ask Saarthi' button in the top navigation bar or from the homepage.",
            "Choose a starter prompt or type any natural language question.",
            "For platform questions: receive step-by-step instructions and click action buttons to navigate directly.",
            "For labour-market questions: receive source-grounded analytical tables and confidence scores computed from actual pilot data."
        ],
        "filters_and_inputs": ["Free-text composer", "Starter question chips", "Conversation history"],
        "formulas_and_metrics": "Dual-engine routing: Platform Guide uses verified product catalogue; Policy Analytics queries SQLite data tables directly.",
        "backend_endpoints": ["POST /api/v1/policy-copilot/query"],
        "data_coverage_and_limitations": "Platform guide covers all 18 implemented modules; policy analytics is bounded by the 6 pilot districts and 9 occupations.",
        "related_pages": ["home", "overview", "gap", "simulator"],
        "example_queries": ["How do I use this site?", "What can SkillPulse do?", "Who is Saarthi?"]
    }
}

# -----------------------------------------------------------------------------
# Metric Definitions Catalogue
# -----------------------------------------------------------------------------
METRIC_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "relative_mismatch": {
        "name": "Relative Mismatch Score",
        "formula": "Relative Mismatch Score = Demand Score - Supply Score",
        "range": "-100 to +100",
        "interpretation": "A positive score indicates an undersupplied skill deficit (employers need more workers than TVET is graduating). A negative score indicates a surplus (graduates exceed current hiring demand). A score near 0 indicates market equilibrium.",
        "key_thresholds": [
            "Severe Deficit: >= +30.0",
            "Moderate Deficit: +15.0 to +29.9",
            "Balanced: -14.9 to +14.9",
            "Moderate Surplus: -15.0 to -29.9",
            "Severe Surplus: <= -30.0"
        ],
        "limitations": "Relative scores reflect calibrated supply-demand ratios, not absolute physical headcount tallies. A 90-day placement maturity buffer prevents premature panic for recently graduated cohorts.",
        "route": "gap",
        "action_label": "Inspect in Skill Gaps"
    },
    "composite_demand": {
        "name": "Composite Demand Score",
        "formula": "Demand Score = (Posting Volume * 0.30) + (Posting Growth * 0.25) + (Posting Persistence * 0.15) + (Employer Breadth * 0.15) + (Wage Premium * 0.15)",
        "range": "0 to 100",
        "interpretation": "A multi-factor index combining raw job posting counts with growth velocity, hiring duration, diversity of recruiting firms, and wage competitiveness.",
        "components": [
            "Posting Volume (30% weight): Total unique job openings in the reporting window.",
            "Posting Growth (25% weight): Month-over-month rate of expansion in hiring.",
            "Posting Persistence (15% weight): Frequency with which postings remain unfilled across consecutive cycles.",
            "Employer Breadth (15% weight): Spread of hiring across multiple distinct employer entities (HHI-adjusted).",
            "Wage Premium (15% weight): Stated compensation relative to the regional sectoral benchmark."
        ],
        "limitations": "Reflects formal employer postings. Informal unlisted MSME demand is calibrated via regional expansion multipliers.",
        "route": "demand",
        "action_label": "View Demand Intelligence"
    },
    "funnel_invariants": {
        "name": "TVET Funnel Invariants & Placement Maturity",
        "formula": "Placements <= Certifications <= Completions <= Enrolments",
        "range": "Enforced 100% strictly across all 1,296 TVET cohort records",
        "interpretation": "Ensures physical sanity across vocational training cohorts. Students cannot be certified without completing, and cannot be placed without certification.",
        "maturity_rule": "90-Day Placement Maturity Rule: TVET cohorts that graduated within the past 90 days are flagged as 'Maturing'. They are not penalized as failed placements because industrial hiring cycles require 60 to 90 days.",
        "limitations": "Placement tracking relies on institutional reporting and NAPS apprenticeship verification.",
        "route": "data-health",
        "action_label": "Check Data & Model Health"
    },
    "prediction_intervals": {
        "name": "Forecast Prediction Intervals",
        "formula": "80% Prediction Interval = Forecast +/- (1.282 * RMSE)",
        "range": "Computed across 3M, 6M, and 12M projection horizons",
        "interpretation": "Quantifies statistical forecast uncertainty. Shorter horizons (3M) exhibit narrower intervals, while 12M projections account for greater industrial variance.",
        "evaluation": "Backtested using 16 rolling-origin cross-validation folds against historical series.",
        "limitations": "Time-series statistical models assume structural stability; macroeconomic shocks outside the historical training series are not captured.",
        "route": "forecasts",
        "action_label": "Explore Forecast Models"
    },
    "constant_yield": {
        "name": "Constant-Yield Throughput Scaling",
        "formula": "Delta Placements = Delta Seats * Historical Completion Rate * Historical Placement Rate",
        "range": "Evaluated during interactive seat simulation",
        "interpretation": "Used in Scenario Studio to project how many additional placed workers will result from reallocating physical seats to a deficit trade.",
        "donor_rule": "Donor Trade Retention Rule: A trade releasing seats must retain at least 30% of its baseline capacity to avoid creating artificial shortages.",
        "limitations": "Assumes constant training quality and certified trainer availability. New lab infrastructure incurs a modeled 3-month activation delay.",
        "route": "simulator",
        "action_label": "Open Scenario Studio"
    }
}

# -----------------------------------------------------------------------------
# Workflows & Getting Started Guides
# -----------------------------------------------------------------------------
PLATFORM_WORKFLOWS: Dict[str, Dict[str, Any]] = {
    "getting_started": {
        "title": "Getting Started with SkillPulse LMIS",
        "intro": "Welcome to SkillPulse LMIS (Labour Market Intelligence System), developed for the Smart India Hackathon. SkillPulse bridges employer demand signals with TVET capacity planning and candidate skilling pathways across 6 pilot districts.",
        "steps": [
            "1. Executive Overview ('overview'): Review macro mismatch indices, active alert counts, and regional pressure clusters.",
            "2. Skill Gaps ('gap'): Drill down into district and occupation mismatches, analyzing the 4-stage TVET training funnel.",
            "3. Predictive Forecasts ('forecasts'): Inspect 3M, 6M, and 12M statistical projections with 80% confidence intervals.",
            "4. Early-Warning Alerts ('alerts'): Check persistent multi-horizon deficits and surpluses requiring policy intervention.",
            "5. Scenario Studio ('simulator'): Interactively reallocate training seats between donor and deficit trades to simulate deficit reduction.",
            "6. Candidate Tools ('career' & 'opportunities'): Build personalized NSQF roadmaps, explore verified NAPS/SWAYAM opportunities, and track applications."
        ],
        "route": "overview",
        "action_label": "Go to Executive Overview"
    },
    "policymaker_workflow": {
        "title": "Policymaker & TVET Administrator Workflow",
        "intro": "A structured 4-step workflow for state skill development directors and ITI administrators:",
        "steps": [
            "Step 1: Check Executive Overview ('overview') to identify districts with the highest mismatch intensity.",
            "Step 2: Inspect Early-Warning Alerts ('alerts') to verify persistent deficits lasting across 2 or more forecast horizons.",
            "Step 3: Open Skill Gaps ('gap') to evaluate TVET completion and 90-day placement maturity for the affected trade.",
            "Step 4: Launch Scenario Studio ('simulator') to reallocate training capacity from a surplus donor trade and save the intervention scenario."
        ],
        "route": "simulator",
        "action_label": "Launch Scenario Studio"
    },
    "candidate_workflow": {
        "title": "Candidate & Student Career Workflow",
        "intro": "A 4-step pathway for students, ITI graduates, and job seekers looking to upgrade skills and secure verified opportunities:",
        "steps": [
            "Step 1: Open Career Profile ('career') and complete your education profile and verified skills inventory.",
            "Step 2: Run Target Role Gap Analysis to identify missing competencies for high-demand roles (e.g. CNC Operator or Backend Developer).",
            "Step 3: Generate a sequenced Milestone Roadmap and consult SkillPulse Career Navigator for personalized guidance.",
            "Step 4: Browse Opportunity Explorer ('opportunities') for verified SWAYAM Plus courses and NAPS apprenticeships, tracking applications in My Workspace."
        ],
        "route": "career",
        "action_label": "Open Career Profile"
    },
    "evaluator_workflow": {
        "title": "Hackathon Evaluator & Technical Auditor Workflow",
        "intro": "A technical audit workflow for SIH judges evaluating data integrity, statistical rigor, and architecture:",
        "steps": [
            "Step 1: Visit Data & Model Health ('data-health') to verify 100% adherence to TVET Funnel Invariants across 6,495 rows.",
            "Step 2: Inspect Forecast Evaluation metrics across 16 rolling-origin cross-validation folds.",
            "Step 3: Review API & Data Exports ('api') to test interactive REST endpoints and examine raw JSON/CSV schemas.",
            "Step 4: Audit system synthetic data disclosure and reproducibility parameters."
        ],
        "route": "data-health",
        "action_label": "Audit Data & Model Health"
    },
    "simulate_seats_workflow": {
        "title": "How to Simulate TVET Seat Reallocation",
        "intro": "Step-by-step instructions to simulate training capacity reallocation in Scenario Studio:",
        "steps": [
            "1. Navigate to Scenario Studio ('simulator') from the left sidebar.",
            "2. Select your target District (e.g., Dharwad 'KA_DHA' or Pune 'MH_PUN') and TVET Institution.",
            "3. Choose a Donor Trade that currently has surplus capacity or low demand (e.g. Data Entry Operator).",
            "4. Choose a Recipient Trade facing acute industry demand (e.g. CNC Machinist).",
            "5. Drag the Seat Delta Slider to shift seats (e.g. +60 or +120 seats).",
            "6. Observe the constant-yield calculation update in real time: projected placement gains and deficit reduction %.",
            "7. Ensure the donor retention check passes (donor must keep >= 30% baseline capacity).",
            "8. Click 'Save Scenario' to name and store your scenario in My Workspace."
        ],
        "route": "simulator",
        "action_label": "Open Scenario Studio"
    },
    "forecast_workflow": {
        "title": "How to Generate and Compare Forecasts",
        "intro": "How to evaluate statistical multi-horizon projections in SkillPulse LMIS:",
        "steps": [
            "1. Navigate to Predictive Forecasts ('forecasts') from the left sidebar.",
            "2. Select the target District and Occupation.",
            "3. Toggle between forecast horizons: 3-Month (near term), 6-Month (medium term), and 12-Month (strategic).",
            "4. Switch model architectures: Moving Average (MA-3), Linear Trend Regression, or Naive Baseline.",
            "5. Review the fan chart with 80% prediction interval bands (+/- 1.282 * RMSE).",
            "6. Inspect the rolling-origin evaluation table to see which model achieved the lowest RMSE for that trade."
        ],
        "route": "forecasts",
        "action_label": "View Forecasts"
    },
    "export_workflow": {
        "title": "How to Export Data and Query APIs",
        "intro": "How to export datasets and access the SkillPulse REST API:",
        "steps": [
            "1. Navigate to API & Exports ('api') under the System group.",
            "2. Select the desired data domain: Demand, Gap Analysis, Forecasts, or Alerts.",
            "3. Choose your export format: CSV for spreadsheets or JSON for analytical code.",
            "4. To access programmatically, copy the ready-to-run curl, JavaScript fetch, or Python requests snippet.",
            "5. For full interactive Swagger/OpenAPI documentation, visit the '/docs' backend endpoint."
        ],
        "route": "api",
        "action_label": "Go to API & Exports"
    }
}

# -----------------------------------------------------------------------------
# Data Scope & Coverage Disclosure
# -----------------------------------------------------------------------------
DATA_SCOPE_METADATA = {
    "reporting_period": "2026-09",
    "calibration_date": "2026-10-14",
    "total_rows": 6495,
    "demand_rows": 5184,
    "tvet_cohort_rows": 1296,
    "master_rows": 15,
    "states": [
        {"code": "MH", "name": "Maharashtra", "districts": ["Pune (MH_PUN)", "Mumbai Suburban (MH_MUM)"]},
        {"code": "KA", "name": "Karnataka", "districts": ["Bengaluru Urban (KA_BLR_U)", "Dharwad (KA_DHA)"]},
        {"code": "TS", "name": "Telangana", "districts": ["Hyderabad (TS_HYD)", "Medchal-Malkajgiri (TS_MED)"]}
    ],
    "sectors": ["IT-ITeS", "Manufacturing", "Logistics"],
    "occupations": [
        {"id": "OCC_IT_001", "name": "Python / Backend Developer", "sector": "IT-ITeS", "nco": "2512.0101"},
        {"id": "OCC_IT_002", "name": "Frontend Web Developer", "sector": "IT-ITeS", "nco": "2513.0101"},
        {"id": "OCC_IT_003", "name": "Data Quality Analyst", "sector": "IT-ITeS", "nco": "2521.0101"},
        {"id": "OCC_MFG_001", "name": "CNC Operator / Machining Technician", "sector": "Manufacturing", "nco": "7223.0101"},
        {"id": "OCC_MFG_002", "name": "Welder & Quality Inspector", "sector": "Manufacturing", "nco": "7212.0101"},
        {"id": "OCC_MFG_003", "name": "Assembly Line Operator", "sector": "Manufacturing", "nco": "8211.0101"},
        {"id": "OCC_LOG_001", "name": "Warehouse Inventory Supervisor", "sector": "Logistics", "nco": "4321.0101"},
        {"id": "OCC_LOG_002", "name": "Forklift & Material Handler", "sector": "Logistics", "nco": "8344.0101"},
        {"id": "OCC_LOG_003", "name": "Fleet Dispatch Coordinator", "sector": "Logistics", "nco": "4323.0101"}
    ],
    "synthetic_disclosure": (
        "Notice: Data in this pilot is synthetically calibrated using official NCO-2015 labour classification codes "
        "and empirical TVET capacity distributions representative of Maharashtra, Karnataka, and Telangana. "
        "Outputs do not represent live Census headcount shortages."
    )
}
