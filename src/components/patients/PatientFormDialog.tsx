import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { syncOnePatient } from '@/hooks/useAiSync';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, X } from 'lucide-react';
import { CitySelect } from '@/components/address/CitySelect';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserCheck, Send } from 'lucide-react';

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  patient?: any;
  clinicId?: string | null;
  initialName?: string;
  onPatientCreated?: (id: string, name: string) => void;
}

const REFERRAL_SOURCES = [
  'Busca no Google',
  'Redes sociais',
  'Indicação de amigo ou familiar',
  'Indicação de profissional',
  'Plano de saúde',
  'Outdoor / Anúncio',
  'Outro',
];

function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  return check2 === parseInt(digits[10]);
}

const PREDEFINED_CATEGORIES = [
  'VIP', 'Convênio', 'Particular', 'Criança', 'Idoso',
  'Gestante', 'Risco', 'Recall', 'Inativo',
];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const emptyForm = (patient?: any, initialName?: string) => ({
  full_name: patient?.full_name ?? initialName ?? '',
  cpf: patient?.cpf ?? '',
  rg: patient?.rg ?? '',
  phone: patient?.phone ?? '',
  landline: patient?.landline ?? '',
  email: patient?.email ?? '',
  date_of_birth: patient?.date_of_birth ?? '',
  gender: patient?.gender ?? '',
  is_foreign: patient?.is_foreign ?? false,
  profession: patient?.profession ?? '',
  referral_source: patient?.referral_source ?? '',
  notes: patient?.notes ?? '',
  photo_url: patient?.photo_url ?? '',
  categories: (patient?.categories ?? []) as string[],
  sms_reminders: patient?.sms_reminders ?? true,
  // Address
  zip_code: patient?.zip_code ?? '',
  address: patient?.address ?? '',
  address_complement: patient?.address_complement ?? '',
  neighborhood: patient?.neighborhood ?? '',
  city: patient?.city ?? '',
  state: patient?.state ?? '',
  // Emergency contact
  emergency_contact_name: patient?.emergency_contact_name ?? '',
  emergency_contact_phone: patient?.emergency_contact_phone ?? '',
  // Guardian
  guardian_name: patient?.guardian_name ?? '',
  guardian_cpf: patient?.guardian_cpf ?? '',
  guardian_date_of_birth: patient?.guardian_date_of_birth ?? '',
  // Insurance
  insurance_provider: patient?.insurance_provider ?? '',
  insurance_holder: patient?.insurance_holder ?? '',
  insurance_number: patient?.insurance_number ?? '',
  insurance_holder_cpf: patient?.insurance_holder_cpf ?? '',
});

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
      <Separator className="mb-4" />
    </div>
  );
}

function PhoneInput({
  value, onChange, placeholder, id,
}: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  return (
    <div className="flex">
      <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-xs text-muted-foreground whitespace-nowrap">
        🇧🇷 +55
      </span>
      <Input
        id={id}
        className="rounded-l-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '(11) 99999-9999'}
        inputMode="tel"
      />
    </div>
  );
}

