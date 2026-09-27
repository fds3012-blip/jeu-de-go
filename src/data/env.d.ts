/// <reference types="vite/client" />

// Variables publiques lues par src/data/supabase.ts et src/data/analytics.ts (voir .env.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
  readonly VITE_VERCEL_ENV?: string;
}
