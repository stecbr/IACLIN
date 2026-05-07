import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Save, CheckCircle, Plus, Trash2, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssessmentForm } from '@/components/attendance/AssessmentForm';
import { VitalSignsForm, type VitalSigns } from '@/components/attendance/VitalSignsForm';
import { HypothesesEditor, type Hypothesis } from '@/components/attendance/HypothesesEditor';
import { FollowUpBlock } from '@/components/attendance/FollowUpBlock';
import { RequestsEditor, type RequestItem, type RequestKind } from '@/components/attendance/RequestsEditor';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';
import { AnthropometryForm, type Anthropometry } from '@/components/attendance/AnthropometryForm';
import { MealPlanForm, type MealPlan } from '@/components/attendance/MealPlanForm';
import { SoapSessionForm, type SoapSession } from '@/components/attendance/SoapSessionForm';
import { PatientAlertsBar } from '@/components/attendance/PatientAlertsBar';
import { HistoryDrawer } from '@/components/attendance/HistoryDrawer';
import { DentalExamForm, type DentalExam } from '@/components/attendance/DentalExamForm';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { ATTENDANCE_TAB_LABELS } from '@/lib/specialtyProfile';

interface ProcedureRow {
  tempId: string;
  procedure_id: string;
  tooth_number: number | null;
  surface: string;
  notes: string;
  price: number;
}

