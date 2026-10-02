import { ecouterNouvelleVersion } from './app/miseAJour';

// Enregistre le service worker (public/sw.js), uniquement en production :
// en dev, un cache ferait servir du code périmé à Vite.
// Appelable avant comme après l'événement `load` (main.tsx l'appelle une fois le premier écran affiché).
export function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Nouvelle version prête (#325) : écoute le changement de contrôleur avant d'enregistrer, pour ne rien manquer.
  ecouterNouvelleVersion();
  const enregistrer = () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      console.warn('Service worker non enregistré', err);
    });
  };
  if (document.readyState === 'complete') enregistrer();
  else window.addEventListener('load', enregistrer, { once: true });
}
