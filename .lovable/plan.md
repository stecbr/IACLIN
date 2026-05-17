## Objetivo
Permitir que o paciente cadastre e visualize cartões de convênio de seus dependentes (ex: Filho - Fulano, Esposa - Fulana) na área "Plano de Saúde".

## Mudanças no Backend (Lovable Cloud)

Criar nova tabela `patient_dependents_insurance` para armazenar os cartões de dependentes:

- `id` (uuid, pk)
- `patient_account_id` (uuid) — referência ao titular
- `relationship` (text) — "Filho", "Esposa", "Marido", "Pai", "Mãe", "Outro", etc.
- `full_name` (text) — nome do dependente
- `insurance_provider` (text)
- `insurance_number` (text)
- `date_of_birth` (date, opcional)
- timestamps padrão

RLS: somente o dono da `patient_account` (auth.uid() = patient_accounts.user_id) pode SELECT/INSERT/UPDATE/DELETE seus próprios dependentes.

## Mudanças no Frontend

Arquivo: `src/pages/patient/PatientPlan.tsx`

1. Manter o card atual do **titular** no topo (já existe).
2. Adicionar seção **"Dependentes"** abaixo, com:
   - Lista de cards (mesmo estilo visual do card do titular, mas com badge de parentesco no topo: "FILHO • Fulano da Silva").
   - Botão "Adicionar dependente" (sempre visível no fim da lista).
   - Cada card tem ações: **Editar** e **Remover** (com confirmação).
3. Dialog de cadastro/edição com campos:
   - Parentesco (Select: Filho, Filha, Esposa, Marido, Pai, Mãe, Irmão, Irmã, Outro)
   - Nome completo
   - Convênio (operadora)
   - Nº da carteirinha
   - Data de nascimento (opcional)
4. Empty state quando não há dependentes ("Adicione cartões de seus dependentes para mantê-los organizados").

## Detalhes Técnicos

- Usar React Query (`useQuery` + `useMutation`) para listar/criar/editar/remover.
- Animação de entrada dos cards com `framer-motion` (já usado na página).
- Reaproveitar componentes shadcn já presentes (`Card`, `Dialog`, `Select`, `Input`, `Button`).
- Manter o mesmo visual "cartão de convênio" (faixa gradient no topo, fonte mono no número).
- Nenhuma alteração em outras páginas.

## Fora de escopo
- Vincular dependente a um `patient` da clínica (apenas armazenamento informativo no perfil do titular).
- Upload de foto da carteirinha.
- Validação por API da operadora.