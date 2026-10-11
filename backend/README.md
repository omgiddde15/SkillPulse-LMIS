# SkillPulse LMIS — Backend

AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine  
**Smart India Hackathon 2026 — PS SIH26246**

---

## Overview

This is the backend service for **SkillPulse LMIS**, built using **FastAPI** and served with **Uvicorn**. It exposes high-performance RESTful APIs for labour market intelligence, skill taxonomy mapping, and supply-demand forecasting.

---

## Prerequisites

- **Python**: Version 3.10+ (tested on Python 3.13 / 3.14)
- **Shell**: Windows PowerShell or PowerShell 7

---

## Windows PowerShell Setup & Run Instructions

Follow these exact steps in Windows PowerShell to set up the environment and run the backend.

### 1. Open PowerShell and Navigate to the Backend Directory

```powershell
# From the project root (C:\SIH26246\SkillPulse):
Set-Location -Path "backend"

# Or using absolute path:
Set-Location -Path "C:\SIH26246\SkillPulse\backend"
```

### 2. Create a Virtual Environment

```powershell
python -m venv .venv
```

### 3. Activate the Virtual Environment

If PowerShell blocks script execution (`ScriptExecution`), allow it for the current process:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

Then activate the virtual environment:
```powershell
.\.venv\Scripts\Activate.ps1
```

Once activated, your command prompt will be prefixed with `(.venv)`.

### 4. Install Minimum Dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Run the Backend Server

Start the FastAPI application with auto-reload:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Alternative run command directly with Python:
```powershell
python app/main.py
```

---

## Verifying Endpoints

Once the server is running, verify the API in a new PowerShell window or web browser:

### 1. Root Endpoint (`GET /`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get
```
**Expected Response:**
```json
{
  "project": "SkillPulse LMIS",
  "description": "AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine",
  "version": "0.1.0"
}
```

### 2. Health Endpoint (`GET /health`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get
```
**Expected Response:**
```json
{
  "status": "healthy"
}
```

### 3. Demand Index Endpoint (`GET /api/v1/demand-index`)
```powershell
# Get top 3 ranked occupations across all districts for latest month (2026-09)
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/demand-index?limit=3" -Method Get

# Filter by state and sector
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/demand-index?state_code=MH&sector=Manufacturing" -Method Get
```

### 4. Relative Demand-Supply Gap Analysis Endpoint (`GET /api/v1/gap-analysis`)
```powershell
# Get top 3 largest relative demand-supply mismatch records for latest month (2026-09)
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/gap-analysis?limit=3" -Method Get

# Filter by high Demand Pressure alerts only
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/gap-analysis?classification=Demand+Pressure&limit=5" -Method Get
```

### 5. Interactive API Documentation (Swagger UI)
Visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser.
Interactive ReDoc is also available at [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc).

---

## Running Automated Tests

Run the comprehensive test suite verifying demand index calculations, percentile normalization, weight re-normalization, and API endpoints:

```powershell
pytest -v
```
