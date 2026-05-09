import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Stethoscope, Heart, Baby, Sparkles, Brain, Bone, Eye, Smile,
  FileText, Pill, Activity, Flower2, HelpCircle, Sparkle, Wind, Syringe,
  Scale, ClipboardCheck, Scissors, Hand, Flame, Droplet, HeartHandshake,
  Dumbbell, Mic, Soup, Dna, Droplets, Leaf, Bug, Ribbon, Apple, Ear,
  HandHeart, PersonStanding,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface Specialty {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  category?: 'odonto' | 'medico' | 'estetica' | 'veterinario' | 'outro';
  popular?: boolean;
}

export const SPECIALTIES: Specialty[] = [
  // Popular shortcuts
  { id: 'clinico-geral', name: 'Clínico Geral', icon: Stethoscope, category: 'medico', popular: true },
  { id: 'dentista', name: 'Dentista', icon: Smile, category: 'odonto', popular: true },
  { id: 'limpeza-dental', name: 'Limpeza Dental', icon: Sparkles, category: 'odonto' },
  { id: 'renovacao-receitas', name: 'Renovação de Receitas', icon: Pill, category: 'medico' },
  { id: 'avaliacao', name: 'Avaliação', icon: FileText, category: 'medico' },

  // A
  { id: 'acupuntura', name: 'Acupuntura', icon: Sparkle, category: 'medico' },
  { id: 'alergologia', name: 'Alergologia', icon: Wind, category: 'medico' },
  { id: 'anestesiologia', name: 'Anestesiologia', icon: Syringe, category: 'medico' },
  { id: 'angiologia', name: 'Angiologia / Cirurgia Vascular', icon: Activity, category: 'medico' },
  { id: 'avaliacao-bariatrica', name: 'Avaliação Bariátrica', icon: Scale, category: 'medico' },
  { id: 'avaliacao-risco-cirurgico', name: 'Avaliação de Risco Cirúrgico', icon: ClipboardCheck, category: 'medico' },

  // C
  { id: 'cardiologia', name: 'Cardiologia', icon: Heart, category: 'medico', popular: true },
  { id: 'cirurgia-bucomaxilofacial', name: 'Cirurgia Bucomaxilofacial', icon: Scissors, category: 'odonto' },
  { id: 'cirurgia-cardiaca', name: 'Cirurgia Cardíaca / Hemodinâmica', icon: Heart, category: 'medico' },
  { id: 'cirurgia-cardiovascular', name: 'Cirurgia Cardiovascular', icon: Heart, category: 'medico' },
  { id: 'cirurgia-mao', name: 'Cirurgia da Mão', icon: Hand, category: 'medico' },
  { id: 'cirurgia-cabeca-pescoco', name: 'Cirurgia de Cabeça e Pescoço', icon: Scissors, category: 'medico' },
  { id: 'cirurgia-aparelho-digestivo', name: 'Cirurgia do Aparelho Digestivo', icon: Soup, category: 'medico' },
  { id: 'cirurgia-geral', name: 'Cirurgia Geral', icon: Scissors, category: 'medico' },
  { id: 'cirurgia-oncologica', name: 'Cirurgia Oncológica', icon: Ribbon, category: 'medico' },
  { id: 'cirurgia-plastica', name: 'Cirurgia Plástica', icon: Sparkles, category: 'estetica' },
  { id: 'cirurgia-toracica', name: 'Cirurgia Torácica', icon: Scissors, category: 'medico' },
  { id: 'cirurgia-vascular-periferica', name: 'Cirurgia Vascular Periférica', icon: Activity, category: 'medico' },

  // D
  { id: 'dermatologia', name: 'Dermatologia Clínica e Cirúrgica', icon: Hand, category: 'medico', popular: true },
  { id: 'dor-cabeca', name: 'Dor de Cabeça (Cefaleia)', icon: Brain, category: 'medico' },
  { id: 'dor-costas', name: 'Dor nas Costas (Lombalgia)', icon: PersonStanding, category: 'medico' },
  { id: 'dor-estomago', name: 'Dor no Estômago (Refluxo)', icon: Flame, category: 'medico' },

  // E
  { id: 'endocrinologia', name: 'Endocrinologia / Metabologia', icon: Droplet, category: 'medico' },
  { id: 'enfermagem-saude-familia', name: 'Enfermagem de Saúde da Família', icon: HeartHandshake, category: 'medico' },

  // F
  { id: 'fisioterapia', name: 'Fisioterapia', icon: Dumbbell, category: 'medico' },
  { id: 'fonoaudiologia', name: 'Fonoaudiologia', icon: Mic, category: 'medico' },

  // G
  { id: 'gastroenterologia', name: 'Gastroenterologia', icon: Soup, category: 'medico' },
  { id: 'genetica-medica', name: 'Genética Médica', icon: Dna, category: 'medico' },

  // H
  { id: 'hematologia', name: 'Hematologia', icon: Droplets, category: 'medico' },
  { id: 'homeopatia', name: 'Homeopatia', icon: Leaf, category: 'medico' },

  // I
  { id: 'infectologia', name: 'Infectologia', icon: Bug, category: 'medico' },

  // M
  { id: 'mastologia', name: 'Mastologia', icon: Ribbon, category: 'medico' },

  // N
  { id: 'nefrologia', name: 'Nefrologia', icon: Droplet, category: 'medico' },
  { id: 'neurocirurgia', name: 'Neurocirurgia', icon: Brain, category: 'medico' },
  { id: 'neurologia', name: 'Neurologia', icon: Brain, category: 'medico' },
  { id: 'nutricao', name: 'Nutrição', icon: Apple, category: 'medico' },
  { id: 'nutrologia', name: 'Nutrologia', icon: Apple, category: 'medico' },

  // O
  { id: 'oftalmologia', name: 'Oftalmologia - Geral', icon: Eye, category: 'medico' },
  { id: 'onco-hematologia', name: 'Onco-hematologia', icon: Ribbon, category: 'medico' },
  { id: 'oncologia-clinica', name: 'Oncologia Clínica / Quimioterapia', icon: Ribbon, category: 'medico' },
  { id: 'ortopedia-geral', name: 'Ortopedia e Traumatologia - Geral', icon: Bone, category: 'medico' },
  { id: 'ortopedia-mao', name: 'Ortopedia e Traumatologia - Mão', icon: Hand, category: 'medico' },
  { id: 'ortopedia-oncologica', name: 'Ortopedia e Traumatologia - Ortopedia Oncológica', icon: Bone, category: 'medico' },
  { id: 'ortopedia-pediatrica', name: 'Ortopedia e Traumatologia - Ortopedia Pediátrica', icon: Baby, category: 'medico' },
  { id: 'otorrinolaringologia', name: 'Otorrinolaringologia', icon: Ear, category: 'medico' },

  // P
  { id: 'pneumologia', name: 'Pneumologia', icon: Wind, category: 'medico' },
  { id: 'proctologia', name: 'Proctologia', icon: Stethoscope, category: 'medico' },
  { id: 'psicologia', name: 'Psicologia', icon: Brain, category: 'medico' },
  { id: 'psicomotricidade', name: 'Psicomotricidade', icon: Brain, category: 'medico' },
  { id: 'psicopedagogia', name: 'Psicopedagogia', icon: Brain, category: 'medico' },
  { id: 'psicoterapia', name: 'Psicoterapia', icon: Brain, category: 'medico' },
  { id: 'psiquiatria', name: 'Psiquiatria', icon: Brain, category: 'medico' },

  // R
  { id: 'reumatologia', name: 'Reumatologia', icon: Bone, category: 'medico' },

  // T
  { id: 'terapia-ocupacional', name: 'Terapia Ocupacional', icon: HandHeart, category: 'medico' },
  { id: 'triagem-fonoaudiologia', name: 'Triagem de Fonoaudiologia', icon: Mic, category: 'medico' },

  // U
  { id: 'urologia', name: 'Urologia', icon: Droplet, category: 'medico' },

  // Extras (kept from previous list — useful for medical clinics)
  { id: 'pediatra', name: 'Pediatra', icon: Baby, category: 'medico', popular: true },
  { id: 'ginecologista', name: 'Ginecologista', icon: Flower2, category: 'medico' },
  { id: 'estetica', name: 'Estética', icon: Sparkles, category: 'estetica' },
];

