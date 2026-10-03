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

- **Painel** — indicadores gerais, cards de *pequenos crescendo rápido*, ranking de nichos em alta e a tabela de todos os canais com busca, filtro por nicho/tamanho e ordenação por qualquer coluna (crescimento %/mês, Δ inscritos 7/30 dias, views/dia, views/vídeo, último upload, idade…). Marque canais na tabela para compará-los.
- **Nichos** — por tag: crescimento mediano mensal, novos inscritos, views/dia, views por vídeo, % de canais ativos e quantos pequenos estão em alta; mais um gráfico de **índice de crescimento por nicho** (base 100).
- **Comparar** — até 8 canais no mesmo gráfico (inscritos, views ou vídeos), em valor absoluto, índice base 100 (para comparar canais de tamanhos diferentes) ou ganho desde o início, e uma tabela lado a lado.
- **Canal** — gráficos de inscritos, views, novos inscritos/dia e novas views/dia, histórico completo, tags e notas.
- **Gerenciar** — adicionar canais (`@handle`, URL do canal, URL de um vídeo ou ID `UC…`), editar tags e notas, remover, disparar a coleta e ajustar o critério de “pequeno em alta”.

### Como as métricas são calculadas

- **Crescimento / mês**: variação % de inscritos na janela de 30 dias, normalizada para 30 dias. Enquanto o histórico for menor que 30 dias, usa o que existir (mínimo de 3 dias) e marca o valor com `~`.
- **Pequeno em alta** (ajustável): entre 100 e 100 mil inscritos **e** crescimento ≥ 10%/mês.
- **Nichos** usam a **mediana** dos canais, para um canal gigante não distorcer o nicho. Um canal com várias tags entra em todos os seus nichos.
- **Índice de nicho**: encadeado dia a dia somando só os canais presentes nos dois dias, então incluir um canal novo não cria um salto falso.

> O YouTube arredonda o número de inscritos públicos (ex.: 12.300 em vez de 12.345), então em canais pequenos o crescimento diário aparece “em degraus”. As janelas de 7 e 30 dias suavizam isso.

## Configuração (uma vez, ~10 minutos)

### 1. Chave da YouTube Data API (grátis)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/), crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **YouTube Data API v3**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**. Opcional (recomendado): restrinja a chave só à YouTube Data API v3.

A cota gratuita é de 10.000 unidades/dia. A coleta gasta ~1 unidade a cada 50 canais + 1 por canal (data do último upload) — dá para acompanhar milhares de canais. Só a primeira resolução de um canal adicionado por nome/URL `/c/` usa busca (100 unidades); `@handle`, ID e URL de vídeo custam 1.

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
    { "ref": "@algumcanal", "tags": ["finanças", "shorts"], "notes": "thumbnails fortes", "addedAt": "2026-10-03" }
  ]
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
| `docs/js/app.js` | Interface do site |
| `docs/js/github.js` | Gravação do catálogo via API do GitHub |
| `.github/workflows/coleta.yml` | Agendamento diário + publicação no Pages |
