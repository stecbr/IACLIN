

# Plano: Especialidade obrigatória e padronizada (catálogo único)

## Problema raiz

O paciente filtra médicos por `specialty.id` do catálogo (ex: `cardiologia`). Mas hoje a especialidade é digitada como texto livre em 3 lugares (signup do profissional, convite do admin, e configurações), então grava strings tipo "Cardiologista" que nunca batem com o id do catálogo → o médico nunca aparece na busca.

## Solução

Trocar **todos os campos de especialidade** por um **Select com o mesmo catálogo `SPECIALTIES`** usado pelo paciente, e tornar **obrigatório** em toda criação/atualização. Assim o que é gravado (`specialty.id`) sempre bate com o que o paciente filtra.

## O que muda

### 1. Cadastro de profissional (`Auth.tsx`)
- Trocar o `<Input>` de especialidade por um `<Select>` com busca, listando todo o catálogo `SPECIALTIES` ordenado A-Z (com seção "Mais procurados" no topo).
- Filtrar opções por sub-tipo: se escolheu **Dentista**, mostra só categorias `odonto`; se **Médico**, mostra `medico` + `estetica` + `outro`.
- Label vira "Especialidade" (sem "(opcional)").
- **Validação obrigatória** antes de submeter — se vazio, toast de erro e bloqueia.
- Grava o `specialty.id` (ex: `cardiologia`), não o nome.

### 2. Convite de médico pelo admin (`AddMedicoDialog.tsx`)
- Mesma troca: `<Input>` → `<Select>` com o catálogo.
- Obrigatório. Botão "Criar convite" desabilitado até preencher.
- Edge function `create-clinic-invite` já aceita `specialty` no body — só passa o id.

### 3. Aceite de convite (`Auth.tsx` quando `inviteToken` está presente)
- Hoje o convite traz a especialidade pré-definida pelo admin, mas o usuário pode alterar. Mantém pré-preenchido com a especialidade do convite e **obrigatório** confirmar/escolher antes de criar conta.
- A edge function `accept-clinic-invite` precisa salvar o `specialty` em `clinic_members`. Vou verificar e ajustar se faltar.

### 4. Entrada por código (`join-clinic-by-code`)
- O fluxo já passa `specialty` pra função (Auth.tsx linha 277). Garantir que a função grave em `clinic_members.specialty`. Se não grava, ajusto.

### 5. Configurações do médico (`SpecialtySection.tsx`)
- Já é Select com catálogo ✅. Só vou:
  - Tornar **obrigatório** (não permite salvar vazio).
  - Mostrar um banner de aviso no topo da página de Configurações se a especialidade estiver vazia ("Defina sua especialidade para aparecer nas buscas").

### 6. Painel do admin — coluna Especialidade (`ClinicaMedicos.tsx`)
- A coluna já existe (linha 138), mas mostra a string crua. Vou:
  - Mapear o `id` salvo (ex: `cardiologia`) pro **nome legível** ("Cardiologia") usando o catálogo.
  - Se não bater nenhum id (dados antigos digitados à mão), mostra a string crua mesmo, com um ícone de alerta amarelo + tooltip "Especialidade fora do catálogo, médico não aparece nas buscas — peça pra ele atualizar nas configurações".

### 7. Convites pendentes — coluna Especialidade
- Adicionar coluna "Especialidade" na tabela de convites pendentes (hoje só mostra Nome/Email/Expira), também usando o catálogo pra exibir o nome legível.

## Componente novo

**`src/components/SpecialtySelect.tsx`** — `<Select>` reutilizável, recebe `value`, `onChange`, e opcionalmente `filterCategory: 'odonto' | 'medico' | 'all'`. Lista o catálogo com:
- Seção "Mais procurados" no topo (chips).
- Lista A-Z agrupada por letra.
- Campo de busca interno (estilo combobox).
- Usado em: Auth (signup), AddMedicoDialog, SpecialtySection.

## Migração de dados antigos

Vou rodar uma query de leitura pra ver quantos `clinic_members.specialty` existentes não batem com nenhum id do catálogo. Pra cada caso:
- Se for fácil mapear (ex: "Cardiologista" → `cardiologia`), faço um `UPDATE` único na migração.
- O resto fica como está + fica visível o ícone de alerta no painel pro admin pedir atualização.

## Validações no banco (defensivo)

Não vou criar CHECK constraint (já que o catálogo é client-side e pode crescer), mas a UI sempre vai forçar Select. Banco continua aceitando texto livre pra não quebrar dados antigos.

## Permissões

- Médico edita só a própria especialidade nas Configurações.
- Admin pode editar a especialidade de qualquer médico da clínica direto na tabela de Médicos (botão de editar na linha) — **adiciono isso de bônus**, já que hoje o admin não consegue corrigir um médico que cadastrou errado.

## Arquivos tocados

**Novos:**
- `src/components/SpecialtySelect.tsx`

**Editados:**
- `src/pages/Auth.tsx` — substitui Input de especialidade por SpecialtySelect; valida obrigatório.
- `src/components/clinica/AddMedicoDialog.tsx` — substitui Input por SpecialtySelect; obrigatório.
- `src/components/settings/SpecialtySection.tsx` — torna obrigatório; remove mensagem "opcional".
- `src/pages/clinica/ClinicaMedicos.tsx` — exibe nome legível via catálogo + ícone de alerta pra strings fora do catálogo + botão pra editar especialidade direto na linha + coluna nos convites pendentes.
- `src/pages/SettingsPage.tsx` — banner de aviso se especialidade do médico logado estiver vazia.

**Edge functions (verificar e ajustar se preciso):**
- `supabase/functions/accept-clinic-invite/index.ts` — garantir que grava `specialty` em `clinic_members`.
- `supabase/functions/join-clinic-by-code/index.ts` — idem.

**Migration:**
- 1 `UPDATE` mapeando os strings antigos conhecidos (ex: "Cardiologista"→"cardiologia") quando der pra inferir.

## O que NÃO muda

- Catálogo de especialidades em si (já é robusto, ~70 itens).
- Schema do banco (`clinic_members.specialty` continua `text` nullable — só forçamos via UI).
- Marketplace, busca do paciente, agenda — funcionam automaticamente assim que os dados ficarem padronizados.
- Cadastro de paciente (não tem especialidade).

## Resultado esperado

Após o ajuste: você cadastra Joel como Cardiologia (Select), o paciente busca "Cardiologia" → Joel aparece. O admin vê "Cardiologia" bonitinho na tabela. Médicos antigos com texto livre ganham um alerta visual pra atualizar.

