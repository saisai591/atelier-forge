from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .config import settings
from .routers import auth, tenants, users, clients


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost",
            "http://192.168.1.57",
            "http://192.168.1.57:5173",
            "http://192.168.50.2",
            "http://192.168.50.2:1950",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(tenants.router, prefix="/api")
    app.include_router(users.router, prefix="/api")
    app.include_router(clients.router, prefix="/api")

    # Modules — chaque import enregistre le module dans le registry
    from modules.stock import router as stock_router
    from modules.stock.models import StockItem  # noqa: F401 — needed for create_all
    app.include_router(stock_router, prefix="/api")

    from modules.atelier_forge import router as forge_router
    app.include_router(forge_router, prefix="/api")

    from modules.commerce import router as commerce_router
    from modules.commerce.models import Order, OrderLine  # noqa: F401 — create_all
    app.include_router(commerce_router, prefix="/api")

    from modules.accounting import router as accounting_router
    from modules.accounting.models import Invoice, InvoiceLine  # noqa: F401 — create_all
    app.include_router(accounting_router, prefix="/api")

    from modules.whatsapp import router as whatsapp_router
    from modules.whatsapp.models import WhatsAppMessage  # noqa: F401 — create_all
    app.include_router(whatsapp_router, prefix="/api")

    from modules.analytics import router as analytics_router
    app.include_router(analytics_router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "app": settings.APP_NAME}

    @app.get("/api/modules")
    async def list_modules():
        from modules.registry import ModuleRegistry
        return [
            {
                "slug": slug,
                "name": m.name,
                "description": m.description,
                "nav_items": [{"label": n.label, "path": n.path, "icon": n.icon} for n in m.nav_items],
            }
            for slug, m in ModuleRegistry.all().items()
        ]

    return app


app = create_app()
