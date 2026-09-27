// Enregistre le service worker (public/sw.js), uniquement en production :
// en dev, un cache ferait servir du code périmé à Vite.
export function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      console.warn('Service worker non enregistré', err);
    });
  });
}
