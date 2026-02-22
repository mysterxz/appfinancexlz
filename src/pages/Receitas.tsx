import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, INCOME_CATEGORIES } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TrendingUp, Filter } from "lucide-react";

interface Income {
  id: string; titulo: string; valor: number; categoria: string; data: string;
}

export default function Receitas() {
  const { user } = useAuth();
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMes, setFilterMes] = useState(String(new Date().getMonth() + 1));
  const [filterAno, setFilterAno] = useState(String(new Date().getFullYear()));

  const [form, setForm] = useState({
    titulo: "", valor: "", categoria: "Salário",
    data: new Date().toISOString().split("T")[0],
  });

  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  useEffect(() => { if (user) fetchIncome(); }, [user, filterMes, filterAno]);

  const fetchIncome = async () => {
    setLoading(true);
    const mes = parseInt(filterMes);
    const ano = parseInt(filterAno);
    const { data, error } = await supabase.from("income").select("*")
      .eq("user_id", user!.id)
      .gte("data", `${ano}-${String(mes).padStart(2,"0")}-01`)
      .lt("data", mes===12 ? `${ano+1}-01-01` : `${ano}-${String(mes+1).padStart(2,"0")}-01`)
      .order("data", { ascending: false });
    if (!error) setIncome((data||[]).map(r => ({...r, valor: Number(r.valor)})));
    setLoading(false);
  };

  const resetForm = () => setForm({ titulo:"", valor:"", categoria:"Salário", data: new Date().toISOString().split("T")[0] });

  const openEdit = (item: Income) => {
    setEditingId(item.id);
    setForm({ titulo: item.titulo, valor: String(item.valor), categoria: item.categoria, data: item.data });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(form.valor.replace(",","."));
    if (isNaN(valor)||valor<=0) { toast({ title:"Valor inválido", variant:"destructive" }); return; }

    const payload = { user_id: user!.id, titulo: form.titulo, valor, categoria: form.categoria, data: form.data };

    if (editingId) {
      const { error } = await supabase.from("income").update({ titulo:form.titulo, valor, categoria:form.categoria, data:form.data }).eq("id", editingId);
      if (error) { toast({ title:"Erro ao atualizar", variant:"destructive" }); return; }
      toast({ title:"Receita atualizada!" });
    } else {
      const { error } = await supabase.from("income").insert([payload]);
      if (error) { toast({ title:"Erro ao criar", variant:"destructive" }); return; }
      toast({ title:"Receita criada!" });
    }
    setDialogOpen(false); setEditingId(null); resetForm(); fetchIncome();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    await supabase.from("income").delete().eq("id", id);
    toast({ title:"Receita excluída" }); fetchIncome();
  };

  const total = income.reduce((s,r) => s+r.valor, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Receitas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas receitas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open){resetForm();setEditingId(null);} }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> Nova Receita</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId?"Editar Receita":"Nova Receita"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Ex: Salário" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input placeholder="0,00" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v=>setForm(f=>({...f,categoria:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOME_CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={()=>setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 gradient-primary border-0">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger className="w-24 sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{meses.map((m,i)=><SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-24 sm:w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{[2023,2024,2025,2026].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : income.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma receita encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {income.map(r=>(
                <div key={r.id} className="flex items-start sm:items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-smooth group">
                  <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                    <TrendingUp className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <p className="text-sm font-bold text-success whitespace-nowrap">+{formatCurrency(r.valor)}</p>
                        <div className="hidden sm:flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-smooth">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={()=>handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs py-0">{r.categoria}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(r.data+"T00:00:00").toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex sm:hidden gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>openEdit(r)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={()=>handleDelete(r.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
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
