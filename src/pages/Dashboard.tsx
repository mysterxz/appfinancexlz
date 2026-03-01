import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getCurrentMonth } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ArrowUpRight, ArrowDownRight, CheckCircle2, PiggyBank, ShoppingBag, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/supabase";

interface SaldoMensalInfo {
  status: string;
  valor: number;
  saldo_final: number;
  nome_caixinha: string | null;
}

interface DashboardStats {
  saldoDisponivel: number;
  resultadoMes: number;
  totalReceitas: number;
  totalDespesas: number;
  saldoInicial: number;
  ultimasTransacoes: Array<{
    id: string; titulo: string; valor: number; tipo: "receita" | "despesa";
    categoria: string; data: string;
  }>;
  receitasPorMes: Array<{ mes: string; receitas: number; despesas: number }>;
  despesasPorCategoria: Array<{ name: string; value: number }>;
  saldoMesAnterior: number | null;
  saldoMensalInfo: SaldoMensalInfo | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    saldoDisponivel: 0, resultadoMes: 0, totalReceitas: 0, totalDespesas: 0, saldoInicial: 0,
    ultimasTransacoes: [], receitasPorMes: [], despesasPorCategoria: [],
    saldoMesAnterior: null, saldoMensalInfo: null
  });
  const [loading, setLoading] = useState(true);
  const { mes, ano } = getCurrentMonth();

  useEffect(() => {
    if (user) {
      autoGeneratePreviousMonthSaldo().then(() => fetchDashboard());
    }
  }, [user]);

  const getSaldoInicialDoMes = async (userId: string, mes: number, ano: number): Promise<number> => {
    // Get previous month's saldo_final
    const prevMonth = mes === 1 ? 12 : mes - 1;
    const prevYear = mes === 1 ? ano - 1 : ano;
    const { data } = await supabase
      .from("saldo_mensal")
      .select("saldo_final")
      .eq("user_id", userId)
      .eq("mes", prevMonth)
      .eq("ano", prevYear)
      .maybeSingle();
    return data ? Number(data.saldo_final) : 0;
  };

  const fetchDashboard = async () => {
    setLoading(true);
    const userId = user!.id;
    const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const endDate = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

    // Receitas e despesas do mês
    const [{ data: incomeData }, { data: expensesData }] = await Promise.all([
      supabase.from("income").select("*").eq("user_id", userId).gte("data", startDate).lt("data", endDate),
      supabase.from("expenses").select("*").eq("user_id", userId).gte("data", startDate).lt("data", endDate),
    ]);

    const totalReceitas = (incomeData || []).reduce((sum, r) => sum + Number(r.valor), 0);
    const totalDespesas = (expensesData || []).reduce((sum, e) => sum + Number(e.valor), 0);
    const resultadoMes = totalReceitas - totalDespesas;

    // Saldo inicial (herdado do mês anterior)
    const saldoInicial = await getSaldoInicialDoMes(userId, mes, ano);
    const saldoDisponivel = saldoInicial + totalReceitas - totalDespesas;

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

    // Saldo mensal info do mês atual
    const { data: saldoData } = await supabase
      .from("saldo_mensal")
      .select("status, valor, saldo_final, nome_caixinha")
      .eq("user_id", userId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    // Saldo mês anterior para comparação
    const prevMonth = mes === 1 ? 12 : mes - 1;
    const prevYear = mes === 1 ? ano - 1 : ano;
    const { data: prevData } = await supabase
      .from("saldo_mensal")
      .select("saldo_final")
      .eq("user_id", userId)
      .eq("mes", prevMonth)
      .eq("ano", prevYear)
      .maybeSingle();

    setStats({
      saldoDisponivel, resultadoMes, totalReceitas, totalDespesas, saldoInicial,
      ultimasTransacoes, receitasPorMes, despesasPorCategoria,
      saldoMensalInfo: saldoData as SaldoMensalInfo | null,
      saldoMesAnterior: prevData ? Number(prevData.saldo_final) : null,
    });
    setLoading(false);
  };

  const autoGeneratePreviousMonthSaldo = async () => {
    const userId = user!.id;
    const prevMonth = mes === 1 ? 12 : mes - 1;
    const prevYear = mes === 1 ? ano - 1 : ano;

    const { data: existing } = await supabase
      .from("saldo_mensal")
      .select("id, locked")
      .eq("user_id", userId)
      .eq("mes", prevMonth)
      .eq("ano", prevYear)
      .maybeSingle();

    if (existing) return;

    const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const end = prevMonth === 12 ? `${prevYear + 1}-01-01` : `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;

    const [{ data: incomeData }, { data: expensesData }] = await Promise.all([
      supabase.from("income").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
      supabase.from("expenses").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
    ]);

    const totalReceitas = (incomeData || []).reduce((s, r) => s + Number(r.valor), 0);
    const totalDespesas = (expensesData || []).reduce((s, e) => s + Number(e.valor), 0);

    if (totalReceitas === 0 && totalDespesas === 0) return;

    // Get saldo_inicial for the previous month (from the month before it)
    const saldoInicial = await getSaldoInicialDoMes(userId, prevMonth, prevYear);
    const saldoFinal = saldoInicial + totalReceitas - totalDespesas;

    await supabase.from("saldo_mensal").insert({
      user_id: userId, mes: prevMonth, ano: prevYear,
      total_receitas: totalReceitas, total_despesas: totalDespesas,
      valor: totalReceitas - totalDespesas,
      saldo_inicial: saldoInicial, saldo_final: saldoFinal,
      status: "pendente", locked: false
    });
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

      const [{ data: inc }, { data: exp }] = await Promise.all([
        supabase.from("income").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
        supabase.from("expenses").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
      ]);

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

  const saldoPositivo = stats.saldoDisponivel >= 0;
  const resultadoPositivo = stats.resultadoMes >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumo financeiro de {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* 4 Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Disponível */}
        <Card className={cn(
          "border-2 shadow-card transition-smooth hover:scale-[1.02]",
          saldoPositivo ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo Disponível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl sm:text-3xl font-bold", saldoPositivo ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.saldoDisponivel)}
            </p>
            {stats.saldoInicial > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-success" />
                {formatCurrency(stats.saldoInicial)} acumulado
              </p>
            )}
            {stats.saldoInicial === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Valor real disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Resultado do Mês */}
        <Card className={cn(
          "border-2 shadow-card transition-smooth hover:scale-[1.02]",
          resultadoPositivo ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Resultado do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl sm:text-3xl font-bold", resultadoPositivo ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.resultadoMes)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {resultadoPositivo ? "Receitas > Despesas" : "Despesas > Receitas"}
            </p>
          </CardContent>
        </Card>

        {/* Receitas */}
        <Card className="border-success/20 bg-success/5 shadow-card transition-smooth hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Receitas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-success">{formatCurrency(stats.totalReceitas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total do mês</p>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="border-destructive/20 bg-destructive/5 shadow-card transition-smooth hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              Despesas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-destructive">{formatCurrency(stats.totalDespesas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total do mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Indicador de mês encerrado */}
      {stats.saldoMensalInfo && (
        <Card className={cn(
          "shadow-card border-2",
          stats.saldoMensalInfo.status === "guardado" ? "border-success/30 bg-success/5" :
          stats.saldoMensalInfo.status === "gasto" ? "border-muted-foreground/20" :
          "border-primary/30 bg-primary/5"
        )}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                {stats.saldoMensalInfo.status !== "pendente" ? (
                  <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-primary flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-foreground">
                    {stats.saldoMensalInfo.status !== "pendente" ? "✅ Mês encerrado" : "Saldo pendente de decisão"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {stats.saldoMensalInfo.status === "guardado" && (
                      <Badge className="gap-1 bg-success/20 text-success border-success/30">
                        <PiggyBank className="w-3 h-3" /> Guardado{stats.saldoMensalInfo.nome_caixinha ? ` em ${stats.saldoMensalInfo.nome_caixinha}` : ""}
                      </Badge>
                    )}
                    {stats.saldoMensalInfo.status === "gasto" && (
                      <Badge variant="outline" className="gap-1"><ShoppingBag className="w-3 h-3" /> Gasto</Badge>
                    )}
                    {stats.saldoMesAnterior !== null && (
                      <span className={cn("text-xs", stats.saldoDisponivel >= stats.saldoMesAnterior ? "text-success" : "text-destructive")}>
                        {stats.saldoDisponivel >= stats.saldoMesAnterior ? "↑" : "↓"} {formatCurrency(Math.abs(stats.saldoDisponivel - stats.saldoMesAnterior))} vs mês anterior
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Link to="/saldo-mensal">
                <Badge variant="secondary" className="cursor-pointer hover:bg-accent">Ver histórico →</Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts section - keep existing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
