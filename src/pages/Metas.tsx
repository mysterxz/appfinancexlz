import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Target, Calendar, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Goal {
  id: string; nome: string; valor_meta: number; valor_atual: number;
  prazo: string; cor: string;
}

const CORES = ["#8B5CF6","#3B82F6","#10B981","#F97316","#EC4899","#F59E0B","#06B6D4","#EF4444"];

export default function Metas() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aportarId, setAportarId] = useState<string|null>(null);
  const [aporte, setAporte] = useState("");
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState({ nome:"", valor_meta:"", prazo:"", cor:"#8B5CF6" });

  useEffect(() => { if(user) fetchGoals(); }, [user]);

  const fetchGoals = async () => {
    setLoading(true);
    const { data } = await supabase.from("goals").select("*").eq("user_id", user!.id).order("prazo");
    setGoals((data||[]).map(g=>({...g, valor_meta:Number(g.valor_meta), valor_atual:Number(g.valor_atual)})));
    setLoading(false);
  };

  const resetForm = () => setForm({ nome:"", valor_meta:"", prazo:"", cor:"#8B5CF6" });

  const openEdit = (g: Goal) => {
    setEditingId(g.id);
    setForm({ nome:g.nome, valor_meta:String(g.valor_meta), prazo:g.prazo, cor:g.cor });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor_meta = parseFloat(form.valor_meta.replace(",","."));
    if(isNaN(valor_meta)||valor_meta<=0) { toast({ title:"Valor inválido", variant:"destructive" }); return; }

    if(editingId) {
      await supabase.from("goals").update({ nome:form.nome, valor_meta, prazo:form.prazo, cor:form.cor }).eq("id",editingId);
      toast({ title:"Meta atualizada!" });
    } else {
      await supabase.from("goals").insert([{ user_id:user!.id, nome:form.nome, valor_meta, prazo:form.prazo, cor:form.cor }]);
      toast({ title:"Meta criada!" });
    }
    setDialogOpen(false); setEditingId(null); resetForm(); fetchGoals();
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Excluir esta meta?")) return;
    await supabase.from("goals").delete().eq("id",id);
    toast({ title:"Meta excluída" }); fetchGoals();
  };

  const handleAporte = async (id: string) => {
    const valor = parseFloat(aporte.replace(",","."));
    if(isNaN(valor)||valor<=0) { toast({ title:"Valor inválido", variant:"destructive" }); return; }
    const goal = goals.find(g=>g.id===id);
    if(!goal) return;
    const novoValor = Math.min(goal.valor_atual + valor, goal.valor_meta);
    await supabase.from("goals").update({ valor_atual: novoValor }).eq("id",id);
    toast({ title:"Aporte registrado!" }); setAportarId(null); setAporte(""); fetchGoals();
  };

  const hoje = new Date();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas Financeiras</h1>
          <p className="text-muted-foreground">Acompanhe seus objetivos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open)=>{ setDialogOpen(open); if(!open){resetForm();setEditingId(null);} }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> Nova Meta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId?"Editar Meta":"Nova Meta"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome da meta</Label>
                <Input placeholder="Ex: Viagem para Europa" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor alvo (R$)</Label>
                  <Input placeholder="0,00" value={form.valor_meta} onChange={e=>setForm(f=>({...f,valor_meta:e.target.value}))} required />
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input type="date" value={form.prazo} onChange={e=>setForm(f=>({...f,prazo:e.target.value}))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {CORES.map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,cor:c}))}
                      className={cn("w-8 h-8 rounded-full border-2 transition-smooth", form.cor===c?"border-foreground scale-110":"border-transparent")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={()=>setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 gradient-primary border-0">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : goals.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="text-center py-16 text-muted-foreground">
            <Target className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">Nenhuma meta criada</p>
            <p className="text-sm">Crie sua primeira meta financeira!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g=>{
            const pct = Math.min(100, (g.valor_atual/g.valor_meta)*100);
            const prazoDate = new Date(g.prazo+"T00:00:00");
            const diasRestantes = Math.ceil((prazoDate.getTime()-hoje.getTime())/(1000*60*60*24));
            const concluida = g.valor_atual >= g.valor_meta;
            return (
              <Card key={g.id} className="shadow-card overflow-hidden transition-smooth hover:scale-[1.01]" style={{ borderTop: `3px solid ${g.cor}` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: g.cor+"30" }}>
                        <Target className="w-4 h-4" style={{ color: g.cor }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{g.nome}</CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(g.prazo)}
                          {!concluida && <span className={cn("ml-1", diasRestantes<0?"text-destructive":diasRestantes<30?"text-warning":"")}>
                            {diasRestantes<0?"Vencida":diasRestantes===0?"Hoje":` · ${diasRestantes} dias`}
                          </span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={()=>handleDelete(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium" style={{ color: g.cor }}>{pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={pct} className="h-2" style={{ "--progress-color": g.cor } as React.CSSProperties} />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Acumulado: <strong className="text-foreground">{formatCurrency(g.valor_atual)}</strong></span>
                    <span className="text-muted-foreground">Meta: <strong className="text-foreground">{formatCurrency(g.valor_meta)}</strong></span>
                  </div>
                  {!concluida && (
                    aportarId===g.id ? (
                      <div className="flex gap-2">
                        <Input placeholder="Valor do aporte" value={aporte} onChange={e=>setAporte(e.target.value)} className="h-8 text-sm" autoFocus />
                        <Button size="sm" className="gradient-primary border-0" onClick={()=>handleAporte(g.id)}>OK</Button>
                        <Button size="sm" variant="outline" onClick={()=>setAportarId(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={()=>setAportarId(g.id)} style={{ borderColor: g.cor+"50", color: g.cor }}>
                        <PlusCircle className="w-3.5 h-3.5" /> Adicionar aporte
                      </Button>
                    )
                  )}
                  {concluida && (
                    <div className="text-center text-success text-sm font-medium py-1">🎉 Meta concluída!</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
