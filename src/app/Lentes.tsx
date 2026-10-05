// Parties lentes classées (issue #440) : un écran, une seule action principale à la fois.
// - Sans recherche : taille (9 × 9 par défaut, 13, 19) et temps par coup (1 jour par défaut, 2 ou 3) → « Trouver un
//   adversaire ». Un adversaire attendait : la partie s'ouvre. Sinon, la recherche reste ouverte (des heures s'il le
//   faut) : le joueur peut quitter l'écran, l'accueil la montre et dit quand un adversaire est trouvé.
// - Recherche en cours : ce qui est cherché, et « Annuler la recherche » (lien, pas d'action principale).
// - Adversaire trouvé pendant l'absence : « Ouvrir la partie ».
// - Dessous : « Tes parties lentes », d'abord celles où c'est à toi.
// La partie se joue dans DefiPartie (src/app/Defis.tsx) : une partie lente est un défi classé.
// Logique pure : src/app/lente.ts. Données : src/data/lente.ts. Chargé à la demande.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Mochi } from '../ui/Mochi';
import { BasculeEnLigne, type FaconEnLigne } from './BasculeEnLigne';
import { chercherPartieLente, LENTE_DEFAUT, LENTES_MAX, lireRecherche, mesPartiesLentes, quitterFileLente,
  type DelaiJours, type RechercheLente, type RefusLente, type TailleLente } from '../data/lente';
import { lirePseudos, type Pseudos } from '../data/pseudos';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { useOnline } from './hooks';
import { enCours, heuresDepuis, lignesLentes, type LigneLente } from './lente';
import { texteDelai } from './defiAmi';
import { tl, type CleLente } from '../content/i18n/lente';
import { t } from '../content/i18n/secondaires';
import { fr } from '../ui/typo';
import '../ui/defis.css';
import '../ui/direct.css';

const TAILLES: readonly TailleLente[] = [9, 13, 19];
const DELAIS: readonly DelaiJours[] = [1, 2, 3];
/** Relecture de la recherche et des parties tant que l'écran est ouvert. */
export const RELECTURE_LENTES_MS = 30_000;
const ERREURS: Record<RefusLente, CleLente> = {
  compte: 'lente.erreur.compte', limite: 'lente.limite', miseAJour: 'lente.erreur.miseAJour', serveur: 'lente.erreur.serveur',
};
const jours = (n: number) => t('defi.delai.jours', { n });

interface Props {
  db: Db;
  userId: string;
  /** Ouvre une partie lente (DefiPartie). */
  onPartie: (id: string) => void;
  /** « En direct » choisi dans la bascule. */
  onFacon: (f: FaconEnLigne) => void;
  onAccueil: () => void;
}

type Etat = { etat: 'chargement' } | { etat: 'pret'; recherche: RechercheLente | null; lignes: LigneLente[]; pseudos: Pseudos };

