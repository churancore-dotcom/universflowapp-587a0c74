import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Copy, Check, Gift, Users, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const PromoCodes = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('1');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();

    // Realtime for promo codes
    const channel = supabase
      .channel('admin-promo-codes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, fetchCodes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'code_redemptions' }, fetchCodes)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCodes(data);
    }
    setLoading(false);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PREMIUM-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(code);
  };

  const createCode = async () => {
    if (!newCode.trim()) {
      toast({ title: 'Error', description: 'Please enter a code', variant: 'destructive' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('promo_codes').insert({
      code: newCode.toUpperCase().trim(),
      description: newDescription.trim() || null,
      max_uses: parseInt(newMaxUses) || 1,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Promo code created!' });
      setNewCode('');
      setNewDescription('');
      setNewMaxUses('1');
      fetchCodes();
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !currentState })
      .eq('id', id);

    if (!error) {
      setCodes(codes.map(c => c.id === id ? { ...c, is_active: !currentState } : c));
      toast({ title: 'Updated', description: `Code ${!currentState ? 'activated' : 'deactivated'}` });
    }
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      setCodes(codes.filter(c => c.id !== id));
      toast({ title: 'Deleted', description: 'Promo code removed' });
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promo Codes</h1>
        <p className="text-muted-foreground">Create and manage premium access codes</p>
      </div>

      {/* Create New Code */}
      <motion.div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-400" />
          Create New Code
        </h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter code (e.g., PREMIUM-ABC123)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              className="flex-1 bg-black/30 border-white/10"
            />
            <Button variant="outline" onClick={generateRandomCode} className="shrink-0">
              Generate
            </Button>
          </div>
          <Input
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="bg-black/30 border-white/10"
          />
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Max Uses</label>
              <Input
                type="number"
                min="1"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="bg-black/30 border-white/10"
              />
            </div>
            <Button onClick={createCode} className="mt-5 bg-amber-500 hover:bg-amber-600 text-black">
              <Plus className="w-4 h-4 mr-2" /> Create Code
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Existing Codes */}
      <div className="space-y-3">
        <h2 className="font-semibold">Active Codes ({codes.filter(c => c.is_active).length})</h2>
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No promo codes yet</div>
        ) : (
          codes.map((code, index) => (
            <motion.div
              key={code.id}
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ 
                background: code.is_active 
                  ? 'rgba(251, 191, 36, 0.1)' 
                  : 'rgba(28, 28, 30, 0.6)',
                border: code.is_active 
                  ? '1px solid rgba(251, 191, 36, 0.2)' 
                  : '1px solid rgba(255, 255, 255, 0.06)',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-lg font-mono font-bold text-amber-400">{code.code}</code>
                  <button onClick={() => copyCode(code.code, code.id)} className="p-1 hover:bg-white/10 rounded">
                    {copiedId === code.id ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {code.description && (
                  <p className="text-sm text-muted-foreground truncate">{code.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {code.current_uses}/{code.max_uses} uses
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(code.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(code.id, code.is_active)}
                  className={`p-2 rounded-lg ${code.is_active ? 'text-green-400' : 'text-muted-foreground'}`}
                >
                  {code.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button
                  onClick={() => deleteCode(code.id)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromoCodes;
