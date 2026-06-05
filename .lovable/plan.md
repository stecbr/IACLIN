## Resumo
Quatro frentes: (1) limpar a lista de especialidades, (2) melhorar o modal de cadastro de clínica, (3) criar a tabela `payment_accounts` que está faltando no banco, (4) adicionar autocomplete de bancos brasileiros com código automático.

---

## 1. Filtro de Especialidades (`SpecialtyStep.tsx`)

**Fluxo Médico** — remover itens que não são especialidades reais:
- `renovacao-receitas` ("Renovação de Receitas")
- `avaliacao` ("Avaliação")
- `avaliacao-bariatrica` ("Avaliação Bariátrica") → opcional remover
- `avaliacao-risco-cirurgico` ("Avaliação de Risco Cirúrgico") → opcional remover
- `dor-cabeca`, `dor-costas`, `dor-estomago` (são sintomas, não especialidades)

**Fluxo Dentista** — simplificar para apenas a opção principal:
- Manter `dentista` (Smile)
- Remover `limpeza-dental` ("Limpeza Dental")
- Remover `cirurgia-bucomaxilofacial` (é uma especialidade odonto real — confirmar se mantém; o usuário pediu "priorizar simplicidade", então remover por padrão e deixar só "Dentista")

Também atualizar `MarketplaceFilters.tsx` (lista hardcoded com "Cirurgia", "Limpeza dental") para refletir somente "Dentista" como opção odonto.

---

## 2. Modal de Cadastro de Clínica (`RegisterClinicDialog.tsx`)

**Tamanho/UI:**
- Trocar `sm:max-w-md` por `sm:max-w-3xl` (modal mais amplo)
- Reorganizar campos em grid de 2 colunas em telas md+
- Aumentar padding e espaçamento entre seções com agrupamentos visuais (Dados da Empresa / Endereço / Responsável)

**Campos:**
- Adicionar **Endereço completo** (obrigatório): rua, número, complemento, bairro, cidade, estado, CEP. Usar busca por CEP via ViaCEP para autopreenchimento. Persistir em `clinics.address`, `clinics.city`, `clinics.state`, `clinics.zip_code` (campos já existem na tabela).
- Renomear label "Responsável" → "Nome completo do responsável" (placeholder: "Nome completo do responsável legal").
- **Categoria:**
  - Se for fluxo do Dentista (detectar pela `specialty`/`category` do usuário em metadata), travar em `odonto` (disabled).
  - Remover opção "Veterinária" da lista geral.
  - Permitir digitação livre: trocar o `<Select>` por Combobox (input + sugestões), salvando texto livre quando "outro". Como a coluna `clinics.category` é um enum (`clinic_category`), valores livres serão salvos como `outro` e o texto digitado vai para um novo campo `category_label` (TEXT, nullable) — ou simplesmente acrescido em `name`/observação. Decisão: adicionar coluna `category_label TEXT` via migration leve.

A edge function `create-own-clinic` precisa aceitar e gravar os novos campos (`address`, `city`, `state`, `zip_code`, `category_label`).

---

## 3. Corrigir erro `payment_accounts` (Supabase)

Causa: a migration `20260601000000_payment_accounts.sql` existe no arquivo mas a tabela **não está criada** no banco (`SELECT` em `information_schema` retornou 0 linhas). Além disso, a migration original não tinha `GRANT`s (Data API exige).

**Nova migration** que:
1. Cria `public.payment_accounts` (caso ainda não exista).
2. Adiciona `GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;` e `GRANT ALL ... TO service_role;`.
3. Habilita RLS + recria policies de leitura/escrita (clinic member admin/owner ou próprio doctor).
4. Trigger `updated_at`.

Isso resolverá o erro "Could not find the table 'public.payment_accounts' in the schema cache".

---

## 4. Autocomplete de Banco (PaymentAccountSection)

- Criar `src/lib/brazilianBanks.ts` com lista estática dos principais bancos BR (código FEBRABAN + nome): 001 BB, 033 Santander, 104 Caixa, 237 Bradesco, 260 Nubank, 341 Itaú, 077 Inter, 212 Banco Original, 336 C6 Bank, 290 PagBank, 380 PicPay, 422 Safra, 655 Votorantim, 745 Citibank, 070 BRB, 756 Sicoob, 748 Sicredi, 041 Banrisul, etc. (~30 bancos).
- Substituir o `<Input>` "Banco" por um Combobox (Popover + Command/search) que:
  - Mostra `código — nome` ao digitar
  - Ao selecionar, preenche `bank_name` e `bank_code` automaticamente
  - Permite digitar manualmente se não encontrar (fallback livre)

---

## Detalhes técnicos

**Arquivos a editar:**
- `src/components/patient/booking/SpecialtyStep.tsx` — remover entries da `SPECIALTIES`
- `src/components/marketplace/MarketplaceFilters.tsx` — limpar lista hardcoded
- `src/components/RegisterClinicDialog.tsx` — endereço, label, categoria, layout maior
- `src/components/settings/PaymentAccountSection.tsx` — combobox de banco
- `supabase/functions/create-own-clinic/index.ts` — aceitar address/city/state/zip/category_label
- Nova migration: criar `payment_accounts` + grants; e opcionalmente adicionar `category_label` em `clinics`

**Arquivos a criar:**
- `src/lib/brazilianBanks.ts` — catálogo de bancos
- `src/components/BankSelect.tsx` — combobox reutilizável (opcional, pode ser inline)

**Como detectar "fluxo do dentista" no modal:**
Ler `user.user_metadata.clinic_category` ou `specialty` via `useAuth()`. Se categoria for `odonto` ou specialty pertencer a `category === 'odonto'`, travar Select em `odonto`.

---

## Pergunta antes de implementar

Sobre **especialidades odontológicas** no fluxo do Dentista: o usuário disse "deixar apenas Dentista (ou especialidades odontológicas reais, priorizando simplicidade)". Vou seguir a interpretação mais simples: manter apenas `dentista` e remover `limpeza-dental` e `cirurgia-bucomaxilofacial` da lista visível ao paciente. Se preferir manter as 2-3 especialidades odonto reais (Ortodontia, Endodontia, Implantodontia), me avise — caso contrário sigo com a versão simplificada.