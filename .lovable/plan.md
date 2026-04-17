
## Menu lateral na área do paciente

Replicar o mesmo padrão visual do `AppSidebar` da clínica para a área `/paciente`, dividindo o `PatientDashboard.tsx` (hoje monolítico) em sub-rotas com sidebar persistente.

### Estrutura de rotas

```
/paciente              → Dashboard (resumo + próxima consulta)
/paciente/plano        → Plano de saúde (cartão + edição)
/paciente/agendas      → Minhas agendas (próximas + histórico)
/paciente/exames       → Meus exames e documentos
/paciente/configuracoes → Configurações (perfil, tema, etc.)
```

### Arquivos novos

| Arquivo | Função |
|---|---|
| `src/components/PatientSidebar.tsx` | Sidebar com mesmo design do `AppSidebar` (logo, grupos "Principal" / "Conta", footer com avatar + sair). Itens: Dashboard, Plano de Saúde, Minhas Agendas, Meus Exames, Configurações. |
| `src/components/PatientLayout.tsx` | Layout com `SidebarProvider` + `PatientSidebar` + header (breadcrumb, theme toggle) + `<Outlet />` animado, espelhando `AppLayout`. |
| `src/pages/patient/PatientHome.tsx` | Resumo: saudação, quick actions, próxima consulta, mini-cards (último exame, status do plano). |
| `src/pages/patient/PatientPlan.tsx` | Cartão visual do convênio + dialog de edição (provider/número). |
| `src/pages/patient/PatientAppointments.tsx` | Tabs Próximas / Histórico, com confirmar/cancelar. |
| `src/pages/patient/PatientExams.tsx` | Lista de documentos com download via signed URL. |
| `src/pages/patient/PatientSettings.tsx` | Editar nome, telefone, data de nascimento + tema + sair. |

### Arquivos modificados

| Arquivo | O que muda |
|---|---|
| `src/App.tsx` | Trocar rota única `/paciente` por rotas aninhadas dentro de `<PatientLayout />` (Outlet). Manter `PatientProtectedRoute` envolvendo o layout. |
| `src/pages/PatientDashboard.tsx` | Vira o `PatientHome` (resumo). Lógica de data fetching extraída para um hook `usePatientData` reutilizado pelas sub-páginas (cache simples via React Query). |
| `src/hooks/useRoleAccess.ts` | Adicionar permissões para as novas rotas `/paciente/*` (apenas role `patient`). |

### Design (reuso do AppSidebar)

- Mesmo `Sidebar collapsible="icon"` com `SidebarHeader` (logo dinâmico claro/escuro), `SidebarContent` (grupos com labels minúsculos uppercase) e `SidebarFooter` (avatar + email + botão sair).
- Mesmo padrão de `NavLink` com gradiente `primary/12 → primary/6` no item ativo, animação de ping no badge, tooltip quando colapsado.
- Mobile: aproveitar `MobileBottomNav` adaptado OU manter sidebar via `Sheet` (já é o comportamento padrão do shadcn sidebar em mobile).

### Ícones (lucide)
- Dashboard: `LayoutDashboard`
- Plano de Saúde: `CreditCard`
- Minhas Agendas: `Calendar`
- Meus Exames: `FileText`
- Configurações: `Settings`
- Sair: `LogOut`
