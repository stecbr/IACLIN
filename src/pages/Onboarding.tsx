import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';
import { toast } from 'sonner';
import {
  Building2, ArrowRight, Loader2, Search,
  Stethoscope, Heart, MoreHorizontal, Check, Clock, CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

// ── Constantes ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const categories = [
  { value: 'odonto',   label: 'Odontológico', icon: Heart,        description: 'Clínica odontológica' },
  { value: 'medico',   label: 'Médico',        icon: Stethoscope,  description: 'Clínica médica geral' },
  { value: 'estetica', label: 'Estética',      icon: Heart,        description: 'Estética e dermatologia' },
  { value: 'outro',    label: 'Outro',          icon: MoreHorizontal, description: 'Outro tipo de clínica' },
] as const;

const WEEKDAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
] as const;

type WeekdayKey = typeof WEEKDAYS[number]['key'];

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

const DEFAULT_HOURS: Record<WeekdayKey, DaySchedule> = {
  mon: { enabled: true,  open: '08:00', close: '18:00' },
  tue: { enabled: true,  open: '08:00', close: '18:00' },
  wed: { enabled: true,  open: '08:00', close: '18:00' },
  thu: { enabled: true,  open: '08:00', close: '18:00' },
  fri: { enabled: true,  open: '08:00', close: '17:00' },
  sat: { enabled: false, open: '08:00', close: '12:00' },
  sun: { enabled: false, open: '08:00', close: '12:00' },
};

