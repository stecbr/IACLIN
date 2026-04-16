

# Adicionar CEP nas Configurações e no Geocoding

## O que já existe
A tabela `clinics` **já possui** a coluna `zip_code` (text, nullable). Não precisa de migration SQL.

## Mudanças

### 1. Formulário de Configurações (`src/pages/SettingsPage.tsx`)
- Adicionar campo `zip_code` ao estado `form` (já existe no banco, só falta no formulário)
- Adicionar um `<Input>` de CEP ao lado do campo Estado, com placeholder "00000-000"
- Incluir `zip_code` no payload de save

### 2. Geocoding mais preciso (`src/lib/geocode.ts`)
- Adicionar parâmetro opcional `zipCode` à função `geocodeAddress`
- Incluir o CEP na query do Nominatim para melhorar a precisão da localização no mapa

### 3. Marketplace (`src/pages/Marketplace.tsx`)
- Incluir `zip_code` no select de clínicas
- Passar `zip_code` para a função de geocoding no `MarketplaceMap`

## Resumo

| Arquivo | Mudança |
|---|---|
| `src/pages/SettingsPage.tsx` | Adicionar campo CEP no formulário da clínica |
| `src/lib/geocode.ts` | Aceitar `zipCode` como parâmetro adicional |
| `src/pages/Marketplace.tsx` | Incluir `zip_code` no select e passar ao mapa |
| `src/components/marketplace/MarketplaceMap.tsx` | Passar `zip_code` ao geocoding |

Nenhuma migration necessária — a coluna já existe.

