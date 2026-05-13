#!/usr/bin/env python3
"""
subscription_plans.py

Matrice des plans PathFinder + helpers de validation.

Conventions :
  - tier : 'free' | 'pro' | 'enterprise'
  - feature : clé string utilisée côté backend pour gater un endpoint/flux.
  - limit : None = illimité ; int = quota.

La matrice est la SEULE source de vérité. Le frontend ne fait que l'afficher.
Les vérifs serveur se font via `can_use_feature()`, `get_limit()` et
`is_subscription_active()`.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any, Dict, List, Optional


TIER_FREE = "free"
TIER_PRO = "pro"
TIER_ENTERPRISE = "enterprise"
VALID_TIERS = {TIER_FREE, TIER_PRO, TIER_ENTERPRISE}


@dataclass
class Plan:
    tier: str
    name: str
    price_cents: int            # 0 = gratuit. Prix mensuel TTC en centimes.
    currency: str
    tagline: str
    features: List[str]         # liste humaine pour la pricing page
    limits: Dict[str, Any] = field(default_factory=dict)
    # True => plan non achetable en self-service. Nécessite un devis + activation
    # manuelle par un admin qui crée une entreprise et attribue des licences.
    quote_only: bool = False

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["price_eur"] = self.price_cents / 100.0
        return d


# ---------------------------------------------------------------------------
# Matrice des plans
# ---------------------------------------------------------------------------
# Chaque limit None = illimité.
# - scans_per_month : quota glissant sur 30 jours
# - max_active_schedules : nombre de planifications actives
# - allowed_scan_modes : sous-ensemble de {'fast','full','stealth'}
# - history_retention_days : None = illimité
# - can_export : export PDF/CSV
# - can_use_pentest : accès aux pentest tools (en plus du role=admin requis)

PLANS: Dict[str, Plan] = {
    TIER_FREE: Plan(
        tier=TIER_FREE,
        name="Découverte",
        price_cents=0,
        currency="EUR",
        tagline="Pour découvrir PathFinder et scanner son réseau domestique.",
        features=[
            "5 scans par mois",
            "Scan réseau de base",
            "14 ports les plus utilisés",
            "1 planification active",
            "Historique 30 jours",
            "Support communautaire",
        ],
        limits={
            "scans_per_month": 5,
            "max_active_schedules": 1,
            "allowed_scan_modes": ["fast"],
            "history_retention_days": 30,
            "can_export": False,
            "can_use_pentest": False,
        },
    ),
    TIER_PRO: Plan(
        tier=TIER_PRO,
        name="Audit Pro",
        price_cents=1900,
        currency="EUR",
        tagline="Pour les freelances et petites équipes qui auditent régulièrement.",
        features=[
            "Scans illimités",
            "Analyse de ports illimitée",
            "Détection services ouverts",
            "10 planifications actives",
            "Historique illimité",
            "Export PDF / CSV",
            "Support email 48h",
        ],
        limits={
            "scans_per_month": None,
            "max_active_schedules": 10,
            "allowed_scan_modes": ["fast", "full"],
            "history_retention_days": None,
            "can_export": True,
            "can_use_pentest": False,
        },
    ),
    TIER_ENTERPRISE: Plan(
        tier=TIER_ENTERPRISE,
        name="Entreprise",
        price_cents=0,          # sur devis : pas de prix public
        currency="EUR",
        tagline="Équipes sécurité : licences multi-postes gérées par un chef d'entreprise, tarif sur devis.",
        features=[
            "Tout le plan Audit Pro",
            "Mode furtif / stealth",
            "Planifications illimitées",
            "Outils pentest activés",
            "Licences multi-postes",
            "Support prioritaire dédié",
        ],
        limits={
            "scans_per_month": None,
            "max_active_schedules": None,
            "allowed_scan_modes": ["fast", "full", "stealth"],
            "history_retention_days": None,
            "can_export": True,
            "can_use_pentest": True,
        },
        quote_only=True,
    ),
}


def all_plans_public() -> List[Dict[str, Any]]:
    """Renvoie la liste des plans dans l'ordre (free, pro, enterprise)."""
    return [PLANS[t].to_dict() for t in (TIER_FREE, TIER_PRO, TIER_ENTERPRISE)]


def get_plan(tier: str) -> Plan:
    return PLANS.get(tier or TIER_FREE, PLANS[TIER_FREE])


def normalize_tier(tier: Optional[str]) -> str:
    if not tier:
        return TIER_FREE
    t = tier.strip().lower()
    return t if t in VALID_TIERS else TIER_FREE


# ---------------------------------------------------------------------------
# Règles d'expiration / downgrade
# ---------------------------------------------------------------------------

