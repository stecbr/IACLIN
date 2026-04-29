## Objetivo

Permitir que o admin/dono da clínica desvincule médicos/dentistas na tela `/clinica/medicos`, e garantir que, ao tentar acessar a plataforma sem vínculo, o profissional veja um aviso claro com a opção de inserir o código de vinculação ou contatar a clínica.

## Mudanças

### 1. Botão "Desvincular" em `src/pages/clinica/ClinicaMedicos.tsx`

- Adicionar coluna **"Ações"** na tabela de membros.
- Para cada linha que **não seja o owner** (e não seja o próprio usuário logado), exibir um botão ícone `UserMinus` (variant ghost, vermelho).
- Ao clicar, abrir um `AlertDialog` de confirmação:
  - Título: "Desvincular profissional?"
  - Descrição: "{nome} perderá o acesso à clínica imediatamente. Ele poderá ser vinculado novamente através do código da clínica."
- Confirmação executa:
  ```ts
  await supabase.from('clinic_members').delete().eq('id', member.id);
  ```
  (RLS já permite: "Owners and admins can delete clinic members").
- Mostrar `toast.success('Profissional desvinculado')` e invalidar a query `['clinica-medicos']`.

### 2. Aviso aprimorado em `src/pages/WaitingClinic.tsx`

A rota `/aguardando-clinica` já existe e o `ProtectedRoute` em `App.tsx` já redireciona dentists/profissionais sem clínica para lá. Vamos apenas refinar o conteúdo visual:

- Adicionar um bloco `Alert` (variant destructive suave / amber) acima do formulário com o texto exato pedido:

  > **Você está sem vínculo com nenhuma clínica**
  > No momento o acesso à plataforma não é permitido. Entre em contato com a sua clínica para solicitar um novo vínculo, ou informe abaixo o código de vinculação fornecido por ela.

- Manter o input atual `CLIN-XXXXXXXX` + botão "Vincular à clínica" + botão "Sair".
- Garantir que, quando um membro é removido enquanto está logado, ao recarregar/refazer fetch o `AuthContext` detecte `clinics.length === 0` e o `ProtectedRoute` redirecione para `/aguardando-clinica` automaticamente (já funciona).

### 3. Detalhes técnicos

- Reutilizar `AlertDialog` de `@/components/ui/alert-dialog`.
- Ícone `UserMinus` de `lucide-react`.
- Não mexer em RLS nem migrations — o delete em `clinic_members` já é permitido para owners/admins.
- Não permitir desvincular o próprio owner (já filtrado); também esconder o botão para o usuário logado por segurança.

## Arquivos afetados

- `src/pages/clinica/ClinicaMedicos.tsx` — adiciona coluna Ações + dialog de confirmação + mutation de delete.
- `src/pages/WaitingClinic.tsx` — adiciona Alert com a mensagem solicitada acima do formulário.

Sem mudanças de banco de dados.