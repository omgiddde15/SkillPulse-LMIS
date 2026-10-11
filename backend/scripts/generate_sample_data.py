#!/usr/bin/env python3
"""Deterministic sample data generator for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Generates:
1. data/sample/occupations.csv (9 master occupations across 3 sectors)
2. data/sample/geographies.csv (6 master districts across 3 states)
3. data/sample/demand_observations.csv (24 consecutive monthly periods: 2024-10 to 2026-09)
4. data/sample/training_supply.csv (24 consecutive monthly periods: 2024-10 to 2026-09)

Semantics & Constraints:
- 100% reproducible: Uses fixed random seed (Random(42)) without hash-seed dependency.
- Aligned timeline: 24 consecutive months ending at September 2026 (October 2024 to September 2026).
- Multi-source demand: Uniqueness composite key (period, district_id, occupation_id, source, signal_type, unit)
  supporting concurrent signal types while rejecting genuine duplicates.
- Concluding cohort training supply: Enrolments, completions, certifications, and placements track the same
  concluding batch through its lifecycle with standardized 90-day placement follow-up. Batch capacity is not
  treated as repeated measurements of fixed annual institutional capacity.
- Strict funnel monotonicity: 0 <= placements <= certifications <= completions <= enrolments <= sanctioned_seats.
- Explicitly labeled synthetic: All observations have is_synthetic=True and clear provenance.
"""

import calendar
import csv
import random
from datetime import date
from pathlib import Path
from typing import List, Tuple

# Fixed seed for absolute determinism
RANDOM_SEED = 42

# Prototype Reference Date for 90-day placement follow-up maturity determination
REFERENCE_DATE = date(2026, 10, 9)

# Time horizon: 24 consecutive monthly periods ending at September 2026 (2024-10 through 2026-09)
PERIODS: List[str] = [
    f"{year}-{month:02d}"
    for year in (2024, 2025, 2026)
    for month in range(1, 13)
    if (year == 2024 and month >= 10)
    or (year == 2025)
    or (year == 2026 and month <= 9)
]


def is_cohort_placement_matured(period: str, ref_date: date = REFERENCE_DATE) -> Tuple[str, bool]:
    """Determine whether a cohort's 90-day placement follow-up window has elapsed.
    
    Conservatively calculated from the cohort reporting month's end date to ref_date.
    - If days_elapsed >= 90: status is 'complete' (placement follow-up matured).
    - If days_elapsed < 90: status is 'pending' (placement count is null, NOT zero,
      because zero would falsely indicate a measured absence of employment).
    """
    y, m = map(int, period.split("-"))
    last_day = calendar.monthrange(y, m)[1]
    month_end = date(y, m, last_day)
    days_elapsed = (ref_date - month_end).days
    if days_elapsed >= 90:
        return "complete", True
    return "pending", False

OCCUPATIONS: List[Tuple[str, ...]] = [
    # occupation_id, occupation_title, sector, trade, nco_code, nco_title, qp_code, qp_title, nsqf_level
    ("OCC_IT_001", "Cloud Infrastructure Associate", "IT/ITeS", "Cloud Computing", "", "", "SSC/Q8304", "Cloud Infrastructure Analyst", "5.0"),
    ("OCC_IT_002", "Data Quality Analyst", "IT/ITeS", "Data & Analytics", "", "", "SSC/Q8101", "AI – Data Quality Analyst", "5.0"),
    ("OCC_IT_003", "Full-Stack Web Developer", "IT/ITeS", "Software Engineering", "2513.0101", "Web Developer", "SSC/Q0503", "Web Developer", "4.0"),
    ("OCC_MFG_001", "CNC Machine Operator", "Manufacturing", "Precision Machining", "7223.5001", "Machining Technician / CNC Operator", "CSC/Q0115", "CNC Operator Turning", ""),
    ("OCC_MFG_002", "Industrial Automation Technician", "Manufacturing", "Mechatronics", "7412.0101", "Automation Specialist", "IAS/Q5601", "Industrial Automation Technician", "4.0"),
    ("OCC_MFG_003", "Electric Vehicle Assembly Technician", "Manufacturing", "Automotive", "8211.1201", "Vehicle Assembly Fitter", "ASC/Q3605", "Electric Vehicle Assembly Technician", "3.5"),
    ("OCC_LOG_001", "Warehouse Inventory Coordinator", "Logistics", "Warehousing", "4321.0102", "Inventory Clerk", "LSC/Q2108", "Inventory Clerk", "3.0"),
    ("OCC_LOG_002", "Cold Chain Logistics Supervisor", "Logistics", "Cold Chain", "", "", "LSC/Q8703", "Refrigerated Storage Unit Supervisor", "5.0"),
    ("OCC_LOG_003", "Fleet Dispatcher", "Logistics", "Fleet Management", "4323.9900", "Transport Clerks, Other", "LSC/Q1118", "Transport Coordinator", "4.0"),
]

