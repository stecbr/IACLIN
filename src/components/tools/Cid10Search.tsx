import { useMemo, useState } from 'react';
import { Search, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CID10_DATA } from '@/lib/cid10Data';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function Cid10Search() {
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const results = useMemo(() => {
    const term = normalize(q.trim());
    if (!term) return CID10_DATA.slice(0, 30);
    return CID10_DATA.filter(
      (c) => normalize(c.code).includes(term) || normalize(c.description).includes(term)
    ).slice(0, 50);
  }, [q]);

  const copy = (item: { code: string; description: string }) => {
    const text = `${item.code} - ${item.description}`;
    navigator.clipboard.writeText(text);
    setCopied(item.code);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código (ex: F32) ou descrição (ex: hipertensão)"
          className="pl-9"
          autoFocus
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {results.length} resultado{results.length === 1 ? '' : 's'} — clique para copiar.
      </p>
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {results.map((item) => (
          <button
            key={item.code}
            onClick={() => copy(item)}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-6 min-w-[58px] items-center justify-center rounded-md bg-primary/10 text-primary text-[11px] font-bold tracking-wider px-1.5">
                {item.code}
              </span>
              <span className="text-sm truncate">{item.description}</span>
            </div>
            {copied === item.code ? (
              <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
            )}
          </button>
        ))}
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum CID encontrado.</p>
        )}
      </div>
    </div>
  );
}
