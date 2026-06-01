import { supabase } from '@/integrations/supabase/client';

// ─── Easter (Anonymous Gregorian algorithm) ──────────────────────────────────
function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fixed(year: number, month: number, day: number, name: string) {
  return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, name };
}

// ─── Feriados Nacionais ───────────────────────────────────────────────────────
function nationalHolidays(year: number): Array<{ date: string; name: string }> {
  const easter = easterDate(year);
  return [
    fixed(year, 1, 1,   'Confraternização Universal'),
    { date: fmt(shiftDays(easter, -48)), name: 'Carnaval' },
    { date: fmt(shiftDays(easter, -47)), name: 'Carnaval' },
    { date: fmt(shiftDays(easter, -2)),  name: 'Sexta-feira Santa' },
    fixed(year, 4, 21,  'Tiradentes'),
    fixed(year, 5, 1,   'Dia do Trabalhador'),
    { date: fmt(shiftDays(easter, 60)),  name: 'Corpus Christi' },
    fixed(year, 9, 7,   'Independência do Brasil'),
    fixed(year, 10, 12, 'Nossa Senhora Aparecida'),
    fixed(year, 11, 2,  'Finados'),
    fixed(year, 11, 15, 'Proclamação da República'),
    fixed(year, 11, 20, 'Dia da Consciência Negra'),
    fixed(year, 12, 25, 'Natal'),
  ];
}

// ─── Feriados Estaduais ───────────────────────────────────────────────────────
const STATE_FIXED: Record<string, Array<{ month: number; day: number; name: string }>> = {
  AC: [
    { month: 1,  day: 20, name: 'Dia do Evangélico' },
    { month: 6,  day: 15, name: 'Aniversário do Estado do Acre' },
    { month: 9,  day: 5,  name: 'Feriado Estadual do Acre' },
  ],
  AL: [
    { month: 9,  day: 16, name: 'Emancipação Política de Alagoas' },
  ],
  AM: [
    { month: 9,  day: 5,  name: 'Elevação do Amazonas à Categoria de Estado' },
  ],
  AP: [
    { month: 3,  day: 19, name: 'Dia de São José' },
    { month: 9,  day: 13, name: 'Criação do Território do Amapá' },
  ],
  BA: [
    { month: 7,  day: 2,  name: 'Independência da Bahia' },
  ],
  CE: [
    { month: 3,  day: 25, name: 'Data Magna do Ceará' },
  ],
  DF: [
    { month: 4,  day: 21, name: 'Fundação de Brasília' },
  ],
  ES: [
    { month: 7,  day: 25, name: 'São Tiago Apóstolo' },
    { month: 10, day: 22, name: 'Colonização do Solo Espírito-Santense' },
  ],
  GO: [
    { month: 10, day: 24, name: 'Pedra Fundamental de Goiânia' },
  ],
  MA: [
    { month: 7,  day: 28, name: 'Adesão do Maranhão ao Império Brasileiro' },
  ],
  MG: [
    { month: 8,  day: 15, name: 'Assunção de Nossa Senhora' },
  ],
  MS: [
    { month: 10, day: 11, name: 'Criação do Estado do Mato Grosso do Sul' },
  ],
  MT: [
    { month: 11, day: 8,  name: 'Criação do Estado do Mato Grosso' },
  ],
  PA: [
    { month: 8,  day: 15, name: 'Adesão do Pará ao Império Brasileiro' },
  ],
  PB: [
    { month: 8,  day: 5,  name: 'Fundação do Estado da Paraíba' },
  ],
  PE: [
    { month: 3,  day: 6,  name: 'Revolução Pernambucana' },
  ],
  PI: [
    { month: 3,  day: 13, name: 'Batalha do Jenipapo' },
    { month: 10, day: 19, name: 'Dia do Piauí' },
  ],
  PR: [
    { month: 12, day: 19, name: 'Emancipação do Paraná' },
  ],
  RJ: [
    { month: 1,  day: 20, name: 'São Sebastião — Padroeiro do Rio de Janeiro' },
    { month: 4,  day: 23, name: 'São Jorge' },
    { month: 10, day: 28, name: 'Servidor Público Estadual' },
  ],
  RN: [
    { month: 10, day: 3,  name: 'Mártires de Cunhaú e Uruaçu' },
  ],
  RO: [
    { month: 1,  day: 4,  name: 'Criação do Estado de Rondônia' },
    { month: 6,  day: 18, name: 'Dia do Evangélico' },
  ],
  RR: [
    { month: 10, day: 5,  name: 'Criação do Estado de Roraima' },
  ],
  RS: [
    { month: 9,  day: 20, name: 'Revolução Farroupilha' },
  ],
  SC: [
    { month: 8,  day: 11, name: 'Criação da Capitania de Santa Catarina' },
  ],
  SE: [
    { month: 10, day: 8,  name: 'Nossa Senhora da Conceição — Padroeira de Sergipe' },
  ],
  SP: [
    { month: 1,  day: 25, name: 'Aniversário de São Paulo' },
    { month: 7,  day: 9,  name: 'Revolução Constitucionalista' },
  ],
  TO: [
    { month: 9,  day: 8,  name: 'Nossa Senhora da Natividade — Padroeira do Tocantins' },
    { month: 10, day: 5,  name: 'Criação do Estado do Tocantins' },
  ],
};

function stateHolidays(year: number, state: string): Array<{ date: string; name: string }> {
  const uf = state.toUpperCase().trim();
  return (STATE_FIXED[uf] ?? []).map(({ month, day, name }) => fixed(year, month, day, name));
}

