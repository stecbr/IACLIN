import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, FileText, Pill, Stethoscope, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Props {
  patientId: string;
  currentAppointmentId?: string;
}

/**
 * Drawer lateral de histórico clínico.
 * Permite visualizar consultas anteriores, prescrições, procedimentos
 * e histórico de odontograma sem sair da tela de atendimento.
 */
export function HistoryDrawer({ patientId, currentAppointmentId }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance-history', patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinical_records')
        .select('id, appointment_id, created_at, status, diagnosis, chief_complaint, notes, treatment_plan, procedure_duration_seconds, clinical_record_procedures(id, tooth_number, surface, notes, procedures(name)), clinical_record_requests(id, kind, payload)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const filtered = records.filter((r: any) => r.appointment_id !== currentAppointmentId);
  const allRequests = filtered.flatMap((r: any) =>
    (r.clinical_record_requests ?? []).map((req: any) => ({ ...req, _date: r.created_at }))
  );
  const allProcs = filtered.flatMap((r: any) =>
    (r.clinical_record_procedures ?? []).map((p: any) => ({ ...p, _date: r.created_at }))
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Linha do tempo do paciente
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="visits" className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-3 grid grid-cols-3">
            <TabsTrigger value="visits">Consultas</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescrições</TabsTrigger>
            <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            {isLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Carregando…</div>
            ) : (
              <>
                <TabsContent value="visits" className="mt-0 space-y-2">
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem atendimentos anteriores.</p>
                  )}
                  {filtered.map((r: any) => {
                    const isOpen = expanded === r.id;
                    return (
                      <div key={r.id} className="rounded-lg border border-border/50 overflow-hidden">
                        <button
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40 transition-colors"
                        >
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {r.diagnosis || r.chief_complaint || 'Atendimento'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {r.procedure_duration_seconds ? ` · ⏱ ${Math.max(1, Math.floor(r.procedure_duration_seconds / 60))}min` : ''}
                            </p>
                          </div>
                          {(r.clinical_record_procedures?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.clinical_record_procedures.length} proc.
                            </Badge>
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-1 space-y-2 text-xs border-t border-border/50 bg-muted/20">
                            {r.chief_complaint && (
                              <p><span className="text-muted-foreground">Queixa:</span> {r.chief_complaint}</p>
                            )}
                            {r.treatment_plan && (
                              <p><span className="text-muted-foreground">Plano:</span> {r.treatment_plan}</p>
                            )}
                            {r.notes && (
                              <p className="whitespace-pre-wrap">{r.notes.replace(/<!--SPECIALTY_DATA:.+?-->/s, '').trim()}</p>
                            )}
                            {(r.clinical_record_procedures ?? []).length > 0 && (
                              <div className="pt-1.5 border-t border-border/30">
                                <p className="text-muted-foreground mb-1">Procedimentos:</p>
                                <ul className="space-y-0.5">
                                  {r.clinical_record_procedures.map((p: any) => (
                                    <li key={p.id} className="flex items-center gap-1.5">
                                      <Stethoscope className="h-3 w-3 text-muted-foreground" />
                                      {p.procedures?.name ?? 'Procedimento'}
                                      {p.tooth_number && <span className="text-muted-foreground"> · Dente {p.tooth_number}</span>}
                                      {p.surface && <span className="text-muted-foreground"> · Face {p.surface}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="prescriptions" className="mt-0 space-y-2">
                  {allRequests.filter((r: any) => r.kind === 'prescription').length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem prescrições anteriores.</p>
                  )}
                  {allRequests.filter((r: any) => r.kind === 'prescription').map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-border/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Pill className="h-3 w-3" />
                        {format(parseISO(r._date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="text-xs space-y-0.5">
                        {Object.entries(r.payload ?? {}).map(([k, v]) => (
                          v ? <p key={k}><span className="text-muted-foreground capitalize">{k}:</span> {String(v)}</p> : null
                        ))}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="procedures" className="mt-0 space-y-2">
                  {allProcs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem procedimentos registrados.</p>
                  )}
                  {allProcs.map((p: any) => (
                    <div key={p.id} className="rounded-lg border border-border/50 p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.procedures?.name ?? 'Procedimento'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(p._date), "dd/MM/yyyy", { locale: ptBR })}
                          {p.tooth_number && ` · Dente ${p.tooth_number}`}
                          {p.surface && ` · Face ${p.surface}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}