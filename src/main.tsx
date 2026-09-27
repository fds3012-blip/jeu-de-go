import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// Polices auto-hébergées (@fontsource, sous-ensemble latin) : avant les styles qui les utilisent.
import './ui/fonts.css';
import './ui/app.css';
import { registerSW } from './registerSW';
import { captureError, EVENTS, initAnalytics, track } from './data/analytics';
import { choisirLangue, langue } from './content/i18n';
import { ecouterInstallation } from './app/installation';

// Langue de l'interface (#167) : `<html lang>` suit la langue choisie au chargement.
choisirLangue(langue());

// Invite d'installation de Chrome (#178) : capturée tôt, montrée seulement au bon moment.
ecouterInstallation();
initAnalytics();
track(EVENTS.appOuverte, { installee: window.matchMedia?.('(display-mode: standalone)').matches ?? false });
// Vérification de Sentry : #erreur-test dans l'adresse envoie une erreur de test (seulement avec consentement).
// Envoi explicite, à l'ouverture comme quand on ajoute #erreur-test à une page déjà ouverte (Safari ne recharge pas).
function erreurDeTest() {
  if (location.hash !== '#erreur-test') return;
  captureError(new Error('Erreur de test Sentry (#erreur-test)'));
  history.replaceState(null, '', location.pathname + location.search);
}
erreurDeTest();
window.addEventListener('hashchange', erreurDeTest);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

registerSW();
