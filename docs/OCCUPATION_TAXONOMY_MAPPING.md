# SkillPulse LMIS — Official Occupation Taxonomy Mapping Documentation

**Smart India Hackathon 2026 — Problem Statement SIH26246**  
**AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**  
**Document Version:** 2.0.0 (Audited & Verified Taxonomy Concordance)  
**Audit Date:** 11 October 2026  

---

## 1. Executive Summary & Audit Methodology

Following an in-depth cross-check against official Government of India publications, this document provides an audited, evidence-backed occupation taxonomy concordance for the nine demo benchmark occupations in SkillPulse LMIS.

### 1.1. Audit Discrepancies Uncovered & Resolved:
1. **`2522.0100` Discrepancy**: In NCO-2015, code `2522.0100` is officially and verbatim titled **`Database Administrator`**, NOT "Systems Administrators". "Systems Administrators" is the 4-digit Unit/Family title (`2522`), which contains only two leaf codes: `2522.0100` (*Database Administrator*) and `2522.0201` (*Security Analyst*). There is no specific 8-digit leaf code for Cloud Infrastructure or general Systems Administrator in NCO-2015.
   - *Resolution*: Specific NCO code and title for `OCC_IT_001` are left **`null`** (unmapped specific leaf code). Broad Family 2522 is documented in notes.
2. **`2521.0200` Discrepancy**: Code `2521.0200` **does not exist** in NCO-2015. Family 2521 (*Database Designers and Administrators*) contains only `2521.0100` (*Database Design Analyst*) and `2521.0202` (*Junior Data Associate*). No leaf code exists for Data Quality Analyst.
   - *Resolution*: Specific NCO code and title for `OCC_IT_002` are left **`null`** (unmapped specific leaf code). Broad Family 2521 is documented in notes.
3. **`1324.0101` Discrepancy**: In NCO-2015, code `1324.0101` is officially titled **`Manager, Supplier Quality`**, NOT "Supply and Distribution Managers" (which is the broad 4-digit Family 1324 title). NCO-2015 has no leaf code for Cold Chain or Refrigerated Storage.
   - *Resolution*: Specific NCO code and title for `OCC_LOG_002` are left **`null`** (unmapped specific leaf code). Broad Family 1324 is documented in notes.
4. **`IAS/Q8004` Erroneous QP Code**: The previously reported QP code `IAS/Q8004` is non-existent/unsubstantiated. The official Qualification Pack on the National Qualifications Register (NQR) under the Instrumentation Automation Surveillance & Communication (IASC) Sector Skill Council is **`IAS/Q5601`** (*Industrial Automation Technician*, NSQF Level 4).
   - *Resolution*: Corrected to `IAS/Q5601`.
5. **`SSC/Q8101` Qualification Version & Deactivation Conflict**:
   - NQR active registration `QG-05-IT-01524-2023-V1.1-NASSCOM` specifies **NSQF Level 5.0** (with model curriculum validity through 22 September 2025).
   - Version 4.0 of the QP specified **NSQF Level 6.0** with a formal deactivation date of 14 April 2025.
   - *Resolution*: Documented NSQF Level 5.0 based on NQR `QG-05-` registration, with transparent disclosures regarding the Version 4.0 Level 6.0 deactivation date (14-Apr-2025) falling within our time horizon.
