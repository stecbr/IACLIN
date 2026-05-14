import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Pipette } from 'lucide-react';

/* ─────────── color helpers ─────────── */
export function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}
export function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, v: v * 100 };
}
export function hsvToRgb(h: number, s: number, v: number) {
  s /= 100; v /= 100;
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
export function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}
export function hsvToHex(h: number, s: number, v: number) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}
/** WCAG relative luminance */
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
export function bestForeground(hex: string) {
  return luminance(hex) > 0.5 ? '#0a0a0a' : '#ffffff';
}
export function shadeRamp(hex: string) {
  const { h, s, v } = hexToHsv(hex);
  return [-40, -25, -10, 0, 12, 24, 36].map((d) =>
    hsvToHex(h, Math.max(0, Math.min(100, s - Math.abs(d) * 0.2)), Math.max(0, Math.min(100, v + d))),
  );
}
export function harmonyColors(hex: string) {
  const { h, s, v } = hexToHsv(hex);
  const at = (delta: number) => hsvToHex((h + delta + 360) % 360, s, v);
  return {
    complement: at(180),
    analogous: [at(-30), at(30)],
    triad: [at(120), at(240)],
  };
}

/* ─────────── component ─────────── */
interface Props {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  description?: string;
  showHarmony?: boolean;
  showRamp?: boolean;
}

export function PremiumColorPicker({ value, onChange, label, description, showHarmony, showRamp }: Props) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888';
  const [hsv, setHsv] = useState(() => hexToHsv(safe));
  const [hexInput, setHexInput] = useState(safe);
  const [open, setOpen] = useState(false);
  const svRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external value changes (e.g. preset applied).
  useEffect(() => {
    if (safe.toLowerCase() !== hsvToHex(hsv.h, hsv.s, hsv.v).toLowerCase()) {
      setHsv(hexToHsv(safe));
      setHexInput(safe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe]);

  const commit = (next: { h?: number; s?: number; v?: number }) => {
    const nh = { h: next.h ?? hsv.h, s: next.s ?? hsv.s, v: next.v ?? hsv.v };
    setHsv(nh);
    const hex = hsvToHex(nh.h, nh.s, nh.v);
    setHexInput(hex);
    onChange(hex);
  };

  const handleSV = (e: React.PointerEvent) => {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const move = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
      commit({ s: x * 100, v: (1 - y) * 100 });
    };
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const rgb = useMemo(() => hexToRgb(safe), [safe]);
  const harmony = useMemo(() => harmonyColors(safe), [safe]);
  const ramp = useMemo(() => shadeRamp(safe), [safe]);
  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex items-center gap-3 w-full p-2.5 rounded-xl border border-border/60',
                  'bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:bg-card transition-all',
                  'shadow-sm hover:shadow-md',
                )}
              >
                <span className="relative h-10 w-10 rounded-lg overflow-hidden border border-border/60 shadow-inner">
                  <span
                    className="absolute inset-0 transition-colors duration-300"
                    style={{ background: safe }}
                  />
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.25)' }}
                  >
                    <Pipette className="h-4 w-4 text-white drop-shadow" />
                  </span>
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-xs font-medium text-foreground/90 truncate">{label}</span>
                  <span className="block text-[11px] font-mono text-muted-foreground tracking-wide uppercase">{safe}</span>
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          {description && (
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {description}
            </TooltipContent>
          )}
        </Tooltip>

        <PopoverContent className="w-[300px] p-4 space-y-4 rounded-2xl border-border/60 backdrop-blur-xl bg-popover/95">
          {/* Saturation/Value square */}
          <div
            ref={svRef}
            onPointerDown={handleSV}
            className="relative h-44 w-full rounded-xl overflow-hidden cursor-crosshair shadow-inner border border-border/60"
            style={{ backgroundColor: hueColor }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #000, transparent)' }}
            />
            <div
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none transition-[left,top] duration-75"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                background: safe,
              }}
            />
          </div>

          {/* Hue slider */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Matiz</Label>
            <input
              type="range"
              min={0}
              max={360}
              value={hsv.h}
              onChange={(e) => commit({ h: Number(e.target.value) })}
              className="hue-slider w-full h-3 rounded-full appearance-none cursor-pointer outline-none"
            />
          </div>

          {/* Saturation slider */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Saturação</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={hsv.s}
              onChange={(e) => commit({ s: Number(e.target.value) })}
              className="w-full h-3 rounded-full appearance-none cursor-pointer outline-none"
              style={{
                background: `linear-gradient(to right, ${hsvToHex(hsv.h, 0, hsv.v)}, ${hsvToHex(hsv.h, 100, hsv.v)})`,
              }}
            />
          </div>

          {/* Brightness slider */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Brilho</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={hsv.v}
              onChange={(e) => commit({ v: Number(e.target.value) })}
              className="w-full h-3 rounded-full appearance-none cursor-pointer outline-none"
              style={{
                background: `linear-gradient(to right, #000, ${hsvToHex(hsv.h, hsv.s, 100)})`,
              }}
            />
          </div>

          {/* HEX + RGB inputs */}
          <div className="grid grid-cols-5 gap-2 pt-1">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">HEX</Label>
              <Input
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setHexInput(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    setHsv(hexToHsv(v));
                    onChange(v);
                  }
                }}
                className="h-8 text-xs font-mono uppercase"
              />
            </div>
            {(['r', 'g', 'b'] as const).map((k) => (
              <div key={k}>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.toUpperCase()}</Label>
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={Math.round(rgb[k])}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                    const next = { ...rgb, [k]: n };
                    const hex = rgbToHex(next.r, next.g, next.b);
                    setHexInput(hex);
                    setHsv(hexToHsv(hex));
                    onChange(hex);
                  }}
                  className="h-8 text-xs font-mono px-1.5 text-center"
                />
              </div>
            ))}
          </div>

          {/* Derived shades */}
          {showRamp && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tons derivados</Label>
              <div className="flex gap-1">
                {ramp.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setHsv(hexToHsv(c));
                      setHexInput(c);
                      onChange(c);
                    }}
                    className="flex-1 h-7 rounded-md border border-border/40 hover:scale-110 hover:z-10 transition-transform shadow-sm"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Harmony */}
          {showHarmony && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Harmonia</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Complementar', c: harmony.complement },
                  { label: 'Análoga 1', c: harmony.analogous[0] },
                  { label: 'Análoga 2', c: harmony.analogous[1] },
                  { label: 'Tríade 1', c: harmony.triad[0] },
                  { label: 'Tríade 2', c: harmony.triad[1] },
                ].map((h) => (
                  <Tooltip key={h.label}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          setHsv(hexToHsv(h.c));
                          setHexInput(h.c);
                          onChange(h.c);
                        }}
                        className="h-7 w-7 rounded-full border border-border/40 hover:scale-110 transition-transform shadow-sm"
                        style={{ background: h.c }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{h.label} · {h.c}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
