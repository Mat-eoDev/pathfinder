#!/usr/bin/env python3
"""
cve_live.py
Récupération live des CVE depuis des sources publiques, avec cache local 24h.

Sources interrogées :
  1. NVD (services.nvd.nist.gov) - source officielle NIST, à jour quotidiennement
  2. CIRCL CVE Search (cve.circl.lu) - secours, pas de rate-limit strict

Les CVE publiées chaque jour apparaissent dans NVD dans les 24-48h.
Le cache local expire en 24h donc on récupère toujours les nouvelles CVE.

Aucune dépendance externe : urllib standard suffit.
Optionnel : définir PATHFINDER_NVD_API_KEY pour passer de 5 à 50 req/30s.
"""

import json
import os
import re
import time
import threading
import urllib.parse
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CACHE_DIR = os.path.expanduser("~/.pathfinder")
CACHE_FILE = os.path.join(CACHE_DIR, "cve_cache.json")
CACHE_TTL_SECONDS = 24 * 3600  # 24h

NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"
CIRCL_API = "https://cve.circl.lu/api/search"

# Délais entre requêtes pour rester sous les rate-limits NVD.
# Sans clé : 5 req / 30s -> on met 6s entre requêtes.
# Avec clé (PATHFINDER_NVD_API_KEY) : 50 req / 30s -> 0.7s suffit.
_HAS_API_KEY = bool(os.getenv("PATHFINDER_NVD_API_KEY"))
_NVD_DELAY = 0.7 if _HAS_API_KEY else 6.0

_rate_lock = threading.Lock()
_last_nvd_call = 0.0

# Mapping produit normalisé -> (vendor, product CPE).
# Utilisé pour construire des requêtes CPE précises quand c'est possible,
# sinon on retombe sur la recherche par mot-clé.
CPE_MAP: Dict[str, Tuple[str, str]] = {
    "apache":        ("apache",   "http_server"),
    "apache httpd":  ("apache",   "http_server"),
    "httpd":         ("apache",   "http_server"),
    "nginx":         ("nginx",    "nginx"),
    "openssh":       ("openbsd",  "openssh"),
    "mysql":         ("oracle",   "mysql"),
    "mariadb":       ("mariadb",  "mariadb"),
    "postgresql":    ("postgresql", "postgresql"),
    "redis":         ("redis",    "redis"),
    "mongodb":       ("mongodb",  "mongodb"),
    "microsoft-iis": ("microsoft", "internet_information_services"),
    "iis":           ("microsoft", "internet_information_services"),
    "tomcat":        ("apache",   "tomcat"),
    "jetty":         ("eclipse",  "jetty"),
    "wordpress":     ("wordpress", "wordpress"),
    "joomla":        ("joomla",   "joomla"),
    "drupal":        ("drupal",   "drupal"),
    "vsftpd":        ("vsftpd_project", "vsftpd"),
    "proftpd":       ("proftpd",  "proftpd"),
    "elasticsearch": ("elastic",  "elasticsearch"),
    "memcached":     ("memcached", "memcached"),
    "exim":          ("exim",     "exim"),
    "postfix":       ("postfix",  "postfix"),
    "dovecot":       ("dovecot",  "dovecot"),
    "samba":         ("samba",    "samba"),
    "openvpn":       ("openvpn",  "openvpn"),
}

