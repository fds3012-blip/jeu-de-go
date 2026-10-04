// Cote de jeu (issue #417) : carte du Profil (cote, grade, courbe de 30 jours, point de départ), gain animé en fin de
// partie classée (« +14 », fête au changement de grade) et ligne de l'adversaire. Chargé avec le Profil et l'écran
// de partie (morceaux à la demande) : rien dans le JS initial.
// La cote n'apparaît jamais dans les problèmes ni les leçons (décision #137, src/app/sansCote.test.ts).
import { useEffect, useId, useState } from 'react';
import {
  DEPARTS, KYU_CLUB_DEFAUT, KYUS_CLUB, changementGrade, coteDepart, texteGrade, gradeClub, type Depart
} from '../go/cote';
import { chargerMaCote, choisirDepart, gainDePartie, type GainPartie, type MaCote, type PointCourbe } from '../data/cote';
import type { Db } from '../data/supabase';
import { grade, tc, texteCote, texteEcart } from '../content/i18n/cote';
import { langue } from '../content/i18n';
import { fr } from './typo';
import { mouvementsReduits, useDefilement } from './defilement';
import { Confettis } from './Confettis';
import './cote.css';

/** Kyu et dan expliqués une fois (#417) : la phrase s'affiche tant qu'elle n'a pas été vue. */
const VOCABULAIRE_KEY = 'go.cote-vocabulaire.v1';
function vocabulaireAVoir(): boolean {
  try { return localStorage.getItem(VOCABULAIRE_KEY) !== '1'; } catch { return true; }
}
function vocabulaireVu(): void {
  try { localStorage.setItem(VOCABULAIRE_KEY, '1'); } catch { /* stockage bloqué : la phrase reviendra, sans gêne */ }
}
/** La phrase sur kyu et dan, la première fois seulement (marquée vue dès qu'elle est montrée). */
function useVocabulaire(montrer: boolean): boolean {
  const [voir] = useState(vocabulaireAVoir);
  useEffect(() => { if (montrer && voir) vocabulaireVu(); }, [montrer, voir]);
  return montrer && voir;
}

/** Courbe de la cote (30 jours) : SVG léger, une ligne, le dernier point marqué. */
export function Courbe({ points, actuelle }: { points: readonly PointCourbe[]; actuelle: number }) {
  const valeurs = [...points.map(p => p.cote), actuelle];
  if (points.length < 1) return <p className="cote-courbe-vide muted small">{tc('cote.courbe.vide')}</p>;
  const L = 300, H = 64, M = 6;
  const min = Math.min(...valeurs), max = Math.max(...valeurs);
  // Au moins un grade de hauteur : une courbe plate reste plate, sans exagérer 3 points d'écart.
  const bas = Math.min(min, (min + max) / 2 - 50), haut = Math.max(max, (min + max) / 2 + 50);
  const x = (i: number) => M + (i * (L - 2 * M)) / Math.max(1, valeurs.length - 1);
  const y = (v: number) => H - M - ((v - bas) * (H - 2 * M)) / (haut - bas);
  const d = valeurs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="cote-courbe">
      <figcaption className="muted small">{tc('cote.courbe.titre')}</figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" data-testid="cote-courbe"
        aria-label={tc('cote.courbe.aria', { debut: valeurs[0], fin: actuelle })}>
        <path d={d} className="cote-courbe-ligne" vectorEffect="non-scaling-stroke" />
        <circle cx={x(valeurs.length - 1)} cy={y(actuelle)} r="3.5" className="cote-courbe-point" />
      </svg>
    </figure>
  );
}

/** Grande cote et grade, « 1200 ? » tant qu'elle est provisoire. */
function Chiffre({ cote }: { cote: MaCote }) {
  const g = grade(cote.cote);
  return (
    <p className="cote-chiffre" data-testid="cote-chiffre">
      <span className="sr-only">{tc(cote.provisoire ? 'cote.ariaProvisoire' : 'cote.aria', { cote: cote.cote, grade: g })}</span>
      <span className="cote-nombre" aria-hidden="true">{texteCote(cote.cote, cote.provisoire)}</span>
      <span className="cote-grade" aria-hidden="true">{g}</span>
    </p>
  );
}

