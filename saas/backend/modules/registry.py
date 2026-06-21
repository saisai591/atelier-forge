from dataclasses import dataclass, field
from fastapi import APIRouter


@dataclass
class NavItem:
    label: str
    path: str
    icon: str


@dataclass
class ModuleManifest:
    slug: str
    name: str
    version: str
    description: str
    router: APIRouter
    nav_items: list[NavItem] = field(default_factory=list)
    required_roles: list[str] = field(default_factory=list)


class ModuleRegistry:
    _modules: dict[str, ModuleManifest] = {}

    @classmethod
    def register(cls, manifest: ModuleManifest) -> None:
        cls._modules[manifest.slug] = manifest

    @classmethod
    def all(cls) -> dict[str, ModuleManifest]:
        return dict(cls._modules)

    @classmethod
    def get(cls, slug: str) -> ModuleManifest | None:
        return cls._modules.get(slug)

    @classmethod
    def get_for_tenant(cls, enabled_slugs: list[str]) -> list[ModuleManifest]:
        return [m for slug, m in cls._modules.items() if slug in enabled_slugs]
