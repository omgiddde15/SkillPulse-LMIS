# SkillPulse LMIS — Official Geography Taxonomy & PLFS 2023–24 Concordance

**Smart India Hackathon 2026 — Problem Statement SIH26246**
**AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**
**Document Version:** 1.0.0 (Audited & Approved PLFS 2023–24 Concordance)
**Verification Date:** 17 October 2026

---

## 1. Executive Summary & Purpose

This document defines the official concordance between the internal geographic identifiers in SkillPulse LMIS and the external district coding standard established by the **Ministry of Statistics and Programme Implementation (MoSPI)** for the **Periodic Labour Force Survey (PLFS), July 2023–June 2024**.

### 1.1. Internal Architecture vs. External Standards
- **Internal Identifiers (`district_id`)**: SkillPulse uses stable, human-readable composite alphanumeric primary keys (e.g., `MH_PUN`, `KA_BLR_U`, `TS_HYD`) across its relational databases, Pydantic schemas, analytics services, API routes, and user interface components. These keys remain strictly invariant.
- **External Standard Codes (`plfs_state_code`, `plfs_district_code`)**: These numeric strings align SkillPulse pilot districts directly with official MoSPI microdata files (`HHV1.txt`, `PERV1.txt`) to enable future empirical econometric calibration, sample stratification, and benchmark weight alignment without disrupting internal application references.

---

## 2. Official Primary Sources

The geographic concordance was audited and verified directly against primary technical publications from MoSPI’s **National Data Archive (NADA)**:

