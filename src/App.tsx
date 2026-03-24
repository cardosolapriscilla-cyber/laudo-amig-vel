import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";
import EvolutionPage from "./pages/EvolutionPage";
import ProfilePage from "./pages/ProfilePage";
import ScorePage from "./pages/ScorePage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/resultado/:id" element={<ResultPage />} />
            <Route path="/evolucao/:id" element={<EvolutionPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/score" element={<ScorePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
