## Objetivo

Eliminar todo `<input>` de texto livre para "convênio" e substituir por um **select de catálogo** consistente em toda a plataforma.

## Regra de catálogo

| Contexto | Catálogo usado | Tabela |
|---|---|---|
| Lado **clínica** (cadastro/edição de paciente pela clínica) | Planos cadastrados pela própria clínica | `insurance_plans` filtrada por `clinic_id` |
| Lado **paciente** (signup público + portal) | Operadoras ativas globais | `insurance_operators` onde `is_active = true` |

Em todos os casos, **inclui opção "Nenhum (Particular)"** que salva `null`.

## Mudanças por arquivo

### 1. `src/components/patients/PatientFormDialog.tsx`
- Remover o fallback de input livre.
- Se a clínica não tem `insurance_plans` cadastrados, mostrar mensagem "Nenhum convênio cadastrado — adicione em Configurações → Convênios" com link, e desabilitar o campo (ou só mostrar "Particular").
- Mantém o `Select` já existente (mas garantir item "Particular" salvando `null`).

### 2. `src/pages/Auth.tsx` (signup paciente, passo 2)
- Trocar `<Input>` de `insuranceProvider` por `<Select>` carregando `insurance_operators (id, name)` ativas, ordenadas por nome.
- Salvar o **nome** da operadora em `insurance_provider` (mantém schema atual, sem migration).
- Manter `insurance_number` (carteirinha) como input livre logo abaixo.

### 3. `src/pages/patient/PatientPlan.tsx`
- Editar dados do titular: trocar input de `editProvider` por select de `insurance_operators`.
- Form de dependente (`depForm.insurance_provider`): mesmo select.
- Carregar lista uma vez com `useQuery(['insurance-operators-catalog'])`.

### 4. Componente reutilizável (novo)
Criar `src/components/InsuranceOperatorSelect.tsx`:
- Props: `value`, `onChange`, `placeholder?`, `disabled?`.
- Faz fetch de `insurance_operators` ativas, cacheado via React Query.
- Usado por `Auth.tsx` e `PatientPlan.tsx` (titular + dependentes).

### 5. Filtros (já são select, só auditar)
- `BookingFilters.tsx` e `ClinicDoctorStep.tsx`: já usam `insurance_plans` via select — sem mudanças, só conferir UX.
- `Patients.tsx`: mantém filtro "com/sem" conforme escolha do usuário.
- Marketplace público: sem alteração (escolha do usuário).

### 6. `BookingConfirmation.tsx`
Já faz lookup do `insurance_provider` salvo contra `insurance_plans` da clínica — continua funcionando porque o nome salvo no paciente bate com o nome do plano/operadora.

## Não faz parte
- Sem migration de schema. Continua salvando o **nome** em `insurance_provider` (string).
- Sem mudar marketplace público nem filtro da lista de pacientes (conforme escolha do usuário).
- Sem mexer no fluxo de cadastro de planos pela clínica (`InsurancePlansSection`).

## Resumo da experiência final
- **Clínica cadastrando paciente**: select dos planos da própria clínica.
- **Paciente se cadastrando ou editando o próprio plano**: select das operadoras globais.
- **Nenhum input de convênio em texto livre** sobra na aplicação.
