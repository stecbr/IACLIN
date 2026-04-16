import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

const SPECIALTIES = [
  "Clínico Geral",
  "Ortodontia",
  "Implantodontia",
  "Endodontia",
  "Periodontia",
  "Prótese",
  "Cirurgia",
  "Estética",
];

interface MarketplaceFiltersProps {
  selectedSpecialties: string[];
  onToggleSpecialty: (specialty: string) => void;
}

export function MarketplaceFilters({ selectedSpecialties, onToggleSpecialty }: MarketplaceFiltersProps) {
  return (
    <div className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium text-muted-foreground">Especialidades:</span>
        {SPECIALTIES.map((spec) => (
          <Badge
            key={spec}
            variant={selectedSpecialties.includes(spec) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onToggleSpecialty(spec)}
          >
            {spec}
          </Badge>
        ))}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Filtro por especialidade disponível em breve</span>
        </div>
      </div>
    </div>
  );
}
