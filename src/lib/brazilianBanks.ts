/** Catálogo dos principais bancos brasileiros (código FEBRABAN). */
export interface BankInfo {
  code: string;
  name: string;
}

export const BRAZILIAN_BANKS: BankInfo[] = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '041', name: 'Banrisul' },
  { code: '047', name: 'Banese' },
  { code: '070', name: 'BRB - Banco de Brasília' },
  { code: '077', name: 'Banco Inter' },
  { code: '085', name: 'Cooperativa Central de Crédito - Ailos' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '208', name: 'BTG Pactual' },
  { code: '212', name: 'Banco Original' },
  { code: '218', name: 'BS2' },
  { code: '237', name: 'Bradesco' },
  { code: '260', name: 'Nubank' },
  { code: '290', name: 'PagBank (PagSeguro)' },
  { code: '323', name: 'Mercado Pago' },
  { code: '336', name: 'C6 Bank' },
  { code: '341', name: 'Itaú Unibanco' },
  { code: '364', name: 'Gerencianet' },
  { code: '380', name: 'PicPay' },
  { code: '389', name: 'Banco Mercantil do Brasil' },
  { code: '422', name: 'Banco Safra' },
  { code: '479', name: 'Banco ItauBank' },
  { code: '623', name: 'Banco PAN' },
  { code: '633', name: 'Banco Rendimento' },
  { code: '637', name: 'Banco Sofisa' },
  { code: '643', name: 'Banco Pine' },
  { code: '652', name: 'Itaú Unibanco Holding' },
  { code: '655', name: 'Banco Votorantim (BV)' },
  { code: '707', name: 'Banco Daycoval' },
  { code: '735', name: 'Banco Neon' },
  { code: '745', name: 'Citibank' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
  { code: '900', name: 'Outro / Não listado' },
];

export function findBankByName(name: string): BankInfo | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return BRAZILIAN_BANKS.find((b) => b.name.toLowerCase() === q);
}