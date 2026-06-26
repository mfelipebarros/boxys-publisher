"""Servidor web (FastAPI) — a camada visual da aplicação.

A interface (static/index.html) NUNCA vê credenciais. Ela conversa só com este
backend, que segura o FIGMA_TOKEN e a service_role do Supabase via ambiente e faz
o trabalho pesado.

Rodar:
    pip install -r requirements.txt
    uvicorn figma_html_maker.webapp.server:app --reload --port 8000
    # abra http://localhost:8000
"""

from __future__ import annotations

import io
import json as _json
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import requests as _requests
from dotenv import load_dotenv
load_dotenv()

from typing import List, Optional

from html.parser import HTMLParser

import time

from fastapi import FastAPI, Form, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..config import FigmaConfig, SupabaseConfig
from ..figmaref import parse_file_key, parse_node_id
from ..normalize import normalize
from ..pipeline import build_batch, build_from_template, campaign_slug
from ..sources.figma_api import FigmaApiSource
from ..storage.supabase import SupabaseUploader
from . import db

HERE = Path(__file__).resolve().parent
# Em produção serve o React build; em dev fallback para o Vue estático
_REACT_DIST = HERE.parent.parent / "maker-frontend-dist"
STATIC_DIR = _REACT_DIST if _REACT_DIST.exists() else HERE / "static"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "./output")).resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

db._migrate()

app = FastAPI(title="Boxys · Figma → HTML")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Auth ----
# Auth usa o projeto Supabase do frontend Boxys (BOXYS_SUPABASE_URL / BOXYS_SUPABASE_ANON_KEY).
# O SUPABASE_URL existente aponta para o projeto de storage do figma-html-maker (diferente).

_SB_URL  = os.environ.get("BOXYS_SUPABASE_URL", "").rstrip("/")
_SB_ANON = os.environ.get("BOXYS_SUPABASE_ANON_KEY", "").strip()
AUTH_ENABLED = bool(_SB_URL and _SB_ANON)

_token_cache: dict = {}  # {token: (user_dict, expires_at)}
_CACHE_TTL = 300  # 5 min


def _validate_token(token: str) -> Optional[dict]:
    now = time.time()
    cached = _token_cache.get(token)
    if cached:
        user, exp = cached
        if now < exp:
            return user
    try:
        r = _requests.get(
            f"{_SB_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": _SB_ANON},
            timeout=5,
        )
        if r.status_code != 200:
            _token_cache.pop(token, None)
            return None
        user = r.json()
        _token_cache[token] = (user, now + _CACHE_TTL)
        return user
    except Exception:
        return None


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if not AUTH_ENABLED:
        return await call_next(request)
    path = request.url.path
    # Rotas públicas — não requerem auth
    if not path.startswith("/api/") or path.startswith("/api/auth/") or path == "/api/health":
        return await call_next(request)
    raw = request.headers.get("Authorization", "")
    token = raw[7:] if raw.startswith("Bearer ") else raw
    if not token:
        return JSONResponse({"status": "error", "error": "Não autenticado"}, status_code=401)
    user = _validate_token(token)
    if not user:
        return JSONResponse({"status": "error", "error": "Token inválido ou expirado"}, status_code=401)
    request.state.user = user
    return await call_next(request)


# ---- Pydantic models ----

class ConvertRequest(BaseModel):
    file_key: str
    node_id: str
    scale: int = 2
    upload: bool = True
    campaign: str = ""
    title: str = ""
    desc: str = ""
    message: str = ""
    campaign_id: Optional[int] = None
    creative_id: Optional[int] = None  # set on publish step to update existing record
    copy_id: Optional[int] = None


class BatchRequest(BaseModel):
    file_key: str
    node_ids: List[str]
    scale: int = 2
    upload: bool = True
    campaign: str = ""
    title: str = ""
    desc: str = ""
    message: str = ""
    campaign_id: Optional[int] = None
    creative_ids: Optional[List[Optional[int]]] = None  # parallel list to node_ids; set on publish
    copy_id: Optional[int] = None


class BrowseRequest(BaseModel):
    file_key: str


class CreateCampaignRequest(BaseModel):
    name: str
    figma_file_key: str = ""
    boxys_campaign_id: Optional[int] = None


class UpdateCampaignRequest(BaseModel):
    name: Optional[str] = None
    figma_file_key: Optional[str] = None
    briefing_text: Optional[str] = None
    ia_config: Optional[str] = None
    campaign_title: Optional[str] = None
    general_description: Optional[str] = None
    basic_copy: Optional[str] = None
    explanation_video_url: Optional[str] = None
    traffic_video_url: Optional[str] = None
    verso_config: Optional[str] = None
    thumb_url: Optional[str] = None
    featured_image_url: Optional[str] = None
    traffic_config: Optional[str] = None


class CreateCarouselRequest(BaseModel):
    name: str


class UpdateCarouselRequest(BaseModel):
    name: Optional[str] = None
    destination: Optional[str] = None


class AddCarouselItemRequest(BaseModel):
    creative_id: int


class ReorderCarouselRequest(BaseModel):
    ordered_item_ids: List[int]


class ReorderCarouselAssetsRequest(BaseModel):
    ordered_asset_ids: List[int]


class UpdateCarouselAssetRequest(BaseModel):
    caption: Optional[str] = None


class UpdateCreativeRequest(BaseModel):
    destination: Optional[str] = None


class ZipExportRequest(BaseModel):
    format: str
    title: str = ""
    description: str = ""
    message: str = ""
    creative_ids: List[int] = []
    video_creative_id: Optional[int] = None
    cover_creative_id: Optional[int] = None
    carousel_variant: str = "square"


class CreateCopyRequest(BaseModel):
    name: str
    title: str = ""
    description: str = ""
    message: str = ""
    content_html: str = ""
    type: str = "criativo"
    content: str = ""


class UpdateCopyRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    message: Optional[str] = None
    content_html: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PublishBoxyRequest(BaseModel):
    creative_id: int
    campaign_id: int           # ID da campanha no Boxys (Supabase)
    type: str                  # "advertisement" | "social_creative" | "landing_page"
    title: Optional[str] = None
    slug: Optional[str] = None  # obrigatório se type == "landing_page"


class CreateBoxyCampaignRequest(BaseModel):
    title: str
    description: str = ""
    create_local: bool = True  # também cria campanha no SQLite local


# ---- Static / root ----

@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


# ---- Health ----

@app.get("/api/health")
def health() -> dict:
    return {
        "figma_token": bool(os.environ.get("FIGMA_TOKEN", "").strip()),
        "supabase_url": bool(os.environ.get("SUPABASE_URL", "").strip()),
        "supabase_key": bool(os.environ.get("SUPABASE_SERVICE_KEY", "").strip()),
        "bucket": os.environ.get("SUPABASE_BUCKET", "ad-templates"),
        "auth_enabled": AUTH_ENABLED,
    }


