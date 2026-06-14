## Envio funcional do e-mail de convite ao paciente

Vou usar o sistema **transacional nativo do Lovable** (sem Resend/Mailgun/chave externa). É o caminho recomendado da plataforma e já fica pronto para apresentar ao cliente.

### Passo 1 — Domínio de envio
A infra de e-mail precisa de um domínio verificado para realmente entregar mensagens. O projeto já tem `iaclin.test.ia.br` conectado como domínio próprio, então proponho reaproveitá-lo como remetente (`no-reply@iaclin.test.ia.br`).

Se o domínio ainda não estiver configurado para e-mail, o sistema vai abrir o diálogo de setup automaticamente (você adiciona SPF/DKIM/DMARC no DNS e ele verifica). **Esse passo exige permissão de admin do workspace** e é único — depois disso o envio fica permanente.

Se quiser usar outro domínio (ex: `mail.iaclin.com.br`), me avise antes de eu rodar.

### Passo 2 — Infra transacional
Provisionar a infra de envio do Lovable no projeto:
- Filas pgmq, tabelas de log/suppression/unsubscribe.
- Edge function `process-email-queue` + cron.
- Edge function `send-transactional-email` (entrada usada pelo nosso código).

Tudo isso é feito por uma chamada única do tooling, sem migrations manuais.

### Passo 3 — Reescrever `invite-new-patient`
Editar `supabase/functions/invite-new-patient/index.ts`:
1. Continua validando o usuário e inserindo em `patient_invites` exatamente como hoje.
2. Após criar o convite, busca o nome do solicitante (clínica via `clinic_id` ou `profiles.full_name` do usuário).
3. Chama `send-transactional-email` com:
   - `to`: e-mail do paciente.
   - `from`: `iClin <no-reply@iaclin.test.ia.br>` (ou domínio escolhido).
   - `subject`: *"Você foi convidado para o iClin"*.
   - `html`: template responsivo com saudação, frase *"<Clínica/Profissional> deseja adicionar você como paciente no iClin"*, botão **Completar Cadastro** apontando para `https://iaclin.lovable.app/auth?invite=<token>` e o link textual como fallback.
4. Se o envio falhar, **não derruba o convite** — registra `email_sent: false` no retorno e mantém o `invite_link` no JSON para fallback manual.
5. Mantém o `console.log` atual do link para debug.

### Passo 4 — Deploy e teste
- Deploy de `invite-new-patient` (e das funções da infra).
- Teste pelo modal de Novo Paciente enviando para um e-mail real; conferir entrega + logs com `edge_function_logs`.

### Fora do escopo
- Templates de auth (signup/recovery) — não mexer.
- E-mails para "vinculação aceita/recusada" e outras notificações — fica como melhoria futura.
- Mudanças no frontend, schema, RLS, ou no fluxo de auto-aceite do convite.

### Observação importante
Enquanto o DNS do domínio não terminar de propagar (pode levar minutos a algumas horas), o e-mail fica "enfileirado" mas não sai. Assim que ficar verde em **Cloud → Emails**, o envio começa automaticamente — não precisa redeploy.