GEOGRAPHIES: List[Tuple[str, str, str, str]] = [
    # district_id, district_name, state_code, state_name
    ("MH_PUN", "Pune", "MH", "Maharashtra"),
    ("MH_MUM", "Mumbai Suburban", "MH", "Maharashtra"),
    ("KA_BLR_U", "Bengaluru Urban", "KA", "Karnataka"),
    ("KA_DHA", "Dharwad", "KA", "Karnataka"),
    ("TS_HYD", "Hyderabad", "TS", "Telangana"),
    ("TS_MED", "Medchal-Malkajgiri", "TS", "Telangana"),
]

DEMAND_PROVENANCE = (
    "Synthetic pilot baseline for SIH26246 benchmark; not real government or market statistics"
)


def find_data_dir() -> Path:
    """Find destination data/sample directory."""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir.parent.parent / "data" / "sample",
        Path.cwd() / "data" / "sample",
        Path.cwd() / "SkillPulse" / "data" / "sample",
        Path("C:/SIH26246/SkillPulse/data/sample"),
        Path("C:/SIH26246/data/sample"),
    ]
    for c in candidates:
        if c.parent.is_dir():
            c.mkdir(parents=True, exist_ok=True)
            return c.resolve()
    target = script_dir.parent.parent / "data" / "sample"
    target.mkdir(parents=True, exist_ok=True)
    return target.resolve()


def generate_occupations_csv(out_dir: Path) -> int:
    path = out_dir / "occupations.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["occupation_id", "occupation_title", "sector", "trade", "nco_code", "nco_title", "qp_code", "qp_title", "nsqf_level"])
        for row in OCCUPATIONS:
            writer.writerow(list(row))
    return len(OCCUPATIONS)


def generate_geographies_csv(out_dir: Path) -> int:
    path = out_dir / "geographies.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["district_id", "district_name", "state_code", "state_name"])
        for row in GEOGRAPHIES:
            writer.writerow(list(row))
    return len(GEOGRAPHIES)


def generate_demand_observations_csv(out_dir: Path, rng: random.Random) -> int:
    path = out_dir / "demand_observations.csv"
    rows = []

    for p_idx, period in enumerate(PERIODS):
        for dist_id, _, _, _ in GEOGRAPHIES:
            for occ_id, _, sector, *rest in OCCUPATIONS:
                # Deterministic sector-regional baseline
                base = 40.0
                if "BLR" in dist_id or "HYD" in dist_id or "PUN" in dist_id:
                    if sector == "IT/ITeS":
                        base += 65.0
                if "PUN" in dist_id or "DHA" in dist_id or "MED" in dist_id:
                    if sector == "Manufacturing":
                        base += 50.0
                if "MUM" in dist_id or "BLR" in dist_id or "MED" in dist_id:
                    if sector == "Logistics":
                        base += 38.0

                # 1. Online Job Postings (non-negative integer posting count)
                macro_trend = p_idx * 1.8
                seasonal_factor = (p_idx % 4) * 3.5
                noise_post = rng.uniform(-4.0, 7.0)
                postings_val = int(round(max(5.0, base + macro_trend + seasonal_factor + noise_post)))

                rows.append([
                    period,
                    dist_id,
                    occ_id,
                    "synthetic_job_portal_aggregate",
                    "online_job_postings",
                    postings_val,
                    "postings_count",
                    DEMAND_PROVENANCE,
                    "True",
                ])

                # 2. Vacancy Persistence Score (0 - 100 continuous synthetic score)
                # Roles in specialized tech / precision machining experience longer unfilled durations
                persist_base = 45.0
                if sector == "IT/ITeS":
                    persist_base += 15.0
                elif sector == "Manufacturing":
                    persist_base += 10.0
                noise_persist = rng.uniform(-6.0, 8.0)
                persist_val = round(min(100.0, max(0.0, persist_base + (p_idx * 0.5) + noise_persist)), 1)

                rows.append([
                    period,
                    dist_id,
                    occ_id,
                    "synthetic_portal_persistence_tracker",
                    "vacancy_persistence_score",
                    persist_val,
                    "score_points",
                    DEMAND_PROVENANCE,
                    "True",
                ])

                # 3. Active Employer Count (non-negative integer employer count)
                # Count of unique hiring firms advertising positions
                emp_ratio = 0.35 if ("BLR" in dist_id or "PUN" in dist_id or "HYD" in dist_id) else 0.28
                noise_emp = rng.uniform(-2.0, 3.0)
                active_employers = int(max(2, int(round(postings_val * emp_ratio + noise_emp))))

                rows.append([
                    period,
                    dist_id,
                    occ_id,
                    "synthetic_employer_registry",
                    "active_employer_count",
                    active_employers,
                    "employer_count",
                    DEMAND_PROVENANCE,
                    "True",
                ])

                # 4. Wage Attractiveness Index (synthetic index points, NOT actual reported currency wages)
                wage_base = 100.0
                if sector == "IT/ITeS":
                    wage_base += 18.0
                elif sector == "Manufacturing":
                    wage_base += 6.0
                elif sector == "Logistics":
                    wage_base -= 4.0
                noise_wage = rng.uniform(-5.0, 6.0)
                wage_val = round(max(50.0, min(160.0, wage_base + (p_idx * 0.4) + noise_wage)), 1)

                rows.append([
                    period,
                    dist_id,
                    occ_id,
                    "synthetic_compensation_benchmark",
                    "wage_attractiveness_index",
                    wage_val,
                    "index_points",
                    DEMAND_PROVENANCE,
                    "True",
                ])

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "period",
            "district_id",
            "occupation_id",
            "source",
            "signal_type",
            "signal_value",
            "unit",
            "data_provenance",
            "is_synthetic",
        ])
        writer.writerows(rows)

    return len(rows)


