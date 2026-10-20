# SkillPulse LMIS

**Labour Market Intelligence System | Smart India Hackathon 2026 | Problem Statement SIH26246**

SkillPulse LMIS is a web-based prototype designed to bring labour-demand signals, training-supply indicators, skill-gap analysis, forecasting, alerts, scenario exploration, and career-support tools into one platform. It aims to help planners, training providers, industry stakeholders, and job seekers explore labour-market information at state, district, sector, and occupation levels.

> **Prototype and data note:** Core analytical observations currently use synthetic pilot data. Forecasts and gap indicators demonstrate the workflow and methodology; they are **not validated estimates of real-world vacancies or skill shortages**. Official datasets and portals documented by the project are used as contextual, taxonomy, or ecosystem references unless a live integration is explicitly implemented and verified.

---

## Highlights

- **Demand and supply insights:** Explore demand indicators, training-supply indicators, and relative demand–supply mismatch by geography and occupation.
- **District and occupation filters:** Narrow analytics by state, district, sector, and occupation.
- **Forecasts:** Compare prototype forecasts over **3-, 6-, and 12-month horizons** using baseline methods such as Naive Forecast, Moving Average (MA3), and Linear Trend.
- **Forecast diagnostics:** Rolling-origin backtesting and input checks help make assumptions and limitations visible. Results on synthetic data should not be interpreted as proof of real-market accuracy.
- **Skill-gap and early-warning views:** Surface relative indicators and alerts to help users investigate potential planning priorities.
- **Scenario Studio and recommendations:** Explore what-if assumptions and review planning-oriented recommendations.
- **Career support:** Career Profile, Career Navigator, Opportunity Explorer, and application-tracking tools help users explore relevant skills and opportunities.
- **SkillPulse Saarthi:** A separate **rule-based platform guide** that helps users navigate the product; it is not the same as the LLM-assisted Career Navigator.
- **Data Health and exports:** Review data availability, missing periods, validation status, and export supported results to CSV.
- **Web deployment:** The frontend and backend are structured for separate deployment, with the frontend hosted on Vercel and the API on Render in the current deployment setup.

## Technology Stack

| Layer | Technologies / approach |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI, REST API endpoints |
| Prototype storage | SQLite and CSV sample datasets |
| Forecasting | Custom Python baseline methods: Naive, MA3, Linear Trend |
| Data quality | Schema/input validation, missing-month checks, taxonomy/geography mapping, diagnostics |
| Career Navigator | Configured LLM provider integration such as IBM watsonx or Gemini, with fallback where configured |
| Platform guide | Rule-based SkillPulse Saarthi |
| Deployment | Vercel frontend, Render backend |

Provider availability, credentials, and fallback behavior depend on the local/deployed configuration. Never commit API keys or other secrets.

## Product Modules

| Module | Purpose |
|---|---|
| Overview / Dashboard | Summarises the selected labour-market indicators and provides entry points to the main analysis areas. |
| Demand | Explores demand signals with geographic, sector, and occupation filters. |
| Skill Gaps | Displays relative demand–supply mismatch indicators for investigation and planning. |
| Forecasts | Presents 3-, 6-, and 12-month prototype forecasts and diagnostics. |
| Early Warning Alerts | Highlights selected conditions that may require further review. |
| Recommendations | Presents planning-oriented recommendations based on the platform’s available indicators and assumptions. |
| Scenario Studio | Supports what-if exploration using the prototype’s defined assumptions. |
| Districts, Occupations, Qualifications | Provides reference views for geographic and occupation-related information. |
| Data Health | Helps inspect data provenance, completeness, missing periods, and validation. |
| API & Exports | Exposes supported API functionality and data exports. |
| Career Navigator | Provides LLM-assisted career guidance using the configured provider, subject to provider availability. |
| Opportunity Explorer / Career Profile / Application Tracker | Supports career exploration and user career-workspace workflows. |
| SkillPulse Saarthi | Rule-based navigation and platform assistance. |

Module availability can vary by deployment configuration.

## How It Works

1. **Load data:** The prototype reads its sample demand and training-supply datasets plus occupation and geography reference tables.
2. **Validate inputs:** Input/schema checks and time-series continuity checks identify incomplete or missing monthly observations.
3. **Calculate indicators:** The analytics services calculate demand indicators and relative demand–supply mismatch measures using the prototype’s documented assumptions.
4. **Generate forecasts:** Baseline forecasting methods are evaluated through rolling-origin backtesting and used to produce 3-, 6-, and 12-month forecasts where sufficient continuous history is available.
5. **Present insights:** The frontend renders filters, dashboards, alerts, scenario tools, diagnostics, career modules, and supported exports.

### Important interpretation limits

- The demand and supply observations are synthetic pilot data, not live job-market feeds.
- The relative mismatch score is a prototype indicator; it is not an absolute count of vacant jobs or unemployed people.
- Forecast methods and thresholds are prototype choices. Forecast accuracy and interval coverage have not been established on real labour-market data.
- PLFS indicators describe labour-market context; they are not equivalent to online vacancy counts.
- NCO-2015 is used for occupation classification/reference mapping, not as a source of vacancy data.
- NCS, e-Shram, and Skill India Digital Hub are relevant ecosystem references. Do not infer a live data connection or formal partnership unless that integration is separately implemented, approved, and tested.

