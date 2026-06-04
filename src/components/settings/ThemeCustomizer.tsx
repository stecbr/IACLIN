import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCustomTheme, CustomThemeKey, CustomTheme } from '@/components/CustomThemeProvider';
import { RotateCcw, Palette, Sparkles, Wand2 } from 'lucide-react';
import { PremiumColorPicker, bestForeground, shadeRamp } from './PremiumColorPicker';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const COLOR_FIELDS: {
  key: CustomThemeKey;
  label: string;
  fallback: string;
  description: string;
  group: 'surface' | 'brand' | 'detail';
}[] = [
  { key: 'background', label: 'Fundo', fallback: '#fafafa', description: 'Cor base de todas as telas. Influencia toda a atmosfera visual.', group: 'surface' },
  { key: 'card', label: 'Cartões', fallback: '#ffffff', description: 'Superfícies elevadas como cards, modais e popovers.', group: 'surface' },
  { key: 'foreground', label: 'Texto principal', fallback: '#15192a', description: 'Cor do texto sobre o fundo. Garanta contraste alto para legibilidade.', group: 'surface' },
  { key: 'primary', label: 'Cor primária', fallback: '#1f74e0', description: 'Identidade da marca. Usada em botões, links e elementos de destaque.', group: 'brand' },
  { key: 'primaryForeground', label: 'Texto sobre primária', fallback: '#ffffff', description: 'Texto exibido sobre a cor primária. Calculado automaticamente para contraste se ativado.', group: 'brand' },
  { key: 'accent', label: 'Destaque suave', fallback: '#eef2f7', description: 'Realce sutil em hovers, badges e seleções secundárias.', group: 'detail' },
  { key: 'border', label: 'Bordas', fallback: '#e5e7eb', description: 'Linhas divisórias, contornos e bordas de inputs.', group: 'detail' },
];

const PRESETS: { name: string; theme: Partial<CustomTheme> }[] = [
  {
    name: 'Oceano',
    theme: {
      colors: { background: '#f0f7ff', primary: '#0066cc', card: '#ffffff', accent: '#dbeafe', border: '#bfdbfe', foreground: '#0c1f3a', primaryForeground: '#ffffff' },
      radius: 16, shadowIntensity: 12,
    },
  },
  {
    name: 'Floresta',
    theme: {
      colors: { background: '#f3faf4', primary: '#16a34a', card: '#ffffff', accent: '#dcfce7', border: '#bbf7d0', foreground: '#0f2418', primaryForeground: '#ffffff' },
      radius: 12, shadowIntensity: 10,
    },
  },
  {
    name: 'Pôr-do-sol',
    theme: {
      colors: { background: '#fff7ed', primary: '#ea580c', card: '#fffaf3', accent: '#fed7aa', border: '#fdba74', foreground: '#3a1a05', primaryForeground: '#ffffff' },
      radius: 18, shadowIntensity: 18,
    },
  },
  {
    name: 'Minimalista',
    theme: {
      colors: { background: '#ffffff', primary: '#111111', card: '#ffffff', accent: '#f4f4f5', border: '#e4e4e7', foreground: '#0a0a0a', primaryForeground: '#ffffff' },
      radius: 6, shadowIntensity: 4,
    },
  },
  {
    name: 'Rosé Couture',
    theme: {
      colors: {
        background: '#fbf5f7',      // branco rosé translúcido
        foreground: '#3a2530',      // texto bordô suave, alta legibilidade
        primary: '#b97a8a',         // rosa queimado elegante
        primaryForeground: '#ffffff',
        card: '#ffffff',            // cards levemente flutuantes
        accent: '#efe2ec',          // lavanda/lilás suave
        border: '#ecd9e1',          // pétala discreta
      },
      radius: 18,
      shadowIntensity: 14,
    },
  },
];

