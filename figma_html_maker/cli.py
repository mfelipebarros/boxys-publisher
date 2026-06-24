"""CLI do figma-html-maker.

Modo API (lote/headless) — o caminho principal para escala:

    python -m figma_html_maker.cli convert \\
        --file-key ABC123 \\
        --node-id "12:345" \\
        --out ./output

O node-id sai da URL do Figma (...&node-id=12-345 -> use "12:345").
Para vários criativos, repita --node-id ou use um arquivo com --batch.

Credenciais: via ambiente (.env / secrets). Veja .env.example.
"""

from __future__ import annotations

import argparse
import sys

from .config import FigmaConfig, SupabaseConfig
from .figmaref import parse_file_key, parse_node_id
from .normalize import normalize
from .pipeline import build_from_template
from .sources.figma_api import FigmaApiSource
from .storage.supabase import SupabaseUploader


def _convert(args: argparse.Namespace) -> int:
    upload = not args.no_upload
    figma = FigmaApiSource(FigmaConfig.from_env())
    uploader = SupabaseUploader(SupabaseConfig.from_env()) if upload else None

    node_ids = list(args.node_id)
    if args.batch:
        with open(args.batch, encoding="utf-8") as f:
            node_ids += [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]

    if not node_ids:
        print("Erro: informe ao menos um --node-id (ou --batch).", file=sys.stderr)
        return 2

    file_key = parse_file_key(args.file_key)
    exit_code = 0
    for node_id_raw in node_ids:
        node_id = parse_node_id(node_id_raw)
        try:
            raw = figma.get_node(file_key, node_id)
            template = normalize(raw, file_key=file_key)
            result = build_from_template(
                template, figma, uploader, args.out, upload=upload, scale=args.scale
            )
            mode = "publicado" if upload else "pré-visualização (sem upload)"
            print(f"[ok] {result.template_id} ({template.format_label}) · {mode}")
            print(f"     html     -> {result.html_path}")
            print(f"     manifest -> {result.manifest_path}")
            print(f"     slots {result.slots_count} · imagens {result.backgrounds_count}")
            for w in result.warnings:
                print(f"     aviso: {w}")
        except Exception as exc:  # noqa: BLE001
            print(f"[falha] node {node_id}: {exc}", file=sys.stderr)
            exit_code = 1
    return exit_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="figma-html-maker")
    sub = parser.add_subparsers(dest="command", required=True)

    c = sub.add_parser("convert", help="Converte frame(s) do Figma em HTML + manifesto")
    c.add_argument("--file-key", required=True)
    c.add_argument("--node-id", action="append", default=[], help="repetível")
    c.add_argument("--batch", help="arquivo com um node-id por linha")
    c.add_argument("--out", default="./output")
    c.add_argument("--scale", type=int, default=2)
    c.add_argument("--no-upload", action="store_true",
                   help="só gera o HTML (pré-visualização), não sobe pro Supabase")
    c.set_defaults(func=_convert)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
