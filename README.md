# Radar de Nichos

Site para catalogar canais do YouTube por nicho, acompanhar o crescimento de cada um dia a dia e descobrir quais nichos estão em alta, com destaque para canais **pequenos que estão crescendo rápido**.

Custo zero: o site roda no **GitHub Pages**, a coleta diária no **GitHub Actions** e o histórico fica guardado no próprio repositório (`docs/data/`).

## Como funciona

```
 você (site)  ──salva──▶  docs/data/channels.json   (catálogo: canal, tags de nicho, notas)
                                  │
 GitHub Actions (todo dia 06:17 BRT, ao salvar o catálogo ou no botão "Coletar agora")
   └─ scripts/collect.mjs ── YouTube Data API v3 ──▶ docs/data/stats.json
                                  │                   (metadados + 1 linha de histórico por canal por dia:
                                  │                    inscritos, views totais, nº de vídeos, último upload)
                                  ▼
                       GitHub Pages publica docs/  ──▶  site estático com os gráficos
```

### O que o site mostra

- **Início** — feed de descoberta. Na lateral, filtros por nicho (com busca), país do canal, tamanho, faixa de CPM e formato (Shorts/longos). No topo, o **Radar de oportunidade** destaca os 5 canais com maior score, com uma tese em texto ("Eu testaria agora", "Promissor" ou "Em observação"). Há abas (Todos, ★ Canais que eu faria, Eu testaria agora, Em alta, Virais, Canais novos, CPM alto), ordenação, **ordem aleatória** e visualização em lista detalhada ou grade. Cada card mostra nicho, CPM e ganho mensal estimado, banner, últimos vídeos (com destaque para os que passaram de 2× a mediana), um mini-gráfico de inscritos, as barras de views dos últimos vídeos, a proporção Shorts × longos e os sinais de oportunidade. Os botões ★ (eu faria) e ♡ (favorito) valem na hora.
- **Favoritos** — o mesmo feed só com os canais marcados com ♡.
- **Painel** — indicadores gerais, cards de *pequenos crescendo rápido*, ranking de nichos em alta e a tabela de todos os canais com busca, filtro por nicho/tamanho e ordenação por qualquer coluna (crescimento %/mês, Δ inscritos 7/30 dias, views/dia, views/vídeo, último upload, idade…). Marque canais na tabela para compará-los.
- **Nichos** — por tag: crescimento mediano mensal, novos inscritos, views/dia, views por vídeo, % de canais ativos e quantos pequenos estão em alta; mais um gráfico de **índice de crescimento por nicho** (base 100).
- **Lacunas** — todo dia a coleta busca no YouTube uma lista de temas (editável na própria aba) e dá a cada um um **score de lacuna (0–100)**: demanda (mediana de views dos 20 mais vistos nos últimos dias), espaço para canais pequenos no topo, canais pequenos com vídeo acima de 3× os inscritos, canais novos explodindo e CPM do nicho, com bônus para **lacuna de idioma** (o tema rende em inglês, por exemplo, e quase não existe em alemão ou francês; cada tema pode comparar com um idioma diferente). Mostra o ranking, o histórico do score, os vídeos de referência e um feed de *virais de canais pequenos*, com botão para mandar o canal para o radar. Os temas podem ser agrupados por nicho (uma linha `# Nome do nicho` no editor): a aba filtra por nicho e mostra a posição de cada tema dentro do próprio grupo. No **modo foco**, um nicho recebe a maior parte das buscas diárias (80% por padrão) para ser analisado a fundo, e os outros dividem o resto só para continuar vigiando. Cada tema custa 100 unidades de cota por busca (200 com a comparação em outro idioma); o limite diário de buscas é ajustável e, se passar dele, os temas entram em rodízio.
- **Comparar** — até 8 canais no mesmo gráfico (inscritos, views ou vídeos), em valor absoluto, índice base 100 (para comparar canais de tamanhos diferentes) ou ganho desde o início, e uma tabela lado a lado.
- **Canal** — tese de oportunidade, score detalhado por critério, monetização estimada, formato e cadência, últimos vídeos, gráficos de inscritos, views, novos inscritos/dia e novas views/dia, histórico completo, tags e notas.
- **Gerenciar** — adicionar canais (`@handle`, URL do canal, URL de um vídeo ou ID `UC…`), editar tags e notas, remover, definir a **faixa de CPM de cada nicho**, disparar a coleta e ajustar o critério de “pequeno em alta”.

