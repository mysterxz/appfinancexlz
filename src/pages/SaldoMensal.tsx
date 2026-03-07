import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getCurrentMonth } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
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
  Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, Lock
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SaldoMensalRecord {
  id: string;
  user_id: string;
  mes: number;
  ano: number;
  saldo_inicial: number;
  total_receitas: number;
  total_despesas: number;
  saldo_final: number;
  valor: number;
  status: string;
  locked: boolean;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SaldoMensalRecord | null>(null);
  const [valorAcao, setValorAcao] = useState("");
  const [descricaoGasto, setDescricaoGasto] = useState("");
  const [valorError, setValorError] = useState("");

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

  const getSaldoInicialDoMes = async (mes: number, ano: number): Promise<number> => {
    const prevMonth = mes === 1 ? 12 : mes - 1;
    const prevYear = mes === 1 ? ano - 1 : ano;
    const { data } = await supabase
      .from("saldo_mensal")
      .select("saldo_final")
      .eq("user_id", user!.id)
      .eq("mes", prevMonth)
      .eq("ano", prevYear)
      .maybeSingle();
    return data ? Number(data.saldo_final) : 0;
  };

  const gerarSaldoMesAnterior = async () => {
    setGerando(true);
    const { mes: mesAtualRef, ano: anoAtualRef } = getCurrentMonth();
    const mesPrev = mesAtualRef === 1 ? 12 : mesAtualRef - 1;
    const anoPrev = mesAtualRef === 1 ? anoAtualRef - 1 : anoAtualRef;
    const userId = user!.id;

    const { data: existing } = await supabase
      .from("saldo_mensal")
      .select("id, status, locked")
      .eq("user_id", userId)
      .eq("mes", mesPrev)
      .eq("ano", anoPrev)
      .maybeSingle();

    if (existing && existing.locked) {
      toast.info("O saldo desse mês está bloqueado e não pode ser recalculado.");
      setGerando(false);
      return;
    }

    if (existing && (existing.status === "guardado" || existing.status === "gasto")) {
      toast.info("O saldo desse mês já foi fechado e não pode ser recalculado.");
      setGerando(false);
      return;
    }

    const start = `${anoPrev}-${String(mesPrev).padStart(2, "0")}-01`;
    const end = mesPrev === 12 ? `${anoPrev + 1}-01-01` : `${anoPrev}-${String(mesPrev + 1).padStart(2, "0")}-01`;

    const [{ data: incomeData }, { data: expensesData }] = await Promise.all([
      supabase.from("income").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
      supabase.from("expenses").select("valor").eq("user_id", userId).gte("data", start).lt("data", end),
    ]);

    const totalReceitas = (incomeData || []).reduce((s, r) => s + Number(r.valor), 0);
    const totalDespesas = (expensesData || []).reduce((s, e) => s + Number(e.valor), 0);
    const saldoInicial = await getSaldoInicialDoMes(mesPrev, anoPrev);
    const saldoFinal = saldoInicial + totalReceitas - totalDespesas;
    const valor = totalReceitas - totalDespesas;

    if (existing) {
      await supabase
        .from("saldo_mensal")
        .update({ total_receitas: totalReceitas, total_despesas: totalDespesas, valor, saldo_inicial: saldoInicial, saldo_final: saldoFinal })
        .eq("id", existing.id);
      toast.success(`Saldo de ${MONTH_NAMES[mesPrev - 1]}/${anoPrev} atualizado!`);
    } else {
      await supabase
        .from("saldo_mensal")
        .insert({ user_id: userId, mes: mesPrev, ano: anoPrev, total_receitas: totalReceitas, total_despesas: totalDespesas, valor, saldo_inicial: saldoInicial, saldo_final: saldoFinal, status: "pendente", locked: false });
      toast.success(`Saldo de ${MONTH_NAMES[mesPrev - 1]}/${anoPrev} gerado!`);
    }

    fetchRegistros();
    setGerando(false);
  };

  const handleAcao = (record: SaldoMensalRecord) => {
    setSelectedRecord(record);
    setAcao(null);
    setNomeCaixinha("");
    setMetaSelecionada("");
    setValorAcao(record.saldo_final.toFixed(2));
    setDescricaoGasto("");
    setValorError("");
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

      if (metaSelecionada) {
        const { data: goalData } = await supabase
          .from("goals").select("valor_atual").eq("id", metaSelecionada).single();
        if (goalData) {
          await supabase
            .from("goals")
            .update({ valor_atual: Number(goalData.valor_atual) + selectedRecord.saldo_final })
            .eq("id", metaSelecionada);
        }
      }

      await supabase
        .from("saldo_mensal")
        .update({ status: "guardado", locked: true, nome_caixinha: metaSelecionada ? metas.find(m => m.id === metaSelecionada)?.nome : nomeCaixinha })
        .eq("id", selectedRecord.id);
      toast.success("Valor guardado com sucesso!");
    } else {
      await supabase.from("expenses").insert({
        user_id: user!.id,
        titulo: `Saldo ${MONTH_NAMES[selectedRecord.mes - 1]}/${selectedRecord.ano}`,
        valor: selectedRecord.saldo_final,
        categoria: "Outros",
        data: new Date().toISOString().split("T")[0],
      });

      await supabase
        .from("saldo_mensal")
        .update({ status: "gasto", locked: true })
        .eq("id", selectedRecord.id);
      toast.success("Valor registrado como gasto!");
    }

    setDialogOpen(false);
    fetchRegistros();
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    if (recordToDelete.locked) {
      toast.error("Este saldo está bloqueado e não pode ser excluído.");
      setDeleteDialogOpen(false);
      return;
    }
    await supabase.from("saldo_mensal").delete().eq("id", recordToDelete.id);
    toast.success("Saldo excluído com sucesso!");
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
    fetchRegistros();
  };

  const { mes: mesAtual, ano: anoAtual } = getCurrentMonth();

  const getStatusBadge = (record: SaldoMensalRecord) => {
    if (record.locked) {
      return <Badge className="gap-1 bg-muted text-muted-foreground"><Lock className="w-3 h-3" /> Bloqueado</Badge>;
    }
    if (record.saldo_final < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Déficit</Badge>;
    switch (record.status) {
      case "pendente": return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "guardado": return <Badge className="gap-1 bg-success/20 text-success border-success/30"><PiggyBank className="w-3 h-3" /> Guardado</Badge>;
      case "gasto": return <Badge variant="outline" className="gap-1"><ShoppingBag className="w-3 h-3" /> Gasto</Badge>;
      default: return <Badge variant="secondary">{record.status}</Badge>;
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
        <Button onClick={gerarSaldoMesAnterior} disabled={gerando} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", gerando && "animate-spin")} />
          Gerar Saldo do Mês Anterior
        </Button>
      </div>

      {registros.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum saldo registrado</p>
            <p className="text-sm mt-1">Clique em "Gerar Saldo do Mês Anterior" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registros.map((r, idx) => {
            const prevRecord = registros[idx + 1];
            const diff = prevRecord ? r.saldo_final - prevRecord.saldo_final : null;

            return (
              <Card key={r.id} className={cn(
                "shadow-card transition-smooth hover:scale-[1.01]",
                r.saldo_final < 0 && "border-destructive/30"
              )}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                        r.saldo_final >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      )}>
                        {r.saldo_final >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{MONTH_NAMES[r.mes - 1]} {r.ano}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {r.saldo_inicial > 0 && (
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              Inicial: {formatCurrency(r.saldo_inicial)}
                            </span>
                          )}
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

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "text-lg sm:text-xl font-bold",
                          r.saldo_final >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {formatCurrency(r.saldo_final)}
                        </p>
                        {diff !== null && (
                          <p className={cn("text-xs", diff >= 0 ? "text-success" : "text-destructive")}>
                            {diff >= 0 ? "+" : ""}{formatCurrency(diff)} vs anterior
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(r)}
                        <div className="flex items-center gap-1.5">
                          {r.status === "pendente" && !r.locked && r.saldo_final > 0 && (
                            <Button size="sm" variant="outline" onClick={() => handleAcao(r)} className="text-xs">
                              Decidir
                            </Button>
                          )}
                          {r.status === "pendente" && !r.locked && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setRecordToDelete(r); setDeleteDialogOpen(true); }}
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
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
                <p className="text-2xl font-bold text-success">{formatCurrency(selectedRecord.saldo_final)}</p>
                {selectedRecord.saldo_inicial > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Inclui {formatCurrency(selectedRecord.saldo_inicial)} acumulado
                  </p>
                )}
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

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir saldo do mês?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação irá remover o registro de saldo de{" "}
              {recordToDelete ? `${MONTH_NAMES[recordToDelete.mes - 1]}/${recordToDelete.ano}` : ""}. 
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
