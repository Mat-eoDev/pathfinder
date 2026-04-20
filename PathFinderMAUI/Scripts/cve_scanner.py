#!/usr/bin/env python3
"""
CVE Scanner Module - Détection de vulnérabilités CVE

Stratégie :
  1. Source LIVE (NVD + CIRCL) via `cve_live.py` avec cache local 24h.
     -> les CVE publiées chaque jour sont donc toujours incluses.
  2. Fallback HORS LIGNE : petite base embarquée (historique) si la source
     live est indisponible (pas de réseau, NVD down, rate-limit, etc.).

API publique conservée (compat avec network_scanner.py) :
  - extract_version(banner, service)
  - scan_cve_for_banner(banner, service, port)
  - analyze_service_vulnerabilities(host_data)
  - scan_host_cves(ip, banners)
"""

import re
import json
import os
from typing import Dict, List, Tuple

try:
    from cve_live import (
        lookup_cves_from_banner,
        extract_product_version,
        normalize_product,
    )
    LIVE_AVAILABLE = True
except Exception:
    LIVE_AVAILABLE = False

# Mode force offline (utile pour tests et environnements sans internet).
_FORCE_OFFLINE = os.getenv("PATHFINDER_CVE_OFFLINE", "0") == "1"


# ---------------------------------------------------------------------------
# Fallback offline : petite base embarquée pour les services les plus courants.
# Sert uniquement si la source live est indisponible.
# ---------------------------------------------------------------------------

CVE_DATABASE = {
    "mysql": [
        {"version_range": ["5.7.0", "5.7.32"], "cve": "CVE-2021-2022", "severity": "CRITICAL", "cvss": 9.8,
         "description": "SQL Injection via username", "exploit": "Available"},
        {"version_range": ["5.6.0", "5.6.50"], "cve": "CVE-2020-14765", "severity": "HIGH", "cvss": 7.5,
         "description": "Denial of Service vulnerability", "exploit": "POC Available"},
    ],
    "apache": [
        {"version_range": ["2.4.0", "2.4.49"], "cve": "CVE-2021-41773", "severity": "CRITICAL", "cvss": 9.8,
         "description": "Path Traversal & Remote Code Execution", "exploit": "Exploit Public"},
        {"version_range": ["2.4.0", "2.4.48"], "cve": "CVE-2021-40438", "severity": "CRITICAL", "cvss": 9.0,
         "description": "SSRF vulnerability in mod_proxy", "exploit": "Available"},
    ],
    "nginx": [
        {"version_range": ["1.0.0", "1.20.0"], "cve": "CVE-2021-23017", "severity": "HIGH", "cvss": 8.1,
         "description": "DNS resolver buffer overflow", "exploit": "Available"},
    ],
    "openssh": [
        {"version_range": ["7.0", "8.5"], "cve": "CVE-2021-28041", "severity": "MEDIUM", "cvss": 5.3,
         "description": "Heap-based buffer overflow", "exploit": "POC"},
        {"version_range": ["1.0", "7.2"], "cve": "CVE-2016-0777", "severity": "HIGH", "cvss": 8.0,
         "description": "Information disclosure", "exploit": "Exploit Public"},
    ],
    "microsoft-iis": [
        {"version_range": ["7.5", "10.0"], "cve": "CVE-2017-7269", "severity": "CRITICAL", "cvss": 9.3,
         "description": "Buffer overflow in WebDAV", "exploit": "Metasploit"},
    ],
    "mongodb": [
        {"version_range": ["3.0", "4.0.5"], "cve": "CVE-2019-2386", "severity": "HIGH", "cvss": 7.5,
         "description": "Unauthorized access", "exploit": "Available"},
    ],
    "redis": [
        {"version_range": ["4.0.0", "5.0.7"], "cve": "CVE-2019-10192", "severity": "HIGH", "cvss": 7.2,
         "description": "Unauthenticated access", "exploit": "Available"},
    ],
    "postgresql": [
        {"version_range": ["9.0", "13.1"], "cve": "CVE-2020-25695", "severity": "HIGH", "cvss": 8.8,
         "description": "Privilege escalation", "exploit": "POC"},
    ],
    "wordpress": [
        {"version_range": ["3.0", "5.8.0"], "cve": "CVE-2021-39201", "severity": "HIGH", "cvss": 7.5,
         "description": "SQL Injection", "exploit": "Available"},
    ],
}

VERSION_PATTERNS = {
    "mysql":          r"MySQL[/\s]+(\d+\.\d+\.\d+)",
    "mariadb":        r"MariaDB[/\s]+(\d+\.\d+\.\d+)",
    "apache":         r"Apache[/\s]+(\d+\.\d+\.\d+)",
    "nginx":          r"nginx[/\s]+(\d+\.\d+\.\d+)",
    "openssh":        r"OpenSSH[_/\s]+(\d+\.\d+)",
    "microsoft-iis":  r"Microsoft-IIS[/\s]+(\d+\.\d+)",
    "redis":          r"Redis[/\s]+(\d+\.\d+\.\d+)",
    "mongodb":        r"MongoDB[/\s]+(\d+\.\d+\.\d+)",
    "postgresql":     r"PostgreSQL[/\s]+(\d+\.\d+)",
}

PORT_SERVICE_MAP = {
    22: "openssh",
    80: "apache",
    443: "apache",
    3306: "mysql",
    5432: "postgresql",
    6379: "redis",
    8080: "apache",
    27017: "mongodb",
}


