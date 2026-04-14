import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface MarketplaceFiltersProps {
  cities: string[];
  selectedCity: string;
  onCitySelect: (city: string) => void;
}

export function MarketplaceFilters({ cities, selectedCity, onCitySelect }: MarketplaceFiltersProps) {
  return (
    <div className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium text-muted-foreground">Filtrar por cidade:</span>
        <Badge
          variant={selectedCity === "" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onCitySelect("")}
        >
          Todas
        </Badge>
        {cities.map((city) => (
          <Badge
            key={city}
            variant={selectedCity === city ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onCitySelect(city)}
          >
            {city}
          </Badge>
        ))}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Filtros de especialidade disponíveis em breve</span>
        </div>
      </div>
    </div>
  );
}
