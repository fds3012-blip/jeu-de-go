// Partager l'app elle-même (#521) : « Partager Mochi Go » dans le Profil (à droite du titre), toujours là, et l'invitation discrète
// des moments forts (victoire contre l'ordi, leçon finie, record d'une série par thème).
// Même mécanisme que les autres partages (#75, #287, #364) : feuille native du téléphone (Web Share API), sinon
// « Lien copié » dans le bouton pendant 2 s, annoncé au lecteur d'écran ; sinon le lien à copier à la main.
// Règle de l'invitation : src/app/partageApp.ts (jamais avant la 2e partie finie, ni dans la première minute, au plus
// une fois par semaine). Elle reste une action secondaire : jamais en relief, l'action principale de l'écran ne change pas.
// Mesure : `app_partagee` (`depuis`, `methode`, `abandon`), `app_partage_proposee` (`depuis`). Aucune donnée personnelle.
import { useEffect, useRef, useState } from 'react';
import { EVENTS, secondsSinceOpen, track } from '../data/analytics';
import { partagerApp, type EtatPartageApp as Etat } from '../app/envoiApp';
import { langue } from '../content/i18n';
import { tp } from '../content/i18n/partage';
import { readLocal, writeLocal } from '../app/hooks';
import { PARTIES_KEY, type Parties } from '../app/home';
import { INVITATION_APP_KEY, doitInviter, lienApp, lireDerniere, type DepuisPartage, type MomentFort } from '../app/partageApp';
import { useFile, useTour } from './celebrations';
import { fr } from './typo';
import './partager-app.css';

/** Partage et son état (« Lien copié » 2 s, ou lien à copier à la main). */
function usePartage(depuis: DepuisPartage) {
  const [etat, setEtat] = useState<Etat>('');
  const encours = useRef(false);
  useEffect(() => {
    if (etat !== 'copie') return;
    const id = window.setTimeout(() => setEtat(''), 2000);
    return () => window.clearTimeout(id);
  }, [etat]);
  const lancer = async () => {
    if (encours.current) return;
    encours.current = true;
    try { setEtat(await partagerApp(depuis)); } finally { encours.current = false; }
  };
  return { etat, lancer };
}

/** Zone lue par le lecteur d'écran (toujours présente : seul son texte change), et le lien si la copie a échoué. */
function Retour({ etat }: { etat: Etat }) {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">{etat === 'copie' ? fr(tp('app.copieAnnonce')) : ''}</p>
      {etat === 'manuel' && (
        <div className="partager-app-manuel" role="alert">
          <p>{fr(tp('app.copierManuel'))}</p>
          <input readOnly value={lienApp(langue())} aria-label={tp('app.lienAria')} onFocus={e => e.currentTarget.select()} />
        </div>
      )}
    </>
  );
}

const IconePartager = ({ coche = false }: { coche?: boolean }) => (
  <svg className="partager-app-icone" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
    {coche ? <path d="M5 12.5 10 17l9-10" /> : <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />}
  </svg>
);

/**
 * « Partager Mochi Go » du Profil, à droite du titre, à côté de « Aide » : toujours là, sans prendre de hauteur (le
 * Profil tient sans défiler en 390 × 844). Une action directe : feuille du téléphone, sinon « Lien copié » 2 s.
 * Sous 360 px, l'icône seule (le nom accessible reste « Partager Mochi Go »).
 */
export function BoutonPartagerApp() {
  const { etat, lancer } = usePartage('profil');
  const copie = etat === 'copie';
  return (
    <>
      <button type="button" className={`partager-app-profil${copie ? ' copie' : ''}`} data-testid="partager-app-profil"
        aria-label={tp('app.ligne')} onClick={() => void lancer()}>
        <IconePartager coche={copie} />
        <span className="partager-app-profil-texte" aria-hidden="true">{copie ? tp('app.copie') : tp('app.court')}</span>
      </button>
      <Retour etat={etat} />
    </>
  );
}

/** Invitation discrète : une phrase et un bouton secondaire. Montrée une fois (le repère est posé à l'affichage). */
function Invitation({ depuis }: { depuis: MomentFort }) {
  const { etat, lancer } = usePartage(depuis);
  useEffect(() => {
    writeLocal(INVITATION_APP_KEY, Date.now());
    track(EVENTS.appPartageProposee, { depuis });
  }, [depuis]);
  const copie = etat === 'copie';
  return (
    <aside className="partager-app" aria-label={tp('app.bouton')} data-testid="inviter-app" data-depuis={depuis}>
      <p>{fr(tp('app.invitation'))}</p>
      <button type="button" className={`btn partager-app-bouton${copie ? ' copie' : ''}`} onClick={() => void lancer()}>
        <IconePartager coche={copie} />{copie ? tp('app.copie') : tp('app.bouton')}
      </button>
      <Retour etat={etat} />
    </aside>
  );
}

/** La règle, lue une fois à l'arrivée sur l'écran : l'invitation ne clignote pas d'un rendu à l'autre. */
function useInvitationPermise(): boolean {
  const [ok] = useState(() => doitInviter({
    partiesFinies: readLocal<Parties>(PARTIES_KEY, { n: 0 })?.n ?? 0,
    secondes: secondsSinceOpen(),
    derniere: lireDerniere(readLocal<unknown>(INVITATION_APP_KEY, null)),
    maintenant: Date.now(),
    enPartie: false,
  }));
  return ok;
}

/**
 * Invitation d'un moment fort. `file` : l'écran a d'autres propositions (fin de partie : installation, rappel) ;
 * l'invitation passe alors par la file des célébrations, en dernier, et ne vient pas si une autre est passée sur l'écran.
 */
export function InviterApp({ depuis, file = false }: { depuis: MomentFort; file?: boolean }) {
  const permise = useInvitationPermise();
  return file ? <InviterDansFile depuis={depuis} permise={permise} /> : permise ? <Invitation depuis={depuis} /> : null;
}

function InviterDansFile({ depuis, permise }: { depuis: MomentFort; permise: boolean }) {
  const f = useFile();
  // Une autre proposition (installation, rappel) est passée ou attend : une seule proposition par écran. Une fois
  // l'invitation montrée, elle reste (rien ne clignote) ; le rappel attendra une autre fin de partie.
  const [autre, setAutre] = useState(false);
  const [montree, setMontree] = useState(false);
  const autreEnFile = [f.actif, ...f.attente].some(x => x?.genre === 'installation' || x?.genre === 'rappel');
  useEffect(() => { if (autreEnFile && !montree) setAutre(true); }, [autreEnFile, montree]);
  const tour = useTour('partage', permise && !autre && !(autreEnFile && !montree));
  useEffect(() => { if (tour) setMontree(true); }, [tour]);
  return tour || montree ? <Invitation depuis={depuis} /> : null;
}
