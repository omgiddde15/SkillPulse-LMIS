# SkillPulse LMIS — Data Dictionary & Specification

**Smart India Hackathon 2026 — Problem Statement SIH26246**  
**AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**  
**Version:** 0.2.0 (Refined Pilot Benchmark)

---

## 1. Overview & Data Architecture

This document specifies the schemas, semantic definitions, permitted values, units, integrity constraints, and temporal parameters for all data models used within **SkillPulse LMIS**.

### 1.1. Core Conceptual Distinctions in Labour Market Intelligence

A common failure mode in labour market systems is conflating distinct economic measurements. SkillPulse LMIS maintains strict semantic boundaries between four separate concepts:

| Dimension | Nature | Economic Concept | Primary Indicator in LMIS | Example Source / Analogy |
| :--- | :--- | :--- | :--- | :--- |
| **Job-Demand Signal** | *Flow (Dynamic)* | Incremental employer hiring intent over a specific time window. | Online job postings count, active recruitment index, vacancy announcements. | Job boards, public hiring registries, employer quarterly surveys. |
| **Worker Population** | *Stock (Static)* | Aggregate pool of employed and unemployed individuals present in the regional economy. | Labour force participation, sector employment totals, Census/PLFS demographics. | Periodic Labour Force Survey (PLFS), Census of India. |
| **Training Output** | *Flow (Pipeline)* | Newly qualified individuals graduating and certified by educational institutions. | Enrolments, course completions, and formal certifications. | ITIs, Polytechnics, PMKVY centres, NSDC portals. |
| **Actual Job Placements** | *Flow (Transition)* | Subset of certified candidates who successfully transition into verified formal employment. | Reported placements, verified social security registrations. | Institutional placement registries, apprenticeship portals. |

> **Crucial Rule on Placements vs. Supply:**  
> Training output measures potential supply entering the market. Placements measure absorbed supply. Forecasting engines must never equate total trained candidates with placed candidates, nor equate job postings with total economy-wide employment.

---

### 1.2. Training-Supply Semantics: Cohort Throughput vs. Snapshot

To avoid miscounting training capacity, SkillPulse LMIS explicitly defines training-supply records:

- **Chosen Model: Concluding Training Cohort Throughput Model**
- **Row Semantic:** Each row in `training_supply.csv` represents the pipeline throughput of **distinct training cohort(s) / batches that completed their curriculum and assessment in that specific monthly reporting period (`period`)**.
- **Preventing Double-Counting:** In a facility capacity snapshot model, recording annual sanctioned seats in each month causes annual capacity to be multiplied 12-fold upon aggregation. Under our **cohort throughput model**, `sanctioned_seats` represents the approved batch intake capacity allocated specifically to the concluding cohort batch(es) (typically 30–120 seats per batch).
- **Aggregation Safety:** Summing `sanctioned_seats`, `enrolments`, `completions`, and `certifications` across monthly periods reflects total cohort admissions and trainee throughput across the period without inflating fixed institutional capacity.

---

## 2. Disclaimer on Synthetic Data

> [!IMPORTANT]
> All records contained in the pilot datasets (`data/sample/*.csv`) are **explicitly synthetic benchmark data** generated via a deterministic pseudo-random process for architectural verification and software testing.  
> They **must not** be interpreted, cited, or published as actual government statistics, empirical labour market measurements, or verified macroeconomic forecasts. Trend patterns in synthetic data are mathematical test artifacts and must not be described as real-world labour market findings.

---

## 3. Entity Data Dictionaries

### 3.1. Entity: `Occupation` (`occupations.csv`)

Defines occupational entities normalized into standardized industrial and vocational taxonomies.

