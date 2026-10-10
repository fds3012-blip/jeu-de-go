// Analyser une partie jouée ailleurs (issue #286) : OGS, Fox, KGS. Action secondaire, ouverte depuis le Profil
// ou depuis la revue, jamais depuis l'accueil du débutant.
// Trois étapes : le SGF (fichier, texte collé ou lien de partie OGS), le camp du joueur, puis la revue existante (courbe, moment clé,
// erreurs, « Rejoue cette erreur »). Rien ne part à nos serveurs : la partie est gardée sur l'appareil (REVUE_KEY).
// Un lien OGS est demandé à OGS directement depuis l'appareil (src/go/ogs.ts) ; en cas de refus, on propose le fichier.
// Logique pure : src/go/importSgf.ts.
import { EnteteEcran } from '../ui/BoutonRetour';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Revue } from './Revue';
import { readLocal } from './hooks';
import { REVUE_KEY, type PartieGardee } from './revue';
import { garderDerniere } from './historique';
import { campDuPseudo, decoderSgf, importerSgf, MAX_COUPS, MAX_OCTETS, type Import } from '../go/importSgf';
import { chargerSgfOgs, idPartieOgs, type RefusOgs } from '../go/ogs';
import type { GameRecord } from '../go/sgf';
import type { Color } from '../go/rules';
import { EVENTS, track } from '../data/analytics';
import { nombre, t } from '../content/i18n/secondaires';
import { fr } from '../ui/typo';
import '../ui/import.css';

/** Visites de KataGo par position : limitées en 19 × 19 pour qu'une partie de 200 coups tienne en moins de 3 minutes. */
function visitesPour(size: number): number {
  return size >= 19 ? 16 : size >= 13 ? 24 : 32;
}

/** Message tutoyé pour un refus. */
function messageRefus(r: Extract<Import, { ok: false }>): string {
  switch (r.raison) {
    case 'taille': return t('import.erreur.taille', { taille: r.taille ?? 0 });
    case 'trop-long': return t('import.erreur.trop-long', { max: MAX_COUPS });
    case 'illegal': return t('import.erreur.illegal', { coup: r.coup ?? 0 });
    case 'coordonnee': return t('import.erreur.coordonnee', { coup: r.coup ?? 0 });
    default: return t(`import.erreur.${r.raison}`);
  }
}

type Source = 'fichier' | 'texte' | 'ogs';
/** Refus propres à l'écran (avant la lecture du SGF) : fichier illisible, lien d'un autre site, OGS injoignable. */
type RefusEcran = 'lecture' | 'lien' | RefusOgs;

/** Un lien, mais pas vers une partie OGS (Fox, KGS, une revue OGS…). */
const estUnLien = (s: string) => /^(https?:\/\/|www\.)\S+$/i.test(s.trim()) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(s.trim());

interface Lue { partie: GameRecord; sgf: string; coups: number }
type Etape = { nom: 'saisie' } | { nom: 'camp'; lue: Lue } | { nom: 'revue'; lue: Lue; joueur: Color };

interface Props {
  onRetour: () => void;
  /** Pseudo du joueur connecté : présélectionne son camp. */
  pseudo?: string | null;
  confirmTouch?: boolean;
}

/** Dernière partie importée gardée sur l'appareil, si c'en est une. */
function derniereImportee(): (PartieGardee & { joueur: Color }) | null {
  const p = readLocal<PartieGardee | null>(REVUE_KEY, null);
  return p && p.importee && typeof p.sgf === 'string' && (p.joueur === 1 || p.joueur === 2) ? { ...p, joueur: p.joueur } : null;
}

