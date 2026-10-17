# SkillPulse LMIS — Official PLFS 2023–24 Methodology & Calibration Governance

**Smart India Hackathon 2026 — Problem Statement SIH26246**
**AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**
**Document Version:** 1.0.0
**Verification Date:** 17 October 2026

---

## 1. Purpose and Scope

This document establishes the official methodological and governance framework for referencing the **Periodic Labour Force Survey (PLFS), July 2023–June 2024** within the SkillPulse Labour Market Information System (LMIS).

The primary objective of incorporating PLFS 2023–24 is to ground SkillPulse’s synthetic pilot architecture in official Government of India macroeconomic standards. PLFS provides an authoritative, benchmarked labour-market context regarding broad sectoral employment patterns, labor force participation, and workforce demographics across India and the three pilot states (Maharashtra, Karnataka, and Telangana).

This document defines the boundary between official household survey statistics and high-frequency employer hiring signals, ensuring that external survey data is utilized responsibly without mischaracterizing synthetic demonstration data.

---

## 2. What the SkillPulse Dataset Represents

The SkillPulse demonstration dataset is designed as an end-to-end prototype for AI-enabled workforce intelligence, predictive gap modeling, and vocational training seat allocation.

### 2.1. Measurement Concepts
All observation records in the SkillPulse pilot sample datasets are **synthetic proxies**:
- **`data/sample/demand_observations.csv` (5,184 records)** captures four distinct dimensions of localized employer recruitment demand across **24 consecutive monthly periods (`2024-10` to `2026-09`)**:
  1. `online_job_postings` (`postings_count`): Non-negative integer volume simulating web-scraped job advertisements.
  2. `vacancy_persistence_score` (`score_points`, 0–100): Continuous synthetic friction metric measuring how persistently vacancies remain unfilled.
  3. `active_employer_count` (`employer_count`): Non-negative integer simulating unique hiring establishments actively recruiting.
  4. `wage_attractiveness_index` (`index_points`): Continuous relative compensation benchmark index (synthetic index points, **not actual currency wages**).
- **`data/sample/training_supply.csv` (1,296 records)** captures the institutional training throughput pipeline across the same **24 consecutive monthly periods (`2024-10` to `2026-09`)**, tracking concluding cohort batches from `sanctioned_seats` through `enrolments`, `completions`, `certifications`, and `placements` (with a strict 90-day follow-up maturity requirement).

### 2.2. Explicit Synthetic Designation
Every demand observation and training-supply observation record is explicitly and permanently tagged:
$$\text{is\_synthetic} = \text{True}$$
These records simulate localized labor market signals for algorithm testing, system integration, and policy dashboard demonstrations; they do not represent surveyed headcount employment or verified historical employer statistics.

---

## 3. What PLFS Measures: Stock vs. Flow Economics

