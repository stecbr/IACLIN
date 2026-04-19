import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Stethoscope, Heart, Baby, Sparkles, Brain, Bone, Eye, Smile,
  FileText, Pill, Activity, Flower2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Specialty {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  category?: 'odonto' | 'medico' | 'estetica' | 'veterinario' | 'outro';
  popular?: boolean;
}

export const SPECIALTIES: Specialty[] = [
  { id: 'clinico-geral', name: 'Clínico Geral', icon: Stethoscope, category: 'medico', popular: true },
  { id: 'dentista', name: 'Dentista', icon: Smile, category: 'odonto', popular: true },
  { id: 'limpeza-dental', name: 'Limpeza Dental', icon: Sparkles, category: 'odonto', popular: true },
  { id: 'renovacao-receita', name: 'Renovação de Receita', icon: Pill, category: 'medico', popular: true },
  { id: 'avaliacao', name: 'Avaliação', icon: FileText, category: 'medico', popular: true },
  { id: 'cardiologista', name: 'Cardiologista', icon: Heart, category: 'medico' },
  { id: 'dermatologista', name: 'Dermatologista', icon: Activity, category: 'medico' },
  { id: 'pediatra', name: 'Pediatra', icon: Baby, category: 'medico' },
  { id: 'ginecologista', name: 'Ginecologista', icon: Flower2, category: 'medico' },
  { id: 'neurologista', name: 'Neurologista', icon: Brain, category: 'medico' },
  { id: 'ortopedista', name: 'Ortopedista', icon: Bone, category: 'medico' },
  { id: 'oftalmologista', name: 'Oftalmologista', icon: Eye, category: 'medico' },
  { id: 'estetica', name: 'Estética', icon: Sparkles, category: 'estetica' },
];

interface SpecialtyStepProps {
  onSelect: (s: Specialty) => void;
}

export function SpecialtyStep({ onSelect }: SpecialtyStepProps) {
  const [query, setQuery] = useState('');

  const popular = useMemo(() => SPECIALTIES.filter((s) => s.popular), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SPECIALTIES;
    return SPECIALTIES.filter((s) => s.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">O que você procura?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha uma especialidade ou tipo de atendimento.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar especialidade..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {!query && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            🔥 Mais procurados
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {popular.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                onClick={() => onSelect(s)}
                className="flex items-center gap-2 p-3 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/40 hover:shadow-md transition-all text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium truncate">{s.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {query ? `Resultados (${filtered.length})` : 'Todas as especialidades'}
        </p>
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma especialidade encontrada para "{query}".
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => onSelect(s)}
                className={cn(
                  'group flex flex-col items-start gap-3 p-4 rounded-xl border border-border bg-card',
                  'hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left'
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center text-primary transition-colors">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                    {s.category === 'odonto' ? 'Odontologia' : s.category === 'medico' ? 'Medicina' : s.category}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
