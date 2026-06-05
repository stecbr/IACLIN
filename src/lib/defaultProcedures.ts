export interface SuggestedProcedure {
  name: string;
  category: string;
  duration: number;
  color: string;
}

// ─── Paleta de cores por área ─────────────────────────────────────────────────
const C = {
  blue:    '#3B82F6',
  red:     '#EF4444',
  green:   '#22C55E',
  amber:   '#F59E0B',
  purple:  '#8B5CF6',
  pink:    '#EC4899',
  cyan:    '#06B6D4',
  orange:  '#F97316',
  indigo:  '#6366F1',
  teal:    '#14B8A6',
  rose:    '#F43F5E',
  lime:    '#84CC16',
};

// ─── Procedimentos por especialidade (specialty ID → lista) ───────────────────
// Chaves correspondem aos ids de SPECIALTIES em SpecialtyStep.tsx

const CARDIO: SuggestedProcedure[] = [
  { name: 'Consulta Cardiológica',                         category: 'Cardiologia', duration: 30,  color: C.red    },
  { name: 'Eletrocardiograma (ECG)',                       category: 'Cardiologia', duration: 20,  color: C.red    },
  { name: 'Ecocardiograma Transtorácico',                  category: 'Cardiologia', duration: 40,  color: C.red    },
  { name: 'Teste Ergométrico',                             category: 'Cardiologia', duration: 60,  color: C.red    },
  { name: 'Holter 24h (instalação)',                       category: 'Cardiologia', duration: 15,  color: C.orange },
  { name: 'Holter 24h (retirada e laudo)',                 category: 'Cardiologia', duration: 20,  color: C.orange },
  { name: 'MAPA (instalação)',                             category: 'Cardiologia', duration: 15,  color: C.amber  },
  { name: 'MAPA (retirada e laudo)',                       category: 'Cardiologia', duration: 20,  color: C.amber  },
  { name: 'Ecodoppler Vascular Periférico',                category: 'Cardiologia', duration: 30,  color: C.blue   },
  { name: 'Consulta de Retorno Cardiológico',              category: 'Cardiologia', duration: 20,  color: C.red    },
];

const CLINICO_GERAL: SuggestedProcedure[] = [
  { name: 'Consulta Clínica Geral',                        category: 'Clínico Geral', duration: 30,  color: C.blue   },
  { name: 'Consulta de Retorno',                           category: 'Clínico Geral', duration: 20,  color: C.blue   },
  { name: 'Check-up Anual',                                category: 'Clínico Geral', duration: 60,  color: C.teal   },
  { name: 'Atestado Médico',                               category: 'Clínico Geral', duration: 10,  color: C.green  },
  { name: 'Declaração Médica',                             category: 'Clínico Geral', duration: 10,  color: C.green  },
  { name: 'Renovação de Receita',                          category: 'Clínico Geral', duration: 15,  color: C.cyan   },
  { name: 'Solicitação de Exames',                         category: 'Clínico Geral', duration: 15,  color: C.cyan   },
];

const ORTOPEDIA: SuggestedProcedure[] = [
  { name: 'Consulta Ortopédica',                           category: 'Ortopedia',  duration: 30,  color: C.blue   },
  { name: 'Infiltração Articular',                         category: 'Ortopedia',  duration: 20,  color: C.amber  },
  { name: 'Aplicação de Gesso',                            category: 'Ortopedia',  duration: 30,  color: C.orange },
  { name: 'Retirada de Pontos',                            category: 'Ortopedia',  duration: 15,  color: C.green  },
  { name: 'Revisão Pós-cirúrgica',                         category: 'Ortopedia',  duration: 20,  color: C.blue   },
];

const NEUROLOGIA: SuggestedProcedure[] = [
  { name: 'Consulta Neurológica',                          category: 'Neurologia', duration: 40,  color: C.indigo },
  { name: 'Eletroencefalograma (EEG)',                     category: 'Neurologia', duration: 60,  color: C.purple },
  { name: 'Consulta de Retorno Neurológico',               category: 'Neurologia', duration: 25,  color: C.indigo },
];

const DERMATOLOGIA: SuggestedProcedure[] = [
  { name: 'Consulta Dermatológica',                        category: 'Dermatologia', duration: 30,  color: C.rose   },
  { name: 'Peeling Químico',                               category: 'Dermatologia', duration: 45,  color: C.pink   },
  { name: 'Biópsia de Pele',                               category: 'Dermatologia', duration: 30,  color: C.red    },
  { name: 'Crioterapia',                                   category: 'Dermatologia', duration: 20,  color: C.cyan   },
  { name: 'Cauterização de Lesão',                         category: 'Dermatologia', duration: 20,  color: C.amber  },
];

