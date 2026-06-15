import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OperatorCatalogStatus = 'particular' | 'not-covered' | 'no-table' | 'operator';

export interface OperatorCatalogItem {
  id: string;
  procedure_name: string;
  category: string;
  tuss_code: string | null;
  value_brl: number;
  charge_type: string;
}

export interface OperatorCatalogResult {
  status: OperatorCatalogStatus;
  items: OperatorCatalogItem[];
  operator: { id: string; name: string } | null;
  table: { id: string; name: string; state: string | null } | null;
  reason?: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Resolve o catálogo de procedimentos para um atendimento:
 * - Se o paciente tem convênio + a clínica está credenciada + a operadora possui
 *   tabela vigente para o estado da clínica (ou cobertura nacional), retorna os
 *   itens da tabela da operadora com preço travado.
 * - Caso contrário, retorna `particular` / `not-covered` / `no-table` para que
 *   o caller use o catálogo da clínica.
 */
export function useOperatorPriceCatalog(params: {
  insuranceProviderName?: string | null;
  clinicId?: string | null;
  clinicState?: string | null;
}) {
  const { insuranceProviderName, clinicId, clinicState } = params;

  return useQuery<OperatorCatalogResult>({
    queryKey: ['operator-price-catalog', insuranceProviderName ?? '', clinicId ?? '', clinicState ?? ''],
    enabled: !!clinicId,
    staleTime: 60_000,
    queryFn: async () => {
      const empty: OperatorCatalogResult = {
        status: 'particular', items: [], operator: null, table: null,
      };
      const name = (insuranceProviderName ?? '').trim();
      if (!name) return empty;

      // 1) Resolver operadora pelo nome (case-insensitive + acentos)
      const { data: operators } = await supabase
        .from('insurance_operators')
        .select('id, name, is_active')
        .eq('is_active', true);
      const target = (operators ?? []).find((o) => normalize(o.name) === normalize(name));
      if (!target) return empty;

      const operator = { id: target.id as string, name: target.name as string };

      // 2) Credenciamento aprovado (RLS já barra leitura caso contrário,
      //    mas validamos pra dar mensagem clara).
      if (clinicId) {
        const { data: cred } = await supabase
          .from('operator_credentialings')
          .select('id, status')
          .eq('operator_id', operator.id)
          .eq('clinic_id', clinicId)
          .eq('status', 'approved')
          .maybeSingle();
        if (!cred) {
          return { status: 'not-covered', items: [], operator, table: null, reason: 'sem credenciamento' };
        }
      }

      // 3) Tabela vigente — preferir match de estado, senão cobertura nacional (state IS NULL)
      const today = new Date().toISOString().slice(0, 10);
      const { data: tables } = await supabase
        .from('operator_price_tables')
        .select('id, name, state, valid_from, valid_until')
        .eq('operator_id', operator.id)
        .lte('valid_from', today);
      const vigent = (tables ?? []).filter(
        (t) => t.valid_until == null || t.valid_until >= today,
      );
      const uf = (clinicState ?? '').toUpperCase();
      const picked =
        vigent.find((t) => (t.state ?? '').toUpperCase() === uf && uf.length > 0) ??
        vigent.find((t) => !t.state) ??
        null;
      if (!picked) {
        return { status: 'no-table', items: [], operator, table: null };
      }

      // 4) Itens
      const { data: items, error } = await supabase
        .from('operator_price_items')
        .select('id, procedure_name, category, tuss_code, value_brl, charge_type')
        .eq('table_id', picked.id)
        .order('category')
        .order('sort_order')
        .order('procedure_name');
      if (error) throw error;

      return {
        status: 'operator',
        operator,
        table: { id: picked.id, name: picked.name, state: picked.state ?? null },
        items: (items ?? []).map((it) => ({
          id: it.id as string,
          procedure_name: it.procedure_name as string,
          category: (it.category as string) ?? 'Geral',
          tuss_code: (it.tuss_code as string) ?? null,
          value_brl: Number(it.value_brl ?? 0),
          charge_type: (it.charge_type as string) ?? 'Geral',
        })),
      };
    },
  });
}