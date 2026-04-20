#!/usr/bin/env python3
"""
bg_runner.py - Exécuteur de scan planifié en arrière-plan.

Invoqué par un scheduler système (launchd macOS, Task Scheduler Windows,
systemd timer Linux) ou à la main pour tester.

Workflow :
  1. Lit la config de la planification dans ~/.pathfinder/schedules/{id}.json
  2. Lit le token + URL API dans ~/.pathfinder/auth.json
  3. Appelle network_scanner.py avec les bons args (mode, ports, workers)
  4. Parse la sortie JSON du scanner
  5. POSTe les résultats vers {api_url}/api/scans
  6. Met à jour lastRunAt dans la config pour informer l'app

Usage :
  python3 bg_runner.py --schedule-id <id>
  python3 bg_runner.py --schedule-id <id> --dry-run   # sans appel API
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

PATHFINDER_DIR = Path(os.path.expanduser("~/.pathfinder"))
SCHEDULES_DIR = PATHFINDER_DIR / "schedules"
LOGS_DIR = PATHFINDER_DIR / "logs"
AUTH_FILE = PATHFINDER_DIR / "auth.json"

SCRIPT_DIR = Path(__file__).resolve().parent
NETWORK_SCANNER = SCRIPT_DIR / "network_scanner.py"

# Profils portés depuis MainPage.xaml.cs pour rester cohérents.
PROFILES = {
    "fast": {
        "ports": "21,22,23,25,53,80,110,139,143,443,445,3389,8080",
        "workers": 150,
    },
    "full": {
        "ports": "20,21,22,23,25,53,80,110,111,135,139,143,443,445,465,587,993,995,"
                 "1433,1521,3306,3389,5000,5001,5432,5900,5985,5986,6379,8000,8080,"
                 "8443,8888,9090,9200,27017,27018,50000",
        "workers": 100,
    },
    "stealth": {
        "ports": "20,21,22,23,25,53,80,110,111,135,139,143,443,445,465,587,993,995,"
                 "1433,1521,3306,3389,5000,5001,5432,5900,5985,5986,6379,8000,8080,"
                 "8443,8888,9090,9200,27017,27018,50000",
        "workers": 20,
    },
}


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _log(msg: str, schedule_id: str = "unknown") -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{schedule_id}] {msg}\n"
    sys.stdout.write(line)
    sys.stdout.flush()
    log_file = LOGS_DIR / f"bg_runner_{datetime.now().strftime('%Y%m%d')}.log"
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_schedule(schedule_id: str) -> dict:
    path = SCHEDULES_DIR / f"{schedule_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Planification introuvable : {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_schedule(schedule: dict) -> None:
    sid = schedule.get("id")
    if not sid:
        return
    path = SCHEDULES_DIR / f"{sid}.json"
    SCHEDULES_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)


def load_auth() -> dict:
    if not AUTH_FILE.exists():
        raise FileNotFoundError(
            f"Token d'authentification introuvable ({AUTH_FILE}). "
            "Connecte-toi dans l'app PathFinder au moins une fois."
        )
    with open(AUTH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_targets(raw: str) -> list:
    """Accepte séparateurs : virgule, espace, saut de ligne, point-virgule."""
    items = []
    for chunk in raw.replace(";", ",").replace("\n", ",").split(","):
        t = chunk.strip()
        if t:
            items.append(t)
    return items


# ---------------------------------------------------------------------------
# Exécution du scan
# ---------------------------------------------------------------------------

def run_scan(target: str, mode: str, schedule_id: str) -> list:
    """Appelle network_scanner.py sur une cible et renvoie la liste JSON."""
    profile = PROFILES.get(mode, PROFILES["fast"])
    cmd = [
        sys.executable,
        str(NETWORK_SCANNER),
        target,
        "--mode", mode,
        "--workers", str(profile["workers"]),
        "--ports", profile["ports"],
    ]
    _log(f"Lancement scanner : {' '.join(cmd)}", schedule_id)
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60 * 30)
    if proc.returncode != 0:
        _log(f"Scanner a échoué (code {proc.returncode}) : {proc.stderr[:400]}",
             schedule_id)
        return []

    out = proc.stdout
    start_marker = "<<<JSON_RESULTS_START>>>"
    end_marker = "<<<JSON_RESULTS_END>>>"
    if start_marker not in out or end_marker not in out:
        _log("Markers JSON absents dans la sortie du scanner", schedule_id)
        return []

    raw = out.split(start_marker, 1)[1].split(end_marker, 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        _log(f"JSON invalide : {e}", schedule_id)
        return []


# ---------------------------------------------------------------------------
# Envoi à l'API
# ---------------------------------------------------------------------------

def post_to_api(api_url: str, token: str, payload: dict,
                schedule_id: str) -> bool:
    url = api_url.rstrip("/") + "/scans"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "PathFinder-BgRunner/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            _log(f"API POST {url} -> {resp.status}", schedule_id)
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="ignore")[:300]
        except Exception:
            pass
        _log(f"API HTTP {e.code} : {body}", schedule_id)
        return False
    except Exception as e:
        _log(f"API erreur réseau : {e}", schedule_id)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Runner de scan planifié")
    parser.add_argument("--schedule-id", required=True)
    parser.add_argument("--dry-run", action="store_true",
                        help="N'envoie rien à l'API, affiche juste le JSON.")
    args = parser.parse_args()

    sid = args.schedule_id
    _log("===== Démarrage runner =====", sid)

    try:
        schedule = load_schedule(sid)
    except FileNotFoundError as e:
        _log(str(e), sid)
        return 2

    if not schedule.get("enabled", True):
        _log("Planification désactivée, skip.", sid)
        return 0

    targets = parse_targets(schedule.get("targets", ""))
    if not targets:
        _log("Aucune cible, abandon.", sid)
        return 2

    mode = schedule.get("mode", "fast")
    if mode not in PROFILES:
        mode = "fast"

    auth = {}
    if not args.dry_run:
        try:
            auth = load_auth()
        except FileNotFoundError as e:
            _log(str(e), sid)
            return 2

    api_url = auth.get("api_url", "http://localhost:5001/api")
    token = auth.get("token", "")

    success = 0
    fail = 0
    for target in targets:
        _log(f"Scan cible {target} (mode={mode})", sid)
        t0 = time.time()
        results = run_scan(target, mode, sid)
        dt = time.time() - t0
        _log(f"Scanner terminé en {dt:.1f}s, {len(results)} hôtes", sid)

        if not results:
            fail += 1
            continue

        if args.dry_run:
            print(json.dumps({"target": target, "results": results},
                             ensure_ascii=False))
            success += 1
            continue

        payload = {
            "network_range": target,
            "mode": mode,
            "results": results,
        }
        if post_to_api(api_url, token, payload, sid):
            success += 1
        else:
            fail += 1

    # Mise à jour de la config pour que l'app sache quand le scan a tourné.
    schedule["lastRunAt"] = datetime.now(timezone.utc).isoformat()
    save_schedule(schedule)

    _log(f"===== Fini : {success} OK, {fail} KO =====", sid)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
