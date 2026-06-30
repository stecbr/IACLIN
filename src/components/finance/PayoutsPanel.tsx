import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateCommissionsForTransaction } from '@/lib/commissions';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, Receipt, ChevronRight, Info, Search, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/EmptyState';
import { usePendingByDentist, usePayoutHistory, PendingByDentistRow } from '@/hooks/usePayouts';
import { ClosePayoutDialog } from './ClosePayoutDialog';
import { PayoutsHelpSheet } from './PayoutsHelpSheet';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  clinicId: string;
}

const methodLabel: Record<string, string> = {
  pix: 'PIX',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  other: 'Outro',
};

export function PayoutsPanel({ clinicId }: Props) {
  const { data: openRows = [], isLoading } = usePendingByDentist(clinicId);
  const { data: history = [] } = usePayoutHistory(clinicId);
  const [selected, setSelected] = useState<PendingByDentistRow | null>(null);
  const [filter, setFilter] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rulesCount = 0 } = useQuery({
    queryKey: ['commission-rules-count', clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { count } = await supabase
        .from('commission_rules')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId);
      return count ?? 0;
    },
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data: incomes, error } = await supabase
        .from('financial_transactions')
        .select('id, status')
        .eq('clinic_id', clinicId)
        .eq('type', 'income')
        .in('status', ['pending', 'paid']);
      if (error) throw error;
      let processed = 0;
      for (const tx of incomes ?? []) {
        await generateCommissionsForTransaction(
          (tx as any).id,
          (tx as any).status === 'paid' ? 'after_payment' : 'after_procedure',
        );
        processed += 1;
      }
      toast.success(`Recalculado · ${processed} receita(s) verificada(s)`);
      qc.invalidateQueries({ queryKey: ['payouts-pending-by-dentist', clinicId] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao recalcular comissões');
    } finally {
      setRecalculating(false);
    }
  };

  const filteredOpen = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return openRows;
    return openRows.filter((r) => (r.full_name ?? '').toLowerCase().includes(q));
  }, [openRows, filter]);

  return (
    <div className="space-y-6">
      {rulesCount === 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-amber-200/60 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Nenhuma regra de comissão cadastrada
            </p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
              As consultas só geram repasses automáticos quando existe uma regra
              padrão da clínica ou uma regra individual por profissional. Cadastre
              uma regra em <em>Financeiro → Comissões</em> e depois clique em
              "Recalcular" para aplicar às receitas já existentes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/financial?tab=comissoes')}
            >
              Criar regra
            </Button>
          </div>
        </div>
      )}

      {rulesCount > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {recalculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recalcular comissões em aberto
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm text-foreground/90 leading-relaxed">
          <p className="font-medium text-foreground">Repasses para profissionais</p>
          <p className="mt-1 text-muted-foreground">
            O sistema soma sozinho as comissões geradas pelos atendimentos. Você
            paga o profissional pelo seu meio habitual (Pix, transferência, dinheiro)
            e registra aqui — assim ele acompanha o recebimento em <em>Meu Financeiro</em>.
            A plataforma <strong>não envia dinheiro</strong>, apenas organiza o histórico.
          </p>
        </div>
        <PayoutsHelpSheet audience="clinic" />
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Comissões em aberto</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em um profissional para fechar o período e registrar o pagamento.
            </p>
          </div>
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {openRows.length > 4 && (
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar profissional…"
                className="pl-9"
              />
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : filteredOpen.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem repasses pendentes"
              description="Quando uma comissão for gerada e ainda não estiver paga, ela aparecerá aqui agrupada por profissional."
            />
          ) : (
            <TooltipProvider delayDuration={250}>
              <div className="divide-y divide-border/60">
                {filteredOpen.map((row) => (
                  <button
                    key={row.dentist_id}
                    onClick={() => setSelected(row)}
                    className="w-full flex items-center justify-between gap-4 py-3 text-left hover:bg-muted/40 rounded-md px-2 transition group"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.full_name ?? 'Profissional'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.count} comissão(ões){row.oldest_date ? ` · acumuladas desde ${format(parseISO(row.oldest_date), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
                      </p>
                      <p className="text-[11px] text-primary/80 mt-1 opacity-0 group-hover:opacity-100 transition">
                        Fechar período e registrar pagamento →
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-lg font-semibold tabular-nums">{fmt(row.total)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Soma de {row.count} comissão(ões) pendentes
                        </TooltipContent>
                      </Tooltip>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Histórico de fechamentos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Repasses já registrados. O profissional vê esta mesma lista em <em>Meu Financeiro → Fechamentos recebidos</em>.
            </p>
          </div>
          <Receipt className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum fechamento ainda.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {history.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.dentist_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(p.period_start), 'dd/MM/yy', { locale: ptBR })} – {format(parseISO(p.period_end), 'dd/MM/yy', { locale: ptBR })}
                      {p.paid_at ? ` · pago em ${format(parseISO(p.paid_at), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
                    </p>
                    {p.notes ? (
                      <p className="text-xs text-muted-foreground mt-0.5 italic truncate">"{p.notes}"</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.payment_method ? (
                      <Badge variant="outline" className="text-[10px]">{methodLabel[p.payment_method] ?? p.payment_method}</Badge>
                    ) : null}
                    <span className="font-semibold tabular-nums">{fmt(Number(p.total_amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ClosePayoutDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          clinicId={clinicId}
          dentistId={selected.dentist_id}
          dentistName={selected.full_name ?? 'Profissional'}
          defaultStart={selected.oldest_date}
        />
      )}
    </div>
  );
}