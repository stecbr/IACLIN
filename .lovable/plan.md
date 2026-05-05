# Adicionar entrada via código de clínica nas Configurações

## Problema
A médica Irani criou conta como profissional (gerou consultório próprio), mas em `/settings` não encontrou onde inserir o código de uma clínica para também trabalhar nela. Hoje esse fluxo só existe na tela `WaitingClinic`, que só aparece para quem ainda não tem nenhum vínculo.

## Solução
Adicionar uma nova seção em **Configurações → aba do profissional** chamada **"Clínicas em que atendo"** que permite:

1. Listar todas as clínicas em que o usuário é membro (com badge "Minha clínica" para a que ele é owner).
2. Inserir um **código de convite** (`CLIN-XXXXXXXX`) para entrar em uma clínica adicional.
3. Sair de uma clínica (exceto da própria).

## Onde

- **Novo componente**: `src/components/settings/MyClinicsSection.tsx`
- **Render**: dentro de `src/pages/SettingsPage.tsx`, visível para usuários com `clinicRole === 'dentist'` ou `'admin'` (qualquer profissional logado). Posicionar antes de `TeamSection`.

## Comportamento

- **Listagem**: usa `clinics` do `AuthContext` (já carrega todas as memberships). Mostra nome, papel (Admin/Dentista) e badge "Proprietário" quando `is_owner`.
- **Trocar clínica ativa**: botão "Acessar" em cada card → `switchClinic(id)`.
- **Entrar via código**: campo input + botão "Entrar". Reaproveita a edge function existente `join-clinic-by-code` (mesmo fluxo do `WaitingClinic.tsx`). Após sucesso: refetch das memberships (invalidar query / recarregar via `window.location.reload()` simples ou expor refetch no AuthContext — usar reload por simplicidade no MVP).
- **Sair da clínica**: botão discreto com confirm, deleta `clinic_members` onde `user_id = auth.uid()` e `clinic_id = X`. Bloqueado quando `is_owner = true` (com tooltip "Você é o proprietário").
- **Feedback**: toasts neutros (cinza) para erros não-bloqueantes, verdes para sucesso. Sem cores destrutivas para "código inválido".

## Visual
Seguir padrão Apple/iOS minimalista do projeto: Card com header `CardTitle` + `CardDescription`, lista de clínicas em linhas com avatar circular da inicial, input + botão à direita estilo `ClinicInviteCodeCard`.

## Fora do escopo
- Não alterar `WaitingClinic.tsx` (continua funcionando para quem ainda não tem clínica).
- Não criar nova edge function — reutilizar `join-clinic-by-code`.
- Não tocar no schema do banco.
