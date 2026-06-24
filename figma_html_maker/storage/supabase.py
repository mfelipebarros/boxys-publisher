"""Envio das imagens (bg_*) para o Supabase Storage e retorno da URL pública.

Usa a REST API do Storage do Supabase (sem dependência pesada — só requests):
  POST /storage/v1/object/{bucket}/{path}    (upload, x-upsert para sobrescrever)
  URL pública: {url}/storage/v1/object/public/{bucket}/{path}

A service_role key fica SÓ aqui no servidor/CI — nunca vai pro HTML/front.
Se o bucket for privado, troque `public_url` por geração de URL assinada.
"""

from __future__ import annotations

import requests

from ..config import SupabaseConfig


class SupabaseUploader:
    def __init__(self, config: SupabaseConfig, *, timeout: int = 60) -> None:
        self._cfg = config
        self._timeout = timeout

    def ensure_bucket(self) -> None:
        headers = {
            "Authorization": f"Bearer {self._cfg.service_key}",
            "apikey": self._cfg.service_key,
            "Content-Type": "application/json",
        }
        url = f"{self._cfg.url}/storage/v1/bucket"
        r = requests.post(url, json={"id": self._cfg.bucket, "name": self._cfg.bucket, "public": True}, headers=headers, timeout=self._timeout)
        # 200/201 = criado, 400 com "already exists" = ok
        if r.status_code not in (200, 201) and "already exists" not in r.text:
            raise RuntimeError(f"Não foi possível criar bucket Supabase ({r.status_code}): {r.text[:300]}")

    def upload_png(self, path: str, data: bytes, *, upsert: bool = True) -> str:
        """Sobe um PNG e devolve a URL pública. `path` ex.:
        'meta_feed_lancamento_01/1080x1350/bg_principal.png'
        """
        path = path.lstrip("/")
        endpoint = f"{self._cfg.url}/storage/v1/object/{self._cfg.bucket}/{path}"
        headers = {
            "Authorization": f"Bearer {self._cfg.service_key}",
            "apikey": self._cfg.service_key,
            "Content-Type": "image/png",
            "x-upsert": "true" if upsert else "false",
        }
        r = requests.post(endpoint, data=data, headers=headers, timeout=self._timeout)
        if r.status_code not in (200, 201):
            raise RuntimeError(
                f"Upload Supabase falhou ({r.status_code}): {r.text[:300]}"
            )
        return self.public_url(path)

    def public_url(self, path: str) -> str:
        path = path.lstrip("/")
        return f"{self._cfg.url}/storage/v1/object/public/{self._cfg.bucket}/{path}"
