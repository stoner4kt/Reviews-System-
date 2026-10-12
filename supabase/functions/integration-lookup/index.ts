import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-lookup
 * ------------------
 * Called by the CRM to render the review-status badge next to a contact.
 * Returns every ReviewFlow lead matching the given email, shaped exactly as
 * the CRM's reviewFlowService expects:
 *
 *   { leads: [{ id, first_name, last_name, email, service, status,
 *               created_at, completed_at, review_send_after }], matched_at }
 *
 * Auth: `x-integration-secret` must match `INTEGRATION_SECRET`.
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

  const { data: leads, error } = await admin
    .from("leads")
    .select("id, first_name, last_name, email, service, status, created_at, completed_at, review_send_after")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) return json({ error: "Failed to query leads" }, 500);

  return json({
    leads: leads ?? [],
    matched_at: leads && leads.length ? leads[0].created_at : null,
  });
});