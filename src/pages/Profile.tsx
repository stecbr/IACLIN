import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { User, Stethoscope, Network, KeyRound, Palette, Save, AlertCircle, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeCustomizer } from '@/components/settings/ThemeCustomizer';
import MyClinicsSection from '@/components/settings/MyClinicsSection';
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
          {activeSection === 'clinics' && <MyClinicsSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'appearance' && <AppearanceBlock />}
        </div>
      </div>
    </div>
  );
}

function ProfileInfoSection() {
  const { user, profile, currentClinicId, clinics } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

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
      const { data } = await supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profileFull) {
      setFullName(profileFull.full_name ?? '');
      setPhone(profileFull.phone ?? '');
    }
  }, [profileFull]);

  useEffect(() => {
    if (member) {
      setRegistrationNumber(member.registration_number ?? '');
    }
  }, [member]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('no user');
      const regError = validateRegistrationForSpecialty(registrationNumber, primarySpecialty);
      if (regError) throw new Error(regError);
      const { error: pErr } = await supabase.from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', user.id);
      if (pErr) throw pErr;
      if (member) {
        const { error: mErr } = await supabase.from('clinic_members')
          .update({ registration_number: registrationNumber || null })
          .eq('id', member.id);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      toast.success('Perfil atualizado');
      queryClient.invalidateQueries({ queryKey: ['my-profile-full'] });
      queryClient.invalidateQueries({ queryKey: ['my-clinic-member'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const initials = (fullName || profile?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const familyConfig = getFamilyConfig(primarySpecialty);
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
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm text-muted-foreground">
            <p>{user?.email}</p>
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
        {member && (
          <div>
            <Label htmlFor="reg">{regLabel}</Label>
            <Input
              id="reg"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder={`Digite seu ${regLabel}`}
              className={!member?.registration_number ? 'border-amber-500/60 focus-visible:ring-amber-500/40' : undefined}
            />
            {!member?.registration_number && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Complete seu {regLabel} para emitir receitas e atestados.
              </p>
            )}
          </div>
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

function SpecialtiesSection() {
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
  const [newPassword, setNewPassword] = useState('');
  const changePassword = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Senha alterada');
      setNewPassword('');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alterar senha'),
  });
  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Alterar senha</CardTitle>
        <CardDescription>Defina uma nova senha de acesso à sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="newPwd">Nova senha</Label>
          <Input id="newPwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => changePassword.mutate()} disabled={!newPassword || changePassword.isPending}>
            Alterar senha
          </Button>
        </div>
      </CardContent>
    </Card>
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
