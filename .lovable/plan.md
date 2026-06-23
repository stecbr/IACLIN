## Conta encontrada

- **Nome:** Flavio Batista
- **User ID:** `1290ae8f-b23d-48b0-b6fb-c6b66451eccb`
- **Tipo:** Paciente

## Dados vinculados que serão removidos

- 1 `patient_account` (cadastro do paciente na plataforma)
- 3 registros em `patients` (vinculados em clínicas diferentes via CPF)
- 9 `appointments` ligadas a esses registros de paciente
- 1 entrada em `user_roles`
- 1 entrada em `profiles`
- A conta de autenticação em `auth.users`

> ⚠️ **Ação irreversível.** Não há "lixeira" — uma vez executada, o paciente perderá o acesso e o histórico dele será apagado nas clínicas onde estava cadastrado.

## Como será feito

Migration única que executa, em ordem:

1. `DELETE FROM public.appointments WHERE patient_id IN (SELECT id FROM public.patients WHERE patient_user_id = '<id>')`
2. `DELETE FROM public.patients WHERE patient_user_id = '<id>'`
3. `DELETE FROM public.patient_accounts WHERE user_id = '<id>'`
4. `DELETE FROM public.user_roles WHERE user_id = '<id>'`
5. `DELETE FROM public.profiles WHERE id = '<id>'`
6. `DELETE FROM auth.users WHERE id = '<id>'` (remove autenticação)

Outras tabelas que possam referenciar o usuário (notificações, etc.) serão limpas via `ON DELETE CASCADE` ou ficarão órfãs sem impacto. Posso confirmar isso ao aplicar.

Confirma a exclusão?
