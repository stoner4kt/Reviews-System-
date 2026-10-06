# ReviewFlow — Website Connection Guide

> How to connect a **client's website** to ReviewFlow so that leads submitted
> through their **existing contact form** land in the dashboard and flow through
> the review pipeline.
>
> Companion to `SETUP_GUIDE.md` (per-client deployment). Read that first —
> this guide assumes the deployment is already live (dashboard reachable at
> `https://<client>.conextsol.co.za`, edge functions deployed, widget.js serves).

---

## 1. How it works (one diagram, no surprises)

```
  Visitor fills in the CLIENT'S existing contact form
        │  submit handler calls:  ReviewFlow.capture({...})
        ▼
  widget.js (loaded on the client's site, defines window.ReviewFlow)
        │  POST /functions/v1/capture-lead   (x-widget-key header)
        ▼
  capture-lead Edge Function  ──validates the key against settings.widget_api_key──▶  401 if bad
        ▼
  leads table  (source = 'widget', status = 'new')
        │
        ▼
  Dashboard → Leads (New) → pipeline → Complete → review email via
  send-review-email Edge Function + Resend
```

- **You do NOT need to rebuild or redeploy ReviewFlow for each site.**
- **You do NOT expose your Supabase anon/service keys** on the client's site —
  the widget sends the request to your edge function, which is the only thing
  that talks to the database.
- The client's site only carries their **widget API key** (public by design and
  tied to their single-tenant instance).

---

## 2. What you need before starting

| # | Item | Where to find it |
|---|------|------------------|
| 1 | The client's **widget API key** | Dashboard → **Settings → Widget & Integration** (`Your widget_api_key` is shown, or use the pre-filled Script Tag / Capture Function snippet) |
| 2 | The **widget script URL** | `https://<client>.conextsol.co.za/widget.js` (served from your Pages deployment) |
| 3 | The **Supabase URL** | `https://<ref>.supabase.co` (auto-filled into the dashboard snippet when `VITE_SUPABASE_URL` is set) |
| 4 | Access to the client's site (HTML / form code / CMS) | Client or their webmaster |

> If you want the sector's "Script Tag" and "Capture Function" snippets pre-filled
> with the client's real values, open their dashboard → **Settings → Widget &
> Integration** → copy from the relevant tab — they are generated live.

---

## 3. Connecting a client's EXISTING contact form (the standard way)

### 3.1 Add the widget script to their site

Add this **before the closing `</body>` tag** — on the contact page at minimum,
ideally on every page (so the optional floating button works everywhere):

```html
<script
  src="https://reveiwsus.conextsol.co.za/widget.js"
  data-api-key="<CLIENT_WIDGET_API_KEY>"
  data-supabase-url="https://<ref>.supabase.co"
  data-position="bottom-right"
  data-color="#0ea5e9"
  data-button-text="Get in Touch"
></script>
```

| Attribute | Required | Purpose |
|---|---|---|
| `src` | yes | The widget bundle (defines `window.ReviewFlow`) |
| `data-api-key` | yes | The client's `widget_api_key` — validates submissions |
| `data-supabase-url` | yes* | Where to POST leads (`*` falls back to the fallback placeholder — always set it) |
| `data-position` | no | `bottom-right` (default) or `bottom-left` |
| `data-color` | no | Floating button / form accent colour (default `#0ea5e9`) |
| `data-button-text` | no | Floating button label (default `Get in Touch`) |

Loading the widget also injects a small floating *"Get in Touch"* button in the
bottom corner with its own mini-form. That's a **second, optional** lead source.
If the client does not want it, skip the floating button — their existing form
will still work through `ReviewFlow.capture()` (see below). *(Floating-button
hide option is a planned enhancement — see comments in `src/widget/index.ts`.)*

### 3.2 Wire their form's submit handler

Find the client's form submit handler (their JS or the form's `submit` event).
Add a call to `ReviewFlow.capture(...)`. This is the **whole integration**:

```html
<script>
  const form = document.getElementById('contact-form'); // their real form

  form.addEventListener('submit', async function (e) {
    e.preventDefault();                                   // stop normal submit first

    const data = Object.fromEntries(new FormData(form));  // grab their fields

    // Map THEIR field names → the fields ReviewFlow expects.
    // Required: only email. Everything else optional.
    const result = await ReviewFlow.capture({
      first_name: data.first_name || data.name?.trim().split(' ')[0]   || '',
      last_name:  data.last_name  || data.name?.trim().split(' ').slice(1).join(' ') || '',
      email:      data.email || data['e-mail'] || data['Email'] || '',
      phone:      data.phone || '',
      service:    data.service || data.subject || 'General enquiry',
      message:    data.message || data.notes || '',
    });

    if (result.ok) {
      form.reset();
      // show a thank-you on the page; ReviewFlow is done.
      // optional: ALSO keep sending to their old backend so nothing breaks:
      // fetch('https://client-site.co.za/old-endpoint', { method: 'POST', body: new FormData(form) });
    } else {
      alert('Sorry — something went wrong sending your message. ' + (result.error || ''));
      // form NOT reset — user can retry
    }
  });
</script>
```

