Plano de correção:

1. Corrigir o travamento ao sair do IA Gestor
- Ajustar o layout principal em `AppLayout` para impedir que a página do IA Gestor ocupe/segure a área acima do menu lateral.
- Ajustar o contêiner do `IaGestor` para usar altura contida (`min-h-0`, `overflow-hidden` e largura segura) sem bloquear cliques do menu.
- Garantir que ao clicar em qualquer item do menu a rota mude normalmente e o conteúdo anterior seja desmontado.

2. Padronizar o menu lateral do Super Admin
- Reescrever `SuperAdminLayout` para usar os mesmos componentes base do menu dos demais usuários: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarMenu`, `SidebarMenuButton`, `SidebarFooter`.
- Manter os links atuais do superadmin: Visão Geral, Clínicas, Médicos, Operadoras, Planos, Cupons, Pagamentos e Configurações.
- Aplicar o mesmo estilo visual: logo no topo, itens arredondados, estado ativo com destaque em `primary`, rodapé com e-mail/saída e suporte ao tema claro/escuro.

3. Verificação
- Conferir `/ia-gestor` clicando em Agenda, Pacientes, Financeiro, Configurações etc.
- Conferir `/superadmin` e subrotas para validar que o menu ficou consistente com o padrão dos demais acessos.