| Field Name | Type | Nullable | Units / Format | Permitted Values / Pattern | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `occupation_id` | String | No | Alphanumeric ID | `^OCC_[A-Z0-9_]+$` (e.g., `OCC_IT_001`) | **Primary Key**. Unique internal identifier for the occupation. |
| `occupation_title` | String | No | Text | 2 to 128 characters | Canonical, industry-standard title of the occupation. |
| `sector` | String | No | Text | `IT/ITeS`, `Manufacturing`, `Logistics`, etc. | Broad economic sector classification. |
| `trade` | String | No | Text | 2 to 64 characters | Sub-specialization, trade cluster, or skill family. |
| `nco_code` | String | **Yes** | 4- or 8-digit NCO | Regex `^\d{4}(\.?\d{2,4})?$` (e.g., `2513.0101`, `7223.5001`) | **Verified NCO Code**. Directorate General of Employment (DGE) National Classification of Occupations 2015 code. Null if unverified or broad-family only. |
| `nco_title` | String | **Yes** | Text | 2 to 128 characters | Official occupation title as gazetted under the corresponding NCO-2015 code. |
| `qp_code` | String | **Yes** | Alphanumeric Code | Official QP code (e.g., `SSC/Q8304`, `CSC/Q0115`) | Official Qualification Pack / National Occupational Standard identifier approved by NCVET / Sector Skill Councils. |
| `qp_title` | String | **Yes** | Text | 2 to 128 characters | Official Qualification Pack title in the National Qualifications Register (NQR). |
| `nsqf_level` | Float | **Yes** | Numeric Level | $1.0 \le \text{level} \le 10.0$ (e.g., `3.0`, `4.0`, `5.0`, `6.0`) | National Skills Qualifications Framework competency level formally notified in qualification specifications. Null if unverified. |

---

### 3.2. Entity: `Geography` (`geographies.csv`)

Defines regional administrative boundaries used for spatial disaggregation.

| Field Name | Type | Nullable | Units / Format | Permitted Values / Pattern | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `district_id` | String | No | Alphanumeric Code | `^[A-Z]{2}_[A-Z0-9_]+$` (e.g., `MH_PUN`) | **Primary Key**. Standard district identifier combining state code and district code. |
| `district_name` | String | No | Text | 2 to 64 characters | Canonical administrative name of the district. |
| `state_code` | String | No | 2-character code | Standard Indian state abbreviations (`MH`, `KA`, `TS`) | Two-letter state code. |
| `state_name` | String | No | Text | `Maharashtra`, `Karnataka`, `Telangana`, etc. | Official full name of the state. |

---

### 3.3. Entity: `DemandObservation` (`demand_observations.csv`)

Captures localized employer demand signals for a given occupation, district, and time period over **24 consecutive monthly periods** (`2024-10` to `2026-09`).

| Field Name | Type | Nullable | Units / Format | Permitted Values / Pattern | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `period` | String | No | YYYY-MM | Regex `^\d{4}-(0[1-9]\|1[0-2])$` (`2024-10` to `2026-09`) | **Composite Key Component 1**. Monthly observation window. |
| `district_id` | String | No | Alphanumeric | References `Geography.district_id` | **Composite Key Component 2**. District where demand is observed. |
| `occupation_id` | String | No | Alphanumeric | References `Occupation.occupation_id` | **Composite Key Component 3**. Occupation being demanded. |
| `source` | String | No | Text | Identifier of feed / portal / benchmark | **Composite Key Component 4**. Data source reporting the observation. |
| `signal_type` | String | No | Categorical Text | `online_job_postings`, `vacancy_persistence_score`, `active_employer_count`, `wage_attractiveness_index` | **Composite Key Component 5**. Category of demand signal. |
| `signal_value` | Numeric | No | Numeric $\ge 0.0$ | Integer count for `online_job_postings` and `active_employer_count`; continuous float for `vacancy_persistence_score` and `wage_attractiveness_index` | Magnitude of the observed signal. Fractional posting counts are strictly rejected by schema and validation checks. |
| `unit` | String | No | Text | `postings_count`, `score_points`, `employer_count`, `index_points` | **Composite Key Component 6**. Unit of the `signal_value`. |
| `data_provenance` | String | No | Text | Minimum 5 characters | Traceability notes and methodology explanation. |
| `is_synthetic` | Boolean | No | `True` / `False` | Must be `True` for pilot sample datasets | Explicit synthetic indicator flag. |

*Composite Unique Key:* `(period, district_id, occupation_id, source, signal_type, unit)`  
*Multi-Source Architecture:* Supports concurrent observations from distinct sources and signal types for the same occupation, district, and month while strictly rejecting genuine duplicates.

#### The Four Core Demand Signal Feeds:
1. **`online_job_postings`** (`postings_count`): Non-negative integer volume count of distinct online recruitment advertisements. Fractional counts are strictly rejected.
2. **`vacancy_persistence_score`** (`score_points`, 0–100): Continuous synthetic duration/difficulty metric measuring how persistently vacancies remain unfilled.
3. **`active_employer_count`** (`employer_count`): Non-negative integer count of unique hiring establishments recruiting for the occupation.
4. **`wage_attractiveness_index`** (`index_points`): Continuous synthetic relative compensation benchmark index (synthetic index points, **NOT actual reported currency wages**).

