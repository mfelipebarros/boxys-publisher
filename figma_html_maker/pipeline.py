"""Orquestrador: fonte -> normalize -> imagens -> gera HTML + manifesto.

Projetado para volume (dezenas de criativos por campanha):
- Em lote, busca todos os frames numa chamada ao Figma e exporta todas as imagens
  numa chamada só, depois faz download+upload EM PARALELO (trabalho I/O-bound).
- Mede o tempo de cada etapa (timings) para diagnosticar gargalos.

Modos: upload=False (pré-visualizar, usa URLs temporárias do Figma) e upload=True
(publicar no Supabase). Fallback de achatar o frame quando não há convenção.
"""

from __future__ import annotations

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from .generate import manifest_json, render_html
from .model import Layer, Role, Template
from .sources.figma_api import FigmaApiSource
from .storage.supabase import SupabaseUploader

_MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "8"))


def campaign_slug(name: str) -> str:
    s = (name or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_")


@dataclass
class BuildResult:
    template_id: str
    node_id: str = ""
    status: str = "ok"
    error: str = ""
    html_path: str = ""
    manifest_path: str = ""
    images: dict[str, str] = field(default_factory=dict)
    slots_count: int = 0
    backgrounds_count: int = 0
    flattened: bool = False
    uploaded: bool = False
    warnings: list[str] = field(default_factory=list)
    timings: dict[str, float] = field(default_factory=dict)
    template: Template | None = None


def _image_layers(template: Template) -> list[Layer]:
    return [l for l in template.layers if l.is_image]


def _add_flattened_background(template: Template) -> Layer:
    flat = Layer(
        id=template.figma_node_id, name="bg_frame", role=Role.BACKGROUND,
        x=0, y=0, width=template.width, height=template.height, is_image=True,
    )
    template.layers.insert(0, flat)
    return flat


def _resolve_flatten(template: Template) -> tuple[list[Layer], bool, list[str]]:
    """Decide imagens a exportar; achata o frame se não houver convenção."""
    warnings: list[str] = []
    image_layers = _image_layers(template)
    has_text = any(l.role == Role.TEXT for l in template.layers)
    flattened = False
    if not image_layers and not has_text:
        flat = _add_flattened_background(template)
        template.layers = [flat]
        image_layers = [flat]
        flattened = True
        warnings.append(
            "Nenhuma camada bg_/imagem nem slot txt_ — frame achatado como imagem "
            "única. Renomeie no Figma (bg_ no fundo, txt_ nos textos)."
        )
    elif not has_text:
        warnings.append(
            "Nenhum slot txt_ encontrado — sem texto editável. Renomeie as camadas "
            "de texto com o prefixo txt_."
        )
    return image_layers, flattened, warnings


def write_artifacts(template: Template, out_dir: str, campaign: str = "") -> tuple[str, str]:
    parts = [out_dir]
    if campaign:
        parts.append(campaign)
    parts += [template.template_id, template.format_label]
    folder = os.path.join(*parts)
    os.makedirs(folder, exist_ok=True)
    html_path = os.path.join(folder, "index.html")
    manifest_path = os.path.join(folder, "manifest.json")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(render_html(template))
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(manifest_json(template))
    return html_path, manifest_path


def build_from_template(
    template: Template,
    figma: FigmaApiSource,
    uploader: SupabaseUploader | None,
    out_dir: str,
    *,
    upload: bool = True,
    scale: int = 2,
    campaign: str = "",
    export_urls: dict[str, str] | None = None,
) -> BuildResult:
    """Constrói UM criativo. Se export_urls vier pronto (lote), pula a exportação."""
    timings: dict[str, float] = {}
    camp = campaign_slug(campaign)
    prefix = f"{camp}/" if camp else ""

    if export_urls is None:
        image_layers, flattened, warnings = _resolve_flatten(template)
        t = time.perf_counter()
        export_urls = figma.export_pngs(
            template.figma_file_key, [l.id for l in image_layers], scale=scale
        )
        timings["export"] = round(time.perf_counter() - t, 2)
    else:
        # Lote: as camadas já foram resolvidas; flattened/warnings vêm de fora.
        image_layers = _image_layers(template)
        flattened, warnings = False, []

    # download + upload em paralelo
    t = time.perf_counter()

    def handle(layer: Layer) -> tuple[str, str] | None:
        temp_url = export_urls.get(layer.id)
        if not temp_url:
            warnings.append(f"Figma não exportou a camada '{layer.name}'.")
            return None
        if upload and uploader is not None:
            data = figma.download(temp_url)
            safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (layer.name or layer.id)).strip("_") or "img"
            path = f"{prefix}{template.template_id}/{template.format_label}/{safe}.png"
            url = uploader.upload_png(path, data)
        else:
            url = temp_url
        return (layer.id, url)

    images: dict[str, str] = {}
    if image_layers:
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            for res in pool.map(handle, image_layers):
                if res:
                    lid, url = res
                    images[lid] = url
    for layer in image_layers:
        if layer.id in images:
            layer.asset_url = images[layer.id]
    timings["images"] = round(time.perf_counter() - t, 2)

    t = time.perf_counter()
    html_path, manifest_path = write_artifacts(template, out_dir, camp)
    timings["write"] = round(time.perf_counter() - t, 2)

    return BuildResult(
        template_id=template.template_id,
        node_id=template.figma_node_id,
        html_path=html_path, manifest_path=manifest_path, images=images,
        slots_count=sum(1 for l in template.layers if l.role == Role.TEXT),
        backgrounds_count=len(images), flattened=flattened, uploaded=upload,
        warnings=warnings, timings=timings, template=template,
    )


