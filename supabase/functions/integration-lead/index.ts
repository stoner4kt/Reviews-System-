import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-lead
 * ----------------
 * Admin CRUD + actions on ReviewFlow leads, proxied from the combined CRM
 * dashboard. Action is read from the URL path:
 *
 *   POST /integration-lead          -> create a lead (body = lead fields)
 *   POST /integration-lead/{id}     -> update a lead (body = fields to patch)
 *   DELETE /integration-lead/{id}   -> delete a lead
 *   POST /integration-lead/{id}/send-review -> send the review email now
 *
 * Auth: requires `x-integration-secret` to match INTEGRATION_SECRET (the
 * value the CRM sends as its REVIEWFLOW_SECRET).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-integration-secret, x-internal-call",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sendReviewNow(admin: Awaited<ReturnType<typeof createClient>>, leadId: string): Promise<Response> {
  const { data: lead, error: leadError } = await admin
    .from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadError || !lead) return json({ error: "Lead not found" }, 404);

  const { data: settings } = await admin.from("settings").select("*").single();
  if (!settings) return json({ error: "Settings not configured" }, 500);

  const subject = String(settings.email_subject_template || "").replace(/{{first_name}}/g, String(lead.first_name || "")).replace(/{{business_name}}/g, String(settings.business_name || "")).replace(/{{service}}/g, String(lead.service || ""));
  const intro = String(settings.email_intro_text || "").replace(/{{first_name}}/g, String(lead.first_name || "")).replace(/{{business_name}}/g, String(settings.business_name || "")).replace(/{{service}}/g, String(lead.service || ""));
  const buttonText = String(settings.email_button_text || "Leave a Google Review");
  const brandColor = settings.email_brand_color && /^#[0-9a-fA-F]{6}$/.test(settings.email_brand_color) ? settings.email_brand_color : "#0ea5e9";

  const fromEmail = String(settings.review_from_email || "");
  if (!fromEmail) return json({ error: "review_from_email is not configured" }, 400);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 500);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: settings.review_from_name ? `${settings.review_from_name} <${fromEmail}>` : fromEmail,
      to: [lead.email],
      reply_to: settings.review_reply_to_email || undefined,
      subject,
      html: buildEmailHtml({ businessName: settings.business_name, firstName: lead.first_name, introText: intro, buttonText, reviewUrl: settings.google_review_url, brandColor }),
    }),
  });
  const resendData = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) return json({ error: "Resend send failed", detail: resendData }, 502);

  await admin.from("review_requests").insert({
    lead_id: leadId,
    recipient_email: lead.email,
    recipient_name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || undefined,
    email_subject: subject,
    resend_message_id: resendData.id,
    status: "sent",
    triggered_by: "manual",
  });

  await admin.from("leads").update({ status: "review_sent", updated_at: new Date().toISOString() }).eq("id", leadId);
  return json({ success: true, message_id: resendData.id });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: { businessName: string; firstName: string; introText: string; buttonText: string; reviewUrl: string; brandColor: string }): string {
  const name = escapeHtml(opts.businessName || "your business");
  const firstName = escapeHtml(opts.firstName || "there");
  const intro = escapeHtml(opts.introText || "It was a pleasure working with you. A Google review means the world to a small business.");
  const button = escapeHtml(opts.buttonText || "Leave a Google Review");
  const url = escapeHtml(opts.reviewUrl || "#");
  const color = opts.brandColor || "#0ea5e9";
  return `<div style="background:#0b0f19;padding:32px 24px;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #1a2234;">
      <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">ReviewFlow</div>
      ${name ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin-top:4px;">${name}</div>` : ""}
    </div>
    <div style="padding:28px 8px 8px 8px;">
      <p style="font-family:Arial,sans-serif;font-size:16px;color:#e2e8f0;margin:0 0 12px 0;">Hi ${firstName},</p>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#94a3b8;margin:0 0 24px 0;">${intro}</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">${button}</a>
      </div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;margin:8px 0 0 0;">Takes 60 seconds</p>
    </div>
    <div style="text-align:center;padding-top:20px;margin-top:20px;border-top:1px solid #1a2234;">
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;margin:0;">Sent by ${name} · Powered by ReviewFlow by Conextsol</p>
    </div>
  </div>
</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST" && req.method !== "DELETE") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("INTEGRATION_SECRET");
  const provided = req.headers.get("x-integration-secret");
  if (expected && provided !== expected) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // e.g. ["integration-lead", "{id}", "send-review"]
  const id = parts[1] && parts[1] !== "integration-lead" ? parts[1] : null;
  const action = parts[2] || (req.method === "DELETE" ? "delete" : id ? "update" : "create");

  if (action === "send-review") {
    if (!id) return json({ error: "lead id is required" }, 400);
    return sendReviewNow(admin, id);
  }

  if (req.method === "DELETE") {
    if (!id) return json({ error: "lead id is required" }, 400);
    const { error } = await admin.from("leads").delete().eq("id", id);
    if (error) return json({ error: "Failed to delete lead" }, 500);
    return json({ success: true });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const FIELDS = [
    "first_name", "last_name", "email", "phone", "service", "message",
    "source", "status", "external_id", "completed_at", "review_send_after",
  ];

  const pickFields = (b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of FIELDS) if (k in b) out[k] = b[k];
    return out;
  };

  if (action === "create") {
    const patch = pickFields(body);
    const email = String(patch.email || "").toLowerCase().trim();
    if (!email) return json({ error: "email is required" }, 400);
    patch.email = email;
    patch.source = String(patch.source || "manual");
    patch.status = String(patch.status || "new");
    const { data, error } = await admin.from("leads").insert(patch).select("*").single();
    if (error) return json({ error: error.message }, 500);
    return json({ lead: data }, 201);
  }

  if (action === "update") {
    if (!id) return json({ error: "lead id is required" }, 400);
    const patch = pickFields(body);
    if ("email" in patch) patch.email = String(patch.email).toLowerCase().trim();
    if (Object.keys(patch).length === 0) return json({ error: "No valid fields to update" }, 400);
    const { data, error } = await admin.from("leads").update(patch).eq("id", id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    return json({ lead: data });
  }

  return json({ error: "Unknown action" }, 400);
});