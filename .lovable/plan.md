
# Plano de QA E2E — IACLIN

## Objetivo
Auditar e testar end-to-end os 4 perfis (Paciente, Profissional, Clínica/Admin/Secretária, Operadora) combinando análise de código + Playwright real contra o preview, e entregar um único **Relatório de QA** estruturado conforme solicitado.

## Etapa 1 — Seed de contas de teste (migration + script)
Criar uma migration idempotente que insere via `auth.admin` (edge function `seed-qa-users`) os seguintes usuários, todos com senha `QaTest!2026`:

| Perfil | Email | Notas |
|---|---|---|
| Paciente | qa+paciente@iaclin.test | CPF válido fictício, plano de saúde mock |
| Dentista solo | qa+dentista@iaclin.test | cria clínica própria |
| Médico membro | qa+medico@iaclin.test | aguarda vínculo |
| Clínica/Admin | qa+clinica@iaclin.test | CNPJ válido fictício, categoria Odonto |
| Secretária | qa+secretaria@iaclin.test | vinculada à clínica acima |
| Auxiliar | qa+auxiliar@iaclin.test | vinculada à clínica acima |
| Operadora | qa+operadora@iaclin.test | ANS mock |

Seed também cria 1 especialidade, 1 horário de disponibilidade do médico, 1 plano de saúde da operadora e vínculo dentista↔operadora — pré-requisitos para os fluxos E2E.

## Etapa 2 — Auditoria estática (leitura de código)
Cobertura por área, com checklist documentado no relatório:

1. **Auth & cadastro** (`Auth.tsx`, `handle_new_user`, dialogs de signup): validação de CPF/CNPJ/e-mail/senha, espelhamento metadata → `profiles`/`patient_accounts`/`clinics`/`insurance_operators` → tela de Configurações.
2. **RBAC** (`useRoleAccess`, `useStaffPermissions`, RLS das tabelas críticas: `clinical_records`, `financial_transactions`, `appointments`): garantir que secretária/auxiliar não leem prontuário, dentista sem vínculo não atende, paciente só vê o próprio.
3. **Agendamento** (`request-appointment`, `approve/reject-appointment-request`, triggers `notify_*`, `sync_*_cancel`): consistência de status, liberação de slot ao cancelar, prevenção de cancelamento de consulta passada.
4. **Operadora** (`OperatorLayout`, `operator_credentialings`, `operator-beneficiary-spend`): visualização de rede, faturamento, autorizações.
5. **UX/Escrita**: varredura por strings em inglês misturadas, botões sem handler, toasts ausentes em erros (grep por `catch` sem `toast`).

## Etapa 3 — E2E Playwright (scripts em `/tmp/browser/qa/`)
Um script por perfil, todos restaurando sessão Supabase via `LOVABLE_BROWSER_SUPABASE_*` (re-mintada após login com cada conta seed). Screenshots em cada passo crítico.

**Cenários por perfil** (caminho feliz + 1–2 edge cases cada):

- **Paciente**: cadastro → login → espelhamento Perfil → agendar consulta (especialidade/médico/horário) → tentar cancelar consulta passada (deve falhar) → cancelar consulta futura aprovada → verificar liberação na agenda do médico → ver exames → compartilhar prontuário → editar plano.
- **Médico/Dentista**: criar disponibilidade → receber pedido → aprovar → atender (prontuário + receituário) → finalizar → resgatar código de paciente → dentista solicita vínculo a clínica existente.
- **Clínica/Admin**: configurar dados da clínica → convidar médico/secretária/auxiliar → definir permissões de staff → login como secretária e tentar abrir prontuário (deve ser bloqueado) → secretária agenda e confirma consulta.
- **Operadora**: login → ver rede credenciada → aprovar/rejeitar credenciamento → conferir consulta realizada para faturamento.

**Edge cases obrigatórios**:
- E-mail duplicado no cadastro
- CPF/CNPJ inválido
- Senha fraca
- Conflito de horário no agendamento
- Dentista atendendo sem vínculo ativo
- Secretária acessando `/atendimento` direto pela URL (deve redirecionar)
- Paciente cancelando consulta `completed`

## Etapa 4 — Correções (escopo controlado)
Para cada bug encontrado classificado como **Crítico** (segurança/RBAC, perda de dados, quebra de fluxo) eu corrijo imediatamente.
Para **Médio/Baixo** (UX, escrita, falta de toast), listo no relatório e pergunto antes de aplicar em lote — para não sair do escopo do que você pediu.

## Etapa 5 — Relatório final
Documento único em chat seguindo exatamente o formato solicitado:

```
📑 RELATÓRIO DE QA & CENÁRIOS DE TESTE
1. Erros Encontrados (ou Riscos de Negócio)
   • [Crítico] ...
   • [Médio]  ...
   • [Baixo]  ...
2. Resultados dos Testes E2E
   - Cadastro e Configurações: Ok/Falha (+ evidência)
   - Fluxo do Paciente: ...
   - Fluxo do Médico/Dentista: ...
   - Fluxo da Clínica/Secretária: ...
   - Fluxo da Operadora: ...
3. Ações Corretivas Aplicadas
   • commit/arquivo: o que mudou e por quê
```

Cada falha referencia arquivo:linha + screenshot Playwright quando aplicável.

## Detalhes técnicos
- Seed via edge function `seed-qa-users` (usa `SUPABASE_SERVICE_ROLE_KEY` interno, idempotente por email).
- Playwright headless, viewport 1280×1800, sessão restaurada via `localStorage`.
- Para cada perfil de teste eu logo via UI uma vez, capturo o token, e reaproveito nos próximos scripts.
- Tempo estimado: ~6–8 rodadas longas de execução (seed → 4 scripts E2E → correções → re-teste).

## O que está fora do escopo
- Performance/carga
- Testes de pagamento real (Stripe/MercadoPago) — apenas validação de UI dos fluxos
- WhatsApp real — apenas validação dos handlers/edge functions
- Acessibilidade (WCAG) profunda — apenas verificações básicas
