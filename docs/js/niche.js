// Detecção automática de nicho a partir do que a coleta já traz: nome e
// descrição do canal, títulos dos vídeos recentes, tópicos que o YouTube
// atribui ao canal e categoria dos vídeos. Palavras-chave em pt, en, es e de.
//
// Palavra-chave = prefixo de palavra ("invest" casa com investimento, investing,
// investieren). Terminada em "$" = palavra exata ("ia$" não casa com "ideia").

export const TAXONOMY = [
  { name: 'finanças', cpm: 'alto', topics: [], cats: [], kw: ['invest', 'financ', 'dinheiro', 'money', 'renda passiva', 'bolsa de valores', 'acoes$', 'stock market', 'stocks$', 'cripto', 'crypto', 'bitcoin', 'aktie', 'geld', 'sparen', 'dinero', 'ahorr', 'economia', 'economy', 'wirtschaft', 'inflac', 'inflation', 'imposto', 'steuer', 'taxes$', 'aposentad', 'retirement', 'rente$', 'dividend', 'poupanca', 'orcamento', 'budget', 'banco$', 'cartao de credito', 'credit card', 'divida', 'debt', 'schulden', 'reich', 'rico$', 'ricos$', 'milionari', 'millionaire', 'patrimonio', 'social security', 'irs$', 'cola$', 'medicare', 'savings', 'pension', 'wealth', 'previdencia'] },
  { name: 'negócios', cpm: 'alto', topics: ['Business'], cats: [], kw: ['negocio', 'empreend', 'business', 'startup', 'empresa', 'marketing', 'vendas$', 'vender', 'sales$', 'unternehm', 'emprend', 'ecommerce', 'e commerce', 'dropship', 'freelanc', 'side hustle', 'renda extra', 'franquia', 'franchise', 'lucro', 'profit', 'cliente', 'customer'] },
  { name: 'tecnologia', cpm: 'alto', topics: ['Technology'], cats: ['28'], kw: ['tecnolog', 'technolog', 'tech$', 'smartphone', 'celular', 'iphone', 'android', 'gadget', 'notebook', 'laptop', 'hardware', 'computador', 'computer', 'samsung', 'apple$', 'unboxing', 'handy$'] },
  { name: 'programação', cpm: 'alto', topics: [], cats: [], kw: ['program', 'codigo', 'coding', 'python', 'javascript', 'software', 'developer', 'desenvolvedor', 'entwickl', 'linux', 'banco de dados', 'database', 'frontend', 'backend', 'web dev'] },
  { name: 'inteligência artificial', cpm: 'alto', topics: [], cats: [], kw: ['inteligencia artificial', 'artificial intelligence', 'kunstliche intelligenz', 'ia$', 'ai$', 'ki$', 'chatgpt', 'openai', 'gpt$', 'midjourney', 'llm', 'automac', 'automation', 'machine learning'] },
  { name: 'saúde', cpm: 'alto', topics: ['Health'], cats: [], kw: ['saude', 'health', 'gesundheit', 'salud', 'medic', 'doenc', 'krank', 'sintoma', 'symptom', 'arzt', 'doctor', 'diabet', 'pressao alta', 'blood pressure', 'blutdruck', 'cancer', 'krebs', 'coracao', 'heart', 'herz', 'vitamin', 'sono$', 'sleep', 'schlaf', 'dor$', 'pain', 'schmerz', 'figado', 'liver', 'leber', 'rim$', 'kidney', 'niere', 'colesterol', 'cholesterin', 'demenz', 'alzheimer', 'imun', 'immun'] },
  { name: 'nutrição', cpm: 'medio', topics: [], cats: [], kw: ['nutri', 'aliment', 'dieta', 'diet', 'ernahrung', 'lebensmittel', 'protein', 'honig', 'mel$', 'honey', 'acucar', 'sugar', 'zucker', 'superfood', 'suplement', 'supplement', 'jejum', 'fasting', 'fasten', 'gluten', 'lactose', 'oleo', 'ol$', 'oil$', 'azeite', 'olivenol', 'kalorien', 'calori'] },
  { name: 'culinária', cpm: 'medio', topics: ['Food'], cats: [], kw: ['receita', 'recipe', 'rezept', 'receta', 'cozinh', 'cooking', 'kochen', 'cocina', 'bolo$', 'cake', 'kuchen', 'churrasco', 'bbq', 'chef$', 'assad', 'backen', 'baking', 'sobremesa', 'dessert', 'lanche', 'snack', 'restaurante', 'restaurant', 'comida', 'food$', 'essen$'] },
  { name: 'fitness', cpm: 'medio', topics: ['Physical_fitness'], cats: [], kw: ['fitness', 'treino', 'workout', 'gym$', 'academia', 'musculac', 'exercise', 'exercicio', 'ubung', 'emagrec', 'weight loss', 'abnehmen', 'yoga', 'corrida', 'running', 'hipertrofia', 'bodybuilding', 'calistenia', 'abdomen', 'gordura', 'fat loss'] },
  { name: 'beleza & moda', cpm: 'medio', topics: ['Fashion', 'Physical_attractiveness'], cats: [], kw: ['beleza', 'beauty', 'maquiagem', 'makeup', 'make up', 'skincare', 'skin care', 'cabelo', 'hair', 'moda$', 'fashion', 'outfit', 'look$', 'schmink', 'belleza', 'perfume', 'unha', 'nails'] },
  { name: 'construção & arquitetura', cpm: 'medio', topics: [], cats: [], kw: ['constru', 'obra$', 'obras$', 'arquitet', 'architect', 'architektur', 'reforma', 'renovat', 'sanier', 'bau$', 'bauen', 'baustelle', 'hausbau', 'haus$', 'hauser', 'grundriss', 'wohnung', 'wohnen', 'engenharia', 'engineering', 'concreto', 'concrete', 'beton', 'tijolo', 'brick', 'telhado', 'roof', 'dach$', 'fachada', 'isolamento', 'dammung', 'styropor', 'heizung', 'aquecimento', 'klimaanlage', 'ar condicionado', 'planta baixa', 'floor plan', 'home builder', 'house building'] },
  { name: 'casa & decoração', cpm: 'medio', topics: [], cats: [], kw: ['decora', 'decor', 'interior', 'organizac', 'organiz', 'limpeza', 'cleaning', 'putzen', 'jardim', 'garden', 'garten', 'diy$', 'faca voce mesmo', 'ikea', 'plantas', 'plants$', 'moveis', 'furniture', 'mobel'] },
  { name: 'prepping & sobrevivência', cpm: 'medio', topics: [], cats: [], kw: ['prepp', 'prepar', 'survival', 'survive', 'sobreviv', 'overleben', 'bushcraft', 'shtf', 'emp$', 'fema$', 'blackout', 'power outage', 'power goes out', 'apagao', 'stromausfall', 'stockpil', 'stock up', 'estoque de comida', 'canned food', 'enlatad', 'food storage', 'emergency', 'emergencia', 'notfall', 'crisis', 'crise$', 'hard times', 'doomsday', 'bunker', 'collapse', 'colapso', 'crumbles', 'notvorrat', 'krisenvorsorge', 'katastroph', 'army surplus', 'tactical', 'tatico'] },
  { name: 'energia & off-grid', cpm: 'medio', topics: [], cats: [], kw: ['off grid', 'offgrid', 'solar', 'generator', 'gerador', 'battery', 'bateria', 'alternator', 'alternador', 'heater', 'aquecedor', 'energia', 'energy', 'eletricidade', 'electricity', 'power station', 'power bank', 'amish', 'homestead', 'wood stove', 'firewood', 'lenha', 'strom$', 'stromspeicher', 'balkonkraftwerk', 'wechselrichter', 'inverter', 'free energy', 'energy bill', 'conta de luz'] },
  { name: 'imóveis', cpm: 'alto', topics: [], cats: [], kw: ['imovel', 'imoveis', 'real estate', 'immobil', 'aluguel', 'alugar', 'rent$', 'miete', 'financiamento imobiliario', 'mortgage', 'hipoteca', 'hypothek', 'corretor', 'realtor', 'apartamento', 'apartment'] },
  { name: 'automotivo', cpm: 'medio', topics: ['Vehicle', 'Motorsport'], cats: ['2'], kw: ['carro', 'carros', 'car$', 'cars$', 'auto$', 'autos$', 'motor$', 'moto$', 'motos$', 'motorcycle', 'veiculo', 'vehicle', 'fahrzeug', 'tesla', 'mecanic', 'mechanic', 'truck', 'caminhao', 'formula 1', 'f1$', 'bmw', 'porsche', 'mercedes', 'volkswagen', 'vw$', 'toyota', 'eletrico', 'electric car', 'elektroauto'] },
  { name: 'viagem', cpm: 'medio', topics: ['Tourism'], cats: ['19'], kw: ['viagem', 'viajar', 'travel', 'reise', 'viaje', 'turismo', 'tourism', 'hotel', 'voo$', 'flight', 'roteiro', 'itinerary', 'mochil', 'backpack', 'intercambio', 'morar fora', 'morar no', 'morar na', 'living in', 'auswander', 'imigra', 'immigra', 'expat'] },
  { name: 'ciência', cpm: 'medio', topics: [], cats: [], kw: ['cienc', 'scien', 'wissenschaft', 'fisica', 'physics', 'physik', 'quimic', 'chemi', 'biolog', 'astronom', 'espaco', 'space$', 'universo', 'universe', 'weltall', 'nasa', 'planeta', 'planet', 'quantum', 'quantic', 'experiment', 'evoluc', 'evolution', 'dinossaur', 'dinosaur'] },
  { name: 'história', cpm: 'medio', topics: ['Military'], cats: [], kw: ['histori', 'history', 'geschichte', 'guerra', 'war$', 'krieg', 'imperio', 'empire', 'reich$', 'antig', 'ancient', 'medieval', 'mittelalter', 'segunda guerra', 'ww2', 'wwii', 'nazi', 'roman', 'romano', 'egito', 'egypt', 'civilizac', 'civilization'] },
  { name: 'educação', cpm: 'medio', topics: ['Knowledge'], cats: ['27'], kw: ['aula$', 'aulas$', 'lesson', 'curso', 'course', 'aprend', 'learn', 'estud', 'study', 'lernen', 'enem$', 'vestibular', 'concurso', 'explicad', 'explained', 'erklart', 'tutorial', 'professor', 'teacher', 'escola', 'school', 'schule', 'matematica', 'math'] },
  { name: 'idiomas', cpm: 'medio', topics: [], cats: [], kw: ['ingles', 'english', 'idioma', 'language', 'espanhol', 'spanish', 'deutsch lernen', 'learn german', 'aprender alemao', 'frances', 'french', 'vocabul', 'fluen', 'pronunc', 'grammar', 'gramatica', 'grammatik', 'sprache'] },
  { name: 'desenvolvimento pessoal', cpm: 'medio', topics: [], cats: [], kw: ['mindset', 'motivac', 'motivation', 'produtiv', 'productiv', 'habito', 'habit', 'disciplin', 'sucesso', 'success', 'erfolg', 'autoestima', 'self improvement', 'self help', 'psicolog', 'psycholog', 'estoic', 'stoic', 'filosof', 'philosoph', 'mentalidade', 'confian', 'confidence', 'selbstbewusst', 'lideranc', 'leadership', 'comunicac', 'oratoria'] },
  { name: 'relacionamentos', cpm: 'medio', topics: [], cats: [], kw: ['relacionamento', 'relationship', 'namor', 'dating', 'casamento', 'marriage', 'beziehung', 'amor$', 'love$', 'conquist', 'flert', 'flirt', 'red pill', 'seduc', 'divorc', 'scheidung'] },
  { name: 'espiritualidade', cpm: 'medio', topics: ['Religion', 'Christianity'], cats: [], kw: ['deus', 'god$', 'gott', 'biblia', 'bible', 'bibel', 'jesus', 'igreja', 'church', 'kirche', 'oracao', 'prayer', 'gebet', 'espirit', 'spiritual', 'medita', 'signo', 'astrolog', 'tarot', 'zodiac', 'horoscop', 'manifestar', 'manifesting', 'lei da atracao', 'law of attraction'] },
  { name: 'games', cpm: 'baixo', topics: ['Video_game_culture', 'Action_game', 'Action-adventure_game', 'Casual_game', 'Music_video_game', 'Puzzle_video_game', 'Racing_video_game', 'Role-playing_video_game', 'Simulation_video_game', 'Sports_game', 'Strategy_video_game'], cats: ['20'], kw: ['game', 'games$', 'jogo$', 'jogos$', 'gameplay', 'minecraft', 'fortnite', 'roblox', 'gta$', 'playstation', 'ps5', 'xbox', 'nintendo', 'spiel', 'speedrun', 'gamer', 'lets play', 'free fire', 'valorant', 'league of legends', 'cs2', 'fifa', 'pokemon'] },
  { name: 'humor', cpm: 'baixo', topics: ['Humour'], cats: ['23'], kw: ['humor', 'comedia', 'comedy', 'komodie', 'pegadinha', 'prank', 'meme', 'engracad', 'funny', 'lustig', 'react$', 'reagindo', 'reacting', 'sketch', 'piada', 'joke', 'stand up', 'standup', 'zoeira'] },
  { name: 'música', cpm: 'baixo', topics: ['Music', 'Christian_music', 'Classical_music', 'Country_music', 'Electronic_music', 'Hip_hop_music', 'Independent_music', 'Jazz', 'Music_of_Asia', 'Music_of_Latin_America', 'Pop_music', 'Reggae', 'Rhythm_and_blues', 'Rock_music', 'Soul_music'], cats: ['10'], kw: ['music', 'musica', 'song', 'cancao', 'cover$', 'album', 'clipe', 'lyric', 'letra$', 'beat$', 'beats$', 'guitar', 'violao', 'piano', 'rap$', 'funk$', 'sertanejo', 'pagode', 'lied$', 'lieder', 'cancion', 'instrumental', 'playlist'] },
  { name: 'cinema & séries', cpm: 'baixo', topics: ['Film', 'Television_program', 'Entertainment'], cats: ['1', '24'], kw: ['filme', 'filmes', 'movie', 'film$', 'filmen', 'serie$', 'series$', 'netflix', 'trailer', 'marvel', 'resumo do filme', 'recap', 'explicacao do final', 'ending explained', 'cena$', 'pelicula', 'hbo', 'disney'] },
  { name: 'anime & cultura pop', cpm: 'baixo', topics: [], cats: [], kw: ['anime', 'manga$', 'otaku', 'naruto', 'one piece', 'dragon ball', 'cultura pop', 'pop culture', 'geek', 'nerd', 'cosplay', 'quadrinhos', 'comics', 'dc comics', 'star wars', 'harry potter'] },
  { name: 'true crime & mistério', cpm: 'baixo', topics: [], cats: [], kw: ['crime', 'criminal', 'assassin', 'murder', 'mord$', 'morder', 'mister', 'myster', 'desaparec', 'disappear', 'verschwund', 'investigac', 'serial killer', 'policia', 'police', 'polizei', 'caso real', 'true crime', 'sequestro', 'kidnap', 'paranormal', 'assombr', 'haunted', 'terror', 'horror', 'creepy', 'conspirac', 'conspiracy', 'verschwor'] },
  { name: 'curiosidades', cpm: 'baixo', topics: [], cats: [], kw: ['curiosidade', 'curious', 'curiosity', 'fatos', 'facts', 'fakten', 'voce sabia', 'did you know', 'wusstest du', 'top 10', 'top 5', 'incrive', 'amazing', 'unglaublich', 'bizarr', 'strange', 'estranh', 'ninguem sabe', 'nobody knows'] },
  { name: 'infantil', cpm: 'baixo', topics: [], cats: [], kw: ['infantil', 'kids', 'crianca', 'children', 'kinder', 'desenho animado', 'cartoon', 'nursery', 'brinquedo', 'toy$', 'toys$', 'spielzeug', 'bebe$', 'baby', 'educativo'] },
  { name: 'esportes', cpm: 'baixo', topics: ['Sport', 'Association_football', 'American_football', 'Baseball', 'Basketball', 'Boxing', 'Cricket', 'Golf', 'Ice_hockey', 'Mixed_martial_arts', 'Professional_wrestling', 'Tennis', 'Volleyball'], cats: ['17'], kw: ['futebol', 'football', 'soccer', 'fussball', 'gol$', 'goal$', 'nba$', 'basquete', 'basketball', 'ufc$', 'mma$', 'boxe', 'boxing', 'tenis', 'tennis', 'olimp', 'copa do', 'world cup', 'campeonato', 'champions', 'bundesliga', 'brasileirao', 'flamengo', 'corinthians', 'palmeiras', 'real madrid', 'barcelona', 'messi', 'neymar', 'ronaldo'] },
  { name: 'pets & animais', cpm: 'medio', topics: ['Pet', 'Animal'], cats: ['15'], kw: ['pet$', 'pets$', 'cachorro', 'cao$', 'dog$', 'dogs$', 'hund', 'gato$', 'gatos$', 'cat$', 'cats$', 'katze', 'animal', 'animais', 'tier$', 'tiere', 'perro', 'vida selvagem', 'wildlife', 'aquario', 'aquarium', 'passaro', 'bird$', 'birds$', 'veterinar'] },
  { name: 'notícias & política', cpm: 'medio', topics: ['Politics', 'Society'], cats: ['25'], kw: ['noticia', 'news$', 'nachrichten', 'politic', 'politik', 'eleic', 'election', 'wahl$', 'governo', 'government', 'regierung', 'presidente', 'president', 'congresso', 'congress', 'bundestag', 'lula', 'bolsonaro', 'trump', 'stf$', 'ministro', 'minister', 'geopolit'] },
  { name: 'direito', cpm: 'alto', topics: [], cats: [], kw: ['direito', 'advoga', 'lawyer', 'anwalt', 'recht$', 'rechte$', 'juridic', 'lei$', 'leis$', 'law$', 'processo trabalhista', 'tribunal', 'court', 'gericht', 'inss$', 'previdencia', 'heranca', 'inheritance', 'erbe$'] },
  { name: 'fotografia & vídeo', cpm: 'medio', topics: [], cats: [], kw: ['fotograf', 'photograph', 'camera', 'kamera', 'edicao de video', 'video editing', 'premiere', 'davinci', 'lightroom', 'drone', 'cinematic', 'filmmaking', 'youtube tips', 'crescer no youtube', 'grow on youtube', 'thumbnail'] },
  { name: 'arte & desenho', cpm: 'medio', topics: [], cats: [], kw: ['desenho$', 'desenhar', 'drawing', 'zeichn', 'arte$', 'art$', 'kunst', 'pintura', 'painting', 'malen', 'ilustra', 'illustrat', 'aquarela', 'watercolor', 'escultura', 'sculpt', 'artesanato', 'craft', 'basteln', 'croche', 'crochet', 'costura', 'sewing'] },
  { name: 'asmr & relaxamento', cpm: 'baixo', topics: [], cats: [], kw: ['asmr', 'relax', 'entspann', 'relajante', 'sleep music', 'rain sounds', 'som de chuva', 'chuva para dormir', 'lofi', 'lo fi', 'ambient', 'white noise', 'ruido branco', 'meditation music'] },
];

