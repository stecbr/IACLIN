import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, Receipt, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { usePendingByDentist, usePayoutHistory, PendingByDentistRow } from '@/hooks/usePayouts';
import { ClosePayoutDialog } from './ClosePayoutDialog';

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

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Comissões em aberto</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo acumulado por profissional a partir de comissões com status <em>pendente</em>.
            </p>
          </div>
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : openRows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem repasses pendentes"
              description="Quando uma comissão for gerada e ainda não estiver paga, ela aparecerá aqui agrupada por profissional."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {openRows.map((row) => (
                <button
                  key={row.dentist_id}
                  onClick={() => setSelected(row)}
                  className="w-full flex items-center justify-between gap-4 py-3 text-left hover:bg-muted/40 rounded-md px-2 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.full_name ?? 'Profissional'}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.count} comissão(ões){row.oldest_date ? ` · desde ${format(parseISO(row.oldest_date), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold tabular-nums">{fmt(row.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Histórico de fechamentos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Últimos repasses registrados.</p>
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