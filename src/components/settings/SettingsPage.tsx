import { useState } from 'react';
import {
  ChevronDown, Building2, Mail, Zap, Code2, Copy, Check,
  RefreshCcw, ExternalLink, Globe2,
} from 'lucide-react';
import type { Settings } from '../../types';
import { supabase } from '../../supabaseClient';
import { formatDelay } from '../../utils';

interface Props {
  settings: Settings;
  onSettingsUpdated: (settings: Settings) => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type Tab = 'script' | 'capture' | 'nextjs' | 'html';

const APP_URL = (import.meta.env.VITE_APP_URL as string) || 'https://your-app.pages.dev';
const WIDGET_SRC = `${APP_URL.replace(/\/$/, '')}/widget.js`;

const captureSnippet = (apiKey: string) => `// For use with your existing contact form
ReviewFlow.capture({
  first_name: 'Jane',
  last_name:  'Smith',
  email:      'jane@example.com',
  phone:      '0821234567',
  service:    'Plumbing repair',
  message:    'Optional notes'
});`;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://<ref>.supabase.co';

const scriptSnippet = (apiKey: string) => `<!-- Paste this before the closing </body> tag -->
<script
  src="${WIDGET_SRC}"
  data-api-key="${apiKey}"
  data-supabase-url="${SUPABASE_URL}"
  data-position="bottom-right"
  data-color="#0ea5e9"
  data-button-text="Get in Touch"
></script>`;

const nextjsSnippet = (apiKey: string) => `npm install @conextsol/reviewflow-widget

// app/layout.tsx
import { ReviewFlowWidget } from '@conextsol/reviewflow-widget';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ReviewFlowWidget apiKey="${apiKey}" />
    </>
  );
}`;

const htmlFormSnippet = (apiKey: string) => `<!-- Complete drop-in contact form -->
<form id="reviewflow-contact" onsubmit="handleReviewFlowSubmit(event)">
  <input name="first_name" placeholder="First name" />
  <input name="last_name" placeholder="Last name" />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Phone" />
  <input name="service" placeholder="Service" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>

<script>
async function handleReviewFlowSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const data = Object.fromEntries(new FormData(form));
  await ReviewFlow.capture(data);
  form.reset();
  alert('Thanks — we'll be in touch soon!');
}
</script>`;

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0d1629] border border-[#1a2234] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#0d1629]/70 transition-colors"
      >
        <Icon className="w-4.5 h-4.5 text-cyan-400" />
        <span className="flex-1 text-sm font-display font-bold text-white">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-[#1a2234] pt-4">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-cyan-400 border border-[#1a2234] hover:border-[#2a3449] rounded-md px-2.5 py-1.5 transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const inputCls =
  'w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors';

export default function SettingsPage({ settings, onSettingsUpdated, onToast }: Props) {
  const [tab, setTab] = useState<Tab>('script');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [delayDraft, setDelayDraft] = useState(settings.auto_send_delay_hours);

  const saveField = async (field: keyof Settings, value: string | number | boolean) => {
    setSavingField(field as string);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('settings')
        .update({ [field]: value })
        .eq('id', settings.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) {
        onSettingsUpdated(data as Settings);
        onToast('Settings saved.', 'success');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSavingField(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setRegenerating(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('rotate_widget_api_key').single();
      if (error) {
        const { data: d, error: e } = await supabase
          .from('settings')
          .update({ widget_api_key: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '') })
          .eq('id', settings.id)
          .select('*')
          .single();
        if (e) throw e;
        if (d) onSettingsUpdated(d as Settings);
      } else if (data) {
        onSettingsUpdated(data as unknown as Settings);
      }
      onToast('API key regenerated. The old key no longer works.', 'success');
      setConfirmRegen(false);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to regenerate API key.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const widgetKey = settings.widget_api_key || '';

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 1. Business Info */}
      <Section title="Business Info" icon={Building2}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">BUSINESS NAME</label>
            <input
              defaultValue={settings.business_name}
              onBlur={(e) => e.target.value !== settings.business_name && saveField('business_name', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[11px] font-mono text-slate-500 mb-1.5">
              GOOGLE REVIEW URL
              <a
                href="https://support.google.com/business/answer/10956684"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 normal-case"
              >
                How to get your review link <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <input
              defaultValue={settings.google_review_url}
              onBlur={(e) => e.target.value !== settings.google_review_url && saveField('google_review_url', e.target.value)}
              placeholder="https://g.page/r/…"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* 2. Email Sending */}
      <Section title="Email Sending" icon={Mail}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">FROM DISPLAY NAME</label>
            <input
              defaultValue={settings.review_from_name}
              onBlur={(e) => e.target.value !== settings.review_from_name && saveField('review_from_name', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">FROM EMAIL ADDRESS</label>
            <input
              type="email"
              defaultValue={settings.review_from_email}
              onBlur={(e) => e.target.value !== settings.review_from_email && saveField('review_from_email', e.target.value)}
              placeholder="reviews@yourbusiness.co.za"
              className={inputCls}
            />
            {!settings.review_from_email && (
              <p className="text-[10px] text-amber-400/90 mt-1.5">
                ⚠ From address must be verified in Resend before emails can send.
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">REPLY-TO EMAIL</label>
            <input
              type="email"
              defaultValue={settings.review_reply_to_email}
              onBlur={(e) => e.target.value !== settings.review_reply_to_email && saveField('review_reply_to_email', e.target.value)}
              placeholder="hello@yourbusiness.co.za"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* 3. Automation */}
      <Section title="Automation" icon={Zap}>
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm text-white">Auto-send review request</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Send automatically when a job is marked complete
              </span>
            </span>
            <button
              role="switch"
              aria-checked={settings.auto_send_enabled}
              onClick={() => saveField('auto_send_enabled', !settings.auto_send_enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                settings.auto_send_enabled ? 'bg-cyan-600' : 'bg-[#1a2234]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.auto_send_enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </label>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1.5">
              SEND AFTER — {formatDelay(delayDraft)}
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={1}
                max={168}
                value={delayDraft}
                onChange={(e) => setDelayDraft(Number(e.target.value))}
                className="flex-1 accent-cyan-600"
              />
              <span className="w-16 text-right text-sm font-mono text-white">{delayDraft}h</span>
            </div>
            {delayDraft !== settings.auto_send_delay_hours && (
              <button
                onClick={() => saveField('auto_send_delay_hours', delayDraft)}
                disabled={savingField === 'auto_send_delay_hours'}
                className="mt-2 text-xs font-mono text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/10 rounded-md px-3 py-1.5 transition-colors"
              >
                Save delay ({formatDelay(delayDraft)})
              </button>
            )}
            <p className="text-[10px] font-mono text-slate-600 mt-2">
              The review request will send automatically after this delay. You can still send manually at any time.

              (1–168 hours, max 7 days)
            </p>
          </div>
        </div>
      </Section>

      {/* 4. Widget & Integration */}
      <Section title="Widget & Integration" icon={Code2}>
        <div className="flex flex-wrap gap-2 mb-4">
          {([['script', 'Script Tag'], ['capture', 'Capture Function'], ['nextjs', 'Next.js'], ['html', 'HTML Form']] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                tab === id
                  ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                  : 'text-slate-400 border-[#1a2234] hover:border-[#2a3449]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {tab === 'script' && 'Paste this before the closing </body> tag.'}
              {tab === 'capture' && "Call this from your form's submit handler."}
              {tab === 'nextjs' && 'The npm package is a thin wrapper around the same script tag.'}
              {tab === 'html' && 'A complete drop-in form wired to the capture function.'}
            </p>
            <CopyButton
              text={
                tab === 'script'
                  ? scriptSnippet(widgetKey)
                  : tab === 'capture'
                    ? captureSnippet(widgetKey)
                    : tab === 'nextjs'
                      ? nextjsSnippet(widgetKey)
                      : htmlFormSnippet(widgetKey)
              }
            />
          </div>

          <pre className="bg-[#070b14] border border-[#1a2234] rounded-xl p-4 overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
            {tab === 'script' && scriptSnippet(widgetKey)}
            {tab === 'capture' && captureSnippet(widgetKey)}
            {tab === 'nextjs' && nextjsSnippet(widgetKey)}
            {tab === 'html' && htmlFormSnippet(widgetKey)}
          </pre>

          {tab === 'script' && widgetKey && (
            <p className="text-[10px] font-mono text-slate-600">
              Widget URL: {WIDGET_SRC}
            </p>
          )}
        </div>

        <div className="border-t border-[#1a2234] mt-5 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-white">
                <Globe2 className="w-4 h-4 text-cyan-400" /> Widget API Key
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Used to authenticate widget submissions. Rotating it will immediately invalidate the old key.

              </p>
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg border transition-colors shrink-0 ${
                confirmRegen
                  ? 'bg-rose-600 border-rose-500 text-white hover:bg-rose-500'
                  : 'text-rose-400 border-rose-500/40 hover:bg-rose-500/10'
              }`}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              {confirmRegen ? 'Confirm — old key stops working' : regenerating ? 'Regenerating…' : 'Regenerate API Key'}
            </button>
          </div>
          <p className="text-[11px] font-mono text-slate-600 mt-3 break-all">
            Current:{settings.widget_api_key || '—'}
          </p>
        </div>
      </Section>
    </div>
  );
}