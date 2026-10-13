"""Starter target role profiles and skill taxonomy catalogue for SkillPulse.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Provides a transparent, deterministic, versioned set of target-role skill profiles.
Where no sufficiently close occupational classification or current qualification standard
is confirmed, occupational mapping is explicitly set to null and labeled as 'SkillPulse-curated'.
Broad occupational references (e.g. NCO-2015 codes) are strictly separated from modern
software and engineering role specifications.
"""

from __future__ import annotations

import re
from typing import Dict, Any, List, Optional


# Controlled explicit alias mappings: alias -> canonical_skill_key
# Only genuinely equivalent spelling, abbreviation, or canonical name variants are preserved.
# Conceptual equivalences (e.g., specific DBMS -> SQL, specific tool -> general concept) are strictly prohibited.
ALIAS_MAP: Dict[str, str] = {
    # Programming Languages
    "py": "python",
    "python3": "python",
    "python 3": "python",
    "js": "javascript",
    "ecmascript": "javascript",
    "es6": "javascript",
    "ts": "typescript",
    "c#": "c_sharp",
    "golang": "go",

    # Web & Frameworks
    "reactjs": "react",
    "react.js": "react",
    "fast api": "fastapi",
    "nodejs": "node_js",
    "node.js": "node_js",
    "node": "node_js",
    "html5": "html",
    "css3": "css",
    "tailwindcss": "tailwind",
    "tailwind css": "tailwind",

    # Databases & Storage
    # NOTE: PostgreSQL is a distinct database management system and must NEVER map to generic SQL.
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "psql": "postgresql",
    "structured query language": "sql",
    "ansi sql": "sql",
    "ansi_sql": "sql",
    "redis cache": "redis",

    # DevOps, Cloud & Automation
    # k8s is the official abbreviation for Kubernetes
    "k8s": "kubernetes",
    "cicd": "ci_cd",
    "ci/cd": "ci_cd",
    "continuous integration": "ci_cd",
    "restful api": "rest_api",
    "restful apis": "rest_api",
    "rest apis": "rest_api",
    "rest api": "rest_api",

    # Data Analysis
    "data analytics": "data_analysis",
    "exploratory data analysis": "data_analysis",
    "eda": "data_analysis",
    "data viz": "data_visualization",
    "ml": "machine_learning",

    # Hardware & Embedded
    "microcontroller": "microcontrollers",
    "internet of things": "iot",
    "embedded system": "embedded_systems",

    # Industrial & Quality
    "qa": "quality_assurance",
    "plc programming": "plc",
}


def normalize_skill_key(raw_name: str) -> str:
    """Normalizes a raw skill string to its canonical canonical_skill_key.
    
    Uses explicit alias mappings only. Unrelated keywords are never treated
    as equivalent.
    """
    if not raw_name:
        return ""
    cleaned = raw_name.strip().lower()
    # Check explicit alias mapping
    if cleaned in ALIAS_MAP:
        return ALIAS_MAP[cleaned]
    # Clean snake_case slug
    slug = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    return slug


