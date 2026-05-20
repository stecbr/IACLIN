## Objetivo
Substituir o modal `PatientPickerDialog` por uma página dedicada `/prontuarios` que respeita o contexto da clínica ativa.

## Regras de filtragem (já existentes no PatientPickerDialog)
- **Modo pessoal** (sem clínica): `dentist_id = me` e `clinic_id IS NULL`
- **Clínica selecionada + role dentist**: pacientes da clínica com vínculo via `appointments` ou `clinical_records` (`dentist_id = me`)
- **Clínica selecionada + admin/secretary**: todos os pacientes da clínica

## Arquivos

### Novo: `src/pages/OpenChart.tsx`
- Página com `PageHeader` "Abrir prontuário"
- Input de busca (filtra por nome ou telefone, client-side)
- Grid de cards de pacientes → `Link` para `/patients/:id`
- Reusa a mesma query do `PatientPickerDialog` (auth + role + clinic context, queryKey reativa)
- Skeleton loader e empty state

### `src/App.tsx`
- Adicionar rota `/prontuarios` → `OpenChart` dentro de `ProtectedRoute`

### `src/components/AppSidebar.tsx`
- Trocar botões "Abrir prontuário" por `NavLink` para `/prontuarios`
- Remover `pickerOpen` state e `<PatientPickerDialog/>`

### `src/components/CommandPalette.tsx`
- Remover query `patients-search` e grupo de pacientes
- Adicionar item "Abrir prontuário" em "Páginas" que navega para `/prontuarios`

### `src/components/MobileBottomNav.tsx`
- Se existir item de prontuário, apontar para `/prontuarios` (caso contrário, sem alteração)

### `src/pages/dentist/DentistHome.tsx`
- Se houver botão "Abrir prontuário", apontar para `/prontuarios`

## Fora de escopo
- Botão dentro de cards de orçamento (continua indo direto ao paciente do orçamento)
- Sem alterações de RLS, migrations ou edge functions
- `PatientPickerDialog.tsx` permanece no projeto (não removido) caso seja referenciado em outros pontos