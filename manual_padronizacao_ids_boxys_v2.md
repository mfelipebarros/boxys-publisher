# Manual de Padronização de IDs
**Estrutura Oficial de Nomenclatura para Campanhas e Ativos Internos — Boxys**

Este documento define a arquitetura padrão de nomenclatura e estruturação de identificadores (IDs) dentro do ecossistema do App Boxys. A adoção exata desta sintaxe por desenvolvedores, designers e copywriters é obrigatória para assegurar a indexação automatizada correta no banco de dados da plataforma e o funcionamento sem falhas das rotinas de distribuição de tráfego.

---

## O Modelo de Identificação (Sintaxe)

### Estrutura Universal de Entrada de Dados

```
[DMBC]-[M/G/S/A]-[E/C/S/V/T/01]
```

---

## Legenda e Especificação das Siglas

### 1. Campanha / Produto — 4 Caracteres

| Código | Significado | Regra de Aplicação |
|--------|-------------|-------------------|
| `DMBC` | Abreviação alfanumérica de quatro letras do nome do produto ou tema da campanha | Sempre em caixa alta. Identifica o tema macro ou o infoproduto/imóvel mapeado. |

---

### 2. Canal / Plataforma — 1 Caractere

| Código | Significado | Regra de Aplicação |
|--------|-------------|-------------------|
| `M` | Meta Ads | Ativos destinados a anúncios patrocinados no Facebook/Instagram. |
| `G` | Google Ads | Ativos focados em campanhas da rede do Google. |
| `S` | Rede Social (Orgânico) | Formatos nativos para mídias sociais ou posts sem investimento em mídia. |
| `A` | App Boxys | Conteúdos e mídias de uso exclusivo da interface ou operação do aplicativo. |

---

### 3. Formato do Ativo — 1 Caractere

| Código | Significado | Regra de Aplicação |
|--------|-------------|-------------------|
| `E` | Estático | Criativos compostos por uma única imagem estática. |
| `C` | Carrossel | Criativos ou publicações sequenciais multi-slides. |
| `S` | Search | Anúncios e blocos estruturados em formato de texto para busca. |
| `V` | Vídeo | Roteiros de gravação ou arquivos audiovisuais. |
| `T` | Thumb / Miniatura | Capa ou miniatura de campanhas e vitrines de ativação dentro do app. |

---

### 4. Variação Sequencial — 2 Caracteres

| Código | Significado | Regra de Aplicação |
|--------|-------------|-------------------|
| `01`, `02`... | Número da Variação | Contador numérico decimal sequencial para diferenciar versões e testes A/B. |

---

## Exemplos Práticos de Aplicação

| ID | Descrição |
|----|-----------|
| `DMBC-M-E01` | Campanha: DMBC · Canal: Meta Ads (M) · Formato: Estático (E) · Variação: 01 |
| `DMBC-G-S01` | Campanha: DMBC · Canal: Google Ads (G) · Formato: Search (S) · Variação: 01 |
| `DMBC-A-V01` | Campanha: DMBC · Canal: App Boxys (A) · Formato: Vídeo (V) · Variação: 01 (Roteiro do vídeo interno) |
| `DMBC-A-T01` | Campanha: DMBC · Canal: App Boxys (A) · Formato: Thumb (T) · Variação: 01 (Capa para ativação no app) |

---

> **Validação do Banco de Dados:** O sistema de leitura automática de planilhas e scripts da Boxys exige a utilização do hífen como separador de blocos. A combinação final do caractere de formato com os dígitos de variação deve ser contínua (ex: `V01`, `T02`). Entradas fora do formato padrão não serão interpretadas pelo validador do aplicativo.

---

*Boxys Plataforma de Marketing | Confidencial*
