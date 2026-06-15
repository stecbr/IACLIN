import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Building2, Check, X, Clock, Ban, Search, Upload, FileText, Info, Landmark, User, Receipt, MapPin, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CitySelect } from '@/components/address/CitySelect';
import { BR_UF_LIST } from '@/lib/brazilCities';

type Operator = {
  id: string;
  name: string;
  ans_code: string | null;
  type: string;
  brand_color: string | null;
  logo_url: string | null;
  created_at: string;
};

type Credentialing = {
  id: string;
  operator_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  rejection_reason: string | null;
  requested_at?: string;
  updated_at?: string;
  notes?: string | null;
};

type ProcedureOption = { id: string; name: string; specialty_category: string };

type EntityType = 'fisica' | 'juridica';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];
type DaySchedule = { enabled: boolean; start: string; end: string };
type WeeklySchedule = Record<DayKey, DaySchedule>;
const DEFAULT_SCHEDULE: WeeklySchedule = {
  mon: { enabled: true, start: '08:00', end: '18:00' },
  tue: { enabled: true, start: '08:00', end: '18:00' },
  wed: { enabled: true, start: '08:00', end: '18:00' },
  thu: { enabled: true, start: '08:00', end: '18:00' },
  fri: { enabled: true, start: '08:00', end: '18:00' },
  sat: { enabled: false, start: '08:00', end: '12:00' },
  sun: { enabled: false, start: '08:00', end: '12:00' },
};

function parseSchedule(raw: any): WeeklySchedule {
  const out: WeeklySchedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  if (!raw) return out;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return out; }
  }
  if (typeof obj !== 'object') return out;
  for (const { key } of DAY_LABELS) {
    const d = obj[key];
    if (d && typeof d === 'object') {
      out[key] = {
        enabled: d.enabled !== false && (d.enabled === true || !!d.start || !!d.open),
        start: d.start ?? d.open ?? out[key].start,
        end: d.end ?? d.close ?? out[key].end,
      };
      if (typeof d.enabled === 'boolean') out[key].enabled = d.enabled;
    }
  }
  return out;
}

function scheduleToText(s: WeeklySchedule): string {
  return DAY_LABELS
    .map(({ key, label }) => {
      const d = s[key];
      return d.enabled ? `${label}: ${d.start} - ${d.end}` : `${label}: Fechado`;
    })
    .join('\n');
}

const PF_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'cro_dentista', label: 'CRO/CRM do profissional' },
  { type: 'alvara', label: 'Alvará de funcionamento' },
  { type: 'licenca_sanitaria', label: 'Licença sanitária' },
  { type: 'cnes_doc', label: 'Comprovante CNES' },
  { type: 'fotos_clinica', label: 'Fotos da clínica' },
  { type: 'especializacao', label: 'Certificado de especialização' },
];
const PJ_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'cartao_cnpj', label: 'Cartão CNPJ' },
  { type: 'contrato_social', label: 'Contrato Social ou Requerimento Empresarial' },
  { type: 'cro_clinica', label: 'CRO/CRM da clínica (responsável técnico)' },
  { type: 'alvara', label: 'Alvará de funcionamento' },
  { type: 'licenca_sanitaria', label: 'Licença sanitária' },
  { type: 'cnes_doc', label: 'Comprovante CNES' },
  { type: 'fotos_clinica', label: 'Fotos da clínica' },
  { type: 'especializacao', label: 'Certificado de especialização' },
];

type CredentialingPayload = {
  invite?: {
    token?: string | null;
    source?: 'operator-link' | 'marketplace';
  };
  clinic: {
    name: string;
    cnpj: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    responsible_name: string;
    photos: string[];
    business_hours: string;
  };
  requested_procedures: Array<{ id: string; name: string }>;
  terms: {
    accepted_at: string;
  };
};

const statusMap: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: 'Pendente', icon: Clock, cls: 'bg-warning/15 text-warning border-warning/30' },
  approved: { label: 'Credenciado', icon: Check, cls: 'bg-success/15 text-success border-success/30' },
  rejected: { label: 'Recusado', icon: X, cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  revoked: { label: 'Revogado', icon: Ban, cls: 'bg-muted text-muted-foreground border-border' },
};

