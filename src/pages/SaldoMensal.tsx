import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getCurrentMonth } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Wallet, PiggyBank, ShoppingBag, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";

interface SaldoMensalRecord {
  id: string;
  user_id: string;
  mes: number;
  ano: number;
  total_receitas: number;
  total_despesas: number;
  valor: number;
  status: string;
  nome_caixinha: string | null;
  created_at: string;
  updated_at: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function SaldoMensal() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<SaldoMensalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SaldoMensalRecord | null>(null);
  const [acao, setAcao] = useState<"guardar" | "gastar" | null>(null);
  const [nomeCaixinha, setNomeCaixinha] = useState("");
  const [metas, setMetas] = useState<Array<{ id: string; nome: string }>>([]);
  const [metaSelecionada, setMetaSelecionada] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchRegistros();
      fetchMetas();
    }
  }, [user]);

  const fetchRegistros = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("saldo_mensal")
      .select("*")
      .eq("user_id", user!.id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    setRegistros((data as SaldoMensalRecord[]) || []);
    setLoading(false);
  };

  const fetchMetas = async () => {
    const { data } = await supabase
      .from("goals")
      .select("id, nome")
      .eq("user_id", user!.id);
    setMetas(data || []);
  };

  const gerarSaldoMes = async () => {
    setGerando(true);
    const { mes, ano } = getCurrentMonth();
    const userId = user!.id;

    // Check if already exists
    const { data: existing } = await supabase
      .from("saldo_mensal")
      .select("id")
      .eq("user_id", userId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    // Calculate totals
    const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const end = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

    const { data: incomeData } = await supabase
      .from("income").select("valor").eq("user_id", userId)
      .gte("data", start).lt("data", end);

    const { data: expensesData } = await supabase
      .from("expenses").select("valor").eq("user_id", userId)
      .gte("data", start).lt("data", end);

    const totalReceitas = (incomeData || []).reduce((s, r) => s + Number(r.valor), 0);
    const totalDespesas = (expensesData || []).reduce((s, e) => s + Number(e.valor), 0);
    const valor = totalReceitas - totalDespesas;

    if (existing) {
      await supabase
        .from("saldo_mensal")
        .update({ total_receitas: totalReceitas, total_despesas: totalDespesas, valor, status: "pendente" })
        .eq("id", existing.id);
      toast.success("Saldo do mês atualizado!");
    } else {
      await supabase
        .from("saldo_mensal")
        .insert({ user_id: userId, mes, ano, total_receitas: totalReceitas, total_despesas: totalDespesas, valor, status: "pendente" });
      toast.success("Saldo do mês gerado!");
    }

    fetchRegistros();
    setGerando(false);
  };

  const handleAcao = (record: SaldoMensalRecord) => {
    setSelectedRecord(record);
    setAcao(null);
    setNomeCaixinha("");
    setMetaSelecionada("");
    setDialogOpen(true);
  };

  const confirmarAcao = async () => {
    if (!selectedRecord || !acao) return;

    if (acao === "guardar") {
      const caixinha = metaSelecionada || nomeCaixinha;
      if (!caixinha) {
        toast.error("Informe o nome da caixinha ou selecione uma meta");
        return;
      }

      // If a goal was selected, update its valor_atual
      if (metaSelecionada) {
        const meta = metas.find(m => m.id === metaSelecionada);
        if (meta) {
          const { data: goalData } = await supabase
            .from("goals").select("valor_atual").eq("id", metaSelecionada).single();
          if (goalData) {
            await supabase
              .from("goals")
              .update({ valor_atual: Number(goalData.valor_atual) + selectedRecord.valor })
              .eq("id", metaSelecionada);
          }
        }
      }

      await supabase
        .from("saldo_mensal")
        .update({ status: "guardado", nome_caixinha: metaSelecionada ? metas.find(m => m.id === metaSelecionada)?.nome : nomeCaixinha })
        .eq("id", selectedRecord.id);
      toast.success("Valor guardado com sucesso!");
    } else {
      // Gastar - register as expense
      await supabase.from("expenses").insert({
        user_id: user!.id,
        titulo: `Saldo ${MONTH_NAMES[selectedRecord.mes - 1]}/${selectedRecord.ano}`,
        valor: selectedRecord.valor,
        categoria: "Outros",
        data: new Date().toISOString().split("T")[0],
      });

      await supabase
        .from("saldo_mensal")
        .update({ status: "gasto" })
        .eq("id", selectedRecord.id);
      toast.success("Valor registrado como gasto!");
    }

    setDialogOpen(false);
    fetchRegistros();
  };

  const getStatusBadge = (status: string, valor: number) => {
    if (valor < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Déficit</Badge>;
    switch (status) {
      case "pendente": return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "guardado": return <Badge className="gap-1 bg-success/20 text-success border-success/30"><PiggyBank className="w-3 h-3" /> Guardado</Badge>;
      case "gasto": return <Badge variant="outline" className="gap-1"><ShoppingBag className="w-3 h-3" /> Gasto</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Saldo Mensal</h1>
          <p className="text-muted-foreground text-sm">Controle o destino do saldo de cada mês</p>
        </div>
        <Button onClick={gerarSaldoMes} disabled={gerando} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", gerando && "animate-spin")} />
          Gerar Saldo do Mês Atual
        </Button>
      </div>

      {registros.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum saldo registrado</p>
            <p className="text-sm mt-1">Clique em "Gerar Saldo do Mês Atual" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registros.map((r, idx) => {
            const prevRecord = registros[idx + 1];
            const diff = prevRecord ? r.valor - prevRecord.valor : null;

            return (
              <Card key={r.id} className={cn(
                "shadow-card transition-smooth hover:scale-[1.01]",
                r.valor < 0 && "border-destructive/30"
              )}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Month info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                        r.valor >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      )}>
                        {r.valor >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{MONTH_NAMES[r.mes - 1]} {r.ano}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-success" />
                            {formatCurrency(r.total_receitas)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowDownRight className="w-3 h-3 text-destructive" />
                            {formatCurrency(r.total_despesas)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Value + status */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "text-lg sm:text-xl font-bold",
                          r.valor >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {formatCurrency(r.valor)}
                        </p>
                        {diff !== null && (
                          <p className={cn("text-xs", diff >= 0 ? "text-success" : "text-destructive")}>
                            {diff >= 0 ? "+" : ""}{formatCurrency(diff)} vs anterior
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(r.status, r.valor)}
                        {r.status === "pendente" && r.valor > 0 && (
                          <Button size="sm" variant="outline" onClick={() => handleAcao(r)} className="text-xs">
                            Decidir
                          </Button>
                        )}
                        {r.nome_caixinha && (
                          <span className="text-xs text-muted-foreground">🏦 {r.nome_caixinha}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de ação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que deseja fazer com o saldo?</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  {MONTH_NAMES[selectedRecord.mes - 1]} {selectedRecord.ano}
                </p>
                <p className="text-2xl font-bold text-success">{formatCurrency(selectedRecord.valor)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={acao === "guardar" ? "default" : "outline"}
                  onClick={() => setAcao("guardar")}
                  className="flex flex-col gap-1 h-auto py-4"
                >
                  <PiggyBank className="w-6 h-6" />
                  <span>Guardar</span>
                </Button>
                <Button
                  variant={acao === "gastar" ? "default" : "outline"}
                  onClick={() => setAcao("gastar")}
                  className="flex flex-col gap-1 h-auto py-4"
                >
                  <ShoppingBag className="w-6 h-6" />
                  <span>Gastar</span>
                </Button>
              </div>

              {acao === "guardar" && (
                <div className="space-y-3">
                  {metas.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Escolher meta existente</Label>
                      <Select value={metaSelecionada} onValueChange={(v) => { setMetaSelecionada(v); setNomeCaixinha(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma meta" /></SelectTrigger>
                        <SelectContent>
                          {metas.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!metaSelecionada && (
                    <div className="space-y-1.5">
                      <Label>Ou criar nova caixinha</Label>
                      <Input
                        value={nomeCaixinha}
                        onChange={e => setNomeCaixinha(e.target.value)}
                        placeholder="Nome da caixinha"
                      />
                    </div>
                  )}
                </div>
              )}

              {acao === "gastar" && (
                <p className="text-sm text-muted-foreground text-center">
                  O valor será registrado como despesa na categoria "Outros".
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarAcao} disabled={!acao}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
