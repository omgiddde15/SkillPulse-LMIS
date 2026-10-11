# SkillPulse LMIS — Grand Finale Demonstration Runbook

**Smart India Hackathon 2026 — Problem Statement SIH26246**  
**Project:** AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine  
**System Name:** SkillPulse LMIS  
**Evaluation Target:** National Finale Jury Presentation & Live System Demonstration  

---

## 1. Quick-Start & Pre-Flight Verification

Before inviting the jury or commencing the presentation, verify that both backend and frontend services are active, healthy, and serving up-to-date assets.

### 1.1 Startup Commands

Open two terminal sessions from the project root (`C:\SIH26246\SkillPulse`):

#### Terminal 1 — Backend API Server (FastAPI / Uvicorn)
```powershell
cd C:\SIH26246\SkillPulse\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*Health Check Target:* `http://127.0.0.1:8000/health`  
*Expected Output:* `{"status":"healthy"}`

#### Terminal 2 — Frontend Application (React / Vite)
```powershell
cd C:\SIH26246\SkillPulse\frontend
npm run dev
```
*Local URL:* `http://localhost:3000` (or `http://127.0.0.1:3000`)

### 1.2 Pre-Flight System Health Checklist

| Check | Command / URL | Expected Result | Verified Status |
| :--- | :--- | :--- | :--- |
| **Backend Health** | `curl -s http://127.0.0.1:8000/health` | `{"status":"healthy"}` | **PASS** |
| **Backend Test Suite** | `python -m pytest` (in `backend/`) | `111 passed in ~6-11s` | **PASS** |
| **Sample Data Validator** | `python backend/scripts/validate_sample_data.py` | `6,495 rows validated; 0 errors` | **PASS** |
| **Frontend Code Quality** | `npm run lint` (oxlint) | `0 warnings, 0 errors (20 files)` | **PASS** |
| **Production Build** | `npm run build` (vite build) | `built cleanly in <500ms` | **PASS** |
| **Localization Completeness** | Language toggle in UI | 100% dictionary coverage (EN & HI) | **PASS** |

---

## 2. 5–7 Minute Master Demonstration Sequence (Judge Journey)

This sequence guides the jury through the end-to-end policy workflow of SkillPulse LMIS, moving logically from macro intelligence to district-level root-cause diagnostics, temporal forecasting, automated alerting, policy seat simulation, and secure open data export.

```
+-----------------------------------------------------------------------------------------------+
|                                    JUDGE JOURNEY FLOW                                         |
|                                                                                               |
|  [Step 1: Overview]          --> Macro KPI cards & Instant Bilingual EN/HI Toggle             |
|  [Step 2: Demand Intel]      --> Top demand role: Cloud Associate (TS_HYD / OCC_IT_001)       |
|  [Step 3: Gap Analysis]      --> Demand Pressure: CNC Operator (KA_DHA / OCC_MFG_001)         |
|                                  Supply Pressure: EV Assembly Tech (KA_BLR_U / OCC_MFG_003)   |
|  [Step 4: Forecasting]       --> 3M/6M/12M Horizon Models (Naive, MA3, Linear Trend)           |
|  [Step 5: Alerts]            --> Early-warning acceleration & actionable policy interventions |
|  [Step 6: Seat Simulator]    --> Reallocation: KA_BLR_U OCC_LOG_001 (80 -> 100 -> 180 seats)  |
|  [Step 7: CSV Exports]       --> Rectangular, formula-safe, pandas-ready open data feeds      |
+-----------------------------------------------------------------------------------------------+
```

---

### Step 1: Macro Overview & Bilingual Localization (0:00 – 1:00)

1. **Navigate to:** `http://localhost:3000`
2. **Present the Executive Dashboard:**
   - Highlight the **Macro KPI Cards**: Active Job Postings, Supply Pipeline Volume, Relative Mismatch Score, and Active Alerts.
   - Point out the **Filter Bar**: Multi-dimensional filtering across States (KA, MH, TS), 6 Pilot Districts, 3 Industrial Sectors (IT/ITeS, Manufacturing, Logistics), and Reporting Periods (2024-10 to 2026-09).
