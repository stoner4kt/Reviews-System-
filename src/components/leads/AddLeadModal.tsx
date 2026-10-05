import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const initial = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  service: '',
  message: '',
};

export default function AddLeadModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      setError('Email is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('leads').insert({
        ...form,
        email: form.email.toLowerCase().trim(),
        source: 'manual',
        status: 'new',
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0d1629] border border-[#1a2234] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2234]">
          <h2 className="text-sm font-display font-bold text-white">Add Lead</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1.5">FIRST NAME</label>
              <input value={form.first_name} onChange={update('first_name')} placeholder="Jane"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600" />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1.5">LAST NAME</label>
              <input value={form.last_name} onChange={update('last_name')} placeholder="Smith"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">EMAIL *</label>
            <input type="email" required value={form.email} onChange={update('email')} placeholder="jane@example.com"
              className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1.5">PHONE</label>
              <input value={form.phone} onChange={update('phone')} placeholder="0821234567"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600" />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1.5">SERVICE</label>
              <input value={form.service} onChange={update('service')} placeholder="Plumbing repair"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">NOTES / MESSAGE</label>
            <textarea rows={3} value={form.message} onChange={update('message')} placeholder="Optional notes from the enquiry"
              className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 resize-none" />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-[#1a2234] rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}