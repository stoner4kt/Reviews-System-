import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * send-review-email
 * -----------------
 * Called either manually from the dashboard (authenticated user JWT) or
 * internally after a job is marked complete / by the frontend scheduler
 * (service-role key + x-internal-call: true).
 *
 * Auth pattern: identical to the pattern used in the Conextsol Agency portal.
 *   - If x-internal-call: true → trust the request (service-role bootstrap).
 *   - Otherwise → validate the Bearer JWT via auth.getUser().
 *
 * Reads the full email template from settings, resolves merge tags, sends via
 * Resend, logs the send to review_requests, and flips the lead to review_sent.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-internal-call",
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
        <!-- Header: dark gradient, ReviewFlow wordmark, business name subtext -->
        <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #1a2234;">
          <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">ReviewFlow</div>
          ${name ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin-top:4px;">${name}</div>` : ""}
        </div>
        <!-- Body: greeting, intro text, CTA button in brand colour -->
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
        <!-- Footer: locked — not client-editable -->
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ---- Auth ----
  const isInternal = req.headers.get("x-internal-call") === "true";
  if (!isInternal) {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Unauthorized — missing token" }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
  }

  // ---- Body ----
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const leadId = String(body.lead_id || "");
  if (!leadId) return json({ error: "lead_id is required" }, 400);

  const { data: lead, error: leadError } = await admin
    .from("leads").select("*").eq("id", leadId).single();
  if (leadError || !lead)
    return json({ error: "Lead not found" }, 404);

  const { data: settings } = await admin.from("settings").select("*").single();
  if (!settings)
    return json({ error: "Settings not configured" }, 500);

  // ---- Resolve merge tags ----
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

  // ---- Send via Resend (never called from the browser) ----
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
    return json({
      error: "Resend send failed",
      detail: resendData,
    }, 502);
  }

  // 1. Insert into review_requests
  await admin.from("review_requests").insert({
    lead_id:           lead.id,
    recipient_email:   lead.email,
    recipient_name:    recipient,
    email_subject:     resolvedSubject,
    resend_message_id: resendData.id,
    status:            "sent",
    triggered_by:      isInternal ? "auto" : "manual",
  });

  // 2. Update lead status
  await admin.from("leads").update({
    status:     "review_sent",
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);

  return json({ success: true, message_id: resendData.id });
});