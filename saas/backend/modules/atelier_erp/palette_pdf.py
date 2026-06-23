from fpdf import FPDF


def _txt(value) -> str:
    return str(value if value is not None else "").encode("latin-1", errors="replace").decode("latin-1")


class PalletLabelPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="L", unit="mm", format=(148, 105))
        self.set_auto_page_break(auto=False)
        self.set_margins(8, 8, 8)


def build_pallet_label_pdf(payload: dict) -> bytes:
    pdf = PalletLabelPDF()
    pdf.add_page()

    pdf.set_draw_color(25, 25, 25)
    pdf.set_line_width(0.4)
    pdf.rect(5, 5, 138, 95)

    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 5, "ATELIEROS - PALETTE CLIENT", align="C", ln=True)

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 11, _txt(payload.get("client_name", "CLIENT")), align="C", ln=True)

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, _txt(payload.get("shipment_reference", "")), align="C", ln=True)
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 24)
    pdf.cell(82, 18, _txt(payload.get("pallet_reference", "")), border=1, align="C")
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(44, 18, _txt(payload.get("status", "PREPARATION")), border=1, align="C", ln=True)

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 10)
    rows = [
        ("Machines", payload.get("expected_items", "0")),
        ("Transport", payload.get("carrier", "")),
        ("Emplacement", payload.get("location", "")),
        ("Document", payload.get("document_state", "")),
    ]
    for label, value in rows:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(28, 7, _txt(label + " :"))
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(98, 7, _txt(value), ln=True)

    pdf.set_y(82)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(82, 8, _txt(payload.get("barcode_text", "")), border=1, align="C")
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(44, 8, "Scanner pour fiche palette", border=1, align="C")

    out = pdf.output()
    return bytes(out)
