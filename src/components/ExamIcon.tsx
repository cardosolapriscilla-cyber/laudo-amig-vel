import { Droplets, ScanLine, FileText } from "lucide-react";
import type { TipoExame } from "@/types/health";

const icons: Record<TipoExame, typeof Droplets> = {
  sangue: Droplets,
  imagem: ScanLine,
  outros: FileText,
};

const labels: Record<TipoExame, string> = {
  sangue: "Sangue",
  imagem: "Imagem",
  outros: "Outros",
};

export function ExamIcon({ tipo, className = "" }: { tipo: TipoExame; className?: string }) {
  const Icon = icons[tipo];
  return <Icon className={`w-5 h-5 ${className}`} />;
}

export function ExamLabel({ tipo }: { tipo: TipoExame }) {
  return <span>{labels[tipo]}</span>;
}
