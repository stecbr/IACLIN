import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, FileText, Loader2, AlertCircle, ArrowLeft, EyeOff, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildFullChartHtml, type FullChartData } from '@/lib/generateFullChartPdf';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PatientChartRedeem() {
  const navigate = useNavigate();
  const { user, clinics, currentClinicId } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartHtml, setChartHtml] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [fromPatient, setFromPatient] = useState(false);
  const [shareCode, setShareCode] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [importClinicId, setImportClinicId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Block browser print while viewer is open
  useEffect(() => {
    if (!chartHtml) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        e.preventDefault();
      }
    };
    const onBeforePrint = (e: Event) => { e.preventDefault?.(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeprint', onBeforePrint);
    document.body.classList.add('chart-viewer-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeprint', onBeforePrint);
      document.body.classList.remove('chart-viewer-open');
    };
  }, [chartHtml]);

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
      const chart = data as FullChartData;
      const html = await buildFullChartHtml(chart);
      setPatientName(chart.patient?.full_name ?? '');
      setChartHtml(html);
      setFromPatient(!!(data as any)?.from_patient);
      setShareCode(clean);
      setImportClinicId(currentClinicId);
    } catch (err: any) {
      setError(err.message ?? 'Não foi possível resgatar o prontuário.');
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-shared-patient', {
        body: { code: shareCode, clinic_id: importClinicId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Paciente adicionado com sucesso');
      setImportOpen(false);
      navigate(`/pacientes/${(data as any).patient_id}`);
    } catch (err: any) {
      toast.error('Não foi possível adicionar', { description: err.message });
    } finally {
      setImporting(false);
    }
  };

  if (chartHtml) {
    return (
      <div
        className="min-h-screen bg-muted/30"
        onContextMenu={(e) => e.preventDefault()}
      >
        <style>{`
          @media print {
            body.chart-viewer-open * { visibility: hidden !important; }
            body.chart-viewer-open::after {
              content: "Impressão bloqueada — visualização somente leitura.";
              visibility: visible; position: fixed; inset: 0;
              display: flex; align-items: center; justify-content: center;
              font-family: sans-serif; font-size: 18px;
            }
          }
          .chart-frame { user-select: none; -webkit-user-select: none; }
        `}</style>
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">Prontuário — {patientName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Somente leitura · salvar e imprimir desabilitados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {fromPatient && user && (
                <Button size="sm" onClick={() => setImportOpen(true)} className="gap-2">
                  <UserPlus className="h-3.5 w-3.5" />
                  Adicionar aos meus pacientes
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { setChartHtml(null); setCode(''); setFromPatient(false); }} className="gap-2">
                <X className="h-3.5 w-3.5" />
                Fechar
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          <div
            className="chart-frame bg-card border border-border rounded-lg shadow-sm overflow-hidden"
            onCopy={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <iframe
              title="Prontuário"
              sandbox=""
              srcDoc={chartHtml}
              className="w-full bg-white"
              style={{ height: 'calc(100vh - 120px)', border: 'none', pointerEvents: 'none' }}
            />
          </div>
        </div>

        <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Adicionar {patientName} aos seus pacientes?</AlertDialogTitle>
              <AlertDialogDescription>
                O paciente e o histórico clínico compartilhado serão importados para a clínica selecionada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {clinics.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Clínica de destino</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={importClinicId ?? ''}
                  onChange={(e) => setImportClinicId(e.target.value || null)}
                >
                  {clinics.map((c) => (
                    <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}</option>
                  ))}
                </select>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={importing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); runImport(); }} disabled={importing}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/prontuarios'))}
          className="gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card className="border-border/50 shadow-lg">
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
            <span>O acesso é temporário, auditado e somente para visualização. O download e a impressão estão desabilitados.</span>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}