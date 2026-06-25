# Maker Frontend — Tasks

## Legenda
`[ ]` pendente · `[~]` em andamento · `[x]` concluído

---

## Infraestrutura

- [x] Scaffold Vite + React + TS + Tailwind
- [x] **Reescrever design system** para identidade Boxys (Inter, azul `#0093FF`, fundo `#08090A`) — reescrever `src/index.css` e atualizar componentes ui/
- [x] Auth com Supabase (`useAuth`, `Login.tsx`)
- [x] `Layout.tsx` (topbar + sidebar dual Boxys/Publisher)
- [x] `api.ts` (wrapper com Bearer token automático + `apiUpload` para multipart)
- [x] Tipos TypeScript (`src/types/index.ts`) — inclui `LocalCarousel`, `LocalCarouselItem`, `ParsedHtmlMeta`
- [x] CORS middleware no FastAPI
- [x] Rotas: `/`, `/campaigns/:id`, `/boxys/:id`

---

## Home (`/`)

- [x] Seção Campanhas Boxys (grid com badge)
- [x] Seção Publisher local (grid)
- [x] Modal "Nova campanha" com toggle local/Boxys
- [x] Busca/filtro por nome
- [ ] Modal "Nova campanha Boxys" expandido com campos completos:
  - [ ] Campos obrigatórios: title, description, version, categories, target_audiences, target_audience_description, usage_instructions, image (capa)
  - [ ] Campos opcionais: identifier, url, one_liner, campaign_color (color picker), featured_image, media_guidance (PDF)
  - [ ] Upload de imagem para Supabase Storage antes de criar
  - [ ] Autocomplete de categorias e públicos-alvo (buscar/criar no Supabase)
  - [ ] Atualizar `POST /api/boxys/campaigns` no backend para aceitar todos os campos

---

## Campanha Boxys (`/boxys/:id`)

- [x] Header com imagem, nome, status publicado/rascunho
- [x] Seção colapsável Anúncios
- [x] Seção colapsável Criativos Sociais
- [x] Seção colapsável Landing Pages
- [ ] Botão "+ Publicar no Boxys" por seção
- [ ] `PublishToBoxysModal.tsx` (criativo → Boxys)

---

## Campanha Local (`/campaigns/:id`) — Tab Criativos

- [x] Listagem básica de criativos
- [x] Refatorar página com tabs (Criativos / Copies / Carrosseis / Export)
- [x] Grid de cards com thumbnail, dimensões, format_label
- [x] Badge de copy associada em cada card
- [x] Dropdown inline para atribuir copy (`PUT /api/creatives/:id/copy`)
- [x] Botão deletar criativo
- [x] Botão download criativo
- [x] `ImportHtmlModal.tsx`: drag-drop → parse metatags → preview → confirmar import
- [x] Upload de imagem/vídeo (drag-drop direto)

---

## Campanha Local (`/campaigns/:id`) — Tab Copies

- [x] Listagem de copies com preview (título, desc, msg) + contagem de criativos vinculados
- [x] `CopyForm.tsx`: form criar/editar (name, title, description, message, type, content)
- [x] Botão criar copy individual
- [x] Editar copy (modal ou inline)
- [x] Deletar copy
- [x] Seleção de copies via checkbox (somente mesmo tipo)
- [x] Action bar ao selecionar: contagem, "Selecionar todos", "Limpar", "Gerar prompt →"
- [x] `gerarPrompt()`: busca pre-prompt via `GET /api/prompts/{criativo|lp}`, formata copies como blocos `ID: / Conteúdo:`, injeta no placeholder, copia para clipboard
- [x] Toast de confirmação de cópia / fallback modal com textarea readonly
- [x] `ImportCopiesModal.tsx`: textarea com formato estruturado
  - [x] Toggle tipo: criativo / landing_page
  - [x] Chamar `POST /api/campaigns/:id/copies/import`
  - [x] Exibir resultado com erros

---

## Campanha Local (`/campaigns/:id`) — Tab Carrosseis

- [x] Listagem de carrosseis da campanha
- [x] Criar carrossel (nome)
- [x] Por carrossel: listar slides (criativos) com ordem
- [x] Adicionar slide: modal com grid de criativos da campanha
- [x] Remover slide
- [x] Reordenar slides (botões ↑↓)
- [x] Deletar carrossel

---

## Campanha Local (`/campaigns/:id`) — Tab Export ZIP

- [x] Formulário export vídeo:
  - [x] Selecionar criativo de vídeo (dropdown)
  - [x] Selecionar copy ou preencher título/desc/msg manual
  - [x] Chamar `POST /api/export/zip` com `format: "video"`
  - [x] Download automático do ZIP retornado
- [x] Formulário export carrossel:
  - [x] Selecionar carrossel (dropdown)
  - [x] Campo `carousel_variant`
  - [x] Selecionar copy ou preencher manual
  - [x] Chamar `POST /api/export/zip` com `format: "carousel"`
  - [x] Download automático do ZIP

---

## Backlog / Futuro

- [ ] **Google Ads text ads:** no contexto de tráfego pago (ou exportação), modal com duas textareas — uma para headlines/títulos (separados por quebra de linha) e uma para descrições (também por quebra de linha). Mesma lógica que existe na aba Google Ads do frontend principal.
- [ ] Figma browser: navegar frames do arquivo Figma linkado
- [ ] Conversão Figma → HTML diretamente pelo React frontend
- [ ] Preview inline de criativos HTML (iframe)
- [ ] Edição de metatags de criativo importado (title/desc/message) após import
- [ ] Aplicar copy no HTML (re-write metatags com valores da copy associada)
- [ ] Publicar para produção (servir `maker-frontend-dist` pelo FastAPI)
