import { useEffect, useState } from 'react';
import { Save, Check } from 'lucide-react';
import type { Settings } from '../../types';
import { supabase } from '../../supabaseClient';
import { buildEmailHtml } from '../../emailTemplate';

interface Props {
  settings: Settings;
  onSettingsUpdated: (settings: Settings) => void;
}

// Preview merge-tag substitution values — matches what the Edge Function would send.
const PREVIEW = {
  first_name: 'Jane',
  service: 'Plumbing repair',
};

/** Strips the <!doctype>/<html>/<body> wrapper so the template can be
 *  injected into the preview <div> while keeping its internal styles. */
function stripDocWrapper(doc: string): string {
  return doc
    .replace(/<!DOCTYPE html>/i, '')
    .replace(/<html[^>]*>/i, '')
    .replace(/<\/html>/i, '')
    .replace(/<body[^>]*>/i, '')
    .replace(/<\/body>/i, '')
    .trim();
}

export default function EmailBuilder({ settings, onSettingsUpdated }: Props) {
  const [subject, setSubject] = useState(settings.email_subject_template);
  const [intro, setIntro] = useState(settings.email_intro_text);
  const [buttonText, setButtonText] = useState(settings.email_button_text);
  const [brandColor, setBrandColor] = useState(settings.email_brand_color);
  const [hexColor, setHexColor] = useState(settings.email_brand_color);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Keep local editors in sync when settings load/refresh externally.
  useEffect(() => {
    setSubject(settings.email_subject_template);
    setIntro(settings.email_intro_text);
    setButtonText(settings.email_button_text);
    setBrandColor(settings.email_brand_color);
    setHexColor(settings.email_brand_color);
  }, [settings]);

  const resolveSubject = subject
    .replace(/{{first_name}}/g, 'Jane')
    .replace(/{{business_name}}/g, settings.business_name || 'your business')
    .replace(/{{service}}/g, 'Plumbing repair');

  const resolveIntro = intro
    .replace(/{{first_name}}/g, 'Jane')
    .replace(/{{business_name}}/g, settings.business_name)
    .replace(/{{service}}/g, 'Plumbing repair');

  const html = buildEmailHtml({
    businessName: settings.business_name,
    firstName: 'Jane',
    introText: resolveIntro,
    buttonText,
    reviewUrl: settings.google_review_url || '#',
    brandColor,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('settings')
        .update({
          email_subject_template: subject,
          email_intro_text: intro,
          email_button_text: buttonText,
          email_brand_color: brandColor,
        })
        .eq('id', settings.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onSettingsUpdated(data as Settings);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      {/* Left — editor controls */}
      <div className="bg-[#0d1629] border border-[#1a2234] rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-[11px] font-mono text-slate-500 mb-1.5">SUBJECT LINE</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Thank you for choosing {{business_name}} — we'd love your feedback!"
            className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
          />
          <p className="text-[10px] font-mono text-slate-600 mt-1.5">
            Hint: use {'{{first_name}}'}, {'{{business_name}}'}, {'{{service}}'}
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-500 mb-1.5">INTRO PARAGRAPH</label>
          <textarea
            rows={3}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="This appears above the review button…"
            className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors resize-none"
          />
          <p className="text-[10px] font-mono text-slate-600 mt-1.5">
            This appears above the review button. Keep it warm and brief.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-500 mb-1.5">BUTTON TEXT</label>
          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Leave a Google Review"
            className="w-full bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-500 mb-1.5">BRAND COLOUR</label>
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => {
                setBrandColor(e.target.value);
                setHexColor(e.target.value);
              }}
              className="w-11 h-10 rounded-lg border border-[#1a2234] bg-transparent cursor-pointer"
            />
            <input
              value={hexColor}
              onChange={(e) => setHexColor(e.target.value)}
              onBlur={() => /^#[0-9a-fA-F]{6}$/.test(hexColor) && setBrandColor(hexColor)}
              className="w-28 bg-[#070b14] border border-[#1a2234] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-600"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          {savedFlash ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedFlash ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Right — live email preview */}
      <div className="bg-[#0d1629] border border-[#1a2234] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1a2234] flex items-center justify-between">
          <p className="text-xs font-mono text-slate-500">LIVE PREVIEW</p>
          <p className="text-[10px] font-mono text-slate-600 truncate max-w-[240px]">
            {resolveSubject}
          </p>
        </div>
        <div className="p-4">
          <div className="overflow-hidden rounded-xl h-[420px] lg:h-[500px]">
            {/* Live preview — render the actual email template structure in a
                scaled <div>, not an iframe. Strip the <html>/<body> wrapper and
                let the inner styles cascade from the template markup. */}
            <div
              className="pointer-events-none scale-[0.8] origin-top-left w-[125%]"
              dangerouslySetInnerHTML={{ __html: stripDocWrapper(html) }}
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#1a2234]">
          <p className="text-[10px] font-mono text-slate-600">
            Preview substitutes: {'{{first_name}}'} → Jane · {'{{business_name}}'} → {settings.business_name || '(your business name)'} · {'{{service}}'} → Plumbing repair
          </p>
        </div>
      </div>
    </div>
  );
}