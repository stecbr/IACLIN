import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useCustomTheme, CustomThemeKey, CustomTheme } from '@/components/CustomThemeProvider';
import { RotateCcw, Palette, Sparkles } from 'lucide-react';

const COLOR_FIELDS: { key: CustomThemeKey; label: string; fallback: string }[] = [
  { key: 'background', label: 'Fundo', fallback: '#fafafa' },
  { key: 'foreground', label: 'Texto', fallback: '#15192a' },
  { key: 'primary', label: 'Primária / Botões', fallback: '#1f74e0' },
  { key: 'primaryForeground', label: 'Texto dos botões', fallback: '#ffffff' },
  { key: 'card', label: 'Cartões', fallback: '#ffffff' },
  { key: 'accent', label: 'Destaque', fallback: '#eef2f7' },
  { key: 'border', label: 'Bordas', fallback: '#e5e7eb' },
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
    name: 'Noite Profunda',
    theme: {
      colors: { background: '#0b0f1a', primary: '#6366f1', card: '#121828', accent: '#1f2937', border: '#1f2937', foreground: '#e5e7eb', primaryForeground: '#ffffff' },
      radius: 14, shadowIntensity: 30,
    },
  },
];

export function ThemeCustomizer() {
  const { customTheme, setColor, setShadowIntensity, setRadius, applyPreset, resetCustom, hasCustom } = useCustomTheme();

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" /> Personalização avançada
          {hasCustom && <Badge variant="secondary" className="ml-2">Ativo</Badge>}
        </CardTitle>
        <CardDescription>
          Crie seu próprio visual. Para voltar ao padrão, use Claro/Escuro/Sistema acima ou clique em Restaurar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Presets */}
        <div>
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Paletas prontas
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.theme)}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary transition-colors text-sm"
              >
                <span className="flex -space-x-1">
                  {(['background', 'primary', 'accent', 'border'] as CustomThemeKey[]).map((k) => (
                    <span
                      key={k}
                      className="h-4 w-4 rounded-full border border-border"
                      style={{ backgroundColor: p.theme.colors?.[k] ?? '#ddd' }}
                    />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Color pickers */}
        <div>
          <p className="text-sm font-medium mb-3">Cores</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((f) => {
              const value = customTheme.colors[f.key] ?? f.fallback;
              return (
                <div key={f.key} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    className="h-9 w-12 rounded cursor-pointer border border-border bg-transparent"
                    aria-label={f.label}
                  />
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(f.key, v);
                      }}
                      className="block w-full text-sm font-mono bg-transparent outline-none"
                    />
                  </div>
                </div>
              );
            })}
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
          <p className="text-sm font-medium mb-3">Pré-visualização</p>
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Olá, {`{`}seu nome{`}`}</p>
                <p className="text-sm text-muted-foreground">Assim ficará a interface.</p>
              </div>
              <div className="flex gap-2">
                <Badge>Novo</Badge>
                <Button size="sm">Botão</Button>
                <Button size="sm" variant="outline">Outline</Button>
              </div>
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