export function ImportSgf({ onRetour, pseudo, confirmTouch = false }: Props) {
  const [etape, setEtape] = useState<Etape>({ nom: 'saisie' });
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [camp, setCamp] = useState<Color | null>(null);
  const [ogsEnCours, setOgsEnCours] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);
  const ids = useId();

  function aller(e: Etape) { setEtape(e); window.scrollTo?.({ top: 0 }); }

  function refuser(source: Source, raison: RefusEcran) {
    track(EVENTS.importSgfErreur, { source, raison, coup: null });
    setErreur(t(`import.erreur.${raison}`));
  }

  function lire(contenu: string, octets: number, source: Source) {
    const r = importerSgf(contenu, octets);
    if (!r.ok) {
      track(EVENTS.importSgfErreur, { source, raison: r.raison, coup: r.coup ?? null });
      setErreur(messageRefus(r));
      return;
    }
    setErreur(null);
    track(EVENTS.importSgfReussi, { octets, coups: r.coups, taille: r.partie.size, source, handicap: r.partie.handicap ?? 0 });
    setCamp(campDuPseudo(r.partie, pseudo));
    aller({ nom: 'camp', lue: r });
  }

  async function choisirFichier(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    track(EVENTS.importSgfCommence, { source: 'fichier' });
    if (f.size > MAX_OCTETS) { refuser('fichier', 'trop-gros'); return; }
    let octets: Uint8Array;
    try { octets = new Uint8Array(await f.arrayBuffer()); } catch { refuser('fichier', 'lecture'); return; }
    lire(decoderSgf(octets), octets.length, 'fichier');
  }

  /** « Lire la partie » : texte SGF collé, ou lien de partie OGS demandé à OGS. */
  async function lireTexte() {
    if (ogsEnCours) return;
    const id = idPartieOgs(texte);
    if (id == null) {
      track(EVENTS.importSgfCommence, { source: 'texte' });
      if (estUnLien(texte)) { refuser('texte', 'lien'); return; }
      lire(texte, new TextEncoder().encode(texte).length, 'texte');
      return;
    }
    track(EVENTS.importSgfCommence, { source: 'ogs' });
    setErreur(null);
    setOgsEnCours(true);
    const r = await chargerSgfOgs(id);
    setOgsEnCours(false);
    if (!r.ok) { refuser('ogs', r.raison); return; }
    lire(r.texte, r.octets, 'ogs');
  }

  function analyser(lue: Lue, joueur: Color) {
    const adversaire = joueur === 1 ? lue.partie.white : lue.partie.black;
    try {
      localStorage.setItem(REVUE_KEY, JSON.stringify({ sgf: lue.sgf, adversaire, date: new Date().toISOString(), importee: true, joueur } satisfies PartieGardee));
    } catch { /* stockage indisponible : la revue s'ouvre quand même */ }
    // #358 : la partie importée rejoint aussi « Mes parties » (une même partie importée deux fois n'y est qu'une fois).
    garderDerniere('import');
    aller({ nom: 'revue', lue, joueur });
  }

  if (etape.nom === 'revue') {
    const { lue, joueur } = etape;
    const nomLui = (joueur === 1 ? lue.partie.white : lue.partie.black) ?? t(joueur === 1 ? 'import.camp.blanc' : 'import.camp.noir');
    return (
      <Revue key={lue.sgf} sgf={lue.sgf} joueur={joueur} adversaire={nomLui} confirmTouch={confirmTouch}
        visites={visitesPour(lue.partie.size)} retour={t('import.retour')}
        onRetour={() => aller({ nom: 'saisie' })} onImporter={() => { setTexte(''); aller({ nom: 'saisie' }); }} />
    );
  }

  if (etape.nom === 'camp') {
    const { partie, coups } = etape.lue;
    const propose = campDuPseudo(partie, pseudo);
    const resume = [t('import.resume', { taille: partie.size, n: coups, komi: nombre(partie.komi) }), partie.handicap ? t('import.handicap', { h: partie.handicap }) : null].filter(Boolean).join(' · ');
    return (
      <section className="sous-vue import" aria-labelledby={`${ids}-camp`}>
        <EnteteEcran id={`${ids}-camp`} titre={t('import.camp.titre')} retour={t('profil.retour')} onRetour={() => aller({ nom: 'saisie' })} />
        <p className="import-resume">{fr(resume)}</p>
        <div className="import-camps" role="group" aria-label={t('import.camp.titre')}>
          {([1, 2] as const).map(c => {
            const nom = (c === 1 ? partie.black : partie.white) ?? t('import.inconnu');
            return (
              <button key={c} type="button" className="import-camp" aria-pressed={camp === c} onClick={() => setCamp(c)}>
                <span className={`stone ${c === 1 ? 'b' : 'w'}`} aria-hidden="true" />
                <span className="import-camp-texte">
                  <b>{t(c === 1 ? 'import.camp.noir' : 'import.camp.blanc')}</b>
                  <span className="import-camp-nom">{nom}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="import-aide">{fr(propose && camp === propose ? `${t('import.camp.propose')} ${t('import.camp.aide')}` : t('import.camp.aide'))}</p>
        <p className="import-aide">{fr(t('import.komiAide'))}</p>
        <div className="dock">
          <button type="button" className="cta" disabled={!camp} onClick={() => camp && analyser(etape.lue, camp)}>{t('import.analyser')}</button>
        </div>
      </section>
    );
  }

  const derniere = derniereImportee();
  return (
    <section className="sous-vue import" aria-labelledby={`${ids}-titre`}>
      <EnteteEcran id={`${ids}-titre`} titre={t('import.titre')} retour={t('profil.retour')} onRetour={onRetour} />
      <p className="import-intro">{fr(t('import.intro'))}</p>
      <label className="btn import-fichier">
        <input ref={fichier} className="sr-only" type="file" accept=".sgf,application/x-go-sgf,text/plain" onChange={choisirFichier} disabled={ogsEnCours} />
        {t('import.fichier')}
      </label>
      <label className="import-ou" htmlFor={`${ids}-texte`}>{t('import.ou')}</label>
      <textarea id={`${ids}-texte`} className="import-texte" value={texte} rows={6} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        placeholder="(;GM[1]FF[4]SZ[19]…" aria-describedby={erreur ? `${ids}-erreur` : undefined} aria-invalid={erreur ? true : undefined}
        onChange={e => { setTexte(e.target.value); setErreur(null); }} />
      {erreur && <p id={`${ids}-erreur`} className="import-erreur" role="alert">{fr(erreur)}</p>}
      {ogsEnCours && <p className="import-aide" role="status">{fr(t('import.ogsEnCours'))}</p>}
      {derniere && (
        <button type="button" className="lien import-derniere" onClick={() => {
          const r = importerSgf(derniere.sgf);
          if (r.ok) aller({ nom: 'revue', lue: r, joueur: derniere.joueur });
        }}>{t('import.derniere')}</button>
      )}
      <div className="dock">
        <button type="button" className="cta" aria-busy={ogsEnCours || undefined} disabled={ogsEnCours} onClick={() => { void lireTexte(); }}>{t('import.lire')}</button>
      </div>
    </section>
  );
}
