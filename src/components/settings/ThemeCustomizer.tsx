import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomTheme, CustomThemeKey, CustomTheme } from '@/components/CustomThemeProvider';
import { RotateCcw, Palette, Sparkles } from 'lucide-react';

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
  {
    name: 'Vermelho Rubi',
    theme: {
      colors: { background: '#fff5f5', foreground: '#2a0a0d', primary: '#c81e3a', primaryForeground: '#ffffff', card: '#ffffff', accent: '#fde2e4', border: '#f8c6cc' },
      radius: 14, shadowIntensity: 12,
    },
  },
  {
    name: 'Vinho Bordeaux',
    theme: {
      colors: { background: '#faf3f4', foreground: '#2a0f15', primary: '#7b1e3a', primaryForeground: '#ffffff', card: '#ffffff', accent: '#ead4d8', border: '#dcb8c0' },
      radius: 12, shadowIntensity: 14,
    },
  },
  {
    name: 'Rosa Millennial',
    theme: {
      colors: { background: '#fff5f7', foreground: '#3a1f29', primary: '#e87aa0', primaryForeground: '#ffffff', card: '#ffffff', accent: '#fde0e8', border: '#f7c8d6' },
      radius: 20, shadowIntensity: 10,
    },
  },
  {
    name: 'Pink Vibrante',
    theme: {
      colors: { background: '#fff0f6', foreground: '#2e0a1f', primary: '#ec1f8a', primaryForeground: '#ffffff', card: '#ffffff', accent: '#fcd4e8', border: '#f9b3d4' },
      radius: 16, shadowIntensity: 16,
    },
  },
  {
    name: 'Magenta Berry',
    theme: {
      colors: { background: '#fbf3f8', foreground: '#2c0f25', primary: '#a4257a', primaryForeground: '#ffffff', card: '#ffffff', accent: '#f1d5e8', border: '#e3b6d4' },
      radius: 14, shadowIntensity: 12,
    },
  },
  {
    name: 'Coral Suave',
    theme: {
      colors: { background: '#fff5f2', foreground: '#3a1810', primary: '#ff6f61', primaryForeground: '#ffffff', card: '#ffffff', accent: '#ffd9d2', border: '#ffbeb3' },
      radius: 18, shadowIntensity: 12,
    },
  },
  {
    name: 'Lilás Lavanda',
    theme: {
      colors: { background: '#f7f4fb', foreground: '#241a3a', primary: '#9b7bd8', primaryForeground: '#ffffff', card: '#ffffff', accent: '#e6dcf5', border: '#cfc0ea' },
      radius: 18, shadowIntensity: 10,
    },
  },
  {
    name: 'Roxo Imperial',
    theme: {
      colors: { background: '#f6f3fb', foreground: '#1f0f3a', primary: '#6b21a8', primaryForeground: '#ffffff', card: '#ffffff', accent: '#e2d4f5', border: '#cbb3ea' },
      radius: 14, shadowIntensity: 14,
    },
  },
  {
    name: 'Violeta Profundo',
    theme: {
      colors: { background: '#f4f3fb', foreground: '#181133', primary: '#4c1d95', primaryForeground: '#ffffff', card: '#ffffff', accent: '#ddd6f3', border: '#c4b8ea' },
      radius: 12, shadowIntensity: 16,
    },
  },
  {
    name: 'Turquesa Tropical',
    theme: {
      colors: { background: '#f0fbfa', foreground: '#062a2a', primary: '#0ea5a4', primaryForeground: '#ffffff', card: '#ffffff', accent: '#cdf2ef', border: '#a6e4df' },
      radius: 16, shadowIntensity: 10,
    },
  },
  {
    name: 'Azul Marinho',
    theme: {
      colors: { background: '#f2f5fb', foreground: '#0a1730', primary: '#1e3a8a', primaryForeground: '#ffffff', card: '#ffffff', accent: '#d6dff2', border: '#b6c4e6' },
      radius: 10, shadowIntensity: 12,
    },
  },
  {
    name: 'Esmeralda',
    theme: {
      colors: { background: '#f0fbf4', foreground: '#062818', primary: '#059669', primaryForeground: '#ffffff', card: '#ffffff', accent: '#cdf2dd', border: '#a8e4c2' },
      radius: 14, shadowIntensity: 10,
    },
  },
  {
    name: 'Verde Menta',
    theme: {
      colors: { background: '#f3fbf7', foreground: '#0e2a1f', primary: '#52c4a0', primaryForeground: '#ffffff', card: '#ffffff', accent: '#d6f2e6', border: '#b6e4d0' },
      radius: 18, shadowIntensity: 8,
    },
  },
  {
    name: 'Amarelo Mostarda',
    theme: {
      colors: { background: '#fdfaf0', foreground: '#2e2208', primary: '#c79100', primaryForeground: '#ffffff', card: '#ffffff', accent: '#f7ead0', border: '#ecd9a8' },
      radius: 12, shadowIntensity: 12,
    },
  },
  {
    name: 'Âmbar Dourado',
    theme: {
      colors: { background: '#fffaf0', foreground: '#3a2408', primary: '#f59e0b', primaryForeground: '#ffffff', card: '#ffffff', accent: '#fde9c8', border: '#f7d49a' },
      radius: 16, shadowIntensity: 14,
    },
  },
  {
    name: 'Terracota Rústico',
    theme: {
      colors: { background: '#fbf4f0', foreground: '#2e1408', primary: '#b85c38', primaryForeground: '#ffffff', card: '#ffffff', accent: '#f0dccc', border: '#e3c1a8' },
      radius: 14, shadowIntensity: 12,
    },
  },
  {
    name: 'Café Expresso',
    theme: {
      colors: { background: '#faf6f2', foreground: '#1f1208', primary: '#5d3a1f', primaryForeground: '#ffffff', card: '#ffffff', accent: '#ebdfd1', border: '#d6c4ad' },
      radius: 10, shadowIntensity: 12,
    },
  },
  {
    name: 'Grafite Moderno',
    theme: {
      colors: { background: '#f5f6f8', foreground: '#111418', primary: '#374151', primaryForeground: '#ffffff', card: '#ffffff', accent: '#e2e5ea', border: '#cbd0d8' },
      radius: 10, shadowIntensity: 8,
    },
  },
  {
    name: 'Cinza Nórdico',
    theme: {
      colors: { background: '#f7f7f8', foreground: '#1c1f24', primary: '#6b7280', primaryForeground: '#ffffff', card: '#ffffff', accent: '#e8eaed', border: '#d2d5da' },
      radius: 8, shadowIntensity: 6,
    },
  },
  {
    name: 'Petróleo',
    theme: {
      colors: { background: '#f0f6f7', foreground: '#0a1f24', primary: '#155e75', primaryForeground: '#ffffff', card: '#ffffff', accent: '#d2e5ea', border: '#abccd4' },
      radius: 12, shadowIntensity: 12,
    },
  },
];

export function ThemeCustomizer() {
  const { applyPreset, resetCustom, hasCustom } = useCustomTheme();

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
          Escolha uma paleta pronta para personalizar a aparência. Aplicada somente no modo claro — o modo escuro continua usando o tema padrão.
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
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

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={resetCustom} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}