const TOP_INSURANCE = [
  'Bradesco Saúde', 'Amil', 'SulAmérica', 'Unimed', 'Porto Seguro Saúde',
  'Hapvida', 'NotreDame Intermédica', 'Prevent Senior', 'Careplus', 'Sompo Saúde',
  'Bradesco Dental', 'Amil Dental', 'OdontoPrev', 'Metlife Dental', 'Porto Seguro Odonto',
  'Interodonto', 'Uniodonto', 'SulAmérica Odonto', 'Dental Uni', 'Golden Cross',
];

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, signOut, refreshClinics } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    cnpj: '',
    city: '',
    state: '',
    category: 'odonto' as string,
  });

  const [businessHours, setBusinessHours] = useState<Record<WeekdayKey, DaySchedule>>(DEFAULT_HOURS);
  const [consultDuration, setConsultDuration] = useState(30);
  const [selectedInsurance, setSelectedInsurance] = useState<string[]>([]);
  const [insuranceSearch, setInsuranceSearch] = useState('');
  const [onlineScheduling, setOnlineScheduling] = useState(true);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const fetchCnpj = async () => {
    const digits = form.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return; }
    setFetching(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name:  data.nome_fantasia || data.razao_social || prev.name,
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.phone,
        city:  data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success('Dados preenchidos automaticamente!');
    } catch {
      toast.error('Não foi possível buscar o CNPJ. Verifique e tente novamente.');
    } finally {
      setFetching(false);
    }
  };

  const toggleDay = (key: WeekdayKey) =>
    setBusinessHours(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));

  const updateDayTime = (key: WeekdayKey, field: 'open' | 'close', value: string) =>
    setBusinessHours(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const toggleInsurance = (name: string) =>
    setSelectedInsurance(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );

  const filteredInsurance = TOP_INSURANCE.filter(n =>
    n.toLowerCase().includes(insuranceSearch.toLowerCase())
  );

  // ── Criação da clínica (step 3 → 4) ─────────────────────────────────────────

  const handleCreateClinic = async () => {
    if (!form.name.trim()) { toast.error('Nome da clínica é obrigatório'); return; }
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-own-clinic', {
        body: {
          trade_name: form.name,
          phone:      form.phone || null,
          cnpj:       form.cnpj  || null,
          category:   form.category,
        },
      });
      if (error) throw error;
      const clinicId = (data as any)?.clinic_id ?? (data as any)?.id ?? null;
      setCreatedClinicId(clinicId);
      setStep(4);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Finalização: salva horários e configuração da IA ────────────────────────

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const clinicId = createdClinicId;

      // 1. Salva horários e cidade/estado no Supabase
      if (clinicId) {
        await supabase.from('clinics').update({
          business_hours: businessHours as any,
          city:  form.city  || null,
          state: form.state || null,
        }).eq('id', clinicId);

        // 2. Cria planos de convênio selecionados
        if (selectedInsurance.length > 0) {
          const rows = selectedInsurance.map(name => ({ clinic_id: clinicId, name, is_active: true }));
          await supabase.from('insurance_plans').insert(rows);
        }

        // 3. Sincroniza imediatamente com o backend da IA
        if (isAiBackendConfigured()) {
          await aiBackend.syncConfig({
            clinic_id:       clinicId,
            name:            form.name,
            business_hours:  businessHours,
            procedures:      [],
            insurance_plans: selectedInsurance.map(name => ({ id: name, name, code: null })),
            rooms:           [],
            doctors:         [],
          }).catch(() => null); // fire-and-forget — não bloqueia o onboarding
        }
      }

      toast.success('Clínica configurada! Bem-vindo ao IACLIN.');
      await refreshClinics();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const stepTitles = [
    'Tipo de clínica',
    'Dados básicos',
    'Localização',
    'Horários de atendimento',
    'Convênios e agenda',
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo ao IACLIN</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {step < TOTAL_STEPS
              ? 'Responda as perguntas abaixo para configurar sua clínica.'
              : 'Quase lá! Defina convênios e preferências de agenda.'}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Passo {step} de {TOTAL_STEPS} — {stepTitles[step - 1]}
          </p>
        </div>

        <Card className="shadow-card border-border/50">
          <CardContent className="pt-6 space-y-5">

            {/* ── Step 1: Tipo de clínica ── */}
            {step === 1 && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Qual é o tipo da sua clínica?</Label>
                  <p className="text-sm text-muted-foreground">Isso personaliza os módulos e o fluxo da secretária IA.</p>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const sel = form.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm({ ...form, category: cat.value })}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            sel ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            sel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${sel ? 'text-primary' : 'text-foreground'}`}>{cat.label}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                          {sel && <Check className="ml-auto h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={() => setStep(2)} className="w-full gap-2">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* ── Step 2: Dados básicos ── */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Clínica *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Clínica Sorriso" autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.cnpj}
                      onChange={e => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={fetchCnpj}
                      disabled={fetching || form.cnpj.replace(/\D/g, '').length !== 14}>
                      {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Digite o CNPJ e clique na lupa para preencher automaticamente</p>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
                  <Button onClick={() => { if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; } setStep(3); }} className="flex-1 gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 3: Localização + criar clínica ── */}
            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SP" maxLength={2} />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {categories.find(c => c.value === form.category)?.label}
                  </span>
                  <p className="text-sm font-medium mt-1">{form.name}</p>
                  {form.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {form.cnpj}</p>}
                  {form.phone && <p className="text-xs text-muted-foreground">Tel: {form.phone}</p>}
                  {(form.city || form.state) && (
                    <p className="text-xs text-muted-foreground">{[form.city, form.state].filter(Boolean).join(' - ')}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
                  <Button onClick={handleCreateClinic} disabled={saving} className="flex-1">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : 'Criar Clínica'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 4: Horários de atendimento ── */}
            {step === 4 && (
              <>
                <div className="space-y-1">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Quais são seus horários de atendimento?
                  </Label>
                  <p className="text-sm text-muted-foreground">A secretária IA usará esses horários para agendar consultas.</p>
                </div>

                <div className="space-y-2">
                  {WEEKDAYS.map(({ key, label }) => (
                    <div key={key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                      businessHours[key].enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'
                    }`}>
                      <Switch
                        checked={businessHours[key].enabled}
                        onCheckedChange={() => toggleDay(key)}
                      />
                      <span className={`w-14 shrink-0 text-sm font-medium ${businessHours[key].enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                      {businessHours[key].enabled ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <Input
                            type="time"
                            value={businessHours[key].open}
                            onChange={e => updateDayTime(key, 'open', e.target.value)}
                            className="h-7 w-[88px] text-xs px-1.5"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">às</span>
                          <Input
                            type="time"
                            value={businessHours[key].close}
                            onChange={e => updateDayTime(key, 'close', e.target.value)}
                            className="h-7 w-[88px] text-xs px-1.5"
                          />
                        </div>
                      ) : (
                        <span className="ml-auto text-xs text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Duração média da consulta</Label>
                  <div className="flex gap-2">
                    {[15, 20, 30, 45, 60, 90].map(min => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setConsultDuration(min)}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                          consultDuration === min
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {min}min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Voltar</Button>
                  <Button onClick={() => setStep(5)} className="flex-1 gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 5: Convênios + agenda online ── */}
            {step === 5 && (
              <>
                <div className="space-y-1">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                    Quais convênios você aceita?
                  </Label>
                  <p className="text-sm text-muted-foreground">Selecione os planos. Pode adicionar mais depois nas configurações.</p>
                </div>

                <Input
                  placeholder="Buscar convênio..."
                  value={insuranceSearch}
                  onChange={e => setInsuranceSearch(e.target.value)}
                  className="h-8 text-sm"
                />

                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {filteredInsurance.map(name => {
                    const sel = selectedInsurance.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleInsurance(name)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          sel ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {sel && <Check className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                  {filteredInsurance.length === 0 && (
                    <p className="col-span-2 py-3 text-center text-xs text-muted-foreground">Nenhum resultado</p>
                  )}
                </div>

                {selectedInsurance.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum selecionado — a clínica será configurada como particular.</p>
                )}

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Ativar agenda online</p>
                    <p className="text-xs text-muted-foreground">Pacientes poderão agendar pelo marketplace do IACLIN</p>
                  </div>
                  <Switch checked={onlineScheduling} onCheckedChange={setOnlineScheduling} />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Voltar</Button>
                  <Button onClick={handleFinish} disabled={saving} className="flex-1 gap-2">
                    {saving
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Configurando...</>
                      : <><Check className="h-4 w-4" />Concluir configuração</>}
                  </Button>
                </div>
              </>
            )}

          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Logado como {user?.email} ·{' '}
          <button onClick={signOut} className="underline hover:text-foreground transition-colors">Sair</button>
        </p>
      </div>
    </div>
  );
}