3. **Demonstrate Bilingual Localization (EN / हिन्दी):**
   - Click the **EN / हिन्दी** toggle in the top navigation header.
   - Observe immediate translation of all cards, navigation, chart headers, and policy labels into natural administrative Hindi (e.g., *कौशल मांग सूचकांक*, *असंतुलन विश्लेषण*, *पूर्वानुमान*).
   - Refresh the browser to demonstrate persistent language state via `localStorage`.
   - Switch back to English (or proceed in Hindi as requested by judges).
4. **Transparency & Methodology Disclosure:**
   - Highlight the explicit disclaimers: all baseline observations are synthetic demonstration data (not official statistics); relative mismatch scores reflect percentile differences ($-100$ to $+100$), not absolute job deficits.

---

### Step 2: Demand Intelligence & Official Taxonomy Linkage (1:00 – 2:00)

1. **Navigate to:** `Demand Intelligence` (Sidebar)
2. **Set Filters:**
   - **State:** `TS` (Telangana)
   - **District:** `TS_HYD` (Hyderabad)
   - **Sector:** `IT/ITeS`
   - **Period:** `2026-09`
3. **Spotlight Occupation:** `Cloud Infrastructure Associate` (`OCC_IT_001`)
   - **Composite Demand Score:** **85.8 / 100** (Cohort Rank 1)
   - **Raw Posting Volume:** **159 online postings** (score: 98.1 / 100)
   - **Key Demand Drivers:** High employer diversity (58 active employers, score 97.2), wage attractiveness index (125.7 pts, score 80.2), and steady demand growth (+8.1% trailing 3-month momentum).
4. **Demonstrate Official Taxonomy Rigor:**
   - Expand the occupation taxonomy metadata panel.
   - Point out that **Qualification Pack is `SSC/Q8304`** (*Cloud Infrastructure Analyst*, NSQF Level 6.0, IT-ITeS SSC).
   - **Defensible Honesty:** Explain why the specific NCO leaf code is transparently **`null`**: In NCO-2015, code `2522.0100` is verbatim *Database Administrator*, and Unit `2522` contains no specific leaf code for Cloud Infrastructure. In accordance with national data governance principles, broad family codes are not forced as specific leaf codes.

---

### Step 3: Gap Analysis & Relative Mismatch Diagnostics (2:00 – 3:15)

1. **Navigate to:** `Gap Analysis` (Sidebar)
2. **Demonstrate Demand Pressure (Shortage):**
   - **State:** `KA` (Karnataka)
   - **District:** `KA_DHA` (Dharwad)
   - **Occupation:** `CNC Machine Operator` (`OCC_MFG_001`)
   - **Demand Index Score:** **73.1 / 100** vs. **Supply Output Index:** **17.0 / 100**
   - **Relative Mismatch Score:** **+56.1** (Policy Classification: **`Demand Pressure`**)
   - **Diagnostic Insight:** Dharwad's precision manufacturing belt shows high hiring intensity (148 postings, score 83.0) while local ITI/polytechnic certification output lags substantially (3-Month certified throughput: 137 candidates).
   - **Taxonomy Note:** Mapped to exact NCO-2015 code **`7223.5001`** (*Machining Technician / CNC Operator*) and QP **`CSC/Q0115`** (*CNC Operator Turning*, NSQF Level 4.0, Capital Goods SSC).
3. **Contrast with Supply Pressure (Saturation):**
   - **District:** `KA_BLR_U` (Bengaluru Urban)
   - **Occupation:** `Electric Vehicle Assembly Technician` (`OCC_MFG_003`)
   - **Demand Index Score:** **30.5 / 100** vs. **Supply Output Index:** **79.3 / 100**
   - **Relative Mismatch Score:** **-48.7** (Policy Classification: **`Supply Pressure`**)
   - **Diagnostic Insight:** High training throughput in Bengaluru Urban has outpaced immediate local hiring absorption, creating surplus pressure.
