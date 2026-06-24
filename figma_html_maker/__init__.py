"""Figma -> HTML maker (Boxys).

Núcleo único de conversão, alimentado por duas fontes intercambiáveis:
- API REST do Figma (lote / headless)
- MCP do Figma (interativo / desktop)

As imagens de fundo (bg_*) são exportadas, enviadas ao Supabase Storage
e referenciadas no HTML. Os textos (txt_*) viram slots editáveis no manifesto.
"""

__version__ = "0.1.0"