# Display names for canonical skill keys
SKILL_DISPLAY_NAMES: Dict[str, str] = {
    "python": "Python",
    "fastapi": "FastAPI",
    "django": "Django",
    "flask": "Flask",
    "sql": "SQL (Structured Query Language)",
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "sqlite": "SQLite",
    "git": "Git Version Control",
    "rest_api": "RESTful API Design",
    "docker": "Docker Containerization",
    "kubernetes": "Kubernetes Orchestration",
    "linux": "Linux & Command Line",
    "redis": "Redis Caching",
    "ci_cd": "CI/CD Automation",
    "javascript": "JavaScript (ES6+)",
    "typescript": "TypeScript",
    "react": "React",
    "html": "HTML5 & Accessibility",
    "css": "CSS3 & Responsive Design",
    "tailwind": "Tailwind CSS",
    "node_js": "Node.js",
    "data_analysis": "Exploratory Data Analysis",
    "pandas": "Pandas Data Processing",
    "numpy": "NumPy Array Computing",
    "data_visualization": "Data Visualization & Dashboards",
    "machine_learning": "Machine Learning Fundamentals",
    "excel": "Advanced Excel / Spreadsheets",
    "c_cpp": "C / Embedded C++",
    "microcontrollers": "Microcontrollers",
    "iot": "Internet of Things (IoT)",
    "embedded_systems": "Embedded Systems & Firmware",
    "communication_protocols": "Communication Protocols",
    "pcb_design": "PCB Design & Schematic Capture",
    "rtos": "RTOS (Real-Time Operating Systems)",
    "circuit_testing": "Circuit Testing & Diagnostics",
    "quality_assurance": "Quality Assurance & Standards",
    "pcb_debugging": "PCB Debugging & Soldering",
    "plc": "PLC (Programmable Logic Controllers)",
    "scada": "SCADA Industrial Monitoring",
    "cad": "CAD Electrical / Mechanical Drafting",
    "instrumentation": "Electronic Instrumentation & Calibration",
    "lean_manufacturing": "Lean Manufacturing & 5S",
    "problem_solving": "Analytical Problem Solving",
    "communication": "Technical Communication",
}


# Default category mapping
SKILL_CATEGORIES: Dict[str, str] = {
    "python": "technical",
    "fastapi": "technical",
    "django": "technical",
    "flask": "technical",
    "sql": "technical",
    "postgresql": "technical",
    "mysql": "technical",
    "sqlite": "technical",
    "git": "tool",
    "rest_api": "technical",
    "docker": "tool",
    "kubernetes": "tool",
    "linux": "technical",
    "redis": "tool",
    "ci_cd": "tool",
    "javascript": "technical",
    "typescript": "technical",
    "react": "technical",
    "html": "technical",
    "css": "technical",
    "tailwind": "tool",
    "node_js": "technical",
    "data_analysis": "technical",
    "pandas": "tool",
    "numpy": "tool",
    "data_visualization": "tool",
    "machine_learning": "technical",
    "excel": "tool",
    "c_cpp": "technical",
    "microcontrollers": "technical",
    "iot": "domain",
    "embedded_systems": "domain",
    "communication_protocols": "technical",
    "pcb_design": "tool",
    "rtos": "technical",
    "circuit_testing": "technical",
    "quality_assurance": "domain",
    "pcb_debugging": "technical",
    "plc": "technical",
    "scada": "tool",
    "cad": "tool",
    "instrumentation": "technical",
    "lean_manufacturing": "domain",
    "problem_solving": "soft",
    "communication": "soft",
}


def get_skill_category(skill_key: str) -> str:
    """Returns the taxonomy category for a canonical skill key."""
    return SKILL_CATEGORIES.get(skill_key, "technical")


def get_skill_display_name(skill_key: str) -> str:
    """Returns human-readable display name for a skill key."""
    if skill_key in SKILL_DISPLAY_NAMES:
        return SKILL_DISPLAY_NAMES[skill_key]
    return skill_key.replace("_", " ").title()


# -----------------------------------------------------------------------------
# Role Catalogue Definitions
# -----------------------------------------------------------------------------

