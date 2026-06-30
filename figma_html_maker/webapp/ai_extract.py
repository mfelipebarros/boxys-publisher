"""Extração de copies via LLM (OpenRouter) com saída estruturada.

Lê um documento de copy escrito por humanos (formato livre, com variações de
rótulo e espaçamento) e devolve uma lista de copies estruturadas, prontas para
revisão antes de persistir. Substitui o parser regex frágil de /copies/import.

Config (env):
    OPENROUTER_API_KEY   chave da API do OpenRouter (obrigatória)
    OPENROUTER_MODEL     id do modelo (default: google/gemini-2.5-flash)
                         requer suporte a structured outputs (response_format json_schema)
"""

from __future__ import annotations

import json
import os
from typing import List

import requests as _requests

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemini-2.5-flash"


def is_configured() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY", "").strip())


# Tipos de copy reconhecidos. `criativo` = estático/genérico, `search`/`display`/`pmax`
# = blocos de texto do Google Ads, `landing_page` = LP, `asset` = brief de imagem.
_COPY_TYPES = ["criativo", "search", "display", "pmax", "landing_page", "asset"]

_SYSTEM_PROMPT = """\
Você é um extrator de copies de marketing da plataforma Boxys. Recebe um documento \
escrito por humanos (formato livre, com variações de rótulo e espaçamento) descrevendo \
anúncios de uma campanha e devolve uma lista estruturada de copies.

CONVENÇÃO DE ID (obrigatória em `name`): [CAMPANHA]-[CANAL]-[FORMATO][VARIAÇÃO]
- Campanha: 4 caracteres em caixa alta (ex: INVB, DMBC)
- Canal: M=Meta Ads, G=Google Ads, S=Rede Social orgânica, A=App Boxys
- Formato: E=Estático, C=Carrossel, S=Search, V=Vídeo, T=Thumb
- Variação: 2 dígitos sequenciais (01, 02, ...)
Exemplo: INVB-M-E01, INVB-G-S01. Use exatamente o ID presente no documento.

REGRAS DE MAPEAMENTO (uma copy por ID encontrado):
- `title`: Headline / Título da peça (UM por peça).
- `description`: a LEGENDA DO POST (caption do feed) quando existir — é o texto que publica no anúncio.
  Se NÃO houver legenda do post, use o campo "Descrição" disponível. Quando houver AMBOS
  ("Descrição:" curta da arte E "Legenda do Post:"), a Legenda do Post vence o `description`
  e a Descrição curta da arte vai para `content`.
- `message`: Botão / CTA / Mensagem (UM por peça). Remova colchetes/chaves decorativas, mantenha o texto.
- `content`: texto de referência criativa que não cabe nos campos acima — Direcionamento de Design,
  Selo/Apoio, Logo da Arte, Foco da Comunicação, Formato/dimensões, e a Descrição curta da arte
  quando a Legenda do Post já ocupou o `description`. Junte em texto legível.
- `content_html`: SOMENTE para estruturas com múltiplos itens, como STRING JSON:
  * Carrossel (formato C): array de slides, um objeto por imagem:
    [{"slide":1,"label":"Capa","visual":"...","headline":"...","text":"...","arrow":"..."}, ...]
    Use só as chaves presentes no slide. `title/description/message` permanecem como os campos globais da peça.
  * Search/Display/PMax: objeto com listas:
    {"short_titles":["..."],"long_titles":["..."],"descriptions":["..."]}
  Para estáticos e assets, deixe `content_html` como string vazia "".

TIPO (`type`):
- Carrossel, estático Meta/Social → "criativo"
- Google Search (bloco de textos) → "search"
- Google Rede de Display (bloco de textos) → "display"
- Google Performance Max (bloco de textos) → "pmax"
- Landing page → "landing_page"
- Brief de IMAGEM/asset visual (descrição de foto a produzir, sem texto de anúncio) → "asset"
  Coloque a descrição do visual em `content`; deixe title/description/message vazios.

Quando uma variação disser "textos e visuais idênticos a outra", repita o conteúdo da peça referenciada \
mantendo o ID próprio. Não invente copies que não estão no documento. Não pule nenhum ID.\
"""

_COPY_ITEM_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string", "description": "ID padronizado, ex: INVB-M-E01"},
        "type": {"type": "string", "enum": _COPY_TYPES},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "message": {"type": "string"},
        "content": {"type": "string"},
        "content_html": {
            "type": "string",
            "description": "String JSON (array de slides ou objeto de listas) ou vazio",
        },
    },
    "required": ["name", "type", "title", "description", "message", "content", "content_html"],
}

_RESPONSE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "copies": {"type": "array", "items": _COPY_ITEM_SCHEMA},
    },
    "required": ["copies"],
}


def extract_copies(text: str) -> List[dict]:
    """Chama o OpenRouter e devolve a lista de copies estruturadas (sem persistir).

    Lança RuntimeError se a credencial estiver ausente ou a API falhar.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY não configurada")

    model = os.environ.get("OPENROUTER_MODEL", "").strip() or DEFAULT_MODEL

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "copies_extraction",
                "strict": True,
                "schema": _RESPONSE_SCHEMA,
            },
        },
    }

    try:
        resp = _requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "X-Title": "Boxys Figma Maker",
            },
            json=payload,
            timeout=120,
        )
    except _requests.RequestException as exc:
        raise RuntimeError(f"Falha ao contatar OpenRouter: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(f"OpenRouter retornou {resp.status_code}: {resp.text[:300]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise RuntimeError(f"Resposta inválida do OpenRouter: {exc}") from exc

    copies = data.get("copies", [])
    # Garante os campos esperados (o schema strict já cobre, mas normalizamos por segurança).
    norm: List[dict] = []
    for c in copies:
        if not c.get("name"):
            continue
        ctype = c.get("type", "criativo")
        if ctype not in _COPY_TYPES:
            ctype = "criativo"
        norm.append({
            "name": c.get("name", "").strip(),
            "type": ctype,
            "title": c.get("title", ""),
            "description": c.get("description", ""),
            "message": c.get("message", ""),
            "content": c.get("content", ""),
            "content_html": c.get("content_html", ""),
        })
    return norm
