import { useEffect, useState } from 'react';
import { ArrowLeft, Activity, Clock, UserCog, Save, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ClinicHoursSection, type BusinessHours } from '@/components/settings/ClinicHoursSection';

export default function SecretariaIAPainel() {
  const { currentClinicId } = useAuth();
  const queryClient = useQueryClient();

  // ---------- Business hours ----------
  const { data: clinic, isLoading: loadingClinic } = useQuery({
    queryKey: ['clinic-hours', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data, error } = await supabase
        .from('clinics')
        .select('business_hours')
        .eq('id', currentClinicId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinicId,
  });

  const [hours, setHours] = useState<BusinessHours | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (clinic?.business_hours) setHours(clinic.business_hours as unknown as BusinessHours);
  }, [clinic]);

  const saveHours = async () => {
    if (!currentClinicId || !hours) return;
    setSavingHours(true);
    const { error } = await supabase
      .from('clinics')
      .update({ business_hours: hours as any })
      .eq('id', currentClinicId);
    setSavingHours(false);
    if (error) {
      toast.error('Erro ao salvar horários');
      return;
    }
    toast.success('Horários atualizados');
    queryClient.invalidateQueries({ queryKey: ['clinic-hours', currentClinicId] });
  };

  // ---------- Handoff ----------
  const { data: handoff, isLoading: loadingHandoff } = useQuery({
    queryKey: ['ai-handoff', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data, error } = await supabase
        .from('ai_secretary_handoff')
        .select('*')
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinicId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['clinic-team', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data: cm } = await supabase
        .from('clinic_members')
        .select('user_id, role')
        .eq('clinic_id', currentClinicId);
      const ids = (cm ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      return (cm ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profiles?.find((p) => p.id === m.user_id)?.full_name ?? 'Sem nome',
      }));
    },
    enabled: !!currentClinicId,
  });

  const [handoffForm, setHandoffForm] = useState({
    enabled: true,
    target_user_id: '' as string,
    target_phone: '',
    trigger_keywords: '',
    handoff_message: 'Vou te transferir para um atendente humano. Aguarde um momento, por favor.',
  });
  const [savingHandoff, setSavingHandoff] = useState(false);

  useEffect(() => {
    if (handoff) {
      setHandoffForm({
        enabled: handoff.enabled,
        target_user_id: handoff.target_user_id ?? '',
        target_phone: handoff.target_phone ?? '',
        trigger_keywords: handoff.trigger_keywords ?? '',
        handoff_message: handoff.handoff_message ?? '',
      });
    }
  }, [handoff]);

  const saveHandoff = async () => {
    if (!currentClinicId) return;
    setSavingHandoff(true);
    const payload = {
      clinic_id: currentClinicId,
      enabled: handoffForm.enabled,
      target_user_id: handoffForm.target_user_id || null,
      target_phone: handoffForm.target_phone || null,
      trigger_keywords: handoffForm.trigger_keywords || null,
      handoff_message: handoffForm.handoff_message || null,
    };
    const { error } = handoff?.id
      ? await supabase.from('ai_secretary_handoff').update(payload).eq('id', handoff.id)
      : await supabase.from('ai_secretary_handoff').insert(payload);
    setSavingHandoff(false);
    if (error) {
      toast.error('Erro ao salvar encaminhamento');
      return;
    }
    toast.success('Encaminhamento atualizado');
    queryClient.invalidateQueries({ queryKey: ['ai-handoff', currentClinicId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/secretaria-ia">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel da IA</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe e configure sua secretária virtual.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Horário de atendimento */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Horário de atendimento</CardTitle>
            </div>
            <CardDescription>
              A IA responderá considerando estes horários. Fora do expediente, ela informa o paciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingClinic ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <ClinicHoursSection value={hours} onChange={setHours} />
                <div className="flex justify-end">
                  <Button onClick={saveHours} disabled={savingHours} size="sm" className="gap-2">
                    <Save className="h-4 w-4" />
                    {savingHours ? 'Salvando...' : 'Salvar horários'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Encaminhamento humano */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Encaminhamento para humano</CardTitle>
            </div>
            <CardDescription>
              Defina quando e para quem a IA deve transferir a conversa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingHandoff ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">Encaminhamento ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Permite que a IA transfira para um atendente humano.
                    </p>
                  </div>
                  <Switch
                    checked={handoffForm.enabled}
                    onCheckedChange={(v) => setHandoffForm((f) => ({ ...f, enabled: v }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Atendente responsável</Label>
                  <Select
                    value={handoffForm.target_user_id || 'none'}
                    onValueChange={(v) =>
                      setHandoffForm((f) => ({ ...f, target_user_id: v === 'none' ? '' : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um membro da equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (usar telefone alternativo)</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name} <span className="text-muted-foreground">· {m.role}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Telefone alternativo (WhatsApp)</Label>
                  <Input
                    placeholder="+55 11 99999-0000"
                    value={handoffForm.target_phone}
                    onChange={(e) => setHandoffForm((f) => ({ ...f, target_phone: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado quando nenhum atendente está disponível.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Palavras-gatilho</Label>
                  <Input
                    placeholder="atendente, humano, falar com pessoa, urgente"
                    value={handoffForm.trigger_keywords}
                    onChange={(e) =>
                      setHandoffForm((f) => ({ ...f, trigger_keywords: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Separadas por vírgula. Quando o paciente usar uma delas, a IA transfere.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Mensagem de transferência</Label>
                  <Textarea
                    rows={3}
                    value={handoffForm.handoff_message}
                    onChange={(e) =>
                      setHandoffForm((f) => ({ ...f, handoff_message: e.target.value }))
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveHandoff} disabled={savingHandoff} size="sm" className="gap-2">
                    <Save className="h-4 w-4" />
                    {savingHandoff ? 'Salvando...' : 'Salvar encaminhamento'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Métricas (placeholder) */}
        <Card className="rounded-xl shadow-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Atividade</CardTitle>
            </div>
            <CardDescription>Métricas de atendimento em tempo real.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Em breve: conversas, taxa de resolução e tempo médio de resposta.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
