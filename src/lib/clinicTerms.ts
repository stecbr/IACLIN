export type ClinicCategory = 'odonto' | 'medico' | 'estetica' | 'outro';

export interface ClinicTerms {
  team: string;
  teamMember: string;
  teamMembers: string;
  addMember: string;
  noMembers: string;
  allMembers: string;
  registration: string;
  namePlaceholder: string;
  inviteMessage: string;
  filterAll: string;
  aiShortcutTeam: string;
  categoryLabel: string;
}

const TERMS: Record<ClinicCategory, ClinicTerms> = {
  odonto: {
    team:             'Equipe Odontológica',
    teamMember:       'Dentista',
    teamMembers:      'Dentistas',
    addMember:        'Adicionar dentista',
    noMembers:        'Nenhum dentista cadastrado',
    allMembers:       'Todos os dentistas',
    registration:     'CRO',
    namePlaceholder:  'Dr. João Silva',
    inviteMessage:    'Compartilhe com seus dentistas para que entrem na equipe',
    filterAll:        'Todos os dentistas',
    aiShortcutTeam:   'Abrir Equipe Odontológica',
    categoryLabel:    'Odontologia',
  },
  medico: {
    team:             'Equipe Médica',
    teamMember:       'Médico',
    teamMembers:      'Médicos',
    addMember:        'Adicionar médico',
    noMembers:        'Nenhum médico cadastrado',
    allMembers:       'Todos os médicos',
    registration:     'CRM',
    namePlaceholder:  'Dr. João Silva',
    inviteMessage:    'Compartilhe com seus médicos para que entrem na equipe',
    filterAll:        'Todos os médicos',
    aiShortcutTeam:   'Abrir Equipe Médica',
    categoryLabel:    'Medicina',
  },
  estetica: {
    team:             'Equipe de Estética',
    teamMember:       'Profissional',
    teamMembers:      'Profissionais',
    addMember:        'Adicionar profissional',
    noMembers:        'Nenhum profissional cadastrado',
    allMembers:       'Todos os profissionais',
    registration:     'Registro',
    namePlaceholder:  'Nome do profissional',
    inviteMessage:    'Compartilhe com seus profissionais para que entrem na equipe',
    filterAll:        'Todos os profissionais',
    aiShortcutTeam:   'Abrir Equipe',
    categoryLabel:    'Estética',
  },
  outro: {
    team:             'Equipe',
    teamMember:       'Profissional',
    teamMembers:      'Profissionais',
    addMember:        'Adicionar profissional',
    noMembers:        'Nenhum profissional cadastrado',
    allMembers:       'Todos os profissionais',
    registration:     'Registro',
    namePlaceholder:  'Nome do profissional',
    inviteMessage:    'Compartilhe com seus profissionais para que entrem na equipe',
    filterAll:        'Todos os profissionais',
    aiShortcutTeam:   'Abrir Equipe',
    categoryLabel:    'Outro',
  },
};

export function getClinicTerms(category?: string | null): ClinicTerms {
  return TERMS[(category as ClinicCategory) ?? 'medico'] ?? TERMS.medico;
}
