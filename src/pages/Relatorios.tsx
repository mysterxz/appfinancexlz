import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, CATEGORY_COLORS } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { BarChart2, Download, TrendingUp, TrendingDown } from "lucide-react";

export default function Relatorios() {
  const { user } = useAuth();
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<Array<{mes:string;receitas:number;despesas:number;saldo:number}>>([]);
  const [catData, setCatData] = useState<Array<{name:string;value:number}>>([]);
  const [totais, setTotais] = useState({ receitas:0, despesas:0, saldo:0 });

  useEffect(() => { if(user) fetchRelatorio(); }, [user, ano]);

  const fetchRelatorio = async () => {
    setLoading(true);
    const y = parseInt(ano);
    const months = [];
    let totalRec = 0, totalDesp = 0;
    const catMap: Record<string,number> = {};

    for(let m=1; m<=12; m++) {
      const start = `${y}-${String(m).padStart(2,"0")}-01`;
      const end = m===12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,"0")}-01`;

      const { data: inc } = await supabase.from("income").select("valor").eq("user_id", user!.id).gte("data",start).lt("data",end);
      const { data: exp } = await supabase.from("expenses").select("valor,categoria").eq("user_id", user!.id).gte("data",start).lt("data",end);

      const rec = (inc||[]).reduce((s,r)=>s+Number(r.valor),0);
      const desp = (exp||[]).reduce((s,e)=>s+Number(e.valor),0);
      totalRec += rec; totalDesp += desp;

      (exp||[]).forEach(e => { catMap[e.categoria] = (catMap[e.categoria]||0) + Number(e.valor); });

      months.push({ mes: new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"short"}), receitas:rec, despesas:desp, saldo:rec-desp });
    }

    setCatData(Object.entries(catMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value));
    setMonthlyData(months);
    setTotais({ receitas:totalRec, despesas:totalDesp, saldo:totalRec-totalDesp });
    setLoading(false);
  };

  const exportCSV = async () => {
    const y = parseInt(ano);
    const { data: inc } = await supabase.from("income").select("*").eq("user_id",user!.id).gte("data",`${y}-01-01`).lt("data",`${y+1}-01-01`);
    const { data: exp } = await supabase.from("expenses").select("*").eq("user_id",user!.id).gte("data",`${y}-01-01`).lt("data",`${y+1}-01-01`);

    const rows = [
      ["Tipo","Titulo","Valor","Categoria","Data"],
      ...(inc||[]).map(r=>["Receita",r.titulo,r.valor,r.categoria,r.data]),
      ...(exp||[]).map(e=>["Despesa",e.titulo,e.valor,e.categoria,e.data]),
    ];
    const csv = rows.map(r=>r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`financas_${ano}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise financeira detalhada</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[2022,2023,2024,2025,2026].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards resumo anual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-success/20 bg-success/5 shadow-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="w-4 h-4 text-success" />Total Receitas {ano}</div>
            <p className="text-2xl font-bold text-success">{formatCurrency(totais.receitas)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 shadow-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingDown className="w-4 h-4 text-destructive" />Total Despesas {ano}</div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totais.despesas)}</p>
          </CardContent>
        </Card>
        <Card className={`shadow-card border-${totais.saldo>=0?"success":"destructive"}/20 bg-${totais.saldo>=0?"success":"destructive"}/5`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><BarChart2 className="w-4 h-4" />Saldo Anual</div>
            <p className={`text-2xl font-bold ${totais.saldo>=0?"text-success":"text-destructive"}`}>{formatCurrency(totais.saldo)}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de barras mensal */}
          <Card className="shadow-card lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Receitas vs Despesas por Mês</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fill:"hsl(var(--muted-foreground))", fontSize:12 }} />
                  <YAxis tick={{ fill:"hsl(var(--muted-foreground))", fontSize:12 }} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:"8px" }}
                    formatter={(val:number)=>formatCurrency(val)}
                  />
                  <Bar dataKey="receitas" fill="hsl(142 71% 45%)" radius={[4,4,0,0]} name="Receitas" />
                  <Bar dataKey="despesas" fill="hsl(0 72% 51%)" radius={[4,4,0,0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pizza por categoria */}
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {catData.length===0 ? (
                <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Sem dados para exibir</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {catData.map((entry,i)=><Cell key={i} fill={CATEGORY_COLORS[entry.name]||"#6B7280"} />)}
                    </Pie>
                    <Tooltip formatter={(val:number)=>formatCurrency(val)} contentStyle={{ background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:"8px" }} />
                    <Legend iconType="circle" iconSize={8} formatter={v=><span style={{color:"hsl(var(--muted-foreground))",fontSize:"12px"}}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabela de categorias */}
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Ranking por Categoria</CardTitle></CardHeader>
            <CardContent>
              {catData.length===0 ? (
                <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Sem dados para exibir</p></div>
              ) : (
                <div className="space-y-3">
                  {catData.slice(0,8).map((cat,i)=>{
                    const pct = (cat.value/totais.despesas)*100;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground font-medium flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:CATEGORY_COLORS[cat.name]||"#6B7280"}} />
                            {cat.name}
                          </span>
                          <span className="text-muted-foreground">{formatCurrency(cat.value)} <span className="text-xs">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{width:`${pct}%`,backgroundColor:CATEGORY_COLORS[cat.name]||"#6B7280"}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
