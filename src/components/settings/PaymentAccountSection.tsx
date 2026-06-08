import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Building2, User, QrCode, Landmark, AlertCircle, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { BRAZILIAN_BANKS } from '@/lib/brazilianBanks';

type PaymentAccount = {
  id?: string;
  pix_key_type: string;
  pix_key: string;
  bank_name: string;
  bank_code: string;
  agency: string;
  agency_digit: string;
  account: string;
  account_digit: string;
  account_type: string;
  account_holder: string;
  account_holder_doc: string;
};

const EMPTY: PaymentAccount = {
  pix_key_type: '',
  pix_key: '',
  bank_name: '',
  bank_code: '',
  agency: '',
  agency_digit: '',
  account: '',
  account_digit: '',
  account_type: 'corrente',
  account_holder: '',
  account_holder_doc: '',
};

const PIX_KEY_LABELS: Record<string, string> = {
  cpf:    'CPF',
  cnpj:   'CNPJ',
  email:  'E-mail',
  phone:  'Celular',
  random: 'Chave aleatória',
};

const PIX_KEY_PLACEHOLDERS: Record<string, string> = {
  cpf:    '000.000.000-00',
  cnpj:   '00.000.000/0000-00',
  email:  'contato@email.com',
  phone:  '+55 (11) 99999-9999',
  random: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

export default function PaymentAccountSection() {
  const { user, currentClinicId, isPersonalMode } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentAccount>(EMPTY);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuery, setBankQuery] = useState('');

  // Entity: if linked to clinic → clinic; if solo → personal doctor
  const entityType = currentClinicId ? 'clinic' : 'doctor';
  const entityId   = currentClinicId ?? user?.id ?? '';

  const { data: account, isLoading } = useQuery({
    queryKey: ['payment-account', entityType, entityId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('payment_accounts')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
      return data as (PaymentAccount & { id: string }) | null;
    },
    enabled: !!entityId,
  });

  // Fetch clinic name for the banner
  const { data: clinicName } = useQuery({
    queryKey: ['clinic-name-payment', currentClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('name')
        .eq('id', currentClinicId!)
        .maybeSingle();
      return data?.name ?? null;
    },
    enabled: !!currentClinicId,
  });

  useEffect(() => {
    if (account) {
      setForm({
        id: account.id,
        pix_key_type:     account.pix_key_type    ?? '',
        pix_key:          account.pix_key          ?? '',
        bank_name:        account.bank_name        ?? '',
        bank_code:        account.bank_code        ?? '',
        agency:           account.agency           ?? '',
        agency_digit:     account.agency_digit     ?? '',
        account:          account.account          ?? '',
        account_digit:    account.account_digit    ?? '',
        account_type:     account.account_type     ?? 'corrente',
        account_holder:   account.account_holder   ?? '',
        account_holder_doc: account.account_holder_doc ?? '',
      });
    }
  }, [account]);

  const upd = (field: keyof PaymentAccount, val: string) =>
    setForm((p) => ({ ...p, [field]: val }));

  const filteredBanks = BRAZILIAN_BANKS.filter((b) => {
    if (!bankQuery.trim()) return true;
    const q = bankQuery.trim().toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.includes(q);
  });

  const hasPix  = !!(form.pix_key_type && form.pix_key);
  const hasBank = !!(form.bank_name && form.agency && form.account && form.account_holder);

  const handleSave = async () => {
    if (!entityId) return;

    // Validate PIX key format when type is CPF or CNPJ
    if (form.pix_key_type === 'cpf' && form.pix_key) {
      const digits = form.pix_key.replace(/\D/g, '');
      if (digits.length !== 11) {
        toast.error('CPF da chave PIX deve ter 11 dígitos');
        return;
      }
    }
    if (form.pix_key_type === 'cnpj' && form.pix_key) {
      const digits = form.pix_key.replace(/\D/g, '');
      if (digits.length !== 14) {
        toast.error('CNPJ da chave PIX deve ter 14 dígitos');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        entity_type: entityType,
        entity_id:   entityId,
        pix_key_type:       form.pix_key_type     || null,
        pix_key:            form.pix_key           || null,
        bank_name:          form.bank_name         || null,
        bank_code:          form.bank_code         || null,
        agency:             form.agency            || null,
        agency_digit:       form.agency_digit      || null,
        account:            form.account           || null,
        account_digit:      form.account_digit     || null,
        account_type:       form.account_type      || null,
        account_holder:     form.account_holder    || null,
        account_holder_doc: form.account_holder_doc || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from('payment_accounts')
        .upsert(payload, { onConflict: 'entity_type,entity_id' });
      if (error) throw error;
      toast.success('Dados de recebimento salvos!');
      queryClient.invalidateQueries({ queryKey: ['payment-account', entityType, entityId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner: quem recebe */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          {currentClinicId ? (
            <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          ) : (
            <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {currentClinicId
                ? `Recebimentos da clínica: ${clinicName ?? '...'}`
                : 'Recebimentos pessoais'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentClinicId
                ? 'Você está vinculado a uma clínica. Os valores das consultas vão para a conta da clínica configurada abaixo.'
                : 'Você está no modo pessoal. Os pagamentos das consultas vão direto para sua conta pessoal.'}
            </p>
          </div>
          <div className="ml-auto flex gap-2 flex-shrink-0">
            {hasPix  && <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-green-500" /> PIX</Badge>}
            {hasBank && <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-green-500" /> Banco</Badge>}
            {!hasPix && !hasBank && (
              <Badge variant="outline" className="gap-1 text-[10px] border-amber-500 text-amber-600">
                <AlertCircle className="h-3 w-3" /> Não configurado
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pix">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="pix" className="gap-1.5">
            <QrCode className="h-3.5 w-3.5" /> PIX
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" /> Conta Bancária
          </TabsTrigger>
        </TabsList>

        {/* ── PIX ── */}
        <TabsContent value="pix">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Chave PIX</CardTitle>
              <CardDescription>
                A chave PIX será exibida ao paciente na hora do pagamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de chave</Label>
                  <Select value={form.pix_key_type} onValueChange={(v) => upd('pix_key_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PIX_KEY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={form.pix_key}
                    onChange={(e) => upd('pix_key', e.target.value)}
                    placeholder={form.pix_key_type ? PIX_KEY_PLACEHOLDERS[form.pix_key_type] : 'Selecione o tipo primeiro'}
                    disabled={!form.pix_key_type}
                  />
                </div>
              </div>

              {hasPix && (
                <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800/30 p-4">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Chave configurada</p>
                  <p className="text-sm font-mono text-foreground">{form.pix_key}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{PIX_KEY_LABELS[form.pix_key_type]}</p>
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar PIX'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Conta Bancária ── */}
        <TabsContent value="bank">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Conta Bancária</CardTitle>
              <CardDescription>
                Para transferência bancária (TED/DOC). Usado para repasses de operadoras.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Popover open={bankOpen} onOpenChange={setBankOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        )}
                      >
                        <span className={cn('truncate', !form.bank_name && 'text-muted-foreground')}>
                          {form.bank_name
                            ? (form.bank_code ? `${form.bank_code} — ${form.bank_name}` : form.bank_name)
                            : 'Buscar banco...'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <div className="p-2 border-b">
                        <Input
                          autoFocus
                          value={bankQuery}
                          onChange={(e) => setBankQuery(e.target.value)}
                          placeholder="Buscar por nome ou código..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        {filteredBanks.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              upd('bank_name', bankQuery.trim());
                              upd('bank_code', '');
                              setBankOpen(false);
                            }}
                            className="w-full px-2 py-2 text-sm text-left hover:bg-accent rounded-sm"
                          >
                            Usar "{bankQuery.trim()}" como banco
                          </button>
                        ) : (
                          filteredBanks.map((b) => (
                            <button
                              key={b.code}
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, bank_name: b.name, bank_code: b.code }));
                                setBankOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground',
                                form.bank_code === b.code && 'bg-accent/60',
                              )}
                            >
                              <span className="font-mono text-xs text-muted-foreground w-10">{b.code}</span>
                              <span className="flex-1 truncate">{b.name}</span>
                              {form.bank_code === b.code && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Código do banco</Label>
                  <Input value={form.bank_code} onChange={(e) => upd('bank_code', e.target.value)} placeholder="Ex: 341" maxLength={5} readOnly={!!form.bank_code && BRAZILIAN_BANKS.some((b) => b.code === form.bank_code)} />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input value={form.agency} onChange={(e) => upd('agency', e.target.value)} placeholder="0000" />
                </div>
                <div className="space-y-2">
                  <Label>Dígito da agência</Label>
                  <Input value={form.agency_digit} onChange={(e) => upd('agency_digit', e.target.value)} placeholder="X" maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input value={form.account} onChange={(e) => upd('account', e.target.value)} placeholder="00000-0" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de conta</Label>
                  <Select value={form.account_type} onValueChange={(v) => upd('account_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Conta Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Titular da conta</Label>
                  <Input value={form.account_holder} onChange={(e) => upd('account_holder', e.target.value)} placeholder="Nome completo ou razão social" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>CPF / CNPJ do titular</Label>
                  <Input value={form.account_holder_doc} onChange={(e) => upd('account_holder_doc', e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar conta bancária'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
