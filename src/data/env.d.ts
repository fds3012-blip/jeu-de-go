/// <reference types="vite/client" />

// Variables publiques lues par src/data/supabase.ts (voir .env.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
