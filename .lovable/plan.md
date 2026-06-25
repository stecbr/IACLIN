Plano para corrigir o fluxo de permissões do Jesus

1. Ajustar a sidebar da secretária
- Mover “Aprovações” para dentro da seção “Atendimento do Dia” junto de:
  - Agenda
  - Sala de Espera
  - Aprovações
- Evitar que “Aprovações” fique em “Gestão da Clínica” para secretária/auxiliar.
- Manter “Atendimento do Dia” como agrupamento principal para esse perfil.

2. Corrigir o acesso direto à rota
- Garantir que `/clinica/aprovacoes` só bloqueie quando a permissão `aprovacoes` estiver explicitamente `false`.
- Se a permissão estiver `true`, como está no banco para Jesus, a tela deve carregar normalmente.
- Se o usuário tentar acessar sem permissão, redireciona como hoje.

3. Corrigir possíveis inconsistências de cache/permissões
- Padronizar o hook de permissões para não depender de fallback enquanto a permissão real ainda está carregando, evitando menu errado no primeiro carregamento.
- Manter polling/refetch como fallback caso o realtime não atualize.

4. Validar com os dados atuais
- Já confirmei no banco que o usuário Jesus está como `secretary`, ativo, com `aprovacoes: true` na clínica `200c1de3-78ad-4f31-9afe-423286aa25bd`.
- Depois da correção, validar que no menu dele aparecem: “Atendimento do Dia”, “Agenda”, “Sala de Espera” e “Aprovações”, e que `/clinica/aprovacoes` não volta para o Dashboard.