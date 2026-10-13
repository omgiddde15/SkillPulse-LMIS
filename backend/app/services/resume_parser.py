"""Resume parsing and text extraction service for SkillPulse.

Implements secure PDF text extraction using pypdf, format and magic header validation,
conservative heuristic extraction of candidate metadata, and bounded skill discovery.
No external AI or third-party OCR services are invoked.
"""

import io
import re
from typing import Dict, Any, List, Optional
from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MiB
MAX_PAGE_COUNT = 10
MAX_EXTRACTED_CHARS = 50000

# Regular expressions for contact and metadata extraction
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PHONE_PATTERN = re.compile(r"(?:\+?91[\s\-]?)?[6-9]\d{9}\b|\b(?:\d{3}[-.\s]?){2}\d{4}\b")
YEAR_PATTERN = re.compile(r"\b(19[89]\d|20[0-3]\d)\b")

# Degree keywords ordered by specificity
DEGREE_KEYWORDS = [
    ("B.Tech", "B.Tech / B.E. (Bachelor of Technology / Engineering)"),
    ("Bachelor of Technology", "B.Tech / B.E. (Bachelor of Technology / Engineering)"),
    ("B.E.", "B.Tech / B.E. (Bachelor of Technology / Engineering)"),
    ("M.Tech", "M.Tech / M.E. (Master of Technology / Engineering)"),
    ("Master of Technology", "M.Tech / M.E. (Master of Technology / Engineering)"),
    ("BCA", "BCA (Bachelor of Computer Applications)"),
    ("MCA", "MCA (Master of Computer Applications)"),
    ("Diploma", "Polytechnic / Vocational Diploma"),
    ("ITI", "ITI (Industrial Training Institute)"),
    ("B.Sc", "B.Sc (Bachelor of Science)"),
    ("M.Sc", "M.Sc (Master of Science)"),
    ("B.Com", "B.Com (Bachelor of Commerce)"),
    ("MBA", "MBA (Master of Business Administration)"),
    ("Higher Secondary", "Higher Secondary (12th Grade)"),
    ("12th", "Higher Secondary (12th Grade)"),
    ("10th", "Secondary School (10th Grade)"),
]

# Bounded skill keyword dictionary categorized by industry
SKILL_DICTIONARY = [
    # IT/ITeS
    "Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "React", "Angular",
    "Vue", "Node.js", "Express", "Django", "FastAPI", "Flask", "SQL", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "Cloud Computing", "Linux", "Git", "GitHub", "CI/CD", "REST API", "HTML", "CSS",
    "Tailwind", "Machine Learning", "Data Analysis", "Pandas", "NumPy", "TensorFlow", "PyTorch",
    # Manufacturing & Engineering
    "CNC", "CNC Programming", "CNC Turning", "CNC Milling", "CAD", "CAM", "AutoCAD",
    "SolidWorks", "CATIA", "PLC", "SCADA", "Mechatronics", "Lathe", "Milling",
    "Industrial Automation", "Lean Manufacturing", "Six Sigma", "Quality Assurance",
    "Quality Control", "Welding", "Fabrication", "Assembly", "Pneumatics", "Hydraulics",
    "Electric Vehicle", "Automotive Assembly", "HVAC", "Precision Machining",
    # Logistics & Supply Chain
    "Supply Chain", "Supply Chain Management", "Inventory Management", "Warehouse Operations",
    "Logistics", "Cold Chain", "Fleet Management", "Fleet Dispatch", "ERP", "SAP",
    "Procurement", "Freight Forwarding", "Dispatch", "Route Planning", "Route Optimization",
    "Vendor Management", "Materials Handling", "Distribution",
    # Professional competencies
    "Problem Solving", "Communication", "Team Leadership", "Project Management", "Agile", "Scrum"
]


class ResumeParsingError(ValueError):
    """Domain exception raised when PDF validation or text extraction fails."""
    pass


