import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, FileText, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { openFullChartPdf } from '@/lib/generateFullChartPdf';

export default function PatientChartRedeem() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setError('Digite os 6 dígitos do código.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-patient-chart', {
        body: { code: clean },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await openFullChartPdf(data as any);
    } catch (err: any) {
      setError(err.message ?? 'Não foi possível resgatar o prontuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Acessar prontuário compartilhado</h1>
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos enviado pelo profissional. O código expira em 5 minutos.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={7}
              placeholder="000 000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-2xl font-mono tracking-widest h-14"
            />

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Abrir prontuário
            </Button>
          </form>

          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border pt-4">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>O acesso é temporário e auditado. Após abrir, o PDF é exibido em uma nova aba pronto para impressão ou salvamento.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}