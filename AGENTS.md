# AGENTS.md

## Project

ReviewFlow by Conextsol — a single-tenant, white-label review automation SaaS.
Each deployment = one Supabase project + one Cloudflare Pages site + one Resend
account. React 19 + Vite + Tailwind CSS v4, Supabase backend, Resend email,
vanilla-JS embeddable widget.

## Commands

```bash
npm install
npm run dev          # Vite dev server (reads .env)
npm run build        # React app → dist/
npm run build:widget # widget → public/widget.js (zero-dependency IIFE)
npm run build:all    # both
npm run typecheck    # tsc --noEmit (no type errors expected)
```

There are **two separate Vite builds**: `vite.config.ts` (React app, tailwind
plugin) and `vite.widget.config.ts` (lib-mode IIFE, `publicDir: false`,
`fileName: () => 'widget.js'`). Keep the configs distinct — a shared config will
break the widget outDir/publicDir separation.

## Architecture

- Frameworks: React 19, Tailwind v4 via `@tailwindcss/vite`, `lucide-react`,
  `@supabase/supabase-js`. **No external state library, no router** — all state
  lives in `App.tsx` and is passed via props; tab navigation is `useState<Section>`.
- Supabase client: `src/supabaseClient.ts`. `isConfigured` is `false` when env
  vars are missing → App renders a config screen (intentional, tested).
- Edge functions (`supabase/functions/*`): Deno, called via plain `fetch`
  (`src/utils.ts` `callEdgeFunction`). Browser sends `x-internal-call: true`;
  the function validates a Bearer JWT otherwise (`auth.getUser()`).
- Resend is **only** called from `send-review-email` edge function. Never from
  the browser. Requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WIDGET_SECRET`
  env vars set in Supabase dashboard.
- Auto-send is a frontend polling loop (5 min interval) in `App.tsx` with an
  inline comment to replace with pg_cron/Cloudflare Worker for production.

## Email template

`src/emailTemplate.ts` (`buildEmailHtml`) is the single source of truth for
both the EmailBuilder preview and the edge function's generated HTML. The
footer `Powered by ReviewFlow · Conextsol` is locked (not client-editable).

## Widget

- Source `src/widget/index.ts`, built to `public/widget.js`, ~10.5 kB / ~3.7 kB
  gzip, zero dependencies.
- Realtime test procedure (works without Supabase):
  1. `npm run dev` (serves app + `/widget.js`).
  2. Create an HTML page that loads `http://localhost:5173/widget.js` with
     `data-api-key` + `data-supabase-url` attributes (a local mock server can
     stand in for Supabase function URLs).
  3. Window API: `window.ReviewFlow.capture(data)`.

## Styling tokens

Dark theme constants used across all components:
`bg-[#070b14]` page, `bg-[#0d1629]` cards, `bg-[#0b0f19]` sidebar,
`border-[#1a2234]`, primary `cyan-600/400`, fonts `font-display`/`font-mono`
(defined in `src/main.css` `@theme`).

## Design decisions / gotchas

- TypeScript strict mode. `npx tsc --noEmit` must stay green.
- `settings` table always has exactly one row (seeded in migration). `leads`
  statuses: `new | in_progress | complete | review_sent | cancelled`.
- RLS: only `authenticated` policies; widget writes go through edge functions
  with the service-role key — never the anon key.
- `rotate_widget_api_key()` RPC lives in the migration and is SECURITY DEFINER.