import { Users, Briefcase, Star, Clock, ChevronRight } from 'lucide-react';
import type { Lead, ReviewRequest } from '../../types';
import { STATUS_LABELS, timeAgo } from '../../utils';

interface Props {
  leads: Lead[];
  reviewRequests: ReviewRequest[];
  onOpenLead: (lead: Lead) => void;
}

const STAT_CARDS = [
  { key: 'total', label: 'Total Leads', icon: Users, color: 'text-slate-400' },
  { key: 'active', label: 'Active Jobs', icon: Briefcase, color: 'text-cyan-400' },
  { key: 'sent', label: 'Reviews Sent', icon: Star, color: 'text-amber-400' },
  { key: 'awaiting', label: 'Awaiting Review', icon: Clock, color: 'text-emerald-400' },
] as const;

export default function DashboardStats({ leads, reviewRequests, onOpenLead }: Props) {
  const values = {
    total: leads.length,
    active: leads.filter((l) => l.status === 'in_progress').length,
    sent: reviewRequests.length,
    awaiting: leads.filter((l) => l.status === 'complete').length,
  };

  const recent = [...leads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="bg-[#0d1629] border border-[#1a2234] rounded-xl p-4 md:p-5 hover:border-[#2a3449] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-2xl md:text-3xl font-display font-bold text-white mt-2">{values[card.key]}</p>
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="bg-[#0d1629] border border-[#1a2234] rounded-xl">
        <div className="px-4 md:px-5 py-4 border-b border-[#1a2234]">
          <h2 className="text-sm font-display font-bold text-white">Recent Leads</h2>
          <p className="text-xs text-slate-500 mt-0.5">Latest 5 enquiries across your pipeline</p>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No leads yet. Your pipeline will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1a2234]">
            {recent.map((lead) => (
              <li key={lead.id}>
                <button
                  onClick={() => onOpenLead(lead)}
                  className="w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-[#0d1629]/70 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">
                      {lead.first_name} {lead.last_name}
                      {lead.service && <span className="text-slate-500 font-normal"> · {lead.service}</span>}
                    </p>
                    <p className="text-xs text-slate-500">{timeAgo(lead.created_at)}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      lead.status === 'new'
                        ? 'text-slate-400 border-slate-600/40'
                        : lead.status === 'in_progress'
                          ? 'text-cyan-400 border-cyan-500/40'
                          : lead.status === 'complete'
                            ? 'text-emerald-400 border-emerald-500/40'
                            : lead.status === 'review_sent'
                              ? 'text-amber-400 border-amber-500/40'
                              : 'text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {STATUS_LABELS[lead.status]}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}