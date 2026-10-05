// Feuille « Partager » du bilan (#364, « partager pour recruter ») : posée sur la revue, qui reste montée dessous.
// Quatre façons de partager, chacune d'un toucher :
// - « Envoyer le lien » : la partie devient lisible par son seul lien (`mochi-go.app/partie#JETON`), revue en lecture
//   seule sans compte (src/app/PartiePartagee.tsx). Compte avec pseudo exigé (serveur : `partager_partie`) ;
// - « Image du moment clé » : 1200 × 630, dessinée sur l'appareil (imagePartie.ts) ; partage natif du fichier, sinon
//   téléchargement ;
// - « Fichier SGF » : la partie, téléchargée (`adversaire-date.sgf`), hors ligne ;
// - « Défier un ami » : un défi par lien (#81) dont le lien court ouvre la partie chez l'ami (`mochi-go.app/defi#…`).
// Web Share API d'abord ; repli : copie dans le presse-papiers, sinon lien à copier à la main, ou téléchargement.
// Mesure : `partage_ouvert`, `partage_envoye` (objet, moyen), `partage_echoue` (objet, raison). Jamais le lien, le
// jeton, la partie ni le pseudo.
import { useEffect, useId, useRef, useState } from 'react';
import type { Color } from '../go/rules';
import { positionsDepuisSgf } from './revue';
import { useSupabase } from '../data/client';
import { useOnline, usePseudo, useSession } from './hooks';
import { compteDe, creerDefi, lienDefi } from '../data/defi';
import { publierPartie, retirerPartie } from '../data/partage';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { tp, type ClePartage } from '../content/i18n/partage';
import { adversairePublic, lienPartie, nomFichierImage, nomFichierSgf, originePartage, partageable, sgfAvecCamps, sgfPublic } from './partage';
import { fr } from '../ui/typo';
import '../ui/partage.css';

export type ModePartage = 'ordi' | 'deux' | 'import' | 'defi' | 'direct';
type Objet = 'lien' | 'image' | 'sgf' | 'defi';
type Moyen = 'web_share' | 'copie' | 'manuel' | 'telechargement';

interface Props {
  sgf: string;
  /** Camp du joueur (contre l'ordi : Noir) ; null : partie à deux. */
  joueur: Color | null;
  /** Nom de l'adversaire (échelle) ou pseudo de l'ami. */
  adversaire?: string;
  /** Coup du moment clé (0 : aucun, l'image montre la fin). */
  coup: number;
  mode: ModePartage;
  onFermer: () => void;
}

type Etat = { quoi: 'repos' } | { quoi: 'cours'; objet: Objet } | { quoi: 'fait'; objet: Objet; moyen: Moyen | 'annule'; lien?: string }
  | { quoi: 'erreur'; cle: ClePartage } | { quoi: 'prive' };

/** Partage natif d'un lien ; sinon copie ; sinon lien à copier à la main. `annule` : feuille fermée par le joueur. */
async function partagerLien(url: string, titre: string, texte: string): Promise<Moyen | 'annule'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titre, text: texte, url });
      return 'web_share';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
    }
  }
  try {
    await navigator.clipboard.writeText(`${texte} ${url}`);
    return 'copie';
  } catch {
    return 'manuel';
  }
}

/** Partage natif d'un fichier quand l'appareil le sait ; sinon téléchargement. */
async function partagerFichier(fichier: File, titre: string): Promise<Moyen | 'annule'> {
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre });
      return 'web_share';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url; a.download = fichier.name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'telechargement';
}

