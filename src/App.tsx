import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Agenda from "./pages/Agenda";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Odontogram from "./pages/Odontogram";
import Financial from "./pages/Financial";
import SettingsPage from "./pages/SettingsPage";
import Budgets from "./pages/Budgets";
import Attendance from "./pages/Attendance";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import WaitingClinic from "./pages/WaitingClinic";
import Profile from "./pages/Profile";
import Marketplace from "./pages/Marketplace";
import MarketplaceBooking from "./pages/MarketplaceBooking";
import SecretariaIA from "./pages/SecretariaIA";
import SecretariaIAPainel from "./pages/SecretariaIAPainel";
import Availability from "./pages/Availability";
import ClinicaHome from "./pages/clinica/ClinicaHome";
import ClinicaMedicos from "./pages/clinica/ClinicaMedicos";
import ClinicaAprovacoes from "./pages/clinica/ClinicaAprovacoes";
import { PatientLayout } from "./components/PatientLayout";
import PatientHome from "./pages/patient/PatientHome";
import PatientPlan from "./pages/patient/PatientPlan";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientBooking from "./pages/patient/PatientBooking";
import PatientHistory from "./pages/patient/PatientHistory";
import PatientExams from "./pages/patient/PatientExams";
import PatientSettings from "./pages/patient/PatientSettings";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, currentClinicId, isPatient, roles, simulatedRole } = useAuth();
  const { canAccess } = useRoleAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Dev simulation: simulating patient → send to patient area
  if (simulatedRole === 'patient') return <Navigate to="/paciente" replace />;
  // Patient users go to their own area
  if (isPatient) return <Navigate to="/paciente" replace />;
  // No clinic linked: admins go to onboarding (can create one), others (dentists) wait for code
  if (!currentClinicId) {
    const isAdmin = roles.includes('admin');
    return <Navigate to={isAdmin ? '/onboarding' : '/aguardando-clinica'} replace />;
  }
  if (!canAccess(location.pathname)) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
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
  const { user, loading, currentClinicId, isPatient } = useAuth();

  if (loading) {
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

function WaitingClinicRoute() {
  const { user, loading, currentClinicId, isPatient } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isPatient) return <Navigate to="/paciente" replace />;
  if (currentClinicId) return <Navigate to="/" replace />;

  return <WaitingClinic />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/onboarding" element={<OnboardingRoute />} />
    <Route path="/aguardando-clinica" element={<WaitingClinicRoute />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/marketplace/agendar" element={<MarketplaceBooking />} />
    <Route path="/paciente" element={<PatientProtectedRoute><PatientLayout /></PatientProtectedRoute>}>
      <Route index element={<PatientHome />} />
      <Route path="plano" element={<PatientPlan />} />
      <Route path="agendas" element={<PatientAppointments />} />
      <Route path="agendar" element={<PatientBooking />} />
      <Route path="historico" element={<PatientHistory />} />
      <Route path="exames" element={<PatientExams />} />
      <Route path="configuracoes" element={<PatientSettings />} />
    </Route>
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
    <Route path="/disponibilidade" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
    <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
    <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
    <Route path="/clinica" element={<ProtectedRoute><ClinicaHome /></ProtectedRoute>} />
    <Route path="/clinica/medicos" element={<ProtectedRoute><ClinicaMedicos /></ProtectedRoute>} />
    <Route path="/clinica/aprovacoes" element={<ProtectedRoute><ClinicaAprovacoes /></ProtectedRoute>} />
    <Route path="/odontogram" element={<ProtectedRoute><Odontogram /></ProtectedRoute>} />
    <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
    <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
    <Route path="/atendimento/:appointmentId" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
    <Route path="/secretaria-ia" element={<ProtectedRoute><SecretariaIA /></ProtectedRoute>} />
    <Route path="/secretaria-ia/painel" element={<ProtectedRoute><SecretariaIAPainel /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
