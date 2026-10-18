// « Compter une photo » (#655) : le score d'un vrai goban, à partir d'une photo, sur l'appareil seulement.
// Une étape à la fois, une action principale chacune :
//   photo → coins (4 coins posés sur la grille, taille du plateau) → pierres (corrigées d'un toucher) → pierres mortes
//   (proposées par Mochi, à vérifier) → règle, komi et prisonniers → score expliqué terme par terme.
// La photo n'est jamais envoyée ni gardée : décodée dans un canvas, lue dans un worker (src/app/photoLecture.ts), oubliée
// en quittant l'écran. Le comptage est celui de la fin de partie (src/go/score.ts, via src/go/comptagePhoto.ts).
// Chargé à la demande depuis le Profil : rien dans le JS initial.
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import '../ui/photo-score.css';
import { EnteteEcran } from '../ui/BoutonRetour';
import { Board } from '../ui/Board';
import { Reflexion } from '../ui/Reflexion';
import { fr } from '../ui/typo';
import { score as scoreAffiche } from '../ui/score';
import { nombre } from '../content/i18n';
import { phraseResultat, tph, type ClePhoto } from '../content/i18n/photoScore';
import { compterPhoto, KOMI_USUEL } from '../go/comptagePhoto';
import { appliquer, homographieGrille, quadrilatereValide, type Coins, type Point } from '../go/photo/homographie';
import { coinsParDefaut } from '../go/photo/coins';
import { groupAt, newPosition } from '../go/rules';
import type { Rules } from '../go/score';
import { creerLecteur, ouvrirPhoto, type Lecteur, type PhotoOuverte } from './photoLecture';

type Etape = 'photo' | 'coins' | 'lecture' | 'pierres' | 'mortes' | 'regle' | 'score';
const PRECEDENTE: Record<Etape, Etape | null> = { photo: null, coins: 'photo', lecture: 'coins', pierres: 'coins', mortes: 'pierres', regle: 'mortes', score: 'regle' };
const TAILLES = [9, 13, 19] as const;
/** Attente maximale de la proposition des pierres mortes : au-delà, le joueur les marque seul. */
const DELAI_MORTES_MS = 8000;

/** Position d'exemple de la première étape : un coin de partie, dans le viseur. */
const EXEMPLE = ['.........', '..XO.....', '.XXO..O..', '..XXOO...', '...XO....', '..X.XO.O.', '...XXOO..', '....X....', '.........'];
const EXEMPLE_PLATEAU = Int8Array.from(EXEMPLE.join(''), c => (c === 'X' ? 1 : c === 'O' ? 2 : 0));

/** Une case de plus ou de moins, de 0 à 99 : prisonniers. */
const borner = (n: number) => Math.max(0, Math.min(99, Math.floor(Number.isFinite(n) ? n : 0)));

