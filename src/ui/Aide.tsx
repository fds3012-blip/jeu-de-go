// Feuille d'aide (issue #362) : règles en 5 cartes, « Comment on compte ? », glossaire cherchable.
// Boîte de dialogue modale posée par-dessus l'écran, qui reste monté : fermer ramène exactement où l'on était
// (partie, leçon, Profil). Chargée à la demande (App.tsx) : elle ne pèse rien tant qu'on ne l'ouvre pas.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { COMPTER, MOTS, REGLES, type Carte, type Fiche, type Schema } from '../content/aide';
import { LESSONS } from '../content/lessons';
import { langue, t } from '../content/i18n';
import { fromRows } from '../go/position';
import { fromLabel } from '../go/coords';
import { score } from '../go/score';
import { chercherMots } from '../app/glossaire';
import type { Ouverture } from '../app/ouvrirAide';
import { Board, type BoardMarks } from './Board';
import { fr } from './typo';
import './aide.css';

interface Props {
  ouverture: Ouverture;
  onFermer: () => void;
  /** Ouvre une leçon (la feuille se ferme). Absent pendant une partie : on ne quitte pas la partie depuis l'aide. */
  onLecon?: (id: string) => void;
  /** Leçon en cours : son propre lien n'est pas proposé. */
  leconCourante?: string | null;
}

const ONGLETS: Fiche[] = ['regles', 'compter', 'mots'];

/** Texte d'une carte : clés `aide.regle.<id>` et `aide.compter.<id>` (toutes sans variable, vérifié par src/app/glossaire.test.ts). */
const texte = (cle: string) => t(cle as 'aide.titre');

/** Petit plateau d'un schéma, avec ses marques. Décoratif pour les lecteurs d'écran : le texte dit tout. */
function Schema({ s }: { s: Schema }) {
  const { pos, marks } = useMemo(() => {
    const { pos } = fromRows(s.rows);
    const n = pos.size, at = (l: string) => fromLabel(l, n);
    const dead = new Set((s.morts ?? []).map(at));
    const m: BoardMarks = {
      libs: s.libs?.map(at), targets: s.cibles?.map(at),
      ok: s.coup ? at(s.coup) : undefined, mistake: s.interdit ? at(s.interdit) : undefined,
      owner: s.territoire ? score(pos, 0, 'japanese', dead).owner : undefined, dead: dead.size ? dead : undefined,
    };
    return { pos, marks: m };
  }, [s]);
  return (
    <div className="aide-schema" aria-hidden="true" data-taille={pos.size}>
      <Board size={pos.size} board={pos.board} marks={marks} />
    </div>
  );
}

/** Lien « Rejoue la leçon », discret, sous la carte. */
function LienLecon({ id, onLecon }: { id: string; onLecon: (id: string) => void }) {
  const titre = LESSONS.find(l => l.id === id)?.title;
  if (!titre) return null;
  return (
    <button type="button" className="lien aide-lien" aria-label={t('aide.leconAria', { titre })} onClick={() => onLecon(id)}>
      {t('aide.lecon')}
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
    </button>
  );
}

function Cartes<I extends string>({ cartes, cle, intro, lien }: { cartes: Carte<I>[]; cle: 'regle' | 'compter'; intro: string; lien: (id?: string) => ReactNode }) {
  return (
    <>
      <p className="aide-intro">{fr(intro)}</p>
      <ol className="aide-cartes">
        {cartes.map((c, i) => (
          <li key={c.id} className="aide-carte" data-carte={c.id}>
            <h3><span className="aide-num" aria-hidden="true">{i + 1}</span>{fr(texte(`aide.${cle}.${c.id}`))}</h3>
            {c.schema && <Schema s={c.schema} />}
            <p>{fr(texte(`aide.${cle}.${c.id}.texte`))}</p>
            {lien(c.lecon)}
          </li>
        ))}
      </ol>
    </>
  );
}

