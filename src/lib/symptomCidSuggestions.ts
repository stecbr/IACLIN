/**
 * Mapeamento local de queixas/sintomas em português → sugestões de CID-10.
 * Permite sugestão inteligente sem chamada de API externa.
 */

export interface SymptomCidSuggestion {
  code: string;
  description: string;
}

interface SymptomEntry {
  keywords: string[];
  suggestions: SymptomCidSuggestion[];
}

function n(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const ENTRIES: SymptomEntry[] = [
  // ── Cabeça ─────────────────────────────────────────────────────────────
  {
    keywords: ['dor de cabeca', 'cefaleia', 'dor cabeca', 'dor na cabeca', 'cabeca doendo'],
    suggestions: [
      { code: 'G43', description: 'Enxaqueca' },
      { code: 'G44', description: 'Outras síndromes de cefaleia' },
      { code: 'G44.2', description: 'Cefaleia do tipo tensional' },
      { code: 'R51', description: 'Cefaleia' },
    ],
  },
  {
    keywords: ['enxaqueca', 'migrânea', 'migranea'],
    suggestions: [
      { code: 'G43', description: 'Enxaqueca' },
      { code: 'G43.0', description: 'Enxaqueca sem aura' },
      { code: 'G43.1', description: 'Enxaqueca com aura' },
    ],
  },
  {
    keywords: ['tontura', 'vertigem', 'labirintite', 'enjoo', 'enjôo'],
    suggestions: [
      { code: 'H81', description: 'Distúrbios da função vestibular' },
      { code: 'H81.1', description: 'Vertigem posicional paroxística benigna' },
      { code: 'H81.0', description: 'Doença de Ménière' },
      { code: 'R42', description: 'Tontura e instabilidade' },
    ],
  },
  // ── Respiratório ────────────────────────────────────────────────────────
  {
    keywords: ['resfriado', 'gripe', 'coriza', 'nariz escorrendo', 'espirro'],
    suggestions: [
      { code: 'J06', description: 'Infecções agudas das vias aéreas superiores' },
      { code: 'J00', description: 'Rinofaringite aguda (resfriado comum)' },
      { code: 'J11', description: 'Influenza sem vírus identificado' },
    ],
  },
  {
    keywords: ['febre', 'febril', 'temperatura alta', 'estado febril'],
    suggestions: [
      { code: 'R50', description: 'Febre de causa desconhecida' },
      { code: 'J06', description: 'Infecções agudas das vias aéreas superiores' },
      { code: 'A09', description: 'Outras gastroenterites e colites infecciosas' },
    ],
  },
  {
    keywords: ['tosse', 'tossindo', 'tosse seca', 'tosse produtiva'],
    suggestions: [
      { code: 'R05', description: 'Tosse' },
      { code: 'J06', description: 'Infecções agudas das vias aéreas superiores' },
      { code: 'J20', description: 'Bronquite aguda' },
      { code: 'J40', description: 'Bronquite não especificada' },
    ],
  },
  {
    keywords: ['dor de garganta', 'garganta inflamada', 'faringite', 'amigdalite', 'dor ao engolir'],
    suggestions: [
      { code: 'J02', description: 'Faringite aguda' },
      { code: 'J03', description: 'Amigdalite aguda' },
      { code: 'J02.9', description: 'Faringite aguda não especificada' },
    ],
  },
  {
    keywords: ['sinusite', 'seio paranasal', 'nariz entupido', 'congestao nasal'],
    suggestions: [
      { code: 'J01', description: 'Sinusite aguda' },
      { code: 'J32', description: 'Sinusite crônica' },
      { code: 'J30', description: 'Rinite alérgica e vasomotora' },
    ],
  },
  {
    keywords: ['falta de ar', 'dispneia', 'dificuldade respirar', 'respiracao difícil', 'respiracao dificil'],
    suggestions: [
      { code: 'R06.0', description: 'Dispneia' },
      { code: 'J45', description: 'Asma' },
      { code: 'J44', description: 'Doença pulmonar obstrutiva crônica' },
      { code: 'I50', description: 'Insuficiência cardíaca' },
    ],
  },
  // ── Cardiovascular ──────────────────────────────────────────────────────
  {
    keywords: ['dor no peito', 'dor toracica', 'aperto no peito', 'dor precordial'],
    suggestions: [
      { code: 'I20', description: 'Angina pectoris' },
      { code: 'I21', description: 'Infarto agudo do miocárdio' },
      { code: 'R07', description: 'Dor de garganta e no peito' },
      { code: 'K21', description: 'Doença de refluxo gastroesofágico' },
    ],
  },
  {
    keywords: ['palpitacao', 'palpitações', 'coração acelerado', 'taquicardia', 'arritmia'],
    suggestions: [
      { code: 'I49', description: 'Outras arritmias cardíacas' },
      { code: 'R00', description: 'Anormalidades do batimento cardíaco' },
      { code: 'I47', description: 'Taquicardia paroxística' },
    ],
  },
  {
    keywords: ['hipertensao', 'pressao alta', 'pressão alta', 'pa elevada'],
    suggestions: [
      { code: 'I10', description: 'Hipertensão essencial (primária)' },
      { code: 'I11', description: 'Doença cardíaca hipertensiva' },
    ],
  },
  // ── Digestivo ───────────────────────────────────────────────────────────
  {
    keywords: ['dor abdominal', 'dor na barriga', 'dor de barriga', 'colica', 'cólica'],
    suggestions: [
      { code: 'R10', description: 'Dor abdominal e pélvica' },
      { code: 'K29', description: 'Gastrite e duodenite' },
      { code: 'K57', description: 'Doença diverticular do intestino' },
    ],
  },
  {
    keywords: ['nausea', 'náusea', 'vomito', 'vômito', 'enjoo'],
    suggestions: [
      { code: 'R11', description: 'Náusea e vômitos' },
      { code: 'K21', description: 'Doença de refluxo gastroesofágico' },
      { code: 'A09', description: 'Gastroenterite infecciosa' },
    ],
  },
  {
    keywords: ['diarreia', 'diarréia', 'fezes liquidas', 'intestino solto'],
    suggestions: [
      { code: 'A09', description: 'Outras gastroenterites e colites infecciosas' },
      { code: 'K58', description: 'Síndrome do cólon irritável' },
      { code: 'K59.1', description: 'Diarreia funcional' },
    ],
  },
  {
    keywords: ['constipacao', 'constipação', 'prisao de ventre', 'intestino preso'],
    suggestions: [
      { code: 'K59.0', description: 'Constipação intestinal' },
      { code: 'K58', description: 'Síndrome do cólon irritável' },
    ],
  },
  {
    keywords: ['queimacao', 'queimação', 'refluxo', 'azia', 'pirose', 'gastrite'],
    suggestions: [
      { code: 'K21', description: 'Doença de refluxo gastroesofágico' },
      { code: 'K29', description: 'Gastrite e duodenite' },
      { code: 'K25', description: 'Úlcera gástrica' },
    ],
  },
  // ── Musculoesquelético ──────────────────────────────────────────────────
  {
    keywords: ['dor nas costas', 'lombalgia', 'dor lombar', 'dor na coluna'],
    suggestions: [
      { code: 'M54.5', description: 'Dor lombar baixa' },
      { code: 'M54.4', description: 'Lumbago com ciática' },
      { code: 'M51', description: 'Outras lesões de discos intervertebrais' },
    ],
  },
  {
    keywords: ['cervicalgia', 'dor no pescoco', 'dor no pescoço', 'dor cervical', 'torcicolo'],
    suggestions: [
      { code: 'M54.2', description: 'Cervicalgia' },
      { code: 'M54.3', description: 'Ciática' },
      { code: 'M47', description: 'Espondilose' },
    ],
  },
  {
    keywords: ['articulacao', 'articulação', 'artrite', 'artralgia', 'dor na articulacao'],
    suggestions: [
      { code: 'M19', description: 'Outras artrites' },
      { code: 'M06', description: 'Artrite reumatoide' },
      { code: 'M10', description: 'Gota' },
      { code: 'M15', description: 'Poliartrose' },
    ],
  },
  // ── Urinário ────────────────────────────────────────────────────────────
  {
    keywords: ['infeccao urinaria', 'infecção urinaria', 'itu', 'cistite', 'ardencia ao urinar', 'disuria'],
    suggestions: [
      { code: 'N30', description: 'Cistite' },
      { code: 'N39.0', description: 'Infecção urinária de localização não especificada' },
      { code: 'N12', description: 'Nefrite tubulo-intersticial' },
    ],
  },
  // ── Mental / Emocional ──────────────────────────────────────────────────
  {
    keywords: ['ansiedade', 'ansioso', 'panico', 'pânico', 'crise de ansiedade'],
    suggestions: [
      { code: 'F41.1', description: 'Transtorno de ansiedade generalizada' },
      { code: 'F41.0', description: 'Transtorno de pânico' },
      { code: 'F40', description: 'Transtornos fóbico-ansiosos' },
    ],
  },
  {
    keywords: ['depressao', 'depressão', 'triste', 'tristeza', 'melancolia', 'humor deprimido'],
    suggestions: [
      { code: 'F32', description: 'Episódios depressivos' },
      { code: 'F33', description: 'Transtorno depressivo recorrente' },
      { code: 'F41.2', description: 'Transtorno misto ansioso e depressivo' },
    ],
  },
  {
    keywords: ['insonia', 'insônia', 'dificuldade dormir', 'nao consegue dormir', 'sono ruim'],
    suggestions: [
      { code: 'G47.0', description: 'Insônia' },
      { code: 'F51.0', description: 'Insônia não orgânica' },
    ],
  },
  // ── Pele ────────────────────────────────────────────────────────────────
  {
    keywords: ['alergia', 'urticaria', 'urticária', 'coceira', 'prurido'],
    suggestions: [
      { code: 'L50', description: 'Urticária' },
      { code: 'L30', description: 'Outras dermatites' },
      { code: 'T78.1', description: 'Outras reações alérgicas' },
    ],
  },
  {
    keywords: ['dermatite', 'eczema', 'pele vermelha', 'irritacao na pele'],
    suggestions: [
      { code: 'L20', description: 'Dermatite atópica' },
      { code: 'L25', description: 'Dermatite de contato não especificada' },
      { code: 'L30', description: 'Outras dermatites' },
    ],
  },
  // ── Endócrino ───────────────────────────────────────────────────────────
  {
    keywords: ['diabetes', 'glicose alta', 'açucar alto', 'acucar alto', 'hiperglicemia'],
    suggestions: [
      { code: 'E11', description: 'Diabetes mellitus tipo 2' },
      { code: 'E10', description: 'Diabetes mellitus tipo 1' },
      { code: 'E13', description: 'Outros tipos especificados de diabetes mellitus' },
    ],
  },
  // ── Ocular / Otorrinolaringológico ───────────────────────────────────────
  {
    keywords: ['conjuntivite', 'olho vermelho', 'olho com secrecao'],
    suggestions: [
      { code: 'H10', description: 'Conjuntivite' },
      { code: 'H10.1', description: 'Conjuntivite aguda atópica' },
    ],
  },
  {
    keywords: ['otite', 'dor de ouvido', 'dor no ouvido'],
    suggestions: [
      { code: 'H66', description: 'Otite média supurativa' },
      { code: 'H65', description: 'Otite média não supurativa' },
      { code: 'H60', description: 'Otite externa' },
    ],
  },
  // ── Odontológico ────────────────────────────────────────────────────────
  {
    keywords: ['dor de dente', 'odontalgia', 'dor dental', 'dente doendo'],
    suggestions: [
      { code: 'K08.8', description: 'Outras doenças especificadas dos dentes' },
      { code: 'K04', description: 'Doenças da polpa e dos tecidos periapicais' },
      { code: 'K04.0', description: 'Pulpite' },
    ],
  },
  {
    keywords: ['carie', 'cárie', 'cáries', 'caries'],
    suggestions: [
      { code: 'K02', description: 'Cárie dentária' },
      { code: 'K02.1', description: 'Cárie da dentina' },
    ],
  },
  {
    keywords: ['abscesso dental', 'abscesso dentario', 'abscesso na gengiva', 'infeccao dental'],
    suggestions: [
      { code: 'K04.7', description: 'Abscesso periapical sem fístula' },
      { code: 'K05.2', description: 'Periodontite aguda' },
    ],
  },
];

export function getSymptomCidSuggestions(text: string): SymptomCidSuggestion[] {
  const term = n(text.trim());
  if (term.length < 3) return [];

  const matched: SymptomCidSuggestion[] = [];
  const seenCodes = new Set<string>();

  for (const entry of ENTRIES) {
    const hit = entry.keywords.some(kw => term.includes(n(kw)) || n(kw).includes(term));
    if (hit) {
      for (const s of entry.suggestions) {
        if (!seenCodes.has(s.code)) {
          seenCodes.add(s.code);
          matched.push(s);
        }
      }
    }
  }

  return matched.slice(0, 6);
}