- **NADA Catalog Study**: [Periodic Labour Force Survey (PLFS), July 2023–June 2024 (DDI-IND-CSO-PLFS-2023-24)](https://microdata.gov.in/NADA/index.php/catalog/213/related-materials)
- **Primary District Reference Document**:
  - **Title**: `District_codes_PLFS_Panel_4_202324_2024`
  - **File**: `District_codes_PLFS_Panel_4_202324_2024.xlsx` (Resource ID: 2668)
  - **URL**: `https://microdata.gov.in/NADA/index.php/catalog/213/download/2668`
  - **Worksheet**: `2021-22-23`
  - **Fields**: `State Code`, `State Name `, `DISTRICT CODE`, `DISTRICT NAME`
  - **Coverage**: 694 administrative districts across India for Panel 4 (2023–24 up to December 2024).
- **Primary Data Layout Reference**:
  - **Title**: `Data_LayoutPLFS_2023-24.xlsx` (Resource ID: 2463)
  - **URL**: `https://microdata.gov.in/NADA/index.php/catalog/213/download/2463`
  - **Layout Specification**:
    - `State/Ut Code`: Bytes 13–14 (Field length: 2)
    - `District Code`: Bytes 15–16 (Field length: 2, zero-padded string)

---

## 3. Master Concordance Table (6 Pilot Districts)

| Internal `district_id` | SkillPulse `district_name` | State Code | State Name | PLFS State Code | PLFS District Code | Combined Code (`SSDD`) | Official PLFS District Name | Match Confidence | Official Source Citation |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| **`MH_PUN`** | Pune | `MH` | Maharashtra | `27` | `25` | `2725` | Pune | **Exact** | MoSPI Panel 4 Reference, Row: State `27`, District `25` |
| **`MH_MUM`** | Mumbai Suburban | `MH` | Maharashtra | `27` | `22` | `2722` | Mumbai Suburban | **Exact** | MoSPI Panel 4 Reference, Row: State `27`, District `22` |
| **`KA_BLR_U`** | Bengaluru Urban | `KA` | Karnataka | `29` | `18` | `2918` | Bangalore | **Closest Match** (Documented Naming) | MoSPI Panel 4 Reference, Row: State `29`, District `18` |
| **`KA_DHA`** | Dharwad | `KA` | Karnataka | `29` | `08` | `2908` | Dharwad | **Exact** | MoSPI Panel 4 Reference, Row: State `29`, District `08` |
| **`TS_HYD`** | Hyderabad | `TS` | Telangana | `36` | `22` | `3622` | Hyderabad | **Exact** | MoSPI Panel 4 Reference, Row: State `36`, District `22` |
| **`TS_MED`** | Medchal-Malkajgiri | `TS` | Telangana | `36` | `21` | `3621` | Medchal-Malkajgiri | **Exact** | MoSPI Panel 4 Reference, Row: State `36`, District `21` |

---

## 4. Forensic District Analysis & Nomenclature Details

### 4.1. Pune (`MH_PUN`)
- **State**: Maharashtra (`MH` / `27`)
- **PLFS District Code**: `25`
- **Audit Findings**: Verbatim match in MoSPI Panel 4 listing. Pune is the primary manufacturing, automotive, and precision engineering pilot cluster in SkillPulse.

### 4.2. Mumbai Suburban (`MH_MUM`)
- **State**: Maharashtra (`MH` / `27`)
- **PLFS District Code**: `22`
- **Audit Findings**: Verbatim match in MoSPI Panel 4 listing. In Maharashtra, Code `22` specifically designates **Mumbai Suburban** (distinct from the island city of Mumbai). Represents the port logistics, supply chain, and ITeS pilot cluster.

### 4.3. Bengaluru Urban (`KA_BLR_U`) — Bangalore / Bengaluru Naming Concordance
- **State**: Karnataka (`KA` / `29`)
- **PLFS District Code**: `18`
- **Official PLFS Title**: `Bangalore`
- **Nomenclature Concordance**:
  - In MoSPI technical document `District_codes_PLFS_Panel_4_202324_2024.xlsx`, District Code `18` is designated as **`Bangalore`**, while Code `29` is designated as **`Bangalore Rural`**.
  - Following the official Karnataka state government gazette notification of 2014, SkillPulse canonical data uses **`Bengaluru Urban`**.
  - SkillPulse **preserves its canonical name (`Bengaluru Urban`)** and maps it to PLFS District Code `18`. SkillPulse does not silently rename its internal district title, ensuring complete transparency between state gazette nomenclature and central statistical coding.

### 4.4. Dharwad (`KA_DHA`) — Leading Zero Representation
- **State**: Karnataka (`KA` / `29`)
- **PLFS District Code**: `08`
- **Audit Findings**: Verbatim match in MoSPI Panel 4 listing. In MoSPI microdata byte positions 15–16, the code is formatted as a two-character numeric string with a leading zero (`08`). SkillPulse strictly treats both `plfs_state_code` and `plfs_district_code` as text strings to prevent truncation to `8`.

### 4.5. Hyderabad (`TS_HYD`)
- **State**: Telangana (`TS` / `36`)
- **PLFS District Code**: `22`
- **Audit Findings**: Verbatim match under State Code `36` (Telangana). Historical Census 2011 code (535 under undivided Andhra Pradesh State 28) has been superseded by post-bifurcation state code `36`.

### 4.6. Medchal-Malkajgiri (`TS_MED`) — Reorganization Concordance
- **State**: Telangana (`TS` / `36`)
- **PLFS District Code**: `21`
- **Audit Findings**: Verbatim match under State Code `36` (Telangana). Medchal-Malkajgiri was formed in October 2016 by bifurcating Ranga Reddy district. It did not exist in the 2011 Census frame. MoSPI's Panel 4 reference reflects the reorganized 33-district administrative frame of Telangana, uniquely assigning Code `21` to Medchal-Malkajgiri and Code `23` to Rangareddy.

---

## 5. Critical Warning: Survey Round & Code Invariance

> [!WARNING]
> **Do not substitute codes from older survey rounds or Census 2011 without verification.**
> - **Telangana State Bifurcation & District Reorganization**: Districts in Telangana underwent complete administrative reorganization in October 2016 (expanding from 10 to 31, and later 33 districts). Surveys conducted prior to 2019 used the Census 2011 frame under State Code `28` (Andhra Pradesh), where `TS_MED` (Medchal-Malkajgiri) did not exist.
> - **Panel Coding Changes**: MoSPI periodically updates sample frames across survey panels. District codes are panel- and round-specific. Code `21` in Telangana represents Medchal-Malkajgiri in PLFS 2023–24 Panel 4, but may denote an entirely different entity in earlier NSS rounds.
> - Any future calibration with external NSS/PLFS datasets must verify concordance against the specific survey round's technical document.

---

## 6. Synthetic Data Transparency & Governance Statement

> [!IMPORTANT]
> **Synthetic Demonstration Dataset Notice:**
> Appending verified official PLFS 2023–24 geographic crosswalk codes (`plfs_state_code`, `plfs_district_code`) to `geographies.csv` provides structural metadata concordance only.
>
> **It does NOT convert synthetic demand signals (`demand_observations.csv`) or synthetic TVET training throughput data (`training_supply.csv`) into verified empirical statistics.**
>
> All observation counts, job postings, candidate enrollments, certifications, and placement figures in SkillPulse pilot sample files remain synthetic demo data generated for Smart India Hackathon 2026 (Problem Statement SIH26246). Indicator scores are relative workforce indices, not verified headcount shortages.
