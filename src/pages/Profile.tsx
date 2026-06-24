import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { User, Stethoscope, Network, KeyRound, Palette, Save, AlertCircle, Plus, Star, Trash2, BadgeCheck, Upload, CheckCircle2, MapPin, Loader2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeCustomizer } from '@/components/settings/ThemeCustomizer';
import MyClinicsSection from '@/components/settings/MyClinicsSection';
import { MyProceduresPerClinic } from '@/components/settings/MyProceduresPerClinic';
import { Switch } from '@/components/ui/switch';
import {
  SpecialtySelect,
  specialtyLabel,
  validateRegistrationForSpecialty,
} from '@/components/SpecialtySelect';
import { getFamilyConfig } from '@/lib/specialtyFamily';

const sections = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'specialty', label: 'Especialidades', icon: Stethoscope },
  { id: 'procedures', label: 'Procedimentos', icon: ListChecks },
  { id: 'clinics', label: 'Minhas Clínicas', icon: Network },
  { id: 'security', label: 'Segurança', icon: KeyRound },
  { id: 'appearance', label: 'Aparência', icon: Palette },
];

export default function Profile() {
  const [activeSection, setActiveSection] = useState('profile');

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Perfil" description="Dados pessoais, profissionais e preferências." />
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
          {activeSection === 'profile' && <ProfileInfoSection />}
          {activeSection === 'specialty' && <SpecialtiesSection />}
          {activeSection === 'procedures' && <MyProceduresPerClinic />}
          {activeSection === 'clinics' && <MyClinicsSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'appearance' && <AppearanceBlock />}
        </div>
      </div>
    </div>
  );
}

