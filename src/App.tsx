import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/providers/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useDataSync } from "@/hooks/useDataSync";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";
import EvolutionPage from "./pages/EvolutionPage";
import ProfilePage from "./pages/ProfilePage";
import ScorePage from "./pages/ScorePage";
import OnboardingPage from "./pages/OnboardingPage";
import AuthPage from "./pages/AuthPage";
import BriefingPage from "./pages/BriefingPage";
import MapaSaudePage from "./pages/MapaSaudePage";
import RecomendacoesPage from "./pages/RecomendacoesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  useDataSync();
  return (
    <AppShell>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/briefing/:token" element={<BriefingPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/resultado/:id" element={<ResultPage />} />
        <Route path="/evolucao/:id" element={<EvolutionPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/score" element={<ScorePage />} />
        <Route path="/mapa" element={<MapaSaudePage />} />
        <Route path="/prevencao" element={<RecomendacoesPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <AppContent />
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
