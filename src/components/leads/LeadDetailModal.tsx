import { useState } from 'react';
import { X, Star, CheckCircle2, Trash2, Mail, Phone, MessageSquare } from 'lucide-react';
import type { Lead, LeadStatus } from '../../types';
import { STATUS_LABELS, formatLocal, SOURCE_LABELS } from '../../utils';

interface Props {
  lead: Lead;
  onClose: () => void;
  onChangeStatus: (leadId: string, status: LeadStatus) => Promise<void> | void;
  onSendReview: (leadId: string) => Promise<void> | void;
  onDelete: (leadId: string) => Promise<void> | void;
  canSendReview: boolean;
}

const STATUS_ORDER: LeadStatus[] = ['new', 'in_progress', 'complete', 'review_sent', 'cancelled'];

export default function LeadDetailModal({
  lead,
  onClose,
  onChangeStatus,
  onSendReview,
  onDelete,
  canSendReview,
}: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sending, setSending] = useState(false);

  const handleStatusChange = async (next: LeadStatus) => {
    setStatus(next);
    await onChangeStatus(lead.id, next);
  };

  const handleSendReview = async () => {
    setSending(true);
    try {
      await onSendReview(lead.id);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(lead.id);
    onClose();
  };

  const timeline: { label: string; time?: string }[] = [
    { label: 'Lead created', time: formatLocal(lead.created_at) },
    ...(lead.status === 'in_progress' || lead.status === 'complete' || lead.status === 'review_sent'
      ? [{ label: 'Marked in progress' }]
      : []),
    ...(lead.status === 'complete' || lead.status === 'review_sent'
      ? [{ label: 'Job completed', time: lead.completed_at ? formatLocal(lead.completed_at) : undefined }]
      : []),
    ...(lead.status === 'review_sent'
      ? [{ label: 'Review request sent' }]
      : []),
  ];

  const showSend = lead.status === 'complete' || lead.status === 'review_sent' || canSendReview;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[#0d1629] border-l border-[#1a2234] shadow-2xl overflow-y-auto animate-[slideInLeft_.25s_ease-out]">
        <style>{`@keyframes slideInLeft { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {/* Header */}
        <div className="sticky top-0 bg-[#0d1629]/95 backdrop-blur border-b border-[#1a2234] px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-lg font-display font-bold text-white">
              {lead.first_name} {lead.last_name}
            </p>
            <p className="text-xs font-mono text-slate-500">
              {lead.email} · {SOURCE_LABELS[lead.source]}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Contact details */}
          <div className="space-y-2">
            {lead.phone && (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Phone className="w-3.5 h-3.5 text-slate-600" /> {lead.phone}
              </p>
            )}
            {lead.service && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#1a2234] text-cyan-400">
                  {lead.service}
                </span>
              </p>
            )}
            <p className="text-xs font-mono text-slate-600">
              Enquired {formatLocal(lead.created_at)}
            </p>
            {lead.completed_at && (
              <p className="text-xs font-mono text-emerald-500/80">
                Completed {formatLocal(lead.completed_at)}
              </p>
            )}
            {lead.review_send_after && (
              <p className="text-xs font-mono text-amber-500/80">
                Review scheduled for {formatLocal(lead.review_send_after)}
              </p>
            )}
          </div>

          {/* Message */}
          {lead.message && (
            <div className="bg-[#070b14] border border-[#1a2234] rounded-lg p-4">
              <p className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <MessageSquare className="w-3.5 h-3.5" /> MESSAGE
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{lead.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1.5">PIPELINE STATUS</label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-600"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {showSend && (
              <button
                onClick={handleSendReview}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-[#0b0f19] font-semibold rounded-lg py-2.5 transition-colors"
              >
                <Star className="w-4 h-4" />
                {sending ? 'Sending…' : lead.status === 'review_sent' ? 'Send Review Request Again' : 'Send Review Request Now'}
              </button>
            )}

            {lead.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('complete')}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-400 font-medium rounded-lg py-2.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Complete
              </button>
            )}

            <button
              onClick={handleDelete}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition-colors ${
                confirmDelete
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20 text-rose-400'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Confirm Delete?' : 'Delete Lead'}
            </button>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-mono text-slate-500 mb-3">TIMELINE</p>
            <ol className="relative border-l border-[#1a2234] ml-2 space-y-4">
              {timeline.map((step, i) => (
                <li key={step.label} className="ml-4">
                  <span
                    className={`absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full border-2 border-[#0d1629] ${
                      i === timeline.length - 1 ? 'bg-cyan-500' : 'bg-slate-600'
                    }`}
                  />
                  <p className="text-sm text-slate-300">{step.label}</p>
                  {step.time && (
                    <p className="text-[11px] font-mono text-slate-600">{step.time}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}