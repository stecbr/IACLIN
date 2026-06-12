import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Trash2, Users, Wallet, TrendingUp, Receipt } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Beneficiary } from '@/pages/operadora/OperatorBeneficiaries';

interface Props {
  beneficiaryId: string | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (b: Beneficiary) => void;
  onDeleted: () => void;
}

const statusVariants: Record<string, { label: string; cls: string }> = {
  em_dia: { label: 'Em dia', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  inadimplente: { label: 'Inadimplente', cls: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  suspenso: { label: 'Suspenso', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground border-border' },
};

function fmtBRL(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR');
}

export default function BeneficiaryDetailDialog({ beneficiaryId, onOpenChange, onEdit, onDeleted }: Props) {
  const [benef, setBenef] = useState<Beneficiary | null>(null);
  const [deps, setDeps] = useState<any[]>([]);
  const [spend, setSpend] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!beneficiaryId) {
      setBenef(null); setDeps([]); setSpend(null);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: b } = await supabase.from('operator_beneficiaries').select('*').eq('id', beneficiaryId).maybeSingle();
      const { data: d } = await supabase.from('operator_beneficiary_dependents').select('*').eq('beneficiary_id', beneficiaryId).order('full_name');
      setBenef(b as any);
      setDeps(d ?? []);
      const { data: s, error } = await supabase.functions.invoke('operator-beneficiary-spend', { body: { beneficiary_id: beneficiaryId } });
      if (error) console.error(error);
      setSpend(s ?? null);
      setLoading(false);
    })();
  }, [beneficiaryId]);

  async function handleDelete() {
    if (!benef) return;
    if (!confirm('Remover este beneficiário e todos os dependentes?')) return;
    const { error } = await supabase.from('operator_beneficiaries').delete().eq('id', benef.id);
    if (error) {
      toast.error('Erro ao remover');
      return;
    }
    toast.success('Beneficiário removido');
    onDeleted();
  }

  const sv = benef ? (statusVariants[benef.status] ?? statusVariants.cancelado) : null;

  return (
    <Dialog open={!!beneficiaryId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span>{benef?.full_name ?? '…'}</span>
              {sv && <Badge variant="outline" className={`${sv.cls} rounded-full`}>{sv.label}</Badge>}
            </div>
            {benef && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(benef)} className="rounded-xl">
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={handleDelete} className="rounded-xl text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !benef ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <Tabs defaultValue="resumo" className="mt-2">
            <TabsList className="rounded-xl">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="dependentes">Dependentes ({deps.length})</TabsTrigger>
              <TabsTrigger value="atendimentos">Atendimentos ({spend?.attendances?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Gasto últimos 12m', value: fmtBRL(spend?.summary?.total ?? 0), icon: Wallet },
                  { label: 'Atendimentos', value: String(spend?.summary?.count ?? 0), icon: Receipt },
                  { label: 'Ticket médio', value: fmtBRL(spend?.summary?.avgTicket ?? 0), icon: TrendingUp },
                ].map((k) => (
                  <Card key={k.label} className="rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">{k.label}</div>
                        <div className="text-xl font-semibold mt-1">{k.value}</div>
                      </div>
                      <k.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Dados cadastrais</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <Info label="Carteirinha" value={benef.card_number} mono />
                  <Info label="CPF" value={benef.cpf ?? '—'} />
                  <Info label="Plano" value={benef.plan_name ?? '—'} />
                  <Info label="Tipo" value={benef.plan_type} capitalize />
                  <Info label="Dia vencimento" value={benef.due_day ? String(benef.due_day) : '—'} />
                  <Info label="Próximo vencimento" value={fmtDate(benef.next_due_date)} />
                  <Info label="Último pagamento" value={fmtDate((benef as any).last_payment_at)} />
                  <Info label="Telefone" value={benef.phone ?? '—'} />
                  <Info label="E-mail" value={benef.email ?? '—'} />
                  <Info label="Nascimento" value={fmtDate(benef.date_of_birth)} />
                  <Info label="Adesão" value={fmtDate(benef.enrolled_at)} />
                </div>
                {benef.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">Observações</div>
                    <p className="text-sm mt-1">{benef.notes}</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="dependentes" className="mt-4">
              {deps.length === 0 ? (
                <Card className="rounded-xl p-8 text-center">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Sem dependentes cadastrados.</p>
                </Card>
              ) : (
                <Card className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Carteirinha</TableHead>
                        <TableHead>Parentesco</TableHead>
                        <TableHead>Nascimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deps.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.full_name}</TableCell>
                          <TableCell>{d.cpf ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{d.card_number ?? '—'}</TableCell>
                          <TableCell className="capitalize">{d.relationship}</TableCell>
                          <TableCell>{fmtDate(d.date_of_birth)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="atendimentos" className="mt-4">
              {!spend?.attendances?.length ? (
                <Card className="rounded-xl p-8 text-center">
                  <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum atendimento registrado na rede credenciada.</p>
                </Card>
              ) : (
                <Card className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Membro</TableHead>
                        <TableHead>Clínica</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spend.attendances.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{new Date(a.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="text-sm">{a.member_name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{a.member_role}</div>
                          </TableCell>
                          <TableCell className="text-sm">{a.clinic_name}</TableCell>
                          <TableCell className="text-sm">{a.dentist_name}</TableCell>
                          <TableCell className="text-sm">{a.procedure}</TableCell>
                          <TableCell className="text-right font-medium">{fmtBRL(a.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Total acumulado" value={fmtBRL(spend?.summary?.total ?? 0)} />
                <Stat label="Atendimentos" value={String(spend?.summary?.count ?? 0)} />
                <Stat label="Ticket médio" value={fmtBRL(spend?.summary?.avgTicket ?? 0)} />
                <Stat label="Top clínica" value={spend?.summary?.topClinic?.name ?? '—'} sub={spend?.summary?.topClinic ? fmtBRL(spend.summary.topClinic.total) : ''} />
              </div>

              <Card className="rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Gastos mensais (últimos 12 meses)</h4>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={spend?.summary?.byMonth ?? []}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
                      <XAxis dataKey="month" tickFormatter={(m) => m.slice(5) + '/' + m.slice(2, 4)} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card className="rounded-xl p-4">
                  <h4 className="text-sm font-medium mb-3">Procedimentos mais realizados</h4>
                  {!spend?.summary?.topProcedures?.length ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="space-y-2">
                      {spend.summary.topProcedures.map((p: any) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div>
                            <div>{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.count}x</div>
                          </div>
                          <div className="font-medium">{fmtBRL(p.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="rounded-xl p-4">
                  <h4 className="text-sm font-medium mb-3">Gastos por membro</h4>
                  {!spend?.summary?.memberTotals?.length ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="space-y-2">
                      {spend.summary.memberTotals.map((m: any) => (
                        <div key={m.name + m.role} className="flex items-center justify-between text-sm">
                          <div>
                            <div>{m.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{m.role} · {m.count} atendimento(s)</div>
                          </div>
                          <div className="font-medium">{fmtBRL(m.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}>{value}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}