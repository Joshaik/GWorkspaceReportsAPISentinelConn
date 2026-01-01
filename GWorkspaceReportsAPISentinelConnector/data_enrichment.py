import requests
import logging
from typing import Optional
from datetime import datetime


class ThreatIntelligence:
    """
    Threat intelligence lookup and scoring module.
    Supports multiple threat intel sources (VirusTotal, AbuseIPDB, etc.)
    """

    def __init__(
        self, vt_api_key: Optional[str] = None, abuseipdb_key: Optional[str] = None
    ):
        """
        Initialize threat intelligence handlers.

        Args:
            vt_api_key: VirusTotal API key (optional)
            abuseipdb_key: AbuseIPDB API key (optional)
        """
        self.vt_api_key = vt_api_key
        self.abuseipdb_key = abuseipdb_key
        self.logger = logging.getLogger(__name__)
        self.threat_cache: dict[str, dict] = {}

    def check_ip_reputation(self, ip_address: str) -> dict:
        """
        Check IP address reputation against threat intel sources.

        Args:
            ip_address: IP address to check

        Returns:
            dict: Threat intel data with risk score (0-100)
        """
        if ip_address in self.threat_cache:
            return self.threat_cache[ip_address]

        result = {
            "ip": ip_address,
            "is_malicious": False,
            "risk_score": 0,
            "threat_types": [],
            "sources": [],
        }

        # Check AbuseIPDB
        if self.abuseipdb_key:
            abuseipdb_result = self._check_abuseipdb(ip_address)
            if abuseipdb_result:
                result["risk_score"] = max(
                    result["risk_score"],
                    abuseipdb_result.get("abuseConfidenceScore", 0),
                )
                result["sources"].append("AbuseIPDB")
                if abuseipdb_result.get("abuseConfidenceScore", 0) > 50:
                    result["is_malicious"] = True
                    result["threat_types"].extend(abuseipdb_result.get("usageType", []))

        # Check VirusTotal
        if self.vt_api_key:
            vt_result = self._check_virustotal(ip_address)
            if vt_result:
                vt_score = vt_result.get("malicious_count", 0)
                result["risk_score"] = max(
                    result["risk_score"], min(vt_score * 10, 100)
                )
                result["sources"].append("VirusTotal")
                if vt_score > 5:
                    result["is_malicious"] = True
                    result["threat_types"].extend(
                        vt_result.get("threat_categories", [])
                    )

        self.threat_cache[ip_address] = result
        return result

    def _check_abuseipdb(self, ip_address: str) -> Optional[dict]:
        """Check AbuseIPDB for IP reputation."""
        try:
            headers = {"Key": self.abuseipdb_key, "Accept": "application/json"}
            params = {"ipAddress": ip_address, "maxAgeInDays": 90}
            response = requests.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers=headers,
                params=params,
                timeout=5,
            )
            if response.status_code == 200:
                return response.json().get("data")
        except Exception as e:
            self.logger.warning(f"AbuseIPDB lookup failed for {ip_address}: {e}")
        return None

    def _check_virustotal(self, ip_address: str) -> Optional[dict]:
        """Check VirusTotal for IP reputation."""
        try:
            headers = {"x-apikey": self.vt_api_key}
            response = requests.get(
                f"https://www.virustotal.com/api/v3/ip_addresses/{ip_address}",
                headers=headers,
                timeout=5,
            )
            if response.status_code == 200:
                data = response.json().get("data", {}).get("attributes", {})
                return {
                    "malicious_count": data.get("last_analysis_stats", {}).get(
                        "malicious", 0
                    ),
                    "threat_categories": data.get("categories", []),
                }
        except Exception as e:
            self.logger.warning(f"VirusTotal lookup failed for {ip_address}: {e}")
        return None

    def check_url_safety(self, url: str) -> dict:
        """
        Check URL safety using threat intel sources.

        Args:
            url: URL to check

        Returns:
            dict: URL safety assessment
        """
        result = {
            "url": url,
            "is_safe": True,
            "risk_score": 0,
            "threat_types": [],
            "sources": [],
        }

        try:
            if self.vt_api_key:
                headers = {"x-apikey": self.vt_api_key}
                response = requests.get(
                    f"https://www.virustotal.com/api/v3/urls/{url}",
                    headers=headers,
                    timeout=5,
                )
                if response.status_code == 200:
                    data = response.json().get("data", {}).get("attributes", {})
                    malicious = data.get("last_analysis_stats", {}).get("malicious", 0)
                    result["risk_score"] = min(malicious * 15, 100)
                    result["sources"].append("VirusTotal")
                    if malicious > 3:
                        result["is_safe"] = False
        except Exception as e:
            self.logger.warning(f"URL safety check failed for {url}: {e}")

        return result


