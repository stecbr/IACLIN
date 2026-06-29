
# Melhorar UX do fluxo de Repasses (Comissões)

Hoje o fluxo de repasse existe e funciona, mas ele é "silencioso": o dono da clínica precisa adivinhar o que cada botão faz, e o profissional não entende de onde vêm os valores em "Meu Financeiro". Vou tornar o fluxo auto-explicativo em **3 pontos da plataforma**, sem mudar regra de negócio.

---

## 1. Painel de Repasses (visão Dono/Admin/Secretária)
Arquivo: `src/components/finance/PayoutsPanel.tsx` (+ `ClosePayoutDialog.tsx`)

- **Cabeçalho explicativo** no topo do painel:
  > "Aqui você fecha o período e registra o pagamento das comissões dos profissionais. O sistema soma automaticamente todas as comissões geradas pelos atendimentos concluídos. Você paga o profissional por fora (Pix, transferência, dinheiro) e registra aqui — assim o profissional vê o recebimento dele em **Meu Financeiro**."
- Botão **"Como funciona?"** abrindo um `Sheet` lateral com o fluxo ilustrado em 4 passos (Atendimento → Comissão gerada → Fechamento → Pagamento registrado).
- Cada card de profissional ganha:
  - Tooltip no valor explicando "Soma das comissões pendentes desde {data mais antiga}".
  - Microcopy sob o botão: "Fechar período e registrar pagamento".
  - Badge de período sugerido (ex: "Últimos 30 dias").
- No `ClosePayoutDialog`:
  - Texto introdutório curto: "Confirme o período, o método usado e registre. Isso **não envia dinheiro**, apenas registra que você já pagou."
  - Renomear botão de "Confirmar pagamento" → "Registrar pagamento já realizado" (deixa claro que é registro, não transferência).
  - Adicionar alerta visual quando `total = 0` orientando ampliar o período.

## 2. Tela "Meu Financeiro" (visão Profissional vinculado)
Arquivo: `src/pages/dentist/MyFinance.tsx`

- Banner de boas-vindas explicando: "Aqui você acompanha as comissões dos seus atendimentos. Os valores são pagos pela clínica fora da plataforma (Pix/transferência). Quando a clínica registra o pagamento, ele aparece em **Fechamentos recebidos**."
- Renomear/clarificar abas:
  - "Comissões a receber" → microcopy "Aguardando fechamento pela clínica"
  - "Fechamentos recebidos" → microcopy "Pagamentos já confirmados pela clínica"
- Tooltip em cada linha explicando origem (paciente + atendimento).
- Estado vazio amigável: "Nenhuma comissão ainda. Assim que você finalizar um atendimento com pagamento registrado, ela aparece aqui."

## 3. Onboarding contextual / Tour
Arquivo novo: `src/components/finance/PayoutsHelpSheet.tsx` (reutilizado nos 2 contextos acima)

- Componente único de ajuda com 4 passos visuais + ícones (Lucide), que pode ser aberto tanto pelo dono quanto pelo profissional.
- Mostra os papéis lado a lado: o que o **Profissional** vê × o que o **Dono/Secretária** vê em cada passo.

## 4. Pequenos ajustes complementares
- `MyFinance.tsx`: adicionar card "Próximo fechamento estimado" com a data média de fechamento dos últimos 3 períodos (se houver histórico).
- `PayoutsPanel.tsx`: filtro rápido por profissional quando a clínica tiver muitos.
- Garantir que todos os textos usem o termo **"Repasse"** de forma consistente (hoje varia entre "comissão", "fechamento", "pagamento").

---

## Detalhes técnicos
- Sem mudanças de schema, RPC ou edge functions. Apenas componentes UI + microcopy.
- Reutilizo `Sheet`, `Tooltip`, `Alert` e `Card` do shadcn já presentes no projeto.
- Sem mexer em lógica de geração de comissão (`src/lib/commissions.ts`) nem na RPC `close_commission_period`.
- Sem alteração de permissões — `useFinanceVisibility` continua governando quem vê o quê.

## Fora de escopo (confirmar se quer incluir)
- Notificação automática (sino/email) ao profissional quando um repasse é registrado.
- Geração de comprovante PDF do repasse.
