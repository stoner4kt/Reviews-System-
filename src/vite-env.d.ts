/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_AGENCY_NAME?: string;
  readonly VITE_AGENCY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}