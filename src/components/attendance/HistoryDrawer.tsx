import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, FileText, Pill, Stethoscope, ClipboardList, ChevronDown, ChevronRight, Image as ImageIcon, Download, User } from 'lucide-react';
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
import { getSignedFileUrl } from '@/lib/storageSignedUrl';
import { SignedImage } from '@/components/patients/SignedImage';
import { toast } from 'sonner';

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

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['attendance-documents', patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, name, file_url, file_type, category, created_at, uploaded_by')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const openDoc = async (doc: any) => {
    const url = await getSignedFileUrl(doc.file_url, { expiresIn: 3600 });
    if (!url) { toast.error('Não foi possível abrir o arquivo'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const patientUploads = documents.filter((d: any) => d.category === 'patient_exam').length;

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
          <TabsList className="mx-6 mt-3 grid grid-cols-4">
            <TabsTrigger value="visits">Consultas</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescrições</TabsTrigger>
            <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1">
              Documentos
              {patientUploads > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{patientUploads}</Badge>
              )}
            </TabsTrigger>
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

                <TabsContent value="documents" className="mt-0 space-y-2">
                  {docsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento ou exame.</p>
                  ) : (
                    <>
                      {documents.some((d: any) => d.category === 'patient_exam') && (
                        <div className="mb-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                            <User className="h-3 w-3" /> Enviados pelo paciente
                          </p>
                          <div className="space-y-2">
                            {documents.filter((d: any) => d.category === 'patient_exam').map((d: any) => (
                              <DocItem key={d.id} doc={d} onOpen={openDoc} highlight />
                            ))}
                          </div>
                        </div>
                      )}
                      {documents.some((d: any) => d.category !== 'patient_exam') && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Da clínica</p>
                          <div className="space-y-2">
                            {documents.filter((d: any) => d.category !== 'patient_exam').map((d: any) => (
                              <DocItem key={d.id} doc={d} onOpen={openDoc} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function DocItem({ doc, onOpen, highlight }: { doc: any; onOpen: (d: any) => void; highlight?: boolean }) {
  const isImage = (doc.file_type ?? '').startsWith('image/');
  return (
    <button
      onClick={() => onOpen(doc)}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
        highlight ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' : 'border-border/50 hover:bg-muted/40'
      }`}
    >
      {isImage ? (
        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
          <SignedImage fileUrl={doc.file_url} alt={doc.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {format(parseISO(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
          {doc.file_type ? ` · ${doc.file_type}` : ''}
        </p>
      </div>
      <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}