import type { Lead, LeadStatus } from '../../types';
import { SOURCE_LABELS, timeAgo } from '../../utils';

interface Props {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  onDragStart?: (e: React.DragEvent, lead: Lead) => void;
}

const BORDER_COLORS: Record<LeadStatus, string> = {
  new: 'border-l-slate-500',
  in_progress: 'border-l-cyan-500',
  complete: 'border-l-emerald-500',
  review_sent: 'border-l-amber-500',
  cancelled: 'border-l-rose-500',
};

export default function LeadCard({ lead, onOpen, onDragStart }: Props) {
  const initials = `${lead.first_name.charAt(0)}${lead.last_name.charAt(0)}`.toUpperCase();

  return (
    <button
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, lead)}
      onClick={() => onOpen(lead)}
      className={`w-full text-left bg-[#0d1629] border border-[#1a2234] border-l-2 ${BORDER_COLORS[lead.status]} rounded-lg p-3 hover:border-[#2a3449] transition-colors group`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#1a2234] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono font-bold text-cyan-400">{initials||'?'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {lead.first_name} {lead.last_name}
            </p>
            {lead.service && (
              <p className="text-[10px] font-mono text-slate-500 truncate">{lead.service}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#1a2234] text-slate-500">
          {SOURCE_LABELS[lead.source]}
        </span>
      </div>

      <p className="text-[11px] text-slate-500 mt-2.5 truncate">{lead.email}</p>

      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] font-mono text-slate-600">{timeAgo(lead.created_at)}</span>
        <span className="text-[10px] text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
          View Details →
        </span>
      </div>
    </button>
  );
}