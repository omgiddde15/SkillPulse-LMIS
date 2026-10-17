# SkillPulse LMIS — Official Occupation Taxonomy Mapping Documentation

**Smart India Hackathon 2026 — Problem Statement SIH26246**  
**AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine**  
**Document Version:** 2.1.0 (Audited & Verified Taxonomy Concordance — Pathway 1 Applied)
**Audit Date:** 17 October 2026

---

## 1. Executive Summary & Audit Methodology

Following an in-depth cross-check against official Government of India publications, this document provides an audited, evidence-backed occupation taxonomy concordance for the nine demo benchmark occupations in SkillPulse LMIS.

### 1.1. Audit Discrepancies Uncovered & Resolved:
1. **`2522.0100` Discrepancy**: In NCO-2015, code `2522.0100` is officially and verbatim titled **`Database Administrator`**, NOT "Systems Administrators". "Systems Administrators" is the 4-digit Unit/Family title (`2522`), which contains only two leaf codes: `2522.0100` (*Database Administrator*) and `2522.0201` (*Security Analyst*). There is no specific 8-digit leaf code for Cloud Infrastructure or general Systems Administrator in NCO-2015.
   - *Resolution*: Specific NCO code and title for `OCC_IT_001` are left **`null`** (`unresolved`). Closest leaf candidate `3513.0301` (*Infrastructure Engineer*) and Broad Family 2522/3513 are documented.
2. **`2521.0200` Discrepancy**: Code `2521.0200` **does not exist** in NCO-2015. Family 2521 (*Database Designers and Administrators*) contains only `2521.0100` (*Database Design Analyst*) and `2521.0202` (*Junior Data Associate*). No leaf code exists for Data Quality Analyst.
   - *Resolution*: Specific NCO code and title for `OCC_IT_002` are left **`null`** (`unresolved`). Closest leaf candidate `2521.0202` (*Junior Data Associate*, which explicitly mandates data quality procedures) and Broad Family 2521 are documented.
3. **`1324.0101` Discrepancy**: In NCO-2015, code `1324.0101` is officially titled **`Manager, Supplier Quality`**, NOT "Supply and Distribution Managers" (which is the broad 4-digit Family 1324 title). NCO-2015 has no leaf code for Cold Chain or Refrigerated Storage.
   - *Resolution*: Specific NCO code and title for `OCC_LOG_002` are left **`null`** (`unresolved`). Closest supervisory leaf candidate `1324.1201` (*Warehouse Supervisor*) and Broad Family 1324 are documented.
4. **`IAS/Q8004` Erroneous QP Code**: The previously reported QP code `IAS/Q8004` is non-existent/unsubstantiated. The official Qualification Pack on the National Qualifications Register (NQR) under the Instrumentation Automation Surveillance & Communication (IASC) Sector Skill Council is **`IAS/Q5601`** (*Industrial Automation Technician*, NSQF Level 4).
   - *Resolution*: Corrected to `IAS/Q5601`.
5. **IT Roles NSQF Level Alignment (`OCC_IT_001` & `OCC_IT_002`)**:
   - Aligned to **NSQF Level 6.0** reflecting advanced professional skills (Cloud Infrastructure and AI/Data Quality analytics standards).
6. **`CSC/Q0115` Qualification Ownership, Version & Level Resolution**:
   - **Belonging Confirmed**: NQR registration `2022/CCM/CGSC/05592` directly belongs to `CSC/Q0115` (*CNC Operator Turning*, Capital Goods Skill Council) as Version 2.0.
   - **NCO vs. QP Distinction**: NCO-2015 code `7223.5001` (*Machining Technician / CNC Operator*) is an economy-wide occupational classification that verbatim matches the role and remains valid independently of QP accreditation status.
   - **NSQF Level**: Aligned to **NSQF Level 4.0** under Version 2.0.
7. **`ASC/Q3605` Level Alignment**:
   - Aligned to **NSQF Level 4.0** under automotive qualification standards.
8. **Logistics Occupations Resolution (`OCC_LOG_001` vs. `OCC_LOG_003`)**:
   - For `OCC_LOG_001` (Warehouse Inventory Coordinator), official DGE NCO-2015 Volume II-A (p. 518) explicitly cross-references Qualification Pack `LSC/Q2108` (*Inventory Clerk*, Level 3) directly to NCO code **`4321.0102`** (**`Inventory Clerk`**), noting *"Inventory Clerk in the Logistics industry is also known as Inventory Executive"*. This establishes a verified, government-backed concordance (`closest_match`).
   - For `OCC_LOG_003` (Fleet Dispatcher), specific NCO code remains **`null`** (`unresolved`) because no specific road dispatch leaf exists in Family 4323 (Broad Family 4323 / 1324 noted; candidate leaf `4323.9900` *Transport Clerks, Other*).

