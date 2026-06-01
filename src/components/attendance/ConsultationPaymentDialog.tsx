import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Banknote, CreditCard, QrCode, Shield, Copy, CheckCircle2, SkipForward,
} from 'lucide-react';

interface PaymentAccount {
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_name?: string | null;
  account?: string | null;
  account_holder?: string | null;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  amount: number;
  patientName: string;
  patientInsuranceProvider?: string | null;
  paymentAccount?: PaymentAccount | null;
  insurancePlans: InsurancePlan[];
  onComplete: () => void;
}

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Celular', random: 'Chave aleatória',
};

const METHOD_OPTIONS = [
  { value: 'cash',      label: 'Dinheiro',   icon: Banknote,    color: 'text-green-600'  },
  { value: 'card',      label: 'Cartão',      icon: CreditCard,  color: 'text-blue-600'   },
  { value: 'pix',       label: 'PIX',         icon: QrCode,      color: 'text-emerald-600' },
  { value: 'insurance', label: 'Convênio',    icon: Shield,      color: 'text-violet-600' },
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
  toast.success('Chave PIX copiada!');
}

export function ConsultationPaymentDialog({
  open, onOpenChange, transactionId, amount, patientName,
  patientInsuranceProvider, paymentAccount, insurancePlans, onComplete,
}: Props) {
  const [method, setMethod]         = useState('');
  const [insurancePlan, setInsurancePlan] = useState(patientInsuranceProvider ?? '');
  const [saving, setSaving]         = useState(false);
  const [pixCopied, setPixCopied]   = useState(false);

  const isInsurance = method === 'insurance';
  const isPix       = method === 'pix';
  const canConfirm  = method && (isInsurance ? !!insurancePlan : true);

  const handleCopyPix = () => {
    if (paymentAccount?.pix_key) {
      copyToClipboard(paymentAccount.pix_key);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  const handleConfirm = async () => {
    if (!transactionId || !method) return;
    setSaving(true);
    try {
      const paymentMethodStr = method === 'insurance'
        ? `insurance:${insurancePlan}`
        : method;

      await supabase
        .from('financial_transactions')
        .update({
          payment_method: paymentMethodStr,
          status:    method === 'insurance' ? 'pending' : 'paid',
          paid_date: method === 'insurance' ? null : format(new Date(), 'yyyy-MM-dd'),
          notes:     method === 'insurance'
            ? `Convênio: ${insurancePlan} — aguardando repasse da operadora`
            : null,
        })
        .eq('id', transactionId);

      toast.success(
        method === 'insurance'
          ? `Registrado como convênio ${insurancePlan}. A operadora efetuará o repasse.`
          : 'Pagamento registrado!'
      );
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    toast.info('Pagamento será registrado depois em Financeiro.');
    onComplete();
  };

  // Merge patient insurance + clinic plans
  const allPlans: string[] = [];
  if (patientInsuranceProvider) allPlans.push(patientInsuranceProvider);
  insurancePlans.forEach((p) => { if (!allPlans.includes(p.name)) allPlans.push(p.name); });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Paciente</p>
          <p className="font-semibold">{patientName}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Valor da consulta</p>
            <Badge variant="secondary" className="text-base font-bold px-3 py-1">
              {formatCurrency(amount)}
            </Badge>
          </div>
        </div>

        {/* Método de pagamento */}
        <div className="space-y-2">
          <Label>Como o paciente vai pagar?</Label>
          <div className="grid grid-cols-2 gap-2">
            {METHOD_OPTIONS.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                  method === value
                    ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${method === value ? 'text-primary' : color}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* PIX: mostrar chave */}
        {isPix && paymentAccount?.pix_key && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Chave PIX para o paciente
            </p>
            {paymentAccount.pix_key_type && (
              <p className="text-[11px] text-muted-foreground">
                {PIX_TYPE_LABELS[paymentAccount.pix_key_type] ?? paymentAccount.pix_key_type}
              </p>
            )}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-background rounded-lg px-3 py-2 border border-border truncate">
                {paymentAccount.pix_key}
              </code>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="flex-shrink-0"
                onClick={handleCopyPix}
              >
                {pixCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {isPix && !paymentAccount?.pix_key && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Nenhuma chave PIX configurada. Configure em Configurações → Recebimentos.
          </div>
        )}

        {/* Convênio: selecionar operadora */}
        {isInsurance && (
          <div className="space-y-2">
            <Label>Operadora / Convênio</Label>
            {allPlans.length > 0 ? (
              <Select value={insurancePlan} onValueChange={setInsurancePlan}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio..." /></SelectTrigger>
                <SelectContent>
                  {allPlans.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum convênio cadastrado. Cadastre em Configurações → Convênios.
              </p>
            )}
            {insurancePlan && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/10 p-3">
                <p className="text-xs text-violet-700 dark:text-violet-400 font-medium">
                  A {insurancePlan} será responsável pelo pagamento.
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  O valor ficará pendente até o repasse da operadora.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleSkip}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Registrar depois
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2"
            disabled={!canConfirm || saving}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Registrando...' : 'Confirmar pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
