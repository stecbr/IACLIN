export interface PsycheArea {
  code: string;
  label: string;
  emoji: string;
  description: string;
}

export const PSYCHE_AREAS: PsycheArea[] = [
  { code: 'mood', label: 'Humor', emoji: '🌤️', description: 'Estado de humor predominante' },
  { code: 'sleep', label: 'Sono', emoji: '🌙', description: 'Qualidade e duração do sono' },
  { code: 'anxiety', label: 'Ansiedade', emoji: '💭', description: 'Nível de ansiedade percebida' },
  { code: 'family', label: 'Família', emoji: '🏠', description: 'Relações familiares' },
  { code: 'work', label: 'Trabalho', emoji: '💼', description: 'Estudo, trabalho, propósito' },
  { code: 'relationships', label: 'Relações', emoji: '🤝', description: 'Amizades e relacionamento amoroso' },
  { code: 'self_esteem', label: 'Autoestima', emoji: '✨', description: 'Imagem e valor pessoal' },
  { code: 'body', label: 'Corpo / Somatização', emoji: '🫀', description: 'Queixas somáticas e autocuidado' },
];

export function getPsycheAreaLabel(code: string): string {
  return PSYCHE_AREAS.find((a) => a.code === code)?.label ?? code;
}
