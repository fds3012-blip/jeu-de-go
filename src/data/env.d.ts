/// <reference types="vite/client" />

// Variables publiques lues par src/data/supabase.ts et src/data/analytics.ts (voir .env.example).
interface ImportMetaEnv {
  /** Build de test de bout en bout : active `?komi=` (voir src/app/App.tsx). */
  readonly VITE_E2E?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_SENTRY_DSN?: string;
  /** Clé publique VAPID du rappel quotidien (#36). Publique par nature ; la clé privée reste dans la fonction serveur. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** « Continuer avec Google » (#354) : `1` l'affiche ; absente, rien n'apparaît. Google doit être activé dans Supabase avant. */
  readonly VITE_AUTH_GOOGLE?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
  readonly VITE_VERCEL_ENV?: string;
}
