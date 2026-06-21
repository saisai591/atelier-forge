from modules.atelier_forge import _read_pxe_audits, PXE_AUDIT_DIR
print(PXE_AUDIT_DIR)
for item in _read_pxe_audits():
    print(item.model_dump())
