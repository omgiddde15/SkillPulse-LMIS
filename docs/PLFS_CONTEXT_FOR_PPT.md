# Slide-Ready Official Labour-Market Context Panel (SIH26246)

**SkillPulse LMIS — Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**
**Presentation Context Reference:** Smart India Hackathon 2026 (Problem Statement SIH26246)
**Document File:** `docs/PLFS_CONTEXT_FOR_PPT.md`

---

## 1. Official Labour-Market Benchmark (Slide Panel)

The following macroeconomic context establishes the broad employment environment for the three SkillPulse pilot states relative to the national average.

### Table: Worker Population Ratio (WPR) — 2025

| State / Administrative Entity | Worker Population Ratio (WPR) | Difference vs. National Baseline | Contextual Labour Market Role |
| :--- | :---: | :---: | :--- |
| **Karnataka** | **58.0%** | $+0.6\text{ percentage points}$ | Pilot State (Bengaluru Urban & Dharwad) |
| **Maharashtra** | **58.0%** | $+0.6\text{ percentage points}$ | Pilot State (Pune & Mumbai Suburban) |
| **Telangana** | **58.3%** | $+0.9\text{ percentage points}$ | Pilot State (Hyderabad & Medchal-Malkajgiri) |
| **All-India (National Baseline)** | **57.4%** | Benchmark ($0.0\text{ pp}$) | National Macro Benchmark |

> **Official Metric Definition:**
> **Worker Population Ratio (WPR)** according to **usual status (principal + subsidiary)**, for persons **aged 15 years and above**, calendar year **2025**.
> WPR is defined by MoSPI as the percentage of employed persons in the population aged 15 years and above.

---

## 2. Visual Representation (Slide-Ready Bar Chart)

### Horizontal Bar Comparison: WPR (Persons Aged 15+, Usual Status, 2025)

```text
Karnataka   [58.0%] |=====================================================  (58.0%)
Maharashtra [58.0%] |=====================================================  (58.0%)
Telangana   [58.3%] |====================================================== (58.3%)
All-India   [57.4%] |====================================================   (57.4%)
                    +---------+---------+---------+---------+---------+---------+
                    0%       10%       20%       30%       40%       50%       60%
```

### Key Observation for Presentation
- All three pilot states record Worker Population Ratios among persons aged 15 years and above that exceed the national baseline of 57.4%: Telangana at 58.3% (+0.9 pp), and Karnataka and Maharashtra both at 58.0% (+0.6 pp).
- These robust state-level employment ratios provide macroeconomic grounding for SkillPulse's localized skill demand-supply matching engine.

---

## 3. Official Source Provenance

| Citation Attribute | Official Detail |
| :--- | :--- |
| **Publishing Authority** | Ministry of Statistics and Programme Implementation (MoSPI), Government of India |
| **Official Report Title** | *Annual Report, Periodic Labour Force Survey (PLFS), 2025* |
| **Report Table Reference**| **Table 17.0** |
| **Reference Period** | **January – December 2025** |
| **Official Source URL** | [https://mospi.gov.in/.../PLFS_2025_F_REV_29052026.pdf](https://mospi.gov.in/uploads/publications_reports/publications_reports1780040415321_0624fb13-fb47-40bc-b470-7c7e9635c3ef_PLFS_2025_F_REV_29052026.pdf) |

---

## 4. Essential Presentation Caveats & Guardrails

> [!CAUTION]
> ### Strict Presentation Guardrails
> 1. **Macroeconomic Employment Stock Only:** These figures represent broad, state-wide proportions of employed residents across all industries and occupations. They are **not** measures of open job vacancies, employer recruitment volume, or hiring demand.
> 2. **No Occupation-Specific Shortages:** WPR reflects general employment status across all economic activities; it does **not** estimate shortages or headcounts for specific trades (e.g., Cloud Computing, EV Assembly, Mechatronics).
> 3. **Not District-Level Estimates:** These are state-level aggregates and do **not** represent localized metrics for SkillPulse's six pilot districts (Pune, Mumbai Suburban, Bengaluru Urban, Dharwad, Hyderabad, Medchal-Malkajgiri).
> 4. **No Vacancy Trend Inference:** WPR figures must **not** be used to assert growing or shrinking job vacancies. High WPR indicates high employed stock, not high active recruitment flow.
> 5. **Synthetic Pilot Integrity:** SkillPulse’s localized monthly demand observations (`demand_observations.csv`) and training-supply records (`training_supply.csv`) remain synthetic demonstration data (`is_synthetic = True`).

---

## 5. Methodological Transition Note (January 2025 Onwards)

> [!NOTE]
> **Survey Design & Sampling Transition Notice:**
> The National Sample Survey Office (NSSO / MoSPI) transitioned the PLFS survey cycle and sampling design starting from **January 2025** (moving to a calendar-year reporting cycle, January–December 2025).
> Consequently, direct numerical comparisons between the 2025 report and earlier survey rounds (which followed agricultural-year cycles from July to June, such as PLFS 2023–24) require methodological care and should not be presented as an uninterrupted continuous time series without noting the sampling frame adjustments.

---

## 6. Recommended Slide & Speaker Script

### Slide Bullet / Callout Box
> **Official Labour-Market Context (MoSPI PLFS 2025, Table 17.0):**
> State Worker Population Ratios (Ages 15+, Usual Status): **Telangana 58.3%**, **Karnataka 58.0%**, **Maharashtra 58.0%** vs. **All-India 57.4%**.
> *Note: Broad state-level employment indicator statistics; not vacancy counts, occupation-specific shortages or district headcounts.*

### Speaker Note
> *“To anchor our system in national statistical standards, we reference official MoSPI PLFS 2025 benchmarks (Table 17.0). All three pilot states record Worker Population Ratios for persons aged 15 and above exceeding the national 57.4% baseline—Telangana at 58.3%, with Karnataka and Maharashtra both at 58.0%. We emphasize that these official figures provide macro state-level employment indicators only; SkillPulse’s localized monthly hiring and training observations remain synthetic pilot demonstration models.”*
