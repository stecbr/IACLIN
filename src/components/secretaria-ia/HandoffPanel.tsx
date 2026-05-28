import { useEffect, useState } from 'react';
import { PhoneCall, Save, ShieldAlert, MessageCircleQuestion, ThumbsDown, UserCheck, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAiContext } from '@/hooks/useAiContext';
import { syncClinicConfig } from '@/hooks/useAiSync';

// ── Cenários pré-definidos → keywords geradas automaticamente ───────────────

const SCENARIOS = [
  {
    id: 'urgency',
    icon: ShieldAlert,
    label: 'Dor ou urgência',
    description: 'Paciente menciona dor forte, emergência ou situação urgente',
    keywords: ['urgência', 'urgencia', 'emergência', 'emergencia', 'dor forte', 'sangramento', 'acidente'],
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    bgSelected: 'bg-red-50 border-red-400',
  },
  {
    id: 'human_request',
    icon: UserCheck,
    label: 'Pedir atendente',
    description: 'Paciente quer falar com uma pessoa humana',
    keywords: ['atendente', 'humano', 'pessoa', 'falar com alguém', 'falar com alguem', 'secretária', 'secretaria'],
    color: 'text-blue-500',
    bg: 'bg-blue-50 border-blue-200',
    bgSelected: 'bg-blue-50 border-blue-400',
  },
  {
    id: 'complaint',
    icon: ThumbsDown,
    label: 'Reclamação',
    description: 'Paciente demonstra insatisfação ou faz reclamação',
    keywords: ['reclamação', 'reclamacao', 'absurdo', 'insatisfeito', 'péssimo', 'pessimo', 'horrível', 'horrivel'],
    color: 'text-orange-500',
    bg: 'bg-orange-50 border-orange-200',
    bgSelected: 'bg-orange-50 border-orange-400',
  },
  {
    id: 'doubt',
    icon: MessageCircleQuestion,
    label: 'Dúvida complexa',
    description: 'Paciente faz perguntas que a IA não consegue responder',
    keywords: ['não sei', 'nao sei', 'preciso de ajuda', 'pode me explicar melhor', 'não entendi', 'nao entendi'],
    color: 'text-purple-500',
    bg: 'bg-purple-50 border-purple-200',
    bgSelected: 'bg-purple-50 border-purple-400',
  },
] as const;

type ScenarioId = typeof SCENARIOS[number]['id'];

// Converte cenários selecionados → string de keywords para o backend
function scenariosToKeywords(selected: ScenarioId[]): string {
  const all = SCENARIOS
    .filter(s => selected.includes(s.id))
    .flatMap(s => s.keywords);
  return [...new Set(all)].join(',');
}

// Converte string de keywords salva → cenários selecionados
function keywordsToScenarios(keywords: string | null): ScenarioId[] {
  if (!keywords) return ['urgency', 'human_request'];
  const kws = keywords.toLowerCase().split(',').map(k => k.trim());
  return SCENARIOS
    .filter(s => s.keywords.some((k: string) => kws.includes(k)))
    .map(s => s.id);
}

// ── Componente ───────────────────────────────────────────────────────────────

export function HandoffPanel() {
  const aiCtx = useAiContext();
  const isProfessional = aiCtx.kind === 'professional';
  const aiTenantId = aiCtx.aiTenantId;
  const currentClinicId = aiCtx.clinicId;
  const queryClient = useQueryClient();

  const { data: handoff, isLoading } = useQuery({
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

  const [enabled, setEnabled] = useState(true);
  const [selectedScenarios, setSelectedScenarios] = useState<ScenarioId[]>(['urgency', 'human_request']);
  const [targetPhone, setTargetPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (handoff) {
      setEnabled(handoff.enabled ?? true);
      setSelectedScenarios(keywordsToScenarios(handoff.trigger_keywords ?? null));
      setTargetPhone(handoff.target_phone ?? '');
    }
  }, [handoff]);

  const toggleScenario = (id: ScenarioId) =>
    setSelectedScenarios(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  const save = async () => {
    if (isProfessional ? !aiTenantId : !currentClinicId) return;
    setSaving(true);

    const keywords = enabled ? scenariosToKeywords(selectedScenarios) : null;
    const handoffMessage = enabled
      ? 'Vou te transferir para um atendente. Aguarde um momento, por favor.'
      : null;

    const payload: any = {
      enabled,
      trigger_keywords: keywords,
      handoff_message: handoffMessage,
      target_phone: targetPhone.trim() || null,
      target_user_id: null,
    };
    if (isProfessional) payload.ai_tenant_id = aiTenantId;
    else payload.clinic_id = currentClinicId;

    const { error } = handoff?.id
      ? await supabase.from('ai_secretary_handoff').update(payload).eq('id', handoff.id)
      : await supabase.from('ai_secretary_handoff').insert(payload);

    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }

    toast.success('Configuração salva');
    queryClient.invalidateQueries({ queryKey: ['ai-handoff'] });
    if (currentClinicId) syncClinicConfig(currentClinicId);
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Quando chamar um atendente?</CardTitle>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <CardDescription>
          {enabled
            ? 'A IA vai chamar um humano automaticamente nas situações marcadas abaixo.'
            : 'Transferência desativada — a IA responde tudo sozinha.'}
        </CardDescription>
      </CardHeader>

      {isLoading ? (
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      ) : (
        <CardContent className="space-y-5">
          {/* Cenários */}
          <div
            className={`space-y-2 transition-opacity ${!enabled ? 'pointer-events-none opacity-40' : ''}`}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Situações que ativam a transferência
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SCENARIOS.map(({ id, icon: Icon, label, description, color, bg, bgSelected }) => {
                const sel = selectedScenarios.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleScenario(id)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      sel ? bgSelected + ' shadow-sm' : bg + ' opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
                    </div>
                    <div className={`ml-auto mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      sel ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    }`}>
                      {sel && (
                        <svg viewBox="0 0 16 16" fill="none" className="h-full w-full text-primary-foreground">
                          <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Telefone de destino */}
          <div className={`space-y-1.5 transition-opacity ${!enabled ? 'pointer-events-none opacity-40' : ''}`}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Quem recebe a transferência?
            </p>
            <div className="relative">
              <PhoneCall className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="(11) 99999-0000 — WhatsApp do responsável"
                value={targetPhone}
                onChange={e => setTargetPhone(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA avisa o paciente e notifica esse número quando transferir.
            </p>
          </div>

          {/* Preview do que vai acontecer */}
          {enabled && selectedScenarios.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como vai funcionar:</p>
              <p>
                Se o paciente mencionar{' '}
                <span className="font-medium text-foreground">
                  {SCENARIOS.filter(s => selectedScenarios.includes(s.id)).map(s => s.label.toLowerCase()).join(', ')}
                </span>
                , a IA responde:
              </p>
              <p className="italic border-l-2 border-primary/40 pl-2">
                "Vou te transferir para um atendente. Aguarde um momento, por favor."
              </p>
              {targetPhone && <p>E notifica <span className="font-medium text-foreground">{targetPhone}</span>.</p>}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button onClick={save} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
