"""Converte a árvore de nós do Figma (formato bruto da API/MCP) no modelo interno.

Aplica a CONVENÇÃO DE CAMADAS combinada com o time de design:
    bg_*     -> Role.BACKGROUND  (imagem exportada + Supabase)
    txt_*    -> Role.TEXT        (slot editável)
    fixed_*  -> Role.FIXED       (estático, não editável)

Aceita tanto "bg_nome" quanto "bg-nome". Nós sem prefixo conhecido dentro do
frame são tratados como FIXED (ficam visíveis, mas não viram slot editável),
para nunca "perder" um elemento silenciosamente.
"""

from __future__ import annotations

import html as _html_mod
import re
from typing import Any, Optional

from .model import Layer, Role, Template, TextStyle

_PREFIX = re.compile(r"^(bg|txt|fixed)[_\-]", re.IGNORECASE)
_COMPONENT_TYPES = {"COMPONENT", "INSTANCE", "COMPONENT_SET"}


def _slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[_\-]+", "_", s)
    s = re.sub(r"[^a-z0-9_]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_") or "template"


def _role_from_name(name: str) -> Optional[Role]:
    m = _PREFIX.match(name or "")
    if not m:
        return None
    return {"bg": Role.BACKGROUND, "txt": Role.TEXT, "fixed": Role.FIXED}[
        m.group(1).lower()
    ]


def _rgba_to_hex(color: dict[str, Any]) -> str:
    r = round(color.get("r", 0) * 255)
    g = round(color.get("g", 0) * 255)
    b = round(color.get("b", 0) * 255)
    return f"#{r:02X}{g:02X}{b:02X}"


def _first_solid_fill(node: dict[str, Any]) -> Optional[str]:
    for fill in node.get("fills", []) or []:
        if fill.get("type") == "SOLID" and fill.get("visible", True):
            color = fill.get("color", {})
            # Respeita alpha do fill e da cor — ignora fills transparentes
            alpha = color.get("a", 1.0) * fill.get("opacity", 1.0)
            if alpha < 0.01:
                continue
            return _rgba_to_hex(color)
    return None


