export interface MedicationSuggestion {
  name: string;
  concentration: string;
  defaultDosage?: string;
  defaultFrequency?: string;
  category?: string;
}

export const MEDICATION_SUGGESTIONS: MedicationSuggestion[] = [
  // Analgésicos / Antitérmicos
  { name: 'Dipirona sódica', concentration: '500mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 6 horas', category: 'Analgésico' },
  { name: 'Dipirona sódica', concentration: '1g', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 6 horas', category: 'Analgésico' },
  { name: 'Paracetamol', concentration: '500mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 6 horas', category: 'Analgésico' },
  { name: 'Paracetamol', concentration: '750mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Analgésico' },
  // Anti-inflamatórios
  { name: 'Ibuprofeno', concentration: '400mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Anti-inflamatório' },
  { name: 'Ibuprofeno', concentration: '600mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Anti-inflamatório' },
  { name: 'Nimesulida', concentration: '100mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 12 horas', category: 'Anti-inflamatório' },
  { name: 'Cetoprofeno', concentration: '100mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 12 horas', category: 'Anti-inflamatório' },
  { name: 'Diclofenaco sódico', concentration: '50mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Anti-inflamatório' },
  { name: 'Meloxicam', concentration: '15mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia', category: 'Anti-inflamatório' },
  // Antibióticos
  { name: 'Amoxicilina', concentration: '500mg', defaultDosage: '1 cápsula', defaultFrequency: 'a cada 8 horas', category: 'Antibiótico' },
  { name: 'Amoxicilina + Clavulanato', concentration: '875mg + 125mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 12 horas', category: 'Antibiótico' },
  { name: 'Azitromicina', concentration: '500mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia', category: 'Antibiótico' },
  { name: 'Clindamicina', concentration: '300mg', defaultDosage: '1 cápsula', defaultFrequency: 'a cada 8 horas', category: 'Antibiótico' },
  { name: 'Cefalexina', concentration: '500mg', defaultDosage: '1 cápsula', defaultFrequency: 'a cada 6 horas', category: 'Antibiótico' },
  { name: 'Metronidazol', concentration: '400mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Antibiótico' },
  { name: 'Ciprofloxacino', concentration: '500mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 12 horas', category: 'Antibiótico' },
  // Corticoides
  { name: 'Prednisona', concentration: '20mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia pela manhã', category: 'Corticoide' },
  { name: 'Dexametasona', concentration: '4mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia', category: 'Corticoide' },
  // Bochecho / Tópicos odonto
  { name: 'Clorexidina (bochecho)', concentration: '0,12%', defaultDosage: '15 mL', defaultFrequency: '2 vezes ao dia', category: 'Antisséptico bucal' },
  { name: 'Digluconato de clorexidina (gel)', concentration: '2%', defaultDosage: 'aplicar finamente', defaultFrequency: '2 vezes ao dia', category: 'Antisséptico bucal' },
  // Antialérgicos
  { name: 'Loratadina', concentration: '10mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia', category: 'Antialérgico' },
  { name: 'Dexclorfeniramina', concentration: '2mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Antialérgico' },
  // Gastro
  { name: 'Omeprazol', concentration: '20mg', defaultDosage: '1 cápsula', defaultFrequency: '1 vez ao dia em jejum', category: 'Protetor gástrico' },
  { name: 'Pantoprazol', concentration: '40mg', defaultDosage: '1 comprimido', defaultFrequency: '1 vez ao dia em jejum', category: 'Protetor gástrico' },
  { name: 'Bromoprida', concentration: '10mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Antiemético' },
  // Outros comuns
  { name: 'Buscopan composto', concentration: '10mg + 250mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 8 horas', category: 'Analgésico' },
  { name: 'Tramadol', concentration: '50mg', defaultDosage: '1 cápsula', defaultFrequency: 'a cada 8 horas', category: 'Analgésico opioide' },
  { name: 'Codeína + Paracetamol', concentration: '30mg + 500mg', defaultDosage: '1 comprimido', defaultFrequency: 'a cada 6 horas', category: 'Analgésico opioide' },
];

export function searchMedications(query: string, limit = 8): MedicationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return MEDICATION_SUGGESTIONS.slice(0, limit);
  return MEDICATION_SUGGESTIONS.filter((m) =>
    `${m.name} ${m.concentration} ${m.category ?? ''}`.toLowerCase().includes(q)
  ).slice(0, limit);
}