const GINECOLOGIA: SuggestedProcedure[] = [
  { name: 'Consulta Ginecológica',                         category: 'Ginecologia', duration: 30,  color: C.pink   },
  { name: 'Papanicolau (Colpocitologia)',                   category: 'Ginecologia', duration: 20,  color: C.rose   },
  { name: 'Inserção de DIU',                               category: 'Ginecologia', duration: 30,  color: C.pink   },
  { name: 'Colposcopia',                                   category: 'Ginecologia', duration: 30,  color: C.pink   },
  { name: 'Pré-natal',                                     category: 'Ginecologia', duration: 30,  color: C.rose   },
];

const PEDIATRIA: SuggestedProcedure[] = [
  { name: 'Consulta Pediátrica',                           category: 'Pediatria',  duration: 30,  color: C.teal   },
  { name: 'Consulta de Puericultura',                      category: 'Pediatria',  duration: 30,  color: C.teal   },
  { name: 'Vacinação',                                     category: 'Pediatria',  duration: 15,  color: C.green  },
  { name: 'Teste do Pezinho',                              category: 'Pediatria',  duration: 15,  color: C.cyan   },
];

const PSI: SuggestedProcedure[] = [
  { name: 'Sessão de Psicoterapia',                        category: 'Psicologia', duration: 50,  color: C.purple },
  { name: 'Avaliação Psicológica',                         category: 'Psicologia', duration: 60,  color: C.indigo },
  { name: 'Sessão de Casal',                               category: 'Psicologia', duration: 50,  color: C.pink   },
  { name: 'Sessão de Grupo',                               category: 'Psicologia', duration: 90,  color: C.purple },
  { name: 'Relatório Psicológico',                         category: 'Psicologia', duration: 30,  color: C.indigo },
];

const PHYSIO: SuggestedProcedure[] = [
  { name: 'Avaliação Fisioterapêutica',                    category: 'Fisioterapia', duration: 60,  color: C.teal   },
  { name: 'Sessão de Fisioterapia',                        category: 'Fisioterapia', duration: 50,  color: C.teal   },
  { name: 'RPG (Reeducação Postural)',                      category: 'Fisioterapia', duration: 50,  color: C.green  },
  { name: 'Pilates Clínico',                               category: 'Fisioterapia', duration: 50,  color: C.lime   },
  { name: 'Acupuntura',                                    category: 'Fisioterapia', duration: 45,  color: C.amber  },
  { name: 'Dry Needling',                                  category: 'Fisioterapia', duration: 40,  color: C.orange },
];

const NUTRITION: SuggestedProcedure[] = [
  { name: 'Consulta Nutricional',                          category: 'Nutrição',   duration: 50,  color: C.lime   },
  { name: 'Avaliação Nutricional',                         category: 'Nutrição',   duration: 60,  color: C.green  },
  { name: 'Retorno Nutricional',                           category: 'Nutrição',   duration: 30,  color: C.lime   },
  { name: 'Plano Alimentar',                               category: 'Nutrição',   duration: 30,  color: C.green  },
];

const ODONTO: SuggestedProcedure[] = [
  { name: 'Consulta Odontológica',                         category: 'Odontologia', duration: 30,  color: C.blue   },
  { name: 'Limpeza / Profilaxia',                          category: 'Odontologia', duration: 45,  color: C.cyan   },
  { name: 'Extração Simples',                              category: 'Odontologia', duration: 30,  color: C.red    },
  { name: 'Restauração (Resina)',                          category: 'Odontologia', duration: 40,  color: C.blue   },
  { name: 'Tratamento de Canal (por canal)',               category: 'Endodontia',  duration: 60,  color: C.amber  },
  { name: 'Clareamento Dental (sessão)',                   category: 'Estética',    duration: 60,  color: C.pink   },
  { name: 'Aplicação de Flúor',                           category: 'Prevenção',   duration: 20,  color: C.green  },
  { name: 'Cirurgia de Siso',                             category: 'Cirurgia',    duration: 60,  color: C.orange },
  { name: 'Implante Dentário',                            category: 'Implantodontia', duration: 90, color: C.purple },
  { name: 'Moldagem',                                     category: 'Prótese',     duration: 30,  color: C.teal   },
];

const ESTETICA: SuggestedProcedure[] = [
  { name: 'Aplicação de Botox',                            category: 'Estética',   duration: 30,  color: C.pink   },
  { name: 'Preenchimento Facial',                          category: 'Estética',   duration: 40,  color: C.rose   },
  { name: 'Drenagem Linfática',                            category: 'Estética',   duration: 60,  color: C.teal   },
  { name: 'Peeling Facial',                                category: 'Estética',   duration: 45,  color: C.amber  },
  { name: 'Harmonização Orofacial',                        category: 'Estética',   duration: 60,  color: C.pink   },
  { name: 'Laser Facial',                                  category: 'Estética',   duration: 40,  color: C.purple },
];

// ─── Mapa principal ───────────────────────────────────────────────────────────

