import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    cnpj: '',
    city: '',
    state: '',
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da clínica é obrigatório');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('clinics').insert({
        name: form.name,
        phone: form.phone || null,
        cnpj: form.cnpj || null,
        city: form.city || null,
        state: form.state || null,
        owner_id: user.id,
      });
      if (error) throw error;
      toast.success('Clínica criada com sucesso!');
      // Reload to refresh AuthContext with new clinic membership
      setTimeout(() => window.location.reload(), 500);
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
            Para começar, configure sua clínica odontológica. Você poderá editar essas informações depois.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Card className="shadow-card border-border/50">
          <CardContent className="pt-6 space-y-5">
            {step === 1 && (
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
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!form.name.trim()) {
                      toast.error('Nome da clínica é obrigatório');
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full gap-2"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {step === 2 && (
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
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
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
