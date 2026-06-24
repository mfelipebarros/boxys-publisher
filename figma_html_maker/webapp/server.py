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

from fastapi import FastAPI, Form, UploadFile, File
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
STATIC_DIR = HERE / "static"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "./output")).resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

db._migrate()

app = FastAPI(title="Boxys · Figma → HTML")


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


class UpdateCampaignRequest(BaseModel):
    name: Optional[str] = None
    figma_file_key: Optional[str] = None


class CreateCarouselRequest(BaseModel):
    name: str


class AddCarouselItemRequest(BaseModel):
    creative_id: int


class ReorderCarouselRequest(BaseModel):
    ordered_item_ids: List[int]


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
    }


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
    campaign = db.create_campaign(req.name, req.figma_file_key)
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
    campaign = db.update_campaign(campaign_id, req.name, req.figma_file_key)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)
    return JSONResponse({"status": "ok", "campaign": campaign})


@app.delete("/api/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int) -> JSONResponse:
    ok = db.delete_campaign(campaign_id)
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
    type: str = "criativo"  # 'criativo' or 'landing_page'


@app.post("/api/campaigns/{campaign_id}/copies/import")
def import_copies(campaign_id: int, req: ImportCopiesRequest) -> JSONResponse:
    """Parse a structured text document and bulk-create copies.

    Format for 'criativo':
        id: 1
        titulo: Titulo do anuncio
        descricao: Descricao completa
        mensagem: CTA texto
        conteudo: Conteudo de referencia para designers

        id: 2
        ...

    Format for 'landing_page':
        id: 1
        conteudo: Conteudo de referencia

        id: 2
        ...

    Blocks are separated by blank lines or by a new 'id:' line.
    """
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        return JSONResponse({"status": "error", "error": "Campanha não encontrada"}, status_code=404)

    import re as _re
    text = req.text.strip()

    # Split into blocks by finding 'id:' markers
    # Each block starts at an 'id:' line
    block_starts = [m.start() for m in _re.finditer(r'(?im)^id\s*:', text)]
    if not block_starts:
        return JSONResponse({"status": "error", "error": "Nenhum bloco com 'id:' encontrado"}, status_code=400)

    blocks = []
    for i, start in enumerate(block_starts):
        end = block_starts[i + 1] if i + 1 < len(block_starts) else len(text)
        blocks.append(text[start:end].strip())

    def extract_field(block_text: str, field: str) -> str:
        """Extract field value, supporting multi-line values until next field or end."""
        pattern = _re.compile(
            rf'(?im)^{_re.escape(field)}\s*:\s*(.*?)(?=\n\s*(?:id|titulo|descricao|mensagem|conteudo)\s*:|$)',
            _re.DOTALL
        )
        m = pattern.search(block_text)
        if not m:
            return ""
        return m.group(1).strip()

    created = []
    errors = []
    for block in blocks:
        copy_ref_id = extract_field(block, "id")
        if not copy_ref_id:
            errors.append(f"Bloco sem id: {block[:40]!r}")
            continue

        content = extract_field(block, "conteudo")

        if req.type == "landing_page":
            cp = db.create_copy(
                campaign_id=campaign_id,
                name=copy_ref_id,
                type="landing_page",
                content=content,
            )
        else:
            titulo = extract_field(block, "titulo")
            descricao = extract_field(block, "descricao")
            mensagem = extract_field(block, "mensagem")
            cp = db.create_copy(
                campaign_id=campaign_id,
                name=copy_ref_id,
                title=titulo,
                description=descricao,
                message=mensagem,
                type="criativo",
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

    creative = db.create_creative(
        campaign_id=campaign_id,
        type="html",
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


@app.put("/api/carousels/{carousel_id}/order")
def reorder_carousel(carousel_id: int, req: ReorderCarouselRequest) -> JSONResponse:
    carousel = db.get_carousel(carousel_id)
    if not carousel:
        return JSONResponse({"status": "error", "error": "Carrossel não encontrado"}, status_code=404)
    db.reorder_carousel_items(carousel_id, req.ordered_item_ids)
    return JSONResponse({"status": "ok", "items": db.get_carousel_items(carousel_id)})


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