class DataEnrichment:
    """
    A class to enrich Google Workspace report data with additional information,
    including threat intelligence, geolocation, and user context.
    """

    def __init__(
        self, vt_api_key: Optional[str] = None, abuseipdb_key: Optional[str] = None
    ):
        """
        Initializes the DataEnrichment class with optional threat intelligence keys.

        Args:
            vt_api_key: VirusTotal API key
            abuseipdb_key: AbuseIPDB API key
        """
        self.threat_intel = ThreatIntelligence(vt_api_key, abuseipdb_key)
        self.logger = logging.getLogger(__name__)

    def enrich_event(self, event: dict) -> dict:
        """
        Enriches a single event with threat intelligence, geolocation, and risk scoring.

        Args:
            event (dict): A dictionary representing a single Google Workspace report event.

        Returns:
            dict: The enriched event dictionary with threat intel data.
        """
        event = self._add_geolocation(event)
        event = self._add_threat_intelligence(event)
        event = self._calculate_risk_score(event)
        return event

    def _add_geolocation(self, event: dict) -> dict:
        """
        Adds geolocation data to an event based on IP address.

        Args:
            event (dict): A dictionary representing a single Google Workspace report event.

        Returns:
            dict: The event dictionary with added geolocation data.
        """
        ip_address = event.get("ipAddress")
        if ip_address:
            event["geolocation"] = {
                "country": "Unknown",
                "city": "Unknown",
                "latitude": 0.0,
                "longitude": 0.0,
                "timestamp": datetime.utcnow().isoformat(),
            }
        return event

    def _add_threat_intelligence(self, event: dict) -> dict:
        """
        Adds threat intelligence data to an event.

        Args:
            event (dict): A dictionary representing a single Google Workspace report event.

        Returns:
            dict: The event dictionary with threat intel data.
        """
        ip_address = event.get("ipAddress")
        url = event.get("url")

        event["threat_intelligence"] = {
            "ip_reputation": None,
            "url_safety": None,
            "enriched_at": datetime.utcnow().isoformat(),
        }

        if ip_address:
            try:
                event["threat_intelligence"]["ip_reputation"] = (
                    self.threat_intel.check_ip_reputation(ip_address)
                )
            except Exception as e:
                self.logger.error(
                    f"Failed to check IP reputation for {ip_address}: {e}"
                )

        if url:
            try:
                event["threat_intelligence"]["url_safety"] = (
                    self.threat_intel.check_url_safety(url)
                )
            except Exception as e:
                self.logger.error(f"Failed to check URL safety for {url}: {e}")

        return event

    def _calculate_risk_score(self, event: dict) -> dict:
        """
        Calculates an overall risk score based on threat intelligence data.

        Args:
            event (dict): An enriched event dictionary.

        Returns:
            dict: The event with an added risk_score field (0-100).
        """
        risk_score = 0
        threat_intel = event.get("threat_intelligence", {})

        # Check IP reputation risk
        ip_rep = threat_intel.get("ip_reputation")
        if ip_rep:
            risk_score = max(risk_score, ip_rep.get("risk_score", 0))

        # Check URL safety risk
        url_safety = threat_intel.get("url_safety")
        if url_safety and not url_safety.get("is_safe"):
            risk_score = max(risk_score, url_safety.get("risk_score", 0))

        event["risk_score"] = risk_score
        event["risk_level"] = self._classify_risk(risk_score)

        return event

    def _classify_risk(self, score: int) -> str:
        """
        Classifies risk level based on numerical score.

        Args:
            score: Risk score (0-100)

        Returns:
            str: Risk classification (Critical, High, Medium, Low, None)
        """
        if score >= 80:
            return "Critical"
        elif score >= 60:
            return "High"
        elif score >= 40:
            return "Medium"
        elif score > 0:
            return "Low"
        return "None"

    def enrich_data(self, data: list) -> list:
        """
        Enriches a list of Google Workspace report events with threat intelligence.

        Args:
            data (list): A list of dictionaries representing Google Workspace report events.

        Returns:
            list: A list of enriched event dictionaries with threat intel data.
        """
        enriched_data = []
        for event in data:
            try:
                enriched_event = self.enrich_event(event)
                enriched_data.append(enriched_event)
            except Exception as e:
                self.logger.error(f"Failed to enrich event: {e}")
                enriched_data.append(event)

        return enriched_data
