import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Routes that must always render in light mode regardless of user preference. */
export const ALWAYS_LIGHT_PATHS = ['/', '/auth'];

export function isAlwaysLightPath(pathname?: string) {
  return ALWAYS_LIGHT_PATHS.includes(pathname ?? window.location.pathname);
}

function applyClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('iaclin-theme') as Theme | null;
    return stored ?? 'system';
  });

  const resolved: 'light' | 'dark' = theme === 'system' ? getSystemTheme() : theme;

  // Apply class synchronously on every resolved change
  useEffect(() => {
    // Skip: PublicRouteTheme handles public paths reactively
    if (isAlwaysLightPath()) return;
    applyClass(resolved);
    localStorage.setItem('iaclin-theme', theme);
  }, [theme, resolved]);

  // Apply immediately on mount — force light on public paths to avoid dark flash
  useEffect(() => {
    applyClass(isAlwaysLightPath() ? 'light' : resolved);
    localStorage.setItem('iaclin-theme', theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    // Apply immediately — don't wait for useEffect to avoid mobile lag
    const r: 'light' | 'dark' = t === 'system' ? getSystemTheme() : t;
    applyClass(r);
    localStorage.setItem('iaclin-theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
