import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Upload, Activity, CalendarDays, User } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/upload", icon: Upload, label: "Enviar" },
  { path: "/score", icon: Activity, label: "Saúde" },
  { path: "/consultas", icon: CalendarDays, label: "Consultas" },
  { path: "/perfil", icon: User, label: "Perfil" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background">
      <main className="flex-1 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t z-50">
        <div className="max-w-md mx-auto flex justify-around py-2 px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors duration-150 active:scale-95
                  ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
