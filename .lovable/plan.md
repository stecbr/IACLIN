Refatoração do fluxo de cadastro: "Médico = Clínica própria" + ajustes de UX

## 1. Diagnóstico (a partir dos logs reais do cliente)

Acesso conferido em `auth.users`, `clinic_members` e logs de `/signup` entre 13:20 e 13:45 UTC de 04/05.

- O usuário `yurilyserg@gmail.com` foi criado às 13:29 UTC com `user_type = profissional_member` e role `dentist`. Como esse tipo significa "estou entrando numa clínica existente", o sistema não criou clínica para ele e o jogou para `/aguardando-clinica` pedindo um código. **Daí veio o "fui me cadastrar como médico e pediu clínica".**
- Na sequência houve várias tentativas com o mesmo e-mail (`yurilyserg@gmail.com` e `yurilyzerg@gmail.com`), todas devolvendo `422: User already registered`. **Daí o "deu conflito de usuário criado".**
- Em `auth.users` os cadastros estão vindo já com `email_confirmed_at` preenchido e login automático. Ou seja, o ambiente está com auto-confirm ativo, mas a tela exibe a mensagem "Verifique seu e-mail para confirmar". **Daí o "não recebi e-mail" — o e-mail nem precisa ser enviado, mas a UI não comunica isso.**
- O CNPJ hoje só busca quando clica na lupa, e quando a API externa não responde aparece o toast vermelho "Não foi possível buscar o CNPJ" (print do cliente). **Daí "auto input ao digitar" e "não usar lixo vermelho de UI, usar cinza suave".**
- Hoje o `SpecialtySelect` mostra também "Avaliação", "Renovação de receitas", etc., porque essas entradas estão no catálogo de procedimentos sendo reaproveitado como especialidade. **Daí "verificar filtro das especialidades, está indo outros pontos".**

## 2. Decisão de produto a confirmar

Concordo com a regra que vocês alinharam no WhatsApp: **"Médico criado = Clínica própria criada automaticamente"**. As clínicas que quiserem agregar esse médico depois usam o código `CLIN-XXXXXXXX` ou convite por e-mail (já existe), e isso vira uma configuração do médico, não do cadastro inicial.

## 3. Mudanças de cadastro (fluxo principal)

### 3.1 Sempre criar uma "clínica/consultório" para o profissional

- Em `src/pages/Auth.tsx`, o cadastro como Profissional para de marcar `user_type = profissional_member` por padrão.
- Quando NÃO há `inviteToken` na URL, o cadastro de profissional vira `user_type = profissional`. O trigger `handle_new_user` já faz o que precisamos nesse caso: cria a clínica própria, vira admin/owner, persiste especialidade e registro.
- Quando HÁ `inviteToken`, mantém `profissional_member` + `accept-clinic-invite` (fluxo atual de convite continua funcionando).
- O nome inicial da clínica própria será derivado do nome do profissional ("Consultório do Dr. Fulano"). Permitirei renomear depois em Configurações.

### 3.3 Auto-busca de CNPJ ao digitar

- No formulário de Clínica (`Auth.tsx`) e no `Onboarding.tsx`:
  - Disparar a chamada à BrasilAPI com debounce de 500 ms, assim que o CNPJ atingir 14 dígitos.
  - Ícone de lupa vira indicador de status (loading / ok). Botão manual continua disponível como fallback.
  - Em caso de falha, NÃO usar `toast.error` (vermelho). Usar inline hint cinza/neutro abaixo do campo, "Não foi possível preencher automaticamente. Você pode digitar os dados manualmente." Sem cor destrutiva.

### 3.4 Mensagens de feedback consistentes

- Auto-confirm está ligado nesse ambiente. Vou trocar a mensagem após signup para algo neutro:
  - Hoje: "Conta criada! Verifique seu e-mail para confirmar." (gera reclamação)
  - Novo: "Conta criada com sucesso. Redirecionando…"
- Mensagem de e-mail duplicado: tratar `error.code === 'user_already_exists'` e mostrar "Este e-mail já tem cadastro. Tente fazer login." com botão "Ir para o login" no toast.
- Trocar todos os toasts vermelhos do cadastro/CNPJ por estilo neutro (`variant="default"` cinza), reservando vermelho apenas para erros realmente bloqueantes (ex: senha não confere).

### 3.5 Ajuste do "Aguardando vínculo"

- Como agora todo profissional novo já nasce com clínica própria, o `/aguardando-clinica` deixa de ser caminho padrão.
- Para usuários antigos que ficaram sem clínica (ex: o `yurilyserg@gmail.com`), a tela passa a oferecer:
  - Inserir código de clínica (já existe).
  - Botão "Criar meu consultório agora", que chama uma nova edge function `create-own-clinic` (cria clínica + vincula como admin/owner). Resolve o caso já bagunçado em produção sem mexer manualmente nos usuários.

### 3.6 Vincular médico a uma clínica depois (configuração)

- No painel do médico (Configurações), criar seção "Clínicas em que atendo":
  - Lista de clínicas vinculadas (a própria + qualquer outra).
  - Campo para colar código `CLIN-XXXXXXXX` e ingressar (reusa `join-clinic-by-code`).
  - Aceitar convites pendentes recebidos por e-mail.
- Isso entrega o que o cliente descreveu: "se a clínica quiser, ela adiciona o médico pelo código ou e-mail; ele passa a fazer parte do quadro".

## 4. Filtro de especialidades

- Em `src/components/SpecialtySelect.tsx` (e fonte de dados que o popula), restringir para itens do tipo "specialty" mesmo, removendo entradas como "Avaliação", "Renovação de receitas", "Avaliação antropométrica", "Avaliação do pé diabético", "Avaliação fisioterapêutica" (essas são procedures e estavam vazando para a lista — confirmado pelo print do cliente).
- Manter "Mais procurados" só com especialidades reais (Clínico Geral, Cardiologia, etc.). Procedimentos voltam para o catálogo de Configurações > Procedimentos, onde devem viver.

## 5. Mudanças no banco

- Nova edge function `create-own-clinic` (verifica JWT, garante que o usuário não é dono de outra clínica criada por ele, cria registro em `clinics` com `owner_id = user.id`. O trigger existente `auto_link_clinic_owner` já cria `clinic_members` como admin/owner. Adiciona role `admin` em `user_roles` se ainda não existir).
- Sem novas tabelas, sem mexer nas RLS atuais.

## 6. Validação ao final

- Cadastro de médico solo (sem convite): cria conta, cria clínica/consultório, entra direto no dashboard. Sem pedir código.
- Cadastro de médico com convite: continua entrando como `profissional_member` e vinculado à clínica do convite.
- Cadastro Google: primeiro acesso abre "Complete seu perfil" e segue o fluxo de cima.
- Cadastro de Clínica com CNPJ: ao digitar 14 dígitos, busca automaticamente; falha de busca exibe mensagem cinza e não vermelho.
- Tentativa de cadastro com e-mail existente: toast neutro com link para login.
- Médico antigo sem clínica: consegue criar consultório próprio direto da tela de espera.
- Lista de especialidades: só especialidades, sem procedimentos.

## 7. Fora do escopo desta entrega

- Recuperação de senha por e-mail (não pedido agora).
- Mudar política de auto-confirm (não pedido). Se quiser exigir confirmação real por e-mail, eu faço em outra rodada com templates customizados.
- Limpar/migrar usuários antigos manualmente: a tela de "criar meu consultório" cobre o caso reclamado sem precisarmos editar dados em produção.