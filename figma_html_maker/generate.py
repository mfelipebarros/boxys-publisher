"""Gera o HTML final e o manifesto JSON de slots a partir do Template normalizado.

- bg_*    -> camada <img> posicionada (asset_url do Supabase)
- fixed_* -> elemento estático (texto -> div não editável; imagem -> img)
- txt_*   -> div com data-slot, editável; também listado no manifesto

O HTML é um "stage" de tamanho fixo com camadas em position:absolute. A plataforma
preenche os slots trocando o conteúdo dos elementos [data-slot="..."] (ou usando
o manifesto para renderizar do seu jeito).
"""

from __future__ import annotations

import html
import json
from typing import Any

from .model import Layer, Role, Template


def _esc(s: str | None) -> str:
    return html.escape(s or "", quote=True)


def _layer_css(layer: Layer) -> str:
    return (
        f"position:absolute;left:{layer.x}px;top:{layer.y}px;"
        f"width:{layer.width}px;height:{layer.height}px;"
    )


def _text_css(layer: Layer) -> str:
    st = layer.style
    if not st:
        return ""
    css = (
        f"font-family:'{st.font_family}',sans-serif;font-weight:{st.font_weight};"
        f"font-size:{st.font_size}px;color:{st.color};text-align:{st.text_align};"
    )
    if st.line_height:
        css += f"line-height:{st.line_height}px;"
    if st.letter_spacing:
        css += f"letter-spacing:{st.letter_spacing}px;"
    if st.text_align_vertical == "center":
        css += "display:flex;flex-direction:column;justify-content:center;"
    elif st.text_align_vertical == "bottom":
        css += "display:flex;flex-direction:column;justify-content:flex-end;"
    return css


def _text_position_css(layer: Layer) -> str:
    """Posição e dimensões de um nó de texto respeitando textAutoResize."""
    st = layer.style
    auto = st.auto_resize if st else "NONE"
    base = f"position:absolute;left:{layer.x}px;top:{layer.y}px;"
    if auto == "WIDTH_AND_HEIGHT":
        return base + "width:auto;height:auto;white-space:nowrap;"
    if auto == "HEIGHT":
        return base + f"width:{layer.width}px;height:auto;"
    return base + f"width:{layer.width}px;height:{layer.height}px;"


def _font_families(template: Template) -> list[str]:
    fams = {l.style.font_family for l in template.layers if l.style}
    return sorted(fams)


def _inner_content(layer: Layer) -> str:
    """HTML interno do texto: usa text_html (mixed styles/listas) se disponível."""
    if layer.text_html is not None:
        return layer.text_html
    return _esc(layer.text)


def render_html(template: Template) -> str:
    layers_html: list[str] = []
    for layer in template.layers:
        base = _layer_css(layer)
        if layer.role == Role.BACKGROUND or layer.is_image:
            if layer.asset_url:
                layers_html.append(
                    f'<img class="layer bg" data-layer-id="{_esc(layer.id)}" '
                    f'src="{_esc(layer.asset_url)}" alt="" style="{base}object-fit:cover;" />'
                )
            elif layer.fill_color:
                # Bg de cor sólida sem imagem — renderiza como div CSS
                layers_html.append(
                    f'<div class="layer bg" data-layer-id="{_esc(layer.id)}" '
                    f'style="{base}background:{layer.fill_color};"></div>'
                )
        elif layer.role == Role.TEXT:
            pos = _text_position_css(layer)
            layers_html.append(
                f'<div class="layer txt" data-slot="{_esc(layer.name)}" '
                f'contenteditable="false" style="{pos}{_text_css(layer)}">'
                f"{_inner_content(layer)}</div>"
            )
        else:  # FIXED
            if layer.text is not None:
                pos = _text_position_css(layer)
                layers_html.append(
                    f'<div class="layer fixed" style="{pos}{_text_css(layer)}">'
                    f"{_inner_content(layer)}</div>"
                )
            elif layer.asset_url:
                layers_html.append(
                    f'<img class="layer fixed" data-layer-id="{_esc(layer.id)}" '
                    f'src="{_esc(layer.asset_url)}" alt="" style="{base}object-fit:cover;" />'
                )
            elif layer.fill_color:
                layers_html.append(
                    f'<div class="layer fixed" '
                    f'style="{base}background:{layer.fill_color};"></div>'
                )

    fonts = _font_families(template)
    google_fonts = ""
    if fonts:
        fam_param = "&family=".join(f.replace(" ", "+") + ":wght@400;700" for f in fonts)
        google_fonts = (
            f'<link rel="preconnect" href="https://fonts.googleapis.com">\n'
            f'<link href="https://fonts.googleapis.com/css2?family={fam_param}&display=swap" rel="stylesheet">'
        )

    meta_title = f'\n<meta name="title" content="{_esc(template.title)}">' if template.title else ""
    meta_desc = f'\n<meta name="desc" content="{_esc(template.desc)}">' if template.desc else ""
    meta_msg = f'\n<meta name="message" content="{_esc(template.message)}">' if template.message else ""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="ad-size" content="{template.format_label}">{meta_title}{meta_desc}{meta_msg}
<title>{_esc(template.title or template.template_id)} — {template.format_label}</title>
{google_fonts}
<style>
  *{{margin:0;box-sizing:border-box;}}
  .stage{{position:relative;width:{template.width}px;height:{template.height}px;overflow:hidden;background:{template.background_color};}}
  .bg{{overflow:hidden;}}
  .txt{{white-space:pre-wrap;}}
  .txt ul,.txt ol{{padding-left:1.4em;margin:0;white-space:normal;}}
  .txt li{{margin-bottom:0.2em;}}
</style>
</head>
<body>
<div class="stage" id="ad-stage" data-template="{_esc(template.template_id)}" data-format="{template.format_label}">
{chr(10).join("  " + l for l in layers_html)}
</div>
</body>
</html>
"""


def build_manifest(template: Template) -> dict[str, Any]:
    slots = []
    backgrounds = []
    for layer in template.layers:
        if layer.role == Role.TEXT:
            st = layer.style
            slots.append({
                "id": layer.name,
                "type": "text",
                "default": layer.text or "",
                "x": layer.x, "y": layer.y,
                "width": layer.width, "height": layer.height,
                "font": st.font_family if st else None,
                "weight": st.font_weight if st else None,
                "size": st.font_size if st else None,
                "color": st.color if st else None,
                "align": st.text_align if st else None,
                # estimativa de limite (a calibrar): chars que cabem na largura
                "max_chars_hint": int(layer.width / (st.font_size * 0.5)) if st and st.font_size else None,
            })
        elif layer.role == Role.BACKGROUND or layer.is_image:
            backgrounds.append({
                "layer_id": layer.id,
                "name": layer.name,
                "url": layer.asset_url,
                "x": layer.x, "y": layer.y,
                "width": layer.width, "height": layer.height,
            })

    return {
        "template_id": template.template_id,
        "format": template.format_label,
        "width": template.width,
        "height": template.height,
        "figma": {"file_key": template.figma_file_key, "node_id": template.figma_node_id},
        "backgrounds": backgrounds,
        "slots": slots,
    }


def manifest_json(template: Template) -> str:
    return json.dumps(build_manifest(template), ensure_ascii=False, indent=2)