**Important details**

- **Field mapping is the only real work.** Their form may use `name` (full) vs
  `first_name`/`last_name`, `e-mail` vs `email`, `subject` vs `service`.
  Match them up; anything missing becomes `''`. Only `email` is required.
- **`ReviewFlow.capture` returns a Promise** → `{ ok: boolean, error?: string }`.
  Use it for proper success/error UX on their site.
- **`email` is validated** on the widget side (format) and on the server side
  (`capture-lead` rejects requests without one with `400 email is required`).
- **Duplicate-safe / no double send:** if their site also submits to another CRM,
  that's fine — the widget only POSTs to ReviewFlow once per call. Do not wrap
  the capture in an `onclick` that also fires on submit *and* on a separate click.

### 3.3 Verify (do this before telling the client it's done)

1. Open the client's contact page (hard refresh to bust cache).
2. Submit a test enquiry **using your own email**.
3. Dashboard → **Leads** → the lead appears in **New**, source badge `Widget`, within a second or two.
4. (Optional) Watch the live update — the board updates in real time while any dashboard tab is open.
5. Then exercise the pipeline: drag to **In Progress** → **Complete** → confirm the
   review email arrives (or the "Send now?" toast if auto-send is on).

---

## 4. Alternative connect options

### 4A. Floating button only (no existing form work)

Just add the script tag from §3.1 (no capture wiring needed). Visitors use the
floating mini-form → same `leads` table → same pipeline. Simplest option, but the
form is generic (no client branding beyond the colour / button label).

### 4B. Drop-in standalone HTML form

Dashboard → **Settings → Widget & Integration → "HTML Form" tab** → copy. A
complete, styled form already wired to `ReviewFlow.capture`. Ideal for:
- a quick proof-of-concept page
- clients with no form yet

### 4C. Manual entry (zero code, always works)

Dashboard → **Leads → Add Lead**. Everything the client types lands in the same
pipeline. Good fallback while the site integration is in progress.

### 4D. Next.js / React site

Dashboard → **Settings → Widget & Integration → "Next.js" tab**. The npm wrapper
`@conextsol/reviewflow-widget` mounts the same script tag as a React component.
Install it, drop `<ReviewFlowWidget apiKey="…" />` into the layout, then call
`ReviewFlow.capture(...)` from the form's submit handler exactly as in §3.2.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ReviewFlow` is undefined on the client page | Script tag not loaded (blocked, wrong path, or `widget.js` 404) → check `https://<client>.conextsol.co.za/widget.js` returns 200 |
| Capture returns `{ ok: false, error: "Invalid API key" }` | `data-api-key` ≠ `settings.widget_api_key`. Copy a fresh snippet from the dashboard (Settings → Widget & Integration); if regenerated, paste the **new** key |
| Capture returns `"Network error"` | CORS / network — `capture-lead` sets `Access-Control-Allow-Origin: *`, so this usually means the `data-supabase-url` is wrong or the function isn't deployed. Verify `https://<ref>.supabase.co/functions/v1/capture-lead` exists |
| Lead saved but shows **source: Widget** (not Capture) | By design — both the form capture and the floating button POST to the same endpoint, so they're logged under `widget`. (If you need to distinguish, extend the widget `capture` to send a `source` field — see `src/widget/index.ts`.) |
| Lead appears with blank name | Their form field names didn't map → check the `first_name` / `last_name` mapping in §3.2 |
| Email sends fail at the "Complete" stage | Not a site issue — review `SETUP_GUIDE.md` → Edge Function secrets (`RESEND_API_KEY`) and the From address on Settings → Email Sending |
| No realtime update in the dashboard | The board updates via Supabase Realtime — keep the dashboard tab open and logged-in. Polling (5 min) also refreshes it |

---

## 6. Handover wording for the client

> "We've connected your website's contact form to your ReviewFlow dashboard.
> Every enquiry now automatically appears under *Leads* — no manual data entry.
> When you mark a job complete, we'll automatically send the customer a Google
> review request." 

Add: their dashboard URL, their login (see `SETUP_GUIDE.md` §2.3/§5), and
confirm the form still works the way it always did (thank-you messages etc.).

---

_© Conextsol — ReviewFlow. Reusable per-client integration runbook._