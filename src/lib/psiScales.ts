export type ScaleId = 'phq9' | 'gad7' | 'pss10' | 'audit' | 'cssrs';

export interface ScaleQuestion {
  id: string;
  text: string;
}

export interface ScaleOption {
  value: number;
  label: string;
}

export interface ScaleClassification {
  min: number;
  max: number;
  label: string;
  severity: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe' | 'risk';
  color: string;
  recommendation?: string;
}

export interface PsiScale {
  id: ScaleId;
  name: string;
  shortName: string;
  description: string;
  category: 'depression' | 'anxiety' | 'stress' | 'substance' | 'risk';
  questions: ScaleQuestion[];
  options: ScaleOption[];
  classifications: ScaleClassification[];
  reference: string;
}

const FREQ_OPTIONS: ScaleOption[] = [
  { value: 0, label: 'Nenhuma vez' },
  { value: 1, label: 'Vários dias' },
  { value: 2, label: 'Mais da metade dos dias' },
  { value: 3, label: 'Quase todos os dias' },
];

export const PSI_SCALES: PsiScale[] = [
  {
    id: 'phq9',
    name: 'PHQ-9 — Questionário de Saúde do Paciente',
    shortName: 'PHQ-9 (Depressão)',
    description: 'Rastreio de sintomas depressivos nas últimas 2 semanas.',
    category: 'depression',
    reference: 'Kroenke, Spitzer & Williams (2001)',
    options: FREQ_OPTIONS,
    questions: [
      { id: 'q1', text: 'Pouco interesse ou prazer em fazer as coisas' },
      { id: 'q2', text: 'Sentir-se para baixo, deprimido(a) ou sem perspectiva' },
      { id: 'q3', text: 'Dificuldade para pegar no sono, continuar dormindo ou dormir demais' },
      { id: 'q4', text: 'Sentir-se cansado(a) ou com pouca energia' },
      { id: 'q5', text: 'Falta de apetite ou comer demais' },
      { id: 'q6', text: 'Sentir-se mal consigo mesmo(a), um fracasso ou ter decepcionado a família' },
      { id: 'q7', text: 'Dificuldade para se concentrar (ler, ver TV)' },
      { id: 'q8', text: 'Lentidão para se mover ou falar — ou estar agitado(a) demais' },
      { id: 'q9', text: 'Pensar em se ferir ou que seria melhor estar morto(a)' },
    ],
    classifications: [
      { min: 0, max: 4, label: 'Mínimo', severity: 'minimal', color: '#22C55E' },
      { min: 5, max: 9, label: 'Leve', severity: 'mild', color: '#84CC16' },
      { min: 10, max: 14, label: 'Moderado', severity: 'moderate', color: '#F59E0B', recommendation: 'Considerar acompanhamento sistemático.' },
      { min: 15, max: 19, label: 'Moderadamente grave', severity: 'moderately_severe', color: '#F97316', recommendation: 'Tratamento ativo recomendado.' },
      { min: 20, max: 27, label: 'Grave', severity: 'severe', color: '#EF4444', recommendation: 'Tratamento imediato e avaliação psiquiátrica.' },
    ],
  },
  {
    id: 'gad7',
    name: 'GAD-7 — Transtorno de Ansiedade Generalizada',
    shortName: 'GAD-7 (Ansiedade)',
    description: 'Rastreio de ansiedade generalizada nas últimas 2 semanas.',
    category: 'anxiety',
    reference: 'Spitzer et al. (2006)',
    options: FREQ_OPTIONS,
    questions: [
      { id: 'q1', text: 'Sentir-se nervoso(a), ansioso(a) ou no limite' },
      { id: 'q2', text: 'Não conseguir parar ou controlar as preocupações' },
      { id: 'q3', text: 'Preocupar-se demais com diversas coisas' },
      { id: 'q4', text: 'Dificuldade para relaxar' },
      { id: 'q5', text: 'Estar tão inquieto(a) que é difícil ficar parado(a)' },
      { id: 'q6', text: 'Ficar facilmente irritado(a) ou aborrecido(a)' },
      { id: 'q7', text: 'Sentir medo, como se algo terrível fosse acontecer' },
    ],
    classifications: [
      { min: 0, max: 4, label: 'Mínima', severity: 'minimal', color: '#22C55E' },
      { min: 5, max: 9, label: 'Leve', severity: 'mild', color: '#84CC16' },
      { min: 10, max: 14, label: 'Moderada', severity: 'moderate', color: '#F59E0B', recommendation: 'Considerar avaliação clínica detalhada.' },
      { min: 15, max: 21, label: 'Grave', severity: 'severe', color: '#EF4444', recommendation: 'Considerar tratamento ativo.' },
    ],
  },
  {
    id: 'pss10',
    name: 'PSS-10 — Escala de Estresse Percebido',
    shortName: 'PSS-10 (Estresse)',
    description: 'Percepção de estresse no último mês.',
    category: 'stress',
    reference: 'Cohen et al. (1983)',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Quase nunca' },
      { value: 2, label: 'Às vezes' },
      { value: 3, label: 'Com frequência' },
      { value: 4, label: 'Muito frequentemente' },
    ],
    questions: [
      { id: 'q1', text: 'No último mês, com que frequência se sentiu chateado(a) por algo inesperado?' },
      { id: 'q2', text: 'Sentiu-se incapaz de controlar coisas importantes da sua vida?' },
      { id: 'q3', text: 'Sentiu-se nervoso(a) e estressado(a)?' },
      { id: 'q4', text: 'Sentiu-se confiante para lidar com problemas pessoais? (inverso)' },
      { id: 'q5', text: 'Sentiu que as coisas estavam indo do jeito que queria? (inverso)' },
      { id: 'q6', text: 'Achou que não conseguiria dar conta de tudo que precisava fazer?' },
      { id: 'q7', text: 'Foi capaz de controlar irritações na sua vida? (inverso)' },
      { id: 'q8', text: 'Sentiu que estava no controle das coisas? (inverso)' },
      { id: 'q9', text: 'Ficou irritado(a) com coisas fora do seu controle?' },
      { id: 'q10', text: 'Sentiu que as dificuldades estavam se acumulando demais?' },
    ],
    classifications: [
      { min: 0, max: 13, label: 'Baixo', severity: 'minimal', color: '#22C55E' },
      { min: 14, max: 26, label: 'Moderado', severity: 'moderate', color: '#F59E0B' },
      { min: 27, max: 40, label: 'Alto', severity: 'severe', color: '#EF4444', recommendation: 'Investigar fontes de estresse e estratégias de enfrentamento.' },
    ],
  },
  {
    id: 'audit',
    name: 'AUDIT — Triagem de Uso de Álcool',
    shortName: 'AUDIT (Álcool)',
    description: 'Identifica padrões de consumo de álcool de risco.',
    category: 'substance',
    reference: 'Babor et al. / OMS',
    options: [
      { value: 0, label: '0' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' },
    ],
    questions: [
      { id: 'q1', text: 'Frequência de consumo de álcool (0=Nunca → 4=4+ vezes/sem)' },
      { id: 'q2', text: 'Quantas doses em um dia típico (0=1-2 → 4=10+)' },
      { id: 'q3', text: 'Frequência de 6+ doses em uma ocasião' },
      { id: 'q4', text: 'Não conseguiu parar de beber depois de começar' },
      { id: 'q5', text: 'Deixou de fazer o que era esperado por causa do álcool' },
      { id: 'q6', text: 'Precisou beber pela manhã para se recuperar' },
      { id: 'q7', text: 'Sentiu culpa ou remorso após beber' },
      { id: 'q8', text: 'Não conseguiu lembrar do que aconteceu na noite anterior' },
      { id: 'q9', text: 'Você ou outra pessoa se machucou por causa da bebida (0=Não, 2=Sim no passado, 4=Sim no último ano)' },
      { id: 'q10', text: 'Alguém preocupado sugeriu que diminuísse (0=Não, 2=Sim no passado, 4=Sim no último ano)' },
    ],
    classifications: [
      { min: 0, max: 7, label: 'Baixo risco', severity: 'minimal', color: '#22C55E' },
      { min: 8, max: 15, label: 'Uso de risco', severity: 'moderate', color: '#F59E0B', recommendation: 'Intervenção breve.' },
      { min: 16, max: 19, label: 'Uso nocivo', severity: 'severe', color: '#F97316', recommendation: 'Aconselhamento e monitoramento.' },
      { min: 20, max: 40, label: 'Possível dependência', severity: 'risk', color: '#EF4444', recommendation: 'Encaminhar para avaliação especializada.' },
    ],
  },
  {
    id: 'cssrs',
    name: 'C-SSRS — Triagem de risco suicida (resumida)',
    shortName: 'C-SSRS (Risco suicida)',
    description: 'Avaliação rápida de ideação e comportamento suicida — ATENÇÃO: qualquer resposta SIM exige plano de segurança imediato.',
    category: 'risk',
    reference: 'Posner et al. — Columbia',
    options: [
      { value: 0, label: 'Não' },
      { value: 1, label: 'Sim' },
    ],
    questions: [
      { id: 'q1', text: 'Desejou estar morto(a) ou poder dormir e não acordar?' },
      { id: 'q2', text: 'Teve pensamentos reais de se matar?' },
      { id: 'q3', text: 'Pensou em como faria isso?' },
      { id: 'q4', text: 'Teve a intenção de agir conforme esses pensamentos?' },
      { id: 'q5', text: 'Começou a planejar ou planejou os detalhes?' },
      { id: 'q6', text: 'Em algum momento da vida fez algo, começou ou se preparou para acabar com a própria vida?' },
    ],
    classifications: [
      { min: 0, max: 0, label: 'Sem ideação', severity: 'minimal', color: '#22C55E' },
      { min: 1, max: 1, label: 'Ideação passiva', severity: 'mild', color: '#84CC16', recommendation: 'Acompanhar e investigar.' },
      { min: 2, max: 3, label: 'Ideação ativa', severity: 'moderate', color: '#F59E0B', recommendation: 'Avaliar fatores de risco e protetivos. Considerar plano de segurança.' },
      { min: 4, max: 5, label: 'Risco alto', severity: 'severe', color: '#EF4444', recommendation: 'Plano de segurança imediato. Considerar encaminhamento à emergência psiquiátrica.' },
      { min: 6, max: 6, label: 'Risco muito alto', severity: 'risk', color: '#7F1D1D', recommendation: 'Avaliação psiquiátrica de emergência IMEDIATA. Não deixar a pessoa sozinha.' },
    ],
  },
];

export function getScale(id: ScaleId): PsiScale | undefined {
  return PSI_SCALES.find((s) => s.id === id);
}

export function classifyScore(scale: PsiScale, score: number): ScaleClassification {
  const found = scale.classifications.find((c) => score >= c.min && score <= c.max);
  return found ?? scale.classifications[scale.classifications.length - 1];
}

/**
 * Calculates total score, with PSS-10 inverse items handled.
 */
export function computeScore(scale: PsiScale, answers: Record<string, number>): number {
  if (scale.id === 'pss10') {
    const inverseIds = new Set(['q4', 'q5', 'q7', 'q8']);
    return scale.questions.reduce((sum, q) => {
      const v = answers[q.id] ?? 0;
      return sum + (inverseIds.has(q.id) ? 4 - v : v);
    }, 0);
  }
  return Object.values(answers).reduce((s, v) => s + (v ?? 0), 0);
}
