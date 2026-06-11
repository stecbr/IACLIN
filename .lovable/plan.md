# Plano — Ajustes no Mapa (Landing + Marketplace) estilo Doctoralia

## Problema atual
- **Bug:** ao clicar no mapa (marcador ou no botão de ampliar), ele entra em modo "fixed inset-0 z-50" cobrindo toda a tela. Ao sair desse modo, o layout do site quebra (mapa fica desproporcional, conteúdo embaixo some).
- Na landing, o clique em um pin não traz contexto útil (popup minúsculo, sem card).
- No marketplace, o mapa não acompanha o estilo Doctoralia: cards visíveis ao lado, marcador clicável que destaca o card correspondente, e vice-versa, sem ampliação em tela cheia.

## Comportamento desejado (referência Doctoralia)
1. **Mapa fixo** ao lado da lista — sem botão de "ampliar mapa em tela cheia". Quem decide o tamanho é o layout responsivo.
2. **Clicar num marcador** → abre um mini-card flutuante (foto + nome + clínica + botão "Ver perfil") sobre o mapa, **sem dar zoom agressivo** (mantém o zoom atual, só centraliza suavemente).
3. **Hover/clique num card da lista** → marcador correspondente é destacado (pulsa) e o mapa centraliza suavemente nele.
4. **Clicar no marcador** → também rola/destaca o card correspondente na lista.
5. Botão "Buscar nesta área" continua, no topo do mapa, ao mover.
6. **Mobile:** alternância lista ↔ mapa via botão (já existe), sem modo tela cheia.

## Mudanças por arquivo

### `src/components/marketplace/MarketplaceMap.tsx`
- Remover modo `expanded` (fixed inset-0) e os botões "Ampliar/Diminuir mapa" — fonte principal do bug visual.
- Remover a sidebar interna de doctors (já existe lista fora do mapa) — evita duplicação.
- Manter `focusClinic` mas trocar `setView(latlng, 16)` por `panTo(latlng)` (sem mudar zoom abruptamente) e usar `flyTo` suave.
- No `bindPopup`, renderizar um mini-card mais rico: avatar + nome do profissional + clínica + botão "Ver perfil" que navega ou rola até o card na lista (callback `onMarkerClick(clinicId)`).
- Adicionar prop `highlightedClinicId` para destacar marcador a partir de hover/click na lista.
- Manter "Buscar nesta área", controles de zoom no canto, e o gradiente superior.

### `src/pages/Marketplace.tsx`
- Passar `highlightedClinicId` e callback `onMarkerClick` ao `MarketplaceMap`.
- Ao clicar no marcador, rolar até o `DoctorCard` correspondente (`scrollIntoView`) e aplicar um realce temporário.
- Remover qualquer referência ao modo expandido.

### `src/components/marketplace/DoctorCard.tsx`
- Adicionar `id` no card raiz (`doctor-card-${clinicId}`) para permitir scroll.
- No `onMouseEnter` chamar `onHover?.(clinicId)` (nova prop opcional) para o pai destacar o marcador.

### `src/components/landing/LandingNetworkMap.tsx`
- Garantir `doubleClickZoom: false`, `scrollWheelZoom: false`, `boxZoom: false`, `touchZoom: false`, `dragging: true` para não permitir zoom acidental — o mapa da landing é apenas decorativo/exploratório.
- Trocar o popup atual por um card mais bonito (mesmo estilo do marketplace, sem botões — apenas info da clínica).
- Garantir altura fixa e `overflow-hidden` para evitar quebra de layout.
- Sem mudanças no fluxo de dados.

## Detalhes técnicos
- Leaflet: usar `map.flyTo(latlng, currentZoom, { duration: 0.6 })` em vez de `setView` com zoom alto.
- Highlight de marcador: trocar `icon` para `createHighlightIcon` enquanto o card correspondente estiver em hover; restaurar `createBlueIcon` ao sair.
- Scroll do card: `document.getElementById(...)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- Não tocar em lógica de geocoding, filtros, busca por área ou agendamento.

## Fora do escopo
- Mudanças na busca, filtros, agendamento, edge functions.
- Redesign visual completo dos cards de profissional.