### 1.2. Core Governance Principles:
- **No Fabricated Completeness**: Accurate partial mapping is strictly preferred over fabricated completeness. Where no official specific 8-digit leaf code exists, fields remain `null`.
- **Classification vs. Qualification**: NCO job family classification is strictly separated from QP/NOS vocational qualifications and NSQF competency levels.
- **Application Key Invariance**: Internal keys (`OCC_IT_001` – `OCC_LOG_003`) remain invariant database IDs.

---

## 2. Audited Master Concordance Table (9 Demo Occupations)

| Occupation ID | Demo Occupation Title | Sector | Vocational Trade | Verified NCO-2015 Code | Official NCO-2015 Title | Mapping Type | Official NCO-2015 Source & Reference | Relevant QP/NOS Code | Official QP Title | Verified NSQF Level | Qualification Version / Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :--- | :---: | :--- |
| **`OCC_IT_001`** | Cloud Infrastructure Associate | IT/ITeS | Cloud Computing | *None* | *None* | `unresolved` | Vol I p. 126 / Vol II-A p. 482 (Candidate `3513.0301`) | `SSC/Q8304` | Cloud Infrastructure Analyst | **6.0** | NQR `QG-05-IT-00505-2023-V1.1-NASSCOM` |
| **`OCC_IT_002`** | Data Quality Analyst | IT/ITeS | Data & Analytics | *None* | *None* | `unresolved` | Vol I p. 84 / Vol II-A p. 244 (Candidate `2521.0202`) | `SSC/Q8101` | AI – Data Quality Analyst | **6.0** | NQR `QG-05-IT-01524-2023-V1.1-NASSCOM`; v4.0 Level 6 deactivated 14-Apr-2025 |
| **`OCC_IT_003`** | Full-Stack Web Developer | IT/ITeS | Software Engineering | `2513.0101` | Web Developer | `closest_match` | Vol I p. 84, 379 / Vol II-A p. 239; DGE NAT Family 2513 | `SSC/Q0503` | Web Developer | **4.0** | Active NASSCOM QP; MSME `QG-4.5-IT-02395-2024-V1-MSME` (Level 4.5) |
| **`OCC_MFG_001`** | CNC Machine Operator | Manufacturing | Precision Machining | `7223.5001` | Machining Technician / CNC Operator | `exact` | Vol I p. 167, 317 / Vol II-B p. 120; DGE NAT Family 7223 | `CSC/Q0115` | CNC Operator Turning | **4.0** | NQR `2022/CCM/CGSC/05592` (v2.0, Level 4.0) |
| **`OCC_MFG_002`** | Industrial Automation Technician | Manufacturing | Mechatronics | `7412.0101` | Automation Specialist | `closest_match` | Vol I p. 185, 259 / Vol II-B p. 227; DGE NAT Family 7412 | `IAS/Q5601` | Industrial Automation Technician | **4.0** | NQR registered IASC QP (corrected from invalid Q8004) |
| **`OCC_MFG_003`** | Electric Vehicle Assembly Technician | Manufacturing | Automotive | `8211.1201` | Vehicle Assembly Fitter | `closest_match` | Vol I p. 233, 376 / Vol II-B p. 495; DGE NAT Family 8211 | `ASC/Q3605` | Electric Vehicle Assembly Technician | **4.0** | ASDC Automotive standard (Level 4.0) |
| **`OCC_LOG_001`** | Warehouse Inventory Coordinator | Logistics | Warehousing | `4321.0102` | Inventory Clerk | `closest_match` | Vol I p. 134, 310 / Vol II-A p. 518 (Direct QP `LSC/Q2108`) | `LSC/Q2108` | Inventory Clerk | **3.0** | NQR registered LSC QP; NCO-2015 Vol II-A p. 518 |
| **`OCC_LOG_002`** | Cold Chain Logistics Supervisor | Logistics | Cold Chain | *None* | *None* | `unresolved` | Vol I p. 54, 377 / Vol II-A p. 61 (Candidate `1324.1201`) | `LSC/Q8703` | Refrigerated Storage Unit Supervisor | **5.0** | NQR registered LSC QP; NCO 1324.0101 is Supplier Quality Manager |
| **`OCC_LOG_003`** | Fleet Dispatcher | Logistics | Fleet Management | *None* | *None* | `unresolved` | Vol I p. 135, 373 / Vol II-A p. 525 (Candidate `4323.9900`) | `LSC/Q1118` | Transport Coordinator | **4.0** | NQR registered LSC QP |

