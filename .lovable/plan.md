

# Busca funcional + trocar filtro de cidades por especialidades

## O que muda

### 1. Barra de pesquisa no header — já funciona
A busca por nome (`searchName`) e cidade (`searchCity`) já filtra os resultados corretamente no `Marketplace.tsx` (linhas 103-110). O campo de cidade no header já está conectado ao filtro. Se o usuário digitar "Fortaleza" no campo cidade, os resultados são filtrados. Nenhuma mudança necessária aqui.

### 2. Trocar barra de filtro por cidade → filtro por especialidades
Remover a barra de badges com cidades (`MarketplaceFilters`) e substituir por badges de especialidades (ex: "Ortodontia", "Implantodontia", "Endodontia", "Clínico Geral", "Periodontia", "Prótese", "Cirurgia").

Como ainda não temos dados de especialidade no banco, a implementação será:
- Lista fixa de especialidades odontológicas como badges clicáveis
- Filtro visual funcional (seleciona/deseleciona)
- Mensagem sutil de "em breve" indicando que o cruzamento com dados reais virá depois
- Remover o `selectedCity` state e a lógica de `cities` do `Marketplace.tsx`

### 3. Limpar código de filtro por cidade
- Remover `selectedCity` state e `cities` memo do `Marketplace.tsx`
- Manter apenas `searchCity` do header (que já funciona como filtro de texto livre)

## Mudanças por arquivo

| Arquivo | O que muda |
|---|---|
| `src/components/marketplace/MarketplaceFilters.tsx` | Trocar badges de cidades por badges de especialidades (visual, sem dados reais ainda) |
| `src/pages/Marketplace.tsx` | Remover `selectedCity`, `cities`, simplificar filtro. Passar especialidades selecionadas ao filtro |

