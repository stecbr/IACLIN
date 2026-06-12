## Mudanças solicitadas

### 1. Configurações → Procedimentos: catálogo vazio

- Apagar todos os 52 procedimentos do catálogo global (`procedures`). O dentista/médico passa a cadastrar manualmente via botão **+ Novo**.
- Também limpar `clinic_member_procedures` (vínculos profissional↔procedimento) já que os procedimentos referenciados deixarão de existir. - exato porém depois que o dentista/medico adicionar ele tem que pegar as informações adicionandas 
- A tela `ProceduresCrudSection` já suporta lista vazia (exibe só o botão **+ Novo**) — sem mudança de UI necessária.

### 2. Remover aba "Feriados" das Configurações

- Em `src/pages/SettingsPage.tsx`: remover o item `{ id: 'holidays', label: 'Feriados' }` da lista de seções e o bloco `{activeSection === 'holidays' && <HolidaysSection />}`.
- Remover o import de `HolidaysSection` e do ícone `CalendarOff` (se não usado em outro lugar).
- O arquivo `HolidaysSection.tsx` permanece no projeto (não excluir) caso queira religar depois.

### 3. Fluxo Credenciamentos → Convênios

**Em `/clinica/credenciamentos**` (`ClinicaCredentialings.tsx` → `MyCredentialingSection`):

- Cada card de operadora **credenciada** ("Credenciado" verde) ganha um onClick / botão **"Ver tabela de valores"** que navega para `/clinica/convenios?operator=<operator_id>`.
- Operadoras ainda não credenciadas continuam mostrando só "Solicitar credenciamento" (sem navegação).

**Em `/clinica/convenios**` (`ClinicaConvenios.tsx`):

- Ler `?operator=` do query string e já pré-selecionar a operadora correspondente ao montar.
- Adicionar botão **"← Voltar para credenciamentos"** no header da página, ao lado/abaixo do `PageHeader`, que navega para `/clinica/credenciamentos`.
- Placeholder "Informações de contrato" fica **fora de escopo agora** (anotado para depois, conforme pedido).

### 4. Remover US$ da tela `/clinica/convenios`

- Em `ClinicaConvenios.tsx` linha 405-406: remover o bloco `{it.value_us != null && (<p>US$ ...</p>)}`. A página passa a exibir só `R$` (`value_brl`).
- A tela da operadora (`OperatorPriceTable.tsx`) **não muda** — lá o campo US$ continua existindo (operadora pode preencher, mas clínica não vê).

## Fora de escopo

- Excluir `HolidaysSection.tsx` ou remover a coluna `value_us` do banco.
- Tela / módulo de informações de contrato dentro de Convênios (fica para depois).
- Mexer na tela da operadora.

## Detalhes técnicos

- Migration: `DELETE FROM public.clinic_member_procedures; DELETE FROM public.procedures;` (sem FK em procedures — verificado).
- Navegação: usar `useNavigate()` + `useSearchParams()` do `react-router-dom`.
- Sem alterações em RLS, types ou edge functions.