const byName = new Map(TAXONOMY.map((n) => [n.name, n]));
export const taxonomyTier = (name) => byName.get(String(name).toLowerCase())?.cpm ?? null;

export function normalize(text) {
  return ` ${String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = TAXONOMY.map((n) => ({
  ...n,
  re: new RegExp(
    n.kw
      .map((k) => {
        const exact = k.endsWith('$');
        const word = normalize(exact ? k.slice(0, -1) : k).trim();
        return ` ${escapeRe(word)}${exact ? ' ' : ''}`;
      })
      .join('|'),
  ),
}));

// Pesos: nome do canal 3, cada título recente com a palavra 2, descrição 1 por
// palavra distinta (até 3), tópico do YouTube 3, categoria predominante dos vídeos 2.
export function classifyNiche({ title = '', description = '', recent = [], topics = [] } = {}) {
  const nTitle = normalize(title);
  const nDesc = normalize(description);
  const nVideos = recent.map((v) => normalize(v.t));
  const cats = new Map();
  for (const v of recent) if (v.c) cats.set(v.c, (cats.get(v.c) ?? 0) + 1);
  const topCat = [...cats].sort((a, b) => b[1] - a[1])[0];
  const mainCat = topCat && topCat[1] >= Math.max(2, recent.length / 2) ? topCat[0] : null;

  const scored = COMPILED.map((n) => {
    let score = 0;
    if (n.re.test(nTitle)) score += 3;
    score += nVideos.filter((t) => n.re.test(t)).length * 2;
    const global = new RegExp(n.re.source, 'g');
    score += Math.min(3, new Set(nDesc.match(global) ?? []).size);
    score += topics.filter((t) => n.topics.includes(t)).length * 3;
    if (mainCat && n.cats.includes(mainCat)) score += 2;
    return { name: n.name, score };
  })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 3) return { niches: [], confidence: null, scores: scored };
  const niches = [best.name];
  const second = scored[1];
  if (second && second.score >= 3 && second.score >= best.score * 0.6) niches.push(second.name);
  const confidence = best.score >= 8 ? 'alta' : best.score >= 5 ? 'média' : 'baixa';
  return { niches, confidence, scores: scored };
}
