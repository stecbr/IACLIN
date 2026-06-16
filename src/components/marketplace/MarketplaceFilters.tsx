import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Shield, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SPECIALTIES = [
  "Dentista",
  "Clínico Geral",
  "Cardiologia",
  "Dermatologia",
  "Pediatria",
  "Ginecologia",
  "Estética",
];

interface MarketplaceFiltersProps {
  selectedSpecialties: string[];
  onToggleSpecialty: (specialty: string) => void;
  selectedInsurance: string | null;
  onChangeInsurance: (name: string | null) => void;
}

export function MarketplaceFilters({
  selectedSpecialties,
  onToggleSpecialty,
  selectedInsurance,
  onChangeInsurance,
}: MarketplaceFiltersProps) {
  const [plans, setPlans] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("insurance_plans")
        .select("name")
        .eq("is_active", true);
      const names = Array.from(
        new Set(((data ?? []) as any[]).map((p) => (p.name ?? "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setPlans(names);
    })();
  }, []);

  const label = useMemo(
    () => selectedInsurance ?? "Todos os convênios",
    [selectedInsurance],
  );

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

        <div className="ml-auto flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium truncate max-w-[180px]">{label}</span>
                <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar convênio..." />
                <CommandList>
                  <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        onChangeInsurance(null);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !selectedInsurance ? "opacity-100" : "opacity-0")} />
                      Todos os convênios
                    </CommandItem>
                    {plans.map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => {
                          onChangeInsurance(name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedInsurance === name ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedInsurance && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground"
              onClick={() => onChangeInsurance(null)}
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