# ---- Auth endpoints ----

@app.post("/api/auth/login")
def auth_login(req: LoginRequest) -> dict:
    if not AUTH_ENABLED:
        return JSONResponse({"status": "error", "error": "Auth não configurado (SUPABASE_ANON_KEY ausente)"}, status_code=503)
    try:
        r = _requests.post(
            f"{_SB_URL}/auth/v1/token?grant_type=password",
            json={"email": req.email, "password": req.password},
            headers={"apikey": _SB_ANON, "Content-Type": "application/json"},
            timeout=10,
        )
    except Exception as e:
        return JSONResponse({"status": "error", "error": str(e)}, status_code=503)
    if r.status_code != 200:
        data = r.json()
        msg = data.get("error_description") or data.get("msg") or data.get("error") or "Credenciais inválidas"
        return JSONResponse({"status": "error", "error": msg}, status_code=401)
    data = r.json()
    return {"status": "ok", "access_token": data["access_token"], "user": data.get("user")}


@app.get("/api/auth/me")
def auth_me(request: Request) -> dict:
    user = getattr(request.state, "user", None)
    if not user:
        return JSONResponse({"status": "error", "error": "Não autenticado"}, status_code=401)
    return {"status": "ok", "user": user}


# ---- Boxys integration endpoints ----

def _sb_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "apikey": _SB_ANON,
        "Content-Type": "application/json",
    }


def _get_token(request: Request) -> str:
    raw = request.headers.get("Authorization", "")
    return raw[7:] if raw.startswith("Bearer ") else raw


def _sb_count(nested) -> int:
    """Extrai contagem do formato [{count: N}] retornado pelo PostgREST."""
    if isinstance(nested, list) and nested and isinstance(nested[0], dict):
        return nested[0].get("count", 0)
    return 0


@app.get("/api/boxys/campaigns")
def boxys_campaigns(request: Request) -> dict:
    token = _get_token(request)
    try:
        r = _requests.get(
            f"{_SB_URL}/rest/v1/campaign",
            params={
                "select": "id,title,image,published,created_at,advertisements(count),social_creatives(count),landing_pages(count)",
                "parent_id": "is.null",
                "order": "created_at.desc",
            },
            headers=_sb_headers(token),
            timeout=10,
        )
    except Exception as e:
        return JSONResponse({"status": "error", "error": str(e)}, status_code=503)
    if r.status_code != 200:
        return JSONResponse({"status": "error", "error": "Falha ao buscar campanhas"}, status_code=r.status_code)

    campaigns = r.json()
    for c in campaigns:
        ads = c.pop("advertisements", [])
        soc = c.pop("social_creatives", [])
        lps = c.pop("landing_pages", [])
        c["asset_count"] = _sb_count(ads) + _sb_count(soc) + _sb_count(lps)
    return {"status": "ok", "campaigns": campaigns}


@app.get("/api/boxys/campaigns/{campaign_id}")
def boxys_campaign_detail(campaign_id: int, request: Request) -> dict:
    token = _get_token(request)
    hdrs = _sb_headers(token)

    def _fetch(table: str, select: str) -> list:
        try:
            r = _requests.get(
                f"{_SB_URL}/rest/v1/{table}",
                params={"campaign_id": f"eq.{campaign_id}", "select": select, "order": "created_at.desc"},
                headers=hdrs,
                timeout=10,
            )
            return r.json() if r.status_code == 200 else []
        except Exception:
            return []

    try:
        rc = _requests.get(
            f"{_SB_URL}/rest/v1/campaign",
            params={"id": f"eq.{campaign_id}", "select": "id,title,image,published,description,created_at"},
            headers=hdrs,
            timeout=10,
        )
        campaign = rc.json()[0] if rc.status_code == 200 and rc.json() else None
    except Exception:
        campaign = None

    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)

    ads  = _fetch("advertisements",   "id,title,format,dimensions,published,created_at,cover_image_url")
    soc  = _fetch("social_creatives", "id,title,format,published,created_at")
    lps  = _fetch("landing_pages",    "id,slug,published,created_at,cover_image_url")

    return {
        "status": "ok",
        "campaign": campaign,
        "advertisements": ads,
        "social_creatives": soc,
        "landing_pages": lps,
    }


@app.post("/api/boxys/campaigns")
def boxys_create_campaign(req: CreateBoxyCampaignRequest, request: Request) -> dict:
    token = _get_token(request)
    hdrs = {**_sb_headers(token), "Prefer": "return=representation"}

    payload = {
        "title": req.title,
        "description": req.description or "",
        "target_audience_description": "",
        "usage_instructions": "",
        "version": "1.0",
        "image": "",
        "published": False,
        "parent_id": None,
    }
    try:
        r = _requests.post(f"{_SB_URL}/rest/v1/campaign", json=payload, headers=hdrs, timeout=15)
    except Exception as e:
        return JSONResponse({"status": "error", "error": str(e)}, status_code=503)
    if r.status_code not in (200, 201):
        return JSONResponse({"status": "error", "error": f"Supabase: {r.text}"}, status_code=r.status_code)

    created = r.json()
    boxy_id = (created[0] if isinstance(created, list) else created).get("id")

    local_campaign = None
    if req.create_local and boxy_id:
        local_campaign = db.create_campaign(req.title, boxys_campaign_id=boxy_id)

    return {"status": "ok", "boxy_campaign": created[0] if isinstance(created, list) else created, "local_campaign": local_campaign}


