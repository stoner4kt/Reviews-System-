# ReviewFlow — Client Setup Guide

> Reusable runbook for standing up a **new single-tenant ReviewFlow deployment**.
> One client = one Supabase project + one Resend account/domain + one Cloudflare
> Pages deployment + one GitHub repo. Follow the whole guide per client; Skip annex A
> unless an unmet requirement forces a restart.

---

## 0. Architecture recap (what you are actually deploying)

```
Client website ──widget.js + data-api-key──▶ capture-lead edge fn ──▶ leads table
                                                      │
Dashboard (Cloudflare Pages, this React app)───▶ leads / settings / review_requests
                                                      │          (RLS: authenticated only)
Review email ──React app ──▶ send-review-email edge fn ──▶ Resend ──▶ customer inbox
                                                           │
                                                           └──▶ review_requests log + lead status → review_sent
```

- **Frontend:** React 19 + Vite + Tailwind v4 → static build in `dist/` → Cloudflare Pages.
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS) — one project per client.
- **Email:** Resend — called **only** from the `send-review-email` edge function, never from
  the browser. Requires a verified sending domain per client.
- **Widget:** `public/widget.js` (zero-dependency IIFE) served from the Pages deployment.

---

## 1. Pre-requisites (do once for the agency)

| Account | Why | Details |
|---|---|---|
| Supabase | Database + Auth + Edge Functions | `supabase` CLI installed + logged in |
| Resend | Transactional email | One account can hold many domains |
| Cloudflare | Pages hosting + custom domains | Access to the client's DNS zone |
| GitHub | Source control per deployment | Template access to this repo |
| Node.js 18+ | Local build/tooling | + `npm` |

Once, per agency:

```bash
supabase login          # one-time Supabase CLI auth
```

---

## 2. Per-client setup — checklist

### □ 2.1 Create the client's repo (from this template)

```bash
# On GitHub: New repository → name it e.g. "Acme-ReviewFlow" (private)。
# Then in a terminal:
git clone git@github.com:conextsol/ReviewFlow.git client-tmp        # this template
cd client-tmp
git remote set-url origin git@github.com:Conextsol/<CLIENT>-ReviewFlow.git
git push -u origin main
```

> Keep the code identical across clients — **no hardcoded client values anywhere**..
> Everything varies via env vars + the `settings` table row.



### □ 2.2 Create the Supabase project

1. https://supabase.com → **New project** → name: `<client>-reviewflow` → pick a region, strong DB password → save it in the client's password vault.
2. Grab the project URL + anon key:
   - Settings → API → **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (used by the dashboard frontend)。
   - **service_role** key (secret — used by edge functions only)。
3. Apply the schema to the `public` schema:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push            # runs supabase/migrations/20240101000001_initial_schema.sql
```

   This creates the `settings`, `leads`, `review_requests` tables, RLS policies, and
   seeds the single `settings` row (which auto-generates the `widget_api_key`).



### □ 2.3 Create the client's dashboard login

The dashboard has no public sign-up — accounts are provisioned by you.

1. Supabase Dashboard → **Authentication → Users → Add user** → email + temp password.
2. Send the client the dashboard URL + credentials; they change their own password.
3. (Optional) Set **Authentication → URL Configuration → Site URL** to the final dashboard
   URL (e.g. `https://acme.conextsol.co.za`) — makes email links/auth redirects correct..

> RLS: only `authenticated` users can read/write the three tables. The single
> client user (or few staff users) is all that is needed.



### □ 2.4 Resend — verify a sender domain

1. https://resend.com → **Domains → Add Domain** → `acme.co.za`.
2. Add the **3 DNS records** (SPF, DKIM, MX — shown on the Resend screen) in the
   client's DNS zone (Cloudflare → DNS → Add record)。Wait for verification (~a few hours; can
   continue with the rest while it verifies)。
3. **API Keys → Create API Key** → name `reviewflow-<client>` → copy. This is the
   `RESEND_API_KEY` secret. Scope it to the domain above.



### □ 2.5 Deploy the edge functions + secrets

```bash
supabase functions deploy capture-lead
supabase functions deploy send-review-email
```

Then set secrets on **both** functions (Supabase Dashboard → Edge Functions → select
function → **Secrets**, or CLI)：

| Secret | Value | Used by |
|---|---|---|
| `SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) | auto-injected by Supabase (no need to set) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | auto-injected (no need to set) |
| `RESEND_API_KEY` | Resend API key from step 2.4 | `send-review-email` |

> The docs also list `RESEND_FROM_EMAIL` and `WIDGET_SECRET` as examples — in this
> build the "from" address lives in the **Settings → Email Sending** page (client-editable),
> and widget-auth uses the `widget_api_key` stored in the `settings` table (auto-generated) —
> so neither needs to be set as an env secret. `RESEND_API_KEY` is the only custom secret.



### □ 2.6 Deploy the frontend to Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
   pick the client's repo → framework preset: **React / Vite**。
2. Build settings:
   | Setting | Value |
   |---|---|
   | Build command | `npm ci && npm run build:all` |
   | Build output directory | `dist` |
3. **Environment variables** (Pages → Settings → Environment variables)：

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |
   | `VITE_APP_URL` | `https://acme.conextsol.co.za` (final domain) |
   | `VITE_BRAND_NAME` | `ReviewFlow` |
   | `VITE_AGENCY_NAME` | `Conextsol` |
   | `VITE_AGENCY_URL` | `https://conextsol.co.za` |
