"""Fonte: API REST do Figma (caminho headless / lote).

Usa uma Session reutilizável (pool de conexões TLS) e busca/exporta vários nós
numa única chamada — essencial para gerar dezenas de criativos por campanha sem
abrir uma conexão nova a cada um.

Endpoints:
  GET /v1/files/{key}/nodes?ids=a,b,c   -> árvore de vários nós de uma vez
  GET /v1/images/{key}?ids=a,b,c        -> renderiza vários nós como PNG
"""

from __future__ import annotations

from typing import Any

import requests

from ..config import FigmaConfig

_BASE = "https://api.figma.com/v1"


class FigmaApiSource:
    def __init__(self, config: FigmaConfig, *, timeout: int = 120) -> None:
        self._timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"X-Figma-Token": config.token})

    def get_node(self, file_key: str, node_id: str) -> dict[str, Any]:
        return self.get_nodes(file_key, [node_id])[node_id]

    def get_nodes(self, file_key: str, node_ids: list[str]) -> dict[str, dict[str, Any]]:
        """Busca vários frames numa chamada só. Devolve {node_id: documento}."""
        if not node_ids:
            return {}
        r = self._session.get(
            f"{_BASE}/files/{file_key}/nodes",
            params={"ids": ",".join(node_ids)},
            timeout=self._timeout,
        )
        r.raise_for_status()
        nodes = r.json().get("nodes", {})
        out: dict[str, dict[str, Any]] = {}
        for nid in node_ids:
            doc = (nodes.get(nid) or {}).get("document")
            if doc:
                out[nid] = doc
        if not out:
            raise ValueError(
                f"Nenhum nó encontrado em {file_key}. Confira os node-ids "
                f"(copie da URL do Figma: ...node-id=XXXX)."
            )
        return out

    def export_pngs(
        self, file_key: str, node_ids: list[str], *, scale: int = 2
    ) -> dict[str, str]:
        """Renderiza vários nós como PNG numa chamada. Devolve {node_id: url}."""
        if not node_ids:
            return {}
        # O Figma aceita muitos ids por chamada; dividimos em blocos por segurança.
        out: dict[str, str] = {}
        for i in range(0, len(node_ids), 100):
            chunk = node_ids[i:i + 100]
            r = self._session.get(
                f"{_BASE}/images/{file_key}",
                params={"ids": ",".join(chunk), "format": "png", "scale": scale},
                timeout=self._timeout,
            )
            r.raise_for_status()
            payload = r.json()
            if payload.get("err"):
                raise RuntimeError(f"Figma export falhou: {payload['err']}")
            out.update({k: v for k, v in (payload.get("images") or {}).items() if v})
        return out

    def get_file_frames(self, file_key: str) -> list[dict]:
        """Retorna todos os frames de topo da primeira página com thumbnail.

        Usa depth=2 — só páginas + filhos diretos.
        Depois busca thumbnails de todos os frames numa chamada só.
        """
        r = self._session.get(
            f"{_BASE}/files/{file_key}",
            params={"depth": "2"},
            timeout=self._timeout,
        )
        r.raise_for_status()
        doc = r.json().get("document", {})

        frames: list[dict] = []
        pages = doc.get("children", [])
        # Apenas a primeira página
        for page in pages[:1]:
            for node in page.get("children", []):
                if node.get("type") == "FRAME":
                    frames.append({
                        "id": node["id"],
                        "name": node["name"],
                        "page": page["name"],
                        "width": round((node.get("absoluteBoundingBox") or {}).get("width", 0)),
                        "height": round((node.get("absoluteBoundingBox") or {}).get("height", 0)),
                        "thumbnail_url": None,
                    })

        if frames:
            ids = [f["id"] for f in frames]
            thumbs = self.export_pngs(file_key, ids, scale=1)
            for f in frames:
                f["thumbnail_url"] = thumbs.get(f["id"])

        return frames

    def download(self, url: str) -> bytes:
        r = self._session.get(url, timeout=self._timeout)
        r.raise_for_status()
        return r.content