interface SpecialtyStepProps {
  onSelect: (s: Specialty) => void;
}

function SpecialtyCard({ s, i, onSelect }: { s: Specialty; i: number; onSelect: (s: Specialty) => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.25) }}
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
        <p className="text-sm font-semibold leading-tight">{s.name}</p>
        <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
          {s.category === 'odonto' ? 'Odontologia' : s.category === 'medico' ? 'Medicina' : s.category}
        </p>
      </div>
    </motion.button>
  );
}

export function SpecialtyStep({ onSelect }: SpecialtyStepProps) {
  const [query, setQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

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
            Mais procurados
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

      {query && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resultados ({filtered.length})
          </p>
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma especialidade encontrada para "{query}".
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((s, i) => (
                <SpecialtyCard key={s.id} s={s} i={i} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => setHelpOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
          Não encontrei a especialidade desejada
        </Button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center gap-4 pt-2">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <HelpCircle className="h-8 w-8" />
            </div>
            <DialogHeader className="space-y-2 text-center sm:text-center">
              <DialogTitle className="text-center">Não encontrou a especialidade?</DialogTitle>
              <DialogDescription className="text-center">
                Verifique com a sua rede de atendimento. Fale com o atendimento.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button className="w-full sm:w-auto" onClick={() => { /* layout only */ }}>
              Falar com atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
