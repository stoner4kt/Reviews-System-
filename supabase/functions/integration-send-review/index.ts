import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-send-review
 * -----------------------
 * Called by the CRM when a project flips to completed and auto-send is on.
 * Locates the ReviewFlow lead by external_id (CRM project id) or email, then
 * sends the review-request email through Resend using the settings template —
 * identical behavior to the manual `send-review-email` function, but keyed on
 * the CRM's identifiers rather than a lead_id.
 *
 * Auth: `x-integration-secret` must match `INTEGRATION_SECRET`.
 *
 * Body: { email: string, external_id?: string }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-integration-secret, x-internal-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: {
  businessName: string;
  firstName: string;
  introText: string;
  buttonText: string;
  reviewUrl: string;
  brandColor: string;
}): string {
  const { businessName, firstName, introText, buttonText, reviewUrl, brandColor } = opts;
  const name = escapeHtml(businessName || "");
  const greeting = escapeHtml(firstName || "there");
  const intro = escapeHtml(introText || "");
  const button = escapeHtml(buttonText || "Leave a Google Review");
  const url = escapeHtml(reviewUrl || "#");
  const color = brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#0ea5e9";
  const background = "linear-gradient(135deg,#0b0f19 0%,#0d1629 50%,#1a2234 100%)";

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#0b0f19;">
    <div style="background:${background};padding:32px 24px;">
      <div style="max-width:560px;margin:0 auto;">
        <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #1a2234;">
          <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">ReviewFlow</div>
          ${name ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin-top:4px;">${name}</div>` : ""}
        </div>
        <div style="padding:28px 8px 8px 8px;">
          <p style="font-family:Arial,sans-serif;font-size:16px;color:#e2e8f0;margin:0 0 12px 0;">
            Hi ${greeting},
          </p>
          <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#94a3b8;margin:0 0 24px 0;">
            ${intro}
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${url}" target="_blank" rel="noopener"
               style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">
              ${button}
            </a>
          </div>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;margin:8px 0 0 0;">
            Takes 60 seconds
          </p>
        </div>
        <div style="text-align:center;padding-top:20px;margin-top:20px;border-top:1px solid #1a2234;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;margin:0;">
            Sent by ${name || "this business"} · Powered by ReviewFlow by Conextsol
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function resolveTags(value: string, lead: Record<string, unknown>, settings: Record<string, unknown>): string {
  const businessName = String(settings.business_name || "");
  const firstName = String(lead.first_name || "");
  const service = String(lead.service || "your recent service");
  return value
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{service\}\}/g, service);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("INTEGRATION_SECRET");
  const provided = req.headers.get("x-integration-secret");
  if (expected && provided !== expected) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const email = String(body.email || "").toLowerCase().trim();
  const externalId = body.external_id ? String(body.external_id).trim() : null;
  if (!email && !externalId) return json({ error: "email or external_id is required" }, 400);

  let query = admin.from("leads").select("*").eq("email", email).limit(1);
  if (externalId) query = admin.from("leads").select("*").eq("external_id", externalId).limit(1);

  const { data: leads, error: leadError } = await query;
  const lead = leads?.[0];
  if (leadError || !lead) return json({ error: "Lead not found" }, 404);

  const { data: settings } = await admin.from("settings").select("*").single();
  if (!settings) return json({ error: "Settings not configured" }, 500);

  const resolvedSubject = resolveTags(String(settings.email_subject_template || ""), lead, settings);
  const resolvedIntro = resolveTags(String(settings.email_intro_text || ""), lead, settings);

  const html = buildEmailHtml({
    businessName: settings.business_name,
    firstName: lead.first_name,
    introText: resolvedIntro,
    buttonText: settings.email_button_text,
    reviewUrl: settings.google_review_url,
    brandColor: settings.email_brand_color,
  });

  const recipient = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || undefined;
  const fromEmail = String(settings.review_from_email || "");
  if (!fromEmail) {
    return json({ error: "review_from_email is not configured. Verify a sender domain in Resend first." }, 400);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 500);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: settings.review_from_name
        ? `${settings.review_from_name} <${fromEmail}>`
        : fromEmail,
      to: [lead.email],
      reply_to: settings.review_reply_to_email || undefined,
      subject: resolvedSubject,
      html,
    }),
  });

  const resendData = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    return json({ error: "Resend send failed", detail: resendData }, 502);
  }

  await admin.from("review_requests").insert({
    lead_id:           lead.id,
    recipient_email:   lead.email,
    recipient_name:    recipient,
    email_subject:     resolvedSubject,
    resend_message_id: resendData.id,
    status:            "sent",
    triggered_by:      "auto",
  });

  await admin.from("leads").update({
    status:     "review_sent",
    updated_at: new Date().toISOString(),
  }).eq("id", lead.id);

  return json({ success: true, message_id: resendData.id });
});