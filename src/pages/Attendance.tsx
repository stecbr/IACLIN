import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Save, CheckCircle, Plus, Trash2, Stethoscope, FolderHeart, ExternalLink } from 'lucide-react';
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
import { FinishPaymentDialog, type FinishProcedure } from '@/components/attendance/FinishPaymentDialog';
import { AnthropometryForm, type Anthropometry } from '@/components/attendance/AnthropometryForm';
import { MealPlanForm, type MealPlan } from '@/components/attendance/MealPlanForm';
import { SoapSessionForm, type SoapSession } from '@/components/attendance/SoapSessionForm';
import { PatientAlertsBar } from '@/components/attendance/PatientAlertsBar';
import { HistoryDrawer } from '@/components/attendance/HistoryDrawer';
import { DentalExamForm, type DentalExam } from '@/components/attendance/DentalExamForm';
import { ConsultationTimer } from '@/components/attendance/ConsultationTimer';
import { computeElapsedSeconds, endSession, getSession, startSession } from '@/lib/consultationSession';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { ATTENDANCE_TAB_LABELS } from '@/lib/specialtyProfile';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import { useViewMode } from '@/hooks/useViewMode';
import { Navigate } from 'react-router-dom';
import { RecordConsultationButton } from '@/components/attendance/recording/RecordConsultationButton';
import { PatientOverviewTab } from '@/components/attendance/PatientOverviewTab';
import { DocumentsTab } from '@/components/attendance/DocumentsTab';
import { useOperatorPriceCatalog, type OperatorCatalogItem } from '@/hooks/useOperatorPriceCatalog';
import { ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import { archiveAttendanceFiles } from '@/lib/archiveAttendanceFiles';

interface ProcedureRow {
  tempId: string;
  procedure_id: string;
  custom_name: string;
  is_manual: boolean;
  is_operator?: boolean;
  operator_item_id?: string;
  tuss_code?: string | null;
  tooth_number: number | null;
  surface: string;
  notes: string;
  price: number;
}

export default function Attendance() {
  const isClinicSignup = useIsClinicSignup();
  const { viewMode } = useViewMode();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user, currentClinicId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Clinic-only accounts can perform attendance only when in Modo Consulta
  if (isClinicSignup && viewMode !== 'consult') return <Navigate to="/" replace />;

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [clinicalRecordId, setClinicalRecordId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [finishedNavigatePending, setFinishedNavigatePending] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

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
  const showToothProcedures = specialtyProfile.showToothProcedures;

  // Draft persistence: survives navigation within the same session
  const DRAFT_KEY = `attendance_draft_${appointmentId}`;
  const restoredFromStorage = useRef(false);

  // Restore draft from sessionStorage on mount (before DB query resolves)
  useEffect(() => {
    if (!appointmentId) return;
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      restoredFromStorage.current = true;
      if (d.clinicalNotes !== undefined) setClinicalNotes(d.clinicalNotes);
      if (d.diagnosis !== undefined) setDiagnosis(d.diagnosis);
      if (d.chiefComplaint !== undefined) setChiefComplaint(d.chiefComplaint);
      if (d.hpi !== undefined) setHpi(d.hpi);
      if (d.durationValue !== undefined) setDurationValue(d.durationValue);
      if (d.durationUnit !== undefined) setDurationUnit(d.durationUnit);
      if (d.physicalExam !== undefined) setPhysicalExam(d.physicalExam);
      if (d.vitalSigns !== undefined) setVitalSigns(d.vitalSigns);
      if (d.hypotheses !== undefined) setHypotheses(d.hypotheses);
      if (d.severity !== undefined) setSeverity(d.severity);
      if (d.treatmentPlan !== undefined) setTreatmentPlan(d.treatmentPlan);
      if (d.followUpDate !== undefined) setFollowUpDate(d.followUpDate);
      if (d.followUpReason !== undefined) setFollowUpReason(d.followUpReason);
      if (d.requests !== undefined) setRequests(d.requests);
      if (d.anthropometry !== undefined) setAnthropometry(d.anthropometry);
      if (d.mealPlan !== undefined) setMealPlan(d.mealPlan);
      if (d.soap !== undefined) setSoap(d.soap);
      if (d.dentalExam !== undefined) setDentalExam(d.dentalExam);
      if (Array.isArray(d.procedures) && d.procedures.length > 0) setProcedures(d.procedures);
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft to sessionStorage whenever state changes (debounced 600ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        clinicalNotes, diagnosis, chiefComplaint, hpi, durationValue, durationUnit,
        physicalExam, vitalSigns, hypotheses, severity, treatmentPlan,
        followUpDate, followUpReason, requests, anthropometry, mealPlan, soap, dentalExam, procedures,
      }));
    }, 600);
    return () => clearTimeout(timer);
  }, [DRAFT_KEY, clinicalNotes, diagnosis, chiefComplaint, hpi, durationValue, durationUnit,
    physicalExam, vitalSigns, hypotheses, severity, treatmentPlan, followUpDate, followUpReason,
    requests, anthropometry, mealPlan, soap, dentalExam, procedures]);

  const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

  // Load appointment
  const { data: appointment, isLoading: loadingApt } = useQuery({
    queryKey: ['appointment-detail', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(id, full_name, phone, email, date_of_birth, gender, cpf, address, city, state, zip_code, photo_url, insurance_provider, patient_user_id, emergency_contact_name, emergency_contact_phone), procedures(name, color, default_price)')
        .eq('id', appointmentId!)
        .single();
      if (error) throw error;

      // If the patient has a linked user account, enrich with the most up-to-date
      // data from patient_accounts (gender, dob, etc.) and profiles (avatar, address)
      const patientUserId = (data as any)?.patients?.patient_user_id;
      if (patientUserId) {
        const [{ data: acc }, { data: prof }] = await Promise.all([
          supabase
            .from('patient_accounts')
            .select('full_name, phone, date_of_birth, gender, cpf, insurance_provider, insurance_number')
            .eq('user_id', patientUserId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('avatar_url, address, zip_code, city, state')
            .eq('id', patientUserId)
            .maybeSingle(),
        ]);
        const pat = (data as any).patients ?? {};
        (data as any).patients = {
          ...pat,
          ...(acc ? {
            full_name: acc.full_name ?? pat.full_name,
            phone: acc.phone ?? pat.phone,
            date_of_birth: acc.date_of_birth ?? pat.date_of_birth,
            gender: acc.gender ?? pat.gender,
            cpf: acc.cpf ?? pat.cpf,
            insurance_provider: acc.insurance_provider ?? pat.insurance_provider,
          } : {}),
          ...(prof ? {
            photo_url: prof.avatar_url ?? pat.photo_url,
            address: prof.address ?? pat.address,
            zip_code: prof.zip_code ?? pat.zip_code,
            city: prof.city ?? pat.city,
            state: prof.state ?? pat.state,
          } : {}),
          // email is stored in patients.email (set when patient saves their profile)
          email: pat.email,
        };
      }

      return data;
    },
    enabled: !!appointmentId,
  });

  // Load procedures catalog
  const { data: proceduresCatalog = [] } = useQuery({
    queryKey: ['procedures-catalog', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load clinic state for operator-table state matching
  const { data: clinicInfo } = useQuery({
    queryKey: ['clinic-state', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics').select('state').eq('id', currentClinicId!).maybeSingle();
      return data;
    },
  });

  // Operator price catalog (if patient has insurance + clinic credentialed)
  const patientInsurance = (appointment as any)?.patients?.insurance_provider as string | undefined;
  const { data: operatorCatalog } = useOperatorPriceCatalog({
    insuranceProviderName: patientInsurance,
    clinicId: currentClinicId,
    clinicState: clinicInfo?.state ?? null,
  });
  const operatorMode = operatorCatalog?.status === 'operator';
  const operatorItems: OperatorCatalogItem[] = operatorCatalog?.items ?? [];

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

  // Load patient's current medications from anamnese (for drug interaction alerts)
  const patientId = (appointment as any)?.patient_id as string | undefined;
  const { data: patientMedications } = useQuery({
    queryKey: ['anamnese-medications', patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('anamneses')
        .select('medications')
        .eq('patient_id', patientId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.medications as string | null) ?? null;
    },
    enabled: !!patientId,
  });

  // Odontogram tab shows only when the professional's own specialty profile includes it
  const showOdontogram = tabKeys.includes('odontogram');

  // Payment account for PIX display on payment dialog
  const { data: paymentAccount } = useQuery({
    queryKey: ['payment-account-attendance', currentClinicId, user?.id],
    queryFn: async () => {
      const entityType = currentClinicId ? 'clinic' : 'doctor';
      const entityId   = currentClinicId ?? user?.id;
      if (!entityId) return null;
      const { data } = await (supabase as any)
        .from('payment_accounts')
        .select('pix_key, pix_key_type, bank_name, account, account_holder')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
  });

  // Insurance plans for the clinic (for payment dialog)
  const { data: insurancePlans = [] } = useQuery({
    queryKey: ['insurance-plans-payment', currentClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!currentClinicId,
  });

  // Populate form with existing record (skips form fields if draft was restored from sessionStorage)
  useEffect(() => {
    if (existingRecord) {
      const r = existingRecord as any;
      setClinicalRecordId(existingRecord.id); // always capture the DB record ID
      if (restoredFromStorage.current) return; // draft takes priority over DB data
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
          if (Array.isArray(parsed.manual_procedures) && parsed.manual_procedures.length > 0) {
            const manualRows: ProcedureRow[] = parsed.manual_procedures.map((m: any) => ({
              tempId: crypto.randomUUID(),
              procedure_id: '',
              custom_name: m.custom_name ?? '',
              is_manual: true,
              tooth_number: m.tooth_number ?? null,
              surface: m.surface ?? '',
              notes: m.notes ?? '',
              price: Number(m.price) || 0,
            }));
            setProcedures((prev) => [...prev, ...manualRows]);
          }
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
        custom_name: '',
        is_manual: false,
        tooth_number: p.tooth_number,
        surface: p.surface ?? '',
        notes: p.notes ?? '',
        price: Number(p.price),
      }));
      if (procs.length > 0) setProcedures(procs);
    }
  }, [existingRecord]);

  // Start local consultation session immediately (instant FAB everywhere).
  useEffect(() => {
    if (!appointment) return;
    const startedAtIso = (appointment as any).service_started_at ?? new Date().toISOString();
    startSession({
      appointmentId: appointment.id,
      patientId: appointment.patient_id,
      patientName: (appointment as any).patients?.full_name,
      startedAt: startedAtIso,
    });
    // Server sync (best-effort).
    const needsStart = appointment.status !== 'in_progress' && appointment.status !== 'completed' && appointment.status !== 'cancelled';
    const needsServiceStart = !(appointment as any).service_started_at;
    if (!needsStart && !needsServiceStart) return;
    const update: any = {};
    if (needsStart) {
      update.status = 'in_progress';
      update.presence_status = 'in_service';
    }
    if (needsServiceStart) update.service_started_at = startedAtIso;
    (async () => {
      const { error } = await supabase.from('appointments').update(update).eq('id', appointment.id);
      if (error) {
        console.error('[attendance] failed to start consultation', error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['appointment-detail', appointment.id] });
    })();
  }, [appointment, queryClient]);

  const addProcedure = () => {
    setProcedures((prev) => [
      ...prev,
      operatorMode
        ? { tempId: crypto.randomUUID(), procedure_id: '', custom_name: '', is_manual: true, is_operator: true, operator_item_id: '', tuss_code: null, tooth_number: null, surface: '', notes: '', price: 0 }
        : { tempId: crypto.randomUUID(), procedure_id: '', custom_name: '', is_manual: proceduresCatalog.length === 0, tooth_number: null, surface: '', notes: '', price: 0 },
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
        if (field === 'operator_item_id') {
          const it = operatorItems.find((c) => c.id === value);
          if (it) {
            updated.custom_name = it.procedure_name;
            updated.price = Number(it.value_brl) || 0;
            updated.tuss_code = it.tuss_code;
            updated.is_manual = true;
            updated.is_operator = true;
          }
        }
        return updated;
      })
    );
  };

  const removeProcedure = (tempId: string) => {
    setProcedures((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleSave = async (): Promise<boolean> => {
    if (!appointment || !user) return false;
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
      const manualProcs = procedures.filter((p) => p.is_manual && p.custom_name.trim());
      if (manualProcs.length > 0) {
        specialtyPayload.manual_procedures = manualProcs.map((p) => ({
          custom_name: p.custom_name,
          price: p.price,
          notes: p.notes || null,
          tooth_number: p.tooth_number,
          surface: p.surface || null,
          tuss_code: p.tuss_code ?? null,
          is_operator: p.is_operator ? true : undefined,
        }));
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

      // Track elapsed consultation time from local session.
      const elapsed = computeElapsedSeconds(getSession());
      if (elapsed > 0) recordPayload.procedure_duration_seconds = elapsed;

      // Capture existing IDs before any writes (for safe replace on update)
      let oldProcIds: string[] = [];
      let oldReqIds: string[] = [];

      if (recordId) {
        // Update existing record
        const { error } = await supabase
          .from('clinical_records')
          .update(recordPayload)
          .eq('id', recordId);
        if (error) throw error;

        // Capture old procedure/request IDs so we can delete them AFTER inserting new ones.
        // Exclude doc_* kinds — those are owned by DocumentsTab and managed independently.
        const DOC_KINDS = ['doc_exam_request', 'doc_prescription', 'doc_referral', 'doc_certificate'];
        const [{ data: oldProcs }, { data: oldReqs }] = await Promise.all([
          supabase.from('clinical_record_procedures').select('id').eq('clinical_record_id', recordId),
          supabase.from('clinical_record_requests').select('id, kind').eq('clinical_record_id', recordId),
        ]);
        oldProcIds = (oldProcs ?? []).map((p: any) => p.id);
        oldReqIds = (oldReqs ?? []).filter((r: any) => !DOC_KINDS.includes(r.kind)).map((r: any) => r.id);
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

      // Insert new procedures FIRST (safe: old ones still exist if this fails)
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

      // Insert new requests FIRST
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

      // Only now delete old records (new ones are already saved)
      if (oldProcIds.length > 0) {
        const { error: delProcErr } = await supabase.from('clinical_record_procedures').delete().in('id', oldProcIds);
        if (delProcErr) throw delProcErr;
      }
      if (oldReqIds.length > 0) {
        const { error: delReqErr } = await supabase.from('clinical_record_requests').delete().in('id', oldReqIds);
        if (delReqErr) throw delReqErr;
      }

      clearDraft();
      toast.success('Atendimento salvo!');
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
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
    const validProcs = procedures.filter((p) => p.procedure_id || (p.is_manual && p.custom_name.trim())).length;
    if (validProcs === 0 && !clinicalNotes.trim() && !treatmentPlan.trim()) {
      errors.push('Registre ao menos um procedimento, evolução ou plano de tratamento');
    }
    if (errors.length) {
      toast.error(errors.join(' • '));
      return;
    }
    setFinishing(true);
    try {
      const saved = await handleSave();
      if (!saved) {
        setFinishing(false);
        return;
      }

      // Update clinical record status
      if (clinicalRecordId) {
        const { error: recError } = await supabase
          .from('clinical_records')
          .update({ status: 'completed' })
          .eq('id', clinicalRecordId);
        if (recError) throw recError;
      }

      // Mark appointment as completed
      const { error: aptError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointment.id);
      if (aptError) throw aptError;
      endSession(appointment.id);
      clearDraft();
      // Limpa o rascunho da aba Documentos desta consulta
      try { localStorage.removeItem(`doc-draft-apt-${appointment.id}`); } catch { /* ignore */ }

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Atendimento finalizado!');

      // Auto-arquivar PDFs (resumo + receituário + exames + encaminhamentos)
      // na pasta privada do médico do paciente. Falhas não bloqueiam.
      (async () => {
        try {
          const symptomDuration = durationValue.trim()
            ? `${durationValue} ${durationUnit}`
            : null;
          const { failures } = await archiveAttendanceFiles({
            appointmentId: appointment.id,
            patientId: appointment.patient_id,
            clinicId: currentClinicId ?? null,
            userId: user.id,
            startTime: (appointment as any).start_time,
            requests,
            attendance: {
              appointment: {
                start_time: (appointment as any).start_time,
                procedures: (appointment as any).procedures ?? null,
              },
              record: {
                chief_complaint: chiefComplaint,
                history_present_illness: hpi,
                symptom_duration: symptomDuration,
                physical_exam: physicalExam,
                vital_signs: vitalSigns as Record<string, unknown>,
                hypotheses: hypotheses
                  .filter((h) => h.text.trim())
                  .map((h) => ({ text: h.text, cid: h.cid10 || null })),
                diagnosis,
                severity,
                treatment_plan: treatmentPlan,
                follow_up_date: followUpDate || null,
                follow_up_reason: followUpReason,
                notes: clinicalNotes,
                procedures: procedures
                  .filter((p) => p.procedure_id || (p.is_manual && p.custom_name.trim()))
                  .map((p) => ({
                    name: p.custom_name || 'Procedimento',
                    tooth: p.tooth_number,
                    price: p.price,
                    notes: p.notes,
                  })),
              },
              patient: {
                full_name: (appointment as any).patients?.full_name ?? 'Paciente',
                cpf: (appointment as any).patients?.cpf ?? null,
                date_of_birth: (appointment as any).patients?.date_of_birth ?? null,
              },
            },
          });
          if (failures.length === 0) {
            toast.success('Documentos arquivados nos Arquivos do paciente.');
          } else {
            toast.warning(`Alguns documentos não foram arquivados: ${failures.join(' • ')}`);
          }
          queryClient.invalidateQueries({ queryKey: ['patient-private-folders', appointment.patient_id, user.id] });
        } catch (e: any) {
          toast.warning('Não foi possível arquivar os PDFs automaticamente: ' + (e.message ?? e));
        }
      })();

      setFinishedNavigatePending(true);
      // Pagamento NÃO é responsabilidade do médico — fica a cargo da secretária
      // através da Sala de Espera. Aqui apenas exibimos o resumo do atendimento.
      setShowSummary(true);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar à Agenda
        </Link>
        <div className="flex gap-2">
          <HistoryDrawer patientId={appointment.patient_id} currentAppointmentId={appointment.id} />
          <RecordConsultationButton
            appointmentId={appointment.id}
            patientId={appointment.patient_id}
            clinicalRecordId={clinicalRecordId}
            clinicId={currentClinicId ?? null}
            hasExistingContent={[
              chiefComplaint, hpi, physicalExam, diagnosis,
              treatmentPlan, followUpReason, clinicalNotes,
            ].some((v) => typeof v === 'string' && v.trim().length > 0) || hypotheses.length > 0 || requests.length > 0}
            setters={{
              setChiefComplaint, setHpi, setDurationValue, setDurationUnit,
              setPhysicalExam, setHypotheses, setDiagnosis, setSeverity,
              setTreatmentPlan, setFollowUpReason, setRequests, setSoap,
              setClinicalNotes,
            }}
          />
          <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={handleFinish} disabled={finishing || saving} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {finishing ? 'Finalizando...' : 'Finalizar Atendimento'}
          </Button>
        </div>
      </div>

      <ConsultationTimer
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        patientName={(appointment as any).patients?.full_name}
        serviceStartedAt={(appointment as any).service_started_at ?? null}
      />

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
            <a
              href={`/patients/${appointment.patient_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              title="Abre o prontuário completo em uma nova aba"
            >
              <FolderHeart className="h-3.5 w-3.5" />
              Ver prontuário completo
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-3 space-y-2">
            <PatientAlertsBar patientId={appointment.patient_id} />
            {((appointment as any).patients?.emergency_contact_name || (appointment as any).patients?.emergency_contact_phone) && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <span className="font-semibold">Emergência:</span>
                {(appointment as any).patients?.emergency_contact_name && (
                  <span>{(appointment as any).patients.emergency_contact_name}</span>
                )}
                {(appointment as any).patients?.emergency_contact_phone && (
                  <a
                    href={`tel:${(appointment as any).patients.emergency_contact_phone}`}
                    className="font-medium hover:underline"
                  >
                    {(appointment as any).patients.emergency_contact_phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={tabKeys[0] ?? 'assessment'} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {tabKeys.map((key) => {
            if (key === 'odontogram' && !showOdontogram) return null;
            const label = ATTENDANCE_TAB_LABELS[key];
            const suffix =
              key === 'requests' ? ` (${requests.length})` :
              key === 'procedures' ? ` (${procedures.length})` : '';
            return <TabsTrigger key={key} value={key}>{label}{suffix}</TabsTrigger>;
          })}
        </TabsList>

        {tabKeys.includes('overview') && (
          <TabsContent value="overview">
            <PatientOverviewTab patient={(appointment as any).patients ?? {}} consultationNotes={(appointment as any).notes} />
          </TabsContent>
        )}

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
          <RequestsEditor items={requests} onChange={setRequests} patientMedications={patientMedications} />
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
              {operatorCatalog?.status === 'operator' && operatorCatalog.operator && operatorCatalog.table && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">
                      Convênio {operatorCatalog.operator.name}
                    </p>
                    <p className="text-muted-foreground">
                      Tabela "{operatorCatalog.table.name}" {operatorCatalog.table.state ? `· ${operatorCatalog.table.state}` : '· cobertura nacional'} — preços travados pela operadora.
                    </p>
                  </div>
                </div>
              )}
              {operatorCatalog?.status === 'no-table' && operatorCatalog.operator && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-muted-foreground">
                    {operatorCatalog.operator.name} não possui tabela vigente para {clinicInfo?.state ?? 'este estado'}. Cobrando como particular.
                  </span>
                </div>
              )}
              {operatorCatalog?.status === 'not-covered' && operatorCatalog.operator && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-muted-foreground">
                    Clínica não credenciada à {operatorCatalog.operator.name}. Cobrando como particular.
                  </span>
                </div>
              )}
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
                            <div className="flex items-center justify-between">
                              <Label className="text-xs flex items-center gap-1.5">
                                Procedimento
                                {proc.is_operator && (
                                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5">
                                    <ShieldCheck className="h-2.5 w-2.5" /> Operadora
                                  </Badge>
                                )}
                              </Label>
                              {operatorMode ? (
                                <button
                                  type="button"
                                  onClick={() => updateProcedure(proc.tempId, 'is_operator', !proc.is_operator)}
                                  className="text-[11px] text-primary hover:underline"
                                >
                                  {proc.is_operator ? 'Fora da tabela (particular)' : 'Voltar à tabela da operadora'}
                                </button>
                              ) : proceduresCatalog.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateProcedure(proc.tempId, 'is_manual', !proc.is_manual)}
                                  className="text-[11px] text-primary hover:underline"
                                >
                                  {proc.is_manual ? 'Selecionar do catálogo' : 'Digitar manualmente'}
                                </button>
                              )}
                            </div>
                            {proc.is_operator ? (
                              <Select value={proc.operator_item_id ?? ''} onValueChange={(v) => updateProcedure(proc.tempId, 'operator_item_id', v)}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione da tabela da operadora" /></SelectTrigger>
                                <SelectContent className="max-h-[60vh]">
                                  {operatorItems.map((it) => (
                                    <SelectItem key={it.id} value={it.id}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{it.category}</span>
                                        <span>{it.procedure_name}</span>
                                        {it.tuss_code && <span className="text-[10px] text-muted-foreground">TUSS {it.tuss_code}</span>}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : proc.is_manual || proceduresCatalog.length === 0 ? (
                              <Input
                                value={proc.custom_name}
                                onChange={(e) => updateProcedure(proc.tempId, 'custom_name', e.target.value)}
                                placeholder="Nome do procedimento"
                                className="h-9 text-sm"
                              />
                            ) : (
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
                            )}
                            {proc.is_operator && proc.tuss_code && (
                              <p className="text-[10px] text-muted-foreground">TUSS {proc.tuss_code}</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              Valor (R$)
                              {proc.is_operator && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </Label>
                            <Input
                              type="number"
                              value={proc.price}
                              onChange={(e) => updateProcedure(proc.tempId, 'price', Number(e.target.value))}
                              className="h-9 text-sm"
                              disabled={proc.is_operator}
                            />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 mt-5" onClick={() => removeProcedure(proc.tempId)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className={`grid gap-3 ${showToothProcedures ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                        {showToothProcedures && (
                          <>
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
                          </>
                        )}
                        <div className={showToothProcedures ? 'col-span-2 md:col-span-1 space-y-1' : 'space-y-1'}>
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

        {tabKeys.includes('documents') && (
          <TabsContent value="documents" forceMount className="data-[state=inactive]:hidden">
            <DocumentsTab
              patientId={appointment.patient_id}
              hypotheses={hypotheses}
              clinicalRecordId={clinicalRecordId ?? undefined}
              appointmentId={appointment.id}
              appointmentStartTime={(appointment as any).start_time}
            />
          </TabsContent>
        )}
      </Tabs>

      <FinishPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        patientName={(appointment as any).patients?.full_name ?? 'Paciente'}
        clinicId={currentClinicId ?? null}
        patientInsuranceProvider={(appointment as any).patients?.insurance_provider ?? null}
        procedures={procedures
          .filter((p) => p.procedure_id || (p.is_manual && p.custom_name.trim()))
          .map<FinishProcedure>((p) => {
            if (p.is_manual) {
              return { procedure_id: '', name: p.custom_name, code: null, price: Number(p.price) || 0 };
            }
            const cat = proceduresCatalog.find((c: any) => c.id === p.procedure_id);
            return {
              procedure_id: p.procedure_id,
              name: cat?.name ?? 'Procedimento',
              code: (cat as any)?.code ?? null,
              price: Number(p.price) || 0,
            };
          })}
        onCompleted={() => {
          setShowPaymentDialog(false);
          setShowSummary(true);
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
        }}
      />
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