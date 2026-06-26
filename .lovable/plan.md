## Problema

1. Quando o médico clica em **Finalizar Atendimento** na página de Atendimento (`src/pages/Attendance.tsx`), o código só atualiza `appointments.status = 'completed'` — não toca em `presence_status`. Por isso o paciente não aparece na coluna **Aguardando pagamento** da Sala de Espera (o fluxo só funciona quando o secretário usa o botão "Concluir atendimento" do card).
2. A página `/sala-de-espera` não tem campo de busca por paciente ou profissional.

## Mudanças

### 1. `src/pages/Attendance.tsx` — mover para "Aguardando pagamento" ao finalizar
No bloco de finalização (linhas ~665-670), além de `status: 'completed'`, definir também `presence_status: 'awaiting_payment'` — somente se a presença atual não for já `finished` / `no_show` (para não regredir um atendimento já totalmente encerrado).

```ts
.update({ status: 'completed', presence_status: 'awaiting_payment' })
```

Isso faz com que, ao médico finalizar pela tela de atendimento, o card apareça automaticamente na coluna **Aguardando pagamento** da Sala de Espera para o secretário/dono registrar (ou postergar) o pagamento.

### 2. `src/pages/WaitingRoom.tsx` — busca por paciente ou profissional
- Adicionar `const [search, setSearch] = useState('')`.
- Renderizar um `<Input>` com ícone de lupa ao lado do `Select` de profissionais no `PageHeader` (largura ~240px), placeholder "Buscar paciente ou profissional...".
- Filtrar `enriched` antes de dividir em `waiting / arrived / inService / awaitingPayment`:
  ```ts
  const q = search.trim().toLowerCase();
  const visible = q
    ? enriched.filter(a =>
        (a.patients?.full_name ?? '').toLowerCase().includes(q) ||
        (a.dentist_name ?? '').toLowerCase().includes(q)
      )
    : enriched;
  ```
- Usar `visible` nos quatro filtros de coluna e nos KPIs.

Nenhuma mudança em schema ou edge functions é necessária.