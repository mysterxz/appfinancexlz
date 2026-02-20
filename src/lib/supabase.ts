import { supabase } from "@/integrations/supabase/client";
export { supabase };

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatDate = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("pt-BR");

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Lazer",
  "Saúde",
  "Educação",
  "Roupas",
  "Outros",
];

export const INCOME_CATEGORIES = [
  "Salário",
  "Freelance",
  "Investimentos",
  "Bônus",
  "Aluguel",
  "Outros",
];

export const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#F97316",
  Transporte: "#3B82F6",
  Moradia: "#8B5CF6",
  Lazer: "#EC4899",
  Saúde: "#10B981",
  Educação: "#06B6D4",
  Roupas: "#F59E0B",
  Outros: "#6B7280",
  Salário: "#10B981",
  Freelance: "#3B82F6",
  Investimentos: "#8B5CF6",
  Bônus: "#F59E0B",
  Aluguel: "#EC4899",
};

export const getCurrentMonth = () => {
  const now = new Date();
  return { mes: now.getMonth() + 1, ano: now.getFullYear() };
};
