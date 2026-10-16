// « Profil de {pseudo} » (issue #560), sous-vue du Profil, chargée à la demande. Ouvert depuis la fin d'une partie en
// ligne, « Mes amis », une demande d'ami ou le bilan de la semaine ; jamais proposé sans compte.
// Ce qu'on voit d'un autre joueur : pseudo, grade et cote arrondie, nombre de parties classées, ses 5 dernières
// parties classées, et le lien d'amitié. Une seule action principale : « Défier » si amis, sinon « Demander en ami »
// (ou l'état de la demande : Annuler, Accepter / Refuser). « Signaler ou bloquer » en secondaire (src/ui/Securite.tsx).
// Données et règles : src/data/profilPublic.ts (le serveur fait foi : rien en cas de blocage, sans le dire).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { profilPublic, type LienAmitie, type PartieClassee, type ProfilPublic as Profil } from '../data/profilPublic';
import { defierAmi, demanderAmi, repondreAmi, retirerAmi } from '../data/amis';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { useOnline } from './hooks';
import { fr } from '../ui/typo';
import { Mochi } from '../ui/Mochi';
import { FeuilleSignaler } from '../ui/Securite';
import { grade, texteCote } from '../content/i18n/cote';
import { langue } from '../content/i18n';
import { tp } from '../content/i18n/profilPublic';
import '../ui/profil-public.css';

/** D'où le profil a été ouvert (événement `profil_public_ouvert`). */
export type DepuisProfil = 'fin_partie' | 'amis' | 'demande' | 'bilan' | 'profil';

interface Props {
  db: Db;
  pseudo: string;
  depuis: DepuisProfil;
  /** Partie créée par « Défier » : l'app l'ouvre avec l'écran du défi. */
  onDefi: (partieId: string) => void;
  /** Un adversaire touché dans ses parties : son profil s'ouvre à son tour. */
  onProfil: (pseudo: string) => void;
}

type Etat = { etat: 'chargement' } | { etat: 'erreur'; texte: string } | { etat: 'indisponible' } | { etat: 'pret'; profil: Profil };

/** Date courte (« 12/10 »), dans la langue de l'interface. */
function dateCourte(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(langue() === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: '2-digit' });
}

