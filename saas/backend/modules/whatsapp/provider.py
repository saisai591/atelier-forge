"""Providers d'envoi WhatsApp.

- ConsoleProvider : par défaut, journalise sans appel réseau (dev/test).
- MetaProvider    : WhatsApp Business Cloud API (production).

Le provider est choisi selon la config tenant (integrations["whatsapp"]) :
  {"provider": "meta", "token": "...", "phone_id": "..."}
Sans config valide -> ConsoleProvider.
"""
from __future__ import annotations
import logging
from dataclasses import dataclass

logger = logging.getLogger("forge.whatsapp")


@dataclass
class SendResult:
    ok: bool
    provider_message_id: str | None = None
    error: str | None = None


class WhatsAppProvider:
    async def send_text(self, to: str, body: str) -> SendResult:  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleProvider(WhatsAppProvider):
    """Simule l'envoi : journalise et renvoie un id factice. Aucun appel réseau."""

    async def send_text(self, to: str, body: str) -> SendResult:
        logger.info("[WhatsApp/console] -> %s : %s", to, body)
        return SendResult(ok=True, provider_message_id=f"console-{abs(hash((to, body))) % 10**12}")


class MetaProvider(WhatsAppProvider):
    """WhatsApp Business Cloud API (Meta). Nécessite token + phone_id."""

    GRAPH = "https://graph.facebook.com/v21.0"

    def __init__(self, token: str, phone_id: str):
        self.token = token
        self.phone_id = phone_id

    async def send_text(self, to: str, body: str) -> SendResult:
        import httpx

        url = f"{self.GRAPH}/{self.phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                return SendResult(ok=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
            msg_id = (data.get("messages") or [{}])[0].get("id")
            return SendResult(ok=True, provider_message_id=msg_id)
        except Exception as exc:  # réseau, DNS, timeout…
            return SendResult(ok=False, error=str(exc)[:200])


def get_provider(config: dict | None) -> WhatsAppProvider:
    config = config or {}
    if config.get("provider") == "meta" and config.get("token") and config.get("phone_id"):
        return MetaProvider(config["token"], config["phone_id"])
    return ConsoleProvider()