# Patterns d'extraction produit/version depuis les bannières brutes.
BANNER_PATTERNS = [
    (r"OpenSSH[_/\s]+([0-9]+\.[0-9]+(?:[pP]?\d+)?)",             "openssh"),
    (r"Apache[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                    "apache"),
    (r"nginx[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                     "nginx"),
    (r"Microsoft-IIS[/\s]+([0-9]+\.[0-9]+)",                     "microsoft-iis"),
    (r"MySQL[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                     "mysql"),
    (r"MariaDB[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                   "mariadb"),
    (r"PostgreSQL[/\s]+([0-9]+\.[0-9]+(?:\.[0-9]+)?)",           "postgresql"),
    (r"Redis[/\s]*(?:version\s*)?([0-9]+\.[0-9]+\.[0-9]+)",      "redis"),
    (r"MongoDB[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                   "mongodb"),
    (r"vsFTPd[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                    "vsftpd"),
    (r"ProFTPD[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                   "proftpd"),
    (r"Exim[/\s]+([0-9]+\.[0-9]+)",                              "exim"),
    (r"Postfix[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                   "postfix"),
    (r"Dovecot[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                   "dovecot"),
    (r"Samba[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                     "samba"),
    (r"Tomcat[/\s]+([0-9]+\.[0-9]+\.[0-9]+)",                    "tomcat"),
    (r"Jetty[/(]+([0-9]+\.[0-9]+\.[0-9]+)",                      "jetty"),
]


# ---------------------------------------------------------------------------
# Cache sur disque (simple JSON thread-safe)
# ---------------------------------------------------------------------------

_cache_lock = threading.Lock()
_cache: Optional[Dict] = None


def _load_cache() -> Dict:
    global _cache
    if _cache is not None:
        return _cache
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cache = json.load(f)
        else:
            _cache = {}
    except Exception:
        _cache = {}
    return _cache


def _save_cache() -> None:
    try:
        with _cache_lock:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(_cache or {}, f, ensure_ascii=False)
    except Exception:
        pass


def _cache_get(key: str) -> Optional[List[Dict]]:
    cache = _load_cache()
    entry = cache.get(key)
    if not entry:
        return None
    if time.time() - entry.get("ts", 0) > CACHE_TTL_SECONDS:
        return None
    return entry.get("cves", [])


def _cache_put(key: str, cves: List[Dict]) -> None:
    cache = _load_cache()
    with _cache_lock:
        cache[key] = {"ts": time.time(), "cves": cves}
    _save_cache()


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _http_get_json(url: str, headers: Optional[Dict[str, str]] = None,
                   timeout: float = 8.0) -> Optional[Dict]:
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="ignore"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
            ValueError, OSError):
        return None


def _nvd_rate_limit() -> None:
    """Garantit le respect du rate-limit NVD sur tout le process."""
    global _last_nvd_call
    with _rate_lock:
        elapsed = time.time() - _last_nvd_call
        if elapsed < _NVD_DELAY:
            time.sleep(_NVD_DELAY - elapsed)
        _last_nvd_call = time.time()


# ---------------------------------------------------------------------------
# Parsers NVD / CIRCL
# ---------------------------------------------------------------------------

def _severity_from_cvss(score: float) -> str:
    if score >= 9.0:
        return "CRITICAL"
    if score >= 7.0:
        return "HIGH"
    if score >= 4.0:
        return "MEDIUM"
    if score > 0:
        return "LOW"
    return "INFO"


def _parse_nvd_item(item: Dict) -> Optional[Dict]:
    try:
        cve = item.get("cve", {})
        cve_id = cve.get("id")
        if not cve_id:
            return None

        # Description anglaise de préférence, sinon première dispo.
        desc = ""
        for d in cve.get("descriptions", []):
            if d.get("lang") == "en":
                desc = d.get("value", "")
                break
        if not desc and cve.get("descriptions"):
            desc = cve["descriptions"][0].get("value", "")

        # Score CVSS, priorité v3.1 > v3.0 > v2.
        metrics = cve.get("metrics", {})
        score = 0.0
        severity = ""
        for key in ("cvssMetricV31", "cvssMetricV30"):
            arr = metrics.get(key) or []
            if arr:
                data = arr[0].get("cvssData", {})
                score = float(data.get("baseScore", 0))
                severity = data.get("baseSeverity", "")
                break
        if not severity:
            arr = metrics.get("cvssMetricV2") or []
            if arr:
                data = arr[0].get("cvssData", {})
                score = float(data.get("baseScore", 0))
                severity = _severity_from_cvss(score)

        if not severity:
            severity = _severity_from_cvss(score)

        return {
            "cve_id": cve_id,
            "severity": severity.upper() if severity else "INFO",
            "cvss_score": round(score, 1),
            "description": desc[:300],
            "published": cve.get("published", ""),
            "source": "NVD",
        }
    except Exception:
        return None


def _parse_circl_item(item: Dict) -> Optional[Dict]:
    try:
        cve_id = item.get("id") or item.get("cveMetadata", {}).get("cveId")
        if not cve_id:
            return None
        desc = ""
        summary = item.get("summary")
        if summary:
            desc = summary
        else:
            descs = (item.get("containers", {})
                          .get("cna", {})
                          .get("descriptions", []))
            if descs:
                desc = descs[0].get("value", "")
        score = float(item.get("cvss") or 0)
        severity = _severity_from_cvss(score)
        return {
            "cve_id": cve_id,
            "severity": severity,
            "cvss_score": round(score, 1),
            "description": (desc or "")[:300],
            "published": item.get("Published", ""),
            "source": "CIRCL",
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Lookups NVD & CIRCL
# ---------------------------------------------------------------------------

_SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}


def _query_nvd(product: str, version: str, limit: int = 15) -> List[Dict]:
    """Interroge NVD. Tente CPE si on a un mapping, sinon keyword search.

    On demande plus de résultats que la limite finale pour pouvoir trier
    par sévérité + date et garder les CVE les plus critiques et récentes.
    """
    headers = {"User-Agent": "PathFinder-Scanner/1.0"}
    api_key = os.getenv("PATHFINDER_NVD_API_KEY")
    if api_key:
        headers["apiKey"] = api_key

    params_list: List[str] = []
    if product in CPE_MAP and version:
        vendor, cpe_product = CPE_MAP[product]
        cpe = f"cpe:2.3:a:{vendor}:{cpe_product}:{version}:*:*:*:*:*:*:*"
        params_list.append("cpeName=" + urllib.parse.quote(cpe))

    keyword = (product + (" " + version if version else "")).strip()
    params_list.append("keywordSearch=" + urllib.parse.quote(keyword))

    fetch = max(limit * 4, 40)
    for params in params_list:
        _nvd_rate_limit()
        url = f"{NVD_API}?{params}&resultsPerPage={fetch}"
        data = _http_get_json(url, headers=headers, timeout=8.0)
        if not data:
            continue
        vulns = data.get("vulnerabilities") or []
        cves: List[Dict] = []
        for v in vulns:
            parsed = _parse_nvd_item(v)
            if parsed:
                cves.append(parsed)
        if cves:
            # Sévérité décroissante, puis date publication décroissante (plus récent d'abord)
            cves.sort(
                key=lambda c: (
                    _SEVERITY_RANK.get(c.get("severity", "INFO"), 0),
                    c.get("published", ""),
                ),
                reverse=True,
            )
            return cves[:limit]
    return []


def _query_circl(product: str, limit: int = 10) -> List[Dict]:
    """Secours si NVD indisponible. Renvoie des CVE par vendor/product."""
    if product not in CPE_MAP:
        return []
    vendor, cpe_product = CPE_MAP[product]
    url = f"{CIRCL_API}/{urllib.parse.quote(vendor)}/{urllib.parse.quote(cpe_product)}"
    data = _http_get_json(url, timeout=8.0)
    if not data:
        return []

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("results") or data.get("data") or []
    else:
        items = []
    if not isinstance(items, list):
        items = []
    cves: List[Dict] = []
    for item in items[:limit]:
        parsed = _parse_circl_item(item)
        if parsed:
            cves.append(parsed)
    return cves


# ---------------------------------------------------------------------------
# API publique
# ---------------------------------------------------------------------------

def normalize_product(name: str) -> str:
    """Normalise un nom de produit (lowercase, alias courants)."""
    n = (name or "").strip().lower()
    aliases = {
        "apache httpd": "apache",
        "httpd": "apache",
        "ms-iis": "microsoft-iis",
        "iis": "microsoft-iis",
    }
    return aliases.get(n, n)


def extract_product_version(banner: str) -> Tuple[str, str]:
    """Essaie d'identifier (product, version) dans une bannière texte."""
    if not banner:
        return "", ""
    for pattern, product in BANNER_PATTERNS:
        m = re.search(pattern, banner, re.IGNORECASE)
        if m:
            return product, m.group(1)
    return "", ""


def lookup_cves(product: str, version: str = "",
                offline: bool = False) -> List[Dict]:
    """Retourne une liste de CVE pour un couple (product, version).

    1. Cache local < 24h -> renvoie immédiatement
    2. NVD (source officielle, à jour quotidiennement)
    3. CIRCL (secours)
    4. Liste vide si tout échoue

    offline=True force le mode cache uniquement (utile pour tests/CI).
    """
    product = normalize_product(product)
    if not product:
        return []

    key = f"{product}@{version}" if version else product
    cached = _cache_get(key)
    if cached is not None:
        return cached
    if offline:
        return []

    cves = _query_nvd(product, version)
    if not cves:
        cves = _query_circl(product)

    # Même si on n'a rien trouvé, on met en cache pour ne pas réinterroger
    # NVD toutes les 5 minutes sur la même bannière.
    _cache_put(key, cves)
    return cves


def lookup_cves_from_banner(banner: str, fallback_product: str = "") -> List[Dict]:
    """Pratique pour le scanner : prend une bannière, renvoie les CVE."""
    product, version = extract_product_version(banner)
    if not product and fallback_product:
        product = normalize_product(fallback_product)
    if not product:
        return []
    return lookup_cves(product, version)


# ---------------------------------------------------------------------------
# CLI pour tester rapidement : python3 cve_live.py openssh 7.2
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: cve_live.py <product> [version]")
        sys.exit(1)
    product = sys.argv[1]
    version = sys.argv[2] if len(sys.argv) > 2 else ""
    results = lookup_cves(product, version)
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\n{len(results)} CVE trouvées pour {product} {version}")