6. **`CSC/Q0115` Qualification Ownership, Version & Level Resolution**:
   - **Belonging Confirmed**: NQR registration `2022/CCM/CGSC/05592` directly belongs to `CSC/Q0115` (*CNC Operator Turning*, Capital Goods Skill Council) as Version 2.0, rather than to a different qualification.
   - **NCO vs. QP Distinction**: NCO-2015 code `7223.5001` (*Machining Technician / CNC Operator*) is an economy-wide occupational classification that verbatim matches the role and remains valid independently of QP accreditation status.
   - **Validity & Status as of 11 October 2026**: While Version 1.0 (2015, standard NSDC repository listing) was registered at **NSQF Level 3.0**, reviewed Version 2.0 was approved at **NSQF Level 4.0** with validity expiring on **31 March 2025**. Because the formal NQR validity expired on 31 March 2025 without a newly gazetted unexpired renewal record published on NQR, neither Level 4.0 (expired) nor Level 3.0 (superseded legacy listing) can be claimed with gazetted certainty.
   - *Resolution*: In accordance with the governance rule (*"If the current approved qualification/version cannot be established, mark its status or level unresolved rather than inventing certainty"*), `nsqf_level` is set to **`null`** (unresolved / in transition) in data files, while retaining the exact NCO match `7223.5001` and QP code `CSC/Q0115`.
7. **`ASC/Q3605` Level Discrepancy**:
   - Early legislative and draft references listed Level 4.0.
   - Official NCVET approved file on NQR (`QG-3.5-AU-00537-2023-V1.1-ASDC`) formally classifies the role at **NSQF Level 3.5**.
   - *Resolution*: Adopted Level 3.5 based on official NQR file, noting historical Level 4.0 drafts.
8. **`4321.0102` Alignment for Inventory Clerk**:
   - In NCO-2015 Family 4321, code `4321.0102` is officially titled **`Inventory Clerk`**, matching QP `LSC/Q2108` (*Inventory Clerk*). Replaced the previously assigned `4321.0301` (*Stock Verifier*).

### 1.2. Core Governance Principles:
- **No Fabricated Completeness**: Accurate partial mapping is strictly preferred over fabricated completeness. Where no official specific 8-digit leaf code exists, fields remain `null`.
- **Classification vs. Qualification**: NCO job family classification is strictly separated from QP/NOS vocational qualifications and NSQF competency levels.
- **Application Key Invariance**: Internal keys (`OCC_IT_001` – `OCC_LOG_003`) remain invariant database IDs.

---

## 2. Audited Master Concordance Table (9 Demo Occupations)

| Occupation ID | Demo Occupation Title | Sector | Vocational Trade | Verified NCO-2015 Code | Official NCO-2015 Title | NCO Match Status | Relevant QP/NOS Code | Official QP Title | Verified NSQF Level | Qualification Version / Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- | :---: | :--- |
| **`OCC_IT_001`** | Cloud Infrastructure Associate | IT/ITeS | Cloud Computing | *None* | *None* | **Unmapped** (Broad Family 2522 only) | `SSC/Q8304` | Cloud Infrastructure Analyst | **5.0** | NQR `QG-05-IT-00505-2023-V1.1-NASSCOM` |
| **`OCC_IT_002`** | Data Quality Analyst | IT/ITeS | Data & Analytics | *None* | *None* | **Unmapped** (Broad Family 2521 only) | `SSC/Q8101` | AI – Data Quality Analyst | **5.0** | NQR `QG-05-IT-01524-2023-V1.1-NASSCOM`; v4.0 Level 6 deactivated 14-Apr-2025 |
| **`OCC_IT_003`** | Full-Stack Web Developer | IT/ITeS | Software Engineering | `2513.0101` | Web Developer | **Strong semantic match** | `SSC/Q0503` | Web Developer | **4.0** | Active NASSCOM QP; MSME `QG-4.5-IT-02395-2024-V1-MSME` (Level 4.5) |
| **`OCC_MFG_001`** | CNC Machine Operator | Manufacturing | Precision Machining | `7223.5001` | Machining Technician / CNC Operator | **Exact match** | `CSC/Q0115` | CNC Operator Turning | *Unresolved* (`null`) | NQR `2022/CCM/CGSC/05592` (v2.0, Level 4.0, validity expired 31-Mar-2025; v1.0 Level 3.0). Unresolved pending gazetted re-validation as of 11-Oct-2026 |
| **`OCC_MFG_002`** | Industrial Automation Technician | Manufacturing | Mechatronics | `7412.0101` | Automation Specialist | **Strong semantic match** | `IAS/Q5601` | Industrial Automation Technician | **4.0** | NQR registered IASC QP (corrected from invalid Q8004) |
| **`OCC_MFG_003`** | Electric Vehicle Assembly Technician | Manufacturing | Automotive | `8211.1201` | Vehicle Assembly Fitter | **Semantic proxy** (No EV leaf in NCO-2015) | `ASC/Q3605` | Electric Vehicle Assembly Technician | **3.5** | NQR `QG-3.5-AU-00537-2023-V1.1-ASDC` (Level 3.5; early drafts Level 4) |
| **`OCC_LOG_001`** | Warehouse Inventory Coordinator | Logistics | Warehousing | `4321.0102` | Inventory Clerk | **Strong semantic match** | `LSC/Q2108` | Inventory Clerk | **3.0** | NQR registered LSC QP; mapped to NCO 4321.0102 Inventory Clerk |
| **`OCC_LOG_002`** | Cold Chain Logistics Supervisor | Logistics | Cold Chain | *None* | *None* | **Unmapped** (Broad Family 1324 only) | `LSC/Q8703` | Refrigerated Storage Unit Supervisor | **5.0** | NQR registered LSC QP; NCO 1324.0101 is Supplier Quality Manager |
| **`OCC_LOG_003`** | Fleet Dispatcher | Logistics | Fleet Management | `4323.9900` | Transport Clerks, Other | **Residual category match** | `LSC/Q1118` | Transport Coordinator | **4.0** | NQR registered LSC QP; NCO 4323 has no road dispatcher leaf code |