---

## 3. Detailed Forensic Audit per Occupation

### 3.1. `OCC_IT_001` — Cloud Infrastructure Associate
- **Sector / Trade**: IT/ITeS / Cloud Computing
- **NCO-2015 Code**: **`None`** (Blank / Unmapped)
- **Official NCO Title**: **`None`**
- **Mapping Type**: `unresolved`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 2522 / Family 3513](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 84 (Family 2522), Page 126 (Family 3513)
  - NCO-2015 Volume II-A: Page 244 (Family 2522), Page 482 (Family 3513, Code `3513.0301`)
- **Audit Findings & Rationale**:
  - Code `2522.0100` in NCO-2015 is officially **`Database Administrator`**.
  - Unit/Family `2522` is titled *Systems Administrators*, but contains only two leaf codes: `2522.0100` (*Database Administrator*) and `2522.0201` (*Security Analyst*). There is no general systems administrator or cloud administrator leaf code under 2522.
  - Emerging candidate leaf: `3513.0301 Infrastructure Engineer` (Vol II-A p. 482) covers system/storage administration and cross-functional IT service management, aligning with QP `SSC/Q8304`.
  - Under approved Pathway 1 (conservative hybrid standard), because NCO-2015 lacks a dedicated leaf with cloud virtualization specificity, the code is retained as `null` (`unresolved`).
- **QP/NOS Alignment**: `SSC/Q8304` — *Cloud Infrastructure Analyst* (NASSCOM).
- **NSQF Level**: **6.0**.

---

### 3.2. `OCC_IT_002` — Data Quality Analyst
- **Sector / Trade**: IT/ITeS / Data & Analytics
- **NCO-2015 Code**: **`None`** (Blank / Unmapped)
- **Official NCO Title**: **`None`**
- **Mapping Type**: `unresolved`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 2521](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 84 (Family 2521)
  - NCO-2015 Volume II-A: Page 244 (Code `2521.0202`)
- **Audit Findings & Rationale**:
  - Code `2521.0200` **does not exist** in NCO-2015.
  - Unit/Family `2521` is titled *Database Designers and Administrators*, containing only `2521.0100` (*Database Design Analyst*) and `2521.0202` (*Junior Data Associate*).
  - Vol II-A p. 244 explicitly includes data quality in `2521.0202` duties: *"Responsibilities also include designing and implementing statistical data quality procedures around new data sources."*
  - However, because "Junior Data Associate" denotes an associate entry level rather than a specialized senior analytics role (demo role is NSQF Level 6.0), the field is left `null` (`unresolved`) under conservative Pathway 1 principles.
- **QP/NOS Alignment**: `SSC/Q8101` — *AI – Data Quality Analyst* (NASSCOM).
- **NSQF Level & Version Analysis**:
  - Aligned to **NSQF Level 6.0** for specialized data and AI analytics competency.

---

### 3.3. `OCC_IT_003` — Full-Stack Web Developer
- **Sector / Trade**: IT/ITeS / Software Engineering
- **NCO-2015 Code**: `2513.0101`
- **Official NCO Title**: `Web Developer`
- **Mapping Type**: `closest_match`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 2513 / Code 2513.0101](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 84, Page 379
  - NCO-2015 Volume II-A: Page 239 (printed page 227)
- **Audit Findings & Rationale**:
  - NCO-2015 code `2513.0101` verbatim title is **`Web Developer`** (Family 2513: *Web and Multimedia Developers*).
  - Vol II-A p. 239 defines duties: *"designing and maintaining web-based applications that include static and dynamic content... design, layout and coding of a website"*.
  - NCO-2015 standardizes web development under this base classification; no separate "Full-Stack" leaf title exists.
  - Matches Qualification Pack `SSC/Q0503` (*Web Developer*).
- **QP/NOS Alignment**:
  - `SSC/Q0503` — *Web Developer* (NSQF Level 4.0, NASSCOM).
  - `QG-4.5-IT-02395-2024-V1-MSME` — *Full-Stack Developer* (NSQF Level 4.5, MSME Technology Centre, approved 30-Apr-2024, valid to 30-Apr-2027).

---

### 3.4. `OCC_MFG_001` — CNC Machine Operator
- **Sector / Trade**: Manufacturing / Precision Machining
- **NCO-2015 Code**: `7223.5001`
- **Official NCO Title**: `Machining Technician / CNC Operator` (or `Machining Technician/CNC Operator`)
- **Mapping Type**: `exact`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 7223 / Code 7223.5001](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 167, Page 317
  - NCO-2015 Volume II-B: Page 120 (printed page 108)
- **Audit Findings & Rationale**:
  - Exact verbatim title confirmation in Vol I p. 167.
  - Vol II-B p. 120 explicitly records: *"Machining Technician is also known as Machinist or CNC Machine Operator. The role covers operations of different machine tools performed both manually and through automatic/CNC machines/robots."*
  - This constitutes a 100% exact match between the demo occupation title and official NCO-2015 canonical classification.
- **Occupational vs. Qualification Distinction**:
  - NCO-2015 Code `7223.5001` is an occupational classification under Family 7223 (*Machine Tool Setter-Operators*), published by MoLE/DGE, decoupled from vocational qualification files.
  - QP/NOS Code `CSC/Q0115` is a vocational qualification standard developed by Capital Goods Skill Council (CGSC).
- **QP/NOS Alignment & Ownership**:
  - `CSC/Q0115` — *CNC Operator Turning* (Capital Goods Skill Council).
  - NQR Record `2022/CCM/CGSC/05592` belongs directly to `CSC/Q0115` (Version 2.0).
- **NSQF Level Analysis**:
  - Aligned to **NSQF Level 4.0** under Version 2.0 (`2022/CCM/CGSC/05592`).

---

### 3.5. `OCC_MFG_002` — Industrial Automation Technician
- **Sector / Trade**: Manufacturing / Mechatronics
- **NCO-2015 Code**: `7412.0101`
- **Official NCO Title**: `Automation Specialist`
- **Mapping Type**: `closest_match`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 7412 / Code 7412.0101](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 185, Page 259
  - NCO-2015 Volume II-B: Page 227 (printed page 215)
- **Audit Findings & Rationale**:
  - NCO-2015 code `7412.0101` is officially titled **`Automation Specialist`** (Family 7412: *Electrical Mechanics and Fitters*).
  - Vol II-B p. 227 states: *"Individuals at this job are responsible for providing support to production operations through maintenance of process control systems installed at shop floor for various manufacturing processes."*
  - Strong semantic concordance to industrial automation technician roles.
- **QP/NOS Alignment**: `IAS/Q5601` — *Industrial Automation Technician* (IASC). Corrected from unsubstantiated `IAS/Q8004`.
- **NSQF Level**: **4.0** (NQR registered).

---

### 3.6. `OCC_MFG_003` — Electric Vehicle Assembly Technician
- **Sector / Trade**: Manufacturing / Automotive
- **NCO-2015 Code**: `8211.1201`
- **Official NCO Title**: `Vehicle Assembly Fitter`
- **Mapping Type**: `closest_match`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 8211 / Code 8211.1201](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 233, Page 376
  - NCO-2015 Volume II-B: Page 495 (printed page 483)
- **Audit Findings & Rationale**:
  - Vol II-B p. 495 defines duties: *"operates a variety of machine tools to assemble mechanical and electrical components for two wheelers, four wheelers and large commercial vehicles"*.
  - NCO-2015 predates commercial EV manufacturing; Automotive Skills Development Council (ASDC) standards officially designate `8211.1201` as the legitimate statistical proxy.
- **QP/NOS Alignment**: `ASC/Q3605` — *Electric Vehicle Assembly Technician* (ASDC).
- **NSQF Level Analysis**:
  - Aligned to **NSQF Level 4.0** under ASDC qualification standards.

---

### 3.7. `OCC_LOG_001` — Warehouse Inventory Coordinator
- **Sector / Trade**: Logistics / Warehousing
- **NCO-2015 Code**: `4321.0102`
- **Official NCO Title**: `Inventory Clerk`
- **Mapping Type**: `closest_match` (Direct 1:1 match to Qualification Pack `LSC/Q2108`)
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 4321 / Code 4321.0102](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 134, Page 310
  - NCO-2015 Volume II-A: Page 518 (printed page 506)
- **Audit Findings & Rationale**:
  - In NCO-2015 Volume II-A (p. 518), code `4321.0102` is officially titled **`Inventory Clerk`** (Family 4321: *Stock Clerks*).
  - Official description: *"Inventory Clerk in the Logistics industry is also known as Inventory Executive. Individuals in this role need to collect the stored items list, perform physical counting of goods, cross checking the physical count with the system numbers. Their responsibilities include locating missing items for reconciliation and preparing detailed reports for the management."*
  - Crucially, Page 518 explicitly documents the direct official government alignment: **`Qualification Pack Details: QP NOS Reference LSC/Q2108; QP NOS Name Inventory Clerk; NSQF Level 3`**.
  - This directly corroborates the assignment of `4321.0102` to `OCC_LOG_001`.
- **QP/NOS Alignment**: `LSC/Q2108` — *Inventory Clerk* (LSC).
- **NSQF Level**: **3.0** (NQR registered).

---

### 3.8. `OCC_LOG_002` — Cold Chain Logistics Supervisor
- **Sector / Trade**: Logistics / Cold Chain
- **NCO-2015 Code**: **`None`** (Blank / Unmapped)
- **Official NCO Title**: **`None`**
- **Mapping Type**: `unresolved`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 1324](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 53–54, Page 377
  - NCO-2015 Volume II-A: Page 56 (Code `1324.0101`), Page 61 (Code `1324.1201`)
- **Audit Findings & Rationale**:
  - Code `1324.0101` in NCO-2015 is officially **`Manager, Supplier Quality`** (unrelated).
  - "Supply and Distribution Managers" is the 4-digit Family title (`1324`), not an 8-digit leaf title.
  - Closest candidate leaf is `1324.1201 Warehouse Supervisor` (Vol II-A p. 61), and the official LSC QP file for `LSC/Q8703` aligns at broad Family 1324.
  - Because NCO-2015 contains no leaf code specific to cold chain or refrigerated storage, the code is retained as `null` (`unresolved`) under conservative Pathway 1 principles.
- **QP/NOS Alignment**: `LSC/Q8703` — *Refrigerated Storage Unit Supervisor* (LSC).
- **NSQF Level**: **5.0** (NQR registered).

---

### 3.9. `OCC_LOG_003` — Fleet Dispatcher
- **Sector / Trade**: Logistics / Fleet Management
- **NCO-2015 Code**: **`None`** (Blank / Unmapped)
- **Official NCO Title**: **`None`**
- **Mapping Type**: `unresolved`
- **Official Source Reference**:
  - DGE Searchable NAT Database: [Family 4323 / Family 1324](https://dge.gov.in/nat)
  - NCO-2015 Volume I: Page 54 (Code `1324.0500`), Page 135 (Code `4323.9900`)
  - NCO-2015 Volume II-A: Page 58 (Code `1324.0500`), Page 525 (Code `4323.9900`)
- **Audit Findings & Rationale**:
  - NCO-2015 contains no leaf code titled "Fleet Dispatcher".
  - Operational leaf candidate `4323.9900 Transport Clerks, Other` (Vol II-A p. 525) covers clerks who *"co-ordinate the timing of train, road and air passenger and freight transport not elsewhere classified"*.
  - Regulatory QP alignment candidate `1324.0500 Manager, Traffic` (Vol II-A p. 58) governs rate/freight classification analysis.
  - To avoid over-specifying road dispatch without a dedicated verbatim leaf code, specific NCO code is left `null` (`unresolved`) under conservative Pathway 1 principles (Broad Family 4323 / 1324 noted).
- **QP/NOS Alignment**: `LSC/Q1118` — *Transport Coordinator* (LSC).
- **NSQF Level**: **4.0** (NQR registered).

---

## 4. Summary Coverage Statistics

- **Total Tracked Demo Occupations:** 9
- **Exact NCO Matches:** 1 (`OCC_MFG_001` — `7223.5001`)
- **Closest Matches (Semantic Concordance / Validated QP):** 4 (`OCC_IT_003` — `2513.0101`, `OCC_MFG_002` — `7412.0101`, `OCC_MFG_003` — `8211.1201`, `OCC_LOG_001` — `4321.0102`)
- **Unresolved NCO Codes (Broad Family Only, Left Blank):** 4 (`OCC_IT_001`, `OCC_IT_002`, `OCC_LOG_002`, `OCC_LOG_003`)
- **Populated NCO Rows in Sample Data:** 5
- **Blank / Unresolved NCO Rows in Sample Data:** 4
- **Fabricated / Unsubstantiated Codes:** 0 (strictly eliminated)
