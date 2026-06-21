from pathlib import Path
from modules.atelier_forge import PXE_AUDIT_DIR, _audit_summary_from_label
print('exists', PXE_AUDIT_DIR.exists())
print('iter', [p.name for p in PXE_AUDIT_DIR.iterdir()])
print('glob', [p.name for p in PXE_AUDIT_DIR.glob('*.label.json')])
for p in PXE_AUDIT_DIR.glob('*.label.json'):
    print('summary', _audit_summary_from_label(p))
