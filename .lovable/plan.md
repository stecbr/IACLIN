# Landing page do Iaclin

Criar uma landing page institucional como primeira tela pública do sistema, reutilizando 100% dos tokens de design já existentes em `index.css` e `tailwind.config.ts` (fundo claro azulado, cards brancos, sombras `shadow-card`, raio `--radius`, primary azul, tipografia Inter).

## Roteamento

Hoje a rota `/` está protegida por `ProtectedRoute` e leva direto ao `Index` (dashboard). Vamos:

- Criar `src/pages/Landing.tsx` (pública).
- Em `src/App.tsx`, mudar a rota `/` para renderizar `Landing` quando o usuário **não estiver autenticado**, e manter o dashboard (`Index`) para usuários logados. Mesma URL, comportamento condicional via `useAuth()`.
- Botões "Acessar o Iaclin / Entrar / Começar Agora" apontam para `/auth` (rota interna já existente). Um arquivo `src/config/landing.ts` exporta `SYSTEM_URL` para deixar o destino configurável caso queiram trocar por URL externa depois.

## Estrutura do arquivo `Landing.tsx`

Componente único com seções, usando shadcn `Button`/`Card`, `lucide-react` e `framer-motion` (já no projeto) para fade/slide-up suaves.

1. **Navbar fixa translúcida** — logo "Iaclin" (wordmark + ponto azul), links âncora (Sobre, Recursos, Para quem é), botões `Entrar` (ghost) e `Acessar o Iaclin` (primary).
2. **Hero** — grid 2 colunas no desktop, coluna única no mobile.
   - Esquerda: eyebrow chip "Plataforma clínica inteligente", H1 "Gestão clínica inteligente, moderna e humanizada.", subheadline, CTAs `🚀 Acessar o Iaclin` (primary, lg) e `Ver recursos` (outline), linha de trust ("Para clínicas odontológicas, médicas, estética, psicologia…").
   - Direita: mockup do dashboard — card branco com `shadow-card-hover` simulando o painel (header com avatar, três KPI cards, mini gráfico em SVG, lista de próximas consultas). Tudo construído com os mesmos tokens, sem screenshot externo.
3. **Sobre o sistema** — bloco centrado com parágrafo institucional + 4 chips (Agenda, Prontuário, Atendimento, Gestão).
4. **Funcionalidades** — grid 4×2 de cards (Agenda Inteligente, Prontuário Digital, Gestão de Pacientes, Histórico Clínico, Atendimento Humanizado, Relatórios, Controle da Clínica, Segurança de Dados). Cada card: ícone Lucide em badge azul claro, título, descrição curta, hover eleva `shadow-card-hover` + leve translate-y.
5. **Diferenciais** — split: lista com checks (Interface simples, Visual moderno, Fácil de usar, Responsivo, Segurança, Organização, Experiência premium) + card visual ao lado.
6. **Para profissionais** — título "Feito para médicos, dentistas e profissionais da saúde" + grid de 6 mini-cards de especialidades (Dentistas, Clínicos, Psicólogos, Estética, Fisioterapia, Nutrição) com ícone.
7. **CTA final** — card central premium full-width (gradiente sutil usando `--primary`), título "Transforme sua rotina clínica com o Iaclin." e 3 botões: `Acessar o Iaclin` (primary lg), `Criar Conta` (secondary), `Entrar no Sistema` (ghost).
8. **Rodapé** — 4 colunas (marca + tagline, Produto, Empresa, Contato), linha inferior com © e redes sociais (ícones Lucide).

## Detalhes técnicos

- Animações: `framer-motion` com `whileInView` fade+slide-up (12px), stagger nos grids.
- Responsivo: mobile-first, breakpoints `md:` e `lg:` do Tailwind. Navbar vira drawer simples (Sheet do shadcn) no mobile.
- SEO em `index.html`: title "Iaclin — Gestão clínica inteligente", meta description, H1 único na landing.
- Acessibilidade: contraste via tokens, `aria-label` nos botões de ícone, links âncora com `scroll-smooth`.
- Sem novas dependências, sem mudanças de schema, sem edge functions.

## Arquivos

- **Criar** `src/pages/Landing.tsx`
- **Criar** `src/config/landing.ts` (constante `SYSTEM_URL`)
- **Editar** `src/App.tsx` (rota `/` condicional para usuários deslogados)
- **Editar** `index.html` (title/meta)
