

# Plano: Adicionar perfil "Clínica" ao sistema

Adicionar um terceiro tipo de cadastro na tela de autenticação ("Sou uma Clínica"), com formulário próprio que já cria a clínica no momento do signup, e um painel administrativo dedicado para gestão de médicos e pacientes vinculados.

## 1. Tela de Autenticação (`src/pages/Auth.tsx`)

Adicionar um novo card **"Sou uma Clínica"** ao lado de "Profissional de Saúde", "Operadora" e "Paciente", com ícone `Building2` (hoje usado pela operadora — trocaremos a operadora para `Briefcase`).

Quando o usuário escolher "Clínica", o formulário de signup mostrará os campos:

- Razão Social *
- Nome Fantasia *
- CNPJ * (com máscara e botão de auto-preencher via BrasilAPI, igual ao Onboarding)
- E-mail Corporativo *
- Telefone / WhatsApp *
- Nome do Responsável (Administrador) *
- Senha + Confirmação de Senha *

Validações: CNPJ com 14 dígitos, senha mínima 6 chars, confirmação igual à senha, e-mail válido.

No `signUp`, enviar `user_type: 'clinica'` mais todos os campos no `raw_user_meta_data`. Após o signup, a clínica é criada automaticamente (ver passo 2), pulando o `Onboarding`.

## 2. Backend — criação automática da clínica

Atualizar a função `handle_new_user` para tratar `user_type = 'clinica'`:

- Criar registro em `public.clinics` com: `name` (nome fantasia), `legal_name` (razão social — nova coluna), `cnpj`, `email`, `phone`, `owner_id = NEW.id`, `category = 'outro'`.
- O trigger `auto_link_clinic_owner` já vincula o owner como `admin` em `clinic_members` (mantém-se).
- Atribuir role `'admin'` em `user_roles`.
- Criar `profiles` com o nome do responsável.

Migração necessária:
- `ALTER TABLE clinics ADD COLUMN legal_name text;` (Razão Social)
- `ALTER TABLE clinics ADD COLUMN responsible_name text;` (nome do administrador responsável, separado do dono da conta para auditoria)
- Atualizar `handle_new_user` conforme acima.

## 3. Painel da Clínica — novas rotas

Como o perfil "Clínica" usa o mesmo role `admin` e a mesma `AppLayout`/`AppSidebar` já existentes, vamos **adicionar 3 novas páginas** dedicadas à gestão da clínica e exibi-las no menu lateral em uma nova seção "Gestão da Clínica":

### 3.1 `/clinica` — Visão Geral (`src/pages/clinica/ClinicaHome.tsx`)
Cards de resumo:
- Total de Médicos (count em `clinic_members` da clínica)
- Total de Pacientes (count em `patients`)
- Consultas do mês (count em `appointments`)
- Card placeholder "Faturamento" (em breve)

### 3.2 `/clinica/medicos` — Meus Médicos (`src/pages/clinica/ClinicaMedicos.tsx`)
Tabela listando `clinic_members` (com join em `profiles`) mostrando: Nome, E-mail, CRM/CRO (vem de `specialty` por enquanto + nova coluna `registration_number` em `clinic_members`), Especialidade, Status.

Botão **"Adicionar Novo Médico"** abre modal com:
- Nome, E-mail, CRM, Especialidade
- Reaproveita a edge function `invite-member` já existente (envia convite por e-mail). Quando o médico aceitar, vira `clinic_members` com role `dentist`.

### 3.3 `/clinica/pacientes` — Meus Pacientes
Reaproveitar a página `/patients` já existente (que faz exatamente isso). Adicionar apenas link no menu da nova seção.

### 3.4 `/clinica/configuracoes` — Configurações da Clínica
Reaproveitar `SettingsPage` (que já permite editar dados da clínica, horários, equipe, etc). Apenas adicionar link no menu.

### 3.5 Placeholder no menu
Item desabilitado **"Faturamento"** com badge "Em breve" para indicar futuras abas.

## 4. Atualização do Sidebar (`src/components/AppSidebar.tsx`)

Adicionar nova seção "Gestão da Clínica" (visível apenas se `is_owner = true` em `clinic_members`):

```text
GESTÃO DA CLÍNICA
  📊 Visão Geral        → /clinica
  👨‍⚕️ Médicos           → /clinica/medicos
  👥 Pacientes          → /clinica/pacientes (link para /patients)
  ⚙️  Configurações     → /clinica/configuracoes (link para /settings)
  💰 Faturamento        → (em breve, desabilitado)
```

## 5. Roteamento (`src/App.tsx`)

Adicionar 3 rotas novas protegidas por `ProtectedRoute`:
- `/clinica` → `ClinicaHome`
- `/clinica/medicos` → `ClinicaMedicos`
- (Pacientes e Configurações usam as rotas existentes)

Após login, se `user_type = 'clinica'` (ou `is_owner = true`), redirecionar para `/clinica` em vez de `/`.

## 6. Detalhes técnicos

**Arquivos novos:**
- `src/pages/clinica/ClinicaHome.tsx`
- `src/pages/clinica/ClinicaMedicos.tsx`
- `src/components/clinica/AddMedicoDialog.tsx`

**Arquivos editados:**
- `src/pages/Auth.tsx` — novo card "Clínica" + formulário com 7 campos
- `src/App.tsx` — novas rotas + redirect pós-login para owners
- `src/components/AppSidebar.tsx` — nova seção "Gestão da Clínica"
- Migração SQL — colunas `legal_name`, `responsible_name` em `clinics` + atualização de `handle_new_user`

**RLS:** As políticas existentes em `clinics` e `clinic_members` (via `is_clinic_owner` / `user_belongs_to_clinic`) já cobrem perfeitamente o acesso do dono da clínica aos seus médicos e pacientes — sem mudanças necessárias.

**Não muda:** lógica de pacientes (`/paciente`), profissionais individuais, ou onboarding (continua disponível para quem cria conta como "Profissional" sem clínica vinculada).