@app.post("/api/boxys/publish")
def boxys_publish(req: PublishBoxyRequest, request: Request) -> dict:
    token = _get_token(request)

    creative = db.get_creative(req.creative_id)
    if not creative:
        return JSONResponse({"status": "error", "error": "Criativo não encontrado"}, status_code=404)

    # Lê o HTML do disco (preferível) ou usa a URL do Supabase
    html_content: Optional[str] = None
    local = creative.get("local_path")
    if local:
        html_path = Path(local)
        if html_path.exists():
            html_content = html_path.read_text(encoding="utf-8")
    if not html_content:
        url = creative.get("supabase_url", "")
        if url:
            html_content = f'<iframe src="{url}" style="width:100%;height:100%;border:none;display:block"></iframe>'

    # Resolve title/desc/message: explicit > linked copy > filename
    linked_copy = db.get_copy(creative["copy_id"]) if creative.get("copy_id") else None
    title = req.title or (linked_copy.get("title") if linked_copy else None) or creative.get("name") or "Criativo"
    description = (linked_copy.get("description") or "") if linked_copy else ""
    meta_message = (linked_copy.get("message") or "") if linked_copy else ""
    dimensions = f"{creative.get('width', 0)}x{creative.get('height', 0)}"

    headers = {**_sb_headers(token), "Prefer": "return=representation"}

    if req.type == "advertisement":
        payload = {
            "campaign_id": req.campaign_id,
            "title": title,
            "description": description or None,
            "meta_message": meta_message or None,
            "format": "html",
            "html_content": html_content,
            "dimensions": dimensions,
            "published": False,
        }
        table = "advertisements"
    elif req.type == "social_creative":
        payload = {
            "campaign_id": req.campaign_id,
            "title": title,
            "description": description or None,
            "format": "html",
            "html_content": html_content,
            "published": False,
        }
        table = "social_creatives"
    elif req.type == "landing_page":
        if not req.slug:
            return JSONResponse({"status": "error", "error": "slug é obrigatório para landing pages"}, status_code=400)
        payload = {
            "campaign_id": req.campaign_id,
            "slug": req.slug,
            "html": html_content or "",
            "published": False,
        }
        table = "landing_pages"
    else:
        return JSONResponse({"status": "error", "error": f"Tipo inválido: {req.type}"}, status_code=400)

    try:
        r = _requests.post(
            f"{_SB_URL}/rest/v1/{table}",
            json=payload,
            headers=headers,
            timeout=15,
        )
    except Exception as e:
        return JSONResponse({"status": "error", "error": str(e)}, status_code=503)

    if r.status_code not in (200, 201):
        return JSONResponse({"status": "error", "error": f"Supabase: {r.text}"}, status_code=r.status_code)

    created = r.json()
    if isinstance(created, list):
        created = created[0] if created else {}
    return {"status": "ok", "record": created}


# ---- Prompts ----

_PROMPT_LP = """\
# Prompt — Landing Page (Boxys)

---

**Antes de começar:** peça ao usuário por referências visuais, o link oficial do empreendimento (para baixar fotos), e qualquer arquivo adicional relevante (logo da construtora, plantas, etc.). Só inicie a construção após receber esse material.

---

## Copy do Empreendimento

```
[COLAR AQUI O OUTPUT DO APP BOXYS]
```

---

## Regras Técnicas

### Auto-contenção
- Todo CSS em `<style>` no `<head>`, todo JS em `<script>` antes do `</body>`
- Sem arquivos externos além das bibliotecas listadas abaixo

### Imagens externas
Toda imagem referenciada por URL externa deve ser **baixada localmente** antes de usar:

```bash
curl -o imagem.jpg "https://url-da-imagem.com/foto.jpg"
base64 -w 0 imagem.jpg
```

Inserir no HTML como `data:image/jpeg;base64,...`. Nunca referenciar URLs externas de imagens diretamente no HTML final.

### Bibliotecas disponíveis (carregar apenas as necessárias)

**GSAP:**
```html
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/gsap.min.js"></script>
<!-- Incluir somente se usar ScrollTrigger: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/ScrollTrigger.min.js"></script>
<!-- Incluir somente se usar ScrollSmoother: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/ScrollSmoother.min.js"></script>
<!-- Incluir somente se usar SplitText: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/SplitText.min.js"></script>
```

**MapLibre GL:**
```html
<link rel="stylesheet" href="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/maplibre-gl.css">
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/maplibre-gl.js"></script>
<!-- Incluir somente se precisar converter KML/GPX: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/togeojson.umd.js"></script>
```

**Swiper:**
```html
<link rel="stylesheet" href="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/swiper/swiper-bundle.min.css">
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/swiper/swiper-bundle.min.js"></script>
```

### Mapa (MapLibre)
- Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Centralizar nas coordenadas do empreendimento; adicionar marcador no ponto exato
- Container: `width: 100%; height: 450px`

### Carrossel (Swiper)
```js
new Swiper('.swiper', {
  loop: true,
  autoplay: { delay: 4000, disableOnInteraction: false },
  pagination: { el: '.swiper-pagination', clickable: true },
  navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
});
```

---

## Dados do Corretor

Usar exatamente estes placeholders em todos os locais de contato:

| Campo | Placeholder |
|---|---|
| Nome | `Nome do Corretor` |
| E-mail | `emaildocorretor@gmail.com` |
| Telefone | `00000000000` |
| Foto | `https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Imagens/profile.webp` |
| WhatsApp | `https://wa.me/5500000000000` |

> Formato do link: `55` + DDD + número, sem espaços ou caracteres especiais.

---

## Entrega

Arquivo: `index.html`

Verificar antes de concluir:
- [ ] Mapa carrega e centraliza no endereço correto
- [ ] Swiper com loop e autoplay funcionando
- [ ] Todos os links de WhatsApp apontam para `wa.me/5500000000000`
- [ ] Nenhuma imagem quebrada (todas base64 ou URL do Supabase)
- [ ] CSS e JS 100% embutidos no arquivo\
"""

_PROMPT_CRIATIVO = """\
# Prompt — Ad / Post (Boxys)

---

**Antes de começar:** peça ao usuário por referências visuais, o link oficial do empreendimento (para baixar fotos), o formato desejado e qualquer arquivo adicional relevante (logo da construtora, etc.). Só inicie a construção após receber esse material.

---

## Copy do Empreendimento

```
[COLAR AQUI O OUTPUT DO APP BOXYS]
```

---

## Regras Técnicas

### Auto-contenção
- Todo CSS em `<style>` no `<head>` — sem arquivos externos, sem JS

### Formato e dimensões
Incluir o meta `ad-size` e usar `aspect-ratio` + `max-width` no container principal:

| Formato | `max-width` | `aspect-ratio` | meta `ad-size` |
|---|---|---|---|
| Feed 1:1 | `1080px` | `1 / 1` | `1080x1080` |
| Post 4:5 | `1080px` | `4 / 5` | `1080x1350` |
| Stories / Reels 9:16 | `1080px` | `9 / 16` | `1080x1920` |
| Banner 1.91:1 | `1200px` | `1200 / 628` | `1200x628` |

```html
<meta name="ad-size" content="[WxH]">
```

```css
.container {
  width: 100%;
  max-width: [W]px;
  aspect-ratio: [W] / [H];
  height: auto;
  overflow: hidden;
}
```

### Imagens externas
Baixar localmente antes de usar:

```bash
curl -o imagem.jpg "https://url-da-imagem.com/foto.jpg"
base64 -w 0 imagem.jpg
```

Inserir no HTML como `data:image/jpeg;base64,...`. Nunca referenciar URLs externas de imagens diretamente no HTML final.

---

## Dados do Corretor

Usar exatamente estes placeholders em todos os locais de contato e assinatura do criativo:

| Campo | Placeholder |
|---|---|
| Nome | `Nome do Corretor` |
| E-mail | `emaildocorretor@gmail.com` |
| Telefone | `00000000000` |
| Foto | `https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Imagens/profile.webp` |
| WhatsApp | `https://wa.me/5500000000000` |

> Formato do link: `55` + DDD + número, sem espaços ou caracteres especiais.

---

## Entrega

Arquivo: `ad-[formato].html` (ex: `ad-feed.html`, `ad-stories.html`, `ad-banner.html`)

Verificar antes de concluir:
- [ ] `meta name="ad-size"` presente com as dimensões corretas
- [ ] `aspect-ratio` e `max-width` corretos para o formato
- [ ] `overflow: hidden` no container principal
- [ ] Nenhuma imagem referenciando URL externa
- [ ] Link de WhatsApp aponta para `wa.me/5500000000000`
- [ ] Sem JS\
"""


