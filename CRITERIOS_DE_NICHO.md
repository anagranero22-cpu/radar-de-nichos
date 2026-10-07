# Critérios de nicho do Radar

Este documento é a regra para classificar qualquer canal que entra no Radar de Nichos.
Ele vale para quem cadastra pelo site, para o Claude Code e para a classificação
automática do site (`docs/js/niche.js`), que segue as mesmas palavras-chave daqui.

**Foco atual do projeto:** canal gringo (EUA, em inglês), vídeos longos, apresentado
por avatar de IA, com **dicas de decoração**. Canais de outros nichos só entram como
referência e nunca recebem a tag `decoração`.

---

## 1. Os nichos da casa

Use **exatamente** estes nomes como tag (minúsculas, com acento):

| Tag | O que é | Exemplos de vídeo | Não é |
| --- | --- | --- | --- |
| `decoração` | Como deixar a casa mais bonita: design de interiores, móveis, cores, tapetes, cortinas, iluminação decorativa, bancadas e acabamentos escolhidos pela aparência, estilos (old money, japandi, aconchegante), "casa com cara de cara/barata", home tour com foco no interior. | "10 itens de luxo que não valem a pena na sua casa"; "12 Things That Make a Home Feel More Expensive"; "This 1783 Farmhouse Has 20 Patterns in One Room" | Obra, estrutura, custo de construção, planta baixa, reforma completa |
| `organização da casa` | Casa funcional e organizada: destralhe, minimalismo, armazenamento, limpeza, soluções práticas para o dia a dia. | "Your House Isn't Messy. You Own Too Much"; "13 Genius German Home Ideas" | Escolha de móveis e cores (isso é decoração) |
| `arquitetura & reforma` | Projeto e reforma: planta, distribuição dos ambientes, reforma de cozinha e banheiro, fachada, "como eu projetaria/reformaria". | "Não comece sua reforma antes de ver isso"; "House plan mistakes"; "Kitchen remodel mistakes" | Só trocar decoração (isso é decoração); levantar a casa do zero (isso é construção) |
| `construção civil` | Construir a casa: obra, fundação, laje, telhado, alvenaria, concreto, isolamento, ar-condicionado e aquecimento, custos de construção, barndominium e casas alternativas, empreiteiros, defeitos de obra nova. | "Laje sem telhado dá problema?"; "Quanto custa construir em 2026"; "Can 2 Amateurs Frame a House in 48 Hours?"; "Warum Deutschland seine Häuser in Styropor packt" | Decoração e organização |
| `transformação de casas` | Reforma mostrada em antes e depois ou timelapse, sem ensinar (geralmente sem fala, com casa abandonada que vira casa de luxo). | "Satisfying Abandoned House Makeover"; "The Most Satisfying Renovation (No Talking)" | Vídeo que ensina a decorar ou reformar |
| `jardinagem` | Jardim, plantas, horta, paisagismo. | "Paisagismo para casa pequena" | Decoração de interiores |

Qualquer outro assunto (finanças, mercado imobiliário, mansões e casas abandonadas
como história, casas baratas à venda, energia off-grid, lifestyle, receitas, comparação
entre países) **não é nicho da casa**. Se um canal assim entrar como referência, ele
recebe a tag do nicho real (ex.: `imóveis`, `energia & off-grid`, `história`),
nunca uma das tags acima.

### Casos de fronteira (decida assim)

- **Bancada, piso, revestimento:** se o vídeo fala de aparência e escolha → `decoração`. Se fala de instalação, material e custo de obra → `construção civil`.
- **"Faça sua casa parecer maior":** `decoração`.
- **Reforma:** ensinando a planejar ou evitando erros → `arquitetura & reforma`. Só mostrando o antes e depois → `transformação de casas`.
- **Ideias de casas de outros países:** soluções práticas → `organização da casa`; estilo e estética → `decoração`; como as casas são construídas → `construção civil`.
- **Home tour:** foco no interior e no estilo → `decoração`; foco em como a casa foi construída → `construção civil`.
- **Canal de arquiteto:** classifique pelo que os vídeos tratam, não pela profissão de quem apresenta.

---

## 2. Como classificar um canal

1. Abra os **8 vídeos longos mais recentes** do canal (com mais de 3 minutos). **Shorts não contam.**
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
[Classificação, DD/MM/AAAA] decoração: 6 de 8 vídeos longos (ex.: "título A", "título B"). Formato: listas de dicas de designer, 18–20 min.
```

O **formato** (lista de dicas, home tour, antes e depois, outros países, referência
grande) vai na nota, **não** como tag. Assim a página de Nichos compara só nichos.

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
