export interface DsmCriteria {
  code: string;
  name: string;
  summary: string;
  criteria: string[];
  duration: string;
}

export const DSM_REFERENCE: DsmCriteria[] = [
  {
    code: 'F32 / F33',
    name: 'Transtorno Depressivo Maior (TDM)',
    summary: '5 ou mais sintomas, presentes por ≥2 semanas, com mudança em relação ao funcionamento prévio. Pelo menos um deve ser humor deprimido OU perda de interesse/prazer.',
    duration: '≥ 2 semanas',
    criteria: [
      'Humor deprimido na maior parte do dia',
      'Diminuição acentuada de interesse/prazer',
      'Alteração significativa de peso/apetite',
      'Insônia ou hipersonia',
      'Agitação ou retardo psicomotor',
      'Fadiga ou perda de energia',
      'Sentimentos de inutilidade ou culpa excessiva',
      'Diminuição da capacidade de pensar/concentrar-se',
      'Pensamentos de morte ou ideação suicida',
    ],
  },
  {
    code: 'F41.1',
    name: 'Transtorno de Ansiedade Generalizada (TAG)',
    summary: 'Ansiedade e preocupação excessivas, mais dias do que não, sobre vários eventos. A pessoa tem dificuldade em controlar a preocupação.',
    duration: '≥ 6 meses',
    criteria: [
      'Inquietação ou sensação de "nervos à flor da pele"',
      'Fadiga fácil',
      'Dificuldade de concentração ou "branco" mental',
      'Irritabilidade',
      'Tensão muscular',
      'Perturbação do sono',
    ],
  },
  {
    code: 'F43.1',
    name: 'Transtorno de Estresse Pós-Traumático (TEPT)',
    summary: 'Exposição a evento traumático seguida de sintomas de intrusão, evitação, alterações cognitivas/humor e hiperexcitação.',
    duration: '> 1 mês',
    criteria: [
      'Memórias intrusivas, sonhos, flashbacks',
      'Evitação de estímulos associados ao trauma',
      'Crenças negativas persistentes sobre si/mundo',
      'Estado emocional negativo persistente',
      'Hipervigilância e resposta de sobressalto exagerada',
      'Irritabilidade e comportamento autodestrutivo',
    ],
  },
  {
    code: 'F42',
    name: 'Transtorno Obsessivo-Compulsivo (TOC)',
    summary: 'Presença de obsessões, compulsões ou ambas, consumindo ≥1h/dia ou causando sofrimento significativo.',
    duration: 'Crônico, recorrente',
    criteria: [
      'Obsessões: pensamentos/imagens recorrentes, intrusivos',
      'Compulsões: comportamentos repetitivos para reduzir ansiedade',
      'Reconhecimento de que são produto da própria mente',
      'Resistência inicial aos sintomas',
      'Sofrimento ou prejuízo funcional',
    ],
  },
  {
    code: 'F40.10',
    name: 'Transtorno de Ansiedade Social',
    summary: 'Medo ou ansiedade acentuados em situações sociais nas quais a pessoa pode ser avaliada por outros.',
    duration: '≥ 6 meses',
    criteria: [
      'Medo de avaliação negativa',
      'Situações sociais provocam ansiedade quase sempre',
      'Evitação ou suportadas com sofrimento intenso',
      'Medo desproporcional à ameaça real',
      'Prejuízo significativo no funcionamento',
    ],
  },
  {
    code: 'F31',
    name: 'Transtorno Bipolar',
    summary: 'Episódios de mania/hipomania (humor elevado, expansivo ou irritável) intercalados com episódios depressivos.',
    duration: 'Mania ≥7 dias / Hipomania ≥4 dias',
    criteria: [
      'Autoestima inflada/grandiosidade',
      'Necessidade de sono diminuída',
      'Mais loquaz do que o habitual',
      'Fuga de ideias',
      'Distratibilidade',
      'Aumento de atividade dirigida a objetivos',
      'Envolvimento em atividades de risco',
    ],
  },
];

export interface EmotionalScale {
  value: number;
  label: string;
  color: string;
}

export const EMOTIONAL_EVA: EmotionalScale[] = [
  { value: 0, label: 'Sem sofrimento', color: '#22C55E' },
  { value: 2, label: 'Leve', color: '#84CC16' },
  { value: 4, label: 'Moderado', color: '#F59E0B' },
  { value: 6, label: 'Intenso', color: '#F97316' },
  { value: 8, label: 'Muito intenso', color: '#EF4444' },
  { value: 10, label: 'Insuportável', color: '#7F1D1D' },
];
