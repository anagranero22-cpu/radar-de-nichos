# Critérios de nicho do Radar

Este documento é a regra para classificar qualquer canal que entra no Radar de Nichos.
Ele vale para quem cadastra pelo site, para o Claude Code e para a classificação
automática do site (`docs/js/niche.js`), que segue as mesmas palavras-chave daqui.

**Foco atual do projeto (desde 20/10/2026):** documentário explicativo em vídeo longo,
no formato **"por que X é assim"**, narrado por avatar de IA com imagens de IA.
Canal gringo (EUA, em inglês) primeiro. Canais de outros nichos só entram como
referência e recebem a tag do nicho real.

A fase anterior (casa & decoração) está guardada em `arquivo/casa-2026-10/`.

---

## 1. Os nichos do documentário explicativo

Use **exatamente** estes nomes como tag (minúsculas, com acento):

| Tag | O que é | Exemplos de vídeo | Não é |
| --- | --- | --- | --- |
| `cidades & arquitetura` | Por que cidades, bairros, prédios e infraestrutura são como são: urbanismo, subúrbios, arranha-céus, sedes famosas, materiais de construção de um país, "como arruinar uma cidade". | "Why America Stopped Building Neighborhoods Like This"; "Why Doesn't Europe Build Skyscrapers?"; "Headquarters: Apple Park"; "Why Does America Build With Wood?" | Dicas para a sua casa (decoração, reforma); obra passo a passo (construção civil) |
| `países & sociedade` | Por que um país ou um povo é assim: custo de vida, costumes, comportamento, migração, decisões de governo explicadas, comparação entre países. | "Por que quem sai do Brasil não consegue mais viver aqui?!"; "Por que NAMORAR ficou TÃO CARO?!"; "25 American Traditions You Celebrate… But Don't Know Why" | Notícia do dia e opinião política (notícias & política); vlog de viagem (viagem) |
| `empresas & marcas` | Por que uma empresa ou marca deu certo ou errado: expansão para outro país, fracassos, estratégia, produtos proibidos ou polêmicos. | "Why Walmart Failed in Europe..."; "Why Tesla's Cybertruck is Banned in Europe..."; "How Buc-ees Quietly Consumed America" | Como abrir um negócio, renda extra, marketing (negócios); investimento (finanças) |
| `história` | Fatos históricos revisitados: o que não ensinaram na escola, mitos desmontados, episódios polêmicos explicados com fontes. | "The real Rosa Parks: What they didn't teach us in school"; "Why did Hitler give Switzerland a pass?"; "They called McCarthy crazy. Then the KGB files opened." | História de um prédio ou cidade (cidades & arquitetura); história de uma marca (empresas & marcas) |

Qualquer outro assunto (decoração, construção civil, finanças, true crime, ciência,
viagem, notícias) **não é nicho do foco**. Se um canal assim entrar como referência,
ele recebe a tag do nicho real (ex.: `decoração`, `ciência`, `notícias & política`),
nunca uma das tags acima.

### Casos de fronteira (decida assim)

- **Moradia e preço de casa:** como os prédios e bairros são feitos → `cidades & arquitetura`. Economia, política e custo de vida → `países & sociedade`.
- **Um país decide algo sobre uma cidade** (ex.: "Por que o Japão está criando uma nova capital?"): o foco é o desenho da cidade → `cidades & arquitetura`; o foco é o país e o motivo político → `países & sociedade`.
- **Empresa num país** (ex.: "Why Walmart Failed in Europe"): o assunto é a empresa → `empresas & marcas`, mesmo que o vídeo explique a cultura do país.
- **História de um lugar:** prédio, bairro ou cidade → `cidades & arquitetura`. Episódio, pessoa ou guerra → `história`.
- **Tema polêmico atual** (ex.: "Everyone's autistic now"): sociedade e comportamento → `países & sociedade`; saúde explicada → `saúde`.
- **Canal de apresentador famoso:** classifique pelo que os vídeos tratam, não por quem apresenta.

---

## 2. Como classificar um canal

1. Abra os **8 vídeos longos mais recentes** do canal (com mais de 3 minutos). **Shorts não contam.** Se a coleta só trouxer menos de 8 vídeos longos, classifique com os que houver e diga isso na nota.
2. Classifique cada vídeo pelo título (e pela miniatura, se o título não bastar) em um dos nichos da tabela, ou em "outro".
3. Conte:
   - **60% ou mais** dos vídeos no mesmo nicho → o canal recebe **1 tag**: esse nicho.
   - Nenhum nicho chega a 60%, mas o principal tem **40% ou mais** e o segundo tem **30% ou mais** → **2 tags**: o principal primeiro.
   - O principal tem **menos de 40%** → o canal não tem nicho definido. **Não cadastre** (ou cadastre só como referência, com a tag do assunto mais frequente e uma nota explicando).
4. **Não use** o nome do canal, a descrição ou a profissão do apresentador para decidir. Elas só desempatam.
5. Mais de 60% de Shorts nos vídeos recentes → o canal **não entra** (o foco é vídeo longo).

### O que escrever na nota do canal

Uma linha no formato:

```
[Classificação, DD/MM/AAAA] cidades & arquitetura: 6 de 8 vídeos longos (ex.: "título A", "título B"). Formato: "por que X é assim" animado, 8–13 min.
```

O **formato** (animação, narração sem rosto, apresentador real, lista, comparação
entre países) vai na nota, **não** como tag. Assim a página de Nichos compara só nichos.

---

## 3. Checklist para cadastrar um canal novo

- [ ] Tem vídeos longos? (menos de 60% de Shorts)
- [ ] Classifiquei os 8 vídeos longos mais recentes pela tabela da seção 1?
- [ ] A tag segue a regra dos 60% / 40% + 30%?
- [ ] A tag é **exatamente** um dos nomes da seção 1 (ou o nicho real, se for referência de fora)?
- [ ] Escrevi a nota de classificação com a contagem e 2 títulos de exemplo?
- [ ] Idioma marcado (`en` para os canais gringos)?

---

## 4. Classificação automática do site

Quando um canal é cadastrado **sem tag**, o site sugere o nicho sozinho (marcado com
✦ auto) usando as palavras-chave de `docs/js/niche.js`, que seguem este documento e
consideram **só os vídeos longos**. A sugestão é um primeiro palpite: quando ela
diverge da regra da seção 2, vale a regra. Fixe a tag certa em Gerenciar.

Se um nicho novo entrar no foco, atualize **primeiro este documento** e depois
`docs/js/niche.js` (e o teste `test/niche.test.mjs`) para manter os dois iguais.
