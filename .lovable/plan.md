

# Plano: Melhorias visuais inspiradas no 21st.dev

## Contexto
O projeto usa shadcn/ui (Radix + Tailwind). Em vez de importar componentes externos do 21st.dev (que sao para Next.js e teriam problemas de compatibilidade), vou aplicar os **padroes visuais** que eles usam diretamente nos componentes existentes, mantendo shadcn/ui como base.

---

## 1. Dashboard / KPI Cards (Index.tsx)

**O que muda:**
- Cards de KPI com numeros animados (contagem progressiva com CSS/JS)
- Micro-sparkline inline nos cards (mini grafico de tendencia dos ultimos 7 dias)
- Efeito de hover com elevacao suave e borda gradiente sutil
- Icones com background gradiente em vez de cor solida
- Saudacao com hora do dia ("Bom dia", "Boa tarde", "Boa noite")

**Arquivos:** `src/pages/Index.tsx`, novo componente `src/components/dashboard/AnimatedNumber.tsx`

---

## 2. Calendario / Agenda (Agenda.tsx)

**O que muda:**
- Cards de consulta com cor de fundo derivada do procedimento (em vez de so borda esquerda)
- Avatar do paciente nos slots da agenda
- Tooltip on hover mostrando detalhes da consulta
- Header do dia com indicador visual mais destacado para "hoje" (circulo preenchido azul)
- Transicoes suaves ao trocar de semana/mes

**Arquivos:** `src/pages/Agenda.tsx`

---

## 3. Tabelas de Dados (Patients.tsx, Financial.tsx)

**O que muda:**
- Header da tabela com background sutil e bordas arredondadas
- Rows com hover mais pronunciado e transicao suave
- Coluna de status com badges coloridos estilo pill (mais arredondados, com ponto indicador)
- Avatares com anel de status (online/ativo = anel verde)
- Filtros inline com chips selecionaveis em vez de dropdowns
- Contagem animada no header ("47 pacientes")

**Arquivos:** `src/pages/Patients.tsx`, `src/pages/Financial.tsx`

---

## 4. Sidebar / Navegacao (AppSidebar.tsx)

**O que muda:**
- Logo IACLIN com icone mais elaborado (gradiente azul)
- Indicador de rota ativa com background gradiente sutil em vez de barra lateral
- Separadores de secao com linhas finas e labels mais elegantes
- Footer do usuario com card hover mostrando email/papel
- Badge de notificacao com animacao pulse no icone da Agenda
- Icone de clinica ativa com nome truncado no header (quando expandido)

**Arquivos:** `src/components/AppSidebar.tsx`

---

## Detalhes tecnicos

- Nenhuma dependencia nova sera adicionada
- Todas as melhorias usam Tailwind CSS (animacoes, gradientes, transicoes)
- Componente `AnimatedNumber` usa `useEffect` + `requestAnimationFrame` para contagem progressiva
- Tooltips usam o componente existente do shadcn/ui
- Mantemos 100% de compatibilidade com dark mode

## Estimativa
~4 arquivos editados, 1 componente novo. Mudancas puramente visuais, sem alteracao de logica de dados.

