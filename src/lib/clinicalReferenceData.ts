export const TUBETE_ML = 1.8;

export interface AnticoagulantInfo {
  name: string;
  hemostasisTime: string;
  notes: string;
}

export const ANTICOAGULANTS: AnticoagulantInfo[] = [
  { name: 'AAS (Aspirina)', hemostasisTime: '5-10 min', notes: 'Geralmente não suspende; controle local.' },
  { name: 'Clopidogrel', hemostasisTime: '10-15 min', notes: 'Considere medidas hemostáticas locais.' },
  { name: 'Varfarina', hemostasisTime: '15-30 min', notes: 'INR < 3.5 para procedimentos. Sutura + esponja hemostática.' },
  { name: 'Rivaroxabana', hemostasisTime: '15-20 min', notes: 'Procedimento na "vale" do medicamento (12-24h após dose).' },
  { name: 'Apixabana', hemostasisTime: '15-20 min', notes: 'Idem rivaroxabana.' },
  { name: 'Dabigatrana', hemostasisTime: '15-30 min', notes: 'Cautela em pacientes com função renal alterada.' },
];

export interface AsaClass {
  code: string;
  description: string;
  example: string;
  riskColor: 'low' | 'mid' | 'high';
}

export const ASA_CLASSES: AsaClass[] = [
  { code: 'ASA I', description: 'Paciente saudável', example: 'Sem doenças sistêmicas', riskColor: 'low' },
  { code: 'ASA II', description: 'Doença sistêmica leve', example: 'HAS controlada, fumante, gestante', riskColor: 'low' },
  { code: 'ASA III', description: 'Doença sistêmica grave', example: 'DM descompensado, DPOC', riskColor: 'mid' },
  { code: 'ASA IV', description: 'Doença sistêmica grave com risco de vida', example: 'IC severa, IAM recente', riskColor: 'high' },
  { code: 'ASA V', description: 'Moribundo', example: 'Não sobrevive sem cirurgia', riskColor: 'high' },
  { code: 'ASA VI', description: 'Morte encefálica', example: 'Doação de órgãos', riskColor: 'high' },
];

export interface EvaLevel {
  value: number;
  label: string;
  color: string;
  description: string;
}

export const EVA_SCALE: EvaLevel[] = [
  { value: 0, label: 'Sem dor', color: '#10b981', description: 'Nenhum desconforto.' },
  { value: 2, label: 'Leve', color: '#84cc16', description: 'Incomoda, mas não atrapalha.' },
  { value: 4, label: 'Moderada', color: '#facc15', description: 'Atrapalha algumas atividades.' },
  { value: 6, label: 'Forte', color: '#f97316', description: 'Difícil de ignorar.' },
  { value: 8, label: 'Muito forte', color: '#ef4444', description: 'Impede atividades diárias.' },
  { value: 10, label: 'Insuportável', color: '#b91c1c', description: 'A pior dor imaginável.' },
];

export function mlToTubetes(ml: number): number {
  return ml / TUBETE_ML;
}

export function tubetesToMl(tubetes: number): number {
  return tubetes * TUBETE_ML;
}