function Glossaire({ requete, setRequete, lien }: { requete: string; setRequete: (q: string) => void; lien: (id?: string) => ReactNode }) {
  const id = useId();
  const trouves = useMemo(() => chercherMots(requete, langue()), [requete]);
  const parId = useMemo(() => new Map(MOTS.map(m => [m.id, m])), []);
  return (
    <>
      <div className="aide-recherche" role="search">
        <label htmlFor={`${id}-q`} className="aide-recherche-libelle">{t('aide.mots.chercher')}</label>
        <div className="aide-champ">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4.5 4.5" /></svg>
          <input id={`${id}-q`} type="search" value={requete} placeholder={t('aide.mots.exemple')} autoComplete="off" autoCapitalize="none" spellCheck={false}
            enterKeyHint="search" onChange={e => setRequete(e.target.value)} />
          {requete && (
            <button type="button" className="aide-effacer" aria-label={t('aide.mots.effacer')} onClick={() => setRequete('')}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          )}
        </div>
      </div>
      {/* Nombre de résultats lu par les lecteurs d'écran ; à l'écran, la liste parle d'elle-même. */}
      <p className="sr-only" role="status">{requete.trim() ? t('aide.mots.trouves', { n: trouves.length }) : ''}</p>
      {trouves.length === 0
        ? <p className="aide-aucun">{fr(t('aide.mots.aucun', { q: requete.trim() }))}</p>
        : (
          <ul className="aide-mots">
            {trouves.map(m => {
              const mot = parId.get(m)!;
              return (
                <li key={m} className="aide-mot" data-mot={m}>
                  <div className="aide-mot-texte">
                    <h3>{t(`aide.mot.${m}`)}</h3>
                    <p>{fr(t(`aide.mot.${m}.def`))}</p>
                    {lien(mot.lecon)}
                  </div>
                  {mot.schema && <Schema s={mot.schema} />}
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
}

export default function Aide({ ouverture, onFermer, onLecon, leconCourante }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const id = useId();
  const [fiche, setFiche] = useState<Fiche>(ouverture.fiche);
  const [requete, setRequete] = useState(ouverture.mot ? t(`aide.mot.${ouverture.mot}`) : '');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal?.();
    d.querySelector<HTMLElement>(`#${CSS.escape(`${id}-titre`)}`)?.focus();
  }, [id]);

  const choisir = (f: Fiche) => { setFiche(f); corps.current?.scrollTo?.({ top: 0 }); };
  const lien = (lecon?: string) => (lecon && onLecon && lecon !== leconCourante ? <LienLecon id={lecon} onLecon={onLecon} /> : null);

  return (
    <dialog ref={ref} className="aide" aria-labelledby={`${id}-titre`} onClose={onFermer}
      // Échap : `cancel` (le navigateur ferme ensuite la boîte, `close` prévient App).
      // Un toucher sur le voile, hors de la feuille, la ferme aussi.
      onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="aide-feuille">
        <div className="aide-tete">
          <h2 id={`${id}-titre`} tabIndex={-1}>{t('aide.titre')}</h2>
          <button type="button" className="lien aide-fermer" onClick={() => ref.current?.close()}>{t('aide.fermer')}</button>
        </div>
        <div className="seg aide-onglets" role="tablist" aria-label={t('aide.rubriques')}>
          {ONGLETS.map(f => (
            <button key={f} type="button" role="tab" id={`${id}-${f}`} aria-selected={fiche === f} aria-controls={`${id}-panneau`}
              tabIndex={fiche === f ? 0 : -1}
              onKeyDown={e => {
                const i = ONGLETS.indexOf(f), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const g = ONGLETS[(i + d + ONGLETS.length) % ONGLETS.length];
                choisir(g);
                document.getElementById(`${id}-${g}`)?.focus();
              }}
              onClick={() => choisir(f)}>{t(`aide.onglet.${f}`)}</button>
          ))}
        </div>
        <div ref={corps} className="aide-corps" role="tabpanel" id={`${id}-panneau`} aria-labelledby={`${id}-${fiche}`} data-fiche={fiche}>
          {fiche === 'regles' && <Cartes cartes={REGLES} cle="regle" intro={t('aide.regles.intro')} lien={lien} />}
          {fiche === 'compter' && <Cartes cartes={COMPTER} cle="compter" intro={t('aide.compter.intro')} lien={lien} />}
          {fiche === 'mots' && <Glossaire requete={requete} setRequete={setRequete} lien={lien} />}
        </div>
      </div>
    </dialog>
  );
}
