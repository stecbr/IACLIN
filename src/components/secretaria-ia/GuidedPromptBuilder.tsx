import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  MessageCircle,
  Building2,
  ShieldAlert,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Wand2,
  Code2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------- Tipos ----------
export interface GuidedConfig {
  goals: string[];
  tone: string;
  hours: string;
  acceptsInsurance: boolean;
  insuranceList: string;
  urgencyRule: string;
  rules: string[];
  restrictions: string[];
  customRule: string;
  customRestriction: string;
}

interface Props {
  /** prompt atualmente salvo (string única — campo custom_prompt) */
  value: string;
  /** chamado sempre que o prompt final muda */
  onChange: (finalPrompt: string) => void;
  disabled?: boolean;
}

// ---------- Catálogos ----------
const GOAL_OPTIONS = [
  { id: 'agendar', label: 'Agendar consultas' },
  { id: 'confirmar', label: 'Confirmar presença' },
  { id: 'remarcar', label: 'Remarcar / cancelar' },
  { id: 'duvidas', label: 'Tirar dúvidas gerais' },
  { id: 'orcamento', label: 'Passar orçamento' },
  { id: 'lembrete', label: 'Enviar lembretes' },
];

const TONE_OPTIONS = [
  { id: 'acolhedor', label: 'Acolhedor', desc: 'Caloroso e empático' },
  { id: 'formal', label: 'Formal', desc: 'Profissional e respeitoso' },
  { id: 'direto', label: 'Direto', desc: 'Objetivo e rápido' },
  { id: 'comercial', label: 'Comercial', desc: 'Persuasivo e simpático' },
];

const RULE_SUGGESTIONS = [
  'Sempre perguntar o nome completo do paciente',
  'Confirmar dados antes de finalizar agendamento',
  'Oferecer o horário mais próximo disponível',
  'Em caso de urgência, encaminhar para o telefone da clínica',
];

const RESTRICTION_SUGGESTIONS = [
  'Nunca dar diagnóstico clínico',
  'Nunca prometer resultado de tratamento',
  'Não falar sobre preço sem confirmar com a recepção',
  'Não responder fora do horário de atendimento',
];

// ---------- Parser/Builder ----------
const MARKER = '<!--GUIDED_CONFIG_v1-->';

function buildPrompt(c: GuidedConfig): string {
  const goalsText = c.goals.length
    ? c.goals
        .map((id) => GOAL_OPTIONS.find((g) => g.id === id)?.label ?? id)
        .join(', ')
    : 'Atender pacientes da clínica';

  const toneLabel =
    TONE_OPTIONS.find((t) => t.id === c.tone)?.label ?? 'Acolhedor';

  const rulesAll = [...c.rules];
  if (c.customRule.trim()) rulesAll.push(c.customRule.trim());

  const restrictionsAll = [...c.restrictions];
  if (c.customRestriction.trim())
    restrictionsAll.push(c.customRestriction.trim());

  const lines: string[] = [];
  lines.push('Você é a secretária virtual da clínica.');
  lines.push('');
  lines.push(`OBJETIVO: ${goalsText}.`);
  lines.push(`TOM DE VOZ: ${toneLabel}.`);
  if (c.hours.trim()) lines.push(`HORÁRIO DE ATENDIMENTO: ${c.hours.trim()}.`);
  if (c.acceptsInsurance) {
    lines.push(
      `CONVÊNIOS: A clínica aceita convênios${
        c.insuranceList.trim() ? ` (${c.insuranceList.trim()})` : ''
      }.`
    );
  } else {
    lines.push('CONVÊNIOS: A clínica não aceita convênios (apenas particular).');
  }
  if (c.urgencyRule.trim()) lines.push(`URGÊNCIAS: ${c.urgencyRule.trim()}.`);

  if (rulesAll.length) {
    lines.push('');
    lines.push('REGRAS:');
    rulesAll.forEach((r) => lines.push(`- ${r}`));
  }
  if (restrictionsAll.length) {
    lines.push('');
    lines.push('NUNCA FAÇA:');
    restrictionsAll.forEach((r) => lines.push(`- ${r}`));
  }

  const body = lines.join('\n');
  const meta = `${MARKER}${JSON.stringify(c)}${MARKER}`;
  return `${body}\n\n${meta}`;
}

const DEFAULT_CONFIG: GuidedConfig = {
  goals: ['agendar', 'confirmar'],
  tone: 'acolhedor',
  hours: '',
  acceptsInsurance: true,
  insuranceList: '',
  urgencyRule: 'Em casos urgentes, orientar a ligar diretamente para a clínica',
  rules: [RULE_SUGGESTIONS[0], RULE_SUGGESTIONS[1]],
  restrictions: [RESTRICTION_SUGGESTIONS[0]],
  customRule: '',
  customRestriction: '',
};

