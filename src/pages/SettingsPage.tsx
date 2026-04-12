import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Building2, Palette, Stethoscope, Save, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/PageHeader';
import TeamSection from '@/components/settings/TeamSection';

const sections = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'clinic', label: 'Clínica', icon: Building2 },
  { id: 'team', label: 'Equipe', icon: Users },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'procedures', label: 'Procedimentos', icon: Stethoscope },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const { user, profile } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil, clínica e preferências." />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar navigation */}
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
        <div className="flex-1 min-w-0">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'clinic' && <ClinicSection />}
          {activeSection === 'team' && <TeamSection />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'procedures' && <ProceduresSection />}
          {activeSection === 'procedures' && <ProceduresSection />}
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
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('*').eq('owner_id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    name: clinic?.name ?? '',
    phone: clinic?.phone ?? '',
    email: clinic?.email ?? '',
    address: clinic?.address ?? '',
    city: clinic?.city ?? '',
    state: clinic?.state ?? '',
    cnpj: clinic?.cnpj ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (clinic) {
        const { error } = await supabase.from('clinics').update(form).eq('id', clinic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clinics').insert({ ...form, owner_id: user.id });
        if (error) throw error;
      }
      toast.success('Clínica atualizada!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Clínica</CardTitle>
        <CardDescription>Dados da clínica odontológica.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
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

function ProceduresSection() {
  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procedures').select('*').order('category, name');
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(procedures.map((p) => p.category))];

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Procedimentos</CardTitle>
        <CardDescription>Procedimentos cadastrados no sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : procedures.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum procedimento cadastrado.</p>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
                <div className="space-y-1">
                  {procedures.filter((p) => p.category === cat).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {p.code && <Badge variant="outline" className="text-[10px]">{p.code}</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{p.default_duration}min</span>
                        <span>R$ {Number(p.default_price).toFixed(2)}</span>
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