---

## 3. Detailed Forensic Audit per Occupation

### 3.1. `OCC_IT_001` — Cloud Infrastructure Associate
- **Sector / Trade**: IT/ITeS / Cloud Computing
- **NCO-2015 Code**: **`None`** (Unmapped)
- **Official NCO Title**: **`None`**
- **Audit Findings**:
  - Code `2522.0100` in NCO-2015 is officially **`Database Administrator`**.
  - Unit/Family `2522` is titled *Systems Administrators*, but contains only two leaf codes: `2522.0100` (*Database Administrator*) and `2522.0201` (*Security Analyst*).
  - NCO-2015 contains no specific 8-digit leaf code for Cloud Infrastructure or general Systems Administrator.
  - Per conservative principles, broad family codes are not assigned as specific occupation codes. Code is left null.
- **QP/NOS Alignment**: `SSC/Q8304` — *Cloud Infrastructure Analyst* (NASSCOM).
- **NSQF Level**: **5.0** (NQR File Code: `QG-05-IT-00505-2023-V1.1-NASSCOM`).

---

### 3.2. `OCC_IT_002` — Data Quality Analyst
- **Sector / Trade**: IT/ITeS / Data & Analytics
- **NCO-2015 Code**: **`None`** (Unmapped)
- **Official NCO Title**: **`None`**
- **Audit Findings**:
  - Code `2521.0200` **does not exist** in NCO-2015.
  - Unit/Family `2521` is titled *Database Designers and Administrators*, containing `2521.0100` (*Database Design Analyst*) and `2521.0202` (*Junior Data Associate*).
  - NCO-2015 contains no specific leaf code for Data Quality Analyst. Code is left null.
- **QP/NOS Alignment**: `SSC/Q8101` — *AI – Data Quality Analyst* (NASSCOM).
- **NSQF Level & Version Analysis**:
  - Active NQR Registration: `QG-05-IT-01524-2023-V1.1-NASSCOM` specifies **Level 5.0** (model curriculum valid through 22 September 2025).
  - Version 4.0 QP listing specified **Level 6.0** with formal deactivation date of 14 April 2025.
  - Baseline records reflect Level 5.0 under the active NQR v1.1 registration, with documentation of the v4.0 retirement.

