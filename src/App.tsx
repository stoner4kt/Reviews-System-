import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabaseClient';
import type { Lead, LeadStatus, ReviewRequest, Settings, Section, Toast } from './types';
import { callEdgeFunction, formatDelay } from './utils';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import ToastContainer from './components/ToastContainer';
import DashboardStats from './components/dashboard/DashboardStats';
import LeadsBoard from './components/leads/LeadsBoard';
import LeadDetailModal from './components/leads/LeadDetailModal';
import ReviewHistoryTable from './components/reviews/ReviewHistoryTable';
import EmailBuilder from './components/email/EmailBuilder';
import SettingsPage from './components/settings/SettingsPage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [section, setSection] = useState<Section>('dashboard');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sendingReviewId, setSendingReviewId] = useState<string | null>(null);

  const toastId = useRef(0);
  const pendingSendToast = useRef(false);

  const pushToast = useCallback(
  (message: string, type: Toast['type'] = 'info', action?: Toast['action']) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, action }]);
  },
  [],
);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadData = useCallback(async () => {
    if (!isConfigured || !supabase) return;
    setLoading(true);
    try {
      const [settingsRes, leadsRes, reviewsRes] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('review_requests').select('*').order('sent_at', { ascending: false }),
      ]);
      if (!settingsRes.error && settingsRes.data) setSettings(settingsRes.data as Settings);
      if (!leadsRes.error && leadsRes.data) setLeads(leadsRes.data as Lead[]);
      if (!reviewsRes.error && reviewsRes.data) setReviewRequests(reviewsRes.data as ReviewRequest[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth session
  useEffect(() => {
    if (!isConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initial data load when authenticated
  useEffect(() => {
    if (session) {
      void loadData();
    }
  }, [session, loadData]);

  // Realtime subscription to the leads table — board updates live when the widget submits
  useEffect(() => {
    if (!isConfigured || !supabase || !session) return;
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          const record = payload.new as Lead | undefined;
          const oldRecord = payload.old as Lead | undefined;
          if (payload.eventType === 'INSERT' && record) {
            setLeads((prev) => [record, ...prev]);
          } else if (payload.eventType === 'UPDATE' && record) {
            setLeads((prev) => prev.map((l) => (l.id === record.id ? { ...l, ...record } : l)));
            if (oldRecord && oldRecord.status === 'complete' && record.status === 'review_sent') {
              void loadData(); // pull fresh review_requests
            }
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            setLeads((prev) => prev.filter((l) => l.id !== oldRecord.id));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_requests' },
        (payload) => {
          const record = payload.new as ReviewRequest | undefined;
          if (record) setReviewRequests((prev) => [record, ...prev]);
        },
      )
      .subscribe();

    const client = supabase;
    return () => {
      void client.removeChannel(channel);
    };
  }, [session, loadData]);

  // -------
  // Actions
  // -------

  const triggerReviewEmail = useCallback(
    async (leadId: string, triggeredBy: 'auto' | 'manual') => {
      if (!supabase || !isConfigured) {
        pushToast('Supabase is not configured.', 'error');
        return;
      }
      setSendingReviewId(leadId);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        await callEdgeFunction<{ success: boolean }>(
          'send-review-email',
          'POST',
          { lead_id: leadId },
          triggeredBy === 'manual' ? token : undefined,
        );
        pushToast(
          triggeredBy === 'manual'
            ? 'Review request sent.'
            : 'Review request sent automatically.',
          'success',
        );
        await loadData();
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Failed to send review request.', 'error');
      } finally {
        setSendingReviewId(null);
      }
    },
    [pushToast, loadData],
  );

  const changeLeadStatus = useCallback(
    async (leadId: string, status: LeadStatus) => {
      if (!isConfigured || !supabase) return;
      const lead = leads.find((l) => l.id === leadId);
      const patch: Partial<Lead> = { status, updated_at: new Date().toISOString() };

      if (status === 'complete' && settings) {
        patch.completed_at = new Date().toISOString();
        const delayHours = settings.auto_send_delay_hours || 1;
        patch.review_send_after = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

        // Toast with "Send Now" once per drag — not on every row re-render.
        if (settings.auto_send_enabled && !pendingSendToast.current && lead?.status !== 'complete') {
          pendingSendToast.current = true;
          const msg = `Review request will send automatically in ${formatDelay(delayHours)}. Send now?`;
          // A user clicking "Send Now" is treated as a manual trigger.
          const sendNow = () => {
            void triggerReviewEmail(leadId, 'manual');
          };
          setTimeout(() => {
            pendingSendToast.current = false;
            pushToast(msg, 'info', { label: 'Send Now', onClick: sendNow });
          }, 50);
        }
      }

      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', leadId)
        .select('*')
        .single();
      if (error) {
        pushToast(error.message, 'error');
        return;
      }
      if (data) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? (data as Lead) : l)));
        setSelectedLead((sel) => (sel?.id === leadId ? (data as Lead) : sel));
        if (status === 'complete') {
          // Auto-send after delay: fire-and-forget so it also works when the
          // user navigates away. The full schedule lives in the polling loop.
          const delay = settings?.auto_send_delay_hours ?? 1;
          setTimeout(() => {
            void triggerReviewEmail(leadId, 'auto');
          }, delay * 60 * 60 * 1000);
        }
        pushToast('Lead updated.', 'success');
      }
    },
    [leads, settings, pushToast, triggerReviewEmail],
  );

  const deleteLead = useCallback(
    async (leadId: string) => {
      if (!isConfigured || !supabase) return;
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) {
        pushToast(error.message, 'error');
        return;
      }
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelectedLead(null);
      pushToast('Lead deleted.', 'success');
    },
    [pushToast],
  );

  const sendAllPending = useCallback(async () => {
    const now = new Date().toISOString();
    const pending = leads.filter(
      (l) => l.status === 'complete' && l.review_send_after && l.review_send_after <= now,
    );
    if (pending.length === 0) {
      pushToast('No pending reviews due yet.', 'info');
      return;
    }
    for (const lead of pending) {
      await triggerReviewEmail(lead.id, 'auto');
    }
    pushToast(`Sent ${pending.length} review request${pending.length === 1 ? '' : 's'}.`, 'success');
  }, [leads, pushToast, triggerReviewEmail]);

  // -------
  // Auto-send scheduler (frontend polling)
  // -------
  //
  // NOTE: Supabase's free tier has no native cron for Edge Functions, so
  // auto-send is implemented as a polling loop in the frontend while the
  // dashboard is open. For production reliability, replace this with a
  // Supabase pg_cron job (available on Pro plan) or a Cloudflare Worker
  // cron trigger plus a cron secret.
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const now = new Date().toISOString();
      const pending = leads.filter(
        (l) =>
          l.status === 'complete' &&
          l.review_send_after &&
          l.review_send_after <= now,
      );
      if (pending.length === 0) return;
      for (const lead of pending) {
        void triggerReviewEmail(lead.id, 'auto');
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session, leads, triggerReviewEmail]);

  // Loading gate: auth still resolving or no creds configured
  if (authLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#070b14]">
        <p className="text-sm font-mono text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!isConfigured || !supabase) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#070b14] p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-display font-bold text-white mb-3">Configuration Required</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Copy <code className="font-mono text-cyan-400">.env.example</code> to{' '}
            <code className="font-mono text-cyan-400">.env</code> and set your{' '}
            <code className="font-mono text-cyan-400">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-cyan-400">VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <LoginPage />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const showSendReview =
    selectedLead !== null &&
    (selectedLead.status === 'complete' || selectedLead.status === 'review_sent');

  const client = supabase;

  return (
    <>
      <Layout
        section={section}
        onNavigate={setSection}
        newLeadsCount={leads.filter((l) => l.status === 'new').length}
        onSignOut={async () => {
          await client.auth.signOut();
          setSession(null);
        }}
      >
        {loading && settings === null ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-[#1a2234] rounded-xl animate-pulse h-24" />
              ))}
            </div>
            <div className="bg-[#1a2234] rounded-xl animate-pulse h-64" />
          </div>
        ) : (
          <>
            {section === 'dashboard' && (
              <DashboardStats
                leads={leads}
                reviewRequests={reviewRequests}
                onOpenLead={setSelectedLead}
              />
            )}

            {section === 'leads' && settings && (
              <LeadsBoard
                leads={leads}
                settings={settings}
                onOpenLead={setSelectedLead}
                onAddLead={() => pushToast('Lead saved.', 'success')}
                onMoveLead={(leadId, status) => void changeLeadStatus(leadId, status)}
                onSendAllPending={() => void sendAllPending()}
                onSendToast={pushToast}
              />
            )}

            {section === 'reviews' && (
              <ReviewHistoryTable
                reviewRequests={reviewRequests}
                leads={leads}
                sending={sendingReviewId !== null}
                onResend={(leadId) => void triggerReviewEmail(leadId, 'manual')}
              />
            )}

            {section === 'email' && settings && (
              <EmailBuilder settings={settings} onSettingsUpdated={setSettings} />
            )}

            {section === 'settings' && settings && (
              <SettingsPage
                settings={settings}
                onSettingsUpdated={setSettings}
                onToast={pushToast}
              />
            )}
          </>
        )}
      </Layout>

      {selectedLead && settings && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onChangeStatus={(leadId, status) => changeLeadStatus(leadId, status)}
          onSendReview={(leadId) => triggerReviewEmail(leadId, 'manual')}
          onDelete={(leadId) => deleteLead(leadId)}
          canSendReview={showSendReview}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}