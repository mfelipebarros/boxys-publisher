# Maker Frontend — Plano de Implementação

## Contexto

O `maker-frontend` é um app React + Vite separado do frontend principal do Boxys, construído para substituir o `index.html` Vue monolítico como interface do `figma-html-maker`. O backend Python (FastAPI + SQLite) já implementa toda a lógica — o frontend só consome endpoints REST.

**Stack:** React + TypeScript + Vite + Tailwind + React Query + React Router + Supabase Auth  
**Backend:** `figma_html_maker/webapp/server.py` (FastAPI, porta 8000)  
**Dev:** `npm run dev` na pasta `maker-frontend/` → `http://localhost:5174`

---

## Design System — Boxys Frontend (a adotar)

O maker-frontend deve seguir a identidade visual do app Boxys principal, **não** a estética do maker Vue original (que usa verde e Space Grotesk).

| Token CSS | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#08090A` | Background da página |
| `--bg-secondary` | `#141516` | Cards, sidebar, topbar |
| `--bg-tertiary` | `#1E1E1E` | Inputs, hover states |
| `--surface` | `rgba(255,255,255,0.02)` | Overlay sutil |
| `--surface-elevated` | `#141516` | Modais, dropdowns |
| `--text-primary` | `#FFFFFF` | Títulos e texto principal |
| `--text-secondary` | `#D9D9D9` | Texto de apoio |
| `--text-tertiary` | `#A1A1A1` | Labels, placeholders |
| `--text-disabled` | `#636366` | Desabilitado |
| `--blue-primary` | `#0093FF` | Botões, links, foco |
| `--blue-secondary` | `#5AC8FA` | Hover, gradientes |
| `--blue-dark` | `#0077D0` | Active state |
| `--border-color` | `#1E1E1E` | Bordas de cards e inputs |

**Fonte:** Inter (sem Space Grotesk nem JetBrains Mono)  
**Modo:** Dark-only (sem toggle de tema)  
**Acento:** Azul (`#0093FF`), não verde

O arquivo `src/index.css` do maker-frontend precisa ser reescrito com esses tokens.

---

## Estrutura de rotas

| Rota | Página | Status |
|---|---|---|
| `/` | Home — lista dual (Boxys + Publisher) | ✅ Pronto |
| `/campaigns/:id` | Campanha local (Publisher) | 🔨 Parcial (só lista criativos) |
| `/boxys/:id` | Campanha Boxys (Supabase) | ✅ Pronto (leitura) |

---

## Página `/campaigns/:id` — Detalhamento

É a página central do fluxo de trabalho. Organizada em **4 tabs**.

### Tab 1 — Criativos

**Exibição:**
- Grid de cards com thumbnail, nome, dimensões, format_label
- Badge com nome da copy associada (ou "sem copy")
- Botões: baixar, deletar, atribuir copy (dropdown inline)

**Importar HTML:**
- Área de drag-drop (`.html`, `.zip` de HTML)
- Ao soltar: chama `POST /api/campaigns/:id/parse-html` → exibe preview de metatags
- Modal de confirmação com campos editáveis: título, descrição, mensagem
- Confirmar → `POST /api/campaigns/:id/import-html`
- Auto-associação com copy via metatag `copy-id` já acontece no backend

**Upload de mídia:**
- Drag-drop de imagem/vídeo → `POST /api/campaigns/:id/upload`

**Assignment de copy:**
- Dropdown em cada card de criativo
- `PUT /api/creatives/:id/copy` com `{ copy_id }` ou `null`

---

### Tab 2 — Copies

**Estrutura de uma copy:**
- `name` — ID de referência (usado no metatag `copy-id` dos HTMLs para auto-associação)
- `title` — headline/título
- `description` — descrição curta
- `message` — mensagem/CTA
- `type` — `criativo` ou `landing_page`
- `content` — texto rico (usado para landing pages)

