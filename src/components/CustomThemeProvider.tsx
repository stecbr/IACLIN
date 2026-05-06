import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type CustomThemeKey =
  | 'background'
  | 'foreground'
  | 'primary'
  | 'primaryForeground'
  | 'card'
  | 'accent'
  | 'border';

export interface CustomTheme {
  colors: Partial<Record<CustomThemeKey, string>>; // hex values
  shadowIntensity: number; // 0-100
  radius: number; // px
}

const DEFAULT_THEME: CustomTheme = {
  colors: {},
  shadowIntensity: 8,
  radius: 14,
};

interface Ctx {
  customTheme: CustomTheme;
  setColor: (key: CustomThemeKey, hex: string) => void;
  setShadowIntensity: (n: number) => void;
  setRadius: (n: number) => void;
  applyPreset: (preset: Partial<CustomTheme>) => void;
  resetCustom: () => void;
  hasCustom: boolean;
}

const CustomThemeContext = createContext<Ctx | undefined>(undefined);

function hexToHsl(hex: string): string | null {
  const m = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const VAR_MAP: Record<CustomThemeKey, string[]> = {
  background: ['--background'],
  foreground: ['--foreground', '--card-foreground', '--popover-foreground'],
  primary: ['--primary', '--ring', '--sidebar-primary'],
  primaryForeground: ['--primary-foreground', '--sidebar-primary-foreground'],
  card: ['--card', '--popover', '--sidebar-background'],
  accent: ['--accent', '--accent-foreground', '--secondary'],
  border: ['--border', '--input', '--sidebar-border'],
};

function applyTheme(theme: CustomTheme) {
  const root = document.documentElement;
  // Colors
  (Object.keys(VAR_MAP) as CustomThemeKey[]).forEach((key) => {
    const hex = theme.colors[key];
    const vars = VAR_MAP[key];
    if (hex) {
      const hsl = hexToHsl(hex);
      if (hsl) vars.forEach((v) => root.style.setProperty(v, hsl));
    } else {
      vars.forEach((v) => root.style.removeProperty(v));
    }
  });
  // Radius
  if (theme.radius != null) {
    root.style.setProperty('--radius', `${theme.radius}px`);
  } else {
    root.style.removeProperty('--radius');
  }
  // Shadow intensity
  const a = Math.max(0, Math.min(100, theme.shadowIntensity)) / 100;
  root.style.setProperty('--shadow-card', `0 1px 3px 0 hsla(0,0%,0%,${(a * 0.5).toFixed(3)}), 0 1px 2px -1px hsla(0,0%,0%,${(a * 0.5).toFixed(3)})`);
  root.style.setProperty('--shadow-card-hover', `0 4px 12px -2px hsla(0,0%,0%,${(a * 1.0).toFixed(3)}), 0 2px 4px -2px hsla(0,0%,0%,${(a * 0.5).toFixed(3)})`);
}

function clearTheme() {
  const root = document.documentElement;
  Object.values(VAR_MAP).flat().forEach((v) => root.style.removeProperty(v));
  root.style.removeProperty('--radius');
  root.style.removeProperty('--shadow-card');
  root.style.removeProperty('--shadow-card-hover');
}

function storageKey(userId: string | null | undefined) {
  return `iaclin-custom-theme:${userId ?? 'anon'}`;
}

export function CustomThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_THEME);
  const [hasCustom, setHasCustom] = useState(false);

  // Load on user change
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(user?.id));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CustomTheme;
        setCustomTheme({ ...DEFAULT_THEME, ...parsed });
        setHasCustom(true);
        applyTheme({ ...DEFAULT_THEME, ...parsed });
        return;
      } catch {}
    }
    setCustomTheme(DEFAULT_THEME);
    setHasCustom(false);
    clearTheme();
  }, [user?.id]);

  const persist = useCallback((theme: CustomTheme) => {
    localStorage.setItem(storageKey(user?.id), JSON.stringify(theme));
    setHasCustom(true);
    applyTheme(theme);
  }, [user?.id]);

  const setColor = (key: CustomThemeKey, hex: string) => {
    setCustomTheme((prev) => {
      const next = { ...prev, colors: { ...prev.colors, [key]: hex } };
      persist(next);
      return next;
    });
  };
  const setShadowIntensity = (n: number) => {
    setCustomTheme((prev) => {
      const next = { ...prev, shadowIntensity: n };
      persist(next);
      return next;
    });
  };
  const setRadius = (n: number) => {
    setCustomTheme((prev) => {
      const next = { ...prev, radius: n };
      persist(next);
      return next;
    });
  };
  const applyPreset = (preset: Partial<CustomTheme>) => {
    setCustomTheme((prev) => {
      const next: CustomTheme = {
        colors: { ...prev.colors, ...(preset.colors ?? {}) },
        shadowIntensity: preset.shadowIntensity ?? prev.shadowIntensity,
        radius: preset.radius ?? prev.radius,
      };
      persist(next);
      return next;
    });
  };
  const resetCustom = () => {
    localStorage.removeItem(storageKey(user?.id));
    setCustomTheme(DEFAULT_THEME);
    setHasCustom(false);
    clearTheme();
  };

  return (
    <CustomThemeContext.Provider value={{ customTheme, setColor, setShadowIntensity, setRadius, applyPreset, resetCustom, hasCustom }}>
      {children}
    </CustomThemeContext.Provider>
  );
}

export function useCustomTheme() {
  const ctx = useContext(CustomThemeContext);
  if (!ctx) throw new Error('useCustomTheme must be used within CustomThemeProvider');
  return ctx;
}