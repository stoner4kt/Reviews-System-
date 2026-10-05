import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// CORS — allow all origins (widget runs on the client's domain)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-widget-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate widget API key
  const widgetKey = req.headers.get("x-widget-key");
  const { data: settings } = await admin
    .from("settings").select("widget_api_key, auto_send_enabled, auto_send_delay_hours")
    .single();

  if (!settings || widgetKey !== settings.widget_api_key)
    return new Response(JSON.stringify({ error: "Invalid API key" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (!body.email)
    return new Response(JSON.stringify({ error: "email is required" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

  const { data: lead, error } = await admin.from("leads").insert({
    first_name: body.first_name || '',
    last_name:  body.last_name  || '',
    email:      body.email.toLowerCase().trim(),
    phone:      body.phone   || null,
    service:    body.service || null,
    message:    body.message || null,
    source:     'widget',
    status:     'new',
  }).select("id").single();

  if (error)
    return new Response(JSON.stringify({ error: "Failed to save lead" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  return new Response(
    JSON.stringify({ success: true, lead_id: lead.id }),
    { status: 201, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});