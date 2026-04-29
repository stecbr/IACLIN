## Diagnóstico do problema

Investiguei o caso do **Marcio Batista** (`specialty = 'cirurgia-plastica'`, `registration_number = NULL`) e identifiquei 3 problemas distintos no painel do médico:

### 1. CRM não aparece
- O backfill anterior trouxe a especialidade do `auth.users.raw_user_meta_data`, mas o campo `registration_number` continua `NULL` no `clinic_members`.
- Causa: na tela de cadastro inicial (signup), nem todos os usuários preencheram o CRM, ou ele não foi propagado para o metadata. O `Profile.tsx` permite editar, mas o card "CRM" simplesmente fica vazio sem orientação.

### 2. Ferramentas Clínicas mostram itens odontológicos
- `src/pages/dentist/ToolsHome.tsx` é **único para todos os "dentists"** (papel interno do sistema, usado também para médicos). Mostra: Calculadora de Anestésico (com fármacos odonto), Atlas de Dentes, Receituário (templates odonto), Atestado, Foto Clínica, Timer, etc.
- Já existe precedente: psicólogos têm `PsiToolsHome` e o sidebar troca quando `mapType === 'psyche'`. Falta um equivalente para Cirurgia Plástica / áreas estéticas e médicas.

### 3. Orçamentos com catálogo odontológico
- `BudgetFormDialog` busca `procedures` sem filtro. A tabela `procedures` hoje **só tem categorias odonto** (Periodontia, Endodontia, Restauração, Prótese, Cirurgia bucal, Estética dental, etc.). Campo "Dente" é fixo no formulário.
- Não há campo `specialty` na tabela `procedures` para segregar por especialidade médica.

---

## Plano de correção

### Parte A — CRM/CRO no perfil (correção rápida)

Em `src/pages/Profile.tsx`:
- Quando `member.registration_number` está vazio, exibir o input com **destaque visual** (borda âmbar + texto "Complete seu CRM/CRO para emitir receitas e atestados").
- Sem mexer no fluxo de signup (conforme pedido anterior). O médico preenche uma vez no perfil e fica salvo.

### Parte B — Catálogo de procedimentos por especialidade

**Migração SQL:**
1. Adicionar coluna `specialty_category` em `public.procedures`:
   - Valores: `odonto`, `medico`, `estetica`, `veterinario`, `outro` (mesmo enum/strings do `clinics.category`).
2. Marcar todas as ~procedures existentes como `specialty_category = 'odonto'` (preservando dados atuais).
3. Inserir um catálogo inicial de **procedimentos de Cirurgia Plástica / Estética** (categoria `estetica`):
   - Consulta / Avaliação estética
   - Aplicação de Toxina Botulínica
   - Preenchimento com Ácido Hialurônico
   - Bioestimulador de colágeno
   - Peeling químico
   - Rinoplastia (avaliação)
   - Mamoplastia (avaliação)
   - Lipoaspiração (avaliação)
   - Abdominoplastia (avaliação)
   - Blefaroplastia (avaliação)
   - Otoplastia (avaliação)
   - Curativo / Retirada de pontos
   - Sessão de pós-operatório

   *(Sem preços fixos — `default_price = 0`, clínica ajusta nas Configurações)*

**Frontend (`BudgetFormDialog.tsx`):**
- Buscar a `specialty` do médico logado (`clinic_members`).
- Mapear `specialty → specialty_category` usando a categoria do `SPECIALTIES` catalog (ex.: `cirurgia-plastica` → `estetica`).
- Filtrar `procedures` pela categoria correspondente. Fallback: se não houver procedimentos para a categoria, mostrar todos.
- Esconder o campo **"Dente"** quando a categoria não for `odonto`.
- Substituir placeholder do título de "Restaurações + Clareamento" para algo neutro ("Ex: Toxina Botulínica + Preenchimento" para estética).

### Parte C — Ferramentas Clínicas por especialidade

Criar **`src/pages/aesthetic/AestheticToolsHome.tsx`** com ferramentas voltadas para Cirurgia Plástica / áreas estéticas:

