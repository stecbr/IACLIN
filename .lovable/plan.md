## Objetivo
Aplicar a cor/identidade da operadora no topo dos cartões de convênio (titular e dependentes), em vez do gradiente roxo padrão. Ex: Unimed → verde, Amil → azul, Bradesco → vermelho.

## Mudanças

### 1. Novo helper `src/lib/insuranceBrand.ts`
Função `getInsuranceBrand(name: string)` que normaliza o nome digitado (lowercase, sem acento) e retorna:
- `gradient`: classe Tailwind com a cor da marca (ex: `from-emerald-600 via-emerald-500 to-emerald-400`)
- `label`: nome canônico (ex: "Unimed")

Mapa inicial de operadoras brasileiras:

| Operadora | Cor base |
|---|---|
| Unimed | verde (emerald) |
| Amil | azul (blue) |
| Bradesco Saúde | vermelho (red) |
| SulAmérica | laranja (orange) |
| Hapvida / NotreDame | laranja-vermelho |
| Porto Saúde | azul-marinho (sky/indigo) |
| Golden Cross | dourado (amber) |
| OdontoPrev | azul-claro (cyan) |
| MetLife | azul (blue-700) |
| Allianz | azul-escuro (indigo) |
| Prevent Senior | azul (sky) |
| Care Plus | verde-azulado (teal) |
| São Francisco Saúde | azul (blue) |
| Default (operadora não reconhecida) | gradient `primary` atual |

Match por `includes` de palavra-chave para tolerar variações ("Unimed-BH", "AMIL DENTAL", etc.).

### 2. `src/pages/patient/PatientPlan.tsx`
- Substituir o `<div className="h-3 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />` do card do titular por um gradient dinâmico vindo de `getInsuranceBrand(account.insurance_provider)`.
- Mesmo para os cards de dependentes (usando `d.insurance_provider`).
- Aumentar levemente a faixa colorida (de `h-3`/`h-2` para `h-4`/`h-3`) para que a cor da marca fique mais visível.
- Quando não houver operadora cadastrada, manter o gradient padrão (`primary`).

## Fora de escopo
- Logos das operadoras (apenas cores).
- Auto-complete/select fechado de operadora — o campo continua texto livre, o reconhecimento é feito por palavra-chave.
- Cor em outras telas (só no Plano de Saúde do paciente).
