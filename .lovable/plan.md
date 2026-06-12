## Causa

A tela "Minhas configurações" do paciente grava `address_complement`, `address_number` e `neighborhood` em `patients`, mas a tabela só tem `address`, `city`, `state`, `zip_code`. Resultado: PostgREST devolve `Could not find the 'address_complement' column of 'patients' in the schema cache` e o salvar quebra (inclusive ao trocar foto, porque é um único upsert).

Colunas atuais de `patients` relacionadas a endereço: `address`, `city`, `state`, `zip_code`.
Faltando: `address_number`, `address_complement`, `neighborhood`.

## Correção

Migration única adicionando as 3 colunas faltantes:

```sql
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text;
```

Sem mudança de RLS (políticas existentes já cobrem todas as colunas da linha) e sem alterações no front — o formulário já envia esses campos.

## Fora de escopo

- `patient_accounts` já recebeu `gender`, `rg`, `profession` na migration anterior.
- Outros campos do formulário do paciente já existem nas tabelas correspondentes.