export default function Attendance() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user, currentClinicId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [clinicalRecordId, setClinicalRecordId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [finishedNavigatePending, setFinishedNavigatePending] = useState(false);

  // Expanded clinical fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('days');
  const [physicalExam, setPhysicalExam] = useState('');
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({});
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [severity, setSeverity] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [requests, setRequests] = useState<RequestItem[]>([]);

  // Specialty-specific structured data (saved as JSON inside clinical_records.notes)
  const [anthropometry, setAnthropometry] = useState<Anthropometry>({});
  const [mealPlan, setMealPlan] = useState<MealPlan>({});
  const [soap, setSoap] = useState<SoapSession>({});
  const [dentalExam, setDentalExam] = useState<DentalExam>({ teeth: [] });

  const { profile: specialtyProfile } = useSpecialtyProfile();
  const tabKeys = specialtyProfile.attendanceTabs;

  // Load appointment
  const { data: appointment, isLoading: loadingApt } = useQuery({
    queryKey: ['appointment-detail', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(id, full_name, phone, date_of_birth, insurance_provider), procedures(name, color, default_price)')
        .eq('id', appointmentId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Load procedures catalog
  const { data: proceduresCatalog = [] } = useQuery({
    queryKey: ['procedures-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procedures').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load existing clinical record for this appointment
  const { data: existingRecord } = useQuery({
    queryKey: ['clinical-record', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_records')
        .select('*, clinical_record_procedures(*), clinical_record_requests(*)')
        .eq('appointment_id', appointmentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Detect clinic category for odontogram tab
  const { data: clinicCategory } = useQuery({
    queryKey: ['attendance-clinic-category', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data } = await supabase.from('clinics').select('category').eq('id', currentClinicId).maybeSingle();
      return data?.category ?? null;
    },
    enabled: !!currentClinicId,
  });
  const showOdontogram = clinicCategory === 'odonto';
  const showOdontogramTab = showOdontogram && tabKeys.includes('odontogram');

  // Populate form with existing record
  useEffect(() => {
    if (existingRecord) {
      const r = existingRecord as any;
      setClinicalRecordId(existingRecord.id);
      // Parse specialty-specific JSON header from notes if present
      const rawNotes: string = existingRecord.notes ?? '';
      const specMatch = rawNotes.match(/^<!--SPECIALTY_DATA:(.*?)-->\n?/s);
      if (specMatch) {
        try {
          const parsed = JSON.parse(specMatch[1]);
          if (parsed.anthropometry) setAnthropometry(parsed.anthropometry);
          if (parsed.meal_plan) setMealPlan(parsed.meal_plan);
          if (parsed.soap) setSoap(parsed.soap);
          if (parsed.dental_exam) setDentalExam(parsed.dental_exam);
        } catch { /* ignore */ }
        setClinicalNotes(rawNotes.slice(specMatch[0].length));
      } else {
        setClinicalNotes(rawNotes);
      }
      setDiagnosis(existingRecord.diagnosis ?? '');
      setChiefComplaint(r.chief_complaint ?? '');
      setHpi(r.history_present_illness ?? '');
      const dur = r.symptom_duration ?? '';
      const m = dur.match(/^(\d+)\s+(\w+)$/);
      if (m) { setDurationValue(m[1]); setDurationUnit(m[2]); } else { setDurationValue(dur); }
      setPhysicalExam(r.physical_exam ?? '');
      setVitalSigns(r.vital_signs ?? {});
      setHypotheses(Array.isArray(r.hypotheses) ? r.hypotheses : []);
      setSeverity(r.severity ?? '');
      setTreatmentPlan(r.treatment_plan ?? '');
      setFollowUpDate(r.follow_up_date ?? '');
      setFollowUpReason(r.follow_up_reason ?? '');
      const reqs = (r.clinical_record_requests ?? []).map((it: any) => ({
        id: it.id,
        kind: it.kind as RequestKind,
        payload: it.payload ?? {},
      }));
      if (reqs.length > 0) setRequests(reqs);
      const procs = (r.clinical_record_procedures ?? []).map((p: any) => ({
        tempId: p.id,
        procedure_id: p.procedure_id,
        tooth_number: p.tooth_number,
        surface: p.surface ?? '',
        notes: p.notes ?? '',
        price: Number(p.price),
      }));
      if (procs.length > 0) setProcedures(procs);
    }
  }, [existingRecord]);

  // Mark appointment as in_progress on first load
  useEffect(() => {
    if (appointment && ['scheduled', 'confirmed'].includes(appointment.status)) {
      supabase
        .from('appointments')
        .update({ status: 'in_progress', presence_status: 'in_service' })
        .eq('id', appointment.id)
        .then();
    }
  }, [appointment]);

  const addProcedure = () => {
    setProcedures((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), procedure_id: '', tooth_number: null, surface: '', notes: '', price: 0 },
    ]);
  };

  const updateProcedure = (tempId: string, field: keyof ProcedureRow, value: any) => {
    setProcedures((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const updated = { ...p, [field]: value };
        if (field === 'procedure_id') {
          const cat = proceduresCatalog.find((c) => c.id === value);
          if (cat) updated.price = Number(cat.default_price);
        }
        return updated;
      })
    );
  };

  const removeProcedure = (tempId: string) => {
    setProcedures((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleSave = async () => {
    if (!appointment || !user) return;
    setSaving(true);
    try {
      let recordId = clinicalRecordId;
      const symptomDuration = durationValue ? `${durationValue} ${durationUnit}` : null;
      const cleanVitals = Object.fromEntries(
        Object.entries(vitalSigns).filter(([, v]) => v !== undefined && v !== '')
      );
      const vitalsToSave = Object.keys(cleanVitals).length > 0 ? cleanVitals : null;
      const cleanHypotheses = hypotheses.filter((h) => h.text.trim());
      const hypothesesToSave = cleanHypotheses.length > 0 ? cleanHypotheses : null;

      // Pack specialty-specific structured data as a hidden JSON header inside notes.
      const specialtyPayload: Record<string, unknown> = {};
      if (Object.values(anthropometry).some((v) => v && String(v).trim())) specialtyPayload.anthropometry = anthropometry;
      if (Object.values(mealPlan).some((v) => v && String(v).trim())) specialtyPayload.meal_plan = mealPlan;
      if (Object.values(soap).some((v) => v && String(v).trim() && v !== 'none')) specialtyPayload.soap = soap;
      if ((dentalExam.teeth?.length ?? 0) > 0 || dentalExam.gingiva || dentalExam.plaqueIndex || dentalExam.bleedingIndex) {
        specialtyPayload.dental_exam = dentalExam;
      }
      const notesHeader = Object.keys(specialtyPayload).length > 0
        ? `<!--SPECIALTY_DATA:${JSON.stringify(specialtyPayload)}-->\n`
        : '';
      const finalNotes = (notesHeader + (clinicalNotes ?? '')).trim() || null;

      const recordPayload: any = {
        notes: finalNotes,
        diagnosis: diagnosis || null,
        chief_complaint: chiefComplaint || null,
        history_present_illness: hpi || null,
        symptom_duration: symptomDuration,
        physical_exam: physicalExam || null,
        vital_signs: vitalsToSave,
        hypotheses: hypothesesToSave,
        severity: severity || null,
        treatment_plan: treatmentPlan || null,
        follow_up_date: followUpDate || null,
        follow_up_reason: followUpReason || null,
      };

      if (recordId) {
        // Update existing
        const { error } = await supabase
          .from('clinical_records')
          .update(recordPayload)
          .eq('id', recordId);
        if (error) throw error;

        // Delete old procedures + requests and re-insert
        await supabase.from('clinical_record_procedures').delete().eq('clinical_record_id', recordId);
        await supabase.from('clinical_record_requests').delete().eq('clinical_record_id', recordId);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('clinical_records')
          .insert({
            appointment_id: appointment.id,
            patient_id: appointment.patient_id,
            dentist_id: user.id,
            clinic_id: currentClinicId ?? null,
            status: 'in_progress',
            ...recordPayload,
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        recordId = data.id;
        setClinicalRecordId(recordId);
      }

      // Insert procedures
      const validProcs = procedures.filter((p) => p.procedure_id);
      if (validProcs.length > 0 && recordId) {
        const { error: procError } = await supabase.from('clinical_record_procedures').insert(
          validProcs.map((p) => ({
            clinical_record_id: recordId!,
            procedure_id: p.procedure_id,
            tooth_number: p.tooth_number,
            surface: p.surface || null,
            notes: p.notes || null,
            price: p.price,
          }))
        );
        if (procError) throw procError;
      }

      // Insert requests
      const validRequests = requests.filter((r) => {
        const v = Object.values(r.payload).join('').trim();
        return v.length > 0;
      });
      if (validRequests.length > 0 && recordId) {
        const { error: reqError } = await supabase.from('clinical_record_requests').insert(
          validRequests.map((r) => ({
            clinical_record_id: recordId!,
            kind: r.kind,
            payload: r.payload,
          }))
        );
        if (reqError) throw reqError;
      }

      toast.success('Atendimento salvo!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!appointment || !user) return;
    // Regra de negócio: bloquear finalização sem dados mínimos
    const errors: string[] = [];
    const validHypotheses = hypotheses.filter((h) => h.text.trim()).length;
    if (!diagnosis.trim() && validHypotheses === 0) {
      errors.push('Informe diagnóstico ou hipótese diagnóstica');
    }
    const validProcs = procedures.filter((p) => p.procedure_id).length;
    if (validProcs === 0 && !clinicalNotes.trim() && !treatmentPlan.trim()) {
      errors.push('Registre ao menos um procedimento, evolução ou plano de tratamento');
    }
    if (errors.length) {
      toast.error(errors.join(' • '));
      return;
    }
    setFinishing(true);
    try {
      await handleSave();

      // Update clinical record status
      if (clinicalRecordId) {
        await supabase.from('clinical_records').update({ status: 'completed' }).eq('id', clinicalRecordId);
      }

      // Mark appointment as completed
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointment.id);

      // Create financial transaction
      const totalAmount = procedures.reduce((sum, p) => sum + p.price, 0);
      if (totalAmount > 0) {
        await supabase.from('financial_transactions').insert({
          patient_id: appointment.patient_id,
          appointment_id: appointment.id,
          dentist_id: user.id,
          clinic_id: currentClinicId ?? null,
          type: 'receivable',
          category: 'consultation',
          description: `Atendimento - ${(appointment as any).patients?.full_name}`,
          amount: totalAmount,
          due_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'pending',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Atendimento finalizado!');
      setShowSummary(true);
      setFinishedNavigatePending(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFinishing(false);
    }
  };

  if (loadingApt) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Consulta não encontrada.</p>
        <Link to="/agenda" className="text-primary underline text-sm mt-2 block">Voltar à Agenda</Link>
      </div>
    );
  }

  const totalPrice = procedures.reduce((s, p) => s + p.price, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar à Agenda
        </Link>
        <div className="flex gap-2">
          <HistoryDrawer patientId={appointment.patient_id} currentAppointmentId={appointment.id} />
          <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={handleFinish} disabled={finishing} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {finishing ? 'Finalizando...' : 'Finalizar Atendimento'}
          </Button>
        </div>
      </div>

      {/* Patient Header */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{(appointment as any).patients?.full_name}</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{format(parseISO(appointment.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  <span>{(appointment as any).procedures?.name ?? 'Consulta geral'}</span>
                  {(appointment as any).patients?.insurance_provider && (
                    <Badge variant="outline" className="text-[10px]">{(appointment as any).patients.insurance_provider}</Badge>
                  )}
                </div>
              </div>
            </div>
            <Link to={`/patients/${appointment.patient_id}`} className="text-xs text-primary hover:underline">
              Ver perfil
            </Link>
          </div>
          <div className="mt-3">
            <PatientAlertsBar patientId={appointment.patient_id} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={tabKeys[0] ?? 'assessment'} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {tabKeys.map((key) => {
            if (key === 'odontogram' && !showOdontogramTab) return null;
            const label = ATTENDANCE_TAB_LABELS[key];
            const suffix =
              key === 'requests' ? ` (${requests.length})` :
              key === 'procedures' ? ` (${procedures.length})` : '';
            return <TabsTrigger key={key} value={key}>{label}{suffix}</TabsTrigger>;
          })}
        </TabsList>

        {tabKeys.includes('soap') && (
          <TabsContent value="soap"><SoapSessionForm value={soap} onChange={setSoap} /></TabsContent>
        )}
        {tabKeys.includes('anthropometry') && (
          <TabsContent value="anthropometry"><AnthropometryForm value={anthropometry} onChange={setAnthropometry} /></TabsContent>
        )}
        {tabKeys.includes('mealplan') && (
          <TabsContent value="mealplan"><MealPlanForm value={mealPlan} onChange={setMealPlan} /></TabsContent>
        )}
        {tabKeys.includes('scales') && (
          <TabsContent value="scales"><Card className="border-border/50"><CardContent className="p-6 text-center text-sm text-muted-foreground">Aplique escalas (PHQ-9, GAD-7, etc.) na ferramenta dedicada. <Link to="/psi/ferramentas" className="text-primary hover:underline">Abrir ferramentas</Link></CardContent></Card></TabsContent>
        )}
        {tabKeys.includes('mood') && (
          <TabsContent value="mood"><Card className="border-border/50"><CardContent className="p-6 text-center text-sm text-muted-foreground">Diário de humor disponível em ferramentas do psicólogo. <Link to="/psi/ferramentas" className="text-primary hover:underline">Abrir</Link></CardContent></Card></TabsContent>
        )}

        <TabsContent value="assessment">
          <AssessmentForm
            patientId={appointment.patient_id}
            chiefComplaint={chiefComplaint}
            setChiefComplaint={setChiefComplaint}
            hpi={hpi}
            setHpi={setHpi}
            durationValue={durationValue}
            setDurationValue={setDurationValue}
            durationUnit={durationUnit}
            setDurationUnit={setDurationUnit}
            physicalExam={physicalExam}
            setPhysicalExam={setPhysicalExam}
          />
        </TabsContent>

        <TabsContent value="vitals">
          <VitalSignsForm value={vitalSigns} onChange={setVitalSigns} />
        </TabsContent>

        <TabsContent value="diagnosis">
          <HypothesesEditor
            hypotheses={hypotheses}
            onChange={setHypotheses}
            diagnosis={diagnosis}
            setDiagnosis={setDiagnosis}
            severity={severity}
            setSeverity={setSeverity}
          />
        </TabsContent>

        <TabsContent value="conduct">
          <FollowUpBlock
            treatmentPlan={treatmentPlan}
            setTreatmentPlan={setTreatmentPlan}
            followUpDate={followUpDate}
            setFollowUpDate={setFollowUpDate}
            followUpReason={followUpReason}
            setFollowUpReason={setFollowUpReason}
            onScheduled={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
          />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsEditor items={requests} onChange={setRequests} />
        </TabsContent>

        {/* Clinical Notes Tab */}
        <TabsContent value="notes">
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Evolução / Anotações Clínicas</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={6}
                  placeholder="Descreva o atendimento, queixas do paciente, procedimentos realizados..."
                  className="resize-none"
                />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Diagnóstico</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                  placeholder="Diagnóstico clínico..."
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Procedures Tab */}
        <TabsContent value="procedures">
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Procedimentos Realizados</CardTitle>
              <Button size="sm" variant="outline" onClick={addProcedure} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {procedures.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <p>Nenhum procedimento adicionado.</p>
                  <Button size="sm" variant="link" onClick={addProcedure}>Adicionar procedimento</Button>
                </div>
              ) : (
                <>
                  {procedures.map((proc) => (
                    <div key={proc.tempId} className="p-3 rounded-lg border border-border/50 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs">Procedimento</Label>
                            <Select value={proc.procedure_id} onValueChange={(v) => updateProcedure(proc.tempId, 'procedure_id', v)}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {proceduresCatalog.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                                      {c.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input
                              type="number"
                              value={proc.price}
                              onChange={(e) => updateProcedure(proc.tempId, 'price', Number(e.target.value))}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 mt-5" onClick={() => removeProcedure(proc.tempId)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Dente</Label>
                          <Input
                            type="number"
                            value={proc.tooth_number ?? ''}
                            onChange={(e) => updateProcedure(proc.tempId, 'tooth_number', e.target.value ? Number(e.target.value) : null)}
                            className="h-9 text-sm"
                            placeholder="Nº"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Face</Label>
                          <Input
                            value={proc.surface}
                            onChange={(e) => updateProcedure(proc.tempId, 'surface', e.target.value)}
                            className="h-9 text-sm"
                            placeholder="M, D, V..."
                          />
                        </div>
                        <div className="col-span-2 md:col-span-1 space-y-1">
                          <Label className="text-xs">Obs</Label>
                          <Input
                            value={proc.notes}
                            onChange={(e) => updateProcedure(proc.tempId, 'notes', e.target.value)}
                            className="h-9 text-sm"
                            placeholder="Observações"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <p className="text-sm font-semibold">Total: R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showOdontogram && (
          <TabsContent value="odontogram">
            <div className="space-y-3">
              <DentalExamForm value={dentalExam} onChange={setDentalExam} />
              <div className="text-center">
                <Link
                  to={`/odontogram?patient=${appointment.patient_id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Abrir odontograma completo do paciente →
                </Link>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <AttendanceSummaryModal
        appointmentId={appointment.id}
        open={showSummary}
        onOpenChange={(o) => {
          setShowSummary(o);
          if (!o && finishedNavigatePending) {
            setFinishedNavigatePending(false);
            navigate('/agenda');
          }
        }}
      />
    </div>
  );
}