export const SPECIALTY_PROCEDURES: Record<string, SuggestedProcedure[]> = {
  // Especialidades médicas específicas
  'cardiologia':                CARDIO,
  'clinico-geral':              CLINICO_GERAL,
  'medicina-interna':           CLINICO_GERAL,
  'medicina-familia':           CLINICO_GERAL,
  'ortopedia':                  ORTOPEDIA,
  'traumatologia':              ORTOPEDIA,
  'neurologia':                 NEUROLOGIA,
  'neurocirurgia':              NEUROLOGIA,
  'dermatologia':               DERMATOLOGIA,
  'ginecologia':                GINECOLOGIA,
  'obstetricia':                GINECOLOGIA,
  'pediatria':                  PEDIATRIA,
  'neonatologia':               PEDIATRIA,

  // Saúde mental
  'psicologia':                 PSI,
  'psicoterapia':               PSI,
  'psiquiatria':                PSI,
  'neuropsicologia':            PSI,

  // Reabilitação
  'fisioterapia':               PHYSIO,
  'quiropraxia':                PHYSIO,
  'osteopatia':                 PHYSIO,

  // Nutrição
  'nutricao':                   NUTRITION,
  'nutrologia':                 NUTRITION,

  // Odontologia
  'dentista':                   ODONTO,
  'limpeza-dental':             ODONTO,
  'clinico-odonto':             ODONTO,
  'endodontia':                 ODONTO,
  'ortodontia':                 ODONTO,
  'periodontia':                ODONTO,
  'implantodontia':             ODONTO,
  'odontopediatria':            ODONTO,
  'cirurgia-bucomaxilofacial':  ODONTO,
  'protese-dentaria':           ODONTO,
  'odontologia-estetica':       ODONTO,

  // Estética
  'cirurgia-plastica':          ESTETICA,
  'estetica':                   ESTETICA,
  'dermatologia-estetica':      ESTETICA,
};

/** Retorna sugestões de procedimentos para uma especialidade. Tenta correspondência
 *  direta pelo id e depois por substrings da família. */
export function getSuggestedProcedures(specialtyId: string | null | undefined): SuggestedProcedure[] {
  if (!specialtyId) return CLINICO_GERAL;

  // Correspondência direta
  if (SPECIALTY_PROCEDURES[specialtyId]) return SPECIALTY_PROCEDURES[specialtyId];

  // Correspondência por tokens
  const s = specialtyId.toLowerCase();
  if (s.includes('cardio'))      return CARDIO;
  if (s.includes('ortop') || s.includes('trauma')) return ORTOPEDIA;
  if (s.includes('neuro'))       return NEUROLOGIA;
  if (s.includes('dermato'))     return DERMATOLOGIA;
  if (s.includes('gineco') || s.includes('obstet')) return GINECOLOGIA;
  if (s.includes('pediat') || s.includes('neonat')) return PEDIATRIA;
  if (s.includes('psico') || s.includes('psiqui')) return PSI;
  if (s.includes('fisio') || s.includes('reabil')) return PHYSIO;
  if (s.includes('nutri'))       return NUTRITION;
  if (s.includes('dent') || s.includes('odonto') || s.includes('orto') || s.includes('endo') || s.includes('perio')) return ODONTO;
  if (s.includes('estetica') || s.includes('plastica')) return ESTETICA;

  return CLINICO_GERAL;
}

/** Categorias consideradas "odontológicas" para filtro de separação visual */
export const ODONTO_CATEGORIES = new Set([
  'Odontologia', 'Endodontia', 'Ortodontia', 'Periodontia',
  'Implantodontia', 'Odontopediatria', 'Prótese', 'Cirurgia Oral',
  'Estomatologia', 'Bucomaxilofacial',
]);

/** Categorias consideradas "estéticas" para filtro */
export const ESTETICA_CATEGORIES = new Set([
  'Estética', 'Estética Facial', 'Estética Corporal', 'Harmonização',
]);

/**
 * Retorna true se o procedimento é compatível com a categoria da clínica.
 * Usa o campo specialty_category estruturado ('odonto','medico','estetica',
 * 'fisio','nutricao','psi','podologia','outro') para decisão precisa.
 */
export function isProcedureCompatible(specialtyCategory: string, clinicCategory: string): boolean {
  const sc = (specialtyCategory ?? 'outro').toLowerCase();
  if (clinicCategory === 'odonto') {
    // Clínica odonto exibe apenas procedimentos odonto (e genéricos)
    return sc === 'odonto' || sc === 'outro';
  }
  if (clinicCategory === 'medico') {
    // Clínica médica exibe tudo exceto odonto e estética
    return sc !== 'odonto' && sc !== 'estetica';
  }
  if (clinicCategory === 'estetica') {
    // Clínica estética exibe tudo exceto odonto
    return sc !== 'odonto';
  }
  return true; // 'outro' — mostra tudo
}
