import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { toast } from 'sonner';
import { Building2, Check, X, Clock, Ban, Search, Upload, FileText, Info } from 'lucide-react';

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
  const [memberId, setMemberId] = useState<string | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [creds, setCreds] = useState<Credentialing[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyOp, setBusyOp] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<Operator | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [fullName, setFullName] = useState('');
  const [professionalPhone, setProfessionalPhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicCnpj, setClinicCnpj] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicState, setClinicState] = useState('');
  const [clinicZip, setClinicZip] = useState('');
  const [clinicResponsible, setClinicResponsible] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);
  const [clinicPhotoFiles, setClinicPhotoFiles] = useState<File[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const invitedOperatorId = searchParams.get('cred_op');
  const inviteToken = searchParams.get('invite');

  const load = async () => {
    if (!user || !currentClinicId) return;
    setLoading(true);
    const [{ data: member }, { data: profile }, { data: clinic }, { data: profSpecialties }] = await Promise.all([
      supabase
        .from('clinic_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle(),
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
      supabase.from('clinics').select('name, cnpj, address, city, state, zip_code, responsible_name, business_hours, logo_url').eq('id', currentClinicId).maybeSingle(),
    ]);

    const mId = (member as any)?.id ?? null;
    setMemberId(mId);

    setFullName((profile as any)?.full_name ?? '');
    setProfessionalPhone((profile as any)?.phone ?? '');

    setClinicName((clinic as any)?.name ?? '');
    setClinicCnpj((clinic as any)?.cnpj ?? '');
    setClinicAddress((clinic as any)?.address ?? '');
    setClinicCity((clinic as any)?.city ?? '');
    setClinicState((clinic as any)?.state ?? '');
    setClinicZip((clinic as any)?.zip_code ?? '');
    setClinicResponsible((clinic as any)?.responsible_name ?? '');
    setBusinessHours(JSON.stringify((clinic as any)?.business_hours ?? {}, null, 2));

    const [{ data: ops }, { data: cds }, { data: procData }] = await Promise.all([
      supabase.from('insurance_operators').select('id, name, ans_code, type, brand_color, logo_url, created_at').eq('is_active', true).order('name'),
      currentClinicId
        ? supabase
            .from('operator_credentialings')
            .select('id, operator_id, status, rejection_reason, notes, requested_at, updated_at')
            .eq('clinic_id', currentClinicId)
        : Promise.resolve({ data: [] } as any),
      supabase.from('procedures').select('id, name, specialty_category').eq('is_active', true).order('name'),
    ]);
    setOperators((ops as any) ?? []);
    setCreds((cds as any) ?? []);
    setProcedures((procData as any) ?? []);
    setLoading(false);
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
      const clinicPhotos: string[] = [];
      for (const file of clinicPhotoFiles) {
        const url = await uploadCredentialingFile(file, 'clinic');
        if (url) clinicPhotos.push(url);
      }

      const payload: CredentialingPayload = {
        invite: {
          token: inviteToken,
          source: inviteToken ? 'operator-link' : 'marketplace',
        },
        clinic: {
          name: clinicName.trim(),
          cnpj: clinicCnpj.trim(),
          address: clinicAddress.trim(),
          city: clinicCity.trim(),
          state: clinicState.trim(),
          zip_code: clinicZip.trim(),
          responsible_name: clinicResponsible.trim(),
          photos: clinicPhotos,
          business_hours: businessHours.trim(),
        },
        contact: {
          responsible_name: fullName.trim(),
          phone: professionalPhone.trim(),
          email: user.email ?? '',
        },
        requested_procedures: selectedProcedureList.map((p) => ({ id: p.id, name: p.name })),
        terms: {
          accepted_at: new Date().toISOString(),
        },
      };

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
      setClinicPhotoFiles([]);
      setSelectedProcedureIds([]);
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
    toast.success(`Credenciamento com ${opName} cancelado`);
    load();
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
                        <Button size="sm" variant="destructive" className="w-full md:w-auto" disabled={busyOp === op.id} onClick={() => cancel(cred, op.name)}>
                          Cancelar credenciamento
                        </Button>
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
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
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
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={professionalPhone} onChange={(e) => setProfessionalPhone(e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Dados da clínica</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Nome da clínica</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></div>
                <div><Label>CNPJ</Label><Input value={clinicCnpj} onChange={(e) => setClinicCnpj(e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Endereço completo</Label><Input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={clinicCity} onChange={(e) => setClinicCity(e.target.value)} /></div>
                <div><Label>Estado</Label><Input value={clinicState} onChange={(e) => setClinicState(e.target.value)} /></div>
                <div><Label>CEP</Label><Input value={clinicZip} onChange={(e) => setClinicZip(e.target.value)} /></div>
                <div><Label>Responsável</Label><Input value={clinicResponsible} onChange={(e) => setClinicResponsible(e.target.value)} /></div>
              </div>
              <div>
                <Label>Horários de atendimento</Label>
                <Textarea value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} rows={4} placeholder="Descreva seus horários ou mantenha o JSON padrão" />
              </div>
              <div>
                <Label>Fotos da clínica</Label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-input cursor-pointer hover:bg-muted transition">
                    <FileText className="h-4 w-4" />
                    {clinicPhotoFiles.length > 0 ? `${clinicPhotoFiles.length} arquivo(s)` : 'Selecionar fotos'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={(e) => setClinicPhotoFiles(Array.from(e.target.files ?? []))}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Procedimentos para esta operadora</h4>
              <p className="text-xs text-muted-foreground">Selecione apenas os procedimentos que você quer atender por este convênio.</p>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                {procedures.map((p) => (
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
                ))}
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