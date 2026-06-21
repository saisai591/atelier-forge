import json
from pathlib import Path
from modules.atelier_forge import PXE_AUDIT_DIR
from modules.atelier_forge.schemas import ForgePxeAuditSummary
p = PXE_AUDIT_DIR / 'selftest.label.json'
data = json.loads(p.read_text())
stat = p.stat()
try:
    item = ForgePxeAuditSummary(
        id='SELFTEST', filename=p.name, updated_at='2026-01-01T00:00:00Z', serial_number=data.get('serial_number'), brand=data.get('brand'), model=data.get('model'), cpu=data.get('cpu'), ram=data.get('ram'), ram_mb=data.get('ram_mb'), main_disk=data.get('main_disk'), battery_status=data.get('battery_status'), grade_proposed=data.get('grade_proposed'), ip=data.get('ip'), mac=data.get('mac'), usb_ports_detected=data.get('usb_ports_detected'), disks=data.get('disks') or [], battery=data.get('battery') or [], label_lines=data.get('label_lines') or [], raw=data)
    print(item)
except Exception as e:
    print(type(e), e)
