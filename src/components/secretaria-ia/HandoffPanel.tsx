import { useEffect, useState } from 'react';
import { UserCog, Save } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAiContext } from '@/hooks/useAiContext';
import { syncClinicConfig } from '@/hooks/useAiSync';

export function HandoffPanel() {
  const aiCtx = useAiContext();
  const isProfessional = aiCtx.kind === 'professional';
  const aiTenantId = aiCtx.aiTenantId;
  const currentClinicId = aiCtx.clinicId;
  const queryClient = useQueryClient();

  const { data: handoff, isLoading: loadingHandoff } = useQuery({
    queryKey: ['ai-handoff', aiCtx.kind, currentClinicId, aiTenantId],
    queryFn: async () => {
      const q = supabase.from('ai_secretary_handoff').select('*');
      const { data, error } = isProfessional
        ? await q.eq('ai_tenant_id', aiTenantId!).maybeSingle()
        : await q.eq('clinic_id', currentClinicId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: aiCtx.ready && (isProfessional ? !!aiTenantId : !!currentClinicId),
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

  const [form, setForm] = useState({
    enabled: true,
    target_user_id: '' as string,
    target_phone: '',
    trigger_keywords: '',
    handoff_message: 'Vou te transferir para um atendente humano. Aguarde um momento, por favor.',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (handoff) {
      setForm({
        enabled: handoff.enabled,
        target_user_id: handoff.target_user_id ?? '',
        target_phone: handoff.target_phone ?? '',
        trigger_keywords: handoff.trigger_keywords ?? '',
        handoff_message: handoff.handoff_message ?? '',
      });
    }
  }, [handoff]);

  const save = async () => {
    if (isProfessional ? !aiTenantId : !currentClinicId) return;
    setSaving(true);
    const payload: any = {
      enabled: form.enabled,
      target_user_id: form.target_user_id || null,
      target_phone: form.target_phone || null,
      trigger_keywords: form.trigger_keywords || null,
      handoff_message: form.handoff_message || null,
    };
    if (isProfessional) payload.ai_tenant_id = aiTenantId;
    else payload.clinic_id = currentClinicId;
    const { error } = handoff?.id
      ? await supabase.from('ai_secretary_handoff').update(payload).eq('id', handoff.id)
      : await supabase.from('ai_secretary_handoff').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar encaminhamento');
      return;
    }
    toast.success('Encaminhamento atualizado');
    queryClient.invalidateQueries({ queryKey: ['ai-handoff'] });
    // Sincroniza handoff com o backend da IA (fire-and-forget)
    if (currentClinicId) syncClinicConfig(currentClinicId);
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Atendimento humano</CardTitle>
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
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>

            {!isProfessional && (
              <div className="space-y-2">
                <Label className="text-sm">Atendente responsável</Label>
                <Select
                  value={form.target_user_id || 'none'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, target_user_id: v === 'none' ? '' : v }))
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
            )}

            <div className="space-y-2">
              <Label className="text-sm">Telefone alternativo (WhatsApp)</Label>
              <Input
                placeholder="+55 11 99999-0000"
                value={form.target_phone}
                onChange={(e) => setForm((f) => ({ ...f, target_phone: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Usado quando nenhum atendente está disponível.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Palavras-gatilho</Label>
              <Input
                placeholder="atendente, humano, falar com pessoa, urgente"
                value={form.trigger_keywords}
                onChange={(e) => setForm((f) => ({ ...f, trigger_keywords: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Separadas por vírgula. Quando o paciente usar uma delas, a IA transfere.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Mensagem de transferência</Label>
              <Textarea
                rows={3}
                value={form.handoff_message}
                onChange={(e) => setForm((f) => ({ ...f, handoff_message: e.target.value }))}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar encaminhamento'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