export default function MyCredentialingSection() {
  const { user, currentClinicId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [creds, setCreds] = useState<Credentialing[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyOp, setBusyOp] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<Operator | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [addressFromSettings, setAddressFromSettings] = useState(false);

  const [fullName, setFullName] = useState('');
  const [professionalPhone, setProfessionalPhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicCnpj, setClinicCnpj] = useState('');
  const [clinicCpf, setClinicCpf] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicAddressNumber, setClinicAddressNumber] = useState('');
  const [clinicAddressComplement, setClinicAddressComplement] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicState, setClinicState] = useState('');
  const [clinicZip, setClinicZip] = useState('');
  const [clinicResponsible, setClinicResponsible] = useState('');
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Documentação e dados bancários para o credenciamento
  const [entityType, setEntityType] = useState<EntityType>('juridica');
  const [stateRegistration, setStateRegistration] = useState('');
  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [cnes, setCnes] = useState('');
  const [specialtyCertificate, setSpecialtyCertificate] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountType, setBankAccountType] = useState<'corrente' | 'poupanca'>('corrente');
  const [bankHolderDocument, setBankHolderDocument] = useState('');
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});

  const invitedOperatorId = searchParams.get('cred_op');
  const inviteToken = searchParams.get('invite');

  // Lista de procedimentos da operadora (tabela de valores publicada)
  type OperatorProc = { id: string; name: string; category: string; tuss_code: string | null; value_brl: number };
  const [procSource, setProcSource] = useState<'clinic' | 'operator'>('clinic');
  const [operatorProcs, setOperatorProcs] = useState<OperatorProc[]>([]);
  const [operatorTableLabel, setOperatorTableLabel] = useState<string | null>(null);
  const [loadingOperatorProcs, setLoadingOperatorProcs] = useState(false);
  const [selectedOperatorProcIds, setSelectedOperatorProcIds] = useState<string[]>([]);

  // Carrega a tabela vigente da operadora ao abrir o dossiê
  useEffect(() => {
    if (!openFor) {
      setOperatorProcs([]);
      setOperatorTableLabel(null);
      setSelectedOperatorProcIds([]);
      setProcSource('clinic');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOperatorProcs(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: tables } = await supabase
          .from('operator_price_tables')
          .select('id, name, state, valid_from, valid_until')
          .eq('operator_id', openFor.id)
          .lte('valid_from', today);
        const vigent = (tables ?? []).filter((t: any) => t.valid_until == null || t.valid_until >= today);
        const uf = (clinicState ?? '').toUpperCase();
        const picked =
          vigent.find((t: any) => (t.state ?? '').toUpperCase() === uf && uf.length > 0) ??
          vigent.find((t: any) => !t.state) ??
          vigent[0] ?? null;
        if (!picked) {
          if (!cancelled) {
            setOperatorProcs([]);
            setOperatorTableLabel(null);
          }
          return;
        }
        const { data: items } = await supabase
          .from('operator_price_items')
          .select('id, procedure_name, category, tuss_code, value_brl, sort_order')
          .eq('table_id', picked.id)
          .order('category')
          .order('sort_order')
          .order('procedure_name');
        if (cancelled) return;
        setOperatorTableLabel(`${picked.name}${picked.state ? ` · ${picked.state}` : ' · Nacional'}`);
        setOperatorProcs(
          (items ?? []).map((it: any) => ({
            id: String(it.id),
            name: String(it.procedure_name),
            category: String(it.category ?? 'Geral'),
            tuss_code: it.tuss_code ?? null,
            value_brl: Number(it.value_brl ?? 0),
          })),
        );
      } finally {
        if (!cancelled) setLoadingOperatorProcs(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFor?.id, clinicState]);

  const load = async () => {
    if (!user || !currentClinicId) return;
    setLoading(true);
    try {
      const [{ data: member }, { data: profile }, { data: clinic }] = await Promise.all([
        supabase
          .from('clinic_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('clinic_id', currentClinicId)
          .maybeSingle(),
        supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
        supabase.from('clinics').select('name, cnpj, cpf, entity_type, address, city, state, zip_code, responsible_name, business_hours, logo_url').eq('id', currentClinicId).maybeSingle(),
      ]);

      const mId = (member as any)?.id ?? null;
      setMemberId(mId);

      setFullName((profile as any)?.full_name ?? '');
      setProfessionalPhone((profile as any)?.phone ?? '');

      setClinicName((clinic as any)?.name ?? '');
      setClinicCnpj((clinic as any)?.cnpj ?? '');
      setClinicCpf((clinic as any)?.cpf ?? '');
      const addr = (clinic as any)?.address ?? '';
      const city = (clinic as any)?.city ?? '';
      const state = (clinic as any)?.state ?? '';
      const zip = (clinic as any)?.zip_code ?? '';
      setClinicAddress(addr);
      setClinicAddressNumber((clinic as any)?.address_number ?? '');
      setClinicAddressComplement((clinic as any)?.address_complement ?? '');
      setClinicCity(city);
      setClinicState(state);
      setClinicZip(zip);
      setClinicResponsible((clinic as any)?.responsible_name ?? '');
      setAddressFromSettings(!!(addr || city || state || zip));
      setSchedule(parseSchedule((clinic as any)?.business_hours));
      // Detecção inteligente PF/PJ. Mesmo que o registro tenha entity_type='juridica'
      // legado, se não houver CNPJ tratamos como PF (caso usuário corrija em Configurações).
      const rawEt = (clinic as any)?.entity_type as EntityType | null | undefined;
      const hasCnpj = !!(clinic as any)?.cnpj;
      const hasCpf = !!(clinic as any)?.cpf;
      const et: EntityType =
        rawEt === 'fisica' || (rawEt === 'juridica' && hasCnpj)
          ? rawEt
          : hasCpf && !hasCnpj
          ? 'fisica'
          : hasCnpj
          ? 'juridica'
          : 'fisica';
      setEntityType(et);

      const [{ data: ops, error: opsError }, { data: cds, error: cdsError }, { data: procData, error: procError }] = await Promise.all([
        supabase.from('insurance_operators').select('id, name, ans_code, type, brand_color, logo_url, created_at').eq('is_active', true).order('name'),
        currentClinicId
          ? supabase
              .from('operator_credentialings')
              .select('id, operator_id, status, rejection_reason, notes, requested_at, updated_at')
              .eq('clinic_id', currentClinicId)
          : Promise.resolve({ data: [], error: null } as any),
        currentClinicId
          ? supabase.from('procedures').select('id, name, specialty_category').eq('is_active', true).eq('clinic_id', currentClinicId).order('name')
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (opsError || cdsError || procError) {
        throw new Error(opsError?.message || cdsError?.message || procError?.message || 'Falha ao carregar dados de credenciamento');
      }

      setOperators((ops as any) ?? []);
      setCreds((cds as any) ?? []);
      setProcedures((procData as any) ?? []);
    } catch (e: any) {
      setOperators([]);
      setCreds([]);
      setProcedures([]);
      toast.error(`Erro ao carregar credenciamentos: ${e?.message ?? 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, currentClinicId]);

  const byOp = useMemo(() => {
    const map = new Map<string, Credentialing>();
    creds.forEach((c) => {
      const prev = map.get(c.operator_id);
      if (!prev) {
        map.set(c.operator_id, c);
        return;
      }
      const prevTs = new Date(prev.requested_at ?? prev.updated_at ?? 0).getTime();
      const currTs = new Date(c.requested_at ?? c.updated_at ?? 0).getTime();
      if (currTs >= prevTs) map.set(c.operator_id, c);
    });
    return map;
  }, [creds]);

  const filtered = operators.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!invitedOperatorId || operators.length === 0) return;
    const target = operators.find((op) => op.id === invitedOperatorId);
    if (target) {
      setOpenFor(target);
      toast.info(`Convite detectado para ${target.name}. Complete o dossiê para enviar o pedido.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedOperatorId, operators.length]);

  const selectedProcedureList = useMemo(
    () => procedures.filter((p) => selectedProcedureIds.includes(p.id)),
    [procedures, selectedProcedureIds],
  );

  const uploadCredentialingFile = async (file: File, type: 'professional' | 'clinic') => {
    if (!user || !currentClinicId) return null;
    const ext = file.name.split('.').pop();
    const path = `credentialing/${currentClinicId}/${user.id}/${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from('clinic-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const submitCredentialing = async () => {
    if (!openFor || !user || !currentClinicId || !memberId) return;
    if (!fullName.trim()) {
      toast.error('Informe o responsável pela solicitação da clínica.');
      return;
    }
    if (!clinicAddress.trim() || !clinicCity.trim() || !clinicState.trim()) {
      toast.error('Preencha o endereço completo da clínica.');
      return;
    }
    if (selectedProcedureIds.length === 0) {
      toast.error('Selecione ao menos um procedimento para esta operadora.');
      return;
    }
    if (!acceptTerms) {
      toast.error('Você precisa confirmar a veracidade das informações do dossiê.');
      return;
    }

    setSubmittingRequest(true);
    try {
      // Upload de documentos do kit credenciamento
      const uploadedDocs: Array<{ doc_type: string; file_name: string; url: string }> = [];
      for (const [docType, files] of Object.entries(docFiles)) {
        for (const file of files) {
          try {
            const url = await uploadCredentialingFile(file, 'clinic');
            if (url) uploadedDocs.push({ doc_type: docType, file_name: file.name, url });
          } catch {
            // ignore individual upload failure
          }
        }
      }

      const payload: CredentialingPayload = {
        invite: {
          token: inviteToken,
          source: inviteToken ? 'operator-link' : 'marketplace',
        },
        clinic: {
          name: clinicName.trim(),
          cnpj: entityType === 'juridica' ? clinicCnpj.trim() : '',
          address: [clinicAddress.trim(), clinicAddressNumber.trim()].filter(Boolean).join(', '),
          city: clinicCity.trim(),
          state: clinicState.trim(),
          zip_code: clinicZip.trim(),
          responsible_name: clinicResponsible.trim(),
          photos: [],
          business_hours: scheduleToText(schedule),
        },
        clinic_extras: ({
          entity_type: entityType,
          cpf: entityType === 'fisica' ? clinicCpf.trim() : '',
          schedule,
        }) as any,
        contact: ({
          responsible_name: fullName.trim(),
          phone: professionalPhone.trim(),
          email: user.email ?? '',
        }) as any,
        requested_procedures: selectedProcedureList.map((p) => ({ id: p.id, name: p.name })),
        terms: {
          accepted_at: new Date().toISOString(),
        },
        documentation: {
          entity_type: entityType,
          state_registration: stateRegistration.trim() || null,
          municipal_registration: municipalRegistration.trim() || null,
          cnes: cnes.trim() || null,
          specialty_certificate: specialtyCertificate.trim() || null,
          files: uploadedDocs,
        },
        banking: {
          bank_name: bankName.trim() || null,
          agency: bankAgency.trim() || null,
          account: bankAccount.trim() || null,
          account_type: bankAccount.trim() ? bankAccountType : null,
          holder_document: bankHolderDocument.replace(/\D/g, '') || null,
        },
      } as any;

      const existing = byOp.get(openFor.id);
      let error: any = null;

      if (existing) {
        const res = await supabase
          .from('operator_credentialings')
          .update({
            status: 'pending',
            rejection_reason: null,
            decided_at: null,
            decided_by: null,
            requested_at: new Date().toISOString(),
            notes: JSON.stringify(payload),
          } as any)
          .eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('operator_credentialings').insert({
          operator_id: openFor.id,
          clinic_id: currentClinicId,
          clinic_member_id: memberId,
          professional_user_id: user.id,
          requested_by: user.id,
          status: 'pending',
          notes: JSON.stringify(payload),
        } as any);
        error = res.error;
      }

      if (error) throw error;

      toast.success(`Pedido enviado para ${openFor.name}`);
      setOpenFor(null);
      setAcceptTerms(false);
      setSelectedProcedureIds([]);
      setDocFiles({});
      await load();
    } catch (e: any) {
      toast.error(`Erro ao enviar pedido: ${e.message ?? 'erro desconhecido'}`);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const cancel = async (cred: Credentialing, opName: string) => {
    setBusyOp(cred.operator_id);
    const { error } = await supabase
      .from('operator_credentialings')
      .update({
        status: 'revoked',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        rejection_reason: 'Cancelado pela clínica',
      } as any)
      .eq('operator_id', cred.operator_id)
      .eq('clinic_id', currentClinicId);
    setBusyOp(null);
    if (error) return toast.error('Erro: ' + error.message);
    await load();
    toast.success(`Credenciamento com ${opName} cancelado`);
  };

  if (!currentClinicId) {
    return (
      <Card><CardContent className="p-8 text-sm text-muted-foreground">Selecione uma clínica para gerenciar credenciamentos.</CardContent></Card>
    );
  }

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Credenciamentos da clínica</CardTitle>
        <CardDescription>
          Solicite credenciamento da clínica junto às operadoras. Após aprovado, os profissionais vinculados à clínica atendem pela operadora credenciada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar operadora..." className="pl-9" />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma operadora encontrada.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((op) => {
              const cred = byOp.get(op.id);
              const st = cred ? statusMap[cred.status] : null;
              const Icon = st?.icon;
              const yearsInMarket = Math.max(1, new Date().getFullYear() - new Date(op.created_at).getFullYear());
              return (
                <div key={op.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (op.brand_color ?? '#6B7280') + '20', color: op.brand_color ?? '#6B7280' }}
                  >
                    {op.logo_url ? <img src={op.logo_url} alt={op.name} className="h-7 w-7 object-contain" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{op.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {op.ans_code ? `ANS ${op.ans_code}` : 'Sem código ANS'} · {op.type === 'medico' ? 'Médica' : op.type === 'odonto' ? 'Odontológica' : 'Médica e odontológica'}
                    </p>
                    <div className="mt-1 rounded-md bg-muted/40 border border-border/60 px-2 py-1.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Briefing: {yearsInMarket} anos de mercado, fluxo digital de validação e pagamento conforme tabela contratual da rede.
                      </p>
                    </div>
                    {cred?.status === 'rejected' && cred.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">Motivo: {cred.rejection_reason}</p>
                    )}
                    {invitedOperatorId === op.id && (
                      <p className="text-xs text-primary mt-1">Convite recebido por link da operadora.</p>
                    )}
                  </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[220px]">
                      {st && Icon && (
                        <Badge variant="outline" className={`gap-1 w-fit md:self-end ${st.cls}`}>
                          <Icon className="h-3 w-3" /> {st.label}
                        </Badge>
                      )}
                      {!cred && (
                        <Button size="sm" variant="outline" className="w-full md:w-auto" disabled={busyOp === op.id || !memberId} onClick={() => setOpenFor(op)}>
                          Solicitar credenciamento
                        </Button>
                      )}
                      {cred?.status === 'pending' && (
                        <Button size="sm" variant="ghost" className="w-full md:w-auto" disabled={busyOp === op.id} onClick={() => cancel(cred, op.name)}>
                          Cancelar
                        </Button>
                      )}
                      {cred?.status === 'approved' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full md:w-auto gap-1"
                            onClick={() => navigate(`/clinica/convenios?operator=${op.id}`)}
                          >
                            <Receipt className="h-3.5 w-3.5" /> Ver tabela de valores
                          </Button>
                          <Button size="sm" variant="destructive" className="w-full md:w-auto" disabled={busyOp === op.id} onClick={() => cancel(cred, op.name)}>
                            Cancelar credenciamento
                          </Button>
                        </>
                      )}
                      {(cred?.status === 'rejected' || cred?.status === 'revoked') && (
                        <Button size="sm" variant="outline" className="w-full md:w-auto" disabled={busyOp === op.id} onClick={() => setOpenFor(op)}>
                          Solicitar novamente
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!openFor} onOpenChange={(open) => !open && setOpenFor(null)}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar credenciamento {openFor ? `· ${openFor.name}` : ''}</DialogTitle>
            <DialogDescription>
              Envie um dossiê completo do profissional e da clínica para análise da operadora. Os dados são anexados ao pedido de credenciamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <div className="text-sm font-medium">Resumo da operadora</div>
              <p className="text-xs text-muted-foreground mt-1">
                Esta operadora trabalha com análise documental e validação cadastral antes da aprovação. Defina abaixo exatamente quais procedimentos você deseja atender por este convênio.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Responsável da clínica</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={professionalPhone} onChange={(e) => setProfessionalPhone(e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  Dados da clínica
                  <Badge variant="outline" className="gap-1 font-normal">
                    {entityType === 'fisica' ? <><User className="h-3 w-3" /> Pessoa Física</> : <><Building2 className="h-3 w-3" /> Pessoa Jurídica</>}
                  </Badge>
                </h4>
                {addressFromSettings && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <MapPin className="h-3 w-3" /> Endereço pré-preenchido das configurações
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        const { data: clinic } = await supabase.from('clinics').select('address, address_number, address_complement, city, state, zip_code, responsible_name').eq('id', currentClinicId!).maybeSingle();
                        if (clinic) {
                          setClinicAddress((clinic as any).address ?? '');
                          setClinicAddressNumber((clinic as any).address_number ?? '');
                          setClinicAddressComplement((clinic as any).address_complement ?? '');
                          setClinicCity((clinic as any).city ?? '');
                          setClinicState((clinic as any).state ?? '');
                          setClinicZip((clinic as any).zip_code ?? '');
                          setClinicResponsible((clinic as any).responsible_name ?? '');
                          toast.success('Endereço atualizado das configurações');
                        }
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Sincronizar
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><Label>Nome da clínica</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></div>
                {entityType === 'fisica' ? (
                  <div><Label>CPF</Label><Input value={clinicCpf} onChange={(e) => setClinicCpf(e.target.value)} placeholder="000.000.000-00" /></div>
                ) : (
                  <div><Label>CNPJ</Label><Input value={clinicCnpj} onChange={(e) => setClinicCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
                )}
                <div className="sm:col-span-2"><Label>Logradouro</Label><Input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Rua, Avenida…" /></div>
                <div><Label>Número</Label><Input value={clinicAddressNumber} onChange={(e) => setClinicAddressNumber(e.target.value)} placeholder="123 / S/N" /></div>
                <div className="sm:col-span-2"><Label>Complemento</Label><Input value={clinicAddressComplement} onChange={(e) => setClinicAddressComplement(e.target.value)} placeholder="Sala 101, Bloco A…" /></div>
                <div><Label>CEP</Label><Input value={clinicZip} onChange={(e) => setClinicZip(e.target.value)} /></div>
                <div>
                  <Label>Estado</Label>
                  <Select value={clinicState} onValueChange={(v) => { setClinicState(v); setClinicCity(''); }}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent className="z-[1000]">
                      {BR_UF_LIST.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cidade</Label>
                  <CitySelect
                    uf={clinicState}
                    value={clinicCity}
                    onChange={(city, uf) => { setClinicCity(city); if (uf) setClinicState(uf); }}
                    placeholder={clinicState ? 'Selecione…' : 'UF primeiro'}
                  />
                </div>
                <div className="sm:col-span-3"><Label>Responsável</Label><Input value={clinicResponsible} onChange={(e) => setClinicResponsible(e.target.value)} /></div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Horários de atendimento</Label>
                <div className="mt-2 rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {DAY_LABELS.map(({ key, label }) => {
                    const day = schedule[key];
                    return (
                      <div key={key} className="flex items-center gap-3 px-3 py-2 bg-muted/10">
                        <div className="w-24 text-sm font-medium">{label}</div>
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(v) => setSchedule((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !!v } }))}
                        />
                        {day.enabled ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={day.start}
                              onChange={(e) => setSchedule((prev) => ({ ...prev, [key]: { ...prev[key], start: e.target.value } }))}
                              className="h-8 w-28"
                            />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input
                              type="time"
                              value={day.end}
                              onChange={(e) => setSchedule((prev) => ({ ...prev, [key]: { ...prev[key], end: e.target.value } }))}
                              className="h-8 w-28"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Fechado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Procedimentos para esta operadora</h4>
              <p className="text-xs text-muted-foreground">
                Selecione os procedimentos que você quer atender por este convênio.
                Você pode usar sua lista da clínica ou puxar os procedimentos diretamente da tabela publicada pela operadora.
              </p>
              <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setProcSource('clinic')}
                  className={`px-3 py-1.5 text-xs rounded ${procSource === 'clinic' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >
                  Lista da clínica
                </button>
                <button
                  type="button"
                  onClick={() => setProcSource('operator')}
                  className={`px-3 py-1.5 text-xs rounded ${procSource === 'operator' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >
                  Lista da operadora
                </button>
              </div>

              {procSource === 'clinic' ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                  {procedures.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                      Sua clínica ainda não tem procedimentos cadastrados. Cadastre em Configurações ou alterne para a lista da operadora.
                    </p>
                  ) : (
                    procedures.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                        <Checkbox
                          checked={selectedProcedureIds.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProcedureIds((prev) =>
                              checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                        />
                        <span className="text-sm">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground ml-auto">{p.specialty_category}</span>
                      </label>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {operatorTableLabel && (
                    <p className="text-[11px] text-muted-foreground">
                      Tabela vigente: <span className="font-medium text-foreground">{operatorTableLabel}</span>
                    </p>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                    {loadingOperatorProcs ? (
                      <p className="text-xs text-muted-foreground px-2 py-4 text-center">Carregando lista da operadora...</p>
                    ) : operatorProcs.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                        Esta operadora ainda não publicou uma tabela vigente para o seu estado. Use a lista da clínica.
                      </p>
                    ) : (
                      operatorProcs.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                          <Checkbox
                            checked={selectedOperatorProcIds.includes(p.id)}
                            onCheckedChange={(checked) => {
                              setSelectedOperatorProcIds((prev) =>
                                checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                              );
                            }}
                          />
                          <span className="text-sm flex-1 truncate">{p.name}</span>
                          {p.tuss_code && (
                            <span className="text-[10px] text-muted-foreground">TUSS {p.tuss_code}</span>
                          )}
                          <span className="text-[11px] font-medium ml-2">
                            {p.value_brl > 0
                              ? p.value_brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '—'}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentação ({entityType === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'})
              </h4>
              <p className="text-xs text-muted-foreground">
                Tipo detectado automaticamente conforme o cadastro da sua clínica.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>Inscrição Estadual</Label><Input value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} placeholder="Isento ou número" /></div>
                <div><Label>Inscrição Municipal</Label><Input value={municipalRegistration} onChange={(e) => setMunicipalRegistration(e.target.value)} placeholder="Número" /></div>
                <div><Label>CNES</Label><Input value={cnes} onChange={(e) => setCnes(e.target.value)} placeholder="0000000" /></div>
                <div className="sm:col-span-3"><Label>Certificado de especialização (se houver)</Label><Input value={specialtyCertificate} onChange={(e) => setSpecialtyCertificate(e.target.value)} placeholder="Identificação / número" /></div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 pt-1">
                {(entityType === 'fisica' ? PF_DOC_TYPES : PJ_DOC_TYPES).map((d) => (
                  <div key={d.type} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <Label className="text-xs font-medium">{d.label}</Label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Selecionar arquivo(s)</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (!files.length) return;
                          setDocFiles((prev) => ({ ...prev, [d.type]: [...(prev[d.type] ?? []), ...files] }));
                        }}
                      />
                    </label>
                    {(docFiles[d.type] ?? []).map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                        <span className="truncate">{f.name}</span>
                        <button type="button" className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDocFiles((prev) => ({ ...prev, [d.type]: (prev[d.type] ?? []).filter((_, idx) => idx !== i) }))}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4" /> Dados bancários ({entityType === 'fisica' ? 'PF' : 'PJ'})
              </h4>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>Banco</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banco do Brasil, Itaú..." /></div>
                <div><Label>Agência</Label><Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="0000" /></div>
                <div><Label>Conta</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="00000-0" /></div>
                <div>
                  <Label>Tipo</Label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" size="sm" variant={bankAccountType === 'corrente' ? 'default' : 'outline'} onClick={() => setBankAccountType('corrente')}>Corrente</Button>
                    <Button type="button" size="sm" variant={bankAccountType === 'poupanca' ? 'default' : 'outline'} onClick={() => setBankAccountType('poupanca')}>Poupança</Button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>{entityType === 'fisica' ? 'CPF do titular' : 'CNPJ do titular'}</Label>
                  <Input value={bankHolderDocument} onChange={(e) => setBankHolderDocument(e.target.value)} placeholder={entityType === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'} />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-md border border-border p-3">
              <Checkbox checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(!!checked)} />
              <span className="text-xs text-muted-foreground">
                Declaro que os dados e documentos enviados são verdadeiros e autorizo o compartilhamento com a operadora para análise de credenciamento.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenFor(null)} disabled={submittingRequest}>Cancelar</Button>
            <Button onClick={submitCredentialing} disabled={submittingRequest || !memberId}>
              {submittingRequest ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}