import sys
import os

# Make project root importable for tests
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# Add package dir directly to sys.path to avoid importing top-level package __init__
MODULE_DIR = os.path.join(ROOT, "GWorkspaceReportsAPISentinelConnector")
if MODULE_DIR not in sys.path:
    sys.path.insert(0, MODULE_DIR)

from data_enrichment import ThreatIntelligence, DataEnrichment  # noqa: E402


def test_check_ip_reputation_abuseipdb(requests_mock):
    ip = "1.2.3.4"
    requests_mock.get(
        "https://api.abuseipdb.com/api/v2/check",
        json={"data": {"abuseConfidenceScore": 70, "usageType": ["Malware"]}},
    )

    ti = ThreatIntelligence(abuseipdb_key="fake")

    res = ti.check_ip_reputation(ip)

    assert res["ip"] == ip
    assert res["risk_score"] == 70
    assert res["is_malicious"] is True
    assert "AbuseIPDB" in res["sources"]


def test_check_ip_reputation_virustotal(requests_mock):
    ip = "1.2.3.4"
    requests_mock.get(
        f"https://www.virustotal.com/api/v3/ip_addresses/{ip}",
        json={
            "data": {
                "attributes": {
                    "last_analysis_stats": {"malicious": 6},
                    "categories": {"malware": "malicious"},
                }
            }
        },
    )

    ti = ThreatIntelligence(vt_api_key="fake")
    res = ti.check_ip_reputation(ip)

    assert res["risk_score"] == 60  # 6 * 10
    assert res["is_malicious"] is True
    assert "VirusTotal" in res["sources"]


def test_check_url_safety_virustotal(requests_mock):
    url = "http://example.com"
    requests_mock.get(
        f"https://www.virustotal.com/api/v3/urls/{url}",
        json={"data": {"attributes": {"last_analysis_stats": {"malicious": 4}}}},
    )

    ti = ThreatIntelligence(vt_api_key="fake")
    res = ti.check_url_safety(url)

    assert res["risk_score"] == 60  # 4 * 15
    assert res["is_safe"] is False
    assert "VirusTotal" in res["sources"]


def test_caching_abuseipdb(requests_mock):
    ip = "5.6.7.8"
    requests_mock.get(
        "https://api.abuseipdb.com/api/v2/check",
        json={"data": {"abuseConfidenceScore": 30}},
    )

    ti = ThreatIntelligence(abuseipdb_key="fake")
    first = ti.check_ip_reputation(ip)
    second = ti.check_ip_reputation(ip)

    # request should only have been made once
    assert len(requests_mock.request_history) == 1
    assert first == second


def test_data_enrichment_enrich_event(monkeypatch):
    de = DataEnrichment()

    # monkeypatch the threat intel calls to avoid external HTTP
    def fake_check_ip(ip):
        return {"ip": ip, "risk_score": 85, "is_malicious": True, "sources": ["Mock"]}

    monkeypatch.setattr(de.threat_intel, "check_ip_reputation", fake_check_ip)

    event = {"ipAddress": "9.9.9.9"}
    enriched = de.enrich_event(event)

    assert "threat_intelligence" in enriched
    assert enriched["risk_score"] == 85
    assert enriched["risk_level"] == "Critical"
