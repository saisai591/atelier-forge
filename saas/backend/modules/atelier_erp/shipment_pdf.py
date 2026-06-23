from fpdf import FPDF


def _txt(value) -> str:
    return str(value if value is not None else "").encode("latin-1", errors="replace").decode("latin-1")


class ShipmentPDF(FPDF):
    def __init__(self, title: str):
        super().__init__(format="A4")
        self.title = title
        self.set_auto_page_break(auto=True, margin=16)
        self.set_margins(14, 14, 14)

    def header(self):
        self.set_font("Helvetica", "B", 15)
        self.cell(0, 8, _txt(self.title), ln=True)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, "AtelierOS - document genere automatiquement", ln=True)
        self.ln(4)


def build_delivery_note_pdf(shipment: dict, pallets: list[dict]) -> bytes:
    pdf = ShipmentPDF("BON DE LIVRAISON")
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, _txt(shipment.get("client_name", "")), ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, _txt(f"Reference sortie : {shipment.get('reference', '')}"), ln=True)
    pdf.cell(0, 6, _txt(f"Transporteur : {shipment.get('carrier') or 'A definir'}"), ln=True)
    pdf.cell(0, 6, _txt(f"Machines prevues : {shipment.get('expected_items', 0)}"), ln=True)
    pdf.cell(0, 6, _txt(f"Palettes : {shipment.get('pallet_count', len(pallets))}"), ln=True)
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(238, 238, 238)
    for width, label in zip([50, 35, 35, 55], ["Palette", "Machines", "Statut", "Emplacement"]):
        pdf.cell(width, 8, label, border=1, align="C", fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 9)
    for pallet in pallets:
        pdf.cell(50, 7, _txt(pallet.get("reference", "")), border=1)
        pdf.cell(35, 7, _txt(pallet.get("expected_items", 0)), border=1, align="C")
        pdf.cell(35, 7, _txt(pallet.get("status", "")), border=1, align="C")
        pdf.cell(55, 7, _txt(pallet.get("location", "")), border=1)
        pdf.ln()

    pdf.ln(10)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, _txt("Observations : " + (shipment.get("notes") or "")))
    pdf.ln(12)
    pdf.cell(85, 8, "Signature expediteur :", border=1)
    pdf.cell(85, 8, "Signature client / transporteur :", border=1, ln=True)

    out = pdf.output()
    return bytes(out)


def build_packing_list_pdf(shipment: dict, pallets: list[dict]) -> bytes:
    pdf = ShipmentPDF("LISTE DE COLISAGE")
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, _txt(f"Sortie : {shipment.get('reference', '')}"), ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, _txt(f"Client : {shipment.get('client_name', '')}"), ln=True)
    pdf.cell(0, 6, _txt(f"Transport : {shipment.get('carrier') or 'A definir'}"), ln=True)
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(238, 238, 238)
    for width, label in zip([42, 32, 32, 32, 55], ["Palette", "Attendu", "Scanne", "Statut", "Reference scan"]):
        pdf.cell(width, 8, label, border=1, align="C", fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 9)
    for pallet in pallets:
        pdf.cell(42, 7, _txt(pallet.get("reference", "")), border=1)
        pdf.cell(32, 7, _txt(pallet.get("expected_items", 0)), border=1, align="C")
        pdf.cell(32, 7, _txt(pallet.get("scanned_items", 0)), border=1, align="C")
        pdf.cell(32, 7, _txt(pallet.get("status", "")), border=1, align="C")
        pdf.cell(55, 7, _txt(f"PALLET:{pallet.get('reference', '')}"), border=1)
        pdf.ln()

    out = pdf.output()
    return bytes(out)