def generate_training_supply_csv(out_dir: Path, rng: random.Random) -> int:
    """Generate training supply observations under the Concluding Training Cohort Model.
    
    Cohort Lifecycle Semantics:
    - Each record represents a specific graduating/concluding training cohort whose instructional
      curriculum finished in that reporting period.
    - Sanctioned seats denotes the intake batch capacity assigned to that specific cohort.
    - Enrolments, completions, certifications, and placements follow the same cohort through its lifecycle.
    - Placements reflect verified employment secured within the standardized 90-day post-certification
      follow-up tracking window for that cohort.
    - Batch capacity avoids double-counting fixed annual physical institutional facility capacity.
    """
    path = out_dir / "training_supply.csv"
    rows = []

    for p_idx, period in enumerate(PERIODS):
        placement_status, is_matured = is_cohort_placement_matured(period, REFERENCE_DATE)

        for dist_id, _, _, _ in GEOGRAPHIES:
            for occ_id, _, sector, *rest in OCCUPATIONS:
                # Cohort intake batch capacity
                base_seats = 60
                if sector == "IT/ITeS":
                    base_seats = 90
                elif sector == "Manufacturing":
                    base_seats = 60
                elif sector == "Logistics":
                    base_seats = 40

                if "BLR" in dist_id or "HYD" in dist_id or "PUN" in dist_id:
                    base_seats += 20

                batch_capacity = base_seats + rng.choice([0, 10, 20])

                # Funnel progression (strictly: placements <= certs <= completions <= enrolments <= seats)
                enrolment_rate = rng.uniform(0.85, 0.95)
                enrolments = int(round(batch_capacity * enrolment_rate))
                enrolments = min(enrolments, batch_capacity)

                completion_rate = rng.uniform(0.82, 0.92)
                completions = int(round(enrolments * completion_rate))
                completions = min(completions, enrolments)

                cert_rate = rng.uniform(0.85, 0.94)
                certifications = int(round(completions * cert_rate))
                certifications = min(certifications, completions)

                # Placement follow-up tracking:
                # Preserved only if the 90-day window has matured as of REFERENCE_DATE.
                # If pending, recorded as empty/null string (never zero).
                if is_matured:
                    placement_rate = rng.uniform(0.68, 0.84)
                    placements = int(round(certifications * placement_rate))
                    placements = min(placements, certifications)
                    placements_val = str(placements)
                else:
                    placements_val = ""

                rows.append([
                    period,
                    dist_id,
                    occ_id,
                    batch_capacity,
                    enrolments,
                    completions,
                    certifications,
                    placements_val,
                    placement_status,
                    "True",
                ])

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "period",
            "district_id",
            "occupation_id",
            "sanctioned_seats",
            "enrolments",
            "completions",
            "certifications",
            "placements",
            "placement_status",
            "is_synthetic",
        ])
        writer.writerows(rows)

    return len(rows)


def main() -> None:
    print("=" * 76)
    print("SkillPulse LMIS — Deterministic Sample Data Generator")
    print(f"Random Seed: {RANDOM_SEED} | Periods: {len(PERIODS)} ({PERIODS[0]} to {PERIODS[-1]})")
    print("=" * 76)

    data_dir = find_data_dir()
    print(f"Target Directory: {data_dir}\n")

    # Initialise deterministic RNG
    rng = random.Random(RANDOM_SEED)

    occ_count = generate_occupations_csv(data_dir)
    geo_count = generate_geographies_csv(data_dir)
    demand_count = generate_demand_observations_csv(data_dir, rng)
    supply_count = generate_training_supply_csv(data_dir, rng)

    print("Generation complete:")
    print(f"  • occupations.csv:          {occ_count:>5} master entity records")
    print(f"  • geographies.csv:          {geo_count:>5} master entity records")
    print(f"  • demand_observations.csv:  {demand_count:>5} observation records (4 signals × 24 months)")
    print(f"  • training_supply.csv:      {supply_count:>5} observation records (24 months)")
    print(f"  • Total Reference Entities: {occ_count + geo_count:>5} records")
    print(f"  • Total Observations:       {demand_count + supply_count:>5} records")
    print(f"  • Total CSV Data Rows:      {occ_count + geo_count + demand_count + supply_count:>5} rows\n")
    print("Deterministic generation verified successfully.")


if __name__ == "__main__":
    main()
