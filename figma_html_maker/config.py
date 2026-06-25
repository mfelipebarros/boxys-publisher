"""Configuração via variáveis de ambiente.

NENHUMA credencial fica no código. Tudo vem do ambiente (.env localmente,
secrets no GitHub Actions). Veja .env.example.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Variável de ambiente obrigatória ausente: {name}. "
            f"Defina no .env ou nos secrets do CI."
        )
    return value


@dataclass(frozen=True)
class FigmaConfig:
    token: str  # Personal Access Token do Figma (somente leitura basta)

    @classmethod
    def from_env(cls) -> "FigmaConfig":
        return cls(token=_require("FIGMA_TOKEN"))


@dataclass(frozen=True)
class SupabaseConfig:
    url: str          # https://<projeto>.supabase.co
    service_key: str  # service_role key (somente no servidor/CI, nunca no front)
    bucket: str       # ex: "ad-templates"
    anon_key: str = ""  # anon/public key — necessário para validar JWTs do frontend

    @classmethod
    def from_env(cls) -> "SupabaseConfig":
        return cls(
            url=_require("SUPABASE_URL").rstrip("/"),
            service_key=_require("SUPABASE_SERVICE_KEY"),
            bucket=os.environ.get("SUPABASE_BUCKET", "ad-templates").strip(),
            anon_key=os.environ.get("SUPABASE_ANON_KEY", "").strip(),
        )
