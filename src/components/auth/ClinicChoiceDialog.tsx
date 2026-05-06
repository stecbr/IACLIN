import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, KeyRound, Loader2, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CODE_REGEX = /^CLIN-[A-Z2-9]{8}$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onConfirm: (code?: string) => void;
}

export function ClinicChoiceDialog({ open, onOpenChange, submitting, onConfirm }: Props) {
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatedClinic, setValidatedClinic] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setChoice(null);
      setCode('');
      setError(null);
      setValidatedClinic(null);
      setValidating(false);
    }
  }, [open]);

  const valid = CODE_REGEX.test(code.trim());

  const handleValidate = async () => {
    setError(null);
    setValidating(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('validate-clinic-code', {
        body: { code: code.trim().toUpperCase() },
      });
      if (fnErr || !data?.valid) {
        setError((data && data.error) || fnErr?.message || 'Código inválido.');
        setValidatedClinic(null);
        return;
      }
      setValidatedClinic(data.clinic_name ?? 'Clínica');
    } catch (err: any) {
      setError(err?.message || 'Erro ao validar código.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">Você faz parte de alguma clínica?</DialogTitle>
          <DialogDescription className="text-center">
            Antes de finalizar seu cadastro, conte como você vai usar a plataforma.
          </DialogDescription>
        </DialogHeader>

        {choice === null && (
          <div className="space-y-3 mt-2">
            <button
              type="button"
              onClick={() => setChoice('yes')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Sim, tenho um código</p>
                <p className="text-xs text-muted-foreground">Vou inserir o código da clínica que me convidou.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setChoice('no')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Não, quero meu próprio consultório</p>
                <p className="text-xs text-muted-foreground">Acesso completo: agenda, prontuário, financeiro e equipe.</p>
              </div>
            </button>
          </div>
        )}

        {choice === 'yes' && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Código da clínica</Label>
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => {
                  setError(null);
                  setValidatedClinic(null);
                  setCode(e.target.value.toUpperCase());
                }}
                placeholder="CLIN-XXXXXXXX"
                maxLength={13}
                className="h-10 font-mono tracking-wider"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Solicite o código de convite à sua clínica. O formato é <span className="font-mono">CLIN-XXXXXXXX</span>.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {validatedClinic && (
                <div className="flex items-center gap-2 text-xs text-foreground rounded-md bg-primary/5 border border-primary/20 p-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Clínica encontrada: <span className="font-medium">{validatedClinic}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setChoice(null); setError(null); setValidatedClinic(null); }}
                disabled={submitting}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
              {!validatedClinic ? (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleValidate}
                  disabled={!valid || validating}
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar código'}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => onConfirm(code.trim().toUpperCase())}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar e criar conta'}
                </Button>
              )}
            </div>
          </div>
        )}

        {choice === 'no' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Tudo certo! Você terá acesso completo ao seu próprio consultório, com agenda inteligente, prontuário, financeiro e gestão de equipe — exatamente como uma clínica.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setChoice(null)}
                disabled={submitting}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => onConfirm()}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar meu consultório'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}