4. **90-Day Placement Maturity Honesty:**
   - Note that for the latest reporting period (`2026-09`), the 90-day placement verification status correctly displays **`Pending` / null**.
   - Explain why: TVET standards require 90 days post-certification to verify statutory employment; immature cohorts must be marked pending rather than fabricating immediate placement rates.

---

### Step 4: Forecasting Engine & Rolling-Origin Backtesting (3:15 – 4:15)

1. **Navigate to:** `Forecasts` (Sidebar)
2. **Inspect Multi-Horizon Projections:**
   - Select Base Period: `2026-09`
   - Switch between **3 Months** (`2026-12`), **6 Months** (`2027-03`), and **12 Months** (`2027-09`).
   - The table strictly filters to display only the selected horizon.
3. **Explain the Algorithmic Foundation:**
   - Highlight the candidate models: **Naive** (last observed value), **MA3** (3-month moving average), and **Linear Trend** (OLS slope extrapolation).
   - Explain that model selection is **100% deterministic**, choosing the winning model based on minimum out-of-sample rolling-origin backtest Mean Absolute Error (MAE) and WAPE (with tie-breaker: Naive > MA3 > Linear Trend).
   - Point out the **80% Prediction Interval bands** (`lower_80` and `upper_80`) derived from out-of-sample backtest RMSE ($\pm 1.282 \times \text{RMSE}$).
4. **Key Talking Point:**
   > *"District-level administrative time series have short history (24 monthly observations per series). Rather than overfitting opaque deep-learning models, SkillPulse uses deterministic rolling-origin backtesting across transparent baseline models with auditable prediction intervals."*

---

### Step 5: Early-Warning Alerts Engine (4:15 – 4:45)

1. **Navigate to:** `Early-Warning Alerts` (Sidebar)
2. **Review High-Severity Alerts:**
   - Filter by High Severity.
   - Inspect the alert generated for `KA_DHA` / `CNC Machine Operator`:
     - **Trigger Condition:** High demand momentum coupled with a persistent relative mismatch $> +50$ points.
     - **Suggested Policy Action:** Authorize emergency batch expansions under PMKVY 4.0; incentivize dual-training partnerships with regional automotive/machining industry clusters.
   - Point out transparent limitation notices: alerts are decision-support signals operating on prototype heuristic thresholds (±15), not empirically calibrated policy rules.

---

### Step 6: Training-Seat Allocation Simulator (4:45 – 5:45)

1. **Navigate to:** `Seat Simulator` (Sidebar)
2. **Load Scenario Parameters:**
   - **District:** `KA_BLR_U` (Bengaluru Urban)
   - **Occupation:** `OCC_LOG_001` (*Warehouse Inventory Coordinator*)
   - **Base Period:** `2026-09`
   - **Projection Horizon:** `6 Months` (`2027-03`)
3. **Examine Historical Baseline:**
   - Baseline Avg Seats per Cohort: **80.0 seats**
   - Baseline Projected Throughput: **55.3 certified candidates/month**
   - Baseline Projected Mismatch Score: **+15.1** (Policy Classification: **`Demand Pressure`**)
4. **Simulate Scenario 1 — Moderate Expansion (100 Seats):**
   - Set Proposed Seats per Cohort to **100 seats** (+20 seats, +25%).
   - Click **Run Simulation** (सिमुलेशन चलाएं).
   - **Result:** Scenario Throughput increases to **69.1 candidates/month**; Scenario Mismatch shifts to **-16.98** (Classification transitions to **`Supply Pressure`**, a shift of $-32.1$ points).
5. **Simulate Scenario 2 — Aggressive Expansion (180 Seats):**
   - Set Proposed Seats per Cohort to **180 seats** (+100 seats, +125%).
   - Click **Run Simulation**.
   - **Result:** Scenario Throughput expands to **124.4 candidates/month**; Scenario Mismatch plunges to **-39.62** (**`Supply Pressure`**, deep saturation).
