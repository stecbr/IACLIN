import type { Hypothesis } from '@/components/attendance/HypothesesEditor';
import type { RequestItem, RequestKind } from '@/components/attendance/RequestsEditor';
import type { SoapSession } from '@/components/attendance/SoapSessionForm';
import type { VitalSigns } from '@/components/attendance/VitalSignsForm';

export interface AiPrescription {
  medication: string;
  concentration?: string;
  dosage?: string;
  duration?: string;
  route?: string;
  controlled?: boolean;
  notes?: string;
}

export interface AiAttendanceResult {
  transcript?: string;
  summary?: string;
  chief_complaint?: string;
  history_present_illness?: string;
  symptom_duration_value?: string;
  symptom_duration_unit?: string;
  physical_exam?: string;
  hypotheses?: Array<{ text: string; cid10?: string | null }>;
  diagnosis?: string;
  severity?: string;
  treatment_plan?: string;
  follow_up_reason?: string;
  prescriptions?: AiPrescription[];
  requests?: Partial<Record<RequestKind, Record<string, string>>>;
  soap?: SoapSession;
  anamnesis?: Record<string, unknown>;
  vital_signs?: VitalSigns;
  procedures_mentioned?: Array<{ name: string; price?: number }>;
}

export interface AttendanceSetters {
  setChiefComplaint: (v: string) => void;
  setHpi: (v: string) => void;
  setDurationValue: (v: string) => void;
  setDurationUnit: (v: string) => void;
  setPhysicalExam: (v: string) => void;
  setHypotheses: (h: Hypothesis[]) => void;
  setDiagnosis: (v: string) => void;
  setSeverity: (v: string) => void;
  setTreatmentPlan: (v: string) => void;
  setFollowUpReason: (v: string) => void;
  setRequests: (updater: (prev: RequestItem[]) => RequestItem[]) => void;
  setSoap: (s: SoapSession) => void;
  setClinicalNotes: (v: string) => void;
  setVitalSigns?: (v: VitalSigns) => void;
  addManualProcedure?: (name: string, price: number) => void;
}

function nonEmpty(s?: string | null) {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Distribui o resultado da IA nos campos já existentes do atendimento.
 * Não cria novas estruturas — apenas alimenta os setters do <Attendance/>.
 */
export function applyAiResultToAttendance(result: AiAttendanceResult, setters: AttendanceSetters) {
  if (nonEmpty(result.chief_complaint)) setters.setChiefComplaint(result.chief_complaint!);
  if (nonEmpty(result.history_present_illness)) setters.setHpi(result.history_present_illness!);
  if (nonEmpty(result.symptom_duration_value)) setters.setDurationValue(result.symptom_duration_value!);
  if (nonEmpty(result.symptom_duration_unit)) setters.setDurationUnit(result.symptom_duration_unit!);
  if (nonEmpty(result.physical_exam)) setters.setPhysicalExam(result.physical_exam!);
  if (Array.isArray(result.hypotheses) && result.hypotheses.length) {
    setters.setHypotheses(
      result.hypotheses
        .filter((h) => nonEmpty(h?.text))
        .map((h) => ({ id: crypto.randomUUID(), text: h.text, cid10: h.cid10 ?? '' })),
    );
  }
  if (nonEmpty(result.diagnosis)) setters.setDiagnosis(result.diagnosis!);
  if (nonEmpty(result.severity)) setters.setSeverity(result.severity!);
  if (nonEmpty(result.treatment_plan)) setters.setTreatmentPlan(result.treatment_plan!);
  if (nonEmpty(result.follow_up_reason)) setters.setFollowUpReason(result.follow_up_reason!);
  if (result.soap) setters.setSoap({ ...result.soap });
  if (nonEmpty(result.summary)) {
    // O resumo vai para "Evolução / Anotações" — não sobrescreve, faz append se já houver texto.
    setters.setClinicalNotes(result.summary!);
  }

  // Structured prescriptions from recording → each becomes a RequestItem with kind='prescription'
  if (Array.isArray(result.prescriptions) && result.prescriptions.length > 0) {
    const presReqs: RequestItem[] = result.prescriptions
      .filter((p) => nonEmpty(p.medication))
      .map((p) => ({
        id: crypto.randomUUID(),
        kind: 'prescription' as RequestKind,
        payload: {
          medication:    p.medication || '',
          concentration: p.concentration || '',
          dosage:        p.dosage || '',
          duration:      p.duration || '',
          route:         p.route || 'oral',
          type:          p.controlled ? 'controlled' : 'common',
        },
      }));
    if (presReqs.length) setters.setRequests((prev) => [...prev, ...presReqs]);
  }

  if (result.requests) {
    const newReqs: RequestItem[] = [];
    (Object.entries(result.requests) as Array<[RequestKind, Record<string, string>]>).forEach(([kind, payload]) => {
      if (payload && Object.values(payload).some((v) => nonEmpty(String(v ?? '')))) {
        newReqs.push({ id: crypto.randomUUID(), kind, payload });
      }
    });
    if (newReqs.length) setters.setRequests((prev) => [...prev, ...newReqs]);
  }

  // Vital signs — only apply fields that were actually extracted (non-empty strings)
  if (result.vital_signs && setters.setVitalSigns) {
    const vs = result.vital_signs;
    const hasAny = Object.values(vs).some((v) => nonEmpty(String(v ?? '')));
    if (hasAny) setters.setVitalSigns(vs);
  }

  // Procedures — add each as a manual entry; doctor adjusts price/name before saving
  if (Array.isArray(result.procedures_mentioned) && result.procedures_mentioned.length > 0 && setters.addManualProcedure) {
    for (const p of result.procedures_mentioned) {
      if (nonEmpty(p.name)) {
        setters.addManualProcedure(p.name, p.price ?? 0);
      }
    }
  }
}