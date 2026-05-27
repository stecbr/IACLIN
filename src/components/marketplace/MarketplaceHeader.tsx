import { Search, MapPin, LayoutDashboard, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

interface MarketplaceHeaderProps {
  searchName: string;
  searchCity: string;
  onSearchNameChange: (v: string) => void;
  onSearchCityChange: (v: string) => void;
}

export function MarketplaceHeader({
  searchName,
  searchCity,
  onSearchNameChange,
  onSearchCityChange,
}: MarketplaceHeaderProps) {
  const { resolved } = useTheme();
  const { user, isPatient, profile } = useAuth();
  const logo = resolved === "dark" ? logoDark : logoLight;

  const firstName = (profile?.full_name ?? '').split(' ')[0];

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/marketplace" className="shrink-0">
          <img src={logo} alt="IACLIN" className="h-8 w-auto" />
        </Link>

        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-1.5 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Nome do profissional ou procedimento"
            value={searchName}
            onChange={(e) => onSearchNameChange(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <div className="mx-2 h-6 w-px bg-border" />
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Cidade"
            value={searchCity}
            onChange={(e) => onSearchCityChange(e.target.value)}
            className="h-8 max-w-[160px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user && isPatient ? (
            <>
              <span className="text-sm text-muted-foreground">Olá, {firstName || 'paciente'}</span>
              <Button size="sm" variant="outline" asChild className="gap-1.5">
                <Link to="/paciente"><LayoutDashboard className="h-4 w-4" /> Meu painel</Link>
              </Button>
            </>
          ) : (
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/auth"><LogIn className="h-4 w-4" /> Acesse a plataforma</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