6. **Deliver the Strategic Policy Takeaway:**
   > *"This simulation demonstrates a vital policy insight: over-allocating seats in Bengaluru Warehousing rapidly shifts the trade into graduate saturation (-39.6 mismatch). State planners should instead divert training funds and seat capacity into Dharwad CNC Machining where industry faces critical shortages."*

---

### Step 7: Open Data & Secure CSV Export Service (5:45 – 6:30)

1. **Demonstrate One-Click CSV Exports:**
   - In **Gap Analysis**, click **Export CSV** (exports **39 columns** including all 25 analytical metrics, 8 metadata fields, and 6 disclaimers).
   - In **Forecasts**, click **Export CSV** (exports **44 columns** for the selected horizon).
   - In **Seat Simulator**, click **Export CSV** (exports the structured **8-column** Scenario Plan across all 5 sections, 40 rows).
2. **Highlight Engineering Rigor:**
   - **Strictly Rectangular Format:** Opens cleanly in Microsoft Excel and Python `pandas.read_csv` without `skiprows` or jagged rows.
   - **Formula Injection Defense:** Cells starting with `=, +, -, @, \t, \r` are safely neutralized with `'` to mitigate spreadsheet injection vulnerabilities.
   - **Preserved Numeric Negatives:** Legitimate negative scores (e.g. `-48.73`, `-39.62`, `-16.98`) remain pure numeric floats.
   - **UTF-8 BOM (`\uFEFF`):** Ensures Hindi characters render natively in desktop Microsoft Excel without character corruption.

---

## 3. Authoritative Occupation Taxonomy Reference Table

Refer to this verified mapping table for the nine demo benchmark occupations:

| Occupation ID | Demo Occupation Title | Sector | Vocational Trade | Verified NCO-2015 Code & Title | Verified QP/NOS Code & Title | NSQF Level | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `OCC_IT_001` | Cloud Infrastructure Associate | IT/ITeS | Cloud Computing | *None* (Unmapped) | `SSC/Q8304`<br>Cloud Infrastructure Analyst | 6.0 | Broad Family 2522 only; specific leaf unmapped |
| `OCC_IT_002` | Data Quality Analyst | IT/ITeS | Data & Analytics | *None* (Unmapped) | `SSC/Q8101`<br>AI – Data Quality Analyst | 6.0 | Broad Family 2521 only; 2521.0200 does not exist |
| `OCC_IT_003` | Full-Stack Web Developer | IT/ITeS | Software Engineering | **2513.0101**<br>Web Developer | `SSC/Q0503`<br>Web Developer | 4.0 | Strong semantic match |
| `OCC_MFG_001` | CNC Machine Operator | Manufacturing | Precision Machining | **7223.5001**<br>Machining Technician / CNC Operator | `CSC/Q0115`<br>CNC Operator Turning | 4.0 | NCO exact match; Capital Goods SSC v2.0 |
| `OCC_MFG_002` | Industrial Automation Technician | Manufacturing | Mechatronics | **7412.0101**<br>Automation Specialist | `IAS/Q5601`<br>Industrial Automation Technician | 4.0 | Verified IASC QP (corrected from invalid Q8004) |
| `OCC_MFG_003` | Electric Vehicle Assembly Technician | Manufacturing | Automotive | **8211.1201**<br>Vehicle Assembly Fitter | `ASC/Q3605`<br>Electric Vehicle Assembly Technician | 4.0 | NCO semantic proxy; ASDC standard Level 4.0 |
| `OCC_LOG_001` | Warehouse Inventory Coordinator | Logistics | Warehousing | *None* (Unmapped) | `LSC/Q2108`<br>Inventory Clerk | 3.0 | Broad Family 4321 only; specific leaf unmapped |
| `OCC_LOG_002` | Cold Chain Logistics Supervisor | Logistics | Cold Chain | *None* (Unmapped) | `LSC/Q8703`<br>Refrigerated Storage Unit Supervisor | 5.0 | Broad Family 1324 only; specific leaf unmapped |
| `OCC_LOG_003` | Fleet Dispatcher | Logistics | Fleet Management | *None* (Unmapped) | `LSC/Q1118`<br>Transport Coordinator | 4.0 | Broad Family 4323 only; specific leaf unmapped |

