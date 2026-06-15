import { useEffect, useRef, useState } from 'react';
import {
  Loader2, LogOut, User, KeyRound, Palette, Share2,
  AlertCircle, MapPin, Shield, Camera, Save, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeCustomizer } from '@/components/settings/ThemeCustomizer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData } from '@/hooks/usePatientData';
import { ShareMyChartDialog } from '@/components/patient/ShareMyChartDialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CitySelect } from '@/components/address/CitySelect';

const sections = [
  { id: 'profile',    label: 'Perfil',      icon: User },
  { id: 'security',   label: 'Segurança',   icon: KeyRound },
  { id: 'appearance', label: 'Aparência',   icon: Palette },
  { id: 'chart',      label: 'Prontuário',  icon: Share2 },
];

export default function PatientSettings() {
  const [activeSection, setActiveSection] = useState('profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados pessoais e preferências da sua conta.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
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

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeSection === 'profile'    && <ProfileSection />}
          {activeSection === 'security'   && <SecuritySection />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'chart'      && <ChartSection />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */


const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function SectionLabel({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function PhoneInput({ value, onChange, placeholder, id }: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string;
}) {
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

/* ─────────────────────────── Profile Section ─────────────────────────── */

function ProfileSection() {
  const { user, signOut, profile, refreshClinics } = useAuth();
  const { account, loading, refetch, patientIds } = usePatientData();
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const [form, setForm] = useState({
    full_name: '', phone: '', landline: '', date_of_birth: '', gender: '',
    is_foreign: false, cpf: '', rg: '', profession: '',
    notes: '', photo_url: '', sms_reminders: true,
    emergency_contact_name: '', emergency_contact_phone: '',
    zip_code: '', address: '', address_complement: '', neighborhood: '', city: '', state: '',
    guardian_name: '', guardian_cpf: '', guardian_date_of_birth: '',
    insurance_provider: '', insurance_holder: '', insurance_number: '', insurance_holder_cpf: '',
  });

  const { data: patientRecord } = useQuery({
    queryKey: ['patient-record-settings', user?.id, patientIds[0]],
    queryFn: async () => {
      if (!patientIds.length) return null;
      const { data } = await supabase.from('patients').select('*').eq('id', patientIds[0]).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id && patientIds.length > 0,
  });

  useEffect(() => {
    if (!account) return;
    const p = patientRecord ?? {};
    setForm({
      full_name: account.full_name ?? '',
      phone: account.phone ?? '',
      landline: p.landline ?? '',
      date_of_birth: account.date_of_birth ?? p.date_of_birth ?? '',
      gender: account.gender ?? p.gender ?? '',
      is_foreign: p.is_foreign ?? false,
      cpf: account.cpf ?? '',
      rg: account.rg ?? p.rg ?? '',
      profession: account.profession ?? p.profession ?? '',
      notes: p.notes ?? '',
      photo_url: profile?.avatar_url ?? p.photo_url ?? '',
      sms_reminders: p.sms_reminders ?? true,
      emergency_contact_name: p.emergency_contact_name ?? '',
      emergency_contact_phone: p.emergency_contact_phone ?? '',
      zip_code: p.zip_code ?? '',
      address: p.address ?? '',
      address_complement: p.address_complement ?? '',
      neighborhood: p.neighborhood ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      guardian_name: p.guardian_name ?? '',
      guardian_cpf: p.guardian_cpf ?? '',
      guardian_date_of_birth: p.guardian_date_of_birth ?? '',
      insurance_provider: account.insurance_provider ?? p.insurance_provider ?? '',
      insurance_holder: p.insurance_holder ?? '',
      insurance_number: account.insurance_number ?? p.insurance_number ?? '',
      insurance_holder_cpf: p.insurance_holder_cpf ?? '',
    });
  }, [account, patientRecord, profile?.avatar_url]);

  const set = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));


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
    } catch { /* silent */ }
    finally { setFetchingCep(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `patients/${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      set('photo_url', publicUrl);
      toast.success('Foto carregada. Clique em Salvar para confirmar.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    if (!account || !user) return;
    setSaving(true);

    const accPatch: any = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      rg: form.rg || null,
      profession: form.profession || null,
      insurance_provider: form.insurance_provider || null,
      insurance_number: form.insurance_number || null,
    };

    const patientPatch: any = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      email: user?.email || null,
      photo_url: form.photo_url || null,
      landline: form.landline || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      is_foreign: form.is_foreign,
      rg: form.rg || null,
      profession: form.profession || null,
      notes: form.notes || null,
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

    const ops: any[] = [
      supabase.from('patient_accounts').update(accPatch).eq('id', account.id),
      supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        avatar_url: form.photo_url || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
      }).eq('id', user.id),
    ];
    if (patientIds.length > 0) {
      // Update every patients row linked to this user so the photo and
      // personal data stay consistent across clinic records.
      ops.push(supabase.from('patients').update(patientPatch).eq('patient_user_id', user.id));
    }

    const results = await Promise.all(ops);
    setSaving(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return toast.error(err.message);
    toast.success('Perfil atualizado!');
    refetch();
    refreshClinics();
  };

  const initials = (form.full_name || user?.email || 'P')
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Info Card */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Informações pessoais</CardTitle>
          <CardDescription>Seus dados pessoais visíveis para os profissionais que te atendem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => photoRef.current?.click()}
            >
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                {form.photo_url && <img src={form.photo_url} alt="Foto" className="h-full w-full object-cover rounded-full" />}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-4 w-4 text-white" />
              </div>
              {uploadingPhoto && (
                <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>{user?.email}</p>
              <label className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border border-input cursor-pointer hover:bg-muted transition">
                <Camera className="h-3.5 w-3.5" />
                {uploadingPhoto ? 'Enviando…' : 'Alterar foto de perfil'}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <PhoneInput value={form.phone} onChange={(v) => set('phone', v)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">Lembretes automáticos</Label>
                <Switch checked={form.sms_reminders} onCheckedChange={(v) => set('sms_reminders', v)} />
              </div>
              <p className="text-xs text-muted-foreground">Notificações de consulta por SMS/WhatsApp</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Telefone fixo</Label>
              <PhoneInput value={form.landline} onChange={(v) => set('landline', v)} placeholder="(11) 3333-4444" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input
                value={form.profession}
                onChange={(e) => set('profession', e.target.value)}
                placeholder="Ex: Professor, Engenheiro…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">Paciente estrangeiro</Label>
                <Switch checked={form.is_foreign} onCheckedChange={(v) => set('is_foreign', v)} />
              </div>
              <p className="text-xs text-muted-foreground">Desativa obrigatoriedade do CPF</p>
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={form.cpf} disabled className="font-mono text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => set('rg', e.target.value)} placeholder="00.000.000-0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Adicione observações sobre você"
              rows={3}
            />
          </div>

          {/* Emergency Contact */}
          <SectionLabel icon={AlertCircle} title="Contato de emergência" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.emergency_contact_name}
                onChange={(e) => set('emergency_contact_name', e.target.value)}
                placeholder="Nome do contato"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <PhoneInput value={form.emergency_contact_phone} onChange={(v) => set('emergency_contact_phone', v)} />
            </div>
          </div>

          {/* Address */}
          <SectionLabel icon={MapPin} title="Endereço" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input
                value={form.zip_code}
                onChange={(e) => set('zip_code', e.target.value)}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
              />
              {fetchingCep && <p className="text-xs text-muted-foreground">Buscando…</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Bairro" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço com número</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, Av… e número" />
          </div>
          <div className="space-y-1.5">
            <Label>Complemento</Label>
            <Input value={form.address_complement} onChange={(e) => set('address_complement', e.target.value)} placeholder="Apto, Bloco, Casa…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <CitySelect
                uf={form.state}
                value={form.city}
                onChange={(city, uf) => {
                  set('city', city);
                  if (uf) set('state', uf);
                }}
                placeholder={form.state ? 'Selecione…' : 'UF primeiro'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.state} onValueChange={(v) => set('state', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guardian */}
          <SectionLabel icon={User} title="Responsável" />
          <div className="space-y-1.5">
            <Label>Nome do responsável</Label>
            <Input value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CPF do responsável</Label>
              <Input value={form.guardian_cpf} onChange={(e) => set('guardian_cpf', e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.guardian_date_of_birth} onChange={(e) => set('guardian_date_of_birth', e.target.value)} />
            </div>
          </div>

          {/* Insurance */}
          <SectionLabel icon={Shield} title="Dados do convênio" />
          <div className="space-y-1.5">
            <Label>Convênio</Label>
            <Input value={form.insurance_provider} onChange={(e) => set('insurance_provider', e.target.value)} placeholder="Nome do plano de saúde" />
          </div>
          <div className="space-y-1.5">
            <Label>Titular do convênio</Label>
            <Input value={form.insurance_holder} onChange={(e) => set('insurance_holder', e.target.value)} placeholder="Nome do titular (se diferente)" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Número da carteirinha</Label>
              <Input value={form.insurance_number} onChange={(e) => set('insurance_number', e.target.value)} placeholder="000000000" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF do responsável</Label>
              <Input value={form.insurance_holder_cpf} onChange={(e) => set('insurance_holder_cpf', e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card className="border-destructive/30 shadow-card">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Sair da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Você precisará entrar novamente para acessar sua área.
          </p>
          <Button variant="destructive" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Security Section ─────────────────────────── */

function SecuritySection() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error('Informe a senha atual');
      if (!newPassword || newPassword.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres');
      if (newPassword !== confirmPassword) throw new Error('As senhas não coincidem');
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });
      if (authErr) throw new Error('Senha atual incorreta');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowSuccess(true);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alterar senha'),
  });

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
          <CardDescription>Altere sua senha de acesso à plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPwd">Senha atual</Label>
            <Input
              id="currentPwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPwd">Nova senha</Label>
            <Input
              id="newPwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPwd">Confirmar nova senha</Label>
            <Input
              id="confirmPwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => changePassword.mutate()}
              disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
              className="gap-2"
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center gap-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle>Senha alterada com sucesso!</DialogTitle>
            <DialogDescription>
              Na próxima vez que acessar a plataforma, use sua nova senha para fazer login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={() => setShowSuccess(false)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────── Appearance Section ─────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme, resolved } = useTheme();

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Personalize o visual da plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Modo Escuro</p>
              <p className="text-xs text-muted-foreground">Alternar entre tema claro e escuro</p>
            </div>
            <Switch
              checked={resolved === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Tema</p>
            <div className="flex gap-3 flex-wrap">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    theme === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <ThemeCustomizer />
    </div>
  );
}

/* ─────────────────────────── Chart Section ─────────────────────────── */

function ChartSection() {
  const { account } = usePatientData();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Compartilhar prontuário</CardTitle>
          <CardDescription>
            Gere um código temporário para liberar seu prontuário completo para qualquer profissional.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            O código expira automaticamente após o uso ou em 48 horas.
          </p>
          <Button onClick={() => setShareOpen(true)} className="gap-2 flex-shrink-0">
            <Share2 className="h-4 w-4" /> Gerar código
          </Button>
        </CardContent>
      </Card>
      <ShareMyChartDialog open={shareOpen} onOpenChange={setShareOpen} patientName={account?.full_name ?? null} />
    </>
  );
}
