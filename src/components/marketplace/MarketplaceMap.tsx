import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

const FORTALEZA_CENTER = { lat: -3.7172, lng: -38.5433 };

interface MarketplaceMapProps {
  className?: string;
}

function MapEmbed({ className }: { className?: string }) {
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${FORTALEZA_CENTER.lng - 0.05}%2C${FORTALEZA_CENTER.lat - 0.03}%2C${FORTALEZA_CENTER.lng + 0.05}%2C${FORTALEZA_CENTER.lat + 0.03}&layer=mapnik`;
  return (
    <iframe
      title="Mapa"
      src={src}
      className={className}
      style={{ border: 0, width: "100%", height: "100%" }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export function MarketplaceMap({ className }: MarketplaceMapProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">Mapa</span>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            <Minimize2 className="mr-1 h-4 w-4" />
            Reduzir
          </Button>
        </div>
        <div className="flex-1">
          <MapEmbed className="h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative h-full min-h-[400px] overflow-hidden rounded-lg border">
        <MapEmbed className="h-full w-full" />
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-3 right-3 z-[1000] shadow-md"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="mr-1 h-4 w-4" />
          Ampliar mapa
        </Button>
      </div>
    </div>
  );
}
