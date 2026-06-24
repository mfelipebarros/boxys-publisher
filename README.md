# figma-html-maker (Boxys)

Aplicação externa que converte criativos do Figma em **HTML com slots editáveis**,
hospedando as imagens de fundo no **Supabase Storage**. Pensada para anúncios de
Meta Ads e Google Ads com personalização via texto.

Um **núcleo único** de conversão, alimentado por **duas fontes intercambiáveis**:

```
                      ┌─────────────────────────────────────────┐
   API REST  ───────▶ │                                         │
   (lote / headless)  │   normalize → gera HTML + manifesto      │ ──▶ HTML
                      │   exporta bg → Supabase Storage          │ ──▶ manifest.json
   MCP       ───────▶ │                                         │ ──▶ imagens no Supabase
   (interativo)       └─────────────────────────────────────────┘
```

A fonte muda; o núcleo é o mesmo. Ambas devolvem nós no **mesmo formato do Figma**,
passam pelo `normalize` e seguem idênticas daí pra frente.

## Quando usar cada fonte

- **API REST** (`sources/figma_api.py`) — produção em escala, sem ninguém com o
  Figma aberto. Roda sozinha (ex.: GitHub Actions gerando N criativos). **É o caminho
  principal para escala.**
- **MCP** (`sources/figma_mcp.py`) — iteração interativa, com o Figma desktop aberto,
  num ambiente agêntico. Mais fluido para refinar um template à mão. Esqueleto pronto;
  o cliente MCP concreto é fechado quando definirmos qual embarcar (veja o arquivo).

## A convenção de camadas (calibre uma vez, use sempre)

Nomeie as camadas no Figma com prefixo:

| Prefixo    | Vira                              | No HTML                    |
|------------|-----------------------------------|----------------------------|
| `bg_*`     | imagem exportada + Supabase       | `<img>` de fundo           |
| `txt_*`    | slot editável (entra no manifesto)| `<div data-slot="...">`    |
| `fixed_*`  | elemento fixo (não editável)      | div estática / `<img>`     |

Camada sem prefixo conhecido vira `fixed` (nunca some silenciosamente).

## App visual (interface web)

Uma interface "mesa de controle": cola o file-key + node-ids, clica em **Converter**
e vê o pipeline rodar por criativo (Figma → Normalizar → Exportar → Supabase → HTML),
com pré-visualização do anúncio, slots editáveis e URLs das imagens no Supabase.

```bash
pip install -r requirements.txt
cp .env.example .env          # preencha as credenciais
uvicorn figma_html_maker.webapp.server:app --reload --port 8000
# abra http://localhost:8000
```

A interface **nunca vê as credenciais** — ela só chama o backend local, que segura
o `FIGMA_TOKEN` e a `service_role` do Supabase. Sem backend/credenciais, a interface
entra em **modo demo** (dados de exemplo) para você inspecionar a UX.

## Instalação (uso por linha de comando)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencha as credenciais
```

## Credenciais

Tudo via ambiente — **nada de credencial no código**.

- `FIGMA_TOKEN` — Personal Access Token (leitura basta).
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service_role — **só servidor/CI**), `SUPABASE_BUCKET`.

No GitHub Actions, ponha tudo em *secrets*. O `.env` está no `.gitignore`.

## Uso (modo API)

```bash
python -m figma_html_maker.cli convert \
    --file-key ABC123 \
    --node-id "12:345" \
    --out ./output
```

O `file-key` e o `node-id` saem da URL do Figma. Vários criativos: repita
`--node-id`, ou use `--batch arquivo.txt` (um node-id por linha).

Saída por criativo:

```
output/<template_id>/<formato>/index.html
output/<template_id>/<formato>/manifest.json
```

E as imagens em `Supabase://<bucket>/<template_id>/<formato>/<nome>.png`.

## O manifesto

Cada template gera um `manifest.json` que a sua plataforma lê para saber **o que o
corretor pode editar** (id, posição, fonte, cor, limite estimado de caracteres) e
as URLs das imagens de fundo. É o contrato entre o gerador e a plataforma.

## Multi-formato

Cada formato (feed 1080x1350, stories 1080x1920, display 300x250...) é um frame
próprio no Figma → um `--node-id`. Mesma convenção de camadas, coordenadas
diferentes. O `template_id` agrupa; o `formato` separa.

## Próximos passos de calibração

1. **JSON real de um arquivo de vocês** — para conferir os caminhos de `fills` e
   `style` (variam por tipo de nó). O `normalize.py` cobre os casos comuns; ajusto
   o que faltar quando vir a estrutura verdadeira.
2. **Fontes da marca Boxys** — se não forem Google Fonts, hospedar `.woff2` no
   Supabase e trocar o bloco de `@font-face` no `generate.py`.
3. **Bucket privado?** Trocar `public_url` por URL assinada em `storage/supabase.py`.
4. **Fechar o cliente MCP** em `sources/figma_mcp.py`.

## Estrutura

```
figma_html_maker/
  config.py            credenciais via ambiente
  model.py             modelo interno (Layer, Template, Role)
  normalize.py         Figma node -> modelo (aplica a convenção)
  generate.py          modelo -> HTML + manifesto
  pipeline.py          orquestra: fonte -> export/upload -> artefatos
  cli.py               entrada (modo API)
  webapp/
    server.py          backend FastAPI (segura as credenciais)
    static/index.html  a interface visual
  sources/
    figma_api.py       fonte REST (lote)
    figma_mcp.py       fonte MCP (interativo) — esqueleto
  storage/
    supabase.py        upload das imagens
```
