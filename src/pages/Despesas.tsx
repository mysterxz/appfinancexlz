import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, EXPENSE_CATEGORIES } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TrendingDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Expense {
  id: string; titulo: string; valor: number; categoria: string;
  data: string; parcelado: boolean; parcelas: number; parcela_atual: number;
  grupo_parcelamento: string | null;
}

export default function Despesas() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [filterMes, setFilterMes] = useState(String(new Date().getMonth() + 1));
  const [filterAno, setFilterAno] = useState(String(new Date().getFullYear()));

  const [form, setForm] = useState({
    titulo: "", valor: "", categoria: "Alimentação",
    data: new Date().toISOString().split("T")[0],
    parcelado: false, parcelas: "1",
  });

  const meses = [
    "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"
  ];

  useEffect(() => {
    if (user) fetchExpenses();
  }, [user, filterCategoria, filterMes, filterAno]);

  const fetchExpenses = async () => {
    setLoading(true);
    let query = supabase.from("expenses").select("*").eq("user_id", user!.id).order("data", { ascending: false });

    const mes = parseInt(filterMes);
    const ano = parseInt(filterAno);
    query = query
      .gte("data", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("data", mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`);

    if (filterCategoria !== "Todas") query = query.eq("categoria", filterCategoria);

    const { data, error } = await query;
    if (!error) setExpenses((data || []).map(e => ({ ...e, valor: Number(e.valor), parcelas: e.parcelas || 1, parcela_atual: e.parcela_atual || 1 })));
    setLoading(false);
  };

  const resetForm = () => setForm({
    titulo: "", valor: "", categoria: "Alimentação",
    data: new Date().toISOString().split("T")[0], parcelado: false, parcelas: "1"
  });

  const openEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      titulo: expense.titulo, valor: String(expense.valor),
      categoria: expense.categoria, data: expense.data,
      parcelado: expense.parcelado, parcelas: String(expense.parcelas)
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.valor) return;
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }

    if (editingId) {
      const { error } = await supabase.from("expenses").update({
        titulo: form.titulo, valor, categoria: form.categoria, data: form.data,
        parcelado: form.parcelado, parcelas: form.parcelado ? parseInt(form.parcelas) : 1
      }).eq("id", editingId);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Despesa atualizada!" });
    } else {
      const parcelas = form.parcelado ? parseInt(form.parcelas) : 1;
      const grupoId = form.parcelado ? crypto.randomUUID() : null;
      const valorParcela = valor / parcelas;
      const inserts = [];

      for (let i = 0; i < parcelas; i++) {
        const dataObj = new Date(form.data + "T00:00:00");
        dataObj.setMonth(dataObj.getMonth() + i);
        inserts.push({
          user_id: user!.id, titulo: form.parcelado ? `${form.titulo} (${i+1}/${parcelas})` : form.titulo,
          valor: valorParcela, categoria: form.categoria,
          data: dataObj.toISOString().split("T")[0],
          parcelado: form.parcelado, parcelas, parcela_atual: i + 1,
          grupo_parcelamento: grupoId
        });
      }

      const { error } = await supabase.from("expenses").insert(inserts);
      if (error) { toast({ title: "Erro ao criar despesa", variant: "destructive" }); return; }
      toast({ title: form.parcelado ? `${parcelas} parcelas criadas!` : "Despesa criada!" });
    }

    setDialogOpen(false);
    setEditingId(null);
    resetForm();
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    toast({ title: "Despesa excluída" });
    fetchExpenses();
  };

  const total = expenses.reduce((s, e) => s + e.valor, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Despesas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas despesas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { resetForm(); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary border-0 gap-2">
              <Plus className="w-4 h-4" /> Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Ex: Supermercado" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!editingId && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.parcelado} onCheckedChange={v => setForm(f => ({ ...f, parcelado: v }))} />
                    <Label>Parcelado</Label>
                  </div>
                  {form.parcelado && (
                    <div className="space-y-2">
                      <Label>Número de parcelas</Label>
                      <Select value={form.parcelas} onValueChange={v => setForm(f => ({ ...f, parcelas: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[2,3,4,5,6,9,10,12,18,24,36].map(n => <SelectItem key={n} value={String(n)}>{n}x de {formatCurrency(parseFloat(form.valor.replace(",",".") || "0") / n)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 gradient-primary border-0">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card className="shadow-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger className="w-24 sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{meses.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-24 sm:w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas categorias</SelectItem>
                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="shadow-card">
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma despesa encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-smooth group">
                  <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs py-0">{e.categoria}</Badge>
                      {e.parcelado && <Badge variant="outline" className="text-xs py-0">{e.parcela_atual}/{e.parcelas}x</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-destructive mr-1 sm:mr-2 whitespace-nowrap">{formatCurrency(e.valor)}</p>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-smooth">
                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEdit(e)}>
                      <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
