import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Stethoscope, Save, Users, Shield, Upload, Camera, Armchair, AlertTriangle, Sparkles, CalendarOff, Wallet, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import TeamSection from '@/components/settings/TeamSection';
import InsurancePlansSection from '@/components/settings/InsurancePlansSection';
import { ClinicHoursSection, type BusinessHours, DEFAULT_HOURS } from '@/components/settings/ClinicHoursSection';
import ClinicRoomsSection from '@/components/settings/ClinicRoomsSection';
import { useSoloMode } from '@/hooks/useSoloMode';
import ProceduresCrudSection from '@/components/settings/ProceduresCrudSection';
import SpecialtySection from '@/components/settings/SpecialtySection';
import SubscriptionSection from '@/components/settings/SubscriptionSection';
import HolidaysSection from '@/components/settings/HolidaysSection';
import PaymentAccountSection from '@/components/settings/PaymentAccountSection';
import { isCatalogSpecialty } from '@/components/SpecialtySelect';
import { aiBackend } from '@/lib/aiBackend';
import { SmartAddressFields } from '@/components/address/SmartAddressFields';

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

const sections = [
  { id: 'clinic', label: 'Clínica', icon: Building2 },
  { id: 'specialty', label: 'Especialidades', icon: Stethoscope },
  { id: 'team', label: 'Equipe', icon: Users },
  { id: 'rooms', label: 'Salas', icon: Armchair },
  { id: 'insurance', label: 'Convênios', icon: Shield },
  { id: 'procedures', label: 'Procedimentos', icon: Stethoscope },
  { id: 'holidays', label: 'Feriados', icon: CalendarOff },
  { id: 'payments', label: 'Recebimentos', icon: Wallet },
  { id: 'subscription', label: 'Assinatura', icon: Sparkles },
];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  // Permite abrir direto numa seção via ?section=insurance (usado pelos cards da IA)
  const initialSection = sections.some((s) => s.id === searchParams.get('section'))
    ? (searchParams.get('section') as string)
    : 'clinic';
  const [activeSection, setActiveSection] = useState(initialSection);
  const { user, currentClinicId, clinicRole } = useAuth();
  const [needsSpecialty, setNeedsSpecialty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !currentClinicId || clinicRole !== 'dentist') {
      setNeedsSpecialty(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      if (cancelled) return;
      const v = (data as any)?.specialty as string | null;
      setNeedsSpecialty(!v || !isCatalogSpecialty(v));
    })();
    return () => { cancelled = true; };
  }, [user, currentClinicId, clinicRole]);

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações da Clínica" description="Dados, equipe e preferências desta clínica." />
      {needsSpecialty && activeSection !== 'specialty' && (
        <button
          type="button"
          onClick={() => setActiveSection('specialty')}
          className="w-full flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-left hover:bg-warning/15 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Defina sua especialidade</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sem uma especialidade do catálogo, pacientes não conseguem te encontrar nas buscas. Clique para configurar agora.
            </p>
          </div>
        </button>
      )}
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="flex md:flex-col gap-1 md:w-48 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 space-y-6">
          {activeSection === 'specialty' && <SpecialtySection />}
          {activeSection === 'clinic' && <ClinicSection />}
          {activeSection === 'team' && <TeamSection />}
          {activeSection === 'rooms' && <ClinicRoomsSection />}
          {activeSection === 'insurance' && <InsurancePlansSection />}
          {activeSection === 'procedures' && <ProceduresCrudSection />}
          {activeSection === 'holidays' && <HolidaysSection />}
          {activeSection === 'payments' && <PaymentAccountSection />}
          {activeSection === 'subscription' && currentClinicId && (
            <SubscriptionSection entityType="clinic" entityId={currentClinicId} />
          )}
        </div>
      </div>
    </div>
  );
}

