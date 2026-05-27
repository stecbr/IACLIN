import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, ArrowRight, Loader2, Search, Stethoscope, Heart, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const categories = [
  { value: 'odonto', label: 'Odontológico', icon: Heart, description: 'Clínica odontológica' },
  { value: 'medico', label: 'Médico', icon: Stethoscope, description: 'Clínica médica geral' },
  { value: 'estetica', label: 'Estética', icon: Heart, description: 'Estética e dermatologia' },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal, description: 'Outro tipo de clínica' },
] as const;

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    cnpj: '',
    city: '',
    state: '',
    category: 'odonto' as string,
  });

  const fetchCnpj = async () => {
    const digits = form.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name: data.nome_fantasia || data.razao_social || prev.name,
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.phone,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success('Dados preenchidos automaticamente!');
    } catch {
      toast.error('Não foi possível buscar o CNPJ. Verifique e tente novamente.');
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da clínica é obrigatório');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('create-own-clinic', {
        body: {
          trade_name: form.name,
          phone: form.phone || null,
          cnpj: form.cnpj || null,
          category: form.category,
        },
      });
      if (error) throw error;
      toast.success('Clínica criada com sucesso!');
      await refreshClinics();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo ao IACLIN</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Para começar, configure sua clínica. Você poderá editar essas informações depois.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Card className="shadow-card border-border/50">
          <CardContent className="pt-6 space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Tipo de Clínica</Label>
                  <p className="text-sm text-muted-foreground">Selecione a categoria para personalizar os módulos do sistema.</p>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const selected = form.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm({ ...form, category: cat.value })}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-muted/30'
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>{cat.label}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={() => setStep(2)} className="w-full gap-2">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Clínica *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Clínica Sorriso"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={fetchCnpj}
                      disabled={fetching || form.cnpj.replace(/\D/g, '').length !== 14}
                      title="Buscar dados pelo CNPJ"
                    >
                      {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Digite o CNPJ e clique na lupa para preencher automaticamente</p>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Voltar
                  </Button>
                  <Button
                    onClick={() => {
                      if (!form.name.trim()) {
                        toast.error('Nome da clínica é obrigatório');
                        return;
                      }
                      setStep(3);
                    }}
                    className="flex-1 gap-2"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="São Paulo"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {categories.find(c => c.value === form.category)?.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{form.name}</p>
                  {form.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {form.cnpj}</p>}
                  {form.phone && <p className="text-xs text-muted-foreground">Tel: {form.phone}</p>}
                  {(form.city || form.state) && (
                    <p className="text-xs text-muted-foreground">
                      {[form.city, form.state].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Voltar
                  </Button>
                  <Button onClick={handleCreate} disabled={saving} className="flex-1">
                    {saving ? 'Criando...' : 'Criar Clínica'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Logado como {user?.email} ·{' '}
          <button onClick={signOut} className="underline hover:text-foreground transition-colors">
            Sair
          </button>
        </p>
      </div>
    </div>
  );
}