export default function PhotoScore({ onRetour }: { onRetour: () => void }) {
  const ids = useId();
  const [etape, setEtape] = useState<Etape>('photo');
  const [photo, setPhoto] = useState<PhotoOuverte | null>(null);
  const [ouverture, setOuverture] = useState(false);
  const [erreur, setErreur] = useState<ClePhoto | null>(null);
  const [taille, setTaille] = useState<number>(19);
  const [coins, setCoins] = useState<Coins | null>(null);
  const [proposes, setProposes] = useState(false);
  const [plateau, setPlateau] = useState<Int8Array>(() => new Int8Array(361));
  const [incertaines, setIncertaines] = useState<Set<number>>(new Set());
  const [mortes, setMortes] = useState<Set<number>>(new Set());
  const [estimation, setEstimation] = useState<'attente' | 'faite' | 'rien' | 'echec'>('attente');
  const [regle, setRegle] = useState<Rules>('japanese');
  const [komi, setKomi] = useState(KOMI_USUEL.japanese);
  const [komiChange, setKomiChange] = useState(false);
  const [prisonniers, setPrisonniers] = useState({ noir: 0, blanc: 0 });
  const lecteur = useRef<Lecteur | null>(null);
  const jeton = useRef(0);

  // La photo est oubliée en quittant l'écran : worker arrêté, image libérée.
  useEffect(() => () => { lecteur.current?.fermer(); lecteur.current = null; }, []);

  function aller(e: Etape) { setEtape(e); window.scrollTo?.({ top: 0 }); }
  function retour() {
    const p = PRECEDENTE[etape];
    if (!p) { onRetour(); return; }
    if (p === 'photo') oublierPhoto();
    jeton.current++;
    aller(p);
  }
  function oublierPhoto() { lecteur.current?.fermer(); lecteur.current = null; setPhoto(null); setCoins(null); setErreur(null); }

  async function choisir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const t = ++jeton.current;
    setErreur(null); setOuverture(true);
    try {
      const p = await ouvrirPhoto(f);
      const l = await creerLecteur(p.image);
      if (t !== jeton.current) { l.fermer(); return; }
      lecteur.current?.fermer(); lecteur.current = l;
      setPhoto(p);
      const c = await l.proposerCoins(taille).catch(() => null);
      if (t !== jeton.current) return;
      setCoins(c ?? coinsParDefaut(p.image.width, p.image.height)); setProposes(!!c);
      setOuverture(false);
      aller('coins');
    } catch {
      if (t === jeton.current) { setOuverture(false); setErreur('photo.erreur'); }
    }
  }

  async function changerTaille(n: number) {
    setTaille(n);
    // Coins proposés et pas encore touchés : la marge du bois dépend de la taille, on les repropose.
    if (proposes && lecteur.current && photo) {
      const c = await lecteur.current.proposerCoins(n).catch(() => null);
      if (c) setCoins(c);
    }
  }

  async function lire() {
    if (!coins || !lecteur.current) return;
    const t = ++jeton.current;
    setErreur(null); aller('lecture');
    try {
      const r = await lecteur.current.lire(coins, taille);
      if (t !== jeton.current) return;
      setPlateau(r.plateau); setIncertaines(new Set(r.incertaines)); setMortes(new Set());
      aller('pierres');
    } catch {
      if (t === jeton.current) { setErreur('lecture.erreur'); aller('coins'); }
    }
  }

  function corriger(p: number) {
    const b = plateau.slice();
    b[p] = ((b[p] + 1) % 3) as 0 | 1 | 2;
    setPlateau(b);
    if (incertaines.has(p)) { const s = new Set(incertaines); s.delete(p); setIncertaines(s); }
  }

  /** Pierres mortes : la proposition de Mochi (le comptage de fin de partie), sans jamais la donner pour sûre. */
  function chercherMortes() {
    const t = ++jeton.current;
    setMortes(new Set()); setEstimation('attente'); aller('mortes');
    const pos = newPosition(taille);
    pos.board.set(plateau);
    const delai = new Promise<null>(resolve => setTimeout(() => resolve(null), DELAI_MORTES_MS));
    const calcul = import('../engine').then(m => m.proposeComptage(pos, KOMI_USUEL.japanese)).catch(() => null);
    void Promise.race([calcul, delai]).then(r => {
      if (t !== jeton.current) return;
      if (!r) { setEstimation('echec'); return; }
      setMortes(new Set(r.dead)); setEstimation(r.dead.length ? 'faite' : 'rien');
    });
  }

  function basculerMorte(p: number) {
    if (!plateau[p]) return;
    const g = groupAt(plateau, taille, p), s = new Set(mortes), morte = s.has(p);
    for (const q of g.stones) morte ? s.delete(q) : s.add(q);
    setMortes(s);
  }

  function choisirRegle(r: Rules) {
    setRegle(r);
    if (!komiChange) setKomi(KOMI_USUEL[r]);
  }

  function recommencer() { jeton.current++; oublierPhoto(); setMortes(new Set()); setIncertaines(new Set()); aller('photo'); }

  const resultat = useMemo(
    () => (etape === 'score' ? compterPhoto(plateau, taille, { regle, komi, prisonniers, mortes }) : null),
    [etape, plateau, taille, regle, komi, prisonniers, mortes],
  );

  const titreId = `${ids}-titre`;
  const entete = <EnteteEcran id={titreId} titre={tph('titre')} retour={tph('retour')} onRetour={retour} />;

  if (etape === 'photo') {
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="ps-visee" aria-hidden="true"><Board size={9} board={EXEMPLE_PLATEAU} coordonnees={false} /></div>
        <p className="ps-texte">{fr(tph('photo.intro'))}</p>
        <p className="ps-aide" id={`${ids}-permission`}>{fr(tph('photo.permission'))}</p>
        {erreur && <p className="ps-erreur" role="alert">{fr(tph(erreur))}</p>}
        {ouverture && <p className="ps-attente" role="status"><Reflexion taille={22} />{tph('photo.chargement')}</p>}
        <label className="lien ps-galerie">
          <input className="sr-only" type="file" accept="image/*" onChange={e => { void choisir(e); }} disabled={ouverture} data-testid="photo-galerie" />
          {tph('photo.galerie')}
        </label>
        <div className="dock">
          <label className="cta ps-cta-fichier" aria-disabled={ouverture || undefined} aria-busy={ouverture || undefined}>
            <input className="sr-only" type="file" accept="image/*" capture="environment" aria-describedby={`${ids}-permission`}
              onChange={e => { void choisir(e); }} disabled={ouverture} data-testid="photo-camera" />
            {tph('photo.prendre')}
          </label>
        </div>
      </section>
    );
  }

  if ((etape === 'coins' || etape === 'lecture') && photo && coins) {
    const valide = quadrilatereValide(coins);
    const lecture = etape === 'lecture';
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="seg ps-tailles" role="group" aria-label={tph('coins.taille')}>
          {TAILLES.map(n => (
            <button key={n} type="button" aria-pressed={taille === n} disabled={lecture} onClick={() => { void changerTaille(n); }}>{tph('coins.tailleN', { n })}</button>
          ))}
        </div>
        <EditeurCoins photo={photo} coins={coins} taille={taille} desactive={lecture}
          onCoins={c => { setCoins(c); setProposes(false); }} aideId={`${ids}-aide-coins`} />
        <p className="ps-aide" id={`${ids}-aide-coins`}>{fr(tph(proposes ? 'coins.propose' : 'coins.consigne'))} <span className="sr-only">{tph('coins.aide')}</span></p>
        {!valide && <p className="ps-erreur" role="alert">{fr(tph('coins.croises'))}</p>}
        {erreur && <p className="ps-erreur" role="alert">{fr(tph(erreur))}</p>}
        <button type="button" className="lien ps-lien" onClick={retour} disabled={lecture}>{tph('coins.autre')}</button>
        <div className="dock">
          <button type="button" className="cta" disabled={!valide || lecture} aria-busy={lecture || undefined} onClick={() => { void lire(); }}>
            {lecture ? <><Reflexion taille={22} libelle={tph('lecture')} /> {tph('lecture')}</> : tph('coins.lire')}
          </button>
        </div>
      </section>
    );
  }

  const incertainesPierres = [...incertaines].filter(p => plateau[p]);
  const incertainesVides = [...incertaines].filter(p => !plateau[p]);

  if (etape === 'pierres') {
    const n = incertaines.size;
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="ps-plateau" role="group" aria-label={tph('pierres.plateauAria')}>
          <Board size={taille} board={plateau} interactive stonesTappable confirmTouch={false} onPlay={corriger}
            marks={{ targets: incertainesPierres, ouverts: incertainesVides }} />
        </div>
        <p className="ps-texte" role="status" data-testid="ps-incertaines">{fr(n ? tph('pierres.incertaines', { n }) : tph('pierres.aucune'))}</p>
        <p className="ps-aide">{fr(tph('pierres.consigne'))}</p>
        <button type="button" className="lien ps-lien" onClick={() => aller('coins')}>{tph('pierres.coins')}</button>
        <div className="dock">
          <button type="button" className="cta" onClick={chercherMortes}>{tph('pierres.valider')}</button>
        </div>
      </section>
    );
  }

  if (etape === 'mortes') {
    const nMortes = mortes.size;
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="ps-plateau">
          <Board size={taille} board={plateau} interactive stonesTappable confirmTouch={false} onPlay={basculerMorte} marks={{ dead: mortes }} />
        </div>
        <p className="ps-texte" role="status" data-testid="ps-mortes">
          {estimation === 'attente' ? <><Reflexion taille={18} /> {tph('mortes.cherche')}</>
            : estimation === 'faite' && nMortes ? fr(tph('mortes.propose', { n: nMortes }))
            : estimation === 'rien' ? fr(tph('mortes.rien')) : fr(tph('mortes.consigne'))}
        </p>
        {estimation !== 'echec' && <p className="ps-aide">{fr(tph('mortes.consigne'))}</p>}
        <div className="dock">
          <button type="button" className="cta" onClick={() => { jeton.current++; if (estimation === 'attente') setEstimation('echec'); aller('regle'); }}>{tph('mortes.valider')}</button>
        </div>
      </section>
    );
  }

  if (etape === 'regle') {
    const camp = (c: 'noir' | 'blanc') => tph(c === 'noir' ? 'prisonniers.noir' : 'prisonniers.blanc');
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="seg ps-regles" role="group" aria-label={tph('regle.groupe')}>
          {(['japanese', 'chinese'] as const).map(r => (
            <button key={r} type="button" aria-pressed={regle === r} onClick={() => choisirRegle(r)}>{tph(`regle.${r}`)}</button>
          ))}
        </div>
        <p className="ps-aide">{fr(tph(`regle.${regle}.aide`))}</p>
        <Compteur id={`${ids}-komi`} libelle={tph('komi')} valeur={komi} texte={nombre(komi)} pas={0.5} min={-50} max={50}
          moins={tph('komi.moins')} plus={tph('komi.plus')} onChange={v => { setKomi(v); setKomiChange(true); }} />
        <p className="ps-aide">{fr(tph('komi.aide'))}</p>
        {regle === 'japanese' && (
          <fieldset className="ps-prisonniers">
            <legend>{tph('prisonniers')}</legend>
            {(['noir', 'blanc'] as const).map(c => (
              <Compteur key={c} id={`${ids}-pris-${c}`} libelle={camp(c)} valeur={prisonniers[c]} texte={String(prisonniers[c])} pas={1} min={0} max={99}
                pierre={c === 'noir' ? 'b' : 'w'} moins={tph('prisonniers.moins', { camp: camp(c) })} plus={tph('prisonniers.plus', { camp: camp(c) })}
                onChange={v => setPrisonniers(p => ({ ...p, [c]: borner(v) }))} saisie />
            ))}
            <p className="ps-aide">{fr(tph('prisonniers.aide'))}</p>
          </fieldset>
        )}
        <div className="dock">
          <button type="button" className="cta" onClick={() => aller('score')}>{tph('regle.compter')}</button>
        </div>
      </section>
    );
  }

  if (etape === 'score' && resultat) {
    const r = resultat, japonais = r.regle === 'japanese';
    const ligne = (cle: ClePhoto, noir: number, blanc: number, id: string) => (
      <tr key={id}><th scope="row">{tph(cle)}</th><td>{scoreAffiche(noir)}</td><td>{scoreAffiche(blanc)}</td></tr>
    );
    const mortesPrises = r.mortes.noires + r.mortes.blanches;
    return (
      <section className="sous-vue photo-score" aria-labelledby={titreId}>
        {entete}
        <div className="ps-plateau ps-plateau-score">
          <Board size={taille} board={plateau} marks={{ owner: r.owner, dead: mortes }} />
        </div>
        <p className="ps-resultat" role="status" data-testid="ps-resultat">{fr(phraseResultat(r.gagnant, r.marge))}</p>
        <table className="ps-detail" aria-label={tph('score.detail')}>
          <thead><tr><td /><th scope="col"><span className="stone b" aria-hidden="true" />{tph('score.camp.noir')}</th><th scope="col"><span className="stone w" aria-hidden="true" />{tph('score.camp.blanc')}</th></tr></thead>
          <tbody>
            {ligne('score.territoire', r.noir.territoire, r.blanc.territoire, 't')}
            {japonais ? ligne('score.prisonniers', r.noir.prisonniers, r.blanc.prisonniers, 'p') : ligne('score.pierres', r.noir.pierres, r.blanc.pierres, 'p')}
            {ligne('score.komi', r.noir.komi, r.blanc.komi, 'k')}
          </tbody>
          <tfoot><tr><th scope="row">{tph('score.total')}</th><td>{scoreAffiche(r.noir.total)}</td><td>{scoreAffiche(r.blanc.total)}</td></tr></tfoot>
        </table>
        <ul className="ps-notes">
          <li>{fr(tph(`score.regle.${r.regle}`, { komi: nombre(komi) }))}</li>
          {japonais && mortesPrises > 0 && <li>{fr(tph('score.mortes', { n: mortesPrises }))}</li>}
          {r.seki > 0 && <li>{fr(tph(`score.seki.${r.regle}`))}</li>}
          {r.neutres > 0 && <li>{fr(tph('score.dame', { n: r.neutres }))}</li>}
        </ul>
        <button type="button" className="lien ps-lien" onClick={() => aller('regle')}>{tph('score.regle')}</button>
        <div className="dock">
          <button type="button" className="cta" onClick={recommencer}>{tph('score.autre')}</button>
        </div>
      </section>
    );
  }

  // État impossible (photo perdue) : retour au début.
  return (
    <section className="sous-vue photo-score" aria-labelledby={titreId}>
      {entete}
      <div className="dock"><button type="button" className="cta" onClick={recommencer}>{tph('photo.prendre')}</button></div>
    </section>
  );
}

