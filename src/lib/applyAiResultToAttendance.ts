import type { Hypothesis } from '@/components/attendance/HypothesesEditor';
import type { RequestItem, RequestKind } from '@/components/attendance/RequestsEditor';
import type { SoapSession } from '@/components/attendance/SoapSessionForm';

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
  requests?: Partial<Record<RequestKind, Record<string, string>>>;
  soap?: SoapSession;
  anamnesis?: Record<string, unknown>;
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

  if (result.requests) {
    const newReqs: RequestItem[] = [];
    (Object.entries(result.requests) as Array<[RequestKind, Record<string, string>]>).forEach(([kind, payload]) => {
      if (payload && Object.values(payload).some((v) => nonEmpty(String(v ?? '')))) {
        newReqs.push({ id: crypto.randomUUID(), kind, payload });
      }
    });
    if (newReqs.length) setters.setRequests((prev) => [...prev, ...newReqs]);
  }
}