@app.get("/api/prompts/{prompt_type}")
def get_prompt(prompt_type: str) -> JSONResponse:
    prompt = _PROMPT_LP if prompt_type == "lp" else _PROMPT_CRIATIVO  # 'criativo' and 'search' both use the ad/post prompt
    return JSONResponse({"status": "ok", "prompt": prompt})


# ---- Figma browse ----

@app.post("/api/browse")
def browse(req: BrowseRequest) -> JSONResponse:
    try:
        figma = FigmaApiSource(FigmaConfig.from_env())
    except RuntimeError as exc:
        return JSONResponse({"status": "config_error", "error": str(exc)}, status_code=400)
    try:
        file_key = parse_file_key(req.file_key)
        frames = figma.get_file_frames(file_key)
        return JSONResponse({"status": "ok", "frames": frames})
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"status": "error", "error": str(exc)}, status_code=500)


# ---- Convert ----

@app.post("/api/convert_batch")
def convert_batch(req: BatchRequest) -> JSONResponse:
    try:
        figma = FigmaApiSource(FigmaConfig.from_env())
        uploader = SupabaseUploader(SupabaseConfig.from_env()) if req.upload else None
    except RuntimeError as exc:
        return JSONResponse({"status": "config_error", "error": str(exc)}, status_code=400)

    try:
        # If copy_id supplied, fill missing metatags from the copy
        title, desc, message = req.title, req.desc, req.message
        if req.copy_id and not (title and desc and message):
            copy = db.get_copy(req.copy_id)
            if copy:
                if not title:
                    title = copy.get("title", "")
                if not desc:
                    desc = copy.get("description", "")
                if not message:
                    message = copy.get("message", "")

        file_key = parse_file_key(req.file_key)
        node_ids = [parse_node_id(n) for n in req.node_ids if n.strip()]
        results = build_batch(
            file_key, node_ids, figma, uploader, str(OUTPUT_DIR),
            upload=req.upload, scale=req.scale, campaign=req.campaign,
            title=title, desc=desc, message=message,
        )
        from ..generate import build_manifest
        camp = campaign_slug(req.campaign)
        camp_seg = f"{camp}/" if camp else ""
        cid_list = req.creative_ids or []  # existing creative IDs for publish step
        out = []
        for i, r in enumerate(results):
            existing_cid = cid_list[i] if i < len(cid_list) else None
            if r.status == "ok" and r.template is not None:
                rel = f"{camp_seg}{r.template_id}/{r.template.format_label}/index.html"
                entry = {
                    "status": "ok", "node_id": r.node_id, "template_id": r.template_id,
                    "format": r.template.format_label, "preview_url": f"/preview/{rel}",
                    "manifest": build_manifest(r.template), "uploaded": r.uploaded,
                    "flattened": r.flattened, "slots_count": r.slots_count,
                    "backgrounds_count": r.backgrounds_count, "warnings": r.warnings,
                    "timings": r.timings, "campaign": camp,
                }
                if req.campaign_id:
                    thumbnail_url = next(
                        (l.asset_url for l in r.template.layers if l.asset_url), ""
                    )
                    manifest_str = _json.dumps(build_manifest(r.template))
                    local = str(OUTPUT_DIR / rel)
                    if existing_cid:
                        creative = db.update_creative(
                            existing_cid,
                            supabase_url=thumbnail_url,
                            thumbnail_url=thumbnail_url,
                            manifest_json=manifest_str,
                            local_path=local,
                        )
                    else:
                        creative = db.create_creative(
                            campaign_id=req.campaign_id,
                            type="html",
                            name=r.template_id,
                            local_path=local,
                            supabase_url=thumbnail_url,
                            thumbnail_url=thumbnail_url,
                            width=r.template.width,
                            height=r.template.height,
                            figma_node_id=r.node_id,
                            format_label=r.template.format_label,
                            manifest_json=manifest_str,
                            copy_id=req.copy_id,
                        )
                    if creative:
                        entry["creative_id"] = creative["id"]
                out.append(entry)
            else:
                out.append({"status": "error", "node_id": r.node_id, "error": r.error})

        if req.campaign_id:
            db.touch_campaign(req.campaign_id)

        return JSONResponse({"status": "ok", "results": out, "campaign": camp})
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"status": "error", "error": str(exc)}, status_code=500)


@app.post("/api/convert")
def convert(req: ConvertRequest) -> JSONResponse:
    try:
        figma = FigmaApiSource(FigmaConfig.from_env())
        uploader = SupabaseUploader(SupabaseConfig.from_env()) if req.upload else None
    except RuntimeError as exc:
        return JSONResponse(
            {"status": "config_error", "node_id": req.node_id, "error": str(exc)},
            status_code=400,
        )

    try:
        file_key = parse_file_key(req.file_key)
        node_id = parse_node_id(req.node_id)
        raw = figma.get_node(file_key, node_id)
        template = normalize(raw, file_key=file_key)
        template.title = req.title
        template.desc = req.desc
        template.message = req.message
        result = build_from_template(
            template, figma, uploader, str(OUTPUT_DIR),
            upload=req.upload, scale=req.scale, campaign=req.campaign,
        )
        rel = f"{template.template_id}/{template.format_label}/index.html"
        from ..generate import build_manifest
        manifest = build_manifest(template)

        response: dict = {
            "status": "ok",
            "node_id": req.node_id,
            "template_id": template.template_id,
            "format": template.format_label,
            "preview_url": f"/preview/{rel}",
            "manifest": manifest,
            "uploaded": result.uploaded,
            "flattened": result.flattened,
            "slots_count": result.slots_count,
            "backgrounds_count": result.backgrounds_count,
            "warnings": result.warnings,
        }

        if req.campaign_id:
            thumbnail_url = next(
                (l.asset_url for l in template.layers if l.asset_url), ""
            )
            creative = db.create_creative(
                campaign_id=req.campaign_id,
                type="html",
                name=template.template_id,
                local_path=str(OUTPUT_DIR / rel),
                supabase_url=thumbnail_url,
                thumbnail_url=thumbnail_url,
                width=template.width,
                height=template.height,
                figma_node_id=req.node_id,
                format_label=template.format_label,
                manifest_json=_json.dumps(manifest),
            )
            response["creative_id"] = creative["id"]
            db.touch_campaign(req.campaign_id)

        return JSONResponse(response)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            {"status": "error", "node_id": req.node_id, "error": str(exc)},
            status_code=500,
        )