/** Compteur à deux boutons de 44 px (moins, plus) ; `saisie` : la valeur se tape aussi au clavier. */
function Compteur({ id, libelle, valeur, texte, pas, min, max, moins, plus, onChange, pierre, saisie = false }: {
  id: string; libelle: string; valeur: number; texte: string; pas: number; min: number; max: number; moins: string; plus: string;
  onChange: (v: number) => void; pierre?: 'b' | 'w'; saisie?: boolean;
}) {
  const changer = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v / pas) * pas)));
  return (
    <div className="ps-compteur">
      <label htmlFor={id} className="ps-compteur-libelle">{pierre && <span className={`stone ${pierre}`} aria-hidden="true" />}{libelle}</label>
      <button type="button" className="ps-pas" aria-label={moins} disabled={valeur <= min} onClick={() => changer(valeur - pas)}>−</button>
      {saisie
        ? <input id={id} className="ps-valeur" type="number" inputMode="numeric" min={min} max={max} step={pas} value={valeur}
          onChange={e => changer(Number(e.target.value))} onFocus={e => e.target.select()} />
        : <output id={id} className="ps-valeur" aria-live="polite">{texte}</output>}
      <button type="button" className="ps-pas" aria-label={plus} disabled={valeur >= max} onClick={() => changer(valeur + pas)}>+</button>
    </div>
  );
}

