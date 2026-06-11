# Plano — Replicar interação do mapa Doctoralia na Landing (Rede Médica)

A landing já usa `MarketplaceMap` (em `src/components/landing/MarketplaceSection.tsx`), mas sem o highlight/scroll que já implementamos no `/marketplace`. Vou conectar os mesmos handlers.

## Mudanças em `src/components/landing/MarketplaceSection.tsx`
- Novo estado `highlightedClinicId` (string | null).
- Novo handler `handleMarkerClick(clinicId)`: seta highlight + `scrollIntoView` no card `doctor-card-${clinicId}` (já tem id pelo DoctorCard).
- `handleShowOnMap` deixa de chamar `focusClinic` direto e passa a apenas setar `highlightedClinicId` (que já dispara o pan suave no mapa). Continua abrindo o mapa em mobile.
- Passar `onMarkerClick={handleMarkerClick}` e `highlightedClinicId={highlightedClinicId}` ao `<MarketplaceMap />`.
- Passar `onHover={setHighlightedClinicId}` e `highlighted={highlightedClinicId === d.clinicId}` em cada `<DoctorCard />`.

## Resultado
- Clicar em "Ver no mapa" no card: o mapa centraliza suavemente (sem zoom agressivo) e o pin é destacado.
- Hover no card: pin pulsa, mapa segue.
- Clicar num pin: o card correspondente é destacado e rola para a viewport.

## Fora do escopo
- Nenhuma mudança em `LandingNetworkMap` (mapa decorativo do topo). O bug está só na seção Rede Médica, que usa `MarketplaceMap`.