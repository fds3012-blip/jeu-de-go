/// <reference types="vite/client" />

// Variables publiques lues par src/data/supabase.ts (voir .env.example).
interface ImportMetaEnv {
  /** Build de test de bout en bout : active `?komi=` (voir src/app/App.tsx). */
  readonly VITE_E2E?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