/** Taille de la loupe, en pixels d'écran, et son grossissement. */
const LOUPE = 112, ZOOM = 3;

/**
 * La photo, la grille projetée (verte) et 4 coins à déplacer : au doigt (le coin suit le glissement, sans se cacher sous
 * le doigt), à la souris ou au clavier (flèches, Maj pour aller plus vite). Une loupe montre le coin déplacé.
 */
function EditeurCoins({ photo, coins, taille, onCoins, desactive, aideId }: {
  photo: PhotoOuverte; coins: Coins; taille: number; onCoins: (c: Coins) => void; desactive: boolean; aideId: string;
}) {
  const boite = useRef<HTMLDivElement>(null), toile = useRef<HTMLCanvasElement>(null), loupe = useRef<HTMLCanvasElement>(null);
  const glisse = useRef<{ k: number; x: number; y: number; depart: Point } | null>(null);
  const [actif, setActif] = useState<number | null>(null);
  const W = photo.image.width, H = photo.image.height;

  useEffect(() => {
    const c = toile.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = W; c.height = H;
    ctx.drawImage(photo.canvas, 0, 0);
  }, [photo, W, H]);

  // Loupe : la photo autour du coin actif, grossie, avec une croix verte au point exact.
  useEffect(() => {
    const l = loupe.current, ctx = l?.getContext('2d'), b = boite.current;
    if (actif === null || !l || !ctx || !b) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    l.width = LOUPE * dpr; l.height = LOUPE * dpr;
    const echelle = W / b.getBoundingClientRect().width, cote = (LOUPE / ZOOM) * echelle, c = coins[actif];
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, l.width, l.height);
    ctx.drawImage(photo.canvas, c.x - cote / 2, c.y - cote / 2, cote, cote, 0, 0, l.width, l.height);
    ctx.strokeStyle = getComputedStyle(b).getPropertyValue('--accent').trim() || '#3CC48E';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(l.width / 2, 0); ctx.lineTo(l.width / 2, l.height); ctx.moveTo(0, l.height / 2); ctx.lineTo(l.width, l.height / 2);
    ctx.stroke();
  }, [actif, coins, photo, W]);

  const grille = useMemo(() => {
    if (!quadrilatereValide(coins)) return [];
    const h = homographieGrille(coins, taille), n = taille - 1, out: [Point, Point][] = [];
    for (let i = 0; i <= n; i++) {
      out.push([appliquer(h, i, 0), appliquer(h, i, n)]);
      out.push([appliquer(h, 0, i), appliquer(h, n, i)]);
    }
    return out;
  }, [coins, taille]);

  const deplacer = (k: number, p: Point) => {
    const c = [...coins] as [Point, Point, Point, Point];
    c[k] = { x: Math.max(0, Math.min(W - 1, p.x)), y: Math.max(0, Math.min(H - 1, p.y)) };
    onCoins(c);
  };
  const echelle = () => W / (boite.current?.getBoundingClientRect().width || W);

  function down(k: number, e: PointerEvent<HTMLButtonElement>) {
    if (desactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    glisse.current = { k, x: e.clientX, y: e.clientY, depart: coins[k] };
    setActif(k);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = glisse.current;
    if (!g) return;
    const s = echelle();
    deplacer(g.k, { x: g.depart.x + (e.clientX - g.x) * s, y: g.depart.y + (e.clientY - g.y) * s });
  }
  function up() { glisse.current = null; setActif(null); }
  function clavier(k: number, e: KeyboardEvent<HTMLButtonElement>) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || desactive) return;
    e.preventDefault();
    const s = echelle() * (e.shiftKey ? 10 : 1);
    setActif(k);
    deplacer(k, { x: coins[k].x + d[0] * s, y: coins[k].y + d[1] * s });
  }

  const loupeADroite = actif !== null && coins[actif].x < W / 2 && coins[actif].y < H / 2;
  return (
    <div className="ps-photo" ref={boite} style={{ aspectRatio: `${W} / ${H}`, ['--ps-ratio' as string]: W / H }}>
      <canvas ref={toile} className="ps-toile" role="img" aria-label={tph('coins.photoAria')} />
      <svg className="ps-grille" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {grille.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)}
        <polygon points={coins.map(c => `${c.x},${c.y}`).join(' ')} className="ps-cadre" />
      </svg>
      {coins.map((c, k) => (
        <button key={k} type="button" className="ps-coin" data-coin={k} aria-label={tph(`coin.${k}` as ClePhoto)} aria-describedby={aideId}
          style={{ left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%` }} disabled={desactive}
          onPointerDown={e => down(k, e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onKeyDown={e => clavier(k, e)} onFocus={() => setActif(k)} onBlur={() => { if (!glisse.current) setActif(null); }}>
          <span aria-hidden="true" />
        </button>
      ))}
      {actif !== null && <canvas ref={loupe} className={`ps-loupe${loupeADroite ? ' a-droite' : ''}`} aria-label={tph('coins.loupe')} role="img" />}
    </div>
  );
}