Tema claro/escuro no botão do topo.

### Critérios de nicho

A regra para classificar canais (o que é decoração, organização, arquitetura & reforma, construção civil…) está em [`CRITERIOS_DE_NICHO.md`](CRITERIOS_DE_NICHO.md). O `CLAUDE.md` manda o Claude Code seguir esse documento ao cadastrar ou reclassificar canais, e a classificação automática abaixo usa as mesmas palavras-chave, só com vídeos longos.

### Nicho automático

Ao colar o link, você não precisa informar o nicho. Se o canal ficar **sem tags**, o site detecta o nicho sozinho (marcado com ✦ auto) a partir do nome e da descrição do canal, dos títulos dos últimos vídeos, dos tópicos que o YouTube atribui ao canal e da categoria dos vídeos. São cerca de 35 nichos (finanças, saúde, construção & arquitetura, games, true crime…), com palavras-chave em português, inglês, espanhol e alemão, e cada um já vem com a sua faixa de CPM. Quando você preenche as tags, valem as suas; em Gerenciar e na página do canal aparece o nicho detectado com um botão para fixá-lo ou somá-lo às suas tags. A lista de nichos e palavras-chave fica em `docs/js/niche.js` e pode ser ampliada.

### Idioma

Cada canal tem um **idioma**, separado das tags de nicho (assim “inglês” não vira um nicho na análise). A coleta detecta sozinha pelo idioma do áudio dos vídeos recentes; se a API não informar, usa o idioma declarado pelo canal e, por último, o país. Você pode corrigir em Gerenciar ou na página do canal. O idioma aparece na faixa do card e pode ser usado como filtro no Início, no Painel e na página de Nichos.

Se o mesmo canal for cadastrado de formas diferentes (`@handle`, URL `/videos`, link de vídeo), o site usa só a primeira entrada e oferece um botão em Gerenciar para remover as duplicadas, juntando as tags e notas delas.

### Como as métricas são calculadas

- **Crescimento / mês**: variação % de inscritos na janela de 30 dias, normalizada para 30 dias. Enquanto o histórico for menor que 30 dias, usa o que existir (mínimo de 3 dias) e marca o valor com `~`.
- **Pequeno em alta** (ajustável): entre 100 e 100 mil inscritos **e** crescimento ≥ 10%/mês.
- **Nichos** usam a **mediana** dos canais, para um canal gigante não distorcer o nicho. Um canal com várias tags entra em todos os seus nichos.
- **Índice de nicho**: encadeado dia a dia somando só os canais presentes nos dois dias, então incluir um canal novo não cria um salto falso.

- **Score de oportunidade (0–100)**: canal pequeno (até 20 pontos) + crescimento mensal (25) + tração, ou seja, a mediana de views dos últimos vídeos dividida pelos inscritos (25) + constância de uploads (15) + CPM do nicho (15). A partir de 65 o canal recebe “Eu testaria agora”; entre 45 e 64, “Promissor”.
- **CPM e ganhos estimados**: cada nicho tem uma faixa (Alto, Médio ou Baixo), sugerida pelo nome da tag ou definida por você em Gerenciar. O ganho mensal é views/mês × RPM da faixa (Alto US$ 4–12, Médio US$ 1,5–4, Baixo US$ 0,3–1,5 por mil views), com desconto proporcional à parcela de Shorts. **É só uma ordem de grandeza**: o RPM real varia muito com o país do público, a época do ano e a monetização do canal.

> O YouTube arredonda o número de inscritos públicos (ex.: 12.300 em vez de 12.345), então em canais pequenos o crescimento diário aparece “em degraus”. As janelas de 7 e 30 dias suavizam isso.

## Configuração (uma vez, ~10 minutos)

### 1. Chave da YouTube Data API (grátis)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/), crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **YouTube Data API v3**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**. Opcional (recomendado): restrinja a chave só à YouTube Data API v3.

A cota gratuita é de 10.000 unidades/dia. A coleta gasta ~1 unidade a cada 50 canais, mais 1 por canal (últimos 8 vídeos) e mais 1 a cada 50 vídeos (views e duração). Dá para acompanhar milhares de canais. Só a primeira resolução de um canal adicionado por nome/URL `/c/` usa busca (100 unidades); `@handle`, ID e URL de vídeo custam 1.

