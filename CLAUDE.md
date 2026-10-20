# Radar de Nichos: instruções para o Claude Code

Site estático (GitHub Pages) que acompanha canais do YouTube por nicho. Catálogo em
`docs/data/channels.json`, dados da coleta em `docs/data/stats.json` e
`docs/data/gaps.json`. Detalhes técnicos no `README.md`.

## Antes de tudo

Leia **`PROMPT_SISTEMA.md`**: objetivo do projeto, princípios, método de pesquisa
(país → demanda → público → oferta no YouTube → combinar temas → decisão), temas já
descartados e regras do canal com avatar. Siga esse método em toda pesquisa.

## Regra principal: classificação de nicho

**Antes de cadastrar, remover ou mudar a tag de qualquer canal, leia
`CRITERIOS_DE_NICHO.md` e siga-o à risca.**

- Use só as tags de nicho listadas na seção 1 do documento, com a grafia exata
  (`cidades & arquitetura`, `países & sociedade`, `empresas & marcas`, `história`).
  Canal de fora desses nichos recebe a tag do nicho real e nunca uma tag do foco.
- Classifique pelos **8 vídeos longos mais recentes** (Shorts não contam), aplicando a
  regra dos 60% / 40% + 30% da seção 2. Não decida pelo nome do canal nem pela
  profissão de quem apresenta.
- Canal com mais de 60% de Shorts não entra.
- Toda classificação deixa uma nota no canal no formato da seção 2 (contagem e dois
  títulos de exemplo). O formato do canal vai na nota, não na tag.
- Foco atual (desde 20/10/2026): **documentário explicativo "por que X é assim"**,
  vídeo longo, narrado por avatar com imagens de IA, canal gringo. Na dúvida entre dois
  nichos, siga os casos de fronteira da seção 1 e explique na nota.
- A fase anterior (casa & decoração) está em `arquivo/casa-2026-10/`.

## Como obter os vídeos de um canal

Se o canal já foi coletado, os vídeos recentes estão em
`docs/data/stats.json` → `channels[<UC id>].recent` (`t` título, `s` duração em
segundos, `v` views). Para um canal novo, cadastre em `docs/data/channels.json`, faça
push (a coleta roda sozinha em 1–3 minutos), leia os vídeos e só então defina a tag.

## Mudanças no projeto

- Não remova canais nem troque temas da aba Lacunas sem confirmação da usuária.
  Remoções guardam o histórico em `stats.json`, mas mudam a análise.
- Se os critérios mudarem, atualize primeiro `CRITERIOS_DE_NICHO.md`, depois
  `docs/js/niche.js` e `test/niche.test.mjs`. Rode `npm test` antes do commit.