// ─── Feriados Municipais ──────────────────────────────────────────────────────
const MUNICIPAL_FIXED: Record<string, Array<{ month: number; day: number; name: string }>> = {
  'sao paulo': [
    { month: 1,  day: 25, name: 'Aniversário da Cidade de São Paulo' },
    { month: 7,  day: 9,  name: 'Revolução Constitucionalista de 1932' },
  ],
  'rio de janeiro': [
    { month: 1,  day: 20, name: 'São Sebastião — Padroeiro do Rio de Janeiro' },
    { month: 4,  day: 23, name: 'São Jorge' },
    { month: 10, day: 28, name: 'Servidor Público Municipal' },
  ],
  'belo horizonte': [
    { month: 8,  day: 15, name: 'Assunção de Nossa Senhora — Padroeira de BH' },
    { month: 12, day: 8,  name: 'Nossa Senhora da Conceição — Aniversário de BH' },
  ],
  'salvador': [
    { month: 2,  day: 2,  name: 'Nossa Senhora dos Navegantes' },
    { month: 7,  day: 2,  name: 'Independência da Bahia' },
  ],
  'fortaleza': [
    { month: 3,  day: 19, name: 'São José — Padroeiro de Fortaleza' },
    { month: 3,  day: 25, name: 'Data Magna do Ceará' },
    { month: 8,  day: 15, name: 'Nossa Senhora da Assunção — Padroeira de Fortaleza' },
  ],
  'curitiba': [
    { month: 3,  day: 26, name: 'Aniversário de Curitiba' },
    { month: 12, day: 19, name: 'Emancipação do Paraná' },
  ],
  'manaus': [
    { month: 9,  day: 5,  name: 'Elevação do Amazonas à Categoria de Estado' },
  ],
  'porto alegre': [
    { month: 8,  day: 2,  name: 'Nossa Senhora dos Anjos — Padroeira de Porto Alegre' },
    { month: 9,  day: 20, name: 'Revolução Farroupilha' },
  ],
  'recife': [
    { month: 3,  day: 6,  name: 'Revolução Pernambucana' },
    { month: 3,  day: 16, name: 'Emancipação de Recife' },
  ],
  'belem': [
    { month: 8,  day: 15, name: 'Adesão do Pará ao Império Brasileiro' },
    { month: 10, day: 18, name: 'Aniversário de Belém' },
  ],
  'goiania': [
    { month: 10, day: 24, name: 'Aniversário de Goiânia' },
  ],
  'maceio': [
    { month: 9,  day: 16, name: 'Emancipação Política de Alagoas' },
    { month: 12, day: 5,  name: 'Aniversário de Maceió' },
  ],
  'natal': [
    { month: 12, day: 25, name: 'Natal — Aniversário da Cidade' },
  ],
  'teresina': [
    { month: 8,  day: 16, name: 'Aniversário de Teresina' },
  ],
  'campo grande': [
    { month: 8,  day: 26, name: 'Aniversário de Campo Grande' },
  ],
  'joao pessoa': [
    { month: 8,  day: 5,  name: 'Fundação de João Pessoa' },
  ],
  'aracaju': [
    { month: 3,  day: 17, name: 'Aniversário de Aracaju' },
  ],
  'cuiaba': [
    { month: 4,  day: 8,  name: 'Aniversário de Cuiabá' },
  ],
  'macapa': [
    { month: 2,  day: 4,  name: 'Aniversário de Macapá' },
  ],
  'porto velho': [
    { month: 10, day: 5,  name: 'Aniversário de Porto Velho' },
  ],
  'boa vista': [
    { month: 7,  day: 9,  name: 'Aniversário de Boa Vista' },
  ],
  'rio branco': [
    { month: 12, day: 28, name: 'Aniversário de Rio Branco' },
  ],
  'palmas': [
    { month: 5,  day: 20, name: 'Aniversário de Palmas' },
  ],
  'brasilia': [
    { month: 4,  day: 21, name: 'Aniversário de Brasília' },
  ],
  'florianopolis': [
    { month: 8,  day: 11, name: 'Aniversário de Florianópolis' },
  ],
  'vitoria': [
    { month: 7,  day: 25, name: 'São Tiago — Padroeiro de Vitória' },
    { month: 9,  day: 8,  name: 'Nossa Senhora da Vitória — Padroeira' },
  ],
};

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function cityHolidays(year: number, city: string): Array<{ date: string; name: string }> {
  const key = normalizeCity(city);
  return (MUNICIPAL_FIXED[key] ?? []).map(({ month, day, name }) => fixed(year, month, day, name));
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function syncHolidaysForClinic(
  clinicId: string,
  state?: string | null,
  city?: string | null,
): Promise<{ synced: number; error?: string }> {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];

  const rows: Array<{ clinic_id: string; date: string; name: string }> = [];

  for (const year of years) {
    const national = nationalHolidays(year);
    const stateH  = state ? stateHolidays(year, state) : [];
    const cityH   = city  ? cityHolidays(year, city)   : [];

    // city > state > national: mais específico prevalece por data
    const map = new Map<string, string>();
    [...national, ...stateH, ...cityH].forEach((h) => {
      map.set(h.date, h.name); // sobrescreve para pegar o mais específico
    });

    map.forEach((name, date) => rows.push({ clinic_id: clinicId, date, name }));
  }

  try {
    const { error } = await (supabase as any)
      .from('clinic_holidays')
      .upsert(rows, { onConflict: 'clinic_id,date' });
    if (error) return { synced: 0, error: error.message };
    return { synced: rows.length };
  } catch (e: any) {
    return { synced: 0, error: e.message };
  }
}

export function holidaySummary(state?: string | null, city?: string | null): string {
  const parts: string[] = ['nacionais'];
  if (state) parts.push(`estaduais (${state.toUpperCase()})`);
  if (city) parts.push(`municipais (${city})`);
  return parts.join(', ');
}
