import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, Loader2, Pill, MessageCircle, ClipboardList, FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePatientData, type DocumentRow } from '@/hooks/usePatientData';

const EXAM_CATEGORIES = new Set(['image', 'exam', 'lab_exam', 'imaging_exam', 'exame']);
const PRESCRIPTION_CATEGORIES = new Set(['prescription', 'receita']);

interface PrescriptionFromRecord {
  id: string;
  date: string;
  dentistName: string | null;
  items: Array<{ medication: string; concentration?: string; dosage?: string; duration?: string; route?: string; type?: string }>;
}

export default function PatientExams() {
  const { documents, patientIds, loading } = usePatientData();

  const { data: rxFromRecords = [], isLoading: rxLoading } = useQuery({
    queryKey: ['patient-rx-from-records', patientIds.join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data: records } = await supabase
        .from('clinical_records')
        .select('id, created_at, dentist_id, clinical_record_requests(id, kind, payload)')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })
        .limit(100);
      const recs = records ?? [];
      const dentistIds = [...new Set(recs.map((r: any) => r.dentist_id).filter(Boolean))];
      const profMap = new Map<string, string>();
      if (dentistIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', dentistIds);
        (profs ?? []).forEach((p: any) => profMap.set(p.id, p.full_name));
      }
      const out: PrescriptionFromRecord[] = [];
      for (const r of recs as any[]) {
        const reqs = (r.clinical_record_requests ?? []).filter((x: any) => x.kind === 'prescription');
        if (reqs.length === 0) continue;
        out.push({
          id: r.id,
          date: r.created_at,
          dentistName: profMap.get(r.dentist_id) ?? null,
          items: reqs.map((x: any) => x.payload ?? {}),
        });
      }
      return out;
    },
  });

  const { exams, prescriptionDocs, others } = useMemo(() => {
    const exams: DocumentRow[] = [];
    const prescriptionDocs: DocumentRow[] = [];
    const others: DocumentRow[] = [];
    for (const d of documents) {
      const cat = (d.category ?? '').toLowerCase();
      if (PRESCRIPTION_CATEGORIES.has(cat)) prescriptionDocs.push(d);
      else if (EXAM_CATEGORIES.has(cat)) exams.push(d);
      else others.push(d);
    }
    return { exams, prescriptionDocs, others };
  }, [documents]);

  const totalRx = prescriptionDocs.length + rxFromRecords.length;

  const downloadDoc = async (doc: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage
        .from('patient-files')
        .createSignedUrl(doc.file_url, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      window.open(doc.file_url, '_blank');
    }
  };

  if (loading || rxLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meus Documentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exames, receitas e documentos enviados pela sua clínica.
        </p>
      </div>

      <Tabs defaultValue={totalRx > 0 && exams.length === 0 ? 'receitas' : 'exames'}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="exames" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> Exames
            {exams.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{exams.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="receitas" className="gap-1.5">
            <Pill className="h-3.5 w-3.5" /> Receitas
            {totalRx > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{totalRx}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outros" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Outros
            {others.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{others.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exames" className="mt-4 space-y-2">
          {exams.length === 0 ? (
            <EmptyTab icon={FlaskConical} title="Nenhum exame ainda" desc="Quando a clínica enviar exames ou laudos, eles aparecerão aqui." />
          ) : (
            exams.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} />)
          )}
        </TabsContent>

        <TabsContent value="receitas" className="mt-4 space-y-2">
          {totalRx === 0 ? (
            <EmptyTab icon={Pill} title="Nenhuma receita ainda" desc="As receitas prescritas pelo seu médico aparecerão aqui." />
          ) : (
            <>
              {rxFromRecords.map((rx) => (
                <PrescriptionCard key={`rx-${rx.id}`} rx={rx} />
              ))}
              {prescriptionDocs.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} accent="rx" />)}
            </>
          )}
        </TabsContent>

        <TabsContent value="outros" className="mt-4 space-y-2">
          {others.length === 0 ? (
            <EmptyTab icon={ClipboardList} title="Nenhum documento" desc="Outros arquivos enviados aparecerão aqui." />
          ) : (
            others.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocumentItem({ doc, onDownload, accent }: { doc: DocumentRow; onDownload: (d: DocumentRow) => void; accent?: 'rx' }) {
  const Icon = accent === 'rx' ? Pill : FileText;
  return (
    <button
      onClick={() => onDownload(doc)}
      className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left"
    >
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent === 'rx' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          {doc.file_type && ` · ${doc.file_type}`}
        </p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

function PrescriptionCard({ rx }: { rx: PrescriptionFromRecord }) {
  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => {
      const med = [it.medication, it.concentration].filter(Boolean).join(' ');
      const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
      return `${i + 1}. ${med}${dose ? ' — ' + dose : ''}`;
    });
    const msg = `Minha receita${rx.dentistName ? ` (${rx.dentistName})` : ''} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Pill className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Receita médica</p>
              <Badge variant="secondary" className="text-[10px] h-5">{rx.items.length} {rx.items.length === 1 ? 'item' : 'itens'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(rx.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {rx.dentistName && ` · ${rx.dentistName}`}
            </p>
          </div>
        </div>

        <ul className="space-y-1.5 pl-1">
          {rx.items.map((it, i) => {
            const med = [it.medication, it.concentration].filter(Boolean).join(' ');
            const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
            return (
              <li key={i} className="text-sm flex gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-medium">{med || 'Medicamento'}</p>
                  {dose && <p className="text-xs text-muted-foreground">{dose}</p>}
                  {it.type === 'controlled' && <Badge variant="outline" className="text-[10px] mt-1">Controlada</Badge>}
                </div>
              </li>
            );
          })}
        </ul>

        <Button variant="outline" size="sm" className="w-full gap-2" onClick={shareWhatsApp}>
          <MessageCircle className="h-3.5 w-3.5" /> Compartilhar no WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