/**
 * Sous-vue « Ta cote » du Profil. Une seule action principale :
 * avant la première partie classée, le choix du départ ; ensuite, rien à faire, la cote se lit.
 */
export function CarteCote({ db, userId, onChange }: { db: Db; userId: string; onChange?: () => void }) {
  const [etat, setEtat] = useState<{ etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; cote: MaCote; courbe: PointCourbe[] }>({ etat: 'chargement' });
  const [cle, setCle] = useState(0);
  useEffect(() => {
    let vivant = true;
    void chargerMaCote(db, userId).then(r => { if (vivant) setEtat(r.ok ? { etat: 'pret', ...r.value } : { etat: 'erreur' }); });
    return () => { vivant = false; };
  }, [db, userId, cle]);
  const vocabulaire = useVocabulaire(etat.etat === 'pret');

  if (etat.etat === 'chargement') return <p className="muted" aria-busy="true">{tc('cote.chargement')}</p>;
  if (etat.etat === 'erreur') {
    return (
      <div className="cote-carte">
        <p className="card" role="alert">{fr(tc('cote.erreurChargement'))}</p>
        <button type="button" className="btn" onClick={() => { setEtat({ etat: 'chargement' }); setCle(c => c + 1); }}>{tc('cote.reessayer')}</button>
      </div>
    );
  }
  const { cote, courbe } = etat;
  return (
    <div className="cote-carte" data-testid="cote-carte">
      <Chiffre cote={cote} />
      {vocabulaire && <p className="cote-vocabulaire small" data-testid="cote-vocabulaire">{fr(tc('cote.vocabulaire'))}</p>}
      {cote.provisoire && <p className="muted small">{fr(tc('cote.provisoire'))}</p>}
      <Courbe points={courbe} actuelle={cote.cote} />
      {cote.parties === 0
        ? <ChoixDepart db={db} actuel={cote} onChoisi={() => { setCle(c => c + 1); onChange?.(); }} />
        : cote.depart && <p className="muted small">{fr(tc('cote.depart.fige'))}</p>}
      <p className="muted small cote-regle">{fr(tc('cote.regle'))}</p>
    </div>
  );
}

/** Point de départ : trois choix, et le grade pour « Je joue en club ». */
function ChoixDepart({ db, actuel, onChoisi }: { db: Db; actuel: MaCote; onChoisi: () => void }) {
  const [choix, setChoix] = useState<Depart>(actuel.depart ?? 'regles');
  const [kyu, setKyu] = useState<number>(actuel.depart === 'club' && actuel.departKyu !== null ? actuel.departKyu : KYU_CLUB_DEFAUT);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const idTitre = useId(), idGrade = useId();
  const l = langue();
  const cible = coteDepart(choix, choix === 'club' ? kyu : undefined) ?? 800;
  const deja = actuel.depart === choix && (choix !== 'club' || actuel.departKyu === kyu);

  async function valider() {
    setEnvoi(true); setMessage(null);
    const r = await choisirDepart(db, choix, choix === 'club' ? kyu : undefined);
    setEnvoi(false);
    if (r.ok) { setMessage({ ok: true, texte: tc('cote.depart.choisi', { grade: grade(r.value) }) }); onChoisi(); }
    else setMessage({ ok: false, texte: tc(`cote.erreur.${r.error}`) });
  }

  return (
    <section className="cote-depart" aria-labelledby={idTitre}>
      <h3 id={idTitre}>{fr(tc('cote.depart.titre'))}</h3>
      <p className="muted small">{fr(tc('cote.depart.texte'))}</p>
      <div className="cote-depart-choix" role="group" aria-labelledby={idTitre}>
        {DEPARTS.map(d => {
          const c = coteDepart(d, d === 'club' ? kyu : undefined) ?? 0;
          return (
            <button key={d} type="button" aria-pressed={choix === d} className="cote-depart-option"
              onClick={() => { setChoix(d); setMessage(null); }}>
              <span className="cote-depart-libelle">{tc(`cote.depart.${d}`)}</span>
              {d !== 'club' && <span className="cote-depart-detail">{tc('cote.depart.detail', { grade: grade(c) })}</span>}
            </button>
          );
        })}
      </div>
      {choix === 'club' && (
        <div className="cote-depart-grade">
          <label htmlFor={idGrade}>{tc('cote.depart.grade')}</label>
          <select id={idGrade} value={kyu} onChange={e => { setKyu(Number(e.target.value)); setMessage(null); }}>
            {KYUS_CLUB.map(k => <option key={k} value={k}>{texteGrade(gradeClub(k), l)}</option>)}
          </select>
        </div>
      )}
      <button type="button" className="btn primary cote-depart-valider" onClick={valider} disabled={envoi || deja}>
        {envoi ? tc('cote.depart.envoi') : tc('cote.depart.valider', { grade: grade(cible) })}
      </button>
      {message && <p className={message.ok ? 'cote-ok small' : 'cote-refus small'} role={message.ok ? 'status' : 'alert'}>{fr(message.texte)}</p>}
    </section>
  );
}