export function ThemeCustomizer() {
  const { customTheme, setColor, setShadowIntensity, setRadius, applyPreset, resetCustom, hasCustom } = useCustomTheme();
  const [autoContrast, setAutoContrast] = useState(true);
  const { profile, user } = useAuth();
  const displayName =
    profile?.full_name?.trim() ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'você';

  const handleColorChange = (key: CustomThemeKey, hex: string) => {
    setColor(key, hex);
    if (autoContrast && key === 'primary') {
      setColor('primaryForeground', bestForeground(hex));
    }
    if (autoContrast && key === 'background') {
      setColor('foreground', bestForeground(hex));
    }
  };

  const primary = customTheme.colors.primary ?? '#1f74e0';
  const accent = customTheme.colors.accent ?? '#eef2f7';
  const accentFg = bestForeground(accent);
  const ramp = shadeRamp(primary);

  const renderGroup = (group: 'surface' | 'brand' | 'detail', title: string) => (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {COLOR_FIELDS.filter((f) => f.group === group).map((f) => (
          <PremiumColorPicker
            key={f.key}
            label={f.label}
            description={f.description}
            value={customTheme.colors[f.key] ?? f.fallback}
            onChange={(hex) => handleColorChange(f.key, hex)}
            showHarmony={f.key === 'primary'}
            showRamp={f.key === 'primary'}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Card className="shadow-card border-border/50 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/40">
            <Palette className="h-4 w-4 text-primary" />
          </span>
          Personalização avançada
          {hasCustom && <Badge variant="secondary" className="ml-2">Ativo</Badge>}
        </CardTitle>
        <CardDescription>
          Camada visual aplicada somente no modo claro. O modo escuro continua usando o tema padrão — a lua no topo sempre alterna entre claro e escuro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        {/* Presets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Paletas inteligentes
            </p>
            <span className="text-[11px] text-muted-foreground">Clique para aplicar</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.theme)}
                className="group relative flex flex-col gap-2 p-2.5 rounded-xl border border-border/60 hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5 transition-all bg-card/50 backdrop-blur-sm"
              >
                <span
                  className="h-12 w-full rounded-lg overflow-hidden flex shadow-inner"
                >
                  {(['background', 'card', 'primary', 'accent', 'foreground'] as CustomThemeKey[]).map((k) => (
                    <span
                      key={k}
                      className="flex-1 transition-transform group-hover:scale-y-110"
                      style={{ background: p.theme.colors?.[k] ?? '#ddd' }}
                    />
                  ))}
                </span>
                <span className="text-xs font-medium text-foreground/90 text-left truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Auto contrast switch */}
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-gradient-to-br from-accent/30 to-transparent px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            </span>
            <div>
              <p className="text-sm font-medium">Contraste automático</p>
              <p className="text-xs text-muted-foreground">Calcula texto claro ou escuro adequado às cores escolhidas.</p>
            </div>
          </div>
          <Switch checked={autoContrast} onCheckedChange={setAutoContrast} />
        </div>

        {/* Color groups */}
        <div className="space-y-5">
          {renderGroup('surface', 'Superfícies')}
          {renderGroup('brand', 'Identidade')}
          {renderGroup('detail', 'Detalhes')}
        </div>

        {/* Derived shades from primary */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">
            Tons derivados da primária
          </p>
          <div className="flex h-10 rounded-xl overflow-hidden border border-border/60 shadow-inner">
            {ramp.map((c, i) => (
              <div
                key={i}
                className="flex-1 transition-transform hover:scale-y-110"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Intensidade da sombra</Label>
              <span className="text-xs text-muted-foreground">{customTheme.shadowIntensity}%</span>
            </div>
            <Slider
              value={[customTheme.shadowIntensity]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setShadowIntensity(v[0])}
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Arredondamento</Label>
              <span className="text-xs text-muted-foreground">{customTheme.radius}px</span>
            </div>
            <Slider
              value={[customTheme.radius]}
              min={0}
              max={24}
              step={1}
              onValueChange={(v) => setRadius(v[0])}
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">
            Pré-visualização ao vivo
          </p>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-foreground">Olá, {displayName}</p>
                <p className="text-sm text-muted-foreground">Assim ficará a interface.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge>Novo</Badge>
                <Button size="sm">Primário</Button>
                <Button size="sm" variant="outline">Outline</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div
                className="rounded-lg p-3 text-xs"
                style={{ background: accent, color: accentFg }}
              >
                Destaque
              </div>
              <div className="rounded-lg border border-border p-3 text-xs">Borda</div>
              <div className="rounded-lg p-3 text-xs text-primary-foreground" style={{ background: primary }}>Primária</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={resetCustom} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}