4. Deploy → after the first build, add the **custom domain** (Pages → Custom domains →
   `acme.conextsol.co.za` + DNS CNAME)。Enable **HTTPS**。
5. Also serve the widget from the same deployment — it is already at
   `https://acme.conextsol.co.za/widget.js` (built by `build:all` into
   `public/widget.js` which Vite copies to `dist/widget.js`)。

   > If you only ran `npm run build`, `dist/widget.js` won't exist — always use `build:all`.

---

## 3. Client-side configuration (dashboard → first login)

| Page | What to set |
|---|---|
| **Settings → Business Info** | Business name + Google Review URL (use the "How to get your review link" helper) |
| **Settings → Email Sending** | From display name + From email (must match a verified Resend domain; warning shows if blank) + Reply-to |
| **Settings → Automation** | Toggle auto-send on/off + delay 1–168 h |
| **Settings → Widget & Integration** | Copy the **Script Tag** (pre-filled with their API key + Supabase URL) into their site `<body>`; or use Capture Function / Next.js / HTML Form tabs |

The `settings` row was seeded with a random `widget_api_key` — no key generation
needed unless they later hit **Regenerate API Key** (rotates instantly, old key dies).

---

## 4. End-to-end acceptance test (do with the client)

1. Load their website → floating button appears → submit a test lead
   (use a real email you control)。
2. Dashboard → **Leads** → lead shows in **New** with source `Widget`.
3. Drag it to **In Progress** → then to **Complete**。
   - If auto-send ON: a toast appears "Review request will send automatically in X hours. Send now?" → click **Send Now** for an instant test。
4. Check the inbox → email arrives: dark-gradient header, business name, cyan/theme
   CTA button → the (locked) "Powered by ReviewFlow by Conextsol" footer。
5. Dashboard → **Review History** → the send logged (triggered `Manual`/`Auto`)、
   status `Sent`. Click the review link → the review URL opens。
6. Dashboard → **Email Builder** → tweak subject/intro/button/colour → Save →
   preview matches the sent email。
7. Test the **Capture Function** tab: `ReviewFlow.capture({...})` from their existing
   form's submit handler → lead arrives with source `Capture`。

> Auto-send in the free tier is a frontend polling loop (5 min while the dashboard is open)。
> For production reliability on many leads, upgrade to Supabase Pro and add a `pg_cron` job
> (or a Cloudflare Worker cron) that POSTs to `send-review-email` with `x-internal-call: true` —
> mirroring what the polling loop already does. (See comment in `src/App.tsx`。)

---

## 5. Handover checklist (copy into the client handover doc)

- [ ] Dashboard URL: `https://acme.conextsol.co.za`
- [ ] Login created (1+ users, staff can share or have own accounts)。
- [ ] Business name + Google review link set
- [ ] From address verified in Resend (domain `acme.co.za`, SPF/DKIM/MX in DNS)。
- [ ] Auto-send configured (toggle + delay)。
- [ ] Widget script on their site (or capture fn wired)。
- [ ] End-to-end test passed (widget → pipeline → review email → review URL)。
- [ ] Branding lock: footer "Powered by ReviewFlow · Conextsol" everywhere (not editable)。

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Dashboard shows "Configuration Required" | `VITE_SUPABASE_URL` / anon key missing in Cloudflare env vars → redeploy. |
| Widget button missing | Script tag missing `data-api-key`; or `widget.js` not served (`build:all`, not `build`) |
| Widget submit → "Invalid API key" | Key in the script tag ≠ `settings.widget_api_key` (check Settings → Widget & Integration → Regenerate + re-paste) |
| Edge function 404 | Functions not deployed (`supabase functions deploy capture-lead` / `send-review-email`) |
| Email not sent — "review_from_email is not configured" | Set From email in Settings → Email Sending to an address on the verified Resend domain |
| Email bounced | Resend domain not fully verified (DNS propagation) or inbox typo |
| Lead saved but no toast / board not updating | Realtime channel needs the dashboard tab open; check you're logged in as an authenticated user |
| Can't log in | User not created (provision in Supabase Auth → Users)" or wrong Site URL in Auth config |
| Widget sends to wrong project | `data-supabase-url` in the script tag — keep it in sync with the client's Supabase URL |

---

## Appendix A — Full clean re-install (from scratch)

```bash
git clone git@github.com:Conextsol/<CLIENT>-ReviewFlow.git && cd <CLIENT>-ReviewFlow
npm ci
# 1. Supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
# create the client user in the dashboard (Auth → Users → Add user)
# 2. Edge functions + secret
supabase functions deploy capture-lead
supabase functions deploy send-review-email
# set RESEND_API_KEY secret on send-review-email (dashboard or:)
#   supabase secrets set RESEND_API_KEY=<key> --project-ref <PROJECT_REF>
# 3. Frontend
npm run build:all          # dist/ + dist/widget.js
# 4. Deploy dist/ to Cloudflare Pages (git-connected or wrangler:
#   npx wrangler pages deploy dist --project-name <client-reviewflow>
# 5. Set the 6 env vars on Cloudflare Pages (see step 2.6)
# 6. Set custom domain + HTTPS
```

---

_© Conextsol — ReviewFlow. Reusable per-client runbook; keep the codebase generic._