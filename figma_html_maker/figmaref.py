"""Extrai file-key e node-id de entradas variadas.

Aceita:
- a chave pura:            RyXe40e5krF5Fq6YaX8BUe
- a URL inteira do Figma:  https://www.figma.com/design/RyXe.../aricanduva_ads?node-id=1-22
- node-id no formato da URL (1-22) ou da API (1:22)

Assim o usuário pode colar o que tiver à mão sem decorar formato.
"""

from __future__ import annotations

import re

_KEY_IN_URL = re.compile(r"/(?:design|file|proto)/([A-Za-z0-9]+)")
_BARE_KEY = re.compile(r"^[A-Za-z0-9]+$")
_NODE_PAIR = re.compile(r"^[A-Za-z0-9]+[-:][A-Za-z0-9]+$")


def parse_file_key(value: str) -> str:
    value = (value or "").strip()
    m = _KEY_IN_URL.search(value)
    if m:
        return m.group(1)
    if _BARE_KEY.match(value):
        return value
    raise ValueError(
        f"Não consegui extrair o file-key de: {value!r}. "
        f"Cole a chave (ex.: RyXe40e5krF5Fq6YaX8BUe) ou a URL completa do Figma."
    )


def parse_node_id(value: str) -> str:
    value = (value or "").strip().replace("%3A", ":")
    if "node-id=" in value:
        value = value.split("node-id=", 1)[1].split("&", 1)[0].split("#", 1)[0]
    value = value.strip()
    # URL usa hífen (1-22); a API usa dois-pontos (1:22)
    if _NODE_PAIR.match(value) and "-" in value and ":" not in value:
        value = value.replace("-", ":", 1)
    if not value:
        raise ValueError("node-id vazio.")
    return value
