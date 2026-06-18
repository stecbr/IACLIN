## Diagnóstico

O conteúdo das abas Avaliação, Diagnóstico, Conduta, Procedimentos, Evolução e Documentos NÃO está com largura menor — o grid externo (`lg:grid-cols-[14rem_minmax(0,1fr)_22rem]`) e o wrapper `<div className="flex-1 min-w-0 space-y-4">` são os mesmos para todas as abas em `src/pages/Attendance.tsx`.

O que quebra o padrão visual é **card-dentro-de-card**: ao envolvermos cada seção em `<Card>` no `renderSection()`, os subcomponentes `AssessmentForm` e `FollowUpBlock` continuam renderizando vários `<Card>` internos (Queixa principal, HDA, Exame físico, Plano terapêutico, Retorno). O padding duplo (`p-6` externo + `p-6` interno + borda interna) faz o conteúdo parecer afundado/estreito, enquanto Visão Geral e Sinais Vitais têm apenas um Card único.

## Mudanças

### 1. `src/components/attendance/AssessmentForm.tsx`
Remover os 3 `Card` internos das seções "Queixa principal", "História da doença atual (HDA)" e "Exame físico / inspeção". Substituir por blocos simples:

```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium text-muted-foreground">Queixa principal</Label>
  <Input ... />
</div>
```

Manter o alerta amber "Antecedentes do paciente" como Card (é um destaque intencional). Container raiz continua `space-y-4`.

### 2. `src/components/attendance/FollowUpBlock.tsx`
Remover os 2 `Card` internos ("Plano terapêutico / orientações" e "Retorno sugerido"). Converter em blocos `<div className="space-y-2">` com `<Label>` + campo, mantendo o botão "Agendar retorno agora" e o `AppointmentFormDialog` inalterados.

### 3. `src/pages/Attendance.tsx`
Nenhuma mudança. Os wrappers `<Card className="border-border/50 shadow-card">` em `assessment`, `vitals`, `diagnosis`, `conduct`, `requests`, `notes`, `procedures`, `odontogram` e `documents` permanecem — eles já produzem exatamente a mesma largura da Visão Geral. O grid, a sidebar de abas, o header com timer e o painel "Prontuário ao lado" ficam intactos.

## Fora do escopo

- Lógica de formulários, validações, RLS, edge functions.
- Conteúdo de odontograma, procedimentos, documentos, prontuário lateral.
- Novos campos, ícones ou abas.
- `HypothesesEditor`, `RequestsEditor`, `DocumentsTab`, `VitalSignsForm` (já não usam Cards aninhados — não precisam de ajuste).

## Resultado esperado

Todas as abas exibirão um único Card externo ocupando a mesma largura horizontal da aba Visão Geral, sem efeito de caixa-dentro-de-caixa, mantendo a estética Apple/iOS minimalista.
