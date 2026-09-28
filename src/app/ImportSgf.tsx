// Analyser une partie jouée ailleurs (issue #286) : OGS, Fox, KGS. Action secondaire, ouverte depuis le Profil
// ou depuis la revue, jamais depuis l'accueil du débutant.
// Trois étapes : le SGF (fichier ou texte collé), le camp du joueur, puis la revue existante (courbe, moment clé,
// erreurs, « Rejoue cette erreur »). Rien ne part au serveur : la partie est gardée sur l'appareil (REVUE_KEY).
// Logique pure : src/go/importSgf.ts.
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Revue } from './Revue';
import { readLocal } from './hooks';
import { REVUE_KEY, type PartieGardee } from './revue';
import { campDuPseudo, decoderSgf, importerSgf, MAX_COUPS, MAX_OCTETS, type Import } from '../go/importSgf';
import type { GameRecord } from '../go/sgf';
import type { Color } from '../go/rules';
import { EVENTS, track } from '../data/analytics';
import { nombre, t } from '../content/i18n';
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
    default: return t(`import.erreur.${r.raison}`);
  }
}

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
  const fichier = useRef<HTMLInputElement>(null);
  const ids = useId();

  function aller(e: Etape) { setEtape(e); window.scrollTo?.({ top: 0 }); }

  function lire(contenu: string, octets: number, source: 'fichier' | 'texte') {
    const r = importerSgf(contenu, octets);
    if (!r.ok) { setErreur(messageRefus(r)); return; }
    setErreur(null);
    track(EVENTS.sgfImporte, { octets, coups: r.coups, taille: r.partie.size, source, handicap: r.partie.handicap ?? 0 });
    setCamp(campDuPseudo(r.partie, pseudo));
    aller({ nom: 'camp', lue: r });
  }

  async function choisirFichier(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_OCTETS) { setErreur(t('import.erreur.trop-gros')); return; }
    try {
      const octets = new Uint8Array(await f.arrayBuffer());
      lire(decoderSgf(octets), octets.length, 'fichier');
    } catch { setErreur(t('import.erreur.lecture')); }
  }

  function analyser(lue: Lue, joueur: Color) {
    const adversaire = joueur === 1 ? lue.partie.white : lue.partie.black;
    try {
      localStorage.setItem(REVUE_KEY, JSON.stringify({ sgf: lue.sgf, adversaire, date: new Date().toISOString(), importee: true, joueur } satisfies PartieGardee));
    } catch { /* stockage indisponible : la revue s'ouvre quand même */ }
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
        <button type="button" className="back retour" onClick={() => aller({ nom: 'saisie' })}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
        </button>
        <h2 id={`${ids}-camp`}>{t('import.camp.titre')}</h2>
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
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
      </button>
      <h2 id={`${ids}-titre`}>{t('import.titre')}</h2>
      <p className="import-intro">{fr(t('import.intro'))}</p>
      <label className="btn import-fichier">
        <input ref={fichier} className="sr-only" type="file" accept=".sgf,application/x-go-sgf,text/plain" onChange={choisirFichier} />
        {t('import.fichier')}
      </label>
      <label className="import-ou" htmlFor={`${ids}-texte`}>{t('import.ou')}</label>
      <textarea id={`${ids}-texte`} className="import-texte" value={texte} rows={6} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        placeholder="(;GM[1]FF[4]SZ[19]…" aria-describedby={erreur ? `${ids}-erreur` : undefined} aria-invalid={erreur ? true : undefined}
        onChange={e => { setTexte(e.target.value); setErreur(null); }} />
      {erreur && <p id={`${ids}-erreur`} className="import-erreur" role="alert">{fr(erreur)}</p>}
      {derniere && (
        <button type="button" className="lien import-derniere" onClick={() => {
          const r = importerSgf(derniere.sgf);
          if (r.ok) aller({ nom: 'revue', lue: r, joueur: derniere.joueur });
        }}>{t('import.derniere')}</button>
      )}
      <div className="dock">
        <button type="button" className="cta" onClick={() => lire(texte, new TextEncoder().encode(texte).length, 'texte')}>{t('import.lire')}</button>
      </div>
    </section>
  );
}