> **Note on Demand Growth Semantics:**  
> Demand growth is **not** an independently injected raw signal. It is derived dynamically inside the Demand Index Engine by comparing the trailing 3-month average of integer `online_job_postings` with the preceding 3-month average:
> $$\text{growth\_rate} = \frac{\bar{y}_{\text{recent}} - \bar{y}_{\text{prior}}}{\bar{y}_{\text{prior}}} = \frac{\bar{y}_{\text{recent}}}{\bar{y}_{\text{prior}}} - 1$$
> The output is explicitly named and reported with unit `fractional_growth_rate`. A value of `0.0752` represents $+7.52\%$ growth (and **cannot** be confused with an uncentered ratio of $1.0752$). Safeguards safely return `null` if trailing history is $<6$ periods or if the prior denominator $\le 0$.

---

### 3.4. Entity: `TrainingSupplyObservation` (`training_supply.csv`)

Captures the institutional training pipeline throughput for concluding cohorts over **24 consecutive monthly periods** (`2024-10` to `2026-09`).

| Field Name | Type | Nullable | Units / Format | Permitted Values / Pattern | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `period` | String | No | YYYY-MM | Regex `^\d{4}-(0[1-9]\|1[0-2])$` (`2024-10` to `2026-09`) | **Composite Key Component 1**. Cohort completion month. |
| `district_id` | String | No | Alphanumeric | References `Geography.district_id` | **Composite Key Component 2**. District of training. |
| `occupation_id` | String | No | Alphanumeric | References `Occupation.occupation_id` | **Composite Key Component 3**. Target occupation of training. |
| `sanctioned_seats` | Integer | No | Count $\ge 0$ | Non-negative integer | Approved intake batch capacity for the cohort concluding in this period. |
| `enrolments` | Integer | No | Count $\ge 0$ | $0 \le \text{enrolments} \le \text{sanctioned\_seats}$ | Candidates enrolled in the concluding cohort. |
| `completions` | Integer | No | Count $\ge 0$ | $0 \le \text{completions} \le \text{enrolments}$ | Candidates completing instructional training. |
| `certifications` | Integer | No | Count $\ge 0$ | $0 \le \text{certifications} \le \text{completions}$ | Candidates passing formal certification assessment. |
| `placements` | Integer | **Yes** | Count $\ge 0$ | $0 \le \text{placements} \le \text{certifications}$ (when matured) | Certified candidates placed in employment. **Must be null (`""`) when `placement_status` is `pending`**. |
| `placement_status` | String | No | Categorical Text | `complete`, `pending` | Follow-up window maturity: `complete` if $\ge 90$ days have elapsed since cohort month end as of reference date `2026-10-09`; `pending` if immature ($< 90$ days). |
| `is_synthetic` | Boolean | No | `True` / `False` | Must be `True` for pilot sample datasets | Explicit synthetic indicator flag. |

*Composite Unique Key:* `(period, district_id, occupation_id)`

#### Training Funnel Mathematical Invariant & Follow-Up Maturity Rules:
$$\text{Placements} \le \text{Certifications} \le \text{Completions} \le \text{Enrolments} \le \text{Sanctioned Seats}$$
- **Cohort Unity:** All pipeline counts within a row track the **identical cohort batch** across its lifecycle.
- **Maturity Determination:** Evaluated against prototype reference date **`2026-10-09`** based on days elapsed since the cohort reporting month's end date:
  - For cohorts ending $\ge 90$ days prior (`2024-10` through `2026-06`): `placement_status = "complete"` with verified integer placement count.
  - For cohorts ending $< 90$ days prior (`2026-07`, `2026-08`, `2026-09`): `placement_status = "pending"` with `placements = null`.
- **Zero vs. Null Distinction:** Immature cohorts record placements as **null** (`""`), never `0`. Recording `0` would falsely indicate a measured absence of employment, corrupting analytics.
- **Forecasting Safety:** Downstream placement forecasting and machine-learning models can cleanly filter on `placement_status == "complete"` (or `placements is not None`) to train strictly on fully matured cohorts.
- **Capacity Semantics:** `sanctioned_seats` is a batch-level intake quota, not repeated measurements of fixed annual institutional physical capacity.

---

### 3.5. Entity: `DatasetMetadata`

Administrative metadata schema for dataset ingestion manifests.

