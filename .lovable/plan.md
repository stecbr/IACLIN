## Diagnóstico

As 3 colunas (`address_number`, `address_complement`, `neighborhood`) já existem em `public.patients` — confirmado via consulta ao `information_schema`. O erro `Could not find the 'address_complement' column of 'patients' in the schema cache` agora é causado pelo **cache do PostgREST** que ainda não recarregou o schema após a migration.

## Correção

Migration de 1 linha que dispara o reload do schema cache do PostgREST:

```sql
NOTIFY pgrst, 'reload schema';
```

Depois disso o salvar de `/paciente/configuracoes` (endereço + foto) deve funcionar. Confirmo via `supabase--read_query` que as colunas estão lá e oriento o usuário a recarregar a página (Ctrl+F5) para limpar qualquer cache do cliente.

Sem alterações de frontend.