# ---- HTML import helpers ----

class _AdHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta: dict = {}
        self.images: list = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "meta":
            name = d.get("name", "")
            content = d.get("content", "")
            if name in ("title", "desc", "message"):
                self.meta[name] = content
            elif name == "ad-size":
                parts = content.split("x")
                if len(parts) == 2:
                    try:
                        self.meta["width"] = int(parts[0])
                        self.meta["height"] = int(parts[1])
                        self.meta["format_label"] = content
                    except ValueError:
                        pass
        elif tag == "img":
            src = d.get("src", "")
            if src and not src.startswith("data:"):
                self.images.append(src)


def _parse_html_ad(html: str) -> dict:
    p = _AdHTMLParser()
    p.feed(html)
    return {
        "title": p.meta.get("title", ""),
        "desc": p.meta.get("desc", ""),
        "message": p.meta.get("message", ""),
        "format_label": p.meta.get("format_label", ""),
        "width": p.meta.get("width", 0),
        "height": p.meta.get("height", 0),
        "images": p.images,
    }


def _update_meta_tag(html: str, name: str, value: str) -> str:
    pattern = rf'<meta\s+name="{re.escape(name)}"\s+content="[^"]*"'
    replacement = f'<meta name="{name}" content="{value}"'
    if re.search(pattern, html):
        return re.sub(pattern, replacement, html)
    return html.replace("</head>", f'  <meta name="{name}" content="{value}">\n</head>', 1)


def _replace_img_src(html: str, old_url: str, new_url: str) -> str:
    return html.replace(f'src="{old_url}"', f'src="{new_url}"')


