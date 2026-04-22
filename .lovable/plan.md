

# Plano: Liberar acesso de simulação para `lucasferreiraceara@gmail.com`

Dar a esse e-mail um "modo desenvolvedor" que permite alternar entre as três visões: **Clínica (admin)**, **Médico (dentist)** e **Paciente** — sem precisar de logins separados.

## Como vai funcionar

1. **Whitelist por e-mail**: criar uma constante `DEV_EMAILS = ['lucasferreiraceara@gmail.com']` em um arquivo único (`src/lib/devAccess.ts`). Só esses e-mails enxergam o seletor.

2. **Seletor de simulação no header**: dropdown discreto no topo da tela (ao lado do `ClinicSwitcher` no `AppLayout`) com 3 opções:
   - 👔 Clínica (admin) — visão padrão atual dele
   - 🩺 Médico (dentist) — esconde Financeiro, Secretária IA, Configurações, Gestão da Clínica
   - 👤 Paciente — leva pra `/paciente` (PatientLayout completo)

3. **Estado persistido em `localStorage`** (`iaclin.simulatedRole`) — sobrevive a reload, mas é só visual no front. Não toca no banco.

4. **`AuthContext` ganha 3 campos novos**:
   - `isDevUser: boolean` (calculado de `user.email`)
   - `simulatedRole: 'admin' | 'dentist' | 'patient' | null`
   - `setSimulatedRole(role)` — só funciona se `isDevUser === true` (guard interno)

5. **`useRoleAccess` passa a respeitar a simulação**:
   ```typescript
   const effectiveRole = simulatedRole ?? (isPatient ? 'patient' : (clinicRole ?? (isClinicOwner ? 'admin' : 'dentist')));
   ```
   Assim, sidebar, rotas e guards já existentes filtram automaticamente — sem duplicar lógica.

6. **Roteamento condicional**:
   - Se `simulatedRole === 'patient'` e usuário está em rota não-paciente → redireciona pra `/paciente`.
   - Se sair de `/paciente` voltando pra `/`, simulação de paciente é resetada automaticamente (ou ele clica em "voltar pra Clínica" no seletor).
   - Botão "Sair do modo simulação" sempre visível dentro do dropdown.

## Visual do seletor

No header, ao lado direito (antes do sino de notificação):

```
┌──────────────────────────────────┐
│ 🧪 Visualizando como: Médico  ▾  │
└──────────────────────────────────┘
```

Quando aberto:
```
┌────────────────────────────────────┐
│ Modo desenvolvedor                 │
│ ─────────────────────────────────  │
│ ✓ 👔 Clínica (admin)               │
│   🩺 Médico (dentist)              │
│   👤 Paciente                      │
│ ─────────────────────────────────  │
│   ↩  Voltar ao normal              │
└────────────────────────────────────┘
```

Badge amarelo discreto "Simulando" aparece ao lado do nome do usuário no rodapé da sidebar quando o modo está ativo, pra deixar claro que não é a visão real.

## Segurança

- **Front-only**: a simulação **não** muda nada no banco. RLS continua aplicada com o usuário real (`lucasferreiraceara@gmail.com` que é admin de fato).
- Como ele já tem `clinic_role = admin` no banco, ele tecnicamente *pode* ver tudo. A simulação só esconde itens de UI pra ele testar como cada perfil enxerga.
- Se quisermos que ele teste *escrita* como paciente (ex: criar um agendamento pelo `/paciente/agendar`), o registro vai pra clínica dele com o user_id dele — então fica num estado meio híbrido. Aceitável pra QA, mas precisa ficar documentado.
- Whitelist é **hardcoded em código**, não em banco. Adicionar/remover = mudar o array e fazer deploy.

## Arquivos tocados

- **Novo**: `src/lib/devAccess.ts` — constante `DEV_EMAILS` + helper `isDevUser(email)`.
- **Novo**: `src/components/DevRoleSwitcher.tsx` — dropdown do seletor.
- **Editado**: `src/contexts/AuthContext.tsx` — adicionar `isDevUser`, `simulatedRole`, `setSimulatedRole`, persistência em localStorage.
- **Editado**: `src/hooks/useRoleAccess.ts` — `effectiveRole` passa a considerar `simulatedRole` antes de qualquer outro fallback.
- **Editado**: `src/components/AppLayout.tsx` — encaixar `<DevRoleSwitcher />` no header (só renderiza se `isDevUser`).
- **Editado**: `src/components/AppSidebar.tsx` — badge "Simulando" no footer quando `simulatedRole !== null`.
- **Editado**: `src/App.tsx` — em `ProtectedRoute`, se `simulatedRole === 'patient'` e rota não começa com `/paciente`, redirecionar pra `/paciente`. Em `PatientProtectedRoute`, aceitar dev users com `simulatedRole === 'patient'` mesmo que `isPatient === false`.

## O que NÃO muda

- Banco de dados: zero migrations.
- RLS: intacta.
- Outros usuários: nem veem o seletor, comportamento idêntico ao atual.
- `clinicRole` real do `lucasferreiraceara@gmail.com` continua `admin` — a simulação é puramente de UI.

## Pergunta

Quer que eu adicione **mais e-mails** à whitelist agora (ex: `furtadolucas@gmail.com`, `lucas@simoes.tec.br`, `henrifurtado.adv@gmail.com`) ou começamos só com `lucasferreiraceara@gmail.com` e adiciono os outros depois se precisar?

