import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AGENCY_NAME, BRAND_NAME, POWERED_BY } from '../utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!supabase) {
        setError('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-[#070b14] p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#0d1629] border border-[#1a2234] rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center mb-4">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-display font-bold text-white">{BRAND_NAME}</h1>
            <p className="text-xs font-mono text-slate-500 mt-1">Client Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1.5">EMAIL</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.co.za"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1.5">PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-[10px] text-slate-600 text-center mt-6">
            Accounts are provisioned by the {AGENCY_NAME} team.
          </p>
        </div>
        <p className="text-center text-[10px] font-mono text-slate-600 mt-4">{POWERED_BY}</p>
      </div>
    </div>
  );
}