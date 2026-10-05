import { useMemo, useState } from 'react';
import { Search, Star, RotateCcw, Mail } from 'lucide-react';
import type { Lead, ReviewRequest } from '../../types';
import { formatLocal } from '../../utils';

interface Props {
  reviewRequests: ReviewRequest[];
  leads: Lead[];
  onResend: (leadId: string) => void;
  sending?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Sent', cls: 'text-cyan-400 border-cyan-500/40' },
  delivered: { label: 'Delivered', cls: 'text-emerald-400 border-emerald-500/40' },
  bounced: { label: 'Bounced', cls: 'text-rose-400 border-rose-500/40' },
  failed: { label: 'Failed', cls: 'text-rose-400 border-rose-500/40' },
};

export default function ReviewHistoryTable({ reviewRequests, leads, onResend, sending }: Props) {
  const [search, setSearch] = useState('');

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...reviewRequests].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter((r) => {
      const lead = leadById.get(r.lead_id);
      const name = `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.toLowerCase();
      const service = (lead?.service ?? '').toLowerCase();
      return (
        r.recipient_email.toLowerCase().includes(q) ||
        name.includes(q) ||
        service.includes(q) ||
        r.email_subject?.toLowerCase().includes(q)
      );
    });
  }, [reviewRequests, search, leadById]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search review requests…"
          className="w-full bg-[#0d1629] border border-[#1a2234] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
        />
      </div>

      <div className="bg-[#0d1629] border border-[#1a2234] rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <Star className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No review requests sent yet</p>
            <p className="text-xs text-slate-600 mt-1">
              {search ? 'Try a different search term.' : 'Review emails will appear here once sent.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2234] text-left">
                  <th className="px-4 py-3 text-[10px] font-mono font-semibold text-slate-500 uppercase">Recipient</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-semibold text-slate-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-semibold text-slate-500 uppercase">Sent</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-semibold text-slate-500 uppercase">Triggered</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((r) => {
                  const lead = leadById.get(r.lead_id);
                  const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'text-slate-400 border-slate-600/40' };
                  const canResend = r.status === 'bounced' || r.status === 'failed';
                  return (
                    <tr key={r.id} className="hover:bg-[#0d1629]/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">
                          {r.recipient_name || <span className="text-slate-500">Unknown</span>}
                        </p>
                        <p className="text-xs font-mono text-slate-500">{r.recipient_email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">
                        {lead?.service || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{formatLocal(r.sent_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            r.triggered_by === 'auto'
                              ? 'text-cyan-400 border-cyan-500/40'
                              : 'text-slate-400 border-slate-600/40'
                          }`}
                        >
                          {r.triggered_by === 'auto' ? 'Auto' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canResend ? (
                          <button
                            onClick={() => lead && onResend(lead.id)}
                            disabled={sending || !lead}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resend
                          </button>
                        ) : (
                          <span className="text-slate-700">
                            <Mail className="w-4 h-4 inline" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-[11px] font-mono text-slate-600">
          Showing {rows.length} review request{rows.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}