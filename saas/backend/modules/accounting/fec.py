"""Export FEC — Fichier des Écritures Comptables (art. A47 A-1 du LPF).

Format légal français : 18 colonnes obligatoires, séparées par tabulation,
une ligne d'en-tête, montants avec virgule décimale.

Pour chaque facture émise, on génère l'écriture de vente :
  - Débit  411 (Clients)            = TTC
  - Crédit 707 (Ventes)             = HT
  - Crédit 44571 (TVA collectée)    = TVA
"""
from decimal import Decimal, ROUND_HALF_UP

FEC_HEADER = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum",
    "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate",
    "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet",
    "ValidDate", "Montantdevise", "Idevise",
]

CPT_CLIENT = ("411000", "Clients")
CPT_VENTES = ("707000", "Ventes de marchandises")
CPT_TVA = ("445710", "TVA collectée")


def _money(value: float) -> str:
    """Montant FEC : 2 décimales, virgule décimale, jamais négatif côté débit/crédit."""
    d = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{d:.2f}".replace(".", ",")


def _ymd(d) -> str:
    return d.strftime("%Y%m%d") if d else ""


def _row(*cols: str) -> str:
    return "\t".join(cols)


def build_fec(invoices: list[dict]) -> str:
    """`invoices` : liste de dicts normalisés (voir _invoice_to_dict dans le routeur)."""
    lines = [_row(*FEC_HEADER)]
    for inv in invoices:
        num = inv["number"] or ""
        edate = _ymd(inv["issue_date"])
        ref = num
        pdate = edate
        lib = f"Facture {num}"
        client_aux = (inv["client_code"], inv["client_name"])

        # Débit client (TTC)
        lines.append(_row(
            "VE", "Ventes", num, edate, CPT_CLIENT[0], CPT_CLIENT[1],
            client_aux[0], client_aux[1], ref, pdate, lib,
            _money(inv["total_ttc"]), "0,00", "", "", edate, "", "",
        ))
        # Crédit ventes (HT)
        lines.append(_row(
            "VE", "Ventes", num, edate, CPT_VENTES[0], CPT_VENTES[1],
            "", "", ref, pdate, lib,
            "0,00", _money(inv["total_ht"]), "", "", edate, "", "",
        ))
        # Crédit TVA collectée
        if inv["total_vat"] > 0:
            lines.append(_row(
                "VE", "Ventes", num, edate, CPT_TVA[0], CPT_TVA[1],
                "", "", ref, pdate, lib,
                "0,00", _money(inv["total_vat"]), "", "", edate, "", "",
            ))
    return "\n".join(lines) + "\n"