## Data and Research References

The project documents relevant public sources for context and future integration planning. Their roles should remain distinct:

- **[Periodic Labour Force Survey (PLFS), MoSPI](https://mospi.gov.in/):** Labour-market context and employment indicators. PLFS is not equivalent to job-posting data.
- **[National Classification of Occupations (NCO-2015), DGE](https://www.dge.gov.in/nco-2015):** Occupation definitions and taxonomy mapping.
- **[National Career Service (NCS)](https://www.ncs.gov.in/):** Reference for employment and career services. A live bulk data feed is not claimed.
- **[e-Shram](https://eshram.gov.in/e-shram-portal):** Reference for unorganised-worker registration information; registrations are not job vacancies.
- **[Skill India Digital Hub (SIDH)](https://www.skillindiadigital.gov.in/):** Reference for skilling, courses, and opportunities. A live integration is not claimed.

Any use of external data must follow the source's access conditions, terms, and applicable data-governance requirements.

## Repository Structure

The following is a high-level guide; exact files may evolve as the project develops.

```text
SkillPulse/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Versioned API routes
│   │   ├── services/        # Analytics, forecasting and business logic
│   │   ├── main.py          # FastAPI application entry point
│   │   ├── config.py        # Backend configuration
│   │   └── database.py      # Database setup
│   ├── tests/               # Backend tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # Dashboard and feature modules
│   │   └── context/         # Shared frontend state/providers
│   ├── package.json
│   └── .env.example
├── data/
│   └── sample/              # Sample CSV data and reference tables
├── docs/                    # Methodology, data dictionary and mapping notes
├── scripts/                 # Verification and utility scripts
└── README.md
```

## Run Locally

### Prerequisites

- Python and pip
- Node.js and npm
- Git

Use versions supported by the dependency files in this repository.

### 1. Start the backend

In PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks activation scripts, you can use the virtual environment's Python directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If activation succeeds, start the API with:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The local API base URL is `http://127.0.0.1:8000`. If enabled in this configuration, interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
```

Create the local frontend environment file from the supplied example, then set the API base URL if required by the current client configuration:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start Vite:

```powershell
npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

Open the local URL printed by Vite in the terminal. If the project's current Vite scripts or configuration differ, follow the output and checked-in configuration.

### 3. Optional environment configuration

- Review `backend/.env.example` and `frontend/.env.example` before running.
- Add only the credentials required by features you intend to test.
- Keep `.env` files out of version control. Do not place secrets in screenshots, issues, commits, or this README.
- LLM-assisted Career Navigator functionality requires a correctly configured provider and network access; the rest of the prototype should be assessed according to the selected configuration.

## Testing and Quality Checks

Run the checks available in the current checkout. Typical commands are:

```powershell
# Backend tests
cd backend
python -m pytest
```

```powershell
# Frontend lint/build
cd frontend
npm run lint
npm run build
```

Some checks may require optional environment variables or test dependencies. Record the test command and result when preparing a release or demonstration.

## Deployment Notes

The current deployment setup separates the Vite frontend and FastAPI backend:

- **Frontend:** Vercel
- **Backend API:** Render

Configure `VITE_API_BASE_URL` and backend CORS/authentication settings for the intended deployment. Redeploy the frontend after changing Vite environment variables because they are generally embedded at build time. Verify the deployed `/health` or equivalent health endpoint, API requests, CORS behavior, login/session restoration, and key user journeys after a deployment.

This repository describes a hackathon prototype, not a production-certified service. Before using it for public-sector or personal decisions, complete security and privacy review, data-access approvals, operational monitoring, user testing, and validation with reliable real-world data.

## Responsible Use

SkillPulse LMIS is intended to support exploration and planning, not to make automated hiring, eligibility, benefit, or policy decisions. Users should inspect data provenance, assumptions, limitations, and diagnostics before relying on any output. Do not upload personal or confidential data unless the deployment has been reviewed and approved for that use.

## Project Status

**Stage:** Hackathon prototype / pilot-ready for technical demonstration, subject to environment and deployment configuration.

**Current priority for real-world readiness:** approved and reliable source data, scheduled data refresh, documented indicator definitions, representative stakeholder validation, model evaluation on real data, monitoring, and security/privacy controls.

## Acknowledgements

This project is developed for **Smart India Hackathon 2026 — Problem Statement SIH26246**. Public datasets and portals mentioned in the documentation are credited to their respective owners; mention does not imply endorsement, partnership, or live integration.

---

## Repository Description

**SkillPulse LMIS — a web-based Labour Market Intelligence System for district- and occupation-level demand–supply insights, skill-gap analysis, prototype forecasting, early warnings, scenario planning, and career exploration. Built with React, FastAPI, SQLite/CSV, and configurable LLM-assisted guidance.**