def effective_tier(user_row: Dict[str, Any]) -> str:
    """Calcule le tier effectif en tenant compte de l'expiration et de
    l'appartenance à une entreprise.

    Règles :
      - tout user rattaché à une entreprise (`company_id` non nul) OU
        ayant le rôle `company_admin` est Enterprise, point final
        (la licence est gérée par le chef d'entreprise, pas par le billing user).
      - sinon, pro/enterprise expiré => retombe en free.
    """
    if user_row.get("company_id") is not None or \
       (user_row.get("role") or "").lower() == "company_admin":
        return TIER_ENTERPRISE

    tier = normalize_tier(user_row.get("subscription_tier"))
    if tier == TIER_FREE:
        return TIER_FREE
    ends_at = user_row.get("subscription_ends_at")
    if ends_at and isinstance(ends_at, datetime) and ends_at < datetime.utcnow():
        return TIER_FREE
    return tier


def is_subscription_active(user_row: Dict[str, Any]) -> bool:
    """True si l'abonnement est actuellement valide (ou free)."""
    tier = normalize_tier(user_row.get("subscription_tier"))
    if tier == TIER_FREE:
        return True
    ends_at = user_row.get("subscription_ends_at")
    if ends_at is None:
        return False
    if isinstance(ends_at, datetime):
        return ends_at > datetime.utcnow()
    return False


# ---------------------------------------------------------------------------
# Helpers de permission
# ---------------------------------------------------------------------------

def get_limit(tier: str, key: str) -> Any:
    return get_plan(tier).limits.get(key)


def allowed_modes(tier: str) -> List[str]:
    return list(get_limit(tier, "allowed_scan_modes") or ["fast"])


def can_use_mode(tier: str, mode: str) -> bool:
    return (mode or "fast").lower() in allowed_modes(tier)


def can_export(tier: str) -> bool:
    return bool(get_limit(tier, "can_export"))


def can_use_pentest(tier: str) -> bool:
    return bool(get_limit(tier, "can_use_pentest"))


def scan_quota(tier: str) -> Optional[int]:
    return get_limit(tier, "scans_per_month")


def schedule_quota(tier: str) -> Optional[int]:
    return get_limit(tier, "max_active_schedules")


def history_days(tier: str) -> Optional[int]:
    return get_limit(tier, "history_retention_days")


# ---------------------------------------------------------------------------
# Simulateur de paiement
# ---------------------------------------------------------------------------

# Numéros de test reconnus (inspirés Stripe) :
#   4242 4242 4242 4242  -> paiement OK (Visa)
#   5555 5555 5555 4444  -> paiement OK (Mastercard)
#   4000 0000 0000 0002  -> refusé (carte déclinée)
#   0000 0000 0000 0000  -> refusé (invalide Luhn)

REFUSED_CARD = "4000000000000002"


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, c in enumerate(reversed(digits)):
        if not c.isdigit():
            return False
        d = int(c)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return len(digits) >= 12 and total % 10 == 0


def validate_fake_card(card_number: str, exp_month: int, exp_year: int,
                       cvv: str) -> Dict[str, Any]:
    """Valide un numéro de carte factice. Renvoie un dict {ok, reason, brand, last4}."""
    digits = "".join(c for c in (card_number or "") if c.isdigit())
    if len(digits) < 12 or len(digits) > 19:
        return {"ok": False, "reason": "Numéro de carte invalide (longueur)."}
    if digits == REFUSED_CARD:
        return {"ok": False, "reason": "Carte refusée par votre banque."}
    if not _luhn_ok(digits):
        return {"ok": False, "reason": "Numéro de carte invalide (Luhn)."}
    try:
        em, ey = int(exp_month), int(exp_year)
    except (TypeError, ValueError):
        return {"ok": False, "reason": "Date d'expiration invalide."}
    if not (1 <= em <= 12):
        return {"ok": False, "reason": "Mois d'expiration invalide."}
    if ey < 100:
        ey += 2000
    now = datetime.utcnow()
    if (ey, em) < (now.year, now.month):
        return {"ok": False, "reason": "Carte expirée."}
    if not cvv or not cvv.isdigit() or len(cvv) not in (3, 4):
        return {"ok": False, "reason": "CVV invalide."}

    brand = _detect_brand(digits)
    return {
        "ok": True,
        "brand": brand,
        "last4": digits[-4:],
        "method_label": f"{brand} ****{digits[-4:]}",
    }


def _detect_brand(digits: str) -> str:
    if digits.startswith("4"):
        return "Visa"
    if digits[:2] in {"51", "52", "53", "54", "55"} or \
       (digits[:4].isdigit() and 2221 <= int(digits[:4]) <= 2720):
        return "Mastercard"
    if digits[:2] in {"34", "37"}:
        return "Amex"
    return "Carte"