*Data Governance Principle:* Where official gazetted leaf codes or active qualification approvals do not exist, fields are left `null` rather than fabricating certainty.

---

## 4. Key Methodology Talking Points for Judges

### Q1: "How is the Relative Mismatch Score calculated?"
> *"The Relative Mismatch Score is defined as the difference between localized Demand and Supply percentile ranks:  
> $$\text{Mismatch} = \text{Demand Index} - \text{Supply Output Index} \in [-100, +100]$$  
> A score of $+50$ indicates that employer demand is in the 75th percentile while training output is in the 25th percentile. We deliberately present relative percentiles rather than absolute headcount counts to avoid misleading planners with unobserved informal sector hiring."*

### Q2: "Why do you use time-series models instead of complex neural networks (e.g. LSTM)?"
> *"District-level administrative skill pipelines have short history (24 monthly observations per series). Complex neural nets severely overfit short series and cannot provide interpretable error bands. We evaluate transparent baseline models—**Naive**, **3-Month Moving Average (MA3)**, and **Linear Trend**—using deterministic rolling-origin backtesting with explicit 80% prediction intervals, enabling planners to audit exactly why a model was selected."*

### Q3: "How does the Seat Allocation Simulator model policy interventions?"
> *"The simulator recalculates projected supply output using a proportional yield formulation:  
> $$\text{Scenario Throughput} = \text{Baseline Throughput} + (\Delta \text{Seats} \times k \times \alpha)$$  
> where $k$ represents the posting-to-opening realization multiplier and $\alpha$ represents the local candidate availability factor. It evaluates policy elasticity without claiming to replace statutory administrative processes."*

### Q4: "Is this real or synthetic data?"
> *"All observations in this pilot are synthetic demonstration data. They are not official statistics or real vacancies. This is labelled in the interface and in every CSV export."*

---

## 5. Troubleshooting & Contingency Fallback Guide

### Scenario A: Port Conflict or Service Crash
- **Backend Recovery (Port 8000):**
  ```powershell
  # Check if port 8000 is occupied
  netstat -ano | findstr :8000
  # Start backend
  cd C:\SIH26246\SkillPulse\backend
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  ```
- **Frontend Recovery (Port 3000):**
  ```powershell
  cd C:\SIH26246\SkillPulse\frontend
  npm run dev
  ```

### Scenario B: API Disconnection in Frontend
- **Symptom:** UI displays red banner *"API Offline / Connecting..."*.
- **Fix:** Verify backend terminal is active and check `http://127.0.0.1:8000/health`. Vite proxy forwards `/api` requests to `http://127.0.0.1:8000`.

### Scenario C: Simulation Endpoint Boundary Rules
- **Rule:** Proposed seats must be an integer between `1` and `5000`.
- **Valid Districts:** `KA_BLR_U`, `KA_DHA`, `MH_PUN`, `MH_MUM`, `TS_HYD`, `TS_MED`.
- **Valid Occupations:** `OCC_IT_001` through `OCC_LOG_003` (must match master occupation codes, NOT combined composite strings).

---

## 6. Pre-Demo Final Verification Stamp

- **Operating System:** Windows 11
- **Backend Framework:** FastAPI 0.115.0 + Python 3.14 (Virtual Environment active)
- **Frontend Framework:** React 19 + Vite 8.3
- **Pytest Suite:** 111 Passed (0 failed)
- **Lint / Build:** 0 oxlint warnings / Vite build 100% clean
- **Sample Data Integrity:** 6,495 rows validated / 0 discrepancies
- **CSV Security:** Formula injection safe / UTF-8 BOM present / 100% rectangular
- **Localization:** 100% bilingual parity (English / हिन्दी)
- **Final Verdict:** **READY FOR NATIONAL GRAND FINALE DEMONSTRATION**
