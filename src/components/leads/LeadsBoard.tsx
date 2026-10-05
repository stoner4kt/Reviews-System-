import { useMemo, useState } from 'react';
import { Plus, Send, Search } from 'lucide-react';
import type { Lead, LeadStatus, Settings } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, formatDelay } from '../../utils';
import LeadCard from './LeadCard';
import AddLeadModal from './AddLeadModal';

interface Props {
  leads: Lead[];
  settings: Settings | null;
  onOpenLead: (lead: Lead) => void;
  onAddLead: (lead: Lead) => void;
  onMoveLead: (leadId: string, status: LeadStatus) => void;
  onSendAllPending: () => void;
  onSendToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const COLUMNS: LeadStatus[] = ['new', 'in_progress', 'complete', 'review_sent', 'cancelled'];

const COLUMN_THEME: Record<LeadStatus, { header: string; bar: string }> = {
  new: { header: 'text-slate-400', bar: 'bg-slate-500' },
  in_progress: { header: 'text-cyan-400', bar: 'bg-cyan-500' },
  complete: { header: 'text-emerald-400', bar: 'bg-emerald-500' },
  review_sent: { header: 'text-amber-400', bar: 'bg-amber-500' },
  cancelled: { header: 'text-rose-400', bar: 'bg-rose-500' },
};

export default function LeadsBoard({ leads, settings, onOpenLead, onAddLead, onMoveLead, onSendAllPending, onSendToast }: Props) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.service || '').toLowerCase().includes(q),
    );
  }, [leads, search]);

  const groups = useMemo(
    () =>
      Object.fromEntries(COLUMNS.map((s) => [s, filtered.filter((l) => l.status === s)])) as Record<LeadStatus, Lead[]>,
    [filtered],
  );

  const hasPending = leads.some(
    (l) => l.status === 'complete' && l.review_send_after && l.review_send_after <= new Date().toISOString(),
  );

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOver(null);
    const leadId = e.dataTransfer.getData('text/lead-id');
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;

    onMoveLead(leadId, status);

    if (status === 'complete' && settings?.auto_send_enabled) {
      const delay = settings.auto_send_delay_hours ?? 1;
      onSendToast(
        `Review request will send automatically in ${formatDelay(delay)}. Send now?`,
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or service…"
            className="w-full bg-[#0d1629] border border-[#1a2234] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2.5">
          {hasPending && (
            <button
              onClick={onSendAllPending}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0b0f19] text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Send All Pending Reviews
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Board — vertical list of columns on mobile, kanban at lg+ */}
      <div className="flex flex-col gap-3 lg:flex-row">
        {COLUMNS.map((status) => {
          const items = groups[status];
          const theme = COLUMN_THEME[status];
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((d) => (d === status ? null : d))}
              onDrop={(e) => handleDrop(e, status)}
              className={`flex flex-col rounded-xl border bg-[#0d1629]/50 transition-colors ${
                dragOver === status ? 'border-cyan-500/60' : 'border-[#1a2234]'
              } lg:w-1/5 lg:min-w-0`}
            >
              <div className="px-3.5 py-3 flex items-center gap-2 border-b border-[#1a2234]">
                <span className={`w-2 h-2 rounded-full ${theme.bar}`} />
                <h3 className={`text-xs font-mono font-bold uppercase tracking-wide ${theme.header}`}>
                  {STATUS_LABELS[status]}
                </h3>
                <span className="ml-auto text-[10px] font-mono text-slate-600">{items.length}</span>
              </div>

              <div className="flex-1 p-2.5 space-y-2 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-600 text-center py-8 font-mono">
                    {search ? 'No matches' : `No ${STATUS_LABELS[status].toLowerCase()} leads`}
                  </p>
                ) : (
                  items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onOpen={onOpenLead}
                      onDragStart={(e, l) => {
                        e.dataTransfer.setData('text/lead-id', l.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="lg:hidden text-center text-[11px] font-mono text-slate-600">
        Pipeline stages appear as a vertical list on mobile — drag &amp; drop is available on desktop.
      </p>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}