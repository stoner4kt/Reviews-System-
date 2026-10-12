import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-capture
 * -------------------
 * Called by the CRM (TradePro) when a lead is marked won or a project is
 * completed. Mirrors the lead into the ReviewFlow `leads` table so the
 * combined dashboard + review pipeline can act on it.
 *
 * Auth: requires `x-integration-secret` to match the `INTEGRATION_SECRET` env
 * var set on this function. The CRM sends the same value as its own
 * REVIEWFLOW_SECRET.
 *
 * Idempotent: upserts by `external_id` (the CRM project id). If external_id
 * is absent, falls back to matching by email.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-integration-secret, x-internal-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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
  if (!email) return json({ error: "email is required" }, 400);

  const externalId = body.external_id ? String(body.external_id).trim() : null;

  const payload = {
    first_name: String(body.first_name || ""),
    last_name: String(body.last_name || ""),
    email,
    phone: body.phone ? String(body.phone) : null,
    service: body.service ? String(body.service) : null,
    message: body.message ? String(body.message) : null,
    source: "crm",
    status: "new",
    updated_at: new Date().toISOString(),
  };

  // Prefer matching by external_id (the CRM's project id), then fall back to
  // email so a re-notification never duplicates a lead.
  let existing: { id: string } | null = null;
  if (externalId) {
    const { data: byExt, error: extError } = await admin
      .from("leads").select("id").eq("external_id", externalId).maybeSingle();
    if (extError) return json({ error: "Failed to query leads" }, 500);
    existing = (byExt as { id: string } | null) ?? null;
  }
  if (!existing) {
    const { data: byEmail, error: emailError } = await admin
      .from("leads").select("id").eq("email", email).maybeSingle();
    if (emailError) return json({ error: "Failed to query leads" }, 500);
    existing = (byEmail as { id: string } | null) ?? null;
  }

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("leads")
      .update({ ...payload, external_id: externalId ?? null })
      .eq("id", existing.id);
    if (updateError) return json({ error: "Failed to update lead" }, 500);
    return json({ success: true, lead_id: existing.id, created: false });
  }

  const { data: inserted, error: insertError } = await admin
    .from("leads")
    .insert({ ...payload, external_id: externalId ?? null })
    .select("id")
    .single();
  if (insertError) return json({ error: "Failed to save lead" }, 500);

  return json({ success: true, lead_id: inserted.id, created: true }, 201);
});