# Atelier Forge — Plateforme SaaS

Noyau neutre multi-métier + modules (stock, commerce, comptabilité, WhatsApp,
pont PXE, analytics). Backend FastAPI + PostgreSQL, frontend React/Vite.

## Tester en local (Docker)

Prérequis : **Docker** + **Docker Compose**.

```bash
cd saas
cp .env.example .env        # ajustez les mots de passe si vous voulez
docker compose up --build   # démarre PostgreSQL + backend + frontend
```

Puis ouvrez **http://localhost:5173**.

### Créer un atelier + un admin

Dans un autre terminal :

```bash
# Linux / macOS :
bash scripts/seed-demo.sh

# Windows (PowerShell) :
powershell -ExecutionPolicy Bypass -File scripts\seed-demo.ps1
```

Le seed de démo crée le compte :

| | |
|---|---|
| **Email** | `demo@forge.fr` |
| **Mot de passe** | `Demo1234!` |

…avec des clients, des machines (audit + grade + certificat), des commandes,
des factures et des messages WhatsApp, pour voir l'appli « pleine ».

## Ports

| Service | Port |
|---|---|
| Frontend (UI) | 5173 |
| Backend (API) | 8000 |
| PostgreSQL | 5432 (interne) |

## Notes

- Le **token d'accès** est gardé en mémoire (sécurité) ; le cookie de
  rafraîchissement nécessite HTTPS, donc en HTTP local un **F5 renvoie au login**.
  En production (derrière Caddy/HTTPS, profil `production`), la session persiste.
- WhatsApp fonctionne en **mode console** (journalisé) sans configuration ;
  renseignez un token Meta dans Réglages pour l'envoi réel.
- Le **pont PXE** s'utilise via la clé d'ingestion (Réglages) :
  `POST /api/forge/ingest` avec l'en-tête `X-Forge-Key`.

## Arborescence

```
saas/
├── backend/            FastAPI (core + modules/)
│   ├── core/           auth, tenant, clients, registre de modules
│   └── modules/        stock, commerce, accounting, whatsapp,
│                       atelier_forge (pont PXE), analytics
├── frontend/           React + TypeScript + Tailwind
├── scripts/            seed-demo.sh
├── docker-compose.yml
└── Makefile
```
