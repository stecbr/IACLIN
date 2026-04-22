import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Building2, Palette, Stethoscope, Save, Users, Shield, Upload, Camera, Armchair, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import TeamSection from '@/components/settings/TeamSection';
import InsurancePlansSection from '@/components/settings/InsurancePlansSection';
import { ClinicHoursSection, type BusinessHours, DEFAULT_HOURS } from '@/components/settings/ClinicHoursSection';
import ClinicRoomsSection from '@/components/settings/ClinicRoomsSection';
import ProceduresCrudSection from '@/components/settings/ProceduresCrudSection';
import SpecialtySection from '@/components/settings/SpecialtySection';
import { isCatalogSpecialty } from '@/components/SpecialtySelect';

const sections = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'specialty', label: 'Especialidade', icon: Stethoscope },
  { id: 'clinic', label: 'Clínica', icon: Building2 },
  { id: 'team', label: 'Equipe', icon: Users },
  { id: 'rooms', label: 'Salas', icon: Armchair },
  { id: 'insurance', label: 'Convênios', icon: Shield },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'procedures', label: 'Procedimentos', icon: Stethoscope },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const { user, currentClinicId, isDentist } = useAuth();
  const [needsSpecialty, setNeedsSpecialty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !currentClinicId || !isDentist) {
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
  }, [user, currentClinicId, isDentist]);

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil, clínica e preferências." />
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
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'specialty' && <SpecialtySection />}
          {activeSection === 'clinic' && <ClinicSection />}
          {activeSection === 'team' && <TeamSection />}
          {activeSection === 'rooms' && <ClinicRoomsSection />}
          {activeSection === 'insurance' && <InsurancePlansSection />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'procedures' && <ProceduresCrudSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (error) throw error;
      toast.success('Perfil atualizado!');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Perfil</CardTitle>
        <CardDescription>Suas informações pessoais.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={user?.email ?? ''} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. João Silva" />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ClinicSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('*').eq('owner_id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', city: '', state: '', cnpj: '', zip_code: '',
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (clinic && !initialized) {
    setForm({
      name: clinic.name ?? '', phone: clinic.phone ?? '', email: clinic.email ?? '',
      address: clinic.address ?? '', city: clinic.city ?? '', state: clinic.state ?? '', cnpj: clinic.cnpj ?? '', zip_code: clinic.zip_code ?? '',
    });
    setBusinessHours((clinic as any).business_hours ?? DEFAULT_HOURS);
    setInitialized(true);
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinic) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${clinic.id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      const { error } = await supabase.from('clinics').update({ logo_url: publicUrl }).eq('id', clinic.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      toast.success('Logo atualizada!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...form, business_hours: businessHours as any };
      if (clinic) {
        const { error } = await supabase.from('clinics').update(payload).eq('id', clinic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clinics').insert({ ...payload, owner_id: user.id });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
        setTimeout(() => window.location.reload(), 500);
      }
      toast.success('Clínica atualizada!');
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
          <CardTitle className="text-base">Clínica</CardTitle>
          <CardDescription>Dados da clínica.</CardDescription>
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
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Form fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome da Clínica</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Clínica Sorriso" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@clinica.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua..." />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="SP" />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} placeholder="00000-000" />
            </div>
          </div>

          {/* Business Hours */}
          <ClinicHoursSection value={businessHours} onChange={setBusinessHours} />

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme, resolved } = useTheme();

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Aparência</CardTitle>
        <CardDescription>Personalize a interface do sistema.</CardDescription>
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
          <div className="flex gap-3">
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
  );
}

