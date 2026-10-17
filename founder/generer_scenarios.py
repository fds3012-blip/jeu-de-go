"""Génère founder/numbers.json et founder/scenarios/*.json (issue #579).

Toutes les constantes sont sourcées dans founder/cfo-sources.md.
Unité : un abonné-mois. days_per_month = 1, donc « par jour » du script = « par mois ».
"""
import json, os, sys

ROOT = sys.argv[1]
EUR_USD = 1.1188          # BCE, 13/10/2026 (BOE)
TVA = 0.20                # taux normal France, services électroniques
STRIPE_PCT, STRIPE_FIX = 0.015, 0.25   # cartes standard EEE
STRIPE_BILLING = 0.007    # Stripe Billing, pay-as-you-go (source secondaire)
STORE = 0.15              # Apple Small Business Program, Google Play abonnements

FIXED_WEB = [
    {"label": "Supabase Pro (25 $/mois)", "cost": round(25 / EUR_USD, 2)},
    {"label": "Vercel Pro (20 $/mois, usage commercial)", "cost": round(20 / EUR_USD, 2)},
    {"label": "Domaine mochi-go.app (9,99 $/an)", "cost": round(9.99 / EUR_USD / 12, 2)},
]
FIXED_STORES = FIXED_WEB + [
    {"label": "Apple Developer Program (99 €/an)", "cost": round(99 / 12, 2)},
]
STARTUP_STORES = [{"label": "Compte Google Play (25 $ une fois)", "cost": round(25 / EUR_USD, 2)}]

# Estimation : actifs mensuels (MAU) les 12 premiers mois après le lancement du Premium.
MAU = [300, 600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500]
CONV = 0.02  # estimation basse de la fourchette publique 2 à 5 %

OPTIONS = {
    "soutien": (2.99, 24.99),
    "charte": (4.99, 39.99),
    "progression": (6.99, 49.99),
}


def spec(option, offre, canal):
    mensuel, annuel = OPTIONS[option]
    if offre == "mensuel":
        ttc, mois = mensuel, 1
    else:
        ttc, mois = annuel, 12
    ht = ttc / (1 + TVA)
    if canal == "web":
        var = [
            {"label": "Stripe carte EEE standard (1,5 % + 0,25 € par paiement)",
             "cost": round((STRIPE_PCT * ttc + STRIPE_FIX) / mois, 4)},
            {"label": "Stripe Billing (0,7 % du montant facturé)",
             "cost": round(STRIPE_BILLING * ttc / mois, 4)},
        ]
        fixed, startup = FIXED_WEB, []
    else:
        var = [{"label": "Commission du store (15 % du prix hors TVA)",
                "cost": round(STORE * ht / mois, 4)}]
        fixed, startup = FIXED_STORES, STARTUP_STORES
    ramp = [round(m * CONV, 2) for m in MAU]
    return {
        "business": "Mochi Go Premium, option %s, %s, %s (%.2f € TTC)" % (option, offre, canal, ttc),
        "unit": "abonné-mois",
        "price": round(ht / mois, 4),
        "variable": var,
        "fixed_monthly": fixed,
        "startup": startup,
        "days_per_month": 1,
        "plan_per_day": ramp[-1],
        "ramp_per_day": ramp,
        "_lecture": "Montants en euros hors TVA (le script affiche le signe $). days_per_month = 1 : chaque « par jour » du rapport se lit « par mois ». price = prix TTC / 1,20, ramené au mois.",
        "_prix_ttc": ttc,
        "_duree_mois": mois,
        "_estimation_mau": MAU,
        "_estimation_conversion": CONV,
        "_sources": "founder/cfo-sources.md",
    }


os.makedirs(os.path.join(ROOT, "founder", "scenarios"), exist_ok=True)
for o in OPTIONS:
    for f in ("mensuel", "annuel"):
        for c in ("web", "stores"):
            s = spec(o, f, c)
            p = os.path.join(ROOT, "founder", "scenarios", "%s-%s-%s.json" % (o, f, c))
            with open(p, "w", encoding="utf-8") as fh:
                json.dump(s, fh, ensure_ascii=False, indent=1)
                fh.write("\n")
main = spec("charte", "mensuel", "web")
with open(os.path.join(ROOT, "founder", "numbers.json"), "w", encoding="utf-8") as fh:
    json.dump(main, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("ok")
