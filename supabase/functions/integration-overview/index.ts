import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/*
 * integration-overview
 * --------------------
 * Single-call admin snapshot for the combined CRM dashboard. Returns the
 * ReviewFlow settings row, all leads and all review requests.
 *
 * Auth: requires `x-integration-secret` to match the INTEGRATION_SECRET env
 * var (same secret the CRM sends as its REVIEWFLOW_SECRET).
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

  const [settingsRes, leadsRes, reviewsRes] = await Promise.all([
    admin.from("settings").select("*").single(),
    admin.from("leads").select("*").order("created_at", { ascending: false }),
    admin.from("review_requests").select("*").order("sent_at", { ascending: false }),
  ]);

  if (settingsRes.error) return json({ error: "Failed to load settings" }, 500);
  if (leadsRes.error) return json({ error: "Failed to load leads" }, 500);
  if (reviewsRes.error) return json({ error: "Failed to load review requests" }, 500);

  return json({
    settings: settingsRes.data,
    leads: leadsRes.data ?? [],
    review_requests: reviewsRes.data ?? [],
  });
});