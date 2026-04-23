

# Plano: Remover campo "Código da clínica" do cadastro do médico

## O que muda

Na tela de cadastro `/auth` (quando o usuário escolhe **Profissional → Médico/Dentista**), vou **remover** o campo "Código da clínica" e seu texto auxiliar. O fluxo passa a ser:

```text
ANTES:
Cadastro → preenche dados + código da clínica → conta criada + vínculo

DEPOIS:
Cadastro → preenche só dados pessoais → conta criada
       → redireciona para /aguardando-clinica
       → médico cola o código da clínica lá
       → vínculo criado
```

Mantém só **um ponto** para informar o código (a tela `WaitingClinic`, que já está pronta e funcionando — segunda imagem).

## Arquivo editado

**`src/pages/Auth.tsx`**

1. Remover o bloco JSX do campo "Código da clínica" dentro do formulário de profissional (input + label + texto explicativo + erro).
2. Remover do `handleSubmit` toda a validação de `clinicCode` e a chamada de `validate-clinic-code` antes do signup.
3. Remover do bloco pós-signup a chamada de `join-clinic-by-code` baseada em `clinicCode`. O fluxo de invite por token (`inviteToken`) **continua igual**.
4. Ajustar `isJoiningExistingClinic` para considerar apenas `inviteToken` (não mais o código).
5. Manter os states `clinicCode`/`clinicCodeError` só se forem usados em outros lugares — caso não, removê-los junto.

## Como vai ficar o fluxo

- Médico clica "Cadastre-se" → escolhe **Profissional → Médico** (ou Dentista).
- Preenche: nome, e-mail, senha, **especialidade**, CRM (opcional). **Sem campo de código**.
- Cria conta → como não tem clínica vinculada, o `AuthContext` já redireciona automaticamente para `/aguardando-clinica` (rota `WaitingClinic` que já existe).
- Lá, o médico cola o `CLIN-XXXXXXXX` → clica em **Vincular à clínica** → vínculo é criado e ele entra no sistema.

Convites por link (`?invite=...`) continuam funcionando como antes — esses não passam por `WaitingClinic` porque o token já vincula automaticamente.

## Arquivos NÃO alterados

- `src/pages/WaitingClinic.tsx` — segue como o único ponto de entrada do código.
- `supabase/functions/join-clinic-by-code/index.ts` — segue ativo, usado pelo WaitingClinic.
- `supabase/functions/validate-clinic-code/index.ts` — pode ficar (o WaitingClinic não usa, mas não atrapalha).
- `AuthContext` e roteamento — já redirecionam médico sem clínica para `/aguardando-clinica`.

## Resultado

Tela de cadastro do médico fica mais curta e limpa, sem o campo "Código da clínica" — exatamente como você pediu (remover o primeiro ponto, manter o segundo).

