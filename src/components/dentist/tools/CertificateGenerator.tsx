import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileDown, MessageCircle, User, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { generateCertificatePdf } from '@/lib/generateCertificatePdf';
import { fetchClinicForDocs, fetchDentistForDocs, whatsappLink } from '@/lib/clinicalDocsHelpers';

interface CertificateGeneratorProps {
  patientId?: string;
  hypotheses?: Array<{ text: string; cid10: string }>;
}

function cidsFromHypotheses(hypotheses?: Array<{ text: string; cid10: string }>) {
  if (!hypotheses) return '';
  return hypotheses.map((h) => h.cid10?.trim()).filter(Boolean).join(', ');
}

export function CertificateGenerator({ patientId: initialPatientId, hypotheses }: CertificateGeneratorProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState<string>(initialPatientId ?? '');
  const [mode, setMode] = useState<'attendance' | 'leave'>('attendance');
  const [generating, setGenerating] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');

  const [leaveStartDate, setLeaveStartDate] = useState(today);
  const [leaveDays, setLeaveDays] = useState('1');

  // CID-10: auto-filled from hypotheses, allows manual override
  const [cid, setCid] = useState(() => cidsFromHypotheses(hypotheses));
  const [cidUserEdited, setCidUserEdited] = useState(false);

  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

  // Sync CID from hypotheses when they change (unless user already manually edited)
  useEffect(() => {
    if (cidUserEdited) return;
    const auto = cidsFromHypotheses(hypotheses);
    setCid(auto);
  }, [hypotheses, cidUserEdited]);

  const handleCidChange = (v: string) => {
    setCid(v);
    setCidUserEdited(true);
  };

  const resyncCid = () => {
    setCid(cidsFromHypotheses(hypotheses));
    setCidUserEdited(false);
  };

  const autoCid = cidsFromHypotheses(hypotheses);

  const { data: patients = [] } = useQuery({
    queryKey: ['cert-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const patient = patients.find((p) => p.id === patientId);

  // Auto-fill attendance time from today's appointment
  useEffect(() => {
    if (!patientId || !user) return;
    const fetchToday = async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('patient_id', patientId)
        .eq('dentist_id', user.id)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const s = new Date(data.start_time);
        const e = new Date(data.end_time);
        setAttendanceDate(format(s, 'yyyy-MM-dd'));
        setStartTime(format(s, 'HH:mm'));
        setEndTime(format(e, 'HH:mm'));
      }
    };
    fetchToday();
  }, [patientId, user]);

  const handleGenerate = async () => {
    if (!patient || !user) {
      toast.error('Selecione o paciente.');
      return;
    }
    setGenerating(true);
    try {
      const [clinic, dentist] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      await generateCertificatePdf({
        mode,
        patient: { full_name: patient.full_name, cpf: patient.cpf },
        dentist,
        clinic,
        attendanceDate: mode === 'attendance' ? attendanceDate : undefined,
        startTime: mode === 'attendance' ? startTime : undefined,
        endTime: mode === 'attendance' ? endTime : undefined,
        leaveStartDate: mode === 'leave' ? leaveStartDate : undefined,
        leaveDays: mode === 'leave' ? parseInt(leaveDays, 10) || 1 : undefined,
        cid: cid.trim() || undefined,
        notes: notes || undefined,
      });
      await supabase.from('documents').insert({
        patient_id: patient.id,
        name: `Atestado ${mode === 'attendance' ? 'comparecimento' : 'afastamento'} - ${new Date().toLocaleDateString('pt-BR')}`,
        file_url: 'generated://certificate',
        file_type: 'application/pdf',
        category: 'medical_certificate',
        uploaded_by: user.id,
      });
      toast.success('Atestado gerado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar atestado.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!patient?.phone) {
      toast.error('Paciente sem telefone cadastrado.');
      return;
    }
    const link = whatsappLink(patient.phone, 'Olá! Segue seu atestado.');
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Paciente
        </Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o paciente" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'attendance' | 'leave')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">Comparecimento</TabsTrigger>
          <TabsTrigger value="leave">Afastamento</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-3 pt-3">
          <div className="space-y-2">
            <Label className="text-sm">Data</Label>
            <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-sm">Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-sm">Início</Label>
              <Input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Dias de afastamento</Label>
              <Input type="number" min={1} value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">CID-10 (opcional)</Label>
          {autoCid && cidUserEdited && (
            <button
              type="button"
              onClick={resyncCid}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              Restaurar das hipóteses
            </button>
          )}
        </div>
        <Input
          value={cid}
          onChange={(e) => handleCidChange(e.target.value)}
          placeholder="Ex: J45.0"
          className="font-mono"
        />
        {autoCid && !cidUserEdited && (
          <p className="text-[11px] text-muted-foreground">
            Preenchido automaticamente das hipóteses diagnósticas
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Observações (opcional)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleGenerate} disabled={generating || !patient} className="gap-2">
          <FileDown className="h-4 w-4" />
          {generating ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        <Button variant="outline" onClick={handleSendWhatsApp} disabled={!patient?.phone} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