| Field Name | Type | Nullable | Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `dataset_name` | String | No | Text | Descriptive name of the dataset. |
| `period_start` | String | No | YYYY-MM | Earliest observation period included (`2024-10`). |
| `period_end` | String | No | YYYY-MM | Latest observation period included (`2026-09`). |
| `geographic_coverage` | List[String] | No | Array of strings | States or administrative zones covered (`MH`, `KA`, `TS`). |
| `source` | String | No | Text | Publisher or ingestion pipeline origin. |
| `retrieval_date` | String | No | YYYY-MM-DD | Date of compilation or ingestion. |
| `is_synthetic` | Boolean | No | `True` / `False` | Indicates whether data is synthetic pilot data. |
| `status` | String | No | Text | Curation status (`synthetic_pilot`, `verified_benchmark`). |

---

## 4. Referential Integrity & Quality Validation Rules

The automated validation script enforces:
1. **Header Completeness:** All mandatory CSV columns are present and correctly spelled.
2. **Type Coercion & Bounds:** Numeric values parse correctly and satisfy non-negativity constraints.
3. **Primary & Composite Keys:**
   - `occupations.csv`: `occupation_id` is unique.
   - `geographies.csv`: `district_id` is unique.
   - `demand_observations.csv`: `(period, district_id, occupation_id)` is unique.
   - `training_supply.csv`: `(period, district_id, occupation_id)` is unique.
4. **Time Horizon:** Exactly 24 continuous monthly periods from `2024-04` through `2026-03`.
5. **Referential Integrity:**
   - Every `district_id` in demand and supply observations exists in `geographies.csv`.
   - Every `occupation_id` in demand and supply observations exists in `occupations.csv`.
6. **Cohort Funnel Monotonicity:** In `training_supply.csv`, `placements <= certifications <= completions <= enrolments <= sanctioned_seats`.
7. **Synthetic Transparency:** `is_synthetic` must be explicitly set to `True` across all observation rows.
8. **Terminology Precision:** Clearly distinguishes Master/Reference Entity rows (15 total) from Dynamic Observations (6,480 total) and Total CSV Data Rows (6,495 total).

---

## 5. Relative Demand-Supply Gap Analysis & Supply Estimation Methodology

### 5.1. Training-Supply Estimation Metrics
Implemented in `SupplyEstimationService`:
- **3-Month Certification Throughput:** Sum of certifications across cohorts concluding in the trailing 3 months ($T, T-1, T-2$).
- **6-Month Certification Throughput:** Sum of certifications across cohorts concluding in trailing 6 months ($T$ down to $T-5$), or `null` if history is $<6$ months.
- **Seat Utilisation Rate:** $\frac{\sum \text{enrolments}}{\sum \text{sanctioned\_seats}}$. Denominator: Total sanctioned batch capacity for cohorts in window.
- **Completion Rate:** $\frac{\sum \text{completions}}{\sum \text{enrolments}}$. Denominator: Total enrolled candidates in window.
- **Certification Rate:** $\frac{\sum \text{certifications}}{\sum \text{completions}}$. Denominator: Total completed candidates in window.
- **Placement Rate:** $\frac{\sum_{\text{matured}} \text{placements}}{\sum_{\text{matured}} \text{certifications}}$. Denominator: Total certified candidates from cohorts with completed 90-day follow-up. Immature cohorts are strictly excluded and remain `null`.

### 5.2. Relative Mismatch Engine
Implemented in `GapAnalysisService`:
- **Supply-Output Index (0–100):** Cross-sectional percentile rank of recent 3-month certification throughput across all evaluated district-occupation pairs in the selected month.
- **Relative Mismatch Score (-100 to +100):**
  $$\text{relative\_mismatch\_score} = \text{demand\_index\_score} - \text{supply\_output\_index}$$
  Where $\text{demand\_index\_score}$ is the weighted multi-signal demand index synthesizing posting volume (30%), demand growth (25%), vacancy persistence (15%), employer diversity (15%), and wage attractiveness (15%).
  - $\ge +15.0$: **Demand Pressure** (Employer demand intensity substantially exceeds training throughput).
  - $\le -15.0$: **Supply Pressure** (Training certification throughput substantially exceeds employer recruitment demand).
  - Between $-15.0$ and $+15.0$: **Balanced / Monitor** (Demand and supply are broadly aligned in relative rank).
- **Semantic Guardrails:** Mismatch score is a relative screening index, NOT a headcount shortfall of workers or proof of an absolute shortage. The $\pm 15.0$ thresholds are configurable prototype design assumptions.

