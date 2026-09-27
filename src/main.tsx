import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/app.css';
import { registerSW } from './registerSW';
import { EVENTS, initAnalytics, track } from './data/analytics';

initAnalytics();
track(EVENTS.appOuverte, { installee: window.matchMedia?.('(display-mode: standalone)').matches ?? false });
// Vérification de Sentry : ouvrir l'app avec #erreur-test provoque une erreur (envoyée seulement avec consentement).
if (location.hash === '#erreur-test') setTimeout(() => { throw new Error('Erreur de test Sentry (#erreur-test)'); }, 3000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

registerSW();
