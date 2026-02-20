import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account { id: string; nome: string; banco: string; saldo_inicial: number; tipo: string; cor: string; }
interface Card_ { id: string; nome: string; bandeira: string; limite: number; dia_fechamento: number; dia_vencimento: number; cor: string; }

const CORES = ["#3B82F6","#8B5CF6","#10B981","#F97316","#EC4899","#F59E0B","#06B6D4","#EF4444"];

export default function Contas() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card_[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountDialog, setAccountDialog] = useState(false);
  const [cardDialog, setCardDialog] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string|null>(null);
  const [editCardId, setEditCardId] = useState<string|null>(null);

  const [accForm, setAccForm] = useState({ nome:"", banco:"", saldo_inicial:"0", tipo:"corrente", cor:"#3B82F6" });
  const [cardForm, setCardForm] = useState({ nome:"", bandeira:"Visa", limite:"", dia_fechamento:"1", dia_vencimento:"10", cor:"#8B5CF6" });

  useEffect(() => { if(user){ fetchAccounts(); fetchCards(); } }, [user]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from("accounts").select("*").eq("user_id", user!.id).order("created_at");
    setAccounts((data||[]).map(a=>({...a, saldo_inicial:Number(a.saldo_inicial)})));
    setLoading(false);
  };
  const fetchCards = async () => {
    const { data } = await supabase.from("cards").select("*").eq("user_id", user!.id).order("created_at");
    setCards((data||[]).map(c=>({...c, limite:Number(c.limite)})));
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const saldo_inicial = parseFloat(accForm.saldo_inicial.replace(",","."));
    const payload = { user_id:user!.id, nome:accForm.nome, banco:accForm.banco, saldo_inicial, tipo:accForm.tipo, cor:accForm.cor };
    if(editAccountId) {
      await supabase.from("accounts").update({nome:accForm.nome,banco:accForm.banco,saldo_inicial,tipo:accForm.tipo,cor:accForm.cor}).eq("id",editAccountId);
      toast({ title:"Conta atualizada!" });
    } else {
      await supabase.from("accounts").insert([payload]);
      toast({ title:"Conta criada!" });
    }
    setAccountDialog(false); setEditAccountId(null);
    setAccForm({ nome:"",banco:"",saldo_inicial:"0",tipo:"corrente",cor:"#3B82F6" }); fetchAccounts();
  };

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const limite = parseFloat(cardForm.limite.replace(",","."));
    const payload = { user_id:user!.id, nome:cardForm.nome, bandeira:cardForm.bandeira, limite, dia_fechamento:parseInt(cardForm.dia_fechamento), dia_vencimento:parseInt(cardForm.dia_vencimento), cor:cardForm.cor };
    if(editCardId) {
      await supabase.from("cards").update({nome:cardForm.nome,bandeira:cardForm.bandeira,limite,dia_fechamento:parseInt(cardForm.dia_fechamento),dia_vencimento:parseInt(cardForm.dia_vencimento),cor:cardForm.cor}).eq("id",editCardId);
      toast({ title:"Cartão atualizado!" });
    } else {
      await supabase.from("cards").insert([payload]);
      toast({ title:"Cartão criado!" });
    }
    setCardDialog(false); setEditCardId(null);
    setCardForm({ nome:"",bandeira:"Visa",limite:"",dia_fechamento:"1",dia_vencimento:"10",cor:"#8B5CF6" }); fetchCards();
  };

  const deleteAccount = async (id: string) => {
    if(!confirm("Excluir esta conta?")) return;
    await supabase.from("accounts").delete().eq("id",id);
    toast({ title:"Conta excluída" }); fetchAccounts();
  };
  const deleteCard = async (id: string) => {
    if(!confirm("Excluir este cartão?")) return;
    await supabase.from("cards").delete().eq("id",id);
    toast({ title:"Cartão excluído" }); fetchCards();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contas & Cartões</h1>
        <p className="text-muted-foreground">Gerencie suas contas e cartões de crédito</p>
      </div>

      <Tabs defaultValue="contas">
        <TabsList className="mb-4">
          <TabsTrigger value="contas" className="gap-2"><Building2 className="w-4 h-4" /> Contas</TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-2"><CreditCard className="w-4 h-4" /> Cartões</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
              <DialogTrigger asChild>
                <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> Nova Conta</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{editAccountId?"Editar Conta":"Nova Conta"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmitAccount} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nome</Label><Input placeholder="Ex: Conta Principal" value={accForm.nome} onChange={e=>setAccForm(f=>({...f,nome:e.target.value}))} required /></div>
                    <div className="space-y-2"><Label>Banco</Label><Input placeholder="Ex: Nubank" value={accForm.banco} onChange={e=>setAccForm(f=>({...f,banco:e.target.value}))} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Saldo inicial</Label><Input placeholder="0,00" value={accForm.saldo_inicial} onChange={e=>setAccForm(f=>({...f,saldo_inicial:e.target.value}))} /></div>
                    <div className="space-y-2"><Label>Tipo</Label>
                      <Select value={accForm.tipo} onValueChange={v=>setAccForm(f=>({...f,tipo:v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem><SelectItem value="investimento">Investimento</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Cor</Label>
                    <div className="flex gap-2 flex-wrap">{CORES.map(c=><button key={c} type="button" onClick={()=>setAccForm(f=>({...f,cor:c}))} className={cn("w-8 h-8 rounded-full border-2 transition-smooth",accForm.cor===c?"border-foreground scale-110":"border-transparent")} style={{backgroundColor:c}}/>)}</div>
                  </div>
                  <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={()=>setAccountDialog(false)}>Cancelar</Button><Button type="submit" className="flex-1 gradient-primary border-0">Salvar</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          : accounts.length === 0 ? (
            <Card className="shadow-card"><CardContent className="text-center py-12 text-muted-foreground"><Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhuma conta cadastrada</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(a=>(
                <Card key={a.id} className="shadow-card overflow-hidden hover:scale-[1.01] transition-smooth" style={{ borderLeft:`3px solid ${a.cor}` }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{backgroundColor:a.cor+"25"}}>
                          <Building2 className="w-5 h-5" style={{color:a.cor}} />
                        </div>
                        <div><p className="font-medium text-foreground">{a.nome}</p><p className="text-xs text-muted-foreground">{a.banco} · {a.tipo}</p></div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>{setEditAccountId(a.id);setAccForm({nome:a.nome,banco:a.banco,saldo_inicial:String(a.saldo_inicial),tipo:a.tipo,cor:a.cor});setAccountDialog(true);}}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={()=>deleteAccount(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(a.saldo_inicial)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Saldo registrado</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cartoes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={cardDialog} onOpenChange={setCardDialog}>
              <DialogTrigger asChild>
                <Button className="gradient-primary border-0 gap-2"><Plus className="w-4 h-4" /> Novo Cartão</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{editCardId?"Editar Cartão":"Novo Cartão"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmitCard} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nome</Label><Input placeholder="Ex: Nubank Roxinho" value={cardForm.nome} onChange={e=>setCardForm(f=>({...f,nome:e.target.value}))} required /></div>
                    <div className="space-y-2"><Label>Bandeira</Label>
                      <Select value={cardForm.bandeira} onValueChange={v=>setCardForm(f=>({...f,bandeira:v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Visa">Visa</SelectItem><SelectItem value="Mastercard">Mastercard</SelectItem><SelectItem value="Elo">Elo</SelectItem><SelectItem value="Amex">Amex</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Limite (R$)</Label><Input placeholder="0,00" value={cardForm.limite} onChange={e=>setCardForm(f=>({...f,limite:e.target.value}))} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Dia fechamento</Label><Input type="number" min="1" max="31" value={cardForm.dia_fechamento} onChange={e=>setCardForm(f=>({...f,dia_fechamento:e.target.value}))} /></div>
                    <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" min="1" max="31" value={cardForm.dia_vencimento} onChange={e=>setCardForm(f=>({...f,dia_vencimento:e.target.value}))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Cor</Label>
                    <div className="flex gap-2 flex-wrap">{CORES.map(c=><button key={c} type="button" onClick={()=>setCardForm(f=>({...f,cor:c}))} className={cn("w-8 h-8 rounded-full border-2 transition-smooth",cardForm.cor===c?"border-foreground scale-110":"border-transparent")} style={{backgroundColor:c}}/>)}</div>
                  </div>
                  <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={()=>setCardDialog(false)}>Cancelar</Button><Button type="submit" className="flex-1 gradient-primary border-0">Salvar</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cards.length === 0 ? (
            <Card className="shadow-card"><CardContent className="text-center py-12 text-muted-foreground"><CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhum cartão cadastrado</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map(c=>(
                <Card key={c.id} className="shadow-card overflow-hidden">
                  <div className="h-36 relative p-5 flex flex-col justify-between" style={{background:`linear-gradient(135deg, ${c.cor} 0%, ${c.cor}90 100%)`}}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-primary-foreground/80 text-xs">Cartão de crédito</p>
                        <p className="text-primary-foreground font-bold text-lg">{c.nome}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20" onClick={()=>{setEditCardId(c.id);setCardForm({nome:c.nome,bandeira:c.bandeira,limite:String(c.limite),dia_fechamento:String(c.dia_fechamento),dia_vencimento:String(c.dia_vencimento),cor:c.cor});setCardDialog(true);}}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20" onClick={()=>deleteCard(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-primary-foreground/70 text-xs">Limite</p>
                        <p className="text-primary-foreground font-bold">{formatCurrency(c.limite)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-primary-foreground/70 text-xs">{c.bandeira}</p>
                        <p className="text-primary-foreground/70 text-xs">Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