export function PatientFormDialog({
  open, onOpenChange, onSuccess, patient, clinicId, initialName, onPatientCreated,
}: PatientFormDialogProps) {
  const isEdit = !!patient;
  const { user, isPersonalMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => emptyForm(patient, initialName));
  const [newCategory, setNewCategory] = useState('');
  const [cpfCheckState, setCpfCheckState] = useState<
    | { status: 'idle' | 'checking' }
    | { status: 'available' }
    | { status: 'exists' }
    | { status: 'already_pending' }
    | { status: 'already_linked' }
  >({ status: 'idle' });
  const [requestingLink, setRequestingLink] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Check CPF whenever it changes (debounced)
  useEffect(() => {
    if (isEdit) return;
    const clean = (form.cpf || '').replace(/\D/g, '');
    if (clean.length !== 11 || !isValidCPF(clean)) {
      setCpfCheckState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setCpfCheckState({ status: 'checking' });
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('request-patient-link', {
        body: { cpf: clean, clinic_id: clinicId, mode: 'check' },
      });
      if (cancelled) return;
      if (error) { setCpfCheckState({ status: 'idle' }); return; }
      if (data?.exists) setCpfCheckState({ status: 'exists' });
      else setCpfCheckState({ status: 'available' });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.cpf, clinicId, isEdit]);

  const requestLink = async () => {
    setRequestingLink(true);
    try {
      const clean = form.cpf.replace(/\D/g, '');
      const { data, error } = await supabase.functions.invoke('request-patient-link', {
        body: { cpf: clean, clinic_id: clinicId, mode: 'create' },
      });
      if (error) throw error;
      if (data?.already_linked) {
        toast.info('Este paciente já está vinculado.');
      } else if (data?.already_pending) {
        setCpfCheckState({ status: 'already_pending' });
        toast.info('Já existe uma solicitação pendente para este paciente.');
      } else {
        setCpfCheckState({ status: 'already_pending' });
        toast.success('Solicitação enviada! O paciente tem 24h para aceitar.');
      }
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRequestingLink(false);
    }
  };

  const sendInvite = async () => {
    if (!form.email) { toast.error('Informe um e-mail para enviar o convite'); return; }
    setSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-new-patient', {
        body: {
          full_name: form.full_name,
          email: form.email,
          cpf: form.cpf,
          phone: form.phone,
          clinic_id: clinicId,
        },
      });
      if (error) throw error;
      toast.success('Convite enviado por e-mail.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingInvite(false);
    }
  };

  useEffect(() => {
    if (open) setForm(emptyForm(patient, initialName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: insurancePlans = [] } = useQuery({
    queryKey: ['insurance-plans-select', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', clinicId!)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
    enabled: open && !!clinicId,
  });

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const addCustomCategory = () => {
    const cat = newCategory.trim();
    if (!cat || form.categories.includes(cat)) { setNewCategory(''); return; }
    setForm((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
    setNewCategory('');
  };

  const handleCepBlur = async () => {
    const clean = form.zip_code.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address: data.logradouro || prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      toast.error('Não foi possível buscar o CEP. Verifique o número e tente novamente.');
    } finally {
      setFetchingCep(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `patients/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('patient-files')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('patient-files').getPublicUrl(path);
      update('photo_url', publicUrl);
      toast.success('Foto enviada!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (form.cpf && !form.is_foreign && !isValidCPF(form.cpf)) {
      toast.error('CPF inválido. Verifique os dígitos informados.');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        full_name: form.full_name.trim(),
        cpf: form.cpf || null,
        rg: form.rg || null,
        phone: form.phone || null,
        landline: form.landline || null,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        is_foreign: form.is_foreign,
        profession: form.profession || null,
        referral_source: form.referral_source || null,
        notes: form.notes || null,
        photo_url: form.photo_url || null,
        categories: form.categories.length > 0 ? form.categories : null,
        sms_reminders: form.sms_reminders,
        zip_code: form.zip_code || null,
        address: form.address || null,
        address_complement: form.address_complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        guardian_name: form.guardian_name || null,
        guardian_cpf: form.guardian_cpf || null,
        guardian_date_of_birth: form.guardian_date_of_birth || null,
        insurance_provider: form.insurance_provider || null,
        insurance_holder: form.insurance_holder || null,
        insurance_number: form.insurance_number || null,
        insurance_holder_cpf: form.insurance_holder_cpf || null,
      };

      if (isEdit) {
        const { error } = await supabase.from('patients').update(payload).eq('id', patient.id);
        if (error) throw error;
        toast.success('Paciente atualizado!');
        if (clinicId) syncOnePatient(patient.id, clinicId);
      } else {
        const insertPayload: any = { ...payload, clinic_id: clinicId ?? null };
        if (!clinicId && user?.id) insertPayload.dentist_id = user.id;
        const { data: inserted, error } = await supabase
          .from('patients')
          .insert(insertPayload)
          .select('id')
          .single();
        if (error) throw error;
        toast.success(isPersonalMode ? 'Paciente pessoal cadastrado!' : 'Paciente cadastrado!');
        if (clinicId && inserted?.id) syncOnePatient(inserted.id, clinicId);
        if (inserted?.id) onPatientCreated?.(inserted.id, form.full_name);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ─── Foto ─── */}
          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => photoInputRef.current?.click()}
            >
              <Avatar className="h-20 w-20 border-2 border-border">
                {form.photo_url && <AvatarImage src={form.photo_url} alt="Foto" className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {form.full_name
                    ? form.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              {uploadingPhoto && (
                <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Foto do paciente</p>
              <p className="text-xs text-muted-foreground mt-0.5">Clique para adicionar ou alterar</p>
              <Button
                type="button" variant="outline" size="sm" className="mt-2 gap-2"
                onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
              >
                <Camera className="h-3.5 w-3.5" />
                {form.photo_url ? 'Alterar foto' : 'Adicionar foto'}
              </Button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {/* ─── Dados Pessoais ─── */}
          <SectionHeader title="Dados pessoais" />

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label>Celular</Label>
              <PhoneInput value={form.phone} onChange={(v) => update('phone', v)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Lembretes automáticos</Label>
                <Switch
                  checked={form.sms_reminders}
                  onCheckedChange={(v) => update('sms_reminders', v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Notificações de consulta por SMS/WhatsApp</p>
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Telefone fixo</Label>
              <PhoneInput value={form.landline} onChange={(v) => update('landline', v)} placeholder="(11) 3333-4444" />
            </div>

            <div className="space-y-1.5">
              <Label>Como conheceu a clínica</Label>
              <Select value={form.referral_source} onValueChange={(v) => update('referral_source', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {REFERRAL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input
                value={form.profession}
                onChange={(e) => update('profession', e.target.value)}
                placeholder="Ex: Engenheiro, Professor…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Paciente estrangeiro</Label>
                <Switch
                  checked={form.is_foreign}
                  onCheckedChange={(v) => update('is_foreign', v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Desativa obrigatoriedade do CPF</p>
            </div>

            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>CPF{form.is_foreign ? ' (opcional)' : ''}</Label>
              <Input
                value={form.cpf}
                onChange={(e) => update('cpf', e.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
              {!isEdit && cpfCheckState.status === 'checking' && (
                <p className="text-xs text-muted-foreground">Verificando CPF…</p>
              )}
              {!isEdit && cpfCheckState.status === 'exists' && (
                <Alert className="mt-2 border-primary/40 bg-primary/5">
                  <UserCheck className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Este CPF já possui conta na iClin. Envie uma solicitação de vinculação —
                    o paciente precisa aprovar para aparecer na sua lista.
                  </AlertDescription>
                </Alert>
              )}
              {!isEdit && cpfCheckState.status === 'already_pending' && (
                <Alert className="mt-2">
                  <AlertDescription className="text-xs">
                    Solicitação enviada. Aguardando resposta do paciente (24h).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>RG</Label>
              <Input
                value={form.rg}
                onChange={(e) => update('rg', e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Adicione observações sobre o paciente"
                rows={3}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Categorias</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat}
                    variant={form.categories.includes(cat) ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
              {form.categories.filter((c) => !PREDEFINED_CATEGORIES.includes(c)).map((cat) => (
                <Badge key={cat} variant="secondary" className="gap-1 mr-1">
                  {cat}
                  <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => toggleCategory(cat)} />
                </Badge>
              ))}
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Nova categoria…"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }}
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomCategory} className="h-8 px-3 text-xs">
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* ─── Contato de Emergência ─── */}
          <SectionHeader title="Contato de emergência" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.emergency_contact_name}
                onChange={(e) => update('emergency_contact_name', e.target.value)}
                placeholder="Nome do contato"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <PhoneInput
                value={form.emergency_contact_phone}
                onChange={(v) => update('emergency_contact_phone', v)}
              />
            </div>
          </div>

          {/* ─── Endereço ─── */}
          <SectionHeader title="Endereço" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input
                value={form.zip_code}
                onChange={(e) => update('zip_code', e.target.value)}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
              />
              {fetchingCep && <p className="text-xs text-muted-foreground">Buscando CEP…</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => update('neighborhood', e.target.value)}
                placeholder="Bairro"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Endereço com número</Label>
              <Input
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Rua, Av… e número"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Complemento</Label>
              <Input
                value={form.address_complement}
                onChange={(e) => update('address_complement', e.target.value)}
                placeholder="Apto, Bloco, Casa…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <CitySelect
                uf={form.state}
                value={form.city}
                onChange={(city, uf) => {
                  update('city', city);
                  if (uf) update('state', uf);
                }}
                placeholder={form.state ? 'Selecione…' : 'UF primeiro'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.state} onValueChange={(v) => update('state', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── Responsável ─── */}
          <SectionHeader title="Responsável" />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do responsável</Label>
              <Input
                value={form.guardian_name}
                onChange={(e) => update('guardian_name', e.target.value)}
                placeholder="Nome completo do responsável"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF do responsável</Label>
              <Input
                value={form.guardian_cpf}
                onChange={(e) => update('guardian_cpf', e.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.guardian_date_of_birth}
                onChange={(e) => update('guardian_date_of_birth', e.target.value)}
              />
            </div>
          </div>

          {/* ─── Dados do Convênio ─── */}
          <SectionHeader title="Dados do convênio" />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Convênio</Label>
              <Select
                value={form.insurance_provider ? form.insurance_provider : '__none__'}
                onValueChange={(v) => update('insurance_provider', v === '__none__' ? '' : v)}
                disabled={!clinicId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clinicId ? 'Selecione o convênio' : 'Particular'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (Particular)</SelectItem>
                  {insurancePlans.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                  {form.insurance_provider &&
                    !insurancePlans.some((p) => p.name === form.insurance_provider) && (
                      <SelectItem value={form.insurance_provider}>
                        {form.insurance_provider} (atual)
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
              {clinicId && insurancePlans.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum convênio cadastrado. Adicione em Configurações → Convênios.
                </p>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Titular do convênio</Label>
              <Input
                value={form.insurance_holder}
                onChange={(e) => update('insurance_holder', e.target.value)}
                placeholder="Nome do titular (se diferente do paciente)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número da carteirinha</Label>
              <Input
                value={form.insurance_number}
                onChange={(e) => update('insurance_number', e.target.value)}
                placeholder="000000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF do responsável</Label>
              <Input
                value={form.insurance_holder_cpf}
                onChange={(e) => update('insurance_holder_cpf', e.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* ─── Ações ─── */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {!isEdit && cpfCheckState.status === 'exists' && (
              <Button type="button" onClick={requestLink} disabled={requestingLink} className="gap-2">
                <UserCheck className="h-4 w-4" />
                {requestingLink ? 'Enviando…' : 'Solicitar Vinculação ao Paciente'}
              </Button>
            )}
            {!isEdit && cpfCheckState.status === 'already_pending' && (
              <Button type="button" disabled variant="secondary">Solicitação pendente</Button>
            )}
            {(isEdit || cpfCheckState.status !== 'exists') && cpfCheckState.status !== 'already_pending' && (
              <>
                {!isEdit && form.email && cpfCheckState.status === 'available' && (
                  <Button
                    type="button" variant="outline" onClick={sendInvite} disabled={sendingInvite}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendingInvite ? 'Enviando…' : 'Cadastrar + Enviar convite'}
                  </Button>
                )}
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar paciente'}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