export function ProfileInfoSection() {
  const { user, profile, currentClinicId, roles, clinicCategory } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Address fields
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);

  const userTypeMeta = String((user?.user_metadata as Record<string, unknown> | undefined)?.user_type ?? '');
  const isProfessionalProfile = roles.includes('dentist') || userTypeMeta.startsWith('profissional');

  // Fetch clinic_member row for current clinic (only for registration_number)
  const { data: member } = useQuery({
    queryKey: ['my-clinic-member', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user || !currentClinicId) return null;
      const { data } = await supabase.from('clinic_members')
        .select('id, specialty, registration_number, role, is_owner')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!currentClinicId,
  });

  // Personal specialties (multi)
  const { data: mySpecialties = [] } = useQuery({
    queryKey: ['my-personal-specialties', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('professional_specialties' as any)
        .select('id, specialty, is_primary')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; specialty: string; is_primary: boolean }>;
    },
    enabled: !!user,
  });

  const primarySpecialty = mySpecialties.find((s) => s.is_primary)?.specialty ?? mySpecialties[0]?.specialty ?? null;

  const { data: profileFull } = useQuery({
    queryKey: ['my-profile-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('full_name, phone, avatar_url, zip_code, address, address_number, address_complement, neighborhood, city, state').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profileFull) {
      setFullName(profileFull.full_name ?? '');
      setPhone(profileFull.phone ?? '');
      setAvatarUrl(profileFull.avatar_url ?? null);
      setZipCode((profileFull as any).zip_code ?? '');
      setAddress((profileFull as any).address ?? '');
      setAddressNumber((profileFull as any).address_number ?? '');
      setAddressComplement((profileFull as any).address_complement ?? '');
      setNeighborhood((profileFull as any).neighborhood ?? '');
      setCity((profileFull as any).city ?? '');
      setAddressState((profileFull as any).state ?? '');
    }
  }, [profileFull]);

  useEffect(() => {
    const metaRegistration = String((user?.user_metadata as Record<string, unknown> | undefined)?.registration_number ?? '').trim();
    setRegistrationNumber(member?.registration_number ?? metaRegistration);
  }, [member, user?.user_metadata]);

  useEffect(() => {
    const metaSpecialty = String((user?.user_metadata as Record<string, unknown> | undefined)?.specialty ?? '').trim();
    setSelectedSpecialty(primarySpecialty ?? metaSpecialty);
  }, [primarySpecialty, user?.user_metadata]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ALLOWED_AVATAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_AVATAR.includes(file.type)) {
      toast.error('Apenas imagens JPG, PNG, WebP ou GIF são permitidas');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5 MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `profiles/${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Foto de perfil carregada. Clique em salvar para confirmar.');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao enviar foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCepLookup = async () => {
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      if (data.logradouro) setAddress(data.logradouro);
      if (data.bairro) setNeighborhood(data.bairro);
      if (data.localidade) setCity(data.localidade);
      if (data.uf) setAddressState(data.uf);
      toast.success('Endereço preenchido pelo CEP');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setFetchingCep(false);
    }
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('no user');
      if (!fullName.trim()) throw new Error('Informe seu nome completo');
      if (!phone.trim()) throw new Error('Informe seu telefone');

      if (isProfessionalProfile) {
        if (!avatarUrl?.trim()) throw new Error('Adicione sua foto de perfil');
        if (!selectedSpecialty.trim()) throw new Error('Selecione sua especialidade');
        if (!registrationNumber.trim()) {
          const fallbackLabel = selectedSpecialty ? getFamilyConfig(selectedSpecialty).registrationLabel : 'registro profissional';
          throw new Error(`Informe seu ${fallbackLabel}`);
        }
      }

      const regError = validateRegistrationForSpecialty(registrationNumber, selectedSpecialty || null);
      if (regError) throw new Error(regError);

      const { error: pErr } = await supabase.from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          avatar_url: avatarUrl,
          zip_code: zipCode.trim() || null,
          address: address.trim() || null,
          address_number: addressNumber.trim() || null,
          address_complement: addressComplement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim() || null,
          state: addressState.trim() || null,
        } as any)
        .eq('id', user.id);
      if (pErr) throw pErr;

      if (isProfessionalProfile && selectedSpecialty.trim()) {
        const { data: existingSpecialty, error: findErr } = await supabase
          .from('professional_specialties' as any)
          .select('id')
          .eq('user_id', user.id)
          .eq('specialty', selectedSpecialty)
          .maybeSingle();
        if (findErr) throw findErr;

        const { error: clearPrimaryErr } = await supabase
          .from('professional_specialties' as any)
          .update({ is_primary: false })
          .eq('user_id', user.id);
        if (clearPrimaryErr) throw clearPrimaryErr;

        if ((existingSpecialty as any)?.id) {
          const { error: setPrimaryErr } = await supabase
            .from('professional_specialties' as any)
            .update({ is_primary: true })
            .eq('id', (existingSpecialty as any).id);
          if (setPrimaryErr) throw setPrimaryErr;
        } else {
          const { error: insertSpecErr } = await supabase
            .from('professional_specialties' as any)
            .insert({ user_id: user.id, specialty: selectedSpecialty, is_primary: true });
          if (insertSpecErr) throw insertSpecErr;
        }
      }

      if (member) {
        const { error: mErr } = await supabase.from('clinic_members')
          .update({ registration_number: registrationNumber.trim() || null, specialty: selectedSpecialty.trim() || null })
          .eq('id', member.id);
        if (mErr) throw mErr;
      }

      if (isProfessionalProfile) {
        const { error: authErr } = await supabase.auth.updateUser({
          data: {
            specialty: selectedSpecialty.trim() || null,
            registration_number: registrationNumber.trim() || null,
          },
        });
        if (authErr) throw authErr;
      }
    },
    onSuccess: () => {
      toast.success('Perfil atualizado');
      queryClient.invalidateQueries({ queryKey: ['my-profile-full'] });
      queryClient.invalidateQueries({ queryKey: ['my-clinic-member'] });
      queryClient.invalidateQueries({ queryKey: ['my-personal-specialties'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const initials = (fullName || profile?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  // Fallback CRO somente quando a clínica ativa é odonto. Em modo pessoal
  // (sem clínica) ou em clínica médica, mantém o label da especialidade
  // escolhida (CRM por padrão) para não rotular médicos como dentistas.
  const fallbackSpecialty = clinicCategory === 'odonto' ? 'dentista' : null;
  const familyConfig = getFamilyConfig(selectedSpecialty || primarySpecialty || fallbackSpecialty);
  const regLabel = familyConfig.registrationLabel;

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Informações pessoais</CardTitle>
        <CardDescription>Seus dados de profissional, válidos em todas as clínicas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{user?.email}</p>
            <label className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border border-input cursor-pointer hover:bg-muted transition">
              <Upload className="h-3.5 w-3.5" />
              {uploadingAvatar ? 'Enviando foto...' : 'Enviar foto de perfil'}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={uploadingAvatar}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
            </label>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>

        {isProfessionalProfile && (
          <>
            <div>
              <Label htmlFor="specialty">Especialidade principal</Label>
              <SpecialtySelect
                value={selectedSpecialty}
                onChange={setSelectedSpecialty}
                placeholder="Selecione sua especialidade"
              />
            </div>
            <div>
              <Label htmlFor="reg">{regLabel}</Label>
              <Input
                id="reg"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder={`Digite seu ${regLabel}`}
                className={!registrationNumber ? 'border-amber-500/60 focus-visible:ring-amber-500/40' : undefined}
              />
              {!registrationNumber && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Complete seu {regLabel} para finalizar vínculos com clínicas.
                </p>
              )}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SpecialtiesSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newSpecialty, setNewSpecialty] = useState('');

  const { data: mySpecialties = [] } = useQuery({
    queryKey: ['my-personal-specialties', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('professional_specialties' as any)
        .select('id, specialty, is_primary')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; specialty: string; is_primary: boolean }>;
    },
    enabled: !!user,
  });

  const addSpecialty = useMutation({
    mutationFn: async (s: string) => {
      if (!user || !s) return;
      const isFirst = mySpecialties.length === 0;
      const { error } = await supabase
        .from('professional_specialties' as any)
        .insert({ user_id: user.id, specialty: s, is_primary: isFirst });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewSpecialty('');
      queryClient.invalidateQueries({ queryKey: ['my-personal-specialties'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao adicionar especialidade'),
  });

  const removeSpecialty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('professional_specialties' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-personal-specialties'] }),
    onError: (e: any) => toast.error(e.message ?? 'Erro ao remover'),
  });

  const setPrimary = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      const { error: e1 } = await supabase
        .from('professional_specialties' as any)
        .update({ is_primary: false })
        .eq('user_id', user.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('professional_specialties' as any)
        .update({ is_primary: true })
        .eq('id', id);
      if (e2) throw e2;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-personal-specialties'] }),
    onError: (e: any) => toast.error(e.message ?? 'Erro ao definir primária'),
  });

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Minhas especialidades</CardTitle>
        <CardDescription>
          Adicione todas as suas especialidades. Cada clínica pode escolher quais você atende ali.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mySpecialties.length > 0 && (
          <div className="space-y-1.5">
            {mySpecialties.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{specialtyLabel(s.specialty)}</span>
                  {s.is_primary && <Badge variant="secondary" className="text-[10px] gap-1"><Star className="h-3 w-3" /> Primária</Badge>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!s.is_primary && (
                    <Button size="sm" variant="ghost" onClick={() => setPrimary.mutate(s.id)} className="h-7 px-2 text-xs gap-1">
                      <Star className="h-3 w-3" /> Tornar primária
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => removeSpecialty.mutate(s.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SpecialtySelect
              value={newSpecialty}
              onChange={setNewSpecialty}
              placeholder="Selecione uma especialidade para adicionar"
            />
          </div>
          <Button
            type="button"
            onClick={() => addSpecialty.mutate(newSpecialty)}
            disabled={!newSpecialty || addSpecialty.isPending || mySpecialties.some((s) => s.specialty === newSpecialty)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
          <div>
            <Label htmlFor="currentPwd">Senha atual</Label>
            <Input id="currentPwd" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Digite sua senha atual" autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="newPwd">Nova senha</Label>
            <Input id="newPwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirmPwd">Confirmar nova senha</Label>
            <Input id="confirmPwd" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => changePassword.mutate()}
              disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
              className="gap-2"
            >
              {changePassword.isPending && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
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

function AppearanceBlock() {
  const { theme, setTheme, resolved } = useTheme();
  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
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