### 5.3. Projected Relative Mismatch in Forecasting & Seat Simulator
Implemented in `ForecastingService` and `SeatSimulatorService`:
- **Forecast Demand Postings Rank (0–100):** Cross-sectional percentile rank of point forecast monthly online job postings at horizon $h$ across all evaluated regional series.
- **Forecast Supply Throughput Rank (0–100):** Cross-sectional percentile rank of point forecast (or simulated) certified candidate throughput at horizon $h$ across all evaluated regional series.
- **Projected Mismatch Score (-100 to +100):**
  $$\text{projected\_mismatch\_score} = \text{forecast\_demand\_rank} - \text{forecast\_supply\_rank}$$
  - $\ge +15.0$: **Demand Pressure** (Projected recruitment demand rank substantially exceeds projected graduate throughput rank).
  - $\le -15.0$: **Supply Pressure** (Projected certification throughput rank substantially exceeds projected hiring demand rank).
  - Between $-15.0$ and $+15.0$: **Balanced / Monitor** (Projected demand and supply ranks are broadly aligned).
- **Percentile-Rank Saturation in Seat Simulation:** Supply rank is capped at the 100th percentile relative to the comparison population for the selected horizon. When a proposed capacity adjustment yields throughput exceeding all other series in the regional cross-section, the supply rank saturates at 100.0, and the projected mismatch score reaches a lower bound of $\text{Demand Rank} - 100.0$. Further seat expansions continue to scale physical candidate throughput linearly under the constant-yield assumption, but may not change the rank-based mismatch score.

### 5.4. Metric Distinction & Incomparability Guardrail
- **Current-Period Gap Analysis** uses a hybrid formula combining a weighted multi-signal demand index (30% postings, 25% growth, 15% persistence, 15% employer diversity, 15% wages) with trailing 3-month certification throughput rank:
  $$\text{Current Mismatch} = \text{Demand Composite Score} - \text{Supply Output Percentile Rank}$$
- **Forecast & Simulator Projections** evaluate future time horizons using a symmetric rank-rank difference between single-quantity forecast series (online job postings count vs. certified candidate throughput):
  $$\text{Projected Mismatch} = \text{Forecast Postings Rank} - \text{Forecast Throughput Rank}$$
- **Incomparability Rule:** Because these two indicators use different mathematical formulations and underlying statistical distributions, planners must not directly compare or subtract a current-period gap analysis score from a forecasted mismatch score as if they were identical continuous variables.
- **Threshold Disclosures:** The $\pm 15.0$ score thresholds are prototype heuristics for decision support, not empirical or legally binding mandates. They do not establish equivalent real-world severity across current-period and forecasted metrics.

### 5.5. Supply Coverage Metrics & Scenarios
Implemented in `ForecastingService` and `SeatSimulatorService`:
- **Training-to-Posting Benchmark Ratio (Descriptive Benchmark in Forecasts):**
  $$\text{benchmark\_ratio} = \frac{\text{forecast\_supply\_throughput}}{\text{forecast\_demand\_postings}} \times 100$$
  Expressed as certified candidates per 100 online postings (e.g., 50.5 candidates per 100 postings for 79.3 certs vs 157 postings). Defined explicitly as an administrative descriptive benchmark, NOT a vacancy-coverage rate, market clearance metric, or proof of a skill shortage.
- **Assumption-Adjusted Pipeline Scenario (Seat Simulator):**
  Exploratory policy sensitivity simulator testing pipeline coverage under user-adjustable scenario multipliers:
  - $k$ (`posting_to_opening_multiplier`): Assumed posting-to-opening realization multiplier ($k \in [0.5, 1.5]$, default $1.0$). Accounts for multi-portal posting duplication or informal hiring.
  - $\alpha$ (`local_availability_factor`): Assumed local candidate availability share ($\alpha \in [0.4, 1.0]$, default $1.0$). Accounts for inter-district migration, higher study, or non-participation.
  - Formulas:
    $$\text{estimated\_openings} = \text{forecast\_demand\_postings} \times k$$
    $$\text{effective\_local\_output} = \text{supply\_throughput} \times \alpha$$
    $$\text{scenario\_coverage\_pct} = \frac{\text{effective\_local\_output}}{\text{estimated\_openings}} \times 100$$
  - Guardrail: Starting values ($k=1.0, \alpha=1.0$) are neutral illustrative scenario assumptions, NOT observed empirical parameters. The resulting scenario coverage percentage must NOT be described as actual vacancy fulfillment, an empirical worker shortage headcount, or guaranteed employment. Online job postings may be duplicated, renewed, or omit off-platform hiring, and certified candidates may enter jobs with lead times or seek work outside the local district.