_RASTER_FILL_TYPES = {"IMAGE", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"}


def _has_image_fill(node: dict[str, Any]) -> bool:
    """True se o nó tem fill que precisa ser exportado como PNG (imagem ou gradiente)."""
    return any(
        f.get("type") in _RASTER_FILL_TYPES and f.get("visible", True)
        for f in (node.get("fills", []) or [])
    )


def _text_style(node: dict[str, Any]) -> TextStyle:
    st = node.get("style", {}) or {}
    align_map = {"LEFT": "left", "CENTER": "center", "RIGHT": "right", "JUSTIFIED": "justify"}
    valign_map = {"TOP": "top", "CENTER": "center", "BOTTOM": "bottom"}
    return TextStyle(
        font_family=st.get("fontFamily", "Inter"),
        font_weight=int(st.get("fontWeight", 400)),
        font_size=float(st.get("fontSize", 16)),
        color=_first_solid_fill(node) or "#000000",
        text_align=align_map.get(st.get("textAlignHorizontal", "LEFT"), "left"),
        text_align_vertical=valign_map.get(st.get("textAlignVertical", "TOP"), "top"),
        auto_resize=st.get("textAutoResize", "NONE"),
        line_height=st.get("lineHeightPx"),
        letter_spacing=st.get("letterSpacing"),
    )


def _build_inner_html(node: dict[str, Any]) -> Optional[str]:
    """Constrói HTML interno de um nó de texto com mixed styles e/ou listas.

    Retorna None se o texto for simples (sem overrides nem listas) — nesse caso
    o gerador usa _esc(layer.text) diretamente.
    """
    characters = re.sub(r"\{corretor_nome\}", "nome do corretor", node.get("characters", "") or "", flags=re.IGNORECASE)
    line_types = node.get("lineTypes", []) or []
    overrides = node.get("characterStyleOverrides", []) or []
    style_table = node.get("styleOverrideTable", {}) or {}
    base_style = node.get("style", {}) or {}
    base_weight = int(base_style.get("fontWeight", 400))

    has_overrides = bool(overrides) and any(o != 0 for o in overrides)
    has_lists = any(lt in ("ORDERED", "UNORDERED") for lt in line_types)

    if not has_overrides and not has_lists:
        return None

    def _styled_run(text: str, start: int) -> str:
        """Aplica overrides de estilo a um trecho de texto, por runs."""
        if not has_overrides:
            return _html_mod.escape(text)
        parts: list[str] = []
        i = 0
        while i < len(text):
            abs_i = start + i
            oid = overrides[abs_i] if abs_i < len(overrides) else 0
            j = i + 1
            while j < len(text):
                abs_j = start + j
                if (overrides[abs_j] if abs_j < len(overrides) else 0) != oid:
                    break
                j += 1
            override = style_table.get(str(oid), {}) if oid != 0 else {}
            weight = int(override.get("fontWeight", base_weight))
            escaped = _html_mod.escape(text[i:j])
            if weight >= 600 and base_weight < 600:
                parts.append(f"<strong>{escaped}</strong>")
            else:
                parts.append(escaped)
            i = j
        return "".join(parts)

    # Divide em linhas mantendo rastreio de posição de caractere
    raw_lines = characters.split("\n")
    line_data: list[tuple[str, str]] = []  # (line_type, inner_html)
    char_pos = 0
    for i, line in enumerate(raw_lines):
        lt = line_types[i] if i < len(line_types) else "NONE"
        inner = _styled_run(line, char_pos)
        line_data.append((lt, inner))
        char_pos += len(line) + 1  # +1 para o \n

    if not has_lists:
        return "<br>".join(h for _, h in line_data)

    # Agrupa linhas consecutivas do mesmo tipo de lista
    result: list[str] = []
    i = 0
    while i < len(line_data):
        lt, lh = line_data[i]
        if lt in ("ORDERED", "UNORDERED"):
            tag = "ol" if lt == "ORDERED" else "ul"
            items: list[str] = []
            while i < len(line_data) and line_data[i][0] == lt:
                items.append(f"<li>{line_data[i][1]}</li>")
                i += 1
            result.append(f"<{tag}>{''.join(items)}</{tag}>")
        else:
            result.append(lh)
            i += 1

    return "".join(result)


def _bbox(node: dict[str, Any]) -> Optional[dict[str, float]]:
    return node.get("absoluteBoundingBox")


def normalize(
    node: dict[str, Any],
    *,
    file_key: str,
    template_id_override: Optional[str] = None,
) -> Template:
    """`node` é o FRAME do anúncio (não o documento inteiro)."""
    frame_box = _bbox(node)
    if not frame_box:
        raise ValueError("O nó raiz não tem absoluteBoundingBox; passe o FRAME do anúncio.")

    origin_x = frame_box["x"]
    origin_y = frame_box["y"]

    template = Template(
        template_id=template_id_override or _slugify(node.get("name", "template")),
        figma_file_key=file_key,
        figma_node_id=node.get("id", ""),
        width=round(frame_box["width"]),
        height=round(frame_box["height"]),
    )

    def _has_txt(n: dict[str, Any]) -> bool:
        for c in n.get("children", []) or []:
            if _role_from_name(c.get("name", "")) == Role.TEXT:
                return True
            if _has_txt(c):
                return True
        return False

    def walk(n: dict[str, Any]) -> None:
        for child in n.get("children", []) or []:
            role = _role_from_name(child.get("name", ""))
            box = _bbox(child)
            is_group = bool(child.get("children"))
            child_type = child.get("type", "")

            # Desce em grupos/componentes que contenham txt_ (para manter editabilidade)
            # ou em COMPONENT/INSTANCE sem prefixo (para não perder textos internos)
            should_descend = is_group and (
                _has_txt(child)
                or (child_type in _COMPONENT_TYPES and role is None)
            )
            if should_descend:
                walk(child)
                continue

            if box is None:
                if is_group:
                    walk(child)
                continue

            effective_role = role or Role.FIXED
            is_text_node = child_type == "TEXT"

            layer = Layer(
                id=child.get("id", ""),
                name=child.get("name", ""),
                role=effective_role,
                x=round(box["x"] - origin_x, 2),
                y=round(box["y"] - origin_y, 2),
                width=round(box["width"], 2),
                height=round(box["height"], 2),
            )

            if is_text_node:
                raw_chars = child.get("characters", "")
                layer.text = re.sub(r"\{corretor_nome\}", "nome do corretor", raw_chars, flags=re.IGNORECASE)
                layer.text_html = _build_inner_html(child)
                layer.style = _text_style(child)
            else:
                layer.fill_color = _first_solid_fill(child)
                # Só marca is_image=True se tiver fill de imagem ou for um grupo/shape
                # complexo que precise de rasterização. Fills sólidos simples ficam
                # como fill_color (CSS) sem precisar exportar PNG.
                layer.is_image = _has_image_fill(child) or (
                    is_group and effective_role in (Role.BACKGROUND, Role.FIXED)
                )

            template.layers.append(layer)

    walk(node)

    # Fill do frame vira background do stage (CSS), não uma camada posicionada.
    frame_fill = _first_solid_fill(node)
    if frame_fill:
        template.background_color = frame_fill

    # ordem de empilhamento: backgrounds primeiro, depois fixed, depois textos
    order = {Role.BACKGROUND: 0, Role.FIXED: 1, Role.TEXT: 2}
    template.layers.sort(key=lambda l: order.get(l.role, 1))
    return template
