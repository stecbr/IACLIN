# Diagrama atualizado do fluxo da plataforma (Mermaid)

## Objetivo
Entregar um diagrama Mermaid renderizável que reflete o estado **real** do código (Auth.tsx, AuthContext, WaitingClinic, edge functions de invite/join), corrigindo os pontos onde o draw.io divergia da implementação.

## Onde será adicionado
- **Novo arquivo**: `docs/fluxo-plataforma.md` (documentação interna, não afeta build).
- Conterá o diagrama em bloco ```mermaid``` + legenda curta explicando cada nó.
- Opcional (se você quiser visualizar dentro do app): adicionar rota `/docs/fluxo` renderizando via `mermaid` npm package. **Fora do escopo deste plano** — só crio o markdown.

## Conteúdo do diagrama (resumo dos nós)

**Entrada**
- `/auth` → 2 abas: Login | Cadastro
- Login: Email+senha **ou** Google OAuth
- Cadastro: Email+senha **ou** Google OAuth, com seleção de tipo (Profissional / Clínica / Paciente — Operadora travada)

**Pós-cadastro (Profissional)**
- Detecta `?invite=TOKEN` na URL → chama `accept-clinic-invite` → vai para `/` na clínica vinculada
- Sem token → vai para `/waiting-clinic` com 2 caminhos:
  - **Criar consultório próprio** → `create-own-clinic` (vira admin/owner)
  - **Inserir código `CLIN-XXXXXXXX`** → `join-clinic-by-code` (regex `/^CLIN-[A-Z2-9]{8}$/`)

**Pós-cadastro (Clínica)**
- `create-own-clinic` com `category` → admin/owner → `/onboarding` (3 passos) → `/` → Welcome Tour

**Pós-cadastro (Paciente)**
- Vai direto para área `/patient/*`

**Conflito de e-mail já cadastrado**
- Banner neutro no signup → auto-redirect para aba Login com email pré-preenchido

**Roteamento por papel (após login com sessão ativa)**
- `admin`/`owner` → Dashboard clínica completo
- `dentist` → `DentistHome` (KPIs pessoais, sem Financeiro/Secretária IA)
- `secretary` → sem Odontograma
- `patient` → `/patient/home`

**Configurações (novo)**
- Aba profissional → seção "Clínicas em que atendo" → permite entrar em clínica adicional via código (mesma edge function `join-clinic-by-code`)

## Detalhes técnicos
- Sintaxe: Mermaid `flowchart TD` com subgraphs por fase (Auth, Onboarding, Roteamento).
- Cores via `classDef` para destacar: edge functions (azul), decisões (amarelo), telas (cinza), estados travados/MVP-out (riscado).
- Legenda em tabela markdown abaixo do diagrama mapeando cada edge function ao arquivo em `supabase/functions/`.

## Fora do escopo
- Não altero código de auth, onboarding ou edge functions.
- Não crio rota nova nem instalo `mermaid` no app.
- Apenas o arquivo `.md` de documentação.

Se quiser que eu também renderize o Mermaid dentro do app numa rota `/docs/fluxo`, me avise depois da aprovação.
