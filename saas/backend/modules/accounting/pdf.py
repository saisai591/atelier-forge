"""Génération du PDF d'une facture conforme (fpdf2, pur Python).

Mentions légales FR : identité vendeur (raison sociale, adresse, SIRET, TVA),
numéro + dates, détail HT/TVA/TTC, conditions de paiement.
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos


def _txt(v) -> str:
    """fpdf2 (police core Helvetica) gère le latin-1 ; on neutralise le reste."""
    return str(v if v is not None else "")


class InvoicePDF(FPDF):
    def __init__(self, company: dict):
        super().__init__(format="A4")
        self.company = company or {}
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        c = self.company
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 8, _txt(c.get("name", "")), ln=True)
        self.set_font("Helvetica", "", 9)
        for key in ("address", "zip_city", "siret", "vat_number"):
            if c.get(key):
                label = {"siret": "SIRET : ", "vat_number": "TVA : "}.get(key, "")
                self.cell(0, 5, _txt(label + str(c[key])), ln=True)
        self.ln(2)


def build_invoice_pdf(invoice: dict, company: dict, client: dict) -> bytes:
    """`invoice` : dict sérialisé (number, dates, lines[], totals). `client` : dict."""
    pdf = InvoicePDF(company)
    pdf.add_page()

    # Titre + numéro
    pdf.set_font("Helvetica", "B", 14)
    title = f"FACTURE {invoice.get('number') or '(brouillon)'}"
    pdf.cell(0, 10, _txt(title), ln=True)

    pdf.set_font("Helvetica", "", 9)
    if invoice.get("issue_date"):
        pdf.cell(0, 5, _txt(f"Date d'emission : {invoice['issue_date']}"), ln=True)
    if invoice.get("due_date"):
        pdf.cell(0, 5, _txt(f"Echeance : {invoice['due_date']}"), ln=True)
    pdf.ln(3)

    # Bloc client (facturé à)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Facture a :", ln=True)
    pdf.set_font("Helvetica", "", 9)
    cname = client.get("company_name") or f"{client.get('first_name','')} {client.get('last_name','')}".strip()
    pdf.cell(0, 5, _txt(cname), ln=True)
    if client.get("email"):
        pdf.cell(0, 5, _txt(client["email"]), ln=True)
    if client.get("tax_number"):
        pdf.cell(0, 5, _txt(f"TVA : {client['tax_number']}"), ln=True)
    pdf.ln(4)

    # En-tête du tableau
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    widths = [85, 15, 25, 20, 25]
    headers = ["Description", "Qte", "PU HT", "TVA %", "Total HT"]
    for w, h in zip(widths, headers):
        pdf.cell(w, 7, h, border=1, fill=True, align="C")
    pdf.ln()

    # Lignes
    pdf.set_font("Helvetica", "", 9)
    for ln in invoice.get("lines", []):
        pdf.cell(widths[0], 6, _txt(ln["description"])[:55], border=1)
        pdf.cell(widths[1], 6, _txt(ln["quantity"]), border=1, align="C")
        pdf.cell(widths[2], 6, f"{ln['unit_price_ht']:.2f}", border=1, align="R")
        pdf.cell(widths[3], 6, f"{ln['vat_rate']:.0f}", border=1, align="C")
        pdf.cell(widths[4], 6, f"{ln['line_ht']:.2f}", border=1, align="R")
        pdf.ln()

    # Totaux
    pdf.ln(2)
    label_w = sum(widths[:4])
    def total_row(label, value, bold=False):
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.cell(label_w, 6, label, align="R")
        pdf.cell(widths[4], 6, f"{value:.2f}", border=1, align="R")
        pdf.ln()
    total_row("Total HT", invoice["total_ht"])
    total_row("Total TVA", invoice["total_vat"])
    total_row("Total TTC (EUR)", invoice["total_ttc"], bold=True)

    # Pied : conditions de paiement / IBAN / mentions
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 8)
    c = company

    def footer_line(text: str):
        # new_x=LMARGIN : ramène le curseur à gauche (sinon multi_cell le laisse
        # sur la marge droite et la ligne suivante manque d'espace).
        pdf.multi_cell(0, 4, _txt(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if c.get("payment_terms"):
        footer_line(f"Conditions de paiement : {c['payment_terms']}")
    if c.get("iban"):
        footer_line(f"IBAN : {c['iban']}")
    if c.get("legal_mentions"):
        footer_line(c["legal_mentions"])

    out = pdf.output()
    return bytes(out)