function parsePrompt(prompt: string): GuidedConfig {
  if (!prompt) return DEFAULT_CONFIG;
  const match = prompt.match(
    new RegExp(`${MARKER}([\\s\\S]*?)${MARKER}`)
  );
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      // fallback
    }
  }
  return DEFAULT_CONFIG;
}

// ---------- Componente ----------
const STEPS = [
  { id: 0, label: 'Objetivo', icon: Target },
  { id: 1, label: 'Tom de voz', icon: MessageCircle },
  { id: 2, label: 'Sua clínica', icon: Building2 },
  { id: 3, label: 'Restrições', icon: ShieldAlert },
];

export function GuidedPromptBuilder({ value, onChange, disabled }: Props) {
  const [config, setConfig] = useState<GuidedConfig>(() => parsePrompt(value));
  const [step, setStep] = useState(0);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [advancedText, setAdvancedText] = useState(value);

  // Re-sync se valor externo mudar (ex.: load inicial)
  useEffect(() => {
    setConfig(parsePrompt(value));
    setAdvancedText(value);
  }, [value]);

  const finalPrompt = useMemo(() => buildPrompt(config), [config]);

  // Propaga para o pai
  useEffect(() => {
    if (!advancedMode) onChange(finalPrompt);
  }, [finalPrompt, advancedMode, onChange]);

  const updateConfig = <K extends keyof GuidedConfig>(
    key: K,
    val: GuidedConfig[K]
  ) => setConfig((c) => ({ ...c, [key]: val }));

  const toggleGoal = (id: string) => {
    setConfig((c) => ({
      ...c,
      goals: c.goals.includes(id)
        ? c.goals.filter((g) => g !== id)
        : [...c.goals, id],
    }));
  };

  const toggleRule = (rule: string) => {
    setConfig((c) => ({
      ...c,
      rules: c.rules.includes(rule)
        ? c.rules.filter((r) => r !== rule)
        : [...c.rules, rule],
    }));
  };

  const toggleRestriction = (r: string) => {
    setConfig((c) => ({
      ...c,
      restrictions: c.restrictions.includes(r)
        ? c.restrictions.filter((x) => x !== r)
        : [...c.restrictions, r],
    }));
  };

  // Validação amigável por etapa
  const stepValidation: Record<number, string | null> = {
    0: config.goals.length === 0 ? 'Escolha pelo menos um objetivo' : null,
    1: !config.tone ? 'Escolha um tom de voz' : null,
    2: !config.hours.trim() ? 'Informe o horário de atendimento' : null,
    3: null,
  };

  const charCount = finalPrompt.length;

  // ---------- Modo avançado ----------
  if (advancedMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code2 className="h-4 w-4" />
            Modo avançado — edite o prompt diretamente
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdvancedMode(false)}
          >
            Voltar ao modo guiado
          </Button>
        </div>
        <Textarea
          value={advancedText}
          onChange={(e) => {
            setAdvancedText(e.target.value);
            onChange(e.target.value);
          }}
          rows={14}
          className="font-mono text-sm resize-y"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground text-right">
          {advancedText.length} caracteres
        </p>
      </div>
    );
  }

  // ---------- Modo guiado ----------
  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition-all',
                isActive && 'bg-primary/10',
                !isActive && 'hover:bg-muted/60'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  isDone && 'border-primary/60 bg-primary/15 text-primary',
                  !isActive && !isDone && 'border-border bg-background text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium hidden sm:inline',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo da etapa */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="min-h-[260px]"
        >
          {step === 0 && (
            <StepGoals
              selected={config.goals}
              onToggle={toggleGoal}
              disabled={disabled}
            />
          )}
          {step === 1 && (
            <StepTone
              tone={config.tone}
              onChange={(t) => updateConfig('tone', t)}
              disabled={disabled}
            />
          )}
          {step === 2 && (
            <StepClinic
              config={config}
              update={updateConfig}
              disabled={disabled}
            />
          )}
          {step === 3 && (
            <StepRestrictions
              config={config}
              toggleRule={toggleRule}
              toggleRestriction={toggleRestriction}
              update={updateConfig}
              disabled={disabled}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Validação */}
      {stepValidation[step] && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {stepValidation[step]}
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Etapa {step + 1} de {STEPS.length}
        </span>
        {step < STEPS.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="gap-1"
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStep(0)}
            className="gap-1"
          >
            <Sparkles className="h-4 w-4" /> Revisar
          </Button>
        )}
      </div>

      {/* Prévia */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Prévia do comportamento da IA
            </div>
            <span className="text-[11px] text-muted-foreground">
              {charCount} caracteres
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <PreviewText config={config} />
          </p>
        </CardContent>
      </Card>

      {/* Modo avançado toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Wand2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Quer editar o prompt manualmente?
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAdvancedText(finalPrompt);
            setAdvancedMode(true);
          }}
        >
          Modo avançado
        </Button>
      </div>
    </div>
  );
}

// ---------- Sub-componentes por etapa ----------
function StepGoals({
  selected,
  onToggle,
  disabled,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">O que a IA deve fazer?</h3>
        <p className="text-sm text-muted-foreground">
          Selecione tudo o que ela vai cuidar no WhatsApp da clínica.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((g) => {
          const active = selected.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(g.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition-all',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              {active && <Check className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
              {g.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTone({
  tone,
  onChange,
  disabled,
}: {
  tone: string;
  onChange: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Como ela deve falar?</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o estilo de comunicação ideal para sua clínica.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TONE_OPTIONS.map((t) => {
          const active = tone === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                active
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-background hover:border-primary/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.label}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepClinic({
  config,
  update,
  disabled,
}: {
  config: GuidedConfig;
  update: <K extends keyof GuidedConfig>(k: K, v: GuidedConfig[K]) => void;
  disabled?: boolean;
}) {
  const examples = [
    'Seg a Sex, 8h às 18h. Sáb, 8h às 12h',
    'Seg a Sex, 9h às 19h',
    'Todos os dias, 8h às 20h',
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Sobre sua clínica</h3>
        <p className="text-sm text-muted-foreground">
          Essas informações ajudam a IA a responder corretamente.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hours" className="text-sm">
          Horário de atendimento
        </Label>
        <Input
          id="hours"
          placeholder="Ex.: Seg a Sex, 8h às 18h"
          value={config.hours}
          onChange={(e) => update('hours', e.target.value)}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => update('hours', ex)}
              className="text-[11px] rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
        <div>
          <Label className="text-sm">Aceita convênios?</Label>
          <p className="text-xs text-muted-foreground">
            A IA usará isso para responder dúvidas sobre planos.
          </p>
        </div>
        <Switch
          checked={config.acceptsInsurance}
          onCheckedChange={(v) => update('acceptsInsurance', v)}
          disabled={disabled}
        />
      </div>

      {config.acceptsInsurance && (
        <div className="space-y-1.5">
          <Label htmlFor="insurances" className="text-sm">
            Quais convênios? <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="insurances"
            placeholder="Ex.: Unimed, Amil, Bradesco Saúde"
            value={config.insuranceList}
            onChange={(e) => update('insuranceList', e.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="urgency" className="text-sm">
          Em caso de urgência, o que fazer?
        </Label>
        <Input
          id="urgency"
          placeholder="Ex.: Encaminhar para o telefone (11) 99999-9999"
          value={config.urgencyRule}
          onChange={(e) => update('urgencyRule', e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function StepRestrictions({
  config,
  toggleRule,
  toggleRestriction,
  update,
  disabled,
}: {
  config: GuidedConfig;
  toggleRule: (r: string) => void;
  toggleRestriction: (r: string) => void;
  update: <K extends keyof GuidedConfig>(k: K, v: GuidedConfig[K]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Regras e restrições</h3>
        <p className="text-sm text-muted-foreground">
          Defina o que ela deve sempre fazer e o que nunca pode fazer.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-primary" /> Sempre fazer
        </Label>
        <div className="flex flex-wrap gap-2">
          {RULE_SUGGESTIONS.map((r) => {
            const active = config.rules.includes(r);
            return (
              <button
                key={r}
                type="button"
                disabled={disabled}
                onClick={() => toggleRule(r)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-all',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
        <Input
          placeholder="Adicionar outra regra…"
          value={config.customRule}
          onChange={(e) => update('customRule', e.target.value)}
          disabled={disabled}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Nunca fazer
        </Label>
        <div className="flex flex-wrap gap-2">
          {RESTRICTION_SUGGESTIONS.map((r) => {
            const active = config.restrictions.includes(r);
            return (
              <button
                key={r}
                type="button"
                disabled={disabled}
                onClick={() => toggleRestriction(r)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-all',
                  active
                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                    : 'border-border bg-background text-muted-foreground hover:border-destructive/40'
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
        <Input
          placeholder="Adicionar outra restrição…"
          value={config.customRestriction}
          onChange={(e) => update('customRestriction', e.target.value)}
          disabled={disabled}
          className="text-sm"
        />
      </div>
    </div>
  );
}

function PreviewText({ config }: { config: GuidedConfig }) {
  const goals = config.goals
    .map((id) => GOAL_OPTIONS.find((g) => g.id === id)?.label.toLowerCase() ?? id)
    .join(', ');
  const tone =
    TONE_OPTIONS.find((t) => t.id === config.tone)?.label.toLowerCase() ?? 'acolhedor';
  return (
    <>
      Sua secretária IA vai atender pacientes de forma <strong>{tone}</strong>
      {goals ? (
        <>
          , focando em <strong>{goals}</strong>
        </>
      ) : null}
      {config.hours ? (
        <>
          . O horário informado é <strong>{config.hours}</strong>
        </>
      ) : null}
      {config.acceptsInsurance ? ' e a clínica aceita convênios' : ' (apenas particular)'}
      {config.restrictions.length
        ? `. Ela seguirá ${config.restrictions.length} restrição(ões) definidas.`
        : '.'}
    </>
  );
}
