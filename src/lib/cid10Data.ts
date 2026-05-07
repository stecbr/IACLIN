// Curated subset of CID-10 codes commonly used in clinical practice (PT-BR).
// Not exhaustive — covers the most frequent ones across families.
export interface Cid10 {
  code: string;
  description: string;
}

export const CID10_DATA: Cid10[] = [
  // Infecções
  { code: 'A09', description: 'Diarreia e gastroenterite de origem infecciosa presumível' },
  { code: 'B34.9', description: 'Infecção viral não especificada' },
  // Endócrino / metabólico
  { code: 'E10', description: 'Diabetes mellitus tipo 1' },
  { code: 'E11', description: 'Diabetes mellitus tipo 2' },
  { code: 'E66', description: 'Obesidade' },
  { code: 'E78.5', description: 'Hiperlipidemia não especificada' },
  { code: 'E03.9', description: 'Hipotireoidismo não especificado' },
  // Mental
  { code: 'F32', description: 'Episódios depressivos' },
  { code: 'F33', description: 'Transtorno depressivo recorrente' },
  { code: 'F41.0', description: 'Transtorno de pânico' },
  { code: 'F41.1', description: 'Ansiedade generalizada' },
  { code: 'F43.1', description: 'Estresse pós-traumático' },
  { code: 'F90', description: 'Transtornos hipercinéticos (TDAH)' },
  { code: 'F84.0', description: 'Autismo infantil' },
  // Neuro
  { code: 'G43', description: 'Enxaqueca' },
  { code: 'G44.2', description: 'Cefaleia tensional' },
  // Cardio
  { code: 'I10', description: 'Hipertensão essencial (primária)' },
  { code: 'I20', description: 'Angina pectoris' },
  { code: 'I25', description: 'Doença isquêmica crônica do coração' },
  { code: 'I50', description: 'Insuficiência cardíaca' },
  // Respiratório
  { code: 'J00', description: 'Nasofaringite aguda (resfriado comum)' },
  { code: 'J02.9', description: 'Faringite aguda não especificada' },
  { code: 'J03.9', description: 'Amigdalite aguda não especificada' },
  { code: 'J06.9', description: 'Infecção aguda das vias aéreas superiores não especificada' },
  { code: 'J20', description: 'Bronquite aguda' },
  { code: 'J45', description: 'Asma' },
  { code: 'J44', description: 'DPOC' },
  // Gastro
  { code: 'K02', description: 'Cárie dentária' },
  { code: 'K05', description: 'Gengivite e doenças periodontais' },
  { code: 'K08', description: 'Outros transtornos dos dentes e estruturas de sustentação' },
  { code: 'K21', description: 'Refluxo gastroesofágico' },
  { code: 'K29', description: 'Gastrite e duodenite' },
  { code: 'K59.0', description: 'Constipação' },
  // Pele
  { code: 'L20', description: 'Dermatite atópica' },
  { code: 'L40', description: 'Psoríase' },
  { code: 'L70', description: 'Acne' },
  // Musculoesquelético
  { code: 'M25.5', description: 'Dor articular' },
  { code: 'M54.5', description: 'Lombalgia' },
  { code: 'M54.2', description: 'Cervicalgia' },
  { code: 'M79.7', description: 'Fibromialgia' },
  { code: 'M17', description: 'Gonartrose (artrose do joelho)' },
  // Geniturinário
  { code: 'N39.0', description: 'Infecção do trato urinário' },
  { code: 'N18', description: 'Doença renal crônica' },
  // Gestação
  { code: 'Z34', description: 'Supervisão de gravidez normal' },
  { code: 'O80', description: 'Parto único espontâneo' },
  // Sintomas / sinais
  { code: 'R10', description: 'Dor abdominal e pélvica' },
  { code: 'R51', description: 'Cefaleia' },
  { code: 'R52', description: 'Dor não classificada em outra parte' },
  { code: 'R53', description: 'Mal-estar e fadiga' },
  { code: 'R55', description: 'Síncope e colapso' },
  // Lesões
  { code: 'S00', description: 'Traumatismo superficial da cabeça' },
  { code: 'T14', description: 'Traumatismo de região não especificada do corpo' },
  // Z (controle)
  { code: 'Z00', description: 'Exame geral e investigação de pessoas sem queixa' },
  { code: 'Z01', description: 'Outros exames especiais e investigações em pessoas sem queixa' },
  { code: 'Z71', description: 'Aconselhamento médico' },
  { code: 'Z76.5', description: 'Pessoa fingindo doença' },
];