def extract_version(banner: str, service: str) -> str:
    """Extrait la version du service depuis la bannière."""
    if LIVE_AVAILABLE:
        _, version = extract_product_version(banner)
        if version:
            return version

    banner_lower = banner.lower()
    for service_name, pattern in VERSION_PATTERNS.items():
        if service_name in service.lower() or service_name in banner_lower:
            match = re.search(pattern, banner, re.IGNORECASE)
            if match:
                return match.group(1)

    version_match = re.search(r"(\d+\.\d+(?:\.\d+)?)", banner)
    if version_match:
        return version_match.group(1)
    return ""


def _version_in_range(version: str, version_range: List[str]) -> bool:
    try:
        def parse(v):
            return tuple(int(x) for x in re.findall(r"\d+", v))
        current = parse(version)
        min_ver = parse(version_range[0])
        max_ver = parse(version_range[1])
        return min_ver <= current <= max_ver
    except Exception:
        return False


def _offline_lookup(banner: str, service_name: str, port: int) -> List[Dict]:
    """Base hardcodée utilisée uniquement quand le live est indispo."""
    banner_lower = (banner or "").lower()

    detected_service = None
    for service_key in CVE_DATABASE:
        if service_key in banner_lower or service_key in (service_name or "").lower():
            detected_service = service_key
            break
    if not detected_service and port in PORT_SERVICE_MAP:
        detected_service = PORT_SERVICE_MAP.get(port)
    if not detected_service:
        return []

    version = extract_version(banner, detected_service)
    if not version:
        cves = CVE_DATABASE.get(detected_service, [])
        if cves:
            cve = cves[0]
            return [{
                "cve_id": cve["cve"],
                "severity": cve["severity"],
                "cvss_score": cve["cvss"],
                "description": f"Version inconnue - {cve['description']}",
                "exploit_available": cve["exploit"],
                "version_detected": "Unknown",
                "confidence": "LOW",
                "source": "offline-db",
            }]
        return []

    results = []
    for cve in CVE_DATABASE.get(detected_service, []):
        if _version_in_range(version, cve["version_range"]):
            results.append({
                "cve_id": cve["cve"],
                "severity": cve["severity"],
                "cvss_score": cve["cvss"],
                "description": cve["description"],
                "exploit_available": cve["exploit"],
                "version_detected": version,
                "confidence": "HIGH",
                "source": "offline-db",
            })
    return results


def scan_cve_for_banner(banner: str, service_name: str, port: int) -> List[Dict]:
    """Scanne les CVE pour une bannière.

    Essaie d'abord la source LIVE (NVD + cache), tombe sur la base hardcodée
    si la source live n'est pas dispo ou ne rend rien.
    """
    banner = banner or ""
    service_name = service_name or ""

    if LIVE_AVAILABLE and not _FORCE_OFFLINE:
        fallback = PORT_SERVICE_MAP.get(port, service_name)
        try:
            live_cves = lookup_cves_from_banner(banner, fallback_product=fallback)
        except Exception:
            live_cves = []
        if live_cves:
            product, version = extract_product_version(banner)
            return [
                {
                    "cve_id": c["cve_id"],
                    "severity": c.get("severity", "INFO"),
                    "cvss_score": c.get("cvss_score", 0),
                    "description": c.get("description", ""),
                    "exploit_available": "See NVD",
                    "version_detected": version or "Unknown",
                    "confidence": "HIGH" if version else "MEDIUM",
                    "source": c.get("source", "NVD"),
                    "published": c.get("published", ""),
                }
                for c in live_cves
            ]

    return _offline_lookup(banner, service_name, port)


def analyze_service_vulnerabilities(host_data: Dict) -> Dict:
    """Analyse complète des vulnérabilités CVE pour un hôte."""
    cve_results = {
        "total_cves": 0,
        "critical": [],
        "high": [],
        "medium": [],
        "low": [],
        "services_analyzed": [],
        "live_source": LIVE_AVAILABLE and not _FORCE_OFFLINE,
    }

    banners = host_data.get("banners", {}) or {}
    for port, banner in banners.items():
        port_num = int(port) if isinstance(port, str) else port
        cves = scan_cve_for_banner(banner, "", port_num)

        for cve in cves:
            cve_results["total_cves"] += 1
            entry = {
                "port": port_num,
                "banner": (banner or "")[:100],
                **cve,
            }
            sev = cve.get("severity", "").upper()
            if sev == "CRITICAL":
                cve_results["critical"].append(entry)
            elif sev == "HIGH":
                cve_results["high"].append(entry)
            elif sev == "MEDIUM":
                cve_results["medium"].append(entry)
            else:
                cve_results["low"].append(entry)

            cve_results["services_analyzed"].append({
                "port": port_num,
                "service": cve.get("version_detected", "Unknown"),
                "cve_count": 1,
            })

    return cve_results


def scan_host_cves(ip: str, banners: Dict[int, str]) -> Dict:
    return analyze_service_vulnerabilities({"ip": ip, "banners": banners})


if __name__ == "__main__":
    test_banners = {
        22: "SSH-2.0-OpenSSH_7.4",
        80: "Apache/2.4.49 (Unix)",
        3306: "MySQL 5.7.25",
    }
    results = scan_host_cves("192.168.1.100", test_banners)
    print(json.dumps(results, indent=2, ensure_ascii=False))
