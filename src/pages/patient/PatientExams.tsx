import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, Loader2, Pill, MessageCircle, ClipboardList, FlaskConical, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePatientData, type DocumentRow } from '@/hooks/usePatientData';
import { generatePrescriptionPdf } from '@/lib/generatePrescriptionPdf';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const EXAM_CATEGORIES = new Set(['image', 'exam', 'lab_exam', 'imaging_exam', 'exame', 'patient_exam']);
const PRESCRIPTION_CATEGORIES = new Set(['prescription', 'receita']);

interface RxItemPayload {
  medication?: string;
  concentration?: string;
  dosage?: string;
  duration?: string;
  route?: string;
  type?: string;
  instructions?: string;
}

interface PrescriptionFromRecord {
  id: string;
  date: string;
  items: RxItemPayload[];
  dentist: {
    full_name: string;
    registration_number: string | null;
    specialty: string | null;
    signature_url: string | null;
  } | null;
  clinic: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    cnpj: string | null;
    logo_url: string | null;
  } | null;
  patient: {
    full_name: string;
    cpf: string | null;
    date_of_birth: string | null;
  } | null;
}

export default function PatientExams() {
  const { documents, patientIds, loading } = usePatientData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const targetPatientId = patientIds[0];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user || !targetPatientId) {
      if (!targetPatientId) toast.error('Você ainda não está vinculado a uma clínica.');
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`"${file.name}" excede o limite de 20 MB`);
          continue;
        }
        const ext = file.name.split('.').pop();
        const path = `${targetPatientId}/patient-uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('patient-files')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from('documents').insert({
          patient_id: targetPatientId,
          name: file.name,
          file_url: path,
          file_type: file.type,
          category: 'patient_exam',
          uploaded_by: user.id,
        });
        if (dbErr) throw dbErr;
      }
      toast.success('Exame enviado para sua clínica.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user.id] });
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao enviar o arquivo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    try {
      const path = doc.file_url;
      await supabase.storage.from('patient-files').remove([path]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast.success('Arquivo removido.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user?.id] });
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao remover.');
    }
  };

  const { data: rxFromRecords = [], isLoading: rxLoading } = useQuery({
    queryKey: ['patient-rx-from-records', patientIds.join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data: records } = await supabase
        .from('clinical_records')
        .select('id, created_at, dentist_id, clinic_id, patient_id, clinical_record_requests(id, kind, payload)')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })
        .limit(100);
      const recs = records ?? [];
      const dentistIds = [...new Set(recs.map((r: any) => r.dentist_id).filter(Boolean))];
      const clinicIds = [...new Set(recs.map((r: any) => r.clinic_id).filter(Boolean))];
      const profMap = new Map<string, any>();
      if (dentistIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, registration_number, specialty, signature_url')
          .in('id', dentistIds);
        (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
      }
      const clinicMap = new Map<string, any>();
      if (clinicIds.length > 0) {
        const { data: clins } = await supabase
          .from('clinics')
          .select('id, name, phone, address, city, state, cnpj, logo_url')
          .in('id', clinicIds);
        (clins ?? []).forEach((c: any) => clinicMap.set(c.id, c));
      }
      const patientMap = new Map<string, any>();
      {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, full_name, cpf, date_of_birth')
          .in('id', patientIds);
        (pats ?? []).forEach((p: any) => patientMap.set(p.id, p));
      }
      const out: PrescriptionFromRecord[] = [];
      for (const r of recs as any[]) {
        const reqs = (r.clinical_record_requests ?? []).filter((x: any) => x.kind === 'prescription');
        if (reqs.length === 0) continue;
        const prof = r.dentist_id ? profMap.get(r.dentist_id) : null;
        const clin = r.clinic_id ? clinicMap.get(r.clinic_id) : null;
        const pat = r.patient_id ? patientMap.get(r.patient_id) : null;
        out.push({
          id: r.id,
          date: r.created_at,
          items: reqs.map((x: any) => x.payload ?? {}),
          dentist: prof
            ? {
                full_name: prof.full_name ?? 'Médico(a)',
                registration_number: prof.registration_number ?? null,
                specialty: prof.specialty ?? null,
                signature_url: prof.signature_url ?? null,
              }
            : null,
          clinic: clin
            ? {
                name: clin.name ?? 'Clínica',
                phone: clin.phone ?? null,
                address: clin.address ?? null,
                city: clin.city ?? null,
                state: clin.state ?? null,
                cnpj: clin.cnpj ?? null,
                logo_url: clin.logo_url ?? null,
              }
            : null,
          patient: pat
            ? {
                full_name: pat.full_name ?? '',
                cpf: pat.cpf ?? null,
                date_of_birth: pat.date_of_birth ?? null,
              }
            : null,
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
      toast.error('Não foi possível gerar o link seguro. Abrindo o arquivo diretamente.');
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exames, receitas e documentos enviados pela sua clínica.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading || !targetPatientId}>
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Enviando…' : 'Enviar exame'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleUpload}
        />
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
            <EmptyTab icon={FlaskConical} title="Nenhum exame ainda" desc="Envie seus exames pelo botão acima ou aguarde a clínica anexar." />
          ) : (
            exams.map((d) => (
              <DocumentItem
                key={d.id}
                doc={d}
                onDownload={downloadDoc}
                onDelete={d.category === 'patient_exam' ? handleDelete : undefined}
              />
            ))
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

function DocumentItem({ doc, onDownload, onDelete, accent }: { doc: DocumentRow; onDownload: (d: DocumentRow) => void; onDelete?: (d: DocumentRow) => void; accent?: 'rx' }) {
  const Icon = accent === 'rx' ? Pill : FileText;
  const isPatientUpload = doc.category === 'patient_exam';
  return (
    <div className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
      <button onClick={() => onDownload(doc)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent === 'rx' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{doc.name}</p>
            {isPatientUpload && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Enviado por você</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {doc.file_type && ` · ${doc.file_type}`}
          </p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      {onDelete && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => onDelete(doc)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function PrescriptionCard({ rx }: { rx: PrescriptionFromRecord }) {
  const dentistLine = rx.dentist
    ? [
        `Dr(a). ${rx.dentist.full_name}`,
        rx.dentist.registration_number
          ? `${registrationLabelForSpecialty(rx.dentist.specialty)} ${rx.dentist.registration_number}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const downloadPdf = async () => {
    if (!rx.patient) {
      toast.error('Não foi possível carregar os dados do paciente.');
      return;
    }
    try {
      await generatePrescriptionPdf({
        items: rx.items.map((it) => ({
          medication: [it.medication, it.concentration].filter(Boolean).join(' ') || 'Medicamento',
          dosage: it.dosage ?? '',
          frequency: '',
          duration: it.duration ?? '',
          instructions: [it.route, it.instructions].filter(Boolean).join(' · ') || undefined,
        })) as any,
        patient: rx.patient,
        dentist: rx.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: rx.clinic,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao gerar receituário.');
    }
  };

  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => {
      const med = [it.medication, it.concentration].filter(Boolean).join(' ');
      const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
      return `${i + 1}. ${med}${dose ? ' — ' + dose : ''}`;
    });
    const who = rx.dentist?.full_name ? ` (Dr(a). ${rx.dentist.full_name})` : '';
    const msg = `Minha receita${who} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`;
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
            </p>
            {dentistLine && (
              <p className="text-xs text-muted-foreground mt-0.5">{dentistLine}</p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0"
            onClick={downloadPdf}
            aria-label="Baixar receituário"
          >
            <Download className="h-5 w-5" />
          </Button>
        </div>

        <ul className="space-y-1.5 pl-1">
          {rx.items.map((it, i) => {
            const med = [it.medication, it.concentration].filter(Boolean).join(' ');
            const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={downloadPdf}
                  className="w-full text-left flex gap-2 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                  title="Baixar receituário"
                >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{med || 'Medicamento'}</p>
                  {dose && <p className="text-xs text-muted-foreground">{dose}</p>}
                  {it.type === 'controlled' && <Badge variant="outline" className="text-[10px] mt-1">Controlada</Badge>}
                </div>
                <Download className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 mt-1" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-2" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" /> Baixar receituário
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={shareWhatsApp}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        </div>
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
