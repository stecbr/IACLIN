Tokens MP atualizados. Lembretes:

- `MERCADOPAGO_ACCESS_TOKEN` → deve começar com `APP_USR-` (produção).
- `MERCADOPAGO_ACCESS_TOKEN_TEST` → deve começar com `TEST-` (sandbox).
- `PAYMENT_MODE` controla qual é usado (`live` por padrão).

Nenhuma mudança de código necessária — o helper `getMpToken()` já valida o prefixo e falha com erro claro se houver mistura.

Próximo passo: voltar em `/superadmin/planos`, abrir o plano de R$ 20 e clicar **Salvar** para refazer o sync com o token novo. Se vier 401 de novo, me avise para investigar permissões do app MP (precisa ter "Assinaturas" habilitado no painel de desenvolvedores).

Confirma para encerrar?