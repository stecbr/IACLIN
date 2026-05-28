import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RecordingProvider } from "@/contexts/RecordingContext";
import { GlobalRecordingBar } from "@/components/attendance/recording/GlobalRecordingBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CustomThemeProvider } from "@/components/CustomThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Agenda from "./pages/Agenda";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import OpenChart from "./pages/OpenChart";
import Odontogram from "./pages/Odontogram";
import ClinicalMapPage from "./components/clinical-map/ClinicalMapPage";
import Financial from "./pages/Financial";
import SettingsPage from "./pages/SettingsPage";
import Subscription from "./pages/Subscription";
import Budgets from "./pages/Budgets";
import Attendance from "./pages/Attendance";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Marketplace from "./pages/Marketplace";
import MarketplaceBooking from "./pages/MarketplaceBooking";
import PatientChartRedeem from "./pages/PatientChartRedeem";
import SecretariaIA from "./pages/SecretariaIA";
import SecretariaIAPainel from "./pages/SecretariaIAPainel";
import IaGestor from "./pages/IaGestor";
import AtendimentosIA from "./pages/AtendimentosIA";
import Availability from "./pages/Availability";
import WaitingRoom from "./pages/WaitingRoom";
import PatientsOfDay from "./pages/PatientsOfDay";
import ClinicaHome from "./pages/clinica/ClinicaHome";
import ClinicaMedicos from "./pages/clinica/ClinicaMedicos";
import ClinicaAprovacoes from "./pages/clinica/ClinicaAprovacoes";
import ToolsHomeUnified from "./pages/ToolsHomeUnified";
import { PatientLayout } from "./components/PatientLayout";
import PatientHome from "./pages/patient/PatientHome";
import PatientPlan from "./pages/patient/PatientPlan";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientBooking from "./pages/patient/PatientBooking";
import PatientHistory from "./pages/patient/PatientHistory";
import PatientExams from "./pages/patient/PatientExams";
import PatientSettings from "./pages/patient/PatientSettings";
import { OperatorLayout } from "./components/operadora/OperatorLayout";
import OperatorDashboard from "./pages/operadora/OperatorDashboard";
import OperatorNetwork from "./pages/operadora/OperatorNetwork";
import OperatorRequests from "./pages/operadora/OperatorRequests";
import OperatorAgenda from "./pages/operadora/OperatorAgenda";
import OperatorSettings from "./pages/operadora/OperatorSettings";
import OperatorAttendances from "./pages/operadora/OperatorAttendances";
import OperatorBilling from "./pages/operadora/OperatorBilling";
import OperatorInvites from "./pages/operadora/OperatorInvites";
import { SuperAdminLayout } from "./components/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminClinics from "./pages/superadmin/SuperAdminClinics";
import SuperAdminDoctors from "./pages/superadmin/SuperAdminDoctors";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";
import SuperAdminOperators from "./pages/superadmin/SuperAdminOperators";
import SuperAdminPlans from "./pages/superadmin/SuperAdminPlans";
import SuperAdminCoupons from "./pages/superadmin/SuperAdminCoupons";
import SuperAdminPayments from "./pages/superadmin/SuperAdminPayments";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, currentClinicId, isPatient, isOperator, isPlatformAdmin, simulatedRole, isPersonalMode, clinicsLoaded } = useAuth();
  const { canAccess } = useRoleAccess();
  const location = useLocation();

  if (loading || (user && !clinicsLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Super admin da plataforma → redireciona para área exclusiva
  if (isPlatformAdmin) return <Navigate to="/superadmin" replace />;
  // Dev simulation: simulating patient → send to patient area
  if (simulatedRole === 'patient') return <Navigate to="/paciente" replace />;
  // Operator users go to their own workspace
  if (isOperator) return <Navigate to="/operadora" replace />;
  // Patient users go to their own area
  if (isPatient) return <Navigate to="/paciente" replace />;
  // No clinic linked: dentists in personal mode get full app access; admins go to
  // onboarding (can create one); others (e.g. secretary) wait for an invite code.
  if (!currentClinicId && !isPersonalMode) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!canAccess(location.pathname)) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPlatformAdmin, clinicsLoaded } = useAuth();

  if (loading || (user && !clinicsLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}

function OperatorProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading, isOperator, clinicsLoaded } = useAuth();
  if (loading || (user && !clinicsLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isOperator) return <Navigate to="/" replace />;
  return <OperatorLayout>{children}</OperatorLayout>;
}

function PatientProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPatient, simulatedRole, isDevUser } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Allow dev users simulating patient to access patient area
  if (!isPatient && !(isDevUser && simulatedRole === 'patient')) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function OnboardingRoute() {
  const { user, loading, currentClinicId, isPatient, clinicsLoaded } = useAuth();

  if (loading || (user && !clinicsLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isPatient) return <Navigate to="/paciente" replace />;
  if (currentClinicId) return <Navigate to="/" replace />;

  return <Onboarding />;
}

function HomeRoute() {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Landing />;
  if (isPlatformAdmin) return <Navigate to="/superadmin" replace />;
  return <ProtectedRoute><Index /></ProtectedRoute>;
}

const AppRoutes = () => (
  <Routes>
    {/* ── Área exclusiva do Super Admin da Plataforma ── */}
    <Route path="/superadmin" element={<SuperAdminProtectedRoute><SuperAdminDashboard /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/clinicas" element={<SuperAdminProtectedRoute><SuperAdminClinics /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/medicos" element={<SuperAdminProtectedRoute><SuperAdminDoctors /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/operadoras" element={<SuperAdminProtectedRoute><SuperAdminOperators /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/planos" element={<SuperAdminProtectedRoute><SuperAdminPlans /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/cupons" element={<SuperAdminProtectedRoute><SuperAdminCoupons /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/pagamentos" element={<SuperAdminProtectedRoute><SuperAdminPayments /></SuperAdminProtectedRoute>} />
    <Route path="/superadmin/configuracoes" element={<SuperAdminProtectedRoute><SuperAdminSettings /></SuperAdminProtectedRoute>} />

    <Route path="/auth" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/onboarding" element={<OnboardingRoute />} />
    <Route path="/aguardando-clinica" element={<Navigate to="/onboarding" replace />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/marketplace/agendar" element={<MarketplaceBooking />} />
    <Route path="/prontuario/compartilhado" element={<PatientChartRedeem />} />
    <Route path="/paciente" element={<PatientProtectedRoute><PatientLayout /></PatientProtectedRoute>}>
      <Route index element={<PatientHome />} />
      <Route path="plano" element={<PatientPlan />} />
      <Route path="agendas" element={<PatientAppointments />} />
      <Route path="agendar" element={<PatientBooking />} />
      <Route path="historico" element={<PatientHistory />} />
      <Route path="exames" element={<PatientExams />} />
      <Route path="configuracoes" element={<PatientSettings />} />
    </Route>
    <Route path="/operadora" element={<OperatorProtectedRoute />}>
      <Route index element={<OperatorDashboard />} />
      <Route path="rede" element={<OperatorNetwork />} />
      <Route path="pedidos" element={<OperatorRequests />} />
      <Route path="convites" element={<OperatorInvites />} />
      <Route path="agenda" element={<OperatorAgenda />} />
      <Route path="atendimentos" element={<OperatorAttendances />} />
      <Route path="faturamento" element={<OperatorBilling />} />
      <Route path="configuracoes" element={<OperatorSettings />} />
    </Route>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
    <Route path="/minha-agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
    <Route path="/disponibilidade" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
    <Route path="/sala-de-espera" element={<ProtectedRoute><WaitingRoom /></ProtectedRoute>} />
    <Route path="/pacientes-do-dia" element={<ProtectedRoute><PatientsOfDay /></ProtectedRoute>} />
    <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
    <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
    <Route path="/prontuarios" element={<ProtectedRoute><OpenChart /></ProtectedRoute>} />
    <Route path="/clinica" element={<ProtectedRoute><ClinicaHome /></ProtectedRoute>} />
    <Route path="/clinica/medicos" element={<ProtectedRoute><ClinicaMedicos /></ProtectedRoute>} />
    <Route path="/clinica/aprovacoes" element={<ProtectedRoute><ClinicaAprovacoes /></ProtectedRoute>} />
    <Route path="/odontogram" element={<ProtectedRoute><Odontogram /></ProtectedRoute>} />
    <Route path="/mapa-clinico" element={<ProtectedRoute><ClinicalMapPage /></ProtectedRoute>} />
    <Route path="/ferramentas" element={<ProtectedRoute><ToolsHomeUnified /></ProtectedRoute>} />
    <Route path="/psi/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/estetica/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/medico/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/nutricao/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/fisio/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/podologia/ferramentas" element={<Navigate to="/ferramentas" replace />} />
    <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
    <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
    <Route path="/atendimento/:appointmentId" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
    <Route path="/secretaria-ia" element={<ProtectedRoute><SecretariaIA /></ProtectedRoute>} />
    <Route path="/secretaria-ia/painel" element={<ProtectedRoute><SecretariaIAPainel /></ProtectedRoute>} />
    <Route path="/ia-gestor" element={<ProtectedRoute><IaGestor /></ProtectedRoute>} />
    <Route path="/ia-gestor/:threadId" element={<ProtectedRoute><IaGestor /></ProtectedRoute>} />
    <Route path="/atendimentos-ia" element={<ProtectedRoute><AtendimentosIA /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/assinatura" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
    <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CustomThemeProvider>
              <RecordingProvider>
                <AppRoutes />
                <GlobalRecordingBar />
              </RecordingProvider>
            </CustomThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
