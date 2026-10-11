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
5. **IT Roles NSQF Level Alignment (`OCC_IT_001` & `OCC_IT_002`)**:
   - Aligned to **NSQF Level 6.0** reflecting advanced professional skills (Cloud Infrastructure and AI/Data Quality analytics standards).
6. **`CSC/Q0115` Qualification Ownership, Version & Level Resolution**:
   - **Belonging Confirmed**: NQR registration `2022/CCM/CGSC/05592` directly belongs to `CSC/Q0115` (*CNC Operator Turning*, Capital Goods Skill Council) as Version 2.0.
   - **NCO vs. QP Distinction**: NCO-2015 code `7223.5001` (*Machining Technician / CNC Operator*) is an economy-wide occupational classification that verbatim matches the role and remains valid independently of QP accreditation status.
   - **NSQF Level**: Aligned to **NSQF Level 4.0** under Version 2.0.
7. **`ASC/Q3605` Level Alignment**:
   - Aligned to **NSQF Level 4.0** under automotive qualification standards.
8. **Logistics Occupations Unmapped Status (`OCC_LOG_001` & `OCC_LOG_003`)**:
   - For `OCC_LOG_001` (Warehouse Inventory Coordinator) and `OCC_LOG_003` (Fleet Dispatcher), specific NCO codes and titles are set to **`null`** because no verbatim, officially verified leaf code exists in NCO-2015 for these exact demo titles. Broad family classifications are noted for informational context only.

### 1.2. Core Governance Principles:
- **No Fabricated Completeness**: Accurate partial mapping is strictly preferred over fabricated completeness. Where no official specific 8-digit leaf code exists, fields remain `null`.
- **Classification vs. Qualification**: NCO job family classification is strictly separated from QP/NOS vocational qualifications and NSQF competency levels.
- **Application Key Invariance**: Internal keys (`OCC_IT_001` – `OCC_LOG_003`) remain invariant database IDs.

---

## 2. Audited Master Concordance Table (9 Demo Occupations)

| Occupation ID | Demo Occupation Title | Sector | Vocational Trade | Verified NCO-2015 Code | Official NCO-2015 Title | NCO Match Status | Relevant QP/NOS Code | Official QP Title | Verified NSQF Level | Qualification Version / Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- | :---: | :--- |
| **`OCC_IT_001`** | Cloud Infrastructure Associate | IT/ITeS | Cloud Computing | *None* | *None* | **Unmapped** (Broad Family 2522 only) | `SSC/Q8304` | Cloud Infrastructure Analyst | **6.0** | NQR `QG-05-IT-00505-2023-V1.1-NASSCOM` |
| **`OCC_IT_002`** | Data Quality Analyst | IT/ITeS | Data & Analytics | *None* | *None* | **Unmapped** (Broad Family 2521 only) | `SSC/Q8101` | AI – Data Quality Analyst | **6.0** | NQR `QG-05-IT-01524-2023-V1.1-NASSCOM`; v4.0 Level 6 deactivated 14-Apr-2025 |
| **`OCC_IT_003`** | Full-Stack Web Developer | IT/ITeS | Software Engineering | `2513.0101` | Web Developer | **Strong semantic match** | `SSC/Q0503` | Web Developer | **4.0** | Active NASSCOM QP; MSME `QG-4.5-IT-02395-2024-V1-MSME` (Level 4.5) |
| **`OCC_MFG_001`** | CNC Machine Operator | Manufacturing | Precision Machining | `7223.5001` | Machining Technician / CNC Operator | **Exact match** | `CSC/Q0115` | CNC Operator Turning | **4.0** | NQR `2022/CCM/CGSC/05592` (v2.0, Level 4.0) |
| **`OCC_MFG_002`** | Industrial Automation Technician | Manufacturing | Mechatronics | `7412.0101` | Automation Specialist | **Strong semantic match** | `IAS/Q5601` | Industrial Automation Technician | **4.0** | NQR registered IASC QP (corrected from invalid Q8004) |
| **`OCC_MFG_003`** | Electric Vehicle Assembly Technician | Manufacturing | Automotive | `8211.1201` | Vehicle Assembly Fitter | **Semantic proxy** (No EV leaf in NCO-2015) | `ASC/Q3605` | Electric Vehicle Assembly Technician | **4.0** | ASDC Automotive standard (Level 4.0) |
| **`OCC_LOG_001`** | Warehouse Inventory Coordinator | Logistics | Warehousing | *None* | *None* | **Unmapped** (Broad Family 4321 only) | `LSC/Q2108` | Inventory Clerk | **3.0** | NQR registered LSC QP |
| **`OCC_LOG_002`** | Cold Chain Logistics Supervisor | Logistics | Cold Chain | *None* | *None* | **Unmapped** (Broad Family 1324 only) | `LSC/Q8703` | Refrigerated Storage Unit Supervisor | **5.0** | NQR registered LSC QP; NCO 1324.0101 is Supplier Quality Manager |
| **`OCC_LOG_003`** | Fleet Dispatcher | Logistics | Fleet Management | *None* | *None* | **Unmapped** (Broad Family 4323 only) | `LSC/Q1118` | Transport Coordinator | **4.0** | NQR registered LSC QP |

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
- **NSQF Level**: **6.0**.

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
  - Aligned to **NSQF Level 6.0** for specialized data and AI analytics competency.

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
- **NSQF Level Analysis**:
  - Aligned to **NSQF Level 4.0** under Version 2.0 (`2022/CCM/CGSC/05592`).

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
  - Aligned to **NSQF Level 4.0** under ASDC qualification standards.

---

### 3.7. `OCC_LOG_001` — Warehouse Inventory Coordinator
- **Sector / Trade**: Logistics / Warehousing
- **NCO-2015 Code**: **`None`** (Unmapped)
- **Official NCO Title**: **`None`**
- **Match Status**: **Unmapped** (Broad Family 4321 only)
- **Audit Findings**:
  - NCO code left null to avoid over-specifying general warehousing inventory coordination without a verbatim national classification leaf code.
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
- **NCO-2015 Code**: **`None`** (Unmapped)
- **Official NCO Title**: **`None`**
- **Match Status**: **Unmapped** (Broad Family 4323 only)
- **Audit Findings**:
  - NCO code left null to avoid over-specifying road dispatch without a verbatim leaf code in Family 4323.
- **QP/NOS Alignment**: `LSC/Q1118` — *Transport Coordinator* (LSC).
- **NSQF Level**: **4.0** (NQR registered).

---

## 4. Summary Coverage Statistics

- **Total Tracked Demo Occupations:** 9
- **Exact NCO Matches:** 1 (`OCC_MFG_001` — `7223.5001`)
- **Strong Semantic / Proxy Matches:** 3 (`OCC_IT_003`, `OCC_MFG_002`, `OCC_MFG_003`)
- **Unmapped NCO Codes (Broad Family Only, Left Null):** 5 (`OCC_IT_001`, `OCC_IT_002`, `OCC_LOG_001`, `OCC_LOG_002`, `OCC_LOG_003`)
- **Fabricated / Unsubstantiated Codes:** 0 (strictly eliminated)
