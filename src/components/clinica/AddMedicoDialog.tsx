import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getClinicTerms } from '@/lib/clinicTerms';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Mail, KeyRound, Check } from 'lucide-react';
import { useEffect } from 'react';
import {
  SpecialtySelect,
  registrationLabelForSpecialty,
  registrationPlaceholderForSpecialty,
  validateRegistrationForSpecialty,
} from '@/components/SpecialtySelect';
import { useSeatUsage } from '@/hooks/useSeatUsage';
import { SeatLimitDialog } from '@/components/settings/SeatLimitDialog';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMedicoDialog({ open, onOpenChange }: Props) {
  const { currentClinicId, clinicCategory } = useAuth();
  const terms = getClinicTerms(clinicCategory);
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', registration: '', specialty: '' });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const { usage, isAtLimit, refetch: refetchUsage } = useSeatUsage(currentClinicId);
  const [seatLimitOpen, setSeatLimitOpen] = useState(false);

  const reset = () => {
    setForm({ name: '', email: '', registration: '', specialty: '' });
    setInviteUrl(null);
    setLinkCopied(false);
  };

  useEffect(() => {
    if (!open || !currentClinicId) return;
    supabase.from('clinics').select('invite_code').eq('id', currentClinicId).maybeSingle().then(({ data, error }) => {
      if (error) { toast.error('Não foi possível carregar o código da clínica'); return; }
      setCode((data as any)?.invite_code ?? null);
    });
  }, [open, currentClinicId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinicId) return;
    if (isAtLimit) {
      setSeatLimitOpen(true);
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Preencha nome e e-mail');
      return;
    }
    if (!form.specialty.trim()) {
      toast.error('Selecione a especialidade do médico');
      return;
    }
    const regError = validateRegistrationForSpecialty(form.registration, form.specialty);
    if (regError) {
      toast.error(regError);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-clinic-invite', {
        body: {
          clinic_id: currentClinicId,
          email: form.email.trim(),
          full_name: form.name.trim(),
          specialty: form.specialty.trim() || null,
          registration_number: form.registration.trim() || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.code === 'seat_limit_reached') {
        await refetchUsage();
        setSeatLimitOpen(true);
        return;
      }
      setInviteUrl((data as any)?.invite_url ?? null);
      toast.success('Convite criado!', { description: 'Compartilhe o link com o médico.' });
      qc.invalidateQueries({ queryKey: ['clinic-invites'] });
      refetchUsage();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao criar convite';
      if (/seat_limit_reached|Limite do plano/i.test(msg)) {
        await refetchUsage();
        setSeatLimitOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{terms.addMember}</DialogTitle>
          <DialogDescription>
            Convide um {terms.teamMember.toLowerCase()} por e-mail ou compartilhe o código da clínica.
          </DialogDescription>
          {usage && (
            <div className="pt-1">
              <Badge variant={isAtLimit ? 'destructive' : 'outline'} className="font-normal">
                {usage.unlimited
                  ? `${usage.used} profissionais (ilimitado)`
                  : `${usage.used} de ${usage.limit} profissionais`}
                {usage.plan_name ? ` · ${usage.plan_name}` : ''}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite" className="gap-2"><Mail className="h-3.5 w-3.5" /> Convite</TabsTrigger>
            <TabsTrigger value="code" className="gap-2"><KeyRound className="h-3.5 w-3.5" /> Código</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4 pt-4">
            {inviteUrl ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm font-medium">Convite criado para {form.name}</p>
                  <p className="text-xs text-muted-foreground break-all font-mono">{inviteUrl}</p>
                </div>
                <Button onClick={copyInvite} className="w-full gap-2">
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {linkCopied ? 'Link copiado' : 'Copiar link'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { reset(); }}>Criar outro convite</Button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="med-name">Nome completo</Label>
                  <Input id="med-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={terms.namePlaceholder} required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="med-email">E-mail</Label>
                  <Input id="med-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="med-reg">{registrationLabelForSpecialty(form.specialty)}</Label>
                    <Input
                      id="med-reg"
                      value={form.registration}
                      onChange={(e) => setForm({ ...form, registration: e.target.value })}
                      placeholder={registrationPlaceholderForSpecialty(form.specialty)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="med-spec">Especialidade <span className="text-destructive">*</span></Label>
                    <SpecialtySelect
                      id="med-spec"
                      value={form.specialty}
                      onChange={(v) => setForm({ ...form, specialty: v })}
                      placeholder="Selecione"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button
                    type="submit"
                    disabled={submitting || !form.specialty.trim() || isAtLimit}
                    title={isAtLimit ? 'Limite do plano atingido' : undefined}
                  >
                    {submitting ? 'Criando…' : isAtLimit ? 'Limite atingido' : 'Criar convite'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4 pt-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3 text-center">
              <p className="text-xs text-muted-foreground">Código permanente da clínica</p>
              <code className="block text-2xl font-mono font-semibold tracking-widest">{code ?? '—'}</code>
              <p className="text-xs text-muted-foreground">
                Compartilhe com seus {terms.teamMembers.toLowerCase()}. Eles informam este código ao se cadastrar e ficam vinculados automaticamente.
              </p>
            </div>
            <Button onClick={copyCode} disabled={!code} className="w-full gap-2">
              {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {codeCopied ? 'Copiado' : 'Copiar código'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <SeatLimitDialog
      open={seatLimitOpen}
      onOpenChange={setSeatLimitOpen}
      used={usage?.used}
      limit={usage?.limit ?? null}
      planName={usage?.plan_name ?? null}
    />
    </>
  );
}