A critical conceptual distinction separates the measurements provided by PLFS from the demand signals modeled by SkillPulse:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ECONOMIC MEASUREMENT GAP                        │
├───────────────────────────────────┬────────────────────────────────────┤
│         PLFS 2023–24              │        SkillPulse LMIS             │
│    (Household Sample Survey)      │     (Employer Demand Signals)      │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Labour Supply / Worker Stock    │ • Labour Demand / Vacancy Flow     │
│ • Where workers reside            │ • Where employers recruit          │
│ • Retrospective (365 days / 7 days│ • Monthly prospective hiring       │
│ • Household worker interviews     │ • Enterprise job postings & counts │
│ • Broad 3-digit occupational stock│ • Granular 8-digit skill clusters  │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Employment Stock (PLFS)**:
   - PLFS is a nationwide household survey administered by the National Sample Survey Office (NSSO).
   - It interviews resident individuals at their households to assess their Usual Principal Status (UPS, 365-day recall), Usual Subsidiary Status (UPSS), or Current Weekly Status (CWS, 7-day recall).
   - It records what surveyed people are *currently doing* (employed, unemployed, or out of the labour force).
   - A worker classified in an occupation represents existing occupied employment (**economic stock**).
2. **Recruitment Flow (SkillPulse)**:
   - SkillPulse demand signals simulate market hiring activity (**economic flow**) originating from employers—active online postings, vacancy durations, enterprise hiring counts, and recruitment friction.
   - An occupation with a large existing employment stock (e.g., conventional textile or mechanical assemblers) may exhibit very low new hiring demand or even net workforce contraction.
   - Conversely, a specialized emerging discipline (e.g., Cloud Infrastructure) may have a modest existing headcount stock but an intense flow of new vacancies.
3. **Non-Equivalence**:
   - Household survey employment shares **must never be equated with or converted into job vacancy counts**, employer hiring appetite, or unfilled job demand.

---

## 4. Classification Compatibility and Granularity Limits

An audit of the official PLFS 2023–24 person-level data layout (`Data_LayoutPLFS_2023-24.xlsx`, Sheet: `perv1`) demonstrates that PLFS occupational coding cannot isolate the nine granular SkillPulse benchmark occupations.

### 4.1. Three-Character Field Width Limit
In the person-level PLFS microdata records (`PERV1.txt`, Block 5.1/5.2/6), the occupation variable is recorded strictly at the **3-digit Minor Group level** of the National Classification of Occupations (NCO-2015):
- Field `ocu_pas` (Principal Activity Status): **Field Length = 3**
- Field `ocu_sas` (Subsidiary Activity Status): **Field Length = 3**
- Field `ocu_cws` (Current Weekly Status): **Field Length = 3**

PLFS does **not** record the 4-digit Unit Group or the 8-digit detailed leaf code.

### 4.2. Aggregation Examples and Ecological Fallacy Risks
Equating a 3-digit PLFS Minor Group with a specific SkillPulse occupation creates significant classification distortions:
- **`OCC_IT_003` (Full-Stack Web Developer)**: Concordant with NCO leaf `2513.0101` (*Web Developer*). In PLFS, this falls into Minor Group **`251`** (*Software and Applications Developers and Analysts*), which aggregates systems analysts (`2511`), general software developers (`2512`), applications programmers (`2514`), and web developers (`2513`).
- **`OCC_MFG_001` (CNC Machine Operator)**: Concordant with NCO leaf `7223.5001`. In PLFS, it falls into Minor Group **`722`** (*Blacksmiths, toolmakers and related trades workers*), aggregating conventional blacksmiths (`7221`), manual toolmakers (`7222`), lathe/milling operators (`7223`), and tool polishers (`7224`).
- **`OCC_MFG_002` (Industrial Automation Technician)**: Concordant with NCO leaf `7412.0101`. In PLFS, it falls into Minor Group **`741`** (*Electrical equipment installers and repairers*), where the vast majority of workers are residential building electricians (`7411`) and linemen (`7413`), not advanced mechatronics technicians.
- **`OCC_MFG_003` (Electric Vehicle Assembly Technician)**: Concordant with NCO leaf `8211.1201`. In PLFS, it falls into Minor Group **`821`** (*Assemblers*), combining all assembly line workers across all manufacturing sub-sectors with zero distinction for electric powertrain vehicles.
- **`OCC_LOG_001` (Warehouse Inventory Coordinator)**: Concordant with NCO leaf `4321.0102`. In PLFS, it falls into Minor Group **`432`** (*Material-recording and transport clerks*), blending inventory clerks with production and transport clerks across all industries.

### 4.3. Preservation of Unresolved NCO Classifications
As verified in the official SkillPulse Occupation Taxonomy Audit, four occupations lack a specific 8-digit leaf code in NCO-2015 and remain intentionally **`unresolved`**:
- `OCC_IT_001` (Cloud Infrastructure Associate)
- `OCC_IT_002` (Data Quality Analyst)
- `OCC_LOG_002` (Cold Chain Logistics Supervisor)
- `OCC_LOG_003` (Fleet Dispatcher)

In adherence to taxonomy integrity, these occupations are **not forced into arbitrary 3-digit PLFS categories**. They remain `null` in canonical taxonomy fields to prevent fabricated completeness.

---

## 5. Survey Weights, Estimation Procedures, and Statistical Limitations

### 5.1. Estimation Procedures and Multipliers
PLFS employs a multi-stage stratified sampling design. Users of unit-level microdata must apply survey expansion multipliers (`mult`), sub-sample FSU counts (`nss`, `nsc`), and quarter occurrence factors (`no_qtr`) to compute unbiased population estimates:
- Survey weights vary substantially across rural/urban sectors, sampling strata, and second-stage household strata.
- Because estimation formulas depend on sub-sample combinations and specific aggregation rules, researchers must follow the exact procedures set out in the official MoSPI documentation:
  - Technical Guide: `1_README.docx`
  - Estimation Procedure Manual: `Instruction_manual_PLFS_Vol_I.pdf` (Block 1 & Block 2 guidelines)

### 5.2. Small-Cell and District-Level Reliability Limitations
PLFS was designed and powered to deliver statistically sound estimates at the **National level (quarterly/annual)** and **State level (annual)**. It was **not designed to evaluate niche occupational counts at the district level**:
- In any single district, the number of surveyed First Stage Units (FSUs) is small.
- For specialized vocational trades (e.g., Mechatronics, Cold Chain, or Cloud Computing), the sample count in a single district will often be zero or restricted to a tiny handful of individuals.
- Small cell counts result in severe sampling volatility and very high standard errors. A zero count in a district sample does not imply the occupation is absent from the district; rather, it reflects small-sample cluster dispersion.
- Consequently, district-by-occupation microdata tabulations from PLFS cannot be treated as statistically reliable measures of local specialized headcounts.

---

## 6. Approved Approach for SkillPulse LMIS

Based on the forensic audit of data structures, taxonomy granularity, and sampling theory, the **approved calibration governance approach** is defined as follows:

1. **No Numerical Overwriting of Observation Datasets**:
   - `data/sample/demand_observations.csv` and `data/sample/training_supply.csv` **shall not be modified, overwritten, or scaled** using PLFS survey counts.
   - All 5,184 demand rows and 1,296 supply rows remain intact with `is_synthetic = True`.
2. **PLFS as Separately Labelled Macro Context**:
   - Official published PLFS 2023–24 state-level and national statistics (e.g., broad sector shares, labour force participation rates, general unemployment benchmarks) may be cited in documentation, policy briefs, and platform guide notes strictly as **macroeconomic background context**.
   - Macro indicators must always be presented with clear source attribution and kept distinct from the synthetic vacancy flow signals.
3. **Strict Separation of Data Layers**:
   - SkillPulse maintains a clean boundary between:
     - **Layer 1: Master Taxonomy & Geography Metadata** (Verified official standards: NCO-2015, QP/NOS, PLFS district crosswalks).
     - **Layer 2: Demonstration Observation Signals** (Synthetic monthly vacancy and training throughput feeds).
     - **Layer 3: Macroeconomic Benchmark Context** (Published national and state-level survey statistics).

---

## 7. Official Source Provenance

All findings and classifications in this document are derived from official Government of India publications:

| Source Name | Publishing Authority | Official URL / Citation |
| :--- | :--- | :--- |
| **PLFS 2023–24 Study Catalog & Technical Downloads** | MoSPI / NSSO, Data Processing Division | [Catalog 213 (Related Materials)](https://microdata.gov.in/NADA/index.php/catalog/213/related-materials) |
| **Person-Level Data Dictionary (perv1 / F4)** | MoSPI / NSSO | [Catalog 213 Data Dictionary (F4)](https://microdata.gov.in/NADA/index.php/catalog/213/data-dictionary/F4) |
| **MoSPI Annual Report: PLFS 2023–24** | National Sample Survey Office, MoSPI | [Annual Report PLFS 2023–24](https://www.mospi.gov.in/sites/default/files/publication_reports/AnnualReport_PLFS2023-24L2.pdf) |
| **District Codes Reference (Panel 4)** | MoSPI / NSSO | `District_codes_PLFS_Panel_4_202324_2024.xlsx` (Resource ID: 2668) |
| **Data Layout Specification (Schedule 10.4)** | MoSPI / NSSO | `Data_LayoutPLFS_2023-24.xlsx` (Resource ID: 2463) |
| **Unit-Level Data User Instructions** | MoSPI / NSSO | `1_README.docx` (Resource ID: 5154) |

### Key Documented Field Identifiers (from official layout):
- **Occupation Codes**: `ocu_pas` (`b5pt1q6_perv1`), `ocu_sas` (`b5pt2q6_perv1`), `ocu_cws` (3-digit Minor Group)
- **Industry Codes**: `ind_pas` (`b5pt1q5_perv1`, 5-digit), `ind_sas` (`b5pt2q5_perv1`, 5-digit), `aind_cws` (2-digit)
- **Geography Hierarchy**: `st` (`state_perv1`), `dc` (`distcode_perv1`)
- **Activity Status**: `pas` (`b5pt1q3_perv1`), `sas` (`b5pt2q3_perv1`), `acws`
- **Survey Multipliers**: `mult`, `nss`, `nsc`, `no_qtr`
- **Survey Period & Sub-samples**: `qtr` (`qtr_perv1`), `visit` (`visit_perv1`), `Month`

### Data Access Limitation Note
While all technical documentation, codebooks, district references, and survey questionnaires are freely accessible on the public NADA portal, raw unit-level microdata files (`PERV1.txt`, `HHV1.txt`) require a registered MoSPI NADA user account (`/auth/login`). No unauthorized data scraping or simulated raw record generation was conducted.

---

## 8. Responsible Presentation & Safe Disclaimers

To maintain academic and professional integrity during evaluations and demonstrations, presentation materials (including the Smart India Hackathon PPT deck) must include the following explicit statement:

> ### Official Presentation Disclaimer
> **“SkillPulse’s current pilot observations are synthetic. PLFS 2023–24 is used as a documented official labour-market reference, not as a source of actual vacancy counts for this pilot.”**