export function PartagePartie({ sgf, joueur, adversaire, coup, mode, onFermer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const db = useSupabase();
  const session = useSession(db);
  const compteId = compteDe(session);
  const pseudo = usePseudo(db ?? null, compteId);
  const online = useOnline();
  const [etat, setEtat] = useState<Etat>({ quoi: 'repos' });
  const jeton = useRef<string | null>(null);
  const lienDuDefi = useRef<string | null>(null);
  const compte = !!db && !!compteId && !!pseudo;
  const lang = langue();
  const adv = adversairePublic(adversaire);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    track(EVENTS.partageOuvert, { mode, compte });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const noter = (objet: Objet, moyen: Moyen | 'annule') => {
    if (moyen !== 'annule') track(EVENTS.partageEnvoye, { objet, moyen, mode });
    setEtat({ quoi: 'fait', objet, moyen });
  };
  const echec = (objet: Objet, cle: ClePartage, raison: string) => {
    track(EVENTS.partageEchoue, { objet, raison, mode });
    setEtat({ quoi: 'erreur', cle });
  };
  const occupe = etat.quoi === 'cours';

  async function lien() {
    if (!db || occupe) return;
    setEtat({ quoi: 'cours', objet: 'lien' });
    if (!jeton.current) {
      let pub;
      try { pub = sgfPublic(sgf); } catch { echec('lien', 'partage.erreur.illisible', 'illisible'); return; }
      if (!partageable(pub.sgf)) { echec('lien', 'partage.erreur.illisible', 'illisible'); return; }
      const r = await publierPartie(db, { sgf: pub.sgf, taille: pub.taille, joueur, adversaire: adv, coup: Math.min(coup, pub.coups) });
      if (!r.ok) {
        const raison = r.raison ?? 'reseau';
        echec('lien', raison === 'jour' || raison === 'plein' || raison === 'illisible' ? `partage.erreur.${raison}` : 'partage.erreur.reseau', raison);
        return;
      }
      jeton.current = r.value;
    }
    const url = lienPartie(jeton.current, lang, originePartage());
    const moyen = await partagerLien(url, tp('partage.titreLien'), adv ? tp('partage.texte', { adversaire: adv }) : tp('partage.texteSans'));
    noter('lien', moyen);
    if (moyen === 'manuel' || moyen === 'copie') setEtat({ quoi: 'fait', objet: 'lien', moyen, lien: url });
  }

  async function image() {
    if (occupe) return;
    setEtat({ quoi: 'cours', objet: 'image' });
    try {
      const { positions, resultat } = positionsDepuisSgf(sgf);
      const k = Math.max(0, Math.min(coup, positions.length - 1));
      const montre = k > 0 ? k : positions.length - 1;
      const p = positions[montre];
      const { noir, blanc } = camps();
      const { creerImage } = await import('./imagePartie');
      const blob = await creerImage({ size: p.size, board: p.board, dernier: p.lastMove ?? null, coup: k, resultat, noir, blanc, langue: lang });
      const fichier = new File([blob], nomFichierImage(adv, new Date()), { type: 'image/png' });
      noter('image', await partagerFichier(fichier, tp('partage.titreLien')));
    } catch {
      echec('image', 'partage.erreur.image', 'canvas');
    }
  }

  async function fichierSgf() {
    if (occupe) return;
    // La partie seule (coups, taille, komi, règles, handicap, résultat) et le nom des deux camps : ni commentaire ni date.
    let texte = sgf;
    try { texte = sgfAvecCamps(sgfPublic(sgf).sgf, camps()); } catch { /* SGF illisible : le fichier tel quel */ }
    const fichier = new File([texte], nomFichierSgf(adv, new Date()), { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(fichier);
    const a = document.createElement('a');
    a.href = url; a.download = fichier.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    noter('sgf', 'telechargement');
  }

  async function defi() {
    if (!db || occupe) return;
    setEtat({ quoi: 'cours', objet: 'defi' });
    const nouveau = !lienDuDefi.current;
    if (!lienDuDefi.current) {
      const r = await creerDefi(db);
      if (!r.ok) { echec('defi', 'partage.erreur.reseau', 'reseau'); return; }
      lienDuDefi.current = lienDefi(r.value.jeton, originePartage(), pseudo, lang);
    }
    const moyen = await partagerLien(lienDuDefi.current, tp('partage.defi'), tp('partage.defiAide'));
    // Jamais le lien ni le jeton (constat E14). `depuis` : le défi vient du bilan, pas de l'écran des défis.
    if (nouveau) track(EVENTS.defiCree, { partage: moyen, anonyme: false, depuis: 'bilan' });
    noter('defi', moyen);
    if (moyen === 'manuel' || moyen === 'copie') setEtat({ quoi: 'fait', objet: 'defi', moyen, lien: lienDuDefi.current });
  }

  async function rendrePrive() {
    if (!db || !jeton.current || occupe) return;
    const r = await retirerPartie(db, jeton.current);
    if (r.ok) {
      jeton.current = null;
      track(EVENTS.partageRetire, { mode });
      setEtat({ quoi: 'prive' });
    } else setEtat({ quoi: 'erreur', cle: 'partage.erreur.reseau' });
  }

  /** Nom des deux camps : ton pseudo (sinon « Noir » / « Blanc »), l'adversaire de l'échelle ou le pseudo de l'ami. */
  function camps(): { noir: string; blanc: string } {
    const moi = pseudo ?? null;
    return {
      noir: (joueur === 1 ? moi : joueur === 2 ? adv : null) ?? tp('image.noir'),
      blanc: (joueur === 2 ? moi : joueur === 1 ? adv : null) ?? tp('image.blanc'),
    };
  }

  const enCours = (o: Objet) => etat.quoi === 'cours' && etat.objet === o;
  const choix = (o: Objet, titre: ClePartage, aide: string, faire: () => void, desactive = false) => (
    <li>
      <button type="button" className="btn partage-choix" data-objet={o} onClick={faire} disabled={desactive || occupe} aria-busy={enCours(o)}>
        <span className="partage-choix-titre">{tp(enCours(o) ? 'partage.cours' : titre)}</span>
        <span className="partage-choix-aide">{fr(aide)}</span>
      </button>
    </li>
  );
  const message = etat.quoi === 'fait'
    ? etat.moyen === 'copie' ? tp('partage.copie') : etat.moyen === 'manuel' ? tp('partage.copierManuel')
      : etat.moyen === 'telechargement' ? tp('partage.telecharge') : etat.moyen === 'web_share' ? tp('partage.envoye') : ''
    : etat.quoi === 'erreur' ? tp(etat.cle) : etat.quoi === 'prive' ? tp('partage.priveFait') : '';
  const enLigne = online;

  return (
    <dialog ref={ref} className="partage" aria-labelledby={`${id}-titre`} onClose={onFermer}
      onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="partage-feuille">
        <div className="partage-tete">
          <h2 id={`${id}-titre`} tabIndex={-1}>{tp('partage.titre')}</h2>
          <button type="button" className="lien partage-fermer" onClick={() => ref.current?.close()}>{tp('partage.fermer')}</button>
        </div>
        <ul className="partage-choix-liste">
          {compte && enLigne && choix('lien', 'partage.lien', tp('partage.lienAide'), () => { void lien(); })}
          {choix('image', 'partage.image', coup > 0 ? tp('partage.imageAide', { coup }) : tp('partage.imageAideDebut'), () => { void image(); })}
          {choix('sgf', 'partage.sgf', tp('partage.sgfAide'), () => { void fichierSgf(); })}
          {compte && enLigne && choix('defi', 'partage.defi', tp('partage.defiAide'), () => { void defi(); })}
        </ul>
        {!enLigne && <p className="partage-note">{fr(tp('partage.horsLigne'))}</p>}
        {enLigne && !!db && !compte && session !== undefined && (!compteId || pseudo !== undefined) && <p className="partage-note">{fr(tp('partage.compte'))}</p>}
        <p className={`partage-etat${etat.quoi === 'erreur' ? ' erreur' : ''}`} role="status" aria-live="polite">{fr(message)}</p>
        {etat.quoi === 'fait' && etat.lien && (
          <input className="partage-lien-texte" readOnly value={etat.lien} aria-label={tp('partage.copier')} onFocus={e => e.currentTarget.select()} />
        )}
        {jeton.current && etat.quoi !== 'cours' && (
          <button type="button" className="lien partage-prive" onClick={() => { void rendrePrive(); }}>{tp('partage.prive')}</button>
        )}
      </div>
    </dialog>
  );
}