**Funcionalidades:**
- Lista de copies com preview dos campos + contagem de criativos vinculados
- Criar copy individual: form com os campos acima
- Editar copy inline ou em modal
- Deletar copy
- **Importar copies via texto estruturado:**
  - Textarea com o formato:
    ```
    Variação: 01
    id: var-01
    Título: Headline aqui
    Descrição: Texto da descrição
    Mensagem/CTA: Saiba mais
    Conteúdo: [texto rico para LP]
    
    Variação: 02
    ...
    ```
  - Toggle tipo: `criativo` / `landing_page`
  - Chama `POST /api/campaigns/:id/copies/import`
  - Exibe resultado: N copies criadas, erros se houver

---

### Tab 3 — Carrosseis

**Funcionalidades:**
- Criar carrossel: só nome → `POST /api/campaigns/:id/carousels`
- Por carrossel:
  - Lista de slides (criativos) com reordenação (setas ou drag)
  - Adicionar slide: modal com grid dos criativos da campanha → `POST /api/carousels/:id/items`
  - Remover slide: `DELETE /api/carousel-items/:id`
  - Reordenar: `PUT /api/carousels/:id/order`
  - Deletar carrossel: `DELETE /api/carousels/:id`
  - **Exportar ZIP** direto do carrossel (abre modal de export com carrossel pré-selecionado)

---

### Tab 4 — Export ZIP

Dois formatos:

**Vídeo:**
- Selecionar criativo de vídeo (dropdown dos criativos `type=video`)
- Campos: título, descrição, mensagem (ou selecionar copy)
- Exportar → `POST /api/export/zip` com `format: "video"`
- Backend extrai 1º frame como capa automaticamente

**Carrossel:**
- Selecionar carrossel (dropdown)
- `carousel_variant`: tipo do carrossel (ex: `feed`, `stories`)
- Campos: título, descrição, mensagem (ou selecionar copy)
- Exportar → `POST /api/export/zip` com `format: "carousel"`

---

## Sistema de Metatags

Os HTMLs gerados/importados têm metatags embutidas:

| Metatag | Conteúdo |
|---|---|
| `name="title"` | Headline do anúncio |
| `name="desc"` | Descrição |
| `name="message"` | Mensagem/CTA |
| `name="ad-size"` | Dimensões: `"300x250"` |
| `name="copy-id"` ou `name="id"` | Referência para auto-associação com copy |

**No import:** o backend lê esses valores e os expõe no `parse-html`. O usuário pode editar antes de salvar. O `copy-id` faz match automático com `copies.name` da campanha.

**No assignment:** ao vincular uma copy a um criativo, o sistema guarda `copy_id` no banco. Não re-escreve o HTML (o HTML já tem os valores baked no momento do import/conversão).

---

### Tab 2 — Copies (complemento: Gerar Prompt)

**Seleção de copies + Gerar Prompt:**
- Cada copy tem checkbox de seleção
- Ao selecionar ≥1 copy, aparece uma action bar flutuante na parte inferior:
  - `N criativos selecionados` / `N landing pages selecionadas`
  - Botão "Selecionar todos" (do mesmo tipo)
  - Botão "Limpar seleção"
  - Botão **"Gerar prompt →"**
- Somente copies do mesmo tipo podem ser selecionadas juntas (`criativo` ou `landing_page`)
- O tipo da seleção define qual pre-prompt é usado:
  - `criativo` → `GET /api/prompts/criativo`
  - `landing_page` → `GET /api/prompts/lp`
- As copies selecionadas são formatadas como blocos:
  ```
  ID: var-01
  Conteúdo:
  [conteúdo da copy — rich text convertido para markdown, ou texto puro]

  ---

  ID: var-02
  ...
  ```
- O bloco formatado substitui `[COLAR AQUI O OUTPUT DO APP BOXYS]` no pre-prompt
- O resultado é copiado para o clipboard automaticamente (toast de confirmação)
- Fallback: se o clipboard falhar, exibe o prompt em modal com textarea readonly

