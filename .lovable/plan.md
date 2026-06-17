## Contas a deletar (8 encontradas)


| Email                                                               | ID        |
| ------------------------------------------------------------------- | --------- |
| [lucasferreiraceara@gmail.com](mailto:lucasferreiraceara@gmail.com) | b3fecef9… |
| [flavio@gmail.com](mailto:flavio@gmail.com)                         | ac0fa8af… |
| [joel@gmail.com](mailto:joel@gmail.com)                             | a2c363f0… |
| [sampa@gmail.com](mailto:sampa@gmail.com)                           | a4be98a6… |
| [erivaldo@gmail.com](mailto:erivaldo@gmail.com)                     | 00cf4226… |
| [go@gmail.com](mailto:go@gmail.com)                                 | fc61c674… |
| [lucasferreira@unifor.br](mailto:lucasferreira@unifor.br)           | 21ca553e… |
| [erasmo@unifor.br](mailto:erasmo@unifor.br)                         | 20465317… |


Observação: `joel@gmai.com` (sem "l") e `erasmo@gmail.com` não existem no banco — só achei `joel@gmail.com` e `erasmo@unifor.br`. Vou considerar esses como os pretendidos.

## O que será apagado

Para cada um dos 8 usuários, em uma única migração transacional:

1. **Clínicas** onde o usuário é `owner_id` → deletar a clínica inteira (cascata leva junto: membros, pacientes, agendamentos, prontuários, financeiro, documentos, anamneses, odontogramas, orçamentos, salas, convênios, transações, notificações, ai_tenants, etc.).
2. **Operadoras** (`insurance_operators`) onde é `owner_id` → deletar (cascata leva beneficiários, credenciamentos, tabelas de preço, membros da operadora).
3. **Pacientes** (`patients`) onde `patient_user_id` é o usuário ou `dentist_id` é o usuário (modo pessoal).
4. **Vínculos avulsos**: `clinic_members`, `operator_members`, `patient_accounts`, `user_roles`, `profiles`, `patient_invites`, `patient_link_requests`, `clinic_invites`, `notifications`, `support_tickets`, `ia_gestor_*`, `consultation_recordings`, `professional_*`, `user_consents`, `ai_tenants` pessoais, `platform_subscriptions` do tipo doctor.
5. **Arquivos de storage**: remover linhas em `storage.objects` referentes a `clinic-assets`, `patient-files`, `clinic-documents`, `consultation-audio`, `statements`, `operator-price-files` cujos donos sejam esses usuários (best-effort por `owner` em `storage.objects`).
6. `**auth.users**`: deletar os 8 registros (remove sessions/identities por cascata).

Tudo dentro de um `BEGIN ... COMMIT` — se algo falhar, nada é apagado.

## Aviso

- `lucasferreiraceara@gmail.com` está na whitelist de DEV (`src/lib/devAccess.ts`). A conta será removida, mas o e-mail continuará na whitelist do código — me avise se quiser que eu remova de lá também. - pode remover tambem
- Operação **irreversível**. Confirma que posso prosseguir?