### 2. Secret no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**
- Nome: `YOUTUBE_API_KEY`
- Valor: a chave do passo 1

### 3. Ativar o GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Depois faça o merge desta branch na `main` (ou rode **Actions → Coleta diária e publicação → Run workflow** na `main`). O site fica em `https://<seu-usuario>.github.io/radar-de-nichos/`.

### 4. Editar pelo site (token do GitHub)

Para adicionar canais e editar tags/notas direto no site, crie um **fine-grained token** em GitHub → Settings → Developer settings → [Fine-grained tokens](https://github.com/settings/personal-access-tokens/new):

- *Repository access*: só este repositório
- *Permissions*: **Contents: Read and write** e **Actions: Read and write**

Cole o token em **Gerenciar → Conexão com o GitHub**. Ele fica salvo apenas no seu navegador (localStorage) e só é enviado para `api.github.com`. Sem token, o site funciona em modo leitura — e você ainda pode editar `docs/data/channels.json` pela interface do GitHub:

```json
{
  "channels": [
    { "ref": "@algumcanal", "tags": ["finanças", "shorts"], "language": "pt", "notes": "thumbnails fortes", "addedAt": "2026-10-03", "favorite": true, "pick": true }
  ],
  "niches": { "shorts": { "cpm": "baixo" } }
}
```

Ao salvar o catálogo (pelo site ou pelo GitHub), o workflow roda sozinho: coleta os canais novos e republica o site em 1–3 minutos.

## ⚠️ Privacidade

O GitHub Pages gratuito exige repositório **público**, então o catálogo, as **notas pessoais** e o histórico ficam visíveis para quem abrir o repositório ou o site. Se quiser manter as notas privadas, alternativas gratuitas: tornar o repositório privado e publicar a pasta `docs/` no **Cloudflare Pages** (aceita repositório privado) protegido pelo **Cloudflare Access** (grátis até 50 usuários). A coleta pelo Actions continua funcionando em repositório privado (o uso dela fica bem dentro dos 2.000 minutos grátis/mês).

## Observações

- O GitHub pausa workflows agendados em repositórios sem atividade por 60 dias. Como a coleta faz um commit por dia, isso normalmente não acontece; se acontecer, a aba Actions mostra um botão para reativar.
- O agendamento do GitHub pode atrasar alguns minutos em horários de pico — não afeta o histórico (uma linha por dia; rodar duas vezes no mesmo dia substitui a linha do dia).
- Se um canal for removido do catálogo, o histórico dele continua guardado em `stats.json` e volta a aparecer se ele for adicionado de novo.

## Desenvolvimento

```bash
npm test                                   # testes das métricas e do parser de canais
YOUTUBE_API_KEY=... npm run collect        # coleta local (grava docs/data/stats.json)
npm run serve                              # site em http://localhost:8000
```

Sem dependências nem etapa de build: Node 20+ para a coleta, HTML/CSS/JS puro no site, [Chart.js](https://www.chartjs.org/) via CDN para os gráficos.

| Arquivo | O que é |
|---|---|
| `docs/data/channels.json` | Catálogo editado por você (canais, tags, notas) |
| `docs/data/stats.json` | Gerado pela coleta: metadados e histórico diário |
| `scripts/collect.mjs` | Coleta pela YouTube Data API |
| `docs/js/metrics.js` | Cálculos de crescimento, nichos e “pequenos em alta” |
| `docs/js/insights.js` | CPM, ganhos estimados, score de oportunidade e tese |
| `scripts/discover.mjs` | Busca diária dos temas da aba Lacunas (grava `docs/data/gaps.json`) |
| `docs/js/gaps.js` | Score de lacuna, lacuna de idioma e rodízio de temas |
| `docs/js/explore.js` | Feed do Início/Favoritos |
| `docs/js/language.js` | Detecção do idioma do canal |
| `docs/js/niche.js` | Detecção automática de nicho (taxonomia e palavras-chave) |
| `docs/js/refs.js` | Interpreta @handle, URLs e IDs de canal |
| `docs/js/minicharts.js` | Mini-gráficos dos cards (SVG/HTML) |
| `docs/js/app.js` | Demais páginas e roteamento |
| `docs/js/github.js` | Gravação do catálogo via API do GitHub |
| `.github/workflows/coleta.yml` | Agendamento diário + publicação no Pages |
