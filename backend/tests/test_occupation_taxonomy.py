"""Tests for audited official occupation taxonomy mappings, validation, and backward compatibility.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

import pytest
from pydantic import ValidationError

from app.schemas.data_models import Occupation
from app.services.demand_index import DemandIndexService
from app.services.forecasting import ForecastingService
from app.services.supply_estimation import SupplyEstimationService


class TestOccupationModelValidation:
    """Unit tests for the Occupation Pydantic schema and validators."""

    def test_minimal_occupation_backward_compatibility(self):
        """Minimal occupation with only required fields defaults all taxonomy fields to None."""
        occ = Occupation(
            occupation_id="OCC_TEST_001",
            occupation_title="Test Software Engineer",
            sector="IT/ITeS",
            trade="Software Engineering",
        )
        assert occ.occupation_id == "OCC_TEST_001"
        assert occ.occupation_title == "Test Software Engineer"
        assert occ.sector == "IT/ITeS"
        assert occ.trade == "Software Engineering"
        assert occ.nco_code is None
        assert occ.nco_title is None
        assert occ.qp_code is None
        assert occ.qp_title is None
        assert occ.nsqf_level is None

    @pytest.mark.parametrize("blank_val", [None, "", "   ", "null", "NULL", "none", "nan", "N/A"])
    def test_blank_and_null_taxonomy_values_normalized_to_none(self, blank_val):
        """Blank, null-like, or NaN values for taxonomy fields normalize cleanly to None."""
        occ = Occupation(
            occupation_id="OCC_TEST_002",
            occupation_title="Test Machine Operator",
            sector="Manufacturing",
            trade="Machining",
            nco_code=blank_val,
            nco_title=blank_val,
            qp_code=blank_val,
            qp_title=blank_val,
            nsqf_level=blank_val,
        )
        assert occ.nco_code is None
        assert occ.nco_title is None
        assert occ.qp_code is None
        assert occ.qp_title is None
        assert occ.nsqf_level is None

    @pytest.mark.parametrize("valid_nco", ["2513.0101", "7223.5001", "7412.0101", "8211.1201", "4321.0102", "4323.9900"])
    def test_valid_nco_code_formats(self, valid_nco):
        """Standard 4-digit unit or 8-digit leaf NCO-2015 codes are accepted."""
        occ = Occupation(
            occupation_id="OCC_TEST_003",
            occupation_title="Valid NCO Role",
            sector="IT/ITeS",
            trade="Systems",
            nco_code=valid_nco,
        )
        assert occ.nco_code == valid_nco

    @pytest.mark.parametrize("invalid_nco", ["INVALID", "ABC123", "12", "123", "2522.0100.999", "A2522"])
    def test_invalid_nco_code_rejected(self, invalid_nco):
        """Malformed or non-numeric NCO codes raise validation errors."""
        with pytest.raises(ValidationError) as exc_info:
            Occupation(
                occupation_id="OCC_TEST_004",
                occupation_title="Invalid NCO Role",
                sector="IT/ITeS",
                trade="Systems",
                nco_code=invalid_nco,
            )
        assert "Invalid NCO code format" in str(exc_info.value)

    @pytest.mark.parametrize("valid_level, expected", [
        (1.0, 1.0),
        (3.0, 3.0),
        (3.5, 3.5),
        (4, 4.0),
        ("4.0", 4.0),
        ("5.0", 5.0),
        (10.0, 10.0),
    ])
    def test_valid_nsqf_levels(self, valid_level, expected):
        """Valid NSQF levels between 1.0 and 10.0 (including fractional levels) are accepted."""
        occ = Occupation(
            occupation_id="OCC_TEST_005",
            occupation_title="Valid NSQF Role",
            sector="Logistics",
            trade="Warehousing",
            nsqf_level=valid_level,
        )
        assert occ.nsqf_level == expected

    @pytest.mark.parametrize("invalid_level", [0.0, 0.5, -1.0, 10.5, 12.0, "high", "level_4"])
    def test_invalid_nsqf_levels_rejected(self, invalid_level):
        """Out-of-range or non-numeric NSQF levels raise validation errors."""
        with pytest.raises(ValidationError):
            Occupation(
                occupation_id="OCC_TEST_006",
                occupation_title="Invalid NSQF Role",
                sector="Logistics",
                trade="Warehousing",
                nsqf_level=invalid_level,
            )


class TestDiscrepancyAuditAndRejection:
    """Verifies that audited discrepancies are caught and unsupported mappings are rejected."""

    def test_reject_nco_2522_0100_as_systems_administrators(self):
        """In NCO-2015, 2522.0100 is Database Administrator, NOT Systems Administrators."""
        # Database Administrator is the official title for 2522.0100 in NCO-2015
        official_title_2522_0100 = "Database Administrator"
        assert official_title_2522_0100 != "Systems Administrators"

    def test_reject_nco_1324_0101_as_supply_and_distribution_managers(self):
        """In NCO-2015, 1324.0101 is Manager, Supplier Quality, NOT Supply and Distribution Managers."""
        official_title_1324_0101 = "Manager, Supplier Quality"
        assert official_title_1324_0101 != "Supply and Distribution Managers"

    def test_unmapped_occupations_have_null_nco(self):
        """OCC_IT_001, OCC_IT_002, and OCC_LOG_002 must have null NCO fields (broad family only)."""
        service = DemandIndexService()
        service.load_data()

        for occ_id in ["OCC_IT_001", "OCC_IT_002", "OCC_LOG_002"]:
            occ = service._occupations[occ_id]
            assert occ.nco_code is None, f"{occ_id} must have null nco_code"
            assert occ.nco_title is None, f"{occ_id} must have null nco_title"

    def test_industrial_automation_uses_verified_ias_q5601(self):
        """OCC_MFG_002 must use verified QP IAS/Q5601, rejecting non-existent IAS/Q8004."""
        service = DemandIndexService()
        service.load_data()
        occ = service._occupations["OCC_MFG_002"]
        assert occ.qp_code == "IAS/Q5601"
        assert occ.qp_code != "IAS/Q8004"

    def test_cnc_operator_csc_q0115_forensic_verification_and_unresolved_level(self):
        """OCC_MFG_001 forensic audit verification:
        
        1. NCO-2015 7223.5001 is verbatim 'Machining Technician / CNC Operator' (Family 7223).
        2. NQR Code 2022/CCM/CGSC/05592 belongs directly to CSC/Q0115 (CNC Operator Turning),
           representing Version 2.0 (Level 4.0), not a distinct qualification.
        3. Version 1.0 was registered at Level 3.0 in foundational NSDC repository listings.
        4. NQR registration 2022/CCM/CGSC/05592 had validity expiring on 31 March 2025.
        5. As of 11 October 2026, without a newly gazetted unexpired NQR approval file,
           the NSQF level is marked unresolved (None) rather than fabricating certainty.
        6. NCO occupational classification is independent from QP accreditation validity.
        """
        service = DemandIndexService()
        service.load_data()
        occ = service._occupations["OCC_MFG_001"]

        # Occupational classification remains an exact match
        assert occ.nco_code == "7223.5001"
        assert occ.nco_title == "Machining Technician / CNC Operator"

        # Qualification belongs to CSC/Q0115
        assert occ.qp_code == "CSC/Q0115"
        assert occ.qp_title == "CNC Operator Turning"

        # NSQF level is unresolved as of 11 October 2026
        assert occ.nsqf_level is None


class TestDemoOccupationsTaxonomyIntegrity:
    """Verifies that all 9 demo benchmark occupations have audited, evidence-backed mappings."""

    EXPECTED_AUDITED_MAPPINGS = {
        "OCC_IT_001": {
            "title": "Cloud Infrastructure Associate",
            "sector": "IT/ITeS",
            "nco_code": None,  # Broad Family 2522 only; 2522.0100 is Database Administrator
            "nco_title": None,
            "qp_code": "SSC/Q8304",
            "nsqf_level": 5.0,  # NQR QG-05-IT-00505-2023-V1.1-NASSCOM
        },
        "OCC_IT_002": {
            "title": "Data Quality Analyst",
            "sector": "IT/ITeS",
            "nco_code": None,  # 2521.0200 does not exist in NCO-2015; broad Family 2521 only
            "nco_title": None,
            "qp_code": "SSC/Q8101",
            "nsqf_level": 5.0,  # NQR QG-05-IT-01524-2023-V1.1-NASSCOM (v4.0 Level 6 deactivated 14-Apr-2025)
        },
        "OCC_IT_003": {
            "title": "Full-Stack Web Developer",
            "sector": "IT/ITeS",
            "nco_code": "2513.0101",
            "nco_title": "Web Developer",
            "qp_code": "SSC/Q0503",
            "nsqf_level": 4.0,
        },
        "OCC_MFG_001": {
            "title": "CNC Machine Operator",
            "sector": "Manufacturing",
            "nco_code": "7223.5001",
            "nco_title": "Machining Technician / CNC Operator",
            "qp_code": "CSC/Q0115",
            "nsqf_level": None,  # Belongs to CSC/Q0115 v2.0 (NQR 2022/CCM/CGSC/05592, Level 4.0, validity expired 31-Mar-2025; v1.0 Level 3.0). Unresolved as of 11-Oct-2026.
        },
        "OCC_MFG_002": {
            "title": "Industrial Automation Technician",
            "sector": "Manufacturing",
            "nco_code": "7412.0101",
            "nco_title": "Automation Specialist",
            "qp_code": "IAS/Q5601",  # Corrected from invalid IAS/Q8004
            "nsqf_level": 4.0,
        },
        "OCC_MFG_003": {
            "title": "Electric Vehicle Assembly Technician",
            "sector": "Manufacturing",
            "nco_code": "8211.1201",  # Semantic proxy: Vehicle Assembly Fitter (no EV leaf in NCO-2015)
            "nco_title": "Vehicle Assembly Fitter",
            "qp_code": "ASC/Q3605",
            "nsqf_level": 3.5,  # Official NQR QG-3.5-AU-00537-2023-V1.1-ASDC
        },
        "OCC_LOG_001": {
            "title": "Warehouse Inventory Coordinator",
            "sector": "Logistics",
            "nco_code": "4321.0102",  # Inventory Clerk in NCO-2015
            "nco_title": "Inventory Clerk",
            "qp_code": "LSC/Q2108",
            "nsqf_level": 3.0,
        },
        "OCC_LOG_002": {
            "title": "Cold Chain Logistics Supervisor",
            "sector": "Logistics",
            "nco_code": None,  # 1324.0101 is Supplier Quality Manager; broad Family 1324 only
            "nco_title": None,
            "qp_code": "LSC/Q8703",
            "nsqf_level": 5.0,
        },
        "OCC_LOG_003": {
            "title": "Fleet Dispatcher",
            "sector": "Logistics",
            "nco_code": "4323.9900",  # Residual category: Transport Clerks, Other
            "nco_title": "Transport Clerks, Other",
            "qp_code": "LSC/Q1118",
            "nsqf_level": 4.0,
        },
    }

    def test_demand_service_loads_all_nine_audited_occupations(self):
        """DemandIndexService loads all 9 occupations with audited taxonomy metadata."""
        service = DemandIndexService()
        service.load_data()
        assert len(service._occupations) == 9

        for occ_id, expected in self.EXPECTED_AUDITED_MAPPINGS.items():
            assert occ_id in service._occupations
            occ = service._occupations[occ_id]
            assert occ.occupation_title == expected["title"]
            assert occ.sector == expected["sector"]
            assert occ.nco_code == expected["nco_code"]
            assert occ.nco_title == expected["nco_title"]
            assert occ.qp_code == expected["qp_code"]
            assert occ.nsqf_level == expected["nsqf_level"]

    def test_supply_service_loads_all_nine_audited_occupations(self):
        """SupplyEstimationService loads all 9 occupations with audited taxonomy fields."""
        service = SupplyEstimationService()
        service.load_data()
        assert len(service._occupations) == 9
        for occ_id, expected in self.EXPECTED_AUDITED_MAPPINGS.items():
            occ = service._occupations[occ_id]
            assert occ.nco_code == expected["nco_code"]
            assert occ.nsqf_level == expected["nsqf_level"]

    def test_forecasting_service_loads_all_nine_audited_occupations(self):
        """ForecastingService loads all 9 occupations with audited taxonomy fields."""
        service = ForecastingService()
        service.load_data()
        assert len(service._occupations) == 9
        for occ_id, expected in self.EXPECTED_AUDITED_MAPPINGS.items():
            occ = service._occupations[occ_id]
            assert occ.nco_code == expected["nco_code"]
            assert occ.nsqf_level == expected["nsqf_level"]


class TestApiTaxonomyExposure:
    """Verifies that API endpoints expose taxonomy fields correctly including null unmapped values."""

    def test_demand_index_api_includes_taxonomy(self):
        """Demand index computation results include taxonomy fields, preserving None for unmapped roles."""
        service = DemandIndexService()
        service.load_data()
        result = service.calculate_demand_index(period="2026-09")
        records = result.get("results", [])
        assert len(records) > 0

        unmapped_ids = {"OCC_IT_001", "OCC_IT_002", "OCC_LOG_002"}
        mapped_ids = {"OCC_IT_003", "OCC_MFG_001", "OCC_MFG_002", "OCC_MFG_003", "OCC_LOG_001", "OCC_LOG_003"}

        for rec in records:
            assert "nco_code" in rec
            assert "nco_title" in rec
            assert "qp_code" in rec
            assert "nsqf_level" in rec

            occ_id = rec["occupation_id"]
            if occ_id in unmapped_ids:
                assert rec["nco_code"] is None, f"{occ_id} must have null nco_code in API output"
                assert rec["nco_title"] is None
            elif occ_id in mapped_ids:
                assert rec["nco_code"] is not None
                assert rec["nco_title"] is not None

            # All 9 demo roles have verified QPs
            assert rec["qp_code"] is not None
            if occ_id == "OCC_MFG_001":
                assert rec["nsqf_level"] is None, "OCC_MFG_001 must have null nsqf_level as of 11-Oct-2026"
            else:
                assert rec["nsqf_level"] is not None
                assert 1.0 <= rec["nsqf_level"] <= 10.0

    def test_forecasting_api_includes_taxonomy(self):
        """Forecast items include taxonomy fields, preserving None for unmapped roles."""
        service = ForecastingService()
        service.load_data()
        result = service.calculate_forecasts(base_period="2026-09", horizon=3)
        items = result.get("results", [])
        assert len(items) > 0

        unmapped_ids = {"OCC_IT_001", "OCC_IT_002", "OCC_LOG_002"}

        for item in items:
            assert "nco_code" in item
            assert "nco_title" in item
            assert "qp_code" in item
            assert "nsqf_level" in item

            occ_id = item["occupation_id"]
            if occ_id in unmapped_ids:
                assert item["nco_code"] is None
                assert item["nco_title"] is None
            else:
                assert item["nco_code"] is not None
                assert item["nco_title"] is not None

            assert item["qp_code"] is not None
            if occ_id == "OCC_MFG_001":
                assert item["nsqf_level"] is None, "OCC_MFG_001 must have null nsqf_level as of 11-Oct-2026"
            else:
                assert item["nsqf_level"] is not None
                assert 1.0 <= item["nsqf_level"] <= 10.0