def _extract_meta_copy_id(html: str) -> Optional[str]:
    """Read <meta name='copy-id' content='...'> or <meta name='id' content='...'>."""
    import re as _re
    m = _re.search(r'<meta\s[^>]*name=["\'](?:copy-id|id)["\'][^>]*content=["\']([^"\']+)["\']', html, _re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = _re.search(r'<meta\s[^>]*content=["\']([^"\']+)["\'][^>]*name=["\'](?:copy-id|id)["\']', html, _re.IGNORECASE)
    return m.group(1).strip() if m else None


# ---- Creative download ----

@app.get("/api/creatives/{creative_id}/download")
def download_creative(creative_id: int):
    creative = db.get_creative(creative_id)
    if not creative:
        return JSONResponse({"status": "error", "error": "Criativo não encontrado"}, status_code=404)
    local = creative.get("local_path", "")
    if not local or not Path(local).exists():
        return JSONResponse({"status": "error", "error": "Arquivo não encontrado"}, status_code=404)
    filename = f"{creative['name'] or 'creative'}_{creative['format_label'] or 'html'}.html"
    filename = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
    return FileResponse(local, media_type="text/html",
                        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---- Campaigns ----

@app.get("/api/campaigns")
def list_campaigns() -> JSONResponse:
    return JSONResponse({"status": "ok", "campaigns": db.list_campaigns()})


@app.post("/api/campaigns")
def create_campaign(req: CreateCampaignRequest) -> JSONResponse:
    campaign = db.create_campaign(req.name, req.figma_file_key, req.boxys_campaign_id)
    return JSONResponse({"status": "ok", "campaign": campaign})


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: int) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    creatives = db.list_creatives(campaign_id)
    carousels = db.list_carousels(campaign_id)
    copies = db.list_copies(campaign_id)
    return JSONResponse({
        "status": "ok",
        "campaign": campaign,
        "creatives": creatives,
        "carousels": carousels,
        "copies": copies,
    })


@app.put("/api/campaigns/{campaign_id}")
def update_campaign(campaign_id: int, req: UpdateCampaignRequest) -> JSONResponse:
    campaign = db.update_campaign(
        campaign_id,
        name=req.name,
        figma_file_key=req.figma_file_key,
        briefing_text=req.briefing_text,
        ia_config=req.ia_config,
        campaign_title=req.campaign_title,
        general_description=req.general_description,
        basic_copy=req.basic_copy,
        explanation_video_url=req.explanation_video_url,
        traffic_video_url=req.traffic_video_url,
        verso_config=req.verso_config,
        thumb_url=req.thumb_url,
        featured_image_url=req.featured_image_url,
        traffic_config=req.traffic_config,
    )
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok", "campaign": campaign})


@app.delete("/api/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int) -> JSONResponse:
    ok = db.delete_campaign(campaign_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok"})


# ---- Search Ads ----

class SearchAdsPayload(BaseModel):
    titles: str = ""
    descriptions: str = ""
    keywords: str = ""


@app.get("/api/campaigns/{campaign_id}/search")
def get_search_ads(campaign_id: int) -> JSONResponse:
    data = db.get_search_ads(campaign_id)
    return JSONResponse({"status": "ok", "search": data})


@app.put("/api/campaigns/{campaign_id}/search")
def update_search_ads(campaign_id: int, req: SearchAdsPayload) -> JSONResponse:
    ok = db.update_search_ads(campaign_id, {"titles": req.titles, "descriptions": req.descriptions, "keywords": req.keywords})
    if not ok:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok"})


# ---- Creatives ----

class UpdateCreativeCopyRequest(BaseModel):
    copy_id: Optional[int] = None  # None means remove association


@app.put("/api/creatives/{creative_id}/copy")
def set_creative_copy(creative_id: int, req: UpdateCreativeCopyRequest) -> JSONResponse:
    creative = db.get_creative(creative_id)
    if not creative:
        return JSONResponse({"status": "error", "error": "Criativo não encontrado"}, status_code=404)
    updated = db.update_creative(
        creative_id,
        copy_id=req.copy_id if req.copy_id else None,
        clear_copy=(req.copy_id is None),
    )
    return JSONResponse({"status": "ok", "creative": updated})


@app.put("/api/creatives/{creative_id}")
def update_creative(creative_id: int, req: UpdateCreativeRequest) -> JSONResponse:
    creative = db.get_creative(creative_id)
    if not creative:
        return JSONResponse({"status": "error", "error": "Criativo não encontrado"}, status_code=404)
    updated = db.set_creative_destination(creative_id, req.destination)
    return JSONResponse({"status": "ok", "creative": updated})


@app.delete("/api/creatives/{creative_id}")
def delete_creative(creative_id: int) -> JSONResponse:
    ok = db.delete_creative(creative_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Criativo não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok"})


# ---- Copies ----

@app.post("/api/campaigns/{campaign_id}/copies")
def create_copy(campaign_id: int, req: CreateCopyRequest) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    copy = db.create_copy(campaign_id, req.name, req.title, req.description, req.message, req.content_html, type=req.type, content=req.content)
    return JSONResponse({"status": "ok", "copy": copy})


@app.get("/api/copies/{copy_id}")
def get_copy(copy_id: int) -> JSONResponse:
    copy = db.get_copy(copy_id)
    if not copy:
        return JSONResponse({"status": "error", "error": "Copy não encontrada"}, status_code=404)
    copy["creative_count"] = len([c for c in db.list_creatives(copy.get("campaign_id", 0)) if c.get("copy_id") == copy_id])
    return JSONResponse({"status": "ok", "copy": copy})


@app.put("/api/copies/{copy_id}")
def update_copy(copy_id: int, req: UpdateCopyRequest) -> JSONResponse:
    copy = db.update_copy(copy_id, req.name, req.title, req.description, req.message, req.content_html, type=req.type, content=req.content)
    if not copy:
        return JSONResponse({"status": "error", "error": "Copy não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok", "copy": copy})


class ImportCopiesRequest(BaseModel):
    text: str
    type: str = "auto"  # 'auto' (detect from ID), 'criativo', 'landing_page', 'search'


@app.post("/api/campaigns/{campaign_id}/copies/import")
def import_copies(campaign_id: int, req: ImportCopiesRequest) -> JSONResponse:
    """Parse a structured text document and bulk-create copies.

    Supports both plain format (id:/titulo:/descricao:/mensagem:/conteudo:)
    and the rich document format with accents (Descrição:, Conteúdo:, Mensagem/CTA:)
    and optional Variação: headers before each block.
    """
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)

    import re as _re
    import unicodedata

    def _norm(s: str) -> str:
        """Lowercase + strip accents for field name matching."""
        return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()

    text = req.text.strip()

    # Split blocks: prefer Variação: as delimiter (real doc format), fallback to id: only
    variac_starts = [m.start() for m in _re.finditer(r'(?im)^varia[cç][aã]o\s*:', text)]
    if variac_starts:
        block_starts = variac_starts
    else:
        block_starts = [m.start() for m in _re.finditer(r'(?im)^id\s*:', text)]

    if not block_starts:
        return JSONResponse({"status": "error", "error": "Nenhum bloco encontrado (esperado 'Variação:' ou 'id:')"}, status_code=400)

    blocks = []
    for i, start in enumerate(block_starts):
        end = block_starts[i + 1] if i + 1 < len(block_starts) else len(text)
        blocks.append(text[start:end].strip())

    # Known field aliases — normalized (no accent, lowercase) → canonical name
    _FIELD_ALIASES = {
        "id": "id",
        "titulo": "titulo",
        "descricao": "descricao",
        "mensagem": "mensagem",
        "mensagem/cta": "mensagem",
        "conteudo": "conteudo",
        "variacao": "variacao",
    }
    # Regex to find any known field label at line start
    _FIELD_PAT = _re.compile(
        r'(?im)^([A-Za-zÀ-ÿ/]+)\s*:\s*(.*?)(?=\n[A-Za-zÀ-ÿ/]+\s*:|\Z)',
        _re.DOTALL,
    )

    def parse_block(block_text: str) -> dict:
        fields: dict = {}
        for m in _FIELD_PAT.finditer(block_text):
            raw_key = m.group(1).strip()
            norm_key = _norm(raw_key)
            canonical = _FIELD_ALIASES.get(norm_key)
            if canonical and canonical not in fields:
                fields[canonical] = m.group(2).strip()
        return fields

    # Regex to detect the standard ID convention: [CAMP]-[CANAL]-[FORMAT][NN]
    # Canal: M, G, S, A  |  Format: E, C, S, V, T
    _ID_PAT = _re.compile(r'^[A-Z0-9]+-([MGSA])-([ECSVT])\d+$', _re.IGNORECASE)

    def _detect_type(copy_id: str) -> str:
        """Derive copy type from standardized ID. Format 'S' = search, rest = criativo."""
        m = _ID_PAT.match(copy_id.strip())
        if m:
            fmt = m.group(2).upper()
            return "search" if fmt == "S" else "criativo"
        return "criativo"

    created = []
    errors = []
    for block in blocks:
        parsed = parse_block(block)
        copy_ref_id = parsed.get("id", "").strip()
        if not copy_ref_id:
            errors.append(f"Bloco sem id: {block[:60]!r}")
            continue

        content = parsed.get("conteudo", "")

        # Resolve type: explicit override wins, otherwise auto-detect from ID
        if req.type in ("criativo", "landing_page", "search"):
            block_type = req.type
        else:
            block_type = _detect_type(copy_ref_id)

        if block_type == "landing_page":
            cp = db.create_copy(
                campaign_id=campaign_id,
                name=copy_ref_id,
                type="landing_page",
                content=content,
            )
        else:
            titulo = parsed.get("titulo", "")
            descricao = parsed.get("descricao", "")
            mensagem = parsed.get("mensagem", "")
            cp = db.create_copy(
                campaign_id=campaign_id,
                name=copy_ref_id,
                title=titulo,
                description=descricao,
                message=mensagem,
                type=block_type,
                content=content,
            )
        created.append(cp)

    db.touch_campaign(campaign_id)
    return JSONResponse({"status": "ok", "created": len(created), "copies": created, "errors": errors})


@app.delete("/api/copies/{copy_id}")
def delete_copy(copy_id: int) -> JSONResponse:
    ok = db.delete_copy(copy_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Copy não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok"})


@app.post("/api/campaigns/{campaign_id}/images")
async def upload_campaign_image(
    campaign_id: int,
    field: str = Form(...),  # 'thumb_url' or 'featured_image_url'
    file: UploadFile = File(...),
) -> JSONResponse:
    """Upload campaign image (thumb or featured). Returns updated campaign."""
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    if field not in ("thumb_url", "featured_image_url"):
        return JSONResponse({"status": "error", "error": "Campo inválido"}, status_code=400)

    upload_dir = OUTPUT_DIR / "campaign-images" / str(campaign_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "image").strip("_")
    dest = upload_dir / f"{field}_{safe_name}"
    data = await file.read()
    dest.write_bytes(data)
    url = f"/preview/campaign-images/{campaign_id}/{dest.name}"
    kwargs = {field: url}
    updated = db.update_campaign(campaign_id, **kwargs)
    return JSONResponse({"status": "ok", "campaign": updated, "url": url})


@app.post("/api/campaigns/{campaign_id}/upload")
async def upload_creative(campaign_id: int, file: UploadFile = File(...)) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)

    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        ctype = "image"
    elif content_type.startswith("video/"):
        ctype = "video"
    else:
        return JSONResponse({"status": "error", "error": "Tipo de arquivo não suportado"}, status_code=400)

    upload_dir = OUTPUT_DIR / "uploads" / str(campaign_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "file").strip("_")
    dest = upload_dir / safe_name
    counter = 1
    while dest.exists():
        stem, suffix = safe_name.rsplit(".", 1) if "." in safe_name else (safe_name, "")
        dest = upload_dir / f"{stem}_{counter}.{suffix}" if suffix else upload_dir / f"{safe_name}_{counter}"
        counter += 1

    data = await file.read()
    dest.write_bytes(data)

    preview_url = f"/preview/uploads/{campaign_id}/{dest.name}"
    creative = db.create_creative(
        campaign_id=campaign_id,
        type=ctype,
        name=dest.stem,
        local_path=str(dest),
        supabase_url="",
        thumbnail_url=preview_url if ctype == "image" else "",
        width=0,
        height=0,
    )
    db.touch_campaign(campaign_id)
    return JSONResponse({"status": "ok", "creative": creative})


# ---- HTML import ----

@app.post("/api/campaigns/{campaign_id}/parse-html")
async def parse_html_endpoint(campaign_id: int, file: UploadFile = File(...)) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    content = (await file.read()).decode("utf-8", errors="replace")
    parsed = _parse_html_ad(content)
    supabase_base = os.environ.get("SUPABASE_URL", "")
    images_info = [
        {"url": u, "in_supabase": bool(supabase_base and u.startswith(supabase_base))}
        for u in parsed["images"]
    ]
    return JSONResponse({
        "status": "ok",
        "meta": {
            "title": parsed["title"], "desc": parsed["desc"],
            "message": parsed["message"], "format_label": parsed["format_label"],
            "width": parsed["width"], "height": parsed["height"],
        },
        "images": images_info,
        "filename": file.filename or "import.html",
    })


@app.post("/api/campaigns/{campaign_id}/import-html")
async def import_html_endpoint(
    campaign_id: int,
    file: UploadFile = File(...),
    title: str = Form(""),
    desc: str = Form(""),
    message: str = Form(""),
    upload: bool = Form(True),
    creative_type: str = Form("html"),
) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)

    content = (await file.read()).decode("utf-8", errors="replace")
    parsed = _parse_html_ad(content)
    html = content

    # Update meta tags with user-supplied values
    for name, val in (("title", title), ("desc", desc), ("message", message)):
        if val:
            html = _update_meta_tag(html, name, val)

    thumbnail_url = ""
    supabase_base = os.environ.get("SUPABASE_URL", "")

    if upload:
        try:
            uploader = SupabaseUploader(SupabaseConfig.from_env())
            camp = campaign_slug(campaign["name"])
            stem = re.sub(r"[^A-Za-z0-9_-]+", "_", Path(file.filename or "import").stem)
            for i, img_url in enumerate(parsed["images"]):
                if supabase_base and img_url.startswith(supabase_base):
                    if not thumbnail_url:
                        thumbnail_url = img_url
                    continue
                try:
                    resp = _requests.get(img_url, timeout=30)
                    if resp.ok:
                        new_url = uploader.upload_png(
                            f"{camp}/{stem}/img_{i}.png", resp.content
                        )
                        html = _replace_img_src(html, img_url, new_url)
                        if not thumbnail_url:
                            thumbnail_url = new_url
                except Exception:  # noqa: BLE001
                    pass
        except RuntimeError:
            pass

    # Save HTML locally
    fmt = parsed["format_label"] or "imported"
    stem_name = re.sub(r"[^A-Za-z0-9_-]+", "_", Path(file.filename or "import").stem)
    camp_seg = f"{campaign_slug(campaign['name'])}/" if campaign["name"] else ""
    dest_dir = OUTPUT_DIR / f"{camp_seg}{stem_name}/{fmt}"
    dest_dir.mkdir(parents=True, exist_ok=True)
    html_path = dest_dir / "index.html"
    html_path.write_text(html, encoding="utf-8")

    # Auto-associate with copy by copy-id metatag
    matched_copy_id = None
    meta_copy_ref = _extract_meta_copy_id(html)
    if meta_copy_ref:
        camp_copies = db.list_copies(campaign_id)
        for cp in camp_copies:
            if cp["name"] == meta_copy_ref:
                matched_copy_id = cp["id"]
                break

    # Auto-create copy from meta tag data when no copy was matched
    if matched_copy_id is None:
        final_title = title or parsed.get("title", "")
        final_desc = desc or parsed.get("desc", "")
        final_message = message or parsed.get("message", "")
        if final_title or final_desc or final_message:
            new_copy = db.create_copy(
                campaign_id=campaign_id,
                name=stem_name,
                title=final_title,
                description=final_desc,
                message=final_message,
                type="criativo",
            )
            matched_copy_id = new_copy["id"]

    allowed_types = {"html", "landing_page"}
    ctype = creative_type if creative_type in allowed_types else "html"
    creative = db.create_creative(
        campaign_id=campaign_id,
        type=ctype,
        name=stem_name,
        local_path=str(html_path),
        supabase_url=thumbnail_url,
        thumbnail_url=thumbnail_url,
        width=parsed["width"],
        height=parsed["height"],
        format_label=fmt,
        manifest_json="",
        copy_id=matched_copy_id,
    )
    db.touch_campaign(campaign_id)
    return JSONResponse({"status": "ok", "creative": creative})


# ---- Carousels ----

@app.post("/api/campaigns/{campaign_id}/carousels")
def create_carousel(campaign_id: int, req: CreateCarouselRequest) -> JSONResponse:
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    carousel = db.create_carousel(campaign_id, req.name)
    carousel["items"] = []
    carousel["item_count"] = 0
    return JSONResponse({"status": "ok", "carousel": carousel})


@app.delete("/api/carousels/{carousel_id}")
def delete_carousel(carousel_id: int) -> JSONResponse:
    ok = db.delete_carousel(carousel_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok"})


@app.post("/api/carousels/{carousel_id}/items")
def add_carousel_item(carousel_id: int, req: AddCarouselItemRequest) -> JSONResponse:
    carousel = db.get_carousel(carousel_id)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    item = db.add_carousel_item(carousel_id, req.creative_id)
    return JSONResponse({"status": "ok", "item": item})


@app.delete("/api/carousel-items/{item_id}")
def remove_carousel_item(item_id: int) -> JSONResponse:
    ok = db.remove_carousel_item(item_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Item não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok"})


@app.put("/api/carousels/{carousel_id}")
def update_carousel(carousel_id: int, req: UpdateCarouselRequest) -> JSONResponse:
    carousel = db.update_carousel(carousel_id, name=req.name, destination=req.destination)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok", "carousel": carousel})


@app.put("/api/carousels/{carousel_id}/order")
def reorder_carousel(carousel_id: int, req: ReorderCarouselRequest) -> JSONResponse:
    carousel = db.get_carousel(carousel_id)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    db.reorder_carousel_items(carousel_id, req.ordered_item_ids)
    return JSONResponse({"status": "ok", "items": db.get_carousel_items(carousel_id)})


# ---- Carousel assets (new model: assets uploaded directly into carousel) ----

@app.post("/api/carousels/{carousel_id}/assets")
async def upload_carousel_asset(carousel_id: int, file: UploadFile = File(...)) -> JSONResponse:
    carousel = db.get_carousel(carousel_id)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)

    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        asset_type = "image"
    elif content_type == "text/html" or (file.filename or "").endswith((".html", ".htm")):
        asset_type = "html"
    else:
        return JSONResponse({"status": "error", "error": "Tipo não suportado (image ou html)"}, status_code=400)

    upload_dir = OUTPUT_DIR / "carousel-assets" / str(carousel_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "file").strip("_")
    dest = upload_dir / safe_name
    counter = 1
    while dest.exists():
        stem, suffix = safe_name.rsplit(".", 1) if "." in safe_name else (safe_name, "")
        dest = upload_dir / (f"{stem}_{counter}.{suffix}" if suffix else f"{safe_name}_{counter}")
        counter += 1

    data = await file.read()
    dest.write_bytes(data)

    if asset_type == "image":
        file_url = f"/preview/carousel-assets/{carousel_id}/{dest.name}"
        asset = db.create_carousel_asset(carousel_id, "image", file_url=file_url, thumbnail_url=file_url)
    else:
        html_content = data.decode("utf-8", errors="replace")
        parsed = _parse_html_ad(html_content)
        file_url = f"/preview/carousel-assets/{carousel_id}/{dest.name}"
        asset = db.create_carousel_asset(
            carousel_id, "html",
            file_url=file_url,
            html_content=html_content,
            thumbnail_url=file_url,
        )

    return JSONResponse({"status": "ok", "asset": asset})


@app.put("/api/carousel-assets/{asset_id}")
def update_carousel_asset(asset_id: int, req: UpdateCarouselAssetRequest) -> JSONResponse:
    asset = db.update_carousel_asset(asset_id, caption=req.caption)
    if not asset:
        return JSONResponse({"status": "error", "error": "Asset não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok", "asset": asset})


@app.delete("/api/carousel-assets/{asset_id}")
def delete_carousel_asset(asset_id: int) -> JSONResponse:
    ok = db.delete_carousel_asset(asset_id)
    if not ok:
        return JSONResponse({"status": "error", "error": "Asset não encontrado"}, status_code=404)
    return JSONResponse({"status": "ok"})


@app.put("/api/carousels/{carousel_id}/assets/order")
def reorder_carousel_assets(carousel_id: int, req: ReorderCarouselAssetsRequest) -> JSONResponse:
    carousel = db.get_carousel(carousel_id)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    assets = db.reorder_carousel_assets(carousel_id, req.ordered_asset_ids)
    return JSONResponse({"status": "ok", "assets": assets})


# ---- ZIP export ----

def _extract_first_frame(video_data: bytes) -> Optional[bytes]:
    """Extract first frame from video bytes as JPEG using ffmpeg."""
    src = dst = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(video_data)
            src = f.name
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            dst = f.name
        result = subprocess.run(
            ["ffmpeg", "-i", src, "-vframes", "1", "-q:v", "2", "-y", dst],
            capture_output=True, timeout=30,
        )
        if result.returncode == 0 and Path(dst).exists() and Path(dst).stat().st_size > 0:
            return Path(dst).read_bytes()
    except Exception:  # noqa: BLE001
        pass
    finally:
        for p in (src, dst):
            if p:
                try:
                    os.unlink(p)
                except OSError:
                    pass
    return None


@app.post("/api/export/zip")
def export_zip(req: ZipExportRequest) -> StreamingResponse:
    buf = io.BytesIO()
    slug = re.sub(r"[^a-z0-9]+", "-", req.title.lower()).strip("-") or "export"

    def _fetch_bytes(creative: dict) -> bytes | None:
        local = creative.get("local_path", "")
        if local and Path(local).exists():
            return Path(local).read_bytes()
        url = creative.get("supabase_url", "") or creative.get("thumbnail_url", "")
        if url and url.startswith("http"):
            try:
                return _requests.get(url, timeout=30).content
            except Exception:  # noqa: BLE001
                return None
        return None

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if req.format == "carousel":
            items_manifest = []
            for i, cid in enumerate(req.creative_ids, start=1):
                creative = db.get_creative(cid)
                if not creative:
                    continue
                ext = "html" if creative["type"] == "html" else (
                    "mp4" if creative["type"] == "video" else "jpg"
                )
                fname = f"slide{i}.{ext}"
                data = _fetch_bytes(creative)
                if data:
                    zf.writestr(fname, data)
                items_manifest.append({"file": fname, "caption": creative["name"]})

            manifest = {
                "format": "carousel",
                "carousel_variant": req.carousel_variant,
                "title": req.title,
                "description": req.description,
                "message": req.message,
                "items": items_manifest,
            }

        elif req.format == "video":
            manifest = {
                "format": "video",
                "title": req.title,
                "description": req.description,
                "message": req.message,
                "video": "tour.mp4",
                "cover": "capa.jpg",
            }
            video_data: Optional[bytes] = None
            if req.video_creative_id:
                video = db.get_creative(req.video_creative_id)
                if video:
                    video_data = _fetch_bytes(video)
                    if video_data:
                        zf.writestr("tour.mp4", video_data)

            # Auto-extract first frame as cover
            cover_data: Optional[bytes] = None
            if video_data:
                cover_data = _extract_first_frame(video_data)
            if cover_data:
                zf.writestr("capa.jpg", cover_data)
        else:
            manifest = {"format": req.format, "title": req.title,
                        "description": req.description, "message": req.message}

        zf.writestr("manifest.json", _json.dumps(manifest, ensure_ascii=False, indent=2))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}.zip"'},
    )


# ---- Preview static mount ----
app.mount("/preview", StaticFiles(directory=str(OUTPUT_DIR), html=True), name="preview")

# ---- React frontend assets (produção) ----
_assets_dir = STATIC_DIR / "assets"
if _assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="react-assets")

# ---- SPA catch-all: serve index.html para qualquer rota não reconhecida ----
from starlette.routing import Route as _Route

@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str) -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
