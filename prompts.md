# Prompt — Landing Page (Boxys)

> Colar no Claude Code junto com o output de copy do app Boxys.

---

**Antes de começar:** peça ao usuário por referências visuais, o link oficial do empreendimento (para baixar fotos), e qualquer arquivo adicional relevante (logo da construtora, plantas, etc.). Só inicie a construção após receber esse material.

---

## Copy do Empreendimento

```
[COLAR AQUI O OUTPUT DO APP BOXYS]
```

---

## Regras Técnicas

### Auto-contenção
- Todo CSS em `<style>` no `<head>`, todo JS em `<script>` antes do `</body>`
- Sem arquivos externos além das bibliotecas listadas abaixo

### Imagens externas
Toda imagem referenciada por URL externa deve ser **baixada localmente** antes de usar:

```bash
curl -o imagem.jpg "https://url-da-imagem.com/foto.jpg"
base64 -w 0 imagem.jpg
```

Inserir no HTML como `data:image/jpeg;base64,...`. Nunca referenciar URLs externas de imagens diretamente no HTML final.

### Bibliotecas disponíveis (carregar apenas as necessárias)

**GSAP:**
```html
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/gsap.min.js"></script>
<!-- Incluir somente se usar ScrollTrigger: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/ScrollTrigger.min.js"></script>
<!-- Incluir somente se usar ScrollSmoother: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/ScrollSmoother.min.js"></script>
<!-- Incluir somente se usar SplitText: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/gsap/SplitText.min.js"></script>
```

**MapLibre GL:**
```html
<link rel="stylesheet" href="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/maplibre-gl.css">
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/maplibre-gl.js"></script>
<!-- Incluir somente se precisar converter KML/GPX: -->
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/maplibre/togeojson.umd.js"></script>
```

**Swiper:**
```html
<link rel="stylesheet" href="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/swiper/swiper-bundle.min.css">
<script src="https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Bibliotecas/swiper/swiper-bundle.min.js"></script>
```

### Mapa (MapLibre)
- Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Centralizar nas coordenadas do empreendimento; adicionar marcador no ponto exato
- Container: `width: 100%; height: 450px`

### Carrossel (Swiper)
```js
new Swiper('.swiper', {
  loop: true,
  autoplay: { delay: 4000, disableOnInteraction: false },
  pagination: { el: '.swiper-pagination', clickable: true },
  navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
});
```

---

## Dados do Corretor

Usar exatamente estes placeholders em todos os locais de contato:

| Campo | Placeholder |
|---|---|
| Nome | `Nome do Corretor` |
| E-mail | `emaildocorretor@gmail.com` |
| Telefone | `00000000000` |
| Foto | `https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Imagens/profile.webp` |
| WhatsApp | `https://wa.me/5500000000000` |

> Formato do link: `55` + DDD + número, sem espaços ou caracteres especiais.

---

## Entrega

Arquivo: `index.html`

Verificar antes de concluir:
- [ ] Mapa carrega e centraliza no endereço correto
- [ ] Swiper com loop e autoplay funcionando
- [ ] Todos os links de WhatsApp apontam para `wa.me/5500000000000`
- [ ] Nenhuma imagem quebrada (todas base64 ou URL do Supabase)
- [ ] CSS e JS 100% embutidos no arquivo
# Prompt — Ad / Post (Boxys)

> Colar no Claude Code junto com o output de copy do app Boxys.

---

**Antes de começar:** peça ao usuário por referências visuais, o link oficial do empreendimento (para baixar fotos), o formato desejado e qualquer arquivo adicional relevante (logo da construtora, etc.). Só inicie a construção após receber esse material.

---

## Copy do Empreendimento

```
[COLAR AQUI O OUTPUT DO APP BOXYS]
```

---

## Regras Técnicas

### Auto-contenção
- Todo CSS em `<style>` no `<head>` — sem arquivos externos, sem JS

### Formato e dimensões
Incluir o meta `ad-size` e usar `aspect-ratio` + `max-width` no container principal:

| Formato | `max-width` | `aspect-ratio` | meta `ad-size` |
|---|---|---|---|
| Feed 1:1 | `1080px` | `1 / 1` | `1080x1080` |
| Post 4:5 | `1080px` | `4 / 5` | `1080x1350` |
| Stories / Reels 9:16 | `1080px` | `9 / 16` | `1080x1920` |
| Banner 1.91:1 | `1200px` | `1200 / 628` | `1200x628` |

```html
<meta name="ad-size" content="[WxH]">
```

```css
.container {
  width: 100%;
  max-width: [W]px;
  aspect-ratio: [W] / [H];
  height: auto;
  overflow: hidden;
}
```

### Imagens externas
Baixar localmente antes de usar:

```bash
curl -o imagem.jpg "https://url-da-imagem.com/foto.jpg"
base64 -w 0 imagem.jpg
```

Inserir no HTML como `data:image/jpeg;base64,...`. Nunca referenciar URLs externas de imagens diretamente no HTML final.

---

## Dados do Corretor

Usar exatamente estes placeholders em todos os locais de contato e assinatura do criativo:

| Campo | Placeholder |
|---|---|
| Nome | `Nome do Corretor` |
| E-mail | `emaildocorretor@gmail.com` |
| Telefone | `00000000000` |
| Foto | `https://eckajutnclcvihnusoqn.supabase.co/storage/v1/object/public/Assets/Utilidades/Imagens/profile.webp` |
| WhatsApp | `https://wa.me/5500000000000` |

> Formato do link: `55` + DDD + número, sem espaços ou caracteres especiais.

---

## Entrega

Arquivo: `ad-[formato].html` (ex: `ad-feed.html`, `ad-stories.html`, `ad-banner.html`)

Verificar antes de concluir:
- [ ] `meta name="ad-size"` presente com as dimensões corretas
- [ ] `aspect-ratio` e `max-width` corretos para o formato
- [ ] `overflow: hidden` no container principal
- [ ] Nenhuma imagem referenciando URL externa
- [ ] Link de WhatsApp aponta para `wa.me/5500000000000`
- [ ] Sem JS