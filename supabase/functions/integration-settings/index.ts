import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-settings
 * --------------------
 * Read or update the single ReviewFlow settings row from the combined CRM
 * dashboard.
 *
 *   GET  /integration-settings           -> { settings }
 *   POST /integration-settings           -> update the row (body = fields to patch)
 *   POST /integration-settings/rotate-key -> regenerate widget_api_key
 *
 * Auth: requires `x-integration-secret` to match INTEGRATION_SECRET.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-integration-secret, x-internal-call",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("INTEGRATION_SECRET");
  const provided = req.headers.get("x-integration-secret");
  if (expected && provided !== expected) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "GET") {
    const { data: settings, error } = await admin.from("settings").select("*").single();
    if (error) return json({ error: "Failed to load settings" }, 500);
    return json({ settings });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const action = parts[1] || "update"; // parts = ["integration-settings", action?]

  if (action === "rotate-key") {
    const { data, error } = await admin.rpc("rotate_widget_api_key");
    if (error) return json({ error: error.message }, 500);
    return json({ widget_api_key: Array.isArray(data) ? data[0]?.widget_api_key : data });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const allowed = [
    "business_name", "google_review_url", "review_from_name", "review_from_email",
    "review_reply_to_email", "auto_send_enabled", "auto_send_delay_hours",
    "widget_api_key", "email_subject_template", "email_intro_text",
    "email_button_text", "email_brand_color",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of Object.keys(body)) if (allowed.includes(k)) patch[k] = body[k];

  if (Object.keys(patch).length === 1) return json({ error: "No valid fields to update" }, 400);

  // The settings table always has exactly one row (seeded in the migration).
  const { data: rows } = await admin.from("settings").select("id");
  if (!rows?.length) return json({ error: "Settings row not found" }, 500);

  const { data: settings, error } = await admin
    .from("settings").update(patch).eq("id", rows[0].id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json({ settings });
});