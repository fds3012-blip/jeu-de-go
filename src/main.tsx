// En premier : le jeton d'un défi par lien (#81) quitte l'adresse avant la mesure et tout événement (constat E14).
import './app/adresseDefi';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Styles des écrans chargés à la demande (src/app/ecrans.ts) : importés ici, avant App et dans l'ordre
// d'origine, pour qu'ils restent dans la feuille principale, à la même place qu'avant (rendu identique).
// Un nouvel écran peut importer sa propre feuille : elle arrivera avec son code.
import './ui/board.css';
import './ui/partie.css';
import './ui/comptage.css';
import './ui/fin.css';
import './ui/installation.css';
import './ui/conseil.css';
import './ui/revue.css';
import './ui/apprendre.css';
import './ui/gel.css';
import './ui/pastille-xp.css';
import './ui/course.css';
import './ui/import.css';
import './ui/niveau.css';
import './ui/placement.css';
import './ui/defis.css';
import './ui/compte.css';
import { App } from './app/App';
import { apresPremierEcran, prechargerEcrans, prechargerPartie, rechargerPourNouvelleVersion } from './app/ecrans';
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

prechargerPartie();
// Après le premier écran et ses polices (sinon, sur un réseau lent, ils se disputent la bande passante) :
// le service worker met l'app en cache et les autres écrans se téléchargent quand le navigateur est libre.
apresPremierEcran(() => {
  registerSW();
  prechargerEcrans();
});
// Morceau JS introuvable (nouvelle version déployée pendant que l'app était ouverte) : on recharge une fois.
window.addEventListener('vite:preloadError', event => {
  if (rechargerPourNouvelleVersion()) event.preventDefault();
});
