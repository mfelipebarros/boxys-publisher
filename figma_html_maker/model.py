"""Modelo interno normalizado.

Tanto a API quanto o MCP devolvem nós no MESMO formato do Figma. Por isso
ambos passam por `normalize.py` e produzem estas estruturas. O gerador de HTML
só conhece estas classes — ele é agnóstico à fonte.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Role(str, Enum):
    BACKGROUND = "bg"     # vira imagem exportada + upload no Supabase
    TEXT = "txt"          # vira slot editável no manifesto
    FIXED = "fixed"       # elemento fixo (texto estático ou imagem não editável)
    CONTAINER = "container"  # o frame raiz / agrupadores


@dataclass
class TextStyle:
    font_family: str = "Inter"
    font_weight: int = 400
    font_size: float = 16.0
    color: str = "#000000"        # hex
    text_align: str = "left"      # left | center | right
    text_align_vertical: str = "top"  # top | center | bottom
    auto_resize: str = "NONE"     # NONE | HEIGHT | WIDTH_AND_HEIGHT
    line_height: Optional[float] = None  # px
    letter_spacing: Optional[float] = None  # px


@dataclass
class Layer:
    id: str
    name: str
    role: Role
    x: float
    y: float
    width: float
    height: float

    # texto (TEXT / FIXED texto)
    text: Optional[str] = None
    text_html: Optional[str] = None   # HTML pré-construído com spans/listas
    style: Optional[TextStyle] = None

    # imagem / preenchimento (BACKGROUND / FIXED imagem)
    fill_color: Optional[str] = None      # cor sólida, se for retângulo simples
    is_image: bool = False                # tem fill de imagem (precisa exportar)
    asset_url: Optional[str] = None       # preenchido após upload no Supabase


@dataclass
class Template:
    template_id: str          # derivado do nome do frame, ex: meta_feed_lancamento_01
    figma_file_key: str
    figma_node_id: str
    width: int
    height: int
    layers: list[Layer] = field(default_factory=list)
    background_color: str = "#ffffff"  # fill do frame raiz → CSS do stage

    # meta tags do ad (preenchidas pelo usuário antes de publicar)
    title: str = ""
    desc: str = ""
    message: str = ""

    @property
    def format_label(self) -> str:
        return f"{self.width}x{self.height}"