---

### 3.3. `OCC_IT_003` — Full-Stack Web Developer
- **Sector / Trade**: IT/ITeS / Software Engineering
- **NCO-2015 Code**: `2513.0101`
- **Official NCO Title**: Web Developer
- **Match Status**: **Strong semantic match**
- **Audit Findings**:
  - NCO-2015 code `2513.0101` verbatim title is *Web Developer* (Family 2513: *Web and Multimedia Developers*). NCO-2015 does not contain a separate "Full-Stack" leaf title.
- **QP/NOS Alignment**:
  - `SSC/Q0503` — *Web Developer* (NSQF Level 4.0, NASSCOM).
  - `QG-4.5-IT-02395-2024-V1-MSME` — *Full-Stack Developer* (NSQF Level 4.5, MSME Technology Centre, approved 30-Apr-2024, valid to 30-Apr-2027).

---

### 3.4. `OCC_MFG_001` — CNC Machine Operator
- **Sector / Trade**: Manufacturing / Precision Machining
- **NCO-2015 Code**: `7223.5001`
- **Official NCO Title**: Machining Technician / CNC Operator
- **Match Status**: **Exact match**
- **Occupational vs. Qualification Distinction**:
  - NCO-2015 Code `7223.5001` is an occupational classification under Family 7223 (*Machine Tool Setter-Operators*), published by the Ministry of Labour & Employment (MoLE/DGE). It classifies the occupational job role across the national economy and is strictly decoupled from vocational qualification files.
  - QP/NOS Code `CSC/Q0115` is a vocational qualification standard developed by Capital Goods Skill Council (CGSC) under NCVET/MSDE, certifying competency through accredited training curricula.
  - The exact match of NCO `7223.5001` is independent of the qualification lifecycle or validity status of `CSC/Q0115`.
- **QP/NOS Alignment & Ownership**:
  - `CSC/Q0115` — *CNC Operator Turning* (Capital Goods Skill Council).
  - NQR Record `2022/CCM/CGSC/05592` belongs directly to `CSC/Q0115` (Version 2.0), confirming it is the same qualification rather than a separate role.
- **NSQF Level Forensic Analysis & 11 October 2026 Status**:
  - **Version 1.0 (2015 NSDC Listing)**: Originally approved at **NSQF Level 3.0**.
  - **Version 2.0 (NQR Code `2022/CCM/CGSC/05592`)**: Approved at **NSQF Level 4.0** on 31 March 2022, with formal validity ending on **31 March 2025**.
  - **Status as of 11 October 2026**: The 3-year NQR accreditation validity expired on 31 March 2025. As of October 2026, no subsequent re-accreditation file (e.g. v3.0 / v4.0) has been gazetted on the public NQR with an active post-March 2025 validity date. Reporting Level 4.0 as currently active is factually indefensible due to the expired validity, while reporting Level 3.0 ignores the 2022 review.
  - **Resolution**: To prevent fabricated certainty, the NSQF level is marked **`null`** (Unresolved / In Transition) in benchmark datasets, with full audit trail documentation.

---

### 3.5. `OCC_MFG_002` — Industrial Automation Technician
- **Sector / Trade**: Manufacturing / Mechatronics
- **NCO-2015 Code**: `7412.0101`
- **Official NCO Title**: Automation Specialist
- **Match Status**: **Strong semantic match**
- **Audit Findings**:
  - NCO-2015 code `7412.0101` is *Automation Specialist* (Family 7412: *Electrical Mechanics and Fitters*).
  - Previous QP `IAS/Q8004` was unsubstantiated. The official IASC QP registered on NQR is **`IAS/Q5601`** (*Industrial Automation Technician*).
- **QP/NOS Alignment**: `IAS/Q5601` — *Industrial Automation Technician* (IASC).
- **NSQF Level**: **4.0** (NQR registered).

---

