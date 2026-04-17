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
import Marketplace from "./pages/Marketplace";
import MarketplaceBooking from "./pages/MarketplaceBooking";
import PatientDashboard from "./pages/PatientDashboard";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, currentClinicId, isPatient } = useAuth();
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
  // Patient users go to their own area
  if (isPatient) return <Navigate to="/paciente" replace />;
  // Redirect to onboarding if user has no clinic
  if (!currentClinicId) return <Navigate to="/onboarding" replace />;
  if (!canAccess(location.pathname)) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function PatientProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPatient } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isPatient) return <Navigate to="/" replace />;

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

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/onboarding" element={<OnboardingRoute />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/marketplace/agendar" element={<MarketplaceBooking />} />
    <Route path="/paciente" element={<PatientProtectedRoute><PatientDashboard /></PatientProtectedRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
    <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
    <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
    <Route path="/odontogram" element={<ProtectedRoute><Odontogram /></ProtectedRoute>} />
    <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
    <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
    <Route path="/atendimento/:appointmentId" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