def build_batch(
    file_key: str,
    node_ids: list[str],
    figma: FigmaApiSource,
    uploader: SupabaseUploader | None,
    out_dir: str,
    *,
    upload: bool = True,
    scale: int = 2,
    campaign: str = "",
    title: str = "",
    desc: str = "",
    message: str = "",
    normalize_fn=None,
) -> list[BuildResult]:
    """Gera VÁRIOS criativos com o mínimo de chamadas ao Figma e I/O paralelo.

    1 chamada para buscar todos os nós + 1 exportação com todos os ids de imagem,
    depois processa os criativos em paralelo.
    """
    from .normalize import normalize as _normalize
    nf = normalize_fn or _normalize
    timings: dict[str, float] = {}

    if upload and uploader is not None:
        uploader.ensure_bucket()

    t = time.perf_counter()
    docs = figma.get_nodes(file_key, node_ids)
    timings["fetch_nodes"] = round(time.perf_counter() - t, 2)

    templates: dict[str, Template] = {}
    flatten_info: dict[str, tuple[bool, list[str]]] = {}
    all_image_ids: list[str] = []
    for nid, doc in docs.items():
        tpl = nf(doc, file_key=file_key)
        tpl.title = title
        tpl.desc = desc
        tpl.message = message
        layers, flattened, warns = _resolve_flatten(tpl)
        templates[nid] = tpl
        flatten_info[nid] = (flattened, warns)
        all_image_ids += [l.id for l in layers]

    t = time.perf_counter()
    export_urls = figma.export_pngs(file_key, list(set(all_image_ids)), scale=scale)
    timings["export_all"] = round(time.perf_counter() - t, 2)

    def build_one(nid: str) -> BuildResult:
        tpl = templates[nid]
        try:
            res = build_from_template(
                tpl, figma, uploader, out_dir,
                upload=upload, scale=scale, campaign=campaign, export_urls=export_urls,
            )
            flat, warns = flatten_info.get(nid, (False, []))
            res.flattened = flat
            res.warnings = warns
            res.timings = {**res.timings, **timings}
            return res
        except Exception as exc:  # noqa: BLE001
            return BuildResult(template_id=tpl.template_id, node_id=nid,
                               status="error", error=str(exc))

    t = time.perf_counter()
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        built = list(pool.map(build_one, list(templates.keys())))
    total = round(time.perf_counter() - t, 2)
    for r in built:
        r.timings.setdefault("batch_total", total)

    by_node = {r.node_id: r for r in built}
    # devolve na MESMA ordem dos node_ids pedidos (para casar com a UI)
    ordered: list[BuildResult] = []
    for nid in node_ids:
        if nid in by_node:
            ordered.append(by_node[nid])
        else:
            ordered.append(BuildResult(
                template_id="(não encontrado)", node_id=nid,
                status="error", error="Nó não encontrado no arquivo."))
    return ordered
