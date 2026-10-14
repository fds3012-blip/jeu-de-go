// Captcha Cloudflare Turnstile (#531) devant l'envoi du code de connexion par e-mail (création de compte et
// connexion). Actif seulement si la clé publique du site existe (`VITE_TURNSTILE_SITE_KEY`, dans Vercel) : sans elle,
// rien ne change, aucun script n'est chargé. La clé secrète va seulement dans Supabase (Authentication → Attack
// Protection), qui vérifie le jeton à chaque `signInWithOtp` : procédure dans docs/architecture/securite.md.
// Turnstile ne pose aucune énigme dans la plupart des cas (« interaction-only ») ; le script vient de
// challenges.cloudflare.com (permis par la CSP de vercel.json).

/** Adresse du script, rendu explicite (le widget est placé par l'app, pas par une classe CSS). */
export const SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Builds de test seulement (VITE_E2E) : clé lue dans le stockage local, pour tester le parcours sans vraie clé. */
const E2E_CLE = 'e2e.turnstile';

export interface OptionsWidget {
  sitekey: string;
  callback: (jeton: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  theme: 'auto';
  language: string;
  size: 'flexible';
  appearance: 'interaction-only';
  action: string;
}
export interface ApiTurnstile {
  render(el: HTMLElement, o: OptionsWidget): string | undefined;
  remove(id: string): void;
}

/** Clé publique du site, ou '' (captcha inactif). */
export function cleTurnstile(): string {
  if (import.meta.env.VITE_E2E && typeof localStorage !== 'undefined') {
    try { const c = localStorage.getItem(E2E_CLE); if (c) return c; } catch { /* stockage indisponible */ }
  }
  const v = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  return typeof v === 'string' ? v.trim() : '';
}

export const turnstileActif = (): boolean => cleTurnstile() !== '';

let chargement: Promise<ApiTurnstile> | null = null;

/** Charge le script une seule fois. Échec (réseau, bloqueur) : rejeté, et un prochain appel réessaie. */
export function chargerTurnstile(delaiMs = 15_000): Promise<ApiTurnstile> {
  const w = window as unknown as { turnstile?: ApiTurnstile };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  chargement ??= new Promise<ApiTurnstile>((ok, ko) => {
    const s = document.createElement('script');
    s.src = SCRIPT_TURNSTILE;
    s.async = true;
    const minuteur = setTimeout(() => ko(new Error('turnstile: délai')), delaiMs);
    s.onload = () => { clearTimeout(minuteur); if (w.turnstile) ok(w.turnstile); else ko(new Error('turnstile: absent')); };
    s.onerror = () => { clearTimeout(minuteur); ko(new Error('turnstile: chargement')); };
    document.head.append(s);
  }).catch(e => { chargement = null; document.querySelector(`script[src="${SCRIPT_TURNSTILE}"]`)?.remove(); throw e; });
  return chargement;
}

/** Refus de Supabase quand le jeton manque ou ne passe pas (`captcha_failed`, ou message « captcha »). */
export function refusCaptcha(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (e.code === 'captcha_failed' || /captcha/i.test(e.message ?? ''));
}
