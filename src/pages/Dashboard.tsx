import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getCurrentMonth } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/supabase";

interface DashboardStats {
  saldo: number;
  totalReceitas: number;
  totalDespesas: number;
  ultimasTransacoes: Array<{
    id: string; titulo: string; valor: number; tipo: "receita" | "despesa";
    categoria: string; data: string;
  }>;
  receitasPorMes: Array<{ mes: string; receitas: number; despesas: number }>;
  despesasPorCategoria: Array<{ name: string; value: number }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    saldo: 0, totalReceitas: 0, totalDespesas: 0,
    ultimasTransacoes: [], receitasPorMes: [], despesasPorCategoria: []
  });
  const [loading, setLoading] = useState(true);
  const { mes, ano } = getCurrentMonth();

  useEffect(() => {
    if (user) fetchDashboard();
  }, [user]);

  const fetchDashboard = async () => {
    setLoading(true);
    const userId = user!.id;

    // Receitas do mês
    const { data: incomeData } = await supabase
      .from("income")
      .select("*")
      .eq("user_id", userId)
      .gte("data", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("data", mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`);

    // Despesas do mês
    const { data: expensesData } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("data", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("data", mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`);

    const totalReceitas = (incomeData || []).reduce((sum, r) => sum + Number(r.valor), 0);
    const totalDespesas = (expensesData || []).reduce((sum, e) => sum + Number(e.valor), 0);
    const saldo = totalReceitas - totalDespesas;

    // Últimas transações
    const transacoesReceitas = (incomeData || []).map(r => ({
      id: r.id, titulo: r.titulo, valor: Number(r.valor),
      tipo: "receita" as const, categoria: r.categoria, data: r.data
    }));
    const transacoesDespesas = (expensesData || []).map(e => ({
      id: e.id, titulo: e.titulo, valor: Number(e.valor),
      tipo: "despesa" as const, categoria: e.categoria, data: e.data
    }));
    const ultimasTransacoes = [...transacoesReceitas, ...transacoesDespesas]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 6);

    // Despesas por categoria
    const catMap: Record<string, number> = {};
    (expensesData || []).forEach(e => {
      catMap[e.categoria] = (catMap[e.categoria] || 0) + Number(e.valor);
    });
    const despesasPorCategoria = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    // Gráfico últimos 6 meses
    const receitasPorMes = await getMonthlyData(userId);

    setStats({ saldo, totalReceitas, totalDespesas, ultimasTransacoes, receitasPorMes, despesasPorCategoria });
    setLoading(false);
  };

  const getMonthlyData = async (userId: string) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

      const { data: inc } = await supabase.from("income").select("valor").eq("user_id", userId).gte("data", start).lt("data", end);
      const { data: exp } = await supabase.from("expenses").select("valor").eq("user_id", userId).gte("data", start).lt("data", end);

      months.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        receitas: (inc || []).reduce((s, r) => s + Number(r.valor), 0),
        despesas: (exp || []).reduce((s, e) => s + Number(e.valor), 0),
      });
    }
    return months;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const saldoPositivo = stats.saldo >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumo financeiro de {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={cn(
          "border-2 shadow-card transition-smooth hover:scale-[1.02]",
          saldoPositivo ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl sm:text-3xl font-bold", saldoPositivo ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.saldo)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {saldoPositivo ? <ArrowUpRight className="w-3 h-3 text-success" /> : <AlertCircle className="w-3 h-3 text-destructive" />}
              {saldoPositivo ? "Saldo positivo" : "Saldo negativo"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5 shadow-card transition-smooth hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-success">{formatCurrency(stats.totalReceitas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total do mês</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5 shadow-card transition-smooth hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-destructive">{formatCurrency(stats.totalDespesas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total do mês</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de área */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Evolução dos Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.receitasPorMes}>
                <defs>
                  <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Area type="monotone" dataKey="receitas" stroke="hsl(142 71% 45%)" fill="url(#colorReceitas)" strokeWidth={2} name="Receitas" />
                <Area type="monotone" dataKey="despesas" stroke="hsl(0 72% 51%)" fill="url(#colorDespesas)" strokeWidth={2} name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico pizza */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.despesasPorCategoria.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <TrendingDown className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma despesa registrada</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.despesasPorCategoria} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {stats.despesasPorCategoria.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.name] || "#6B7280"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas transações */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.ultimasTransacoes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma transação registrada neste mês</p>
          ) : (
            <div className="space-y-3">
              {stats.ultimasTransacoes.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-smooth">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    t.tipo === "receita" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                  )}>
                    {t.tipo === "receita" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">{t.categoria} · {new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p className={cn("text-sm font-bold", t.tipo === "receita" ? "text-success" : "text-destructive")}>
                    {t.tipo === "receita" ? "+" : "-"}{formatCurrency(t.valor)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
