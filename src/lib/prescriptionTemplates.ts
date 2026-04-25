export interface PrescriptionItem {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  items: PrescriptionItem[];
}

export const DEFAULT_PRESCRIPTION_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: 'pos-extracao',
    name: 'Pós-extração',
    category: 'Cirurgia',
    description: 'Analgésico + anti-inflamatório por 3 dias',
    items: [
      {
        medication: 'Dipirona sódica 500mg',
        dosage: '1 comprimido',
        frequency: 'a cada 6 horas',
        duration: '3 dias',
        instructions: 'Em caso de dor.',
      },
      {
        medication: 'Ibuprofeno 600mg',
        dosage: '1 comprimido',
        frequency: 'a cada 8 horas',
        duration: '3 dias',
        instructions: 'Tomar após as refeições.',
      },
    ],
  },
  {
    id: 'profilaxia-antibiotica',
    name: 'Profilaxia antibiótica',
    category: 'Antibiótico',
    description: 'Para pacientes com risco de endocardite',
    items: [
      {
        medication: 'Amoxicilina 500mg',
        dosage: '4 comprimidos (2g)',
        frequency: 'dose única',
        duration: '1 hora antes do procedimento',
        instructions: 'Tomar com bastante água.',
      },
    ],
  },
  {
    id: 'pulpite-aguda',
    name: 'Pulpite aguda (SOS)',
    category: 'Analgesia',
    description: 'Combinação para dor pulpar intensa',
    items: [
      {
        medication: 'Nimesulida 100mg',
        dosage: '1 comprimido',
        frequency: 'a cada 12 horas',
        duration: '3 dias',
        instructions: 'Após as refeições.',
      },
      {
        medication: 'Dipirona sódica 1g',
        dosage: '1 comprimido',
        frequency: 'a cada 6 horas se dor',
        duration: '3 dias',
      },
    ],
  },
  {
    id: 'pos-implante',
    name: 'Pós-cirúrgico de implante',
    category: 'Cirurgia',
    description: 'Antibiótico + analgésico + bochecho 7 dias',
    items: [
      {
        medication: 'Amoxicilina 500mg',
        dosage: '1 cápsula',
        frequency: 'a cada 8 horas',
        duration: '7 dias',
        instructions: 'Iniciar 1h antes da cirurgia.',
      },
      {
        medication: 'Dipirona sódica 500mg',
        dosage: '1 comprimido',
        frequency: 'a cada 6 horas',
        duration: '3 dias',
        instructions: 'Em caso de dor.',
      },
      {
        medication: 'Clorexidina 0,12% (bochecho)',
        dosage: '15 mL',
        frequency: '2 vezes ao dia',
        duration: '7 dias',
        instructions: 'Bochechar por 1 minuto após escovação.',
      },
    ],
  },
];

export function findTemplate(id: string): PrescriptionTemplate | undefined {
  return DEFAULT_PRESCRIPTION_TEMPLATES.find((t) => t.id === id);
}