export function Lentes({ db, userId, onPartie, onFacon, onAccueil }: Props) {
  const online = useOnline();
  const [taille, setTaille] = useState<TailleLente>(LENTE_DEFAUT.taille);
  const [delai, setDelai] = useState<DelaiJours>(LENTE_DEFAUT.delai);
  const [etat, setEtat] = useState<Etat>({ etat: 'chargement' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [tic, setTic] = useState(0);

  const charger = useCallback(async (pseudos: Pseudos) => {
    const [r, p] = await Promise.all([lireRecherche(db, userId), mesPartiesLentes(db, userId)]);
    const lignes = p.ok ? lignesLentes(p.value, userId) : [];
    await lirePseudos(db, lignes.map(l => l.adversaireId), pseudos);
    return { recherche: r.ok ? r.value : null, lignes, pseudos };
  }, [db, userId]);

  useEffect(() => {
    let vivant = true;
    void charger(etat.etat === 'pret' ? etat.pseudos : new Map()).then(v => { if (vivant) setEtat({ etat: 'pret', ...v }); });
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relue à chaque `tic`, pas à chaque changement d'état
  }, [charger, tic]);
  useEffect(() => {
    const relire = () => { if (document.visibilityState !== 'hidden') setTic(n => n + 1); };
    const id = setInterval(relire, RELECTURE_LENTES_MS);
    document.addEventListener('visibilitychange', relire);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', relire); };
  }, []);

  /** Ouvre une partie qui vient de commencer : mesurée une fois, chez chacun des deux joueurs. */
  const commencer = useCallback((id: string, t: TailleLente, d: DelaiJours, attenteH: number) => {
    track(EVENTS.partieLenteCommencee, { taille: t, delai_jours: d, attente_h: attenteH });
    onPartie(id);
  }, [onPartie]);

  async function chercher() {
    if (envoi) return;
    setEnvoi(true); setErreur(null);
    const r = await chercherPartieLente(db, taille, delai);
    setEnvoi(false);
    if (!r.ok) { setErreur(tl(ERREURS[r.error])); return; }
    if (r.value) { commencer(r.value, taille, delai, 0); return; }
    setTic(n => n + 1);
  }

  async function quitter(recherche: RechercheLente) {
    if (envoi) return;
    setEnvoi(true); setErreur(null);
    const r = await quitterFileLente(db);
    setEnvoi(false);
    if (!r.ok) { setErreur(tl(ERREURS[r.error])); return; }
    // Un adversaire est arrivé entre-temps : on ouvre la partie au lieu d'annuler.
    if (r.value) { commencer(r.value, recherche.taille, recherche.delai, heuresDepuis(recherche.depuis)); return; }
    setTic(n => n + 1);
  }

  const pret = etat.etat === 'pret' ? etat : null;
  const recherche = pret?.recherche ?? null;
  const limite = !!pret && enCours(pret.lignes) >= LENTES_MAX;

  let haut: ReactNode;
  if (!pret) {
    haut = <p className="muted small" aria-busy="true">{tl('lente.chargement')}</p>;
  } else if (recherche?.partieId) {
    haut = (
      <div className="lente-recherche card" data-testid="lente-trouvee">
        <p className="lente-recherche-titre" role="status">{tl('lente.trouve.titre')}</p>
        <button type="button" className="btn primary defis-cta" onClick={() => quitter(recherche)} disabled={envoi}>{tl('lente.trouve.ouvrir')}</button>
      </div>
    );
  } else if (recherche) {
    haut = (
      <div className="lente-recherche card" data-testid="lente-recherche">
        <div className="lente-recherche-tete">
          <Mochi size={40} />
          <p className="lente-recherche-titre" role="status">{fr(tl('lente.recherche.titre'))}</p>
        </div>
        <p className="small">{fr(tl('lente.recherche.texte'))}</p>
        <p className="muted small">{tl('lente.recherche.rappel', { taille: recherche.taille, delai: jours(recherche.delai) })}</p>
        <button type="button" className="lien" onClick={() => quitter(recherche)} disabled={envoi || !online}>{tl('lente.recherche.annuler')}</button>
      </div>
    );
  } else {
    haut = (
      <>
        <p className="direct-intro">{fr(tl('lente.intro'))}</p>
        <p className="muted small direct-classee">{fr(tl('lente.classee'))}</p>
        <Segment titre={tl('lente.taille')} valeurs={TAILLES} valeur={taille} libelle={n => `${n} × ${n}`} onChoix={setTaille} />
        <Segment titre={tl('lente.delai')} valeurs={DELAIS} valeur={delai} libelle={jours} onChoix={setDelai}
          aide={fr(tl('lente.delai.aide', { delai: jours(delai) }))} />
        {limite && <p className="card small" role="status">{fr(tl('lente.limite'))}</p>}
        {!online && <p className="card small" role="status">{fr(tl('lente.horsLigne'))}</p>}
        <button type="button" className="btn primary defis-cta" onClick={chercher} disabled={!online || envoi || limite} aria-busy={envoi}>
          {tl('lente.chercher')}
        </button>
      </>
    );
  }

  return (
    <div className="direct lentes" data-testid="lentes">
      <div className="direct-tete">
        <button type="button" className="retour" onClick={onAccueil} aria-label={tl('lente.retour')}>‹</button>
        <h2>{tl('lente.titre')}</h2>
      </div>
      <BasculeEnLigne valeur="lente" onChoix={onFacon} />
      {haut}
      {erreur && <p className="small defi-erreur" role="alert">{fr(erreur)}</p>}
      {pret && <ListeLentes lignes={pret.lignes} pseudos={pret.pseudos} onPartie={onPartie} />}
    </div>
  );
}

/** Segment de choix (taille, délai) : boutons à bascule, 44 px. */
function Segment<T extends number>({ titre, valeurs, valeur, libelle, onChoix, aide }: {
  titre: string; valeurs: readonly T[]; valeur: T; libelle: (v: T) => string; onChoix: (v: T) => void; aide?: ReactNode;
}) {
  const id = `lente-${titre.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="direct-choix-groupe" role="group" aria-labelledby={id}>
      <h3 id={id}>{titre}</h3>
      <div className="seg">
        {valeurs.map(v => <button key={v} type="button" aria-pressed={valeur === v} onClick={() => onChoix(v)}>{libelle(v)}</button>)}
      </div>
      {aide && <p className="muted small">{aide}</p>}
    </div>
  );
}

/** « Tes parties lentes » : d'abord celles où c'est à toi (point d'or), puis les autres, puis les dernières finies. */
function ListeLentes({ lignes, pseudos, onPartie }: { lignes: LigneLente[]; pseudos: Pseudos; onPartie: (id: string) => void }) {
  if (!lignes.length) return <p className="muted small">{tl('lente.vide')}</p>;
  return (
    <section className="defis-liste" aria-labelledby="lentes-liste-titre">
      <h2 id="lentes-liste-titre">{tl('lente.tesParties')}</h2>
      <ul>
        {lignes.map(l => {
          const nom = (l.adversaireId && pseudos.get(l.adversaireId)) || tl('lente.adversaire');
          const delai = l.restant === null ? '' : texteDelai(l.restant);
          const etat = l.phase === 'fini' ? tl('lente.ligne.finie') : l.phase === 'comptage' ? tl('lente.ligne.comptage')
            : l.aMoi ? tl('lente.ligne.aToi', { delai }) : tl('lente.ligne.aLui', { nom, delai });
          return (
            <li key={l.partieId}>
              <button type="button" className={`defi-ligne${l.aMoi ? ' a-moi' : ''}`} onClick={() => onPartie(l.partieId)}
                aria-label={tl('lente.ligne.aria', { nom, etat })}>
                <span className="defi-ligne-texte">
                  <span className="defi-ligne-haut"><b className="defi-ligne-nom">{nom}</b><span className="defi-ligne-date">{l.taille} × {l.taille}</span></span>
                  <small>{fr(etat)}</small>
                </span>
                {l.aMoi && <span className="defi-point lente-point" aria-hidden="true" />}
                <span className="defi-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