/**
 * Kyu et dan expliqués la première fois, sous l'action principale de la fin de partie classée (elle reste visible
 * sans défiler) ; rien si la phrase a déjà été vue (dans le Profil ou ici).
 */
export function VocabulaireGrade() {
  const voir = useVocabulaire(true);
  return voir ? <p className="cote-vocabulaire small" data-testid="cote-vocabulaire">{fr(tc('cote.vocabulaire'))}</p> : null;
}

/** Lit le gain d'une partie classée ; le serveur peut mettre un instant à le compter : quelques relectures. */
function useGain(db: Db, gameId: string, userId: string): GainPartie | null | undefined {
  const [gain, setGain] = useState<GainPartie | null | undefined>(undefined);
  useEffect(() => {
    let vivant = true, essai = 0, minuterie = 0;
    const lire = async () => {
      const g = await gainDePartie(db, gameId, userId);
      if (!vivant) return;
      if (g || essai >= 4) { setGain(g); return; }
      essai++;
      minuterie = window.setTimeout(() => { void lire(); }, 800 * essai);
    };
    void lire();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [db, gameId, userId]);
  return gain;
}

/**
 * Fin de partie classée : « +14 » qui défile (fixe avec les mouvements réduits), la nouvelle cote et son grade ;
 * au changement de grade, « Tu passes 14ᵉ kyu ! » avec des confettis si les célébrations sont activées.
 */
export function GainCote({ db, gameId, userId, celebrer = true }: { db: Db; gameId: string; userId: string; celebrer?: boolean }) {
  const gain = useGain(db, gameId, userId);
  const [anime] = useState(() => !mouvementsReduits());
  const [fete, setFete] = useState(true);
  const affiche = useDefilement(gain?.ecart ?? 0, 700, anime && !!gain);
  if (gain === undefined) return <p className="cote-gain muted small" aria-busy="true">{tc('cote.gain.attente')}</p>;
  if (gain === null) return null;
  const change = changementGrade(gain.avant, gain.apres);
  const sens = gain.ecart > 0 ? 'plus' : gain.ecart < 0 ? 'moins' : 'nul';
  return (
    <div className={`cote-gain${anime ? ' anime' : ''}`} data-testid="cote-gain">
      <p className="sr-only" role="status">{tc('cote.gain.aria', { ecart: texteEcart(gain.ecart), cote: texteCote(gain.apres, gain.provisoire) })}</p>
      <p className="cote-gain-ligne" aria-hidden="true">
        <span className={`cote-gain-ecart ${sens}`} data-testid="cote-ecart">{texteEcart(affiche)}</span>
        <span className="cote-gain-nouvelle">{tc('cote.gain.nouvelle', { cote: texteCote(gain.apres, gain.provisoire) })} · {grade(gain.apres)}</span>
      </p>
      {change && (
        <p className={`cote-gain-grade ${change.sens}`} role="status" data-testid="cote-grade-change">
          {fr(tc(change.sens === 'monte' ? 'cote.monte' : 'cote.descend', { grade: texteGrade(change.grade, langue()) }))}
        </p>
      )}
      {change?.sens === 'monte' && celebrer && anime && fete && <Confettis onFin={() => setFete(false)} />}
    </div>
  );
}
