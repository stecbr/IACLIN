## Objetivo
Separar visualmente as configurações **Pessoais** das configurações da **Clínica** em `/settings`, usando um toggle no topo da página.

## Mudanças (apenas UI em `src/pages/SettingsPage.tsx`)

### 1. Toggle no topo
Adicionar um toggle estilo segmentado (Tabs/ToggleGroup do shadcn) logo abaixo do `PageHeader`, com duas opções:
- **Pessoal** (padrão quando o usuário não é admin/owner)
- **Clínica** (padrão para admin/owner)

### 2. Agrupamento das seções
Dividir o array `allSections` em dois grupos:

**Pessoal** (dados do usuário):
- Meu Perfil
- Clínicas Vinculadas
- Especialidades
- Meu Financeiro (apenas dentista)
- Segurança
- Aparência

**Clínica** (gestão da clínica — visível só para admin/owner):
- Minha Clínica
- Equipe
- Salas
- Convênios
- Procedimentos
- Recebimentos
- Assinatura

### 3. Comportamento
- A sidebar lateral (nav) passa a listar apenas as seções do grupo ativo do toggle.
- Ao trocar de grupo, seleciona automaticamente a primeira seção daquele grupo.
- Staff (`secretary`/`auxiliary`) continua vendo apenas Perfil/Segurança/Aparência → o toggle fica oculto (não faz sentido).
- Dentistas sem permissão de admin não veem o lado "Clínica" → toggle oculto também.
- Deep-link `?section=...` continua funcionando: detecta a qual grupo pertence e ativa o toggle correspondente.
- O aviso "Defina sua especialidade" continua funcionando (a seção pertence ao grupo Pessoal).

### Detalhes técnicos
- Sem mudanças de backend, schema ou RLS.
- Sem mexer nas seções em si — apenas no agrupamento/navegação de `SettingsPage.tsx`.
- Usar `Tabs` (shadcn) ou `ToggleGroup` com estilo iOS-minimal alinhado ao restante do app.
