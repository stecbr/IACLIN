import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getClinicTerms } from '@/lib/clinicTerms';
import { toast } from 'sonner';

export function ClinicInviteCodeCard() {
  const { currentClinicId, clinicCategory } = useAuth();
  const terms = getClinicTerms(clinicCategory);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentClinicId) return;
    supabase.from('clinics').select('invite_code').eq('id', currentClinicId).maybeSingle().then(({ data }) => {
      setCode((data as any)?.invite_code ?? null);
    });
  }, [currentClinicId]);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Código da clínica</p>
          <p className="text-xs text-muted-foreground">{terms.inviteMessage}</p>
        </div>
        <code className="px-3 py-1.5 rounded-md bg-background border font-mono text-sm font-semibold tracking-wider">
          {code}
        </code>
        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </CardContent>
    </Card>
  );
}