**Endpoint:** `GET /api/prompts/{criativo|lp}` → retorna `{ status, prompt }` com o texto do pre-prompt

---

---

## Criação de Campanha Boxys — Campos completos

O modal/formulário "Nova campanha" no tipo Boxys precisa incluir todos os campos que o app principal exige (hoje o maker só pede título e descrição).

### Campos obrigatórios
| Campo | Tipo | Observação |
|---|---|---|
| `title` | text | Nome da campanha |
| `description` | textarea | Descrição da campanha |
| `version` | text | Ex: "1.0" |
| `categories` | autocomplete multi | Buscar/criar via Supabase `category` |
| `target_audiences` | autocomplete multi | Buscar/criar via Supabase `target_audience` |
| `target_audience_description` | textarea | Descrição textual do público |
| `usage_instructions` | textarea | Instruções de uso |
| `image` | file upload | Capa da campanha (obrigatório) |

### Campos opcionais
| Campo | Tipo |
|---|---|
| `identifier` | text |
| `url` | text |
| `one_liner` | text — frase de posicionamento |
| `campaign_color` | color picker |
| `featured_image` | file upload |
| `media_guidance` | PDF upload |

### Fluxo de criação
1. Usuário preenche o formulário completo
2. Upload da imagem de capa para Supabase Storage
3. Busca/cria categorias e públicos-alvo no Supabase via PostgREST
4. `POST /api/boxys/campaigns` com todos os campos
5. Backend cria no Supabase E cria campanha local SQLite linkada

> O backend precisará ser atualizado para aceitar todos esses campos no `CreateBoxyCampaignRequest`.

---

## Campanha Boxys (`/boxys/:id`)

Já exibe listas de ads, socials e LPs. O que falta:
- Botão **"+ Publicar no Boxys"** por seção → abre modal de publicação
  - Seleciona criativo local (dropdown dos criativos da campanha vinculada, se houver)
  - Tipo: Advertisement / Social Creative / Landing Page
  - Campos adicionais por tipo
  - Chama `POST /api/boxys/publish`

---

## Componentes a criar

```
src/
  pages/
    LocalCampaign.tsx          # shell com tabs (refatorar)
    BoxyCampaign.tsx           # adicionar botão publicar
  components/
    campaign/
      CreativesTab.tsx         # grid + import + assignment
      CopiesTab.tsx            # lista + criar + importar texto
      CarouselsTab.tsx         # carrosseis + reordenar
      ExportTab.tsx            # export ZIP vídeo/carrossel
      ImportHtmlModal.tsx      # parse → preview metatags → confirmar
      CopyForm.tsx             # form de criação/edição de copy
      ImportCopiesModal.tsx    # textarea import estruturado
      PublishToBoxysModal.tsx  # publicar criativo no Boxys
```

---

## Endpoints usados por feature

| Feature | Endpoint |
|---|---|
| Listar campanha + criativos | `GET /api/campaigns/:id` |
| Upload HTML/imagem/vídeo | `POST /api/campaigns/:id/upload` |
| Parse HTML | `POST /api/campaigns/:id/parse-html` |
| Import HTML | `POST /api/campaigns/:id/import-html` |
| Deletar criativo | `DELETE /api/creatives/:id` |
| Atribuir copy | `PUT /api/creatives/:id/copy` |
| Listar/criar/editar/deletar copy | CRUD em `/api/copies` e `/api/campaigns/:id/copies` |
| Import copies bulk | `POST /api/campaigns/:id/copies/import` |
| Criar carrossel | `POST /api/campaigns/:id/carousels` |
| Adicionar item | `POST /api/carousels/:id/items` |
| Remover item | `DELETE /api/carousel-items/:id` |
| Reordenar | `PUT /api/carousels/:id/order` |
| Deletar carrossel | `DELETE /api/carousels/:id` |
| Export ZIP | `POST /api/export/zip` |
| Publicar no Boxys | `POST /api/boxys/publish` |