export function ProfilPublic({ db, pseudo, depuis, onDefi, onProfil }: Props) {
  const online = useOnline();
  const [etat, setEtat] = useState<Etat>({ etat: 'chargement' });
  const [essai, setEssai] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [aSignaler, setASignaler] = useState(false);
  const note = useRef<string | null>(null);

  useEffect(() => {
    if (!online) return;
    let vivant = true;
    setEtat({ etat: 'chargement' }); setRetour(null);
    void profilPublic(db, pseudo).then(r => {
      if (!vivant) return;
      if (!r.ok) setEtat({ etat: 'erreur', texte: r.error });
      else setEtat(r.value ? { etat: 'pret', profil: r.value } : { etat: 'indisponible' });
    });
    return () => { vivant = false; };
  }, [db, pseudo, online, essai]);

  // Un événement par profil ouvert : d'où, et le lien d'amitié (jamais le pseudo).
  useEffect(() => {
    if (etat.etat !== 'pret' && etat.etat !== 'indisponible') return;
    if (note.current === pseudo) return;
    note.current = pseudo;
    track(EVENTS.profilPublicOuvert, { depuis, lien: etat.etat === 'pret' ? etat.profil.lien : 'indisponible' });
  }, [etat, pseudo, depuis]);

  const recharger = useCallback(() => setEssai(n => n + 1), []);
  const changerLien = (lien: LienAmitie) => setEtat(e => (e.etat === 'pret' ? { etat: 'pret', profil: { ...e.profil, lien } } : e));

  async function agir(action: () => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>, apres: (v: unknown) => void) {
    if (occupe) return;
    setOccupe(true); setRetour(null);
    const r = await action();
    setOccupe(false);
    if (!r.ok) { setRetour({ ok: false, texte: r.error }); return; }
    apres(r.value);
  }

  const demander = () => agir(() => demanderAmi(db, pseudo), v => {
    if (v === 'amis') { track(EVENTS.amiAjoute, { comment: 'croisee' }); changerLien('amis'); setRetour({ ok: true, texte: tp('joueur.devenusAmis', { pseudo }) }); }
    else { changerLien('envoyee'); setRetour({ ok: true, texte: tp('joueur.envoyee') }); }
  });
  const annuler = () => agir(() => retirerAmi(db, pseudo), () => changerLien('aucun'));
  const repondre = (accepter: boolean) => agir(() => repondreAmi(db, pseudo, accepter), v => {
    if (v === 'amis') { track(EVENTS.amiAjoute, { comment: 'acceptation' }); changerLien('amis'); setRetour({ ok: true, texte: tp('joueur.devenusAmis', { pseudo }) }); }
    else changerLien('aucun');
  });
  const defier = () => agir(() => defierAmi(db, pseudo), v => {
    // Jamais le pseudo ni la partie dans l'événement.
    track(EVENTS.defiDepuisProfil, {});
    onDefi(String(v));
  });

  if (!online) return <p className="card small" role="status">{fr(tp('joueur.horsLigne'))}</p>;
  if (etat.etat === 'chargement') return <p className="muted small joueur-chargement" aria-busy="true">{tp('joueur.chargement')}</p>;
  if (etat.etat === 'erreur') {
    return (
      <div className="joueur-etat" role="alert">
        <p className="joueur-etat-titre">{fr(etat.texte)}</p>
        <button type="button" className="btn" onClick={recharger}>{tp('joueur.reessayer')}</button>
      </div>
    );
  }
  if (etat.etat === 'indisponible') {
    return (
      <div className="joueur-etat" data-testid="joueur-indisponible" role="status">
        <Mochi size={56} />
        <p className="joueur-etat-titre">{fr(tp('joueur.indisponible'))}</p>
        <p className="muted small">{fr(tp('joueur.indisponibleAide'))}</p>
      </div>
    );
  }

  const p = etat.profil;
  const nom = p.pseudo;
  const bloque = occupe || !online;
  const etatTexte = retour
    ? <p className={`joueur-action-etat small${retour.ok ? ' ok' : ' erreur'}`} role={retour.ok ? 'status' : 'alert'}>{fr(retour.texte)}</p>
    : null;

  return (
    <div className="joueur" data-testid="profil-public" data-lien={p.lien}>
      <section className="joueur-carte" aria-label={tp('joueur.titre', { pseudo: nom })}>
        <span className="joueur-initiale" aria-hidden="true">{nom.slice(0, 1).toUpperCase()}</span>
        <div className="joueur-texte">
          <p className="joueur-pseudo">{nom}</p>
          <p className="joueur-cote">
            <span className="joueur-grade">{grade(p.cote)}</span>
            <span className="joueur-cote-nombre">{texteCote(p.cote, p.provisoire)}</span>
          </p>
          <p className="joueur-classees">{p.partiesClassees > 0 ? tp('joueur.classees', { n: p.partiesClassees }) : tp('joueur.aucuneClassee')}</p>
        </div>
        {p.parties.length > 0 && (
          <span className="joueur-bande" aria-hidden="true">
            {p.parties.map((x, i) => (
              <span key={i} className={`stone ${x.couleur === 'noir' ? 'b' : 'w'}${x.gagnee === true ? ' gagnee' : x.gagnee === false ? ' perdue' : ''}`} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
        )}
      </section>

      <div className="joueur-action" data-testid="joueur-action">
        {p.lien === 'amis' && (
          <>
            <button type="button" className="btn primary" disabled={bloque} aria-busy={occupe} onClick={defier}>{tp(occupe ? 'defi.joueur.creation' : 'defi.joueur.defier', { pseudo: nom })}</button>
            {etatTexte ?? <p className="joueur-regle">{fr(tp('defi.joueur.regle'))}</p>}
          </>
        )}
        {p.lien === 'aucun' && (
          <>
            <button type="button" className="btn primary" disabled={bloque} aria-busy={occupe} onClick={demander}>{tp(occupe ? 'joueur.envoi' : 'joueur.demander')}</button>
            {etatTexte}
          </>
        )}
        {p.lien === 'envoyee' && (
          <>
            <p className="joueur-action-etat ok" role="status">{fr(retour?.ok ? retour.texte : tp('joueur.envoyee'))}</p>
            {retour && !retour.ok && etatTexte}
            <button type="button" className="lien joueur-secondaire" disabled={bloque} onClick={annuler}>{tp('joueur.annuler')}</button>
          </>
        )}
        {p.lien === 'recue' && (
          <>
            <p className="joueur-action-etat">{fr(tp('joueur.recue', { pseudo: nom }))}</p>
            <div className="joueur-action-ligne">
              <button type="button" className="btn primary" disabled={bloque} aria-busy={occupe} onClick={() => repondre(true)}>{tp('joueur.accepter')}</button>
              <button type="button" className="lien joueur-secondaire" disabled={bloque} onClick={() => repondre(false)}>{tp('joueur.refuser')}</button>
            </div>
            {etatTexte}
          </>
        )}
        {p.lien === 'moi' && <p className="joueur-action-etat">{fr(tp('joueur.moi'))}</p>}
      </div>

      <section className="joueur-parties" aria-labelledby="joueur-parties-titre">
        <h3 id="joueur-parties-titre">{tp('joueur.dernieres')}</h3>
        {p.parties.length === 0
          ? <p className="joueur-aucune small">{fr(tp('joueur.aucuneClassee'))}</p>
          : (
            <ul className="joueur-liste">
              {p.parties.map((x, i) => <Partie key={i} partie={x} onProfil={onProfil} />)}
            </ul>
          )}
      </section>

      {p.lien !== 'moi' && (
        <>
          <button type="button" className="lien joueur-signaler" onClick={() => setASignaler(true)}>{tp('joueur.signaler', { pseudo: nom })}</button>
          <FeuilleSignaler db={db} ouvert={aSignaler} onFermer={() => setASignaler(false)} compte online={online}
            cible={{ type: 'joueur', nom, pseudo: nom, depuis: 'profil' }}
            // Bloqué : le profil n'est plus disponible, comme le dit le serveur à la relecture.
            onBloque={recharger} />
        </>
      )}
    </div>
  );
}

function Partie({ partie: x, onProfil }: { partie: PartieClassee; onProfil: (pseudo: string) => void }) {
  const resultat = tp(x.gagnee === true ? 'joueur.victoire' : x.gagnee === false ? 'joueur.defaite' : 'joueur.nul');
  return (
    <li className={`joueur-partie${x.gagnee === true ? ' gagnee' : ''}`}>
      <span className={`stone ${x.couleur === 'noir' ? 'b' : 'w'}`} role="img" aria-label={tp(x.couleur === 'noir' ? 'joueur.couleur.noir' : 'joueur.couleur.blanc')} />
      <span className="joueur-partie-texte">
        <span className="joueur-partie-resultat">{resultat}</span>
        <span className="joueur-partie-contre">
          {x.adversaire && !x.toi
            ? <>{tp('joueur.contreMot')} <button type="button" className="lien" aria-label={tp('joueur.ouvrir', { pseudo: x.adversaire })} onClick={() => onProfil(x.adversaire!)}>{x.adversaire}</button></>
            : x.toi ? tp('joueur.contreToi') : tp('joueur.contreUnJoueur')}
        </span>
      </span>
      <span className="joueur-partie-meta"><span>{x.taille} × {x.taille}</span><span>{dateCourte(x.le)}</span></span>
    </li>
  );
}

export default ProfilPublic;
