## Objetivo
1. Corrigir o erro "Could not find the 'address' column of 'profiles'" ao salvar o perfil (o formulário tenta gravar endereço, mas a tabela `profiles` não tem essas colunas).
2. Fazer com que o pino no mapa (marketplace e tela inicial) apareça no endereço exato da rua/número da clínica, e não só no centro da cidade.

## O que será feito

### 1. Backend — adicionar campos de endereço ao perfil
Migração para acrescentar à tabela `profiles` as colunas:
- `address` (logradouro), `address_number`, `address_complement`, `neighborhood`, `city`, `state`, `zip_code`

Isso destrava o salvamento do perfil que já tenta gravar esses campos.

### 2. Geocodificação mais precisa
Atualizar `src/lib/geocode.ts` para aceitar e usar também **número** e **bairro**, montando a busca estruturada no Nominatim com `street = "{logradouro}, {número}"` e `suburb = bairro`. Manter fallback atual (texto livre → cidade/estado) só quando a busca exata falhar, garantindo que o pino caia no endereço quando os dados estiverem completos.

### 3. Passar os campos completos para o mapa
- `src/components/marketplace/MarketplaceMap.tsx`: incluir `address_number` e `neighborhood` no objeto `ClinicGeoData` e repassar à função de geocode.
- `src/pages/Marketplace.tsx` e `src/components/landing/MarketplaceSection.tsx`: ao montar a lista de clínicas para o mapa, ler os novos campos do registro de `clinics` e passar adiante.
- Atualizar o texto do endereço mostrado no `DoctorCard` para incluir número/bairro quando existirem (ex.: "Rua 2, 37 — Canindezinho").

### 4. Cache invalidado
Como a chave do cache do geocode já é a concatenação dos campos, ao incluir número/bairro a chave muda automaticamente e novas buscas serão feitas — sem necessidade de limpar nada manualmente.

## Fora do escopo
- Não alteramos a lógica do `ClinicsMapWidget` do superadmin (continua por cidade/estado, que é o desejado para visão macro).
- Não mexemos em agenda, slots, RLS ou lógica de negócios.

## Arquivos afetados
- Nova migração em `supabase/migrations/`
- `src/lib/geocode.ts`
- `src/components/marketplace/MarketplaceMap.tsx`
- `src/pages/Marketplace.tsx`
- `src/components/landing/MarketplaceSection.tsx`
- `src/components/marketplace/DoctorCard.tsx` (apenas exibição do endereço)
