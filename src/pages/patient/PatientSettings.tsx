import { useEffect, useState } from 'react';
import { Loader2, LogOut, Sun, Moon, User, Share2, MapPin, Phone, Shield, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData } from '@/hooks/usePatientData';
import { ShareMyChartDialog } from '@/components/patient/ShareMyChartDialog';
import { useQuery } from '@tanstack/react-query';

const REFERRAL_SOURCES = [
  'Busca no Google',
  'Redes sociais',
  'Indicação de amigo ou familiar',
  'Indicação de profissional',
  'Plano de saúde',
  'Outdoor / Anúncio',
  'Outro',
];

const PREDEFINED_CATEGORIES = [
  'VIP', 'Convênio', 'Particular', 'Criança', 'Idoso',
  'Gestante', 'Risco', 'Recall', 'Inativo',
];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Separator className="flex-1" />
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

const emptyForm = () => ({
  full_name: '',
  phone: '',
  landline: '',
  date_of_birth: '',
  gender: '',
  is_foreign: false,
  cpf: '',
  rg: '',
  profession: '',
  referral_source: '',
  notes: '',
  categories: [] as string[],
  sms_reminders: true,
  // Emergency
  emergency_contact_name: '',
  emergency_contact_phone: '',
  // Address
  zip_code: '',
  address: '',
  address_complement: '',
  neighborhood: '',
  city: '',
  state: '',
  // Guardian
  guardian_name: '',
  guardian_cpf: '',
  guardian_date_of_birth: '',
  // Insurance
  insurance_provider: '',
  insurance_holder: '',
  insurance_number: '',
  insurance_holder_cpf: '',
});

export default function PatientSettings() {
  const { user, signOut } = useAuth();
  const { account, loading, refetch, patientIds } = usePatientData();
  const { resolved, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [newCategory, setNewCategory] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);

  // Load extended data from first linked patients record
  const { data: patientRecord } = useQuery({
    queryKey: ['patient-record-settings', user?.id, patientIds[0]],
    queryFn: async () => {
      if (!patientIds.length) return null;
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientIds[0])
        .maybeSingle();
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
      referral_source: p.referral_source ?? '',
      notes: p.notes ?? '',
      categories: p.categories ?? [],
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
  }, [account, patientRecord]);

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
      // silent — CEP not found
    } finally {
      setFetchingCep(false);
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
      landline: form.landline || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      is_foreign: form.is_foreign,
      rg: form.rg || null,
      profession: form.profession || null,
      referral_source: form.referral_source || null,
      notes: form.notes || null,
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

    const ops: Promise<any>[] = [
      supabase.from('patient_accounts').update(accPatch).eq('id', account.id),
      supabase.from('profiles').update({ full_name: form.full_name.trim(), phone: form.phone || null }).eq('id', user.id),
    ];

    if (patientIds.length > 0) {
      ops.push(
        supabase.from('patients').update(patientPatch).in('id', patientIds)
      );
    }

    const results = await Promise.all(ops);
    setSaving(false);

    const err = results.find((r) => r.error)?.error;
    if (err) return toast.error(err.message);

    toast.success('Perfil atualizado!');
    refetch();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seus dados e preferências.</p>
      </div>

      {/* ─── Dados Pessoais ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <PhoneInput value={form.phone} onChange={(v) => update('phone', v)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <Label>Lembretes automáticos</Label>
                <Switch checked={form.sms_reminders} onCheckedChange={(v) => update('sms_reminders', v)} />
              </div>
              <p className="text-xs text-muted-foreground">Notificações de consulta por SMS/WhatsApp</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ''} disabled className="text-muted-foreground" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input
                value={form.profession}
                onChange={(e) => update('profession', e.target.value)}
                placeholder="Ex: Professor, Engenheiro…"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <Label>Paciente estrangeiro</Label>
                <Switch checked={form.is_foreign} onCheckedChange={(v) => update('is_foreign', v)} />
              </div>
              <p className="text-xs text-muted-foreground">Desativa obrigatoriedade do CPF</p>
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={form.cpf} disabled className="font-mono text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>RG</Label>
              <Input
                value={form.rg}
                onChange={(e) => update('rg', e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Adicione observações sobre você"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
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
        </CardContent>
      </Card>

      {/* ─── Contato de Emergência ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Contato de emergência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      {/* ─── Endereço ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {fetchingCep && <p className="text-xs text-muted-foreground">Buscando…</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => update('neighborhood', e.target.value)}
                placeholder="Bairro"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço com número</Label>
            <Input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Rua, Av… e número"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Complemento</Label>
            <Input
              value={form.address_complement}
              onChange={(e) => update('address_complement', e.target.value)}
              placeholder="Apto, Bloco, Casa…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
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
        </CardContent>
      </Card>

      {/* ─── Responsável ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Responsável
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do responsável</Label>
            <Input
              value={form.guardian_name}
              onChange={(e) => update('guardian_name', e.target.value)}
              placeholder="Nome completo do responsável"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CPF</Label>
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
        </CardContent>
      </Card>

      {/* ─── Dados do Convênio ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Dados do convênio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Convênio</Label>
            <Input
              value={form.insurance_provider}
              onChange={(e) => update('insurance_provider', e.target.value)}
              placeholder="Nome do plano de saúde"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Titular do convênio</Label>
            <Input
              value={form.insurance_holder}
              onChange={(e) => update('insurance_holder', e.target.value)}
              placeholder="Nome do titular (se diferente de você)"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      {/* ─── Botão Salvar ─── */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>

      {/* ─── Aparência ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Tema</p>
              <p className="text-xs text-muted-foreground">
                {resolved === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado'}
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="gap-2"
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {resolved === 'dark' ? 'Claro' : 'Escuro'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Compartilhar Prontuário ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Compartilhar prontuário
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Gere um código temporário para liberar seu prontuário completo para qualquer profissional.
          </p>
          <Button onClick={() => setShareOpen(true)} variant="outline" className="gap-2 flex-shrink-0">
            <Share2 className="h-4 w-4" /> Gerar código
          </Button>
        </CardContent>
      </Card>

      {/* ─── Sair ─── */}
      <Card className="border-destructive/30">
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

      <ShareMyChartDialog open={shareOpen} onOpenChange={setShareOpen} patientName={account?.full_name ?? null} />
    </div>
  );
}