def validate_pdf_bytes(content: bytes) -> None:
    """Validates file size and PDF magic bytes signature."""
    if not content or len(content) == 0:
        raise ResumeParsingError("Uploaded file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise ResumeParsingError(f"File size exceeds the 5 MiB limit (received {len(content) / (1024 * 1024):.2f} MiB).")

    # Check PDF magic header %PDF-
    if not content.startswith(b"%PDF-"):
        raise ResumeParsingError("Invalid file signature. The uploaded file is not a valid PDF document.")


def extract_text_from_pdf(content: bytes) -> tuple[str, int]:
    """Extracts raw text from a PDF buffer using pypdf.
    
    Returns:
        tuple of (extracted_text, page_count)
    """
    validate_pdf_bytes(content)

    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise ResumeParsingError(f"Unable to parse PDF document. The file may be corrupted or malformed.")

    if reader.is_encrypted:
        raise ResumeParsingError("Encrypted or password-protected PDFs are not supported. Please remove the password and try again.")

    page_count = len(reader.pages)
    if page_count == 0:
        raise ResumeParsingError("The uploaded PDF document contains no pages.")

    if page_count > MAX_PAGE_COUNT:
        raise ResumeParsingError(f"PDF document exceeds the maximum limit of {MAX_PAGE_COUNT} pages (received {page_count} pages).")

    extracted_pages = []
    total_chars = 0

    for idx, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
            extracted_pages.append(page_text)
            total_chars += len(page_text)
            if total_chars > MAX_EXTRACTED_CHARS:
                break
        except Exception:
            continue

    full_text = "\n".join(extracted_pages).strip()

    # Verify if text was actually extracted (not a scanned image)
    cleaned_sample = re.sub(r"\s+", "", full_text)
    if len(cleaned_sample) < 30:
        raise ResumeParsingError(
            "Scanned or image-only PDFs are not supported yet. "
            "Please upload a digital, text-based PDF resume with selectable text."
        )

    return full_text[:MAX_EXTRACTED_CHARS], page_count


def extract_candidate_name(text: str) -> Optional[str]:
    """Heuristically extracts candidate name from the top section of resume text."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    ignore_words = {
        "resume", "curriculum", "vitae", "cv", "bio-data", "biodata", "profile",
        "contact", "education", "experience", "skills", "summary", "objective"
    }

    # Inspect top 6 lines
    for line in lines[:6]:
        cleaned = re.sub(r"[^A-Za-z\s\.]", "", line).strip()
        words = cleaned.split()
        if 2 <= len(words) <= 4:
            if not any(w.lower() in ignore_words for w in words):
                # Ensure each word starts with uppercase
                if all(w[0].isupper() for w in words if len(w) > 1):
                    return cleaned

    return None


def extract_contact_info(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extracts email address and phone number from resume text."""
    email_match = EMAIL_PATTERN.search(text)
    email = email_match.group(0).lower() if email_match else None

    phone_match = PHONE_PATTERN.search(text)
    phone = phone_match.group(0).strip() if phone_match else None

    return email, phone


def extract_education_details(text: str) -> tuple[Optional[str], Optional[str], Optional[int]]:
    """Extracts education qualification level, institution name, and graduation year."""
    education_level = None
    institution = None
    graduation_year = None

    # Detect degree
    for keyword, label in DEGREE_KEYWORDS:
        pattern = r"\b" + re.escape(keyword) + r"\b"
        if re.search(pattern, text, re.IGNORECASE):
            education_level = label
            break

    # Detect graduation year near education keywords
    edu_section_match = re.search(r"(?:education|qualification|academics|degree)[\s\S]{1,400}", text, re.IGNORECASE)
    search_context = edu_section_match.group(0) if edu_section_match else text

    years = YEAR_PATTERN.findall(search_context)
    if years:
        # Pick the most recent sensible graduation year
        valid_years = [int(y) for y in years if 1990 <= int(y) <= 2030]
        if valid_years:
            graduation_year = max(valid_years)

    # Detect institution name
    inst_keywords = ["university", "institute", "college", "polytechnic", "school of", "academy", "iit", "nit", "bits"]
    lines = text.split("\n")
    for line in lines:
        lower_line = line.lower()
        if any(ik in lower_line for ik in inst_keywords):
            clean_inst = line.strip()
            if 4 <= len(clean_inst) <= 100:
                institution = clean_inst
                break

    return education_level, institution, graduation_year


def extract_skills(text: str) -> List[str]:
    """Matches text against the bounded skill vocabulary."""
    detected = []
    text_lower = f" {text.lower()} "

    for skill in SKILL_DICTIONARY:
        # Regex boundary search
        escaped_skill = re.escape(skill.lower())
        pattern = rf"(?<![a-zA-Z0-9_]){escaped_skill}(?![a-zA-Z0-9_])"
        if re.search(pattern, text_lower):
            detected.append(skill)

    return detected


def extract_experience_snippets(text: str) -> tuple[Optional[float], Optional[str], Optional[str]]:
    """Extracts approximate experience years and brief section summaries."""
    # Look for patterns like "X years of experience"
    exp_years = None
    exp_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience", text, re.IGNORECASE)
    if exp_match:
        try:
            val = float(exp_match.group(1))
            if 0.0 <= val <= 40.0:
                exp_years = val
        except ValueError:
            pass

    # Extract Experience section snippet
    exp_snippet = None
    exp_sec = re.search(r"(?:work\s+experience|professional\s+experience|employment\s+history|experience)[\s\S]{1,500}", text, re.IGNORECASE)
    if exp_sec:
        snippet_lines = exp_sec.group(0).split("\n")[1:6]
        snippet_text = " ".join([l.strip() for l in snippet_lines if l.strip()])
        if snippet_text:
            exp_snippet = snippet_text[:400]

    # Extract Projects section snippet
    proj_snippet = None
    proj_sec = re.search(r"(?:academic\s+projects|key\s+projects|projects)[\s\S]{1,500}", text, re.IGNORECASE)
    if proj_sec:
        proj_lines = proj_sec.group(0).split("\n")[1:6]
        proj_text = " ".join([l.strip() for l in proj_lines if l.strip()])
        if proj_text:
            proj_snippet = proj_text[:400]

    return exp_years, exp_snippet, proj_snippet


def parse_resume_content(content: bytes) -> Dict[str, Any]:
    """High-level orchestration function to extract structured data from a PDF buffer."""
    text, page_count = extract_text_from_pdf(content)

    name = extract_candidate_name(text)
    email, phone = extract_contact_info(text)
    edu_level, institution, grad_year = extract_education_details(text)
    skills = extract_skills(text)
    exp_years, exp_summary, proj_summary = extract_experience_snippets(text)

    return {
        "candidate_name": name,
        "email": email,
        "phone": phone,
        "education_level": edu_level,
        "institution": institution,
        "graduation_year": grad_year,
        "detected_skills": skills,
        "experience_years": exp_years,
        "experience_summary": exp_summary,
        "projects_summary": proj_summary,
        "page_count": page_count,
        "extraction_note": "Extracted via rule-based heuristic parsing. Please review and confirm your details."
    }