### 3.6. `OCC_MFG_003` — Electric Vehicle Assembly Technician
- **Sector / Trade**: Manufacturing / Automotive
- **NCO-2015 Code**: `8211.1201`
- **Official NCO Title**: Vehicle Assembly Fitter
- **Match Status**: **Semantic proxy** (No EV leaf in NCO-2015)
- **Audit Findings**:
  - NCO-2015 was published prior to commercial EV manufacturing; it contains no EV-specific code. ASDC Qualification File explicitly aligns EV assembly to `8211.1201` (*Vehicle Assembly Fitter*).
- **QP/NOS Alignment**: `ASC/Q3605` — *Electric Vehicle Assembly Technician* (ASDC).
- **NSQF Level Analysis**:
  - Official NQR Code: `QG-3.5-AU-00537-2023-V1.1-ASDC` formally registers at **Level 3.5**.
  - Early parliamentary and draft references listed Level 4.0.

---

### 3.7. `OCC_LOG_001` — Warehouse Inventory Coordinator
- **Sector / Trade**: Logistics / Warehousing
- **NCO-2015 Code**: `4321.0102`
- **Official NCO Title**: Inventory Clerk
- **Match Status**: **Strong semantic match**
- **Audit Findings**:
  - Under Family 4321 (*Stock Clerks*), NCO-2015 code `4321.0102` is verbatim titled **`Inventory Clerk`**.
  - Replaces earlier proxy `4321.0301` (*Stock Verifier*), establishing direct alignment with QP `LSC/Q2108` (*Inventory Clerk*).
- **QP/NOS Alignment**: `LSC/Q2108` — *Inventory Clerk* (LSC).
- **NSQF Level**: **3.0** (NQR registered).

---

### 3.8. `OCC_LOG_002` — Cold Chain Logistics Supervisor
- **Sector / Trade**: Logistics / Cold Chain
- **NCO-2015 Code**: **`None`** (Unmapped)
- **Official NCO Title**: **`None`**
- **Audit Findings**:
  - In NCO-2015, code `1324.0101` is officially **`Manager, Supplier Quality`**.
  - "Supply and Distribution Managers" is the 4-digit Family title (`1324`), not an 8-digit leaf title.
  - NCO-2015 contains no leaf code for Cold Chain or Refrigerated Storage. Code is left null.
- **QP/NOS Alignment**: `LSC/Q8703` — *Refrigerated Storage Unit Supervisor* (LSC).
- **NSQF Level**: **5.0** (NQR registered).

---

### 3.9. `OCC_LOG_003` — Fleet Dispatcher
- **Sector / Trade**: Logistics / Fleet Management
- **NCO-2015 Code**: `4323.9900`
- **Official NCO Title**: Transport Clerks, Other
- **Match Status**: **Residual category match**
- **Audit Findings**:
  - In Family 4323 (*Transport Clerks*), all specific leaf codes (`4323.0100` – `4323.0500`) are designated for railway/tram operations.
  - General transport/fleet coordinators fall into the residual category `4323.9900` (*Transport Clerks, Other*).
- **QP/NOS Alignment**: `LSC/Q1118` — *Transport Coordinator* (LSC).
- **NSQF Level**: **4.0** (NQR registered).

---

## 4. Summary Coverage Statistics

- **Total Tracked Demo Occupations:** 9
- **Exact NCO Matches:** 1 (`OCC_MFG_001` — `7223.5001`)
- **Strong Semantic / Proxy Matches:** 4 (`OCC_IT_003`, `OCC_MFG_002`, `OCC_MFG_003`, `OCC_LOG_001`)
- **Residual Category Matches:** 1 (`OCC_LOG_003` — `4323.9900`)
- **Unmapped NCO Codes (Broad Family Only, Left Null):** 3 (`OCC_IT_001`, `OCC_IT_002`, `OCC_LOG_002`)
- **Fabricated / Unsubstantiated Codes:** 0 (strictly eliminated)