| Ferramenta | Função |
|---|---|
| Receituário | Reusar `PrescriptionPad` (já é genérico, não é odonto-específico) |
| Atestado | Reusar `CertificateGenerator` |
| Foto Clínica (antes/depois) | Reusar `ClinicalCamera` — útil em estética |
| Timer de Procedimento | Reusar `ProcedureTimer` (genérico) |
| Ditado por Voz | Reusar `VoiceDictation` |
| Calculadora de Toxina Botulínica | **Nova** — unidades por região facial (glabela, frontal, periorbital, etc.) |
| Tabela de Áreas Faciais | **Nova** — referência rápida de doses padrão para BTX e preenchedor |
| Próximo Retorno | Reusar `QuickReturn` |

*Removidos: Atlas de Dentes, Calculadora de Anestésico odonto.*

**Roteamento e sidebar (`AppSidebar.tsx`):**
- Estender a lógica de "Psi" para detectar categoria estética. Adicionar helper `getToolsRouteForSpecialty(specialty)`:
  - `psyche` → `/psi/ferramentas`
  - `estetica` (cirurgia plástica, dermatologia estética) → `/estetica/ferramentas`
  - Resto → `/ferramentas` (atual)
- O item "Ferramentas Clínicas" no sidebar passa a apontar para a rota certa por especialidade.
- Mesma lógica esconde "Orçamentos" para psi (já existe) — mantemos Orçamentos visível para estética, mas com catálogo correto.

### Parte D — Mapa Clínico para Cirurgia Plástica

Em `src/components/clinical-map/mapRegistry.ts`:
- Adicionar entradas para `cirurgia_plastica` e `dermatologia_clinica_e_cirurgica` apontando para `mapType: 'body'` (Mapa Corporal já existente) — assim o Marcio terá o mapa correto no lugar do "Odontograma" no sidebar (que já está oculto para não-odonto, mas o item dinâmico ficava ausente).

---

## Detalhes técnicos

**Mapa de especialidade → categoria** (helper novo em `SpecialtySelect.tsx`):
```ts
export function specialtyCategoryOf(id: string): 'odonto'|'medico'|'estetica'|'veterinario'|'outro' {
  return SPECIALTIES.find(s => s.id === id)?.category ?? 'outro';
}
```

**Arquivos a editar:**
- `src/pages/Profile.tsx` — destaque visual no CRM vazio
- `src/components/budgets/BudgetFormDialog.tsx` — filtrar procedures, esconder "Dente"
- `src/components/SpecialtySelect.tsx` — exportar `specialtyCategoryOf`
- `src/components/clinical-map/mapRegistry.ts` — adicionar cirurgia_plastica, dermatologia
- `src/components/AppSidebar.tsx` — rota dinâmica de Ferramentas
- `src/App.tsx` — registrar rota `/estetica/ferramentas`

**Arquivos a criar:**
- `src/pages/aesthetic/AestheticToolsHome.tsx`
- `src/components/aesthetic/BotoxCalculator.tsx`
- `src/components/aesthetic/FacialAreasReference.tsx`

**Migração SQL:**
- `ALTER TABLE procedures ADD COLUMN specialty_category text DEFAULT 'odonto'`
- `UPDATE procedures SET specialty_category='odonto' WHERE specialty_category IS NULL`
- `INSERT` no catálogo de estética (~13 procedimentos)

**Sem mudanças em:** signup, edge functions, RBAC, config.toml.

---

## Resultado esperado para o Marcio

- Sidebar mostra "**Mapa Corporal**" (em vez de Odontograma).
- "**Ferramentas Clínicas**" abre o painel de estética (BTX, preenchimento, foto clínica, etc.).
- "**Orçamentos** → Novo Orçamento" lista procedimentos de Cirurgia Plástica / Estética, sem campo "Dente".
- "**Meu Perfil**" destaca o campo CRM vazio, pedindo preenchimento.
- Mesma lógica vale automaticamente para qualquer outro médico de Cirurgia Plástica / Dermatologia Estética que se cadastre depois.
