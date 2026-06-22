/**
 * Base local de interações medicamentosas clinicamente relevantes.
 * Cobre as interações mais comuns entre medicamentos prescritos em clínicas
 * e medicamentos de uso contínuo dos pacientes.
 */

export type InteractionSeverity = 'grave' | 'moderada' | 'leve';

export interface DrugInteraction {
  drugs: [string, string];
  severity: InteractionSeverity;
  description: string;
}

function n(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Base de interações ────────────────────────────────────────────────────────
const INTERACTIONS: DrugInteraction[] = [
  // AINEs + anticoagulantes
  {
    drugs: ['ibuprofeno', 'varfarina'],
    severity: 'grave',
    description: 'AINEs aumentam risco de hemorragia com anticoagulantes. Evitar combinação.',
  },
  {
    drugs: ['diclofenaco', 'varfarina'],
    severity: 'grave',
    description: 'AINEs potencializam efeito anticoagulante da varfarina — risco de sangramento grave.',
  },
  {
    drugs: ['nimesulida', 'varfarina'],
    severity: 'grave',
    description: 'AINEs potencializam efeito anticoagulante da varfarina — risco de sangramento grave.',
  },
  {
    drugs: ['cetoprofeno', 'varfarina'],
    severity: 'grave',
    description: 'AINEs potencializam efeito anticoagulante da varfarina — risco de sangramento grave.',
  },
  {
    drugs: ['meloxicam', 'varfarina'],
    severity: 'grave',
    description: 'AINEs potencializam efeito anticoagulante da varfarina — risco de sangramento grave.',
  },
  {
    drugs: ['ibuprofeno', 'rivaroxabana'],
    severity: 'grave',
    description: 'AINEs aumentam risco hemorrágico com anticoagulantes diretos.',
  },
  {
    drugs: ['ibuprofeno', 'apixabana'],
    severity: 'grave',
    description: 'AINEs aumentam risco hemorrágico com anticoagulantes diretos.',
  },

  // AINEs + IECA/ARA → nefrotoxicidade
  {
    drugs: ['ibuprofeno', 'enalapril'],
    severity: 'moderada',
    description: 'AINEs + IECA podem causar insuficiência renal aguda. Monitorar função renal.',
  },
  {
    drugs: ['ibuprofeno', 'captopril'],
    severity: 'moderada',
    description: 'AINEs + IECA podem causar insuficiência renal aguda. Monitorar função renal.',
  },
  {
    drugs: ['ibuprofeno', 'losartana'],
    severity: 'moderada',
    description: 'AINEs + ARA II podem causar insuficiência renal aguda. Monitorar função renal.',
  },
  {
    drugs: ['diclofenaco', 'losartana'],
    severity: 'moderada',
    description: 'AINEs + ARA II podem causar insuficiência renal aguda. Monitorar função renal.',
  },
  {
    drugs: ['nimesulida', 'losartana'],
    severity: 'moderada',
    description: 'AINEs + ARA II podem causar insuficiência renal aguda. Monitorar função renal.',
  },

  // Antibióticos + varfarina
  {
    drugs: ['metronidazol', 'varfarina'],
    severity: 'grave',
    description: 'Metronidazol inibe metabolismo da varfarina → risco de hemorragia grave. Monitorar INR.',
  },
  {
    drugs: ['ciprofloxacino', 'varfarina'],
    severity: 'grave',
    description: 'Ciprofloxacino potencializa anticoagulação pela varfarina — monitorar INR de perto.',
  },
  {
    drugs: ['amoxicilina', 'varfarina'],
    severity: 'moderada',
    description: 'Antibióticos de amplo espectro podem potencializar efeito da varfarina.',
  },
  {
    drugs: ['azitromicina', 'varfarina'],
    severity: 'moderada',
    description: 'Azitromicina pode aumentar efeito anticoagulante da varfarina — monitorar INR.',
  },

  // Opióides/Tramadol + depressores SNC
  {
    drugs: ['tramadol', 'alprazolam'],
    severity: 'grave',
    description: 'Combinação com benzodiazepínico pode causar depressão respiratória grave.',
  },
  {
    drugs: ['tramadol', 'clonazepam'],
    severity: 'grave',
    description: 'Combinação com benzodiazepínico pode causar depressão respiratória grave.',
  },
  {
    drugs: ['tramadol', 'diazepam'],
    severity: 'grave',
    description: 'Combinação com benzodiazepínico pode causar depressão respiratória grave.',
  },
  {
    drugs: ['codeina', 'alprazolam'],
    severity: 'grave',
    description: 'Opioide + benzodiazepínico → risco de depressão respiratória e sedação excessiva.',
  },
  {
    drugs: ['codeina', 'clonazepam'],
    severity: 'grave',
    description: 'Opioide + benzodiazepínico → risco de depressão respiratória e sedação excessiva.',
  },

  // Tramadol + ISRS → síndrome serotoninérgica
  {
    drugs: ['tramadol', 'fluoxetina'],
    severity: 'grave',
    description: 'Risco de síndrome serotoninérgica (agitação, hipertermia, tremores). Evitar combinação.',
  },
  {
    drugs: ['tramadol', 'sertralina'],
    severity: 'grave',
    description: 'Risco de síndrome serotoninérgica (agitação, hipertermia, tremores). Evitar combinação.',
  },
  {
    drugs: ['tramadol', 'escitalopram'],
    severity: 'grave',
    description: 'Risco de síndrome serotoninérgica. Evitar combinação com ISRSs.',
  },
  {
    drugs: ['tramadol', 'amitriptilina'],
    severity: 'moderada',
    description: 'Potencial para síndrome serotoninérgica e aumento de sedação.',
  },

  // Corticoides + AINEs
  {
    drugs: ['prednisona', 'ibuprofeno'],
    severity: 'moderada',
    description: 'Corticoide + AINE aumenta risco de úlcera péptica e sangramento GI.',
  },
  {
    drugs: ['prednisona', 'diclofenaco'],
    severity: 'moderada',
    description: 'Corticoide + AINE aumenta risco de úlcera péptica e sangramento GI.',
  },
  {
    drugs: ['dexametasona', 'ibuprofeno'],
    severity: 'moderada',
    description: 'Corticoide + AINE aumenta risco de úlcera péptica e sangramento GI.',
  },

  // Corticoides + antidiabéticos
  {
    drugs: ['prednisona', 'metformina'],
    severity: 'moderada',
    description: 'Corticoides causam hiperglicemia, podendo reduzir eficácia de antidiabéticos.',
  },
  {
    drugs: ['dexametasona', 'metformina'],
    severity: 'moderada',
    description: 'Corticoides causam hiperglicemia, podendo reduzir eficácia de antidiabéticos.',
  },
  {
    drugs: ['prednisona', 'glibenclamida'],
    severity: 'moderada',
    description: 'Corticoides causam hiperglicemia, podendo reduzir eficácia de hipoglicemiantes.',
  },
  {
    drugs: ['prednisona', 'insulina'],
    severity: 'moderada',
    description: 'Corticoides aumentam glicemia; pode ser necessário ajuste de dose de insulina.',
  },

  // Azitromicina + estatinas
  {
    drugs: ['azitromicina', 'sinvastatina'],
    severity: 'moderada',
    description: 'Azitromicina inibe metabolismo da sinvastatina → risco de miopatia/rabdomiólise.',
  },
  {
    drugs: ['ciprofloxacino', 'sinvastatina'],
    severity: 'leve',
    description: 'Ciprofloxacino pode aumentar níveis plasmáticos da sinvastatina.',
  },

  // Dipirona + ciclosporina
  {
    drugs: ['dipirona', 'ciclosporina'],
    severity: 'moderada',
    description: 'Dipirona pode reduzir níveis séricos de ciclosporina — monitorar.',
  },

  // Metronidazol + álcool (aviso clínico)
  {
    drugs: ['metronidazol', 'alcool'],
    severity: 'grave',
    description: 'Reação tipo dissulfiram com álcool (náusea, vômito, taquicardia). Orientar abstinência.',
  },

  // Ibuprofeno + lítio
  {
    drugs: ['ibuprofeno', 'litio'],
    severity: 'grave',
    description: 'AINEs reduzem excreção de lítio → toxicidade do lítio (tremores, confusão).',
  },
  {
    drugs: ['diclofenaco', 'litio'],
    severity: 'grave',
    description: 'AINEs reduzem excreção de lítio → toxicidade do lítio.',
  },
];

// ── Verificação ────────────────────────────────────────────────────────────────

function drugMatch(medName: string, interactionDrug: string): boolean {
  const med = n(medName);
  const iDrug = n(interactionDrug);
  // Match se a droga de interação está contida no nome do medicamento ou vice-versa
  return med.includes(iDrug) || iDrug.includes(med);
}

/**
 * Verifica interações entre um medicamento sendo prescrito e os medicamentos
 * em uso contínuo do paciente (string livre da anamnese).
 *
 * @param prescribedMed - Nome do medicamento sendo prescrito
 * @param patientMedications - String da anamnese com medicamentos em uso
 */
export function checkDrugInteractions(
  prescribedMed: string,
  patientMedications: string,
): DrugInteraction[] {
  if (!prescribedMed.trim() || !patientMedications.trim()) return [];

  const found: DrugInteraction[] = [];

  for (const interaction of INTERACTIONS) {
    const [drugA, drugB] = interaction.drugs;

    const prescribedMatchesA = drugMatch(prescribedMed, drugA);
    const prescribedMatchesB = drugMatch(prescribedMed, drugB);

    if (prescribedMatchesA) {
      // Check if patient is using drugB
      if (drugMatch(patientMedications, drugB)) {
        found.push(interaction);
      }
    } else if (prescribedMatchesB) {
      // Check if patient is using drugA
      if (drugMatch(patientMedications, drugA)) {
        found.push(interaction);
      }
    }
  }

  // Sort by severity
  const order: InteractionSeverity[] = ['grave', 'moderada', 'leve'];
  found.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return found;
}

export const SEVERITY_LABELS: Record<InteractionSeverity, string> = {
  grave: 'Grave',
  moderada: 'Moderada',
  leve: 'Leve',
};

export const SEVERITY_STYLES: Record<InteractionSeverity, string> = {
  grave:    'border-red-400/60 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
  moderada: 'border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  leve:     'border-yellow-400/60 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
};
