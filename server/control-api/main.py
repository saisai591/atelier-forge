import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn


DATA_ROOT = Path(os.getenv("DATA_ROOT", "/var/lib/forge"))
API_PORT = int(os.getenv("API_PORT", "1953"))
CONTROL_ROOT = DATA_ROOT / "control"
MACHINES_DIR = CONTROL_ROOT / "machines"
COMMANDS_DIR = CONTROL_ROOT / "commands"
RESULTS_DIR = CONTROL_ROOT / "results"
LABELS_DIR = CONTROL_ROOT / "labels"
AUDIT_DIR = DATA_ROOT / "deploy" / "audit"

for path in (MACHINES_DIR, COMMANDS_DIR, RESULTS_DIR, LABELS_DIR, AUDIT_DIR):
    path.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Atelier Forge Control API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MachineHeartbeat(BaseModel):
    client_id: str
    hostname: str | None = None
    ip: str | None = None
    mac: str | None = None
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    state: str = "live"
    boot_mode: str | None = None
    current_task: str | None = None
    progress: int | None = None
    remote_url: str | None = None
    capabilities: list[str] = Field(default_factory=list)


class CommandRequest(BaseModel):
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class CommandResult(BaseModel):
    command_id: str
    status: str
    message: str = ""
    finished_at: str | None = None


class LabelRequest(BaseModel):
    title: str = ""
    subtitle: str = ""
    grade: str = ""
    price: str = ""
    serial_number: str = ""
    qr_text: str = ""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_id(value: str) -> str:
    return "".join(ch for ch in value if ch.isalnum() or ch in ("-", "_", ".")) or str(uuid.uuid4())


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def command_path(client_id: str, command_id: str) -> Path:
    folder = COMMANDS_DIR / safe_id(client_id)
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{safe_id(command_id)}.json"


@app.get("/api/health")
def health():
    return {"ok": True, "time": now(), "data_root": str(DATA_ROOT)}


@app.post("/api/agent/heartbeat")
def heartbeat(payload: MachineHeartbeat):
    machine = payload.model_dump()
    machine["last_seen"] = now()
    machine["source"] = "pxe-agent"
    write_json(MACHINES_DIR / f"{safe_id(payload.client_id)}.json", machine)
    return {"accepted": True, "client_id": payload.client_id}


@app.get("/api/machines")
def machines():
    items = []
    for path in sorted(MACHINES_DIR.glob("*.json")):
        items.append(read_json(path, {}))
    return items


@app.get("/api/machines/{client_id}")
def machine(client_id: str):
    path = MACHINES_DIR / f"{safe_id(client_id)}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Machine inconnue")
    return read_json(path, {})


@app.post("/api/machines/{client_id}/actions")
def create_action(client_id: str, payload: CommandRequest):
    command_id = str(uuid.uuid4())
    command = {
        "id": command_id,
        "client_id": client_id,
        "action": payload.action,
        "payload": payload.payload,
        "status": "queued",
        "created_at": now(),
    }
    write_json(command_path(client_id, command_id), command)
    return command


@app.get("/api/agent/{client_id}/commands")
def agent_commands(client_id: str):
    folder = COMMANDS_DIR / safe_id(client_id)
    if not folder.exists():
        return []
    queued = []
    for path in sorted(folder.glob("*.json")):
        command = read_json(path, {})
        if command.get("status") == "queued":
            command["status"] = "delivered"
            command["delivered_at"] = now()
            write_json(path, command)
            queued.append(command)
    return queued


@app.post("/api/agent/{client_id}/result")
def agent_result(client_id: str, payload: CommandResult):
    result = payload.model_dump()
    result["client_id"] = client_id
    result["received_at"] = now()
    write_json(RESULTS_DIR / f"{safe_id(payload.command_id)}.json", result)
    path = command_path(client_id, payload.command_id)
    if path.exists():
        command = read_json(path, {})
        command["status"] = payload.status
        command["result_message"] = payload.message
        command["finished_at"] = payload.finished_at or now()
        write_json(path, command)
    return {"accepted": True}


@app.get("/api/commands")
def commands():
    items = []
    for path in sorted(COMMANDS_DIR.glob("*/*.json")):
        items.append(read_json(path, {}))
    return items


@app.get("/api/audits/latest")
def latest_audit():
    path = AUDIT_DIR / "latest.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Aucun audit")
    return read_json(path, {})


@app.get("/api/logs/pxe")
def pxe_logs(lines: int = 120):
    lines = max(20, min(lines, 400))
    cmd = ["journalctl", "-u", "forge-dnsmasq", "-u", "forge-nginx", "-n", str(lines), "--no-pager"]
    try:
        result = subprocess.run(cmd, text=True, capture_output=True, timeout=8)
        return {"logs": result.stdout.splitlines()[-lines:]}
    except Exception as exc:
        return {"logs": [f"Logs indisponibles: {exc}"]}


@app.post("/api/labels/preview")
def label_preview(payload: LabelRequest):
    html = f"""
    <div style="width:420px;border:2px solid #111827;border-radius:18px;padding:18px;font-family:Arial">
      <div style="font-size:24px;font-weight:900">{payload.title}</div>
      <div style="font-size:14px;color:#475569;margin-top:4px">{payload.subtitle}</div>
      <div style="display:flex;gap:12px;margin-top:14px">
        <div style="font-size:34px;font-weight:900">Grade {payload.grade}</div>
        <div style="font-size:34px;font-weight:900;margin-left:auto">{payload.price}</div>
      </div>
      <div style="font-family:monospace;font-size:12px;margin-top:12px">SN: {payload.serial_number}</div>
      <div style="font-size:11px;color:#64748b;margin-top:8px">{payload.qr_text}</div>
    </div>
    """
    label_id = str(uuid.uuid4())
    write_json(LABELS_DIR / f"{label_id}.json", {"id": label_id, "payload": payload.model_dump(), "html": html, "created_at": now()})
    return {"id": label_id, "html": html}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=API_PORT, loop="asyncio")
