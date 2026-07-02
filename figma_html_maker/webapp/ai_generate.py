"""Proxy de geração via LLM (OpenRouter) para o Gerador de Campanhas.

Espelha `ai_extract.py`, mas em vez de extração estruturada faz uma chamada de
geração de texto livre: recebe um `system` (o PROMPT_* já com BASE_DNA) e uma
lista de content blocks no formato Anthropic (texto + imagem/PDF em base64),
traduz para o formato de mensagens do OpenRouter/OpenAI e devolve o texto.

O cliente (maker-frontend) mantém a lógica de retry-JSON e sanitização — aqui só
repassamos `{text, stop_reason}`. Assim os prompts calibrados para Claude
continuam intactos; basta apontar o modelo para `anthropic/claude-sonnet-*`.

Config (env):
    OPENROUTER_API_KEY        chave da API do OpenRouter (obrigatória — reutiliza a do ai_extract)
    OPENROUTER_GENERATE_MODEL id do modelo de geração (default: anthropic/claude-sonnet-4.5)
                              separado do OPENROUTER_MODEL barato usado na extração
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import requests as _requests

from . import ai_extract, doc_text

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_GENERATE_MODEL = "anthropic/claude-sonnet-4.5"


def is_configured() -> bool:
    """Reusa a mesma credencial do extractor."""
    return ai_extract.is_configured()


def _resolve_model(requested: Optional[str]) -> str:
    if requested and requested.strip():
        return requested.strip()
    env = os.environ.get("OPENROUTER_GENERATE_MODEL", "").strip()
    return env or DEFAULT_GENERATE_MODEL


def _translate_blocks(content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Converte content blocks estilo Anthropic para o formato OpenRouter/OpenAI.

    - {type:"text", text}                               -> {type:"text", text}
    - {type:"image", source:{media_type, data}}         -> {type:"image_url", image_url:{url:"data:..."}}
    - {type:"document", source:{media_type, data}, name} -> {type:"file", file:{filename, file_data:"data:..."}}
      (PDF via plugin file-parser; se o modelo não aceitar, o cliente/fallback já mandou texto)

    Blocos desconhecidos ou malformados são ignorados silenciosamente.
    """
    out: List[Dict[str, Any]] = []
    for block in content or []:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")

        if btype == "text":
            text = block.get("text") or ""
            if text:
                out.append({"type": "text", "text": text})
            continue

        source = block.get("source") or {}
        media_type = source.get("media_type") or ""
        data = source.get("data") or ""
        if not data:
            continue
        data_url = f"data:{media_type};base64,{data}"

        if btype == "image":
            out.append({"type": "image_url", "image_url": {"url": data_url}})
        elif btype == "document":
            filename = block.get("name") or "documento.pdf"
            out.append({
                "type": "file",
                "file": {"filename": filename, "file_data": data_url},
            })
    return out


def _extract_document_text(content: List[Dict[str, Any]]) -> str:
    """Fallback: extrai texto de PDFs/documentos base64 no servidor.

    Usado quando o modelo escolhido não aceita binário nativo. Converte cada
    bloco `document` em texto puro (via doc_text) e concatena.
    """
    import base64

    partes: List[str] = []
    for block in content or []:
        if not isinstance(block, dict) or block.get("type") != "document":
            continue
        source = block.get("source") or {}
        data = source.get("data")
        if not data:
            continue
        name = block.get("name") or "documento.pdf"
        try:
            raw = base64.b64decode(data)
            texto = doc_text.extract_text_from_upload(name, raw)
        except Exception:
            continue
        if texto and texto.strip():
            partes.append(f"[Conteúdo de {name}]\n{texto.strip()}")
    return "\n\n".join(partes)


def generate(
    system: str,
    content: List[Dict[str, Any]],
    max_tokens: int,
    model: Optional[str] = None,
) -> dict:
    """Chama o OpenRouter e devolve {'text': str, 'stop_reason': str|None}.

    Lança RuntimeError se a credencial estiver ausente ou a API falhar.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY não configurada")

    resolved_model = _resolve_model(model)
    blocks = _translate_blocks(content)

    # Fallback: se há documentos e o payload não deve depender de suporte a PDF
    # nativo, injeta o texto extraído como bloco de texto adicional.
    tem_documento = any(b.get("type") == "file" for b in blocks)
    if tem_documento:
        texto_docs = _extract_document_text(content)
        if texto_docs:
            blocks.append({"type": "text", "text": texto_docs})

    if not blocks:
        blocks = [{"type": "text", "text": ""}]

    payload: Dict[str, Any] = {
        "model": resolved_model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": blocks},
        ],
    }

    try:
        resp = _requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "X-Title": "Boxys Gerador de Campanhas",
            },
            json=payload,
            timeout=180,
        )
    except _requests.RequestException as exc:
        raise RuntimeError(f"Falha ao contatar OpenRouter: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(f"OpenRouter retornou {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        choice = data["choices"][0]
        text = choice["message"]["content"] or ""
        stop_reason = choice.get("finish_reason")
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise RuntimeError(f"Resposta inválida do OpenRouter: {exc}") from exc

    # Normaliza o finish_reason do OpenAI/OpenRouter para o vocabulário Anthropic
    # que o cliente espera (o retry-JSON verifica stop_reason === 'max_tokens').
    if stop_reason == "length":
        stop_reason = "max_tokens"

    if not text:
        raise RuntimeError(f"Resposta vazia da API (finish_reason: {stop_reason or 'desconhecido'})")

    return {"text": text, "stop_reason": stop_reason}