function ClinicSection() {
  const { user, currentClinicId, refreshClinics } = useAuth();
  const { isSolo } = useSoloMode();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingHideFlag, setSavingHideFlag] = useState(false);

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-settings', user?.id, currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', currentClinicId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentClinicId,
  });

  const emptyForm = {
    name: '', phone: '', email: user?.email ?? '', cnpj: '', cpf: '', category: '',
    entity_type: 'fisica' as 'fisica' | 'juridica',
    responsible_name: '',
    zip_code: '', address: '', address_number: '', address_complement: '', neighborhood: '', city: '', state: '',
  };
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cnpj: '', cpf: '', category: '',
    entity_type: 'fisica' as 'fisica' | 'juridica',
    responsible_name: '',
    zip_code: '', address: '', address_number: '', address_complement: '', neighborhood: '', city: '', state: '',
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [approvalMode, setApprovalMode] = useState<'clinic' | 'professional'>('clinic');

  useEffect(() => {
    if (isLoading) return;
    if (!clinic) {
      setForm(emptyForm);
      setBusinessHours(DEFAULT_HOURS);
      return;
    }
    const rawEt = (clinic as any).entity_type as 'fisica' | 'juridica' | null | undefined;
    // Detecção inteligente: se entity_type não foi definido (ou marcado errado),
    // usa o CPF/CNPJ presentes para inferir.
    const hasCnpj = !!(clinic as any).cnpj;
    const hasCpf = !!(clinic as any).cpf;
    const inferredEt: 'fisica' | 'juridica' =
      rawEt === 'fisica' || (rawEt === 'juridica' && hasCnpj)
        ? rawEt
        : hasCpf && !hasCnpj
        ? 'fisica'
        : hasCnpj
        ? 'juridica'
        : 'fisica';
    setForm({
      name: clinic.name ?? '', phone: clinic.phone ?? '', email: clinic.email ?? '',
      cnpj: clinic.cnpj ?? '', cpf: (clinic as any).cpf ?? '',
      category: (clinic as any).category ?? '',
      entity_type: inferredEt,
      responsible_name: (clinic as any).responsible_name ?? '',
      zip_code: clinic.zip_code ?? '', address: clinic.address ?? '',
      address_number: (clinic as any).address_number ?? '',
      address_complement: (clinic as any).address_complement ?? '',
      neighborhood: (clinic as any).neighborhood ?? '',
      city: clinic.city ?? '', state: clinic.state ?? '',
    });
    setBusinessHours((clinic as any).business_hours ?? DEFAULT_HOURS);
    setApprovalMode(((clinic as any).appointment_approval_mode as 'clinic' | 'professional') ?? 'clinic');
  }, [clinic, isLoading, user?.email]);

  const handleCepLookup = async () => {
    const digits = form.zip_code.replace(/\D/g, '');
    if (digits.length !== 8) { toast.error('CEP deve ter 8 dígitos'); return; }
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      setForm((f) => ({
        ...f,
        address: data.logradouro ?? f.address,
        neighborhood: data.bairro ?? f.neighborhood,
        city: data.localidade ?? f.city,
        state: data.uf ?? f.state,
      }));
      toast.success('Endereço preenchido pelo CEP');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setFetchingCep(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinic) return;
    const ALLOWED_LOGO = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED_LOGO.includes(file.type)) {
      toast.error('Apenas imagens JPG, PNG, WebP ou SVG são permitidas');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('O logo deve ter no máximo 2 MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${clinic.id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      const versionedUrl = `${publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.from('clinics').update({ logo_url: versionedUrl }).eq('id', clinic.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-branding'] });
      toast.success('Logo atualizada!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleToggleHideIaclin = async (checked: boolean) => {
    if (!clinic) return;
    setSavingHideFlag(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ hide_iaclin_logo: checked } as any)
        .eq('id', clinic.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-branding'] });
      toast.success(checked ? 'Logo IACLIN ocultada' : 'Logo IACLIN visível');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingHideFlag(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error('O nome da clínica é obrigatório');
      return;
    }
    // Valida horários: close deve ser > open. "00:00" como fechamento é um erro comum
    // (campo vazio interpretado como meia-noite) que deixa o dia sempre fechado.
    const DAY_LABELS_PT: Record<string, string> = {
      mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta',
      fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
    };
    for (const [day, h] of Object.entries(businessHours as any)) {
      const dh = h as { open: string; close: string; enabled: boolean };
      if (!dh?.enabled) continue;
      if (!dh.open || !dh.close || dh.close <= dh.open) {
        toast.error(`${DAY_LABELS_PT[day] ?? day}: horário de fechamento deve ser maior que o de abertura (recebido ${dh.open || '—'} → ${dh.close || '—'}).`);
        return;
      }
    }
    setSaving(true);
    try {
      const isPF = form.entity_type === 'fisica';
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        category: form.category || null,
        entity_type: form.entity_type,
        cnpj: isPF ? null : (form.cnpj || null),
        cpf: isPF ? (form.cpf || null) : null,
        responsible_name: form.responsible_name || null,
        zip_code: form.zip_code,
        address: form.address,
        address_number: form.address_number || null,
        address_complement: form.address_complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city,
        state: form.state,
        business_hours: businessHours as any,
        appointment_approval_mode: approvalMode,
      };
      if (clinic) {
        const { error } = await supabase.from('clinics').update(payload as any).eq('id', clinic.id);
        if (error) throw error;
        // Atualiza imediatamente o backend da Secretária IA com o novo horário.
        try {
          const [procRes, plansRes, roomsRes, membersRes] = await Promise.all([
            supabase.from('procedures').select('id, name, default_duration, category').eq('is_active', true),
            supabase.from('insurance_plans').select('id, name, ans_code').eq('clinic_id', clinic.id).eq('is_active', true),
            supabase.from('clinic_rooms').select('id, name').eq('clinic_id', clinic.id).eq('is_active', true),
            supabase.from('clinic_members').select('user_id, role, specialty').eq('clinic_id', clinic.id),
          ]);
          const memberRows = (membersRes.data ?? []) as Array<{ user_id: string; role: string; specialty: string | null }>;
          const userIds = memberRows.map((m) => m.user_id);
          const profilesRes = userIds.length
            ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
            : { data: [] as Array<{ id: string; full_name: string | null }> };
          const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
          const procedures = (procRes.data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            duration_min: p.default_duration ?? 30,
            category: p.category,
          }));
          const insurance_plans = (plansRes.data ?? []).map((ip) => ({
            id: ip.id,
            name: ip.name,
            code: ip.ans_code ?? null,
          }));
          const rooms = (roomsRes.data ?? []).map((r) => ({ id: r.id, name: r.name }));
          const doctors = memberRows.map((m) => ({
            user_id: m.user_id,
            full_name: profileMap.get(m.user_id) ?? '—',
            role: m.role,
            specialty: m.specialty,
            active: true,
          }));
          await aiBackend.syncConfig({
            clinic_id: clinic.id,
            business_hours: businessHours as unknown as Record<string, unknown>,
            procedures,
            insurance_plans,
            rooms,
            doctors,
          });
        } catch (syncErr) {
          // Não bloqueia o save em caso de falha do backend da IA.
          if (import.meta.env.DEV) console.warn('[ai-sync] syncConfig falhou:', syncErr);
        }
      } else {
        const { error } = await supabase.from('clinics').insert({ ...payload, owner_id: user.id } as any);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      }
      toast.success('Clínica atualizada!');
      await refreshClinics();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">{isSolo ? 'Meu consultório' : 'Clínica'}</CardTitle>
          <CardDescription>{isSolo ? 'Dados do seu consultório.' : 'Dados da clínica.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => logoRef.current?.click()}>
              <Avatar className="h-20 w-20 border-2 border-border">
                {clinic?.logo_url ? (
                  <AvatarImage src={clinic.logo_url} alt="Logo" />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                  {form.name?.[0]?.toUpperCase() ?? 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Logo da Clínica</p>
              <p className="text-xs text-muted-foreground">Clique na imagem para alterar</p>
              {uploadingLogo && <p className="text-xs text-primary mt-1">Enviando…</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-2"
                onClick={() => logoRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Adicionar logo
              </Button>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Ocultar logo IACLIN</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, apenas a logo da sua clínica aparece no topo. Caso contrário, ambas aparecem lado a lado.
              </p>
            </div>
            <Switch
              checked={!!(clinic as any)?.hide_iaclin_logo}
              disabled={savingHideFlag || !clinic}
              onCheckedChange={handleToggleHideIaclin}
            />
          </div>

          {/* Form fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tipo de pessoa */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Tipo de cadastro</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {(['fisica','juridica'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, entity_type: t })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      form.entity_type === t
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/50 text-muted-foreground'
                    }`}
                  >
                    <div className="font-medium text-foreground">
                      {t === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t === 'fisica' ? 'Profissional autônomo (CPF)' : 'Empresa formalizada (CNPJ)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome da Clínica</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Clínica Sorriso" />
            </div>
            <div className="space-y-2">
              <Label>Tipo / Categoria <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo da clínica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="odonto">Odontologia (Dentistas / CRO)</SelectItem>
                  <SelectItem value="medico">Medicina (Médicos / CRM)</SelectItem>
                  <SelectItem value="estetica">Estética</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              {form.category && (
                <p className="text-[11px] text-muted-foreground">
                  O sistema usará terminologia de{' '}
                  <strong>{form.category === 'odonto' ? 'Odontologia' : form.category === 'medico' ? 'Medicina' : form.category === 'estetica' ? 'Estética' : 'área geral'}</strong>{' '}
                  em todo o sistema.
                </p>
              )}
            </div>
            {form.entity_type === 'juridica' ? (
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@clinica.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{form.entity_type === 'fisica' ? 'Nome completo do titular' : 'Responsável pela clínica'}</Label>
              <Input value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} placeholder={form.entity_type === 'fisica' ? 'Dr. João Silva' : 'Nome do responsável'} />
            </div>
            {/* ── Endereço ── */}
            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center gap-2 pt-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Endereço</span>
              </div>
              <SmartAddressFields
                idPrefix="clinic"
                value={{
                  zipCode: form.zip_code,
                  address: form.address,
                  addressNumber: form.address_number,
                  addressComplement: form.address_complement,
                  neighborhood: form.neighborhood,
                  city: form.city,
                  state: form.state,
                }}
                onChange={(v) => setForm({
                  ...form,
                  zip_code: v.zipCode,
                  address: v.address,
                  address_number: v.addressNumber,
                  address_complement: v.addressComplement,
                  neighborhood: v.neighborhood,
                  city: v.city,
                  state: v.state,
                })}
              />
            </div>
          </div>

          {/* Business Hours */}
          <ClinicHoursSection value={businessHours} onChange={setBusinessHours} />

          {/* Aprovação de agendamentos via IA / online */}
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <div>
              <Label className="text-sm font-medium">Quem aprova agendamentos solicitados pela IA?</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Define quem recebe e decide sobre pedidos vindos do WhatsApp/marketplace.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {([
                { v: 'clinic' as const, t: 'Clínica (admin/secretária)', d: 'Pedidos centralizados na recepção.' },
                { v: 'professional' as const, t: 'Profissional', d: 'Cada profissional aprova os pedidos da própria agenda.' },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setApprovalMode(opt.v)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    approvalMode === opt.v
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:border-primary/50 text-muted-foreground'
                  }`}
                >
                  <div className="font-medium text-foreground">{opt.t}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.d}</div>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Appearance moved to /perfil (personal settings)