TARGET_ROLES: Dict[str, Dict[str, Any]] = {
    "ROLE_PY_BACKEND": {
        "role_id": "ROLE_PY_BACKEND",
        "title": "Python / Backend Developer",
        "description": "Designs and develops server-side web services, RESTful APIs, relational data models, and asynchronous microservices using modern Python frameworks.",
        "sector": "IT/ITeS",
        "benchmark_occupation_id": None,
        "broad_occupational_reference": "NCO-2015: 2512 (Software Developers) / ISCO-08: 2512",
        "source_type": "SkillPulse-curated",
        "source_title": "SkillPulse Curated Target Role Profile: Python Backend Engineering",
        "source_url": None,
        "version": "2026.2",
        "review_date": "2026-10-13",
        "provenance_notes": "Curated starter profile reflecting modern Python API microservice hiring requirements. Separated from broad occupational classifications (NCO 2512); does not claim unverified government QP certification.",
        "required_skills": [
            {
                "skill_key": "python",
                "skill_name": "Python",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Core programming language for backend business logic, algorithms, and application runtime.",
                "approved_aliases": ["python", "python3", "py"],
            },
            {
                "skill_key": "fastapi",
                "skill_name": "FastAPI",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Modern asynchronous web framework for building performant, type-annotated HTTP REST microservices.",
                "approved_aliases": ["fastapi", "fast api"],
            },
            {
                "skill_key": "sql",
                "skill_name": "SQL (Relational Queries & DDL)",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Relational database querying, joins, constraints, transactions, and indexing using standard SQL.",
                "approved_aliases": ["sql", "structured query language", "ansi sql"],
            },
            {
                "skill_key": "git",
                "skill_name": "Git Version Control",
                "category": "tool",
                "importance_level": "required",
                "role_justification": "Distributed source code version control, branch management, code review, and collaborative merge workflows.",
                "approved_aliases": ["git"],
            },
            {
                "skill_key": "rest_api",
                "skill_name": "RESTful API Design",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Designing clean, secure, stateless client-server interfaces using standard HTTP methods and status codes.",
                "approved_aliases": ["rest_api", "rest api", "restful api", "rest"],
            },
        ],
        "preferred_skills": [
            {
                "skill_key": "docker",
                "skill_name": "Docker Containerization",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Containerizing backend services for reproducible local development and isolated cloud production environments.",
                "approved_aliases": ["docker"],
            },
            {
                "skill_key": "linux",
                "skill_name": "Linux & Command Line",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Navigating server environments, executing shell commands, and managing backend service daemon processes.",
                "approved_aliases": ["linux"],
            },
            {
                "skill_key": "redis",
                "skill_name": "Redis Caching",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "In-memory caching and session state management to accelerate high-throughput API endpoints.",
                "approved_aliases": ["redis"],
            },
            {
                "skill_key": "ci_cd",
                "skill_name": "CI/CD Automation",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Automating test suites and deployment pipelines across staging and production branches.",
                "approved_aliases": ["ci_cd", "cicd", "continuous integration"],
            },
        ],
    },
    "ROLE_FRONTEND_DEV": {
        "role_id": "ROLE_FRONTEND_DEV",
        "title": "Frontend Web Developer",
        "description": "Constructs responsive, accessible, interactive web user interfaces using modern component architecture and browser standards.",
        "sector": "IT/ITeS",
        "benchmark_occupation_id": None,
        "broad_occupational_reference": "NCO-2015: 2513.0101 (Web Developer) / QP: SSC/Q0503",
        "source_type": "SkillPulse-curated",
        "source_title": "SkillPulse Curated Target Role Profile: Modern Frontend UI Engineering",
        "source_url": None,
        "version": "2026.2",
        "review_date": "2026-10-13",
        "provenance_notes": "Curated modern frontend UI engineering profile. Broad occupational reference provided to NCO 2513.0101 and SSC/Q0503, but specific React/SPA component criteria are curated by SkillPulse and not an approved government certification.",
        "required_skills": [
            {
                "skill_key": "javascript",
                "skill_name": "JavaScript (ES6+)",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Fundamental programming language for client-side interactivity, DOM operations, and asynchronous event handling.",
                "approved_aliases": ["javascript", "js", "es6", "ecmascript"],
            },
            {
                "skill_key": "react",
                "skill_name": "React",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Declarative component-driven UI library for managing application views, state hooks, and side effects.",
                "approved_aliases": ["react", "reactjs", "react.js"],
            },
            {
                "skill_key": "html",
                "skill_name": "HTML5 & Accessibility",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Document structure semantics, ARIA accessibility attributes, and cross-browser markup standards.",
                "approved_aliases": ["html", "html5"],
            },
            {
                "skill_key": "css",
                "skill_name": "CSS3 & Responsive Design",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Layout styling using Flexbox, CSS Grid, media queries, and design token integration.",
                "approved_aliases": ["css", "css3"],
            },
            {
                "skill_key": "git",
                "skill_name": "Git Version Control",
                "category": "tool",
                "importance_level": "required",
                "role_justification": "Version control for UI codebase tracking and collaborative team development.",
                "approved_aliases": ["git"],
            },
        ],
        "preferred_skills": [
            {
                "skill_key": "typescript",
                "skill_name": "TypeScript",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Static type checking to prevent runtime errors in large enterprise UI components and shared interfaces.",
                "approved_aliases": ["typescript", "ts"],
            },
            {
                "skill_key": "tailwind",
                "skill_name": "Tailwind CSS",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Utility-first styling for rapid development of consistent, maintainable design systems.",
                "approved_aliases": ["tailwind", "tailwindcss", "tailwind css"],
            },
            {
                "skill_key": "rest_api",
                "skill_name": "RESTful API Integration",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Fetching, caching, and updating remote server data through HTTP client interfaces.",
                "approved_aliases": ["rest_api", "rest api", "restful api"],
            },
        ],
    },
    "ROLE_DATA_ANALYST": {
        "role_id": "ROLE_DATA_ANALYST",
        "title": "Data Analyst",
        "description": "Collects, validates, cleans, and analyzes structured datasets to generate evidence-based business intelligence and decision models.",
        "sector": "IT/ITeS",
        "benchmark_occupation_id": None,
        "broad_occupational_reference": "NCO-2015: 2521 (Database Designers & Administrators) / QP: SSC/Q8101",
        "source_type": "SkillPulse-curated",
        "source_title": "SkillPulse Curated Target Role Profile: Exploratory Data Analytics",
        "source_url": None,
        "version": "2026.2",
        "review_date": "2026-10-13",
        "provenance_notes": "Curated general data analytics profile. Broad reference given to NCO 2521 and QP SSC/Q8101 (Data Quality Analyst), but core stack requirements (Pandas, SQL analysis, visualization) are curated by SkillPulse and not an approved government certification.",
        "required_skills": [
            {
                "skill_key": "sql",
                "skill_name": "SQL (Relational Analytics)",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Querying relational data warehouses, filtering, aggregating, joining, and performing analytical calculations.",
                "approved_aliases": ["sql", "structured query language"],
            },
            {
                "skill_key": "python",
                "skill_name": "Python",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Automating data ingestion pipelines, cleaning dirty datasets, and running statistical computations.",
                "approved_aliases": ["python", "python3", "py"],
            },
            {
                "skill_key": "data_analysis",
                "skill_name": "Exploratory Data Analysis",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Formulating hypotheses, inspecting data distributions, handling outliers, and validating metrics.",
                "approved_aliases": ["data_analysis", "data analytics", "exploratory data analysis", "eda"],
            },
            {
                "skill_key": "pandas",
                "skill_name": "Pandas Data Processing",
                "category": "tool",
                "importance_level": "required",
                "role_justification": "Manipulating high-dimensional tabular data frames, grouped aggregations, and data reshaping.",
                "approved_aliases": ["pandas"],
            },
            {
                "skill_key": "data_visualization",
                "skill_name": "Data Visualization & Dashboards",
                "category": "tool",
                "importance_level": "required",
                "role_justification": "Presenting quantitative findings through clear analytical charts and executive dashboards.",
                "approved_aliases": ["data_visualization", "data viz"],
            },
        ],
        "preferred_skills": [
            {
                "skill_key": "numpy",
                "skill_name": "NumPy Array Computing",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Vectorized linear algebra, numerical array calculations, and matrix transformations.",
                "approved_aliases": ["numpy"],
            },
            {
                "skill_key": "machine_learning",
                "skill_name": "Machine Learning Fundamentals",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Applying predictive regression and clustering algorithms to identify emerging trends.",
                "approved_aliases": ["machine_learning", "ml"],
            },
            {
                "skill_key": "excel",
                "skill_name": "Advanced Excel / Spreadsheets",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Rapid spreadsheet calculations, pivot tables, and cross-team report sharing.",
                "approved_aliases": ["excel"],
            },
        ],
    },
    "ROLE_EMBEDDED_IOT": {
        "role_id": "ROLE_EMBEDDED_IOT",
        "title": "Embedded Systems / IoT Engineer",
        "description": "Develops microcontroller firmware, integrates sensor peripherals, and programs connected edge communication protocols.",
        "sector": "Manufacturing",
        "benchmark_occupation_id": None,
        "broad_occupational_reference": "NCO-2015: 2152 (Electronics Engineers)",
        "source_type": "SkillPulse-curated",
        "source_title": "SkillPulse Curated Target Role Profile: Embedded Systems & Connected Edge",
        "source_url": None,
        "version": "2026.2",
        "review_date": "2026-10-13",
        "provenance_notes": "Curated firmware and IoT engineering profile. Not mapped to OCC_MFG_002 (Industrial Automation Technician), as microcontroller firmware design is distinct from factory automation maintenance. Broad reference: NCO 2152.",
        "required_skills": [
            {
                "skill_key": "c_cpp",
                "skill_name": "C / Embedded C++",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Resource-constrained embedded programming, memory pointers, bit manipulation, and register access.",
                "approved_aliases": ["c_cpp", "c", "c++", "embedded c"],
            },
            {
                "skill_key": "microcontrollers",
                "skill_name": "Microcontrollers (Firmware Architecture)",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Configuring microcontroller clocks, GPIO pins, ADC/DAC peripherals, and hardware timers.",
                "approved_aliases": ["microcontrollers", "microcontroller"],
            },
            {
                "skill_key": "iot",
                "skill_name": "Internet of Things (IoT)",
                "category": "domain",
                "importance_level": "required",
                "role_justification": "Connecting edge devices to networks for sensor telemetry gathering and remote actuation.",
                "approved_aliases": ["iot", "internet of things"],
            },
            {
                "skill_key": "embedded_systems",
                "skill_name": "Embedded Systems & Firmware",
                "category": "domain",
                "importance_level": "required",
                "role_justification": "Firmware architecture, interrupt service routines, low power management, and hardware interfacing.",
                "approved_aliases": ["embedded_systems", "embedded system"],
            },
            {
                "skill_key": "communication_protocols",
                "skill_name": "Communication Protocols",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Serial bus communication with sensor peripherals, wireless transceivers, and gateway hosts.",
                "approved_aliases": ["communication_protocols"],
            },
        ],
        "preferred_skills": [
            {
                "skill_key": "linux",
                "skill_name": "Embedded Linux",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Single-board computer development and POSIX system calls.",
                "approved_aliases": ["linux"],
            },
            {
                "skill_key": "pcb_design",
                "skill_name": "PCB Design & Schematic Capture",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Designing hardware circuit schematics and printed circuit board routing.",
                "approved_aliases": ["pcb_design"],
            },
            {
                "skill_key": "rtos",
                "skill_name": "RTOS (Real-Time Operating Systems)",
                "category": "technical",
                "importance_level": "preferred",
                "role_justification": "Multi-threaded deterministic task scheduling and semaphores using FreeRTOS or Zephyr.",
                "approved_aliases": ["rtos"],
            },
        ],
    },
    "ROLE_ELECTRONICS_TEST": {
        "role_id": "ROLE_ELECTRONICS_TEST",
        "title": "Electronics Testing & Quality Technician",
        "description": "Verifies electronic circuits, executes bench instrumentation tests, calibrates industrial sensors, and troubleshoots hardware faults.",
        "sector": "Manufacturing",
        "benchmark_occupation_id": None,
        "broad_occupational_reference": "NCO-2015: 7412 (Electrical & Electronic Equipment Mechanics)",
        "source_type": "SkillPulse-curated",
        "source_title": "SkillPulse Curated Target Role Profile: Bench Electronics Testing & QA",
        "source_url": None,
        "version": "2026.2",
        "review_date": "2026-10-13",
        "provenance_notes": "Curated bench electronics testing and diagnostic technician profile. Not mapped to OCC_MFG_002 (Industrial Automation Technician). Broad reference: NCO 7412.",
        "required_skills": [
            {
                "skill_key": "circuit_testing",
                "skill_name": "Circuit Testing & Diagnostics",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Signal waveform analysis, voltage drop measurements, and continuity diagnostics on PCB hardware.",
                "approved_aliases": ["circuit_testing", "electronics testing"],
            },
            {
                "skill_key": "quality_assurance",
                "skill_name": "Quality Assurance & Standards",
                "category": "domain",
                "importance_level": "required",
                "role_justification": "Ensuring electronic boards and systems comply with manufacturing tolerances and quality benchmarks.",
                "approved_aliases": ["quality_assurance", "qa"],
            },
            {
                "skill_key": "pcb_debugging",
                "skill_name": "PCB Debugging & Soldering",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "SMD/through-hole component replacement, schematic tracing, and fault localization.",
                "approved_aliases": ["pcb_debugging"],
            },
            {
                "skill_key": "plc",
                "skill_name": "PLC (Programmable Logic Controllers)",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Testing industrial control logic, relay circuits, and field input/output module wiring.",
                "approved_aliases": ["plc", "plc programming"],
            },
            {
                "skill_key": "instrumentation",
                "skill_name": "Electronic Instrumentation & Calibration",
                "category": "technical",
                "importance_level": "required",
                "role_justification": "Calibrating electronic measurement sensors, transducers, and signal converters.",
                "approved_aliases": ["instrumentation"],
            },
        ],
        "preferred_skills": [
            {
                "skill_key": "scada",
                "skill_name": "SCADA Industrial Monitoring",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Validating supervisory telemetry feeds, alarms, and control interfaces.",
                "approved_aliases": ["scada"],
            },
            {
                "skill_key": "cad",
                "skill_name": "CAD Electrical Drafting",
                "category": "tool",
                "importance_level": "preferred",
                "role_justification": "Reviewing wiring diagrams and schematic drawings.",
                "approved_aliases": ["cad"],
            },
            {
                "skill_key": "lean_manufacturing",
                "skill_name": "Lean Manufacturing & 5S",
                "category": "domain",
                "importance_level": "preferred",
                "role_justification": "Maintaining organized test stations and standard operating procedures.",
                "approved_aliases": ["lean_manufacturing"],
            },
        ],
    },
}


def get_supported_roles() -> List[Dict[str, Any]]:
    """Returns a list of all starter role profiles with summary counts."""
    roles = []
    for role_id, r in TARGET_ROLES.items():
        roles.append({
            "role_id": r["role_id"],
            "title": r["title"],
            "description": r["description"],
            "sector": r["sector"],
            "benchmark_occupation_id": r.get("benchmark_occupation_id"),
            "broad_occupational_reference": r.get("broad_occupational_reference"),
            "source_type": r["source_type"],
            "source_title": r["source_title"],
            "source_url": r.get("source_url"),
            "version": r["version"],
            "review_date": r["review_date"],
            "provenance_notes": r["provenance_notes"],
            "required_skills_count": len(r["required_skills"]),
            "preferred_skills_count": len(r["preferred_skills"]),
        })
    return roles


def get_role_by_id(role_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full specification for a given role ID."""
    if not role_id:
        return None
    key = role_id.strip().upper()
    return TARGET_ROLES.get(key)
