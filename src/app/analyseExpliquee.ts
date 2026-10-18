// Issue #673 : les phrases et le plateau de « Pourquoi ? » dans la revue. Logique pure, testée dans
// analyseExpliquee.test.ts. Les faits viennent de src/go/explication.ts : ici, on ne fait que les dire et les montrer.
// Une phrase par raison (au plus deux raisons), tutoiement ; atari, sente, gote et couper expliqués à leur première
// apparition dans la revue (`glosesDesErreurs`).
import { toLabel } from '../go/coords';
import type { Color, Position } from '../go/rules';
import type { Explication, Fait, Ligne } from '../go/explication';
import { ta } from '../content/i18n/analyse';

/** Mots du go expliqués entre parenthèses la première fois qu'ils apparaissent. */
export type Terme = 'atari' | 'sente' | 'gote' | 'couper';

export interface TextesExplication {
  /** « Pourquoi c'est une erreur » : une ou deux phrases. */
  erreur: string;
  /** « Pourquoi D3 est meilleur » : une ou deux phrases. */
  meilleur: string;
  /** Mots du go employés (pour ne les expliquer qu'une fois). */
  termes: Terme[];
}

export interface OptionsTextes {
  /** Nom de l'adversaire de celui qui a joué l'erreur (« Pomme », « Blanc »). */
  adv: string;
  /** Mots à expliquer dans ces phrases (première apparition dans la revue). Par défaut : tous. */
  gloses?: ReadonlySet<Terme>;
}

const TOUS: ReadonlySet<Terme> = new Set<Terme>(['atari', 'sente', 'gote', 'couper']);
const pts = (n: number) => ta('pts', { n: Math.max(1, Math.round(n)) });

/** Termes qu'emploie un fait, dans la phrase de l'erreur ou dans celle du bon coup. */
function termesDe(f: Fait): Terme[] {
  switch (f.type) {
    case 'pierresPerdues': return f.cause === 'atari' || f.cause === 'autoAtari' ? ['atari'] : [];
    case 'priseManquee': return f.cause === 'atari' ? ['atari'] : [];
    case 'coupe': return f.parade === 'atari' ? ['couper', 'atari'] : ['couper'];
    case 'initiative': return ['gote', 'sente'];
    default: return [];
  }
}

/** Points des gains de zone : jamais plus que les points perdus (l'écart de KataGo fait foi). */
const ptsZone = (gain: number, perte: number) => pts(Math.min(gain, perte));

function phraseErreur(f: Fait, x: Explication, size: number, adv: string, g: (t: Terme) => boolean): string {
  const L = (p: number) => toLabel(p, size);
  switch (f.type) {
    case 'pierresPerdues': {
      const v = { n: f.pierres.length, lieu: L(f.pierres[0]), point: L(f.point), adv, k: f.etape + 1 };
      if (f.cause === 'atari') return ta('erreur.perdues.atari', { ...v, glose: g('atari') ? ta(f.pierres.length === 1 ? 'glose.atari.one' : 'glose.atari.other') : '' });
      if (f.cause === 'autoAtari') return ta('erreur.perdues.autoAtari', { ...v, glose: g('atari') ? ta('glose.atariApres') : '' });
      return ta('erreur.perdues.suite', v);
    }
    case 'priseManquee': {
      const v = { n: f.pierres.length, lieu: L(f.pierres[0]) };
      if (f.cause === 'atari') return ta('erreur.manquee.atari', { ...v, glose: g('atari') ? ta(f.pierres.length === 1 ? 'glose.atari.one' : 'glose.atari.other') : '' });
      return ta(f.cause === 'immediate' ? 'erreur.manquee.immediate' : 'erreur.manquee.suite', v);
    }
    case 'groupe': return ta(f.etat === 'mort' ? 'erreur.groupe.mort' : 'erreur.groupe.faible', { n: f.pierres.length, lieu: L(f.pierres[0]) });
    case 'groupeTue': return ta(f.apresJoue === 'vit' ? 'erreur.groupeTue.vit' : 'erreur.groupeTue.incertain', { n: f.pierres.length, lieu: L(f.pierres[0]) });
    case 'coupe': return ta('erreur.coupe', { adv, point: L(f.point), glose: g('couper') ? ta('glose.couper') : '' });
    case 'territoire': return ta('erreur.territoire', { pts: ptsZone(f.gain, x.perte), zone: ta(`zone.${f.lieu}`) });
    case 'initiative': return ta('erreur.initiative', { adv, point: L(f.ailleursLui), glose: g('gote') ? ta('glose.gote') : '' });
  }
}

/** Phrase du bon coup pour un fait ; `null` quand le fait ne dit rien du bon coup (ta seule pierre jouée prise). */
function phraseBon(f: Fait, x: Explication, size: number, adv: string, g: (t: Terme) => boolean): string | null {
  const L = (p: number) => toLabel(p, size), bon = L(x.bon);
  switch (f.type) {
    case 'pierresPerdues': {
      const anciennes = f.pierres.filter(p => p !== x.joue);
      return anciennes.length ? ta('bon.perdues', { bon, n: anciennes.length }) : null;
    }
    case 'priseManquee':
      return f.etape === 0
        ? ta('bon.manquee.immediate', { bon, n: f.pierres.length })
        : ta('bon.manquee.suite', { bon, n: f.pierres.length, lieu: L(f.pierres[0]), k: f.etape + 1 });
    case 'groupe': return ta('bon.groupe', { bon });
    case 'groupeTue': return ta('bon.groupeTue', { bon, n: f.pierres.length, lieu: L(f.pierres[0]) });
    case 'coupe':
      if (f.parade === 'occupe') return ta('bon.coupe.occupe', { bon });
      if (f.parade === 'relie') return ta('bon.coupe.relie', { bon, point: L(f.point) });
      return ta('bon.coupe.atari', { bon, adv, point: L(f.point), glose: g('atari') ? ta('glose.atariApres') : '' });
    case 'territoire': return ta('bon.territoire', { bon, pts: ptsZone(f.gain, x.perte), zone: ta(`zone.${f.lieu}`) });
    case 'initiative': return ta('bon.initiative', { bon, adv, reponse: L(f.reponse), ailleurs: L(f.ailleurs), glose: g('sente') ? ta('glose.sente') : '' });
  }
}

/**
 * Les deux textes d'une explication. Sans raison sûre : on dit seulement que KataGo préfère le bon coup et de combien,
 * et que la raison est surtout positionnelle (« rien n'est pris… » seulement quand c'est vérifié).
 */
export function textesExplication(x: Explication, size: number, o: OptionsTextes): TextesExplication {
  const gloses = o.gloses ?? TOUS, dites = new Set<Terme>();
  const g = (t: Terme) => { if (dites.has(t)) return false; dites.add(t); return gloses.has(t); };
  const bon = toLabel(x.bon, size);
  const termes = [...new Set(x.faits.flatMap(termesDe))];
  if (x.positionnel) {
    const debut = x.riposte != null ? `${ta('erreur.riposte', { adv: o.adv, point: toLabel(x.riposte, size) })} ` : '';
    return {
      erreur: debut + ta(x.calme ? 'erreur.positionnelCalme' : 'erreur.positionnel', { bon, pts: pts(x.perte) }),
      meilleur: ta('bon.general', { bon, pts: pts(x.perte) }),
      termes,
    };
  }
  const erreur = x.faits.map(f => phraseErreur(f, x, size, o.adv, g)).join(' ');
  // Les gloses déjà données dans « Pourquoi c'est une erreur » ne se répètent pas dans « Pourquoi … est meilleur ».
  const bons = x.faits.map(f => phraseBon(f, x, size, o.adv, g)).filter((s): s is string => !!s);
  return { erreur, meilleur: bons.length ? bons.join(' ') : ta('bon.general', { bon, pts: pts(x.perte) }), termes };
}

/**
 * Mots à expliquer pour chaque erreur, dans l'ordre de la partie : un mot n'est expliqué qu'à sa première apparition.
 * `explications` : numéro du coup → explication.
 */
export function glosesDesErreurs(explications: ReadonlyMap<number, Explication>): Map<number, Set<Terme>> {
  const vus = new Set<Terme>(), out = new Map<number, Set<Terme>>();
  for (const coup of [...explications.keys()].sort((a, b) => a - b)) {
    const nouveaux = new Set<Terme>();
    for (const t of explications.get(coup)!.faits.flatMap(termesDe)) if (!vus.has(t)) { vus.add(t); nouveaux.add(t); }
    out.set(coup, nouveaux);
  }
  return out;
}

/** Ce que montre le plateau à une étape d'une suite. */
export interface VueSuite {
  pos: Position;
  /** Numéro de chaque coup de la suite encore sur le plateau (1 : ton coup, ou le bon coup). */
  numeros: Map<number, number>;
  /** Pierres concernées par les raisons, encore sur le plateau. */
  cibles: number[];
  /** Ligne du bon coup : intersections gagnées (carrés de ta couleur), à la dernière étape. */
  carres: number[] | null;
  /** Ta ligne : la zone où tu perds (cadre), à la dernière étape. */
  cadre: number[] | null;
  /** Ligne du bon coup : ton coup, marqué d'une croix s'il est encore vide. */
  croix: number | null;
  /** Dernier coup joué de la suite (-1 : passe). */
  dernier: number;
  /** Nombre de coups de la suite. */
  longueur: number;
}

/** Plateau de la suite `ligne` à l'étape `etape` (0 : premier coup), avec les marques des raisons. */
export function vueSuite(x: Explication, ligne: Ligne, etape: number): VueSuite {
  const s = ligne === 'joue' ? x.suiteJoue : x.suiteBon;
  const k = Math.max(0, Math.min(s.positions.length - 1, etape));
  const pos = s.positions[k], numeros = new Map<number, number>();
  for (let i = 0; i <= k; i++) {
    const p = s.coups[i];
    // Une pierre reprise puis rejouée au même point garde le numéro du dernier coup.
    if (p >= 0 && pos.board[p]) numeros.set(p, i + 1);
  }
  const cibles = [...new Set(x.faits.filter(f => f.visuel.ligne === ligne).flatMap(f => f.visuel.pierres))].filter(p => pos.board[p]);
  const fin = k === s.positions.length - 1;
  const zone = x.faits.find(f => f.type === 'territoire')?.visuel.zone ?? null;
  const vides = zone && fin ? zone.filter(p => pos.board[p] === 0) : null;
  return {
    pos, numeros, cibles,
    carres: ligne === 'bon' && vides?.length ? vides : null,
    cadre: ligne === 'joue' && vides?.length ? vides : null,
    croix: ligne === 'bon' && x.joue >= 0 && pos.board[x.joue] === 0 ? x.joue : null,
    dernier: s.coups[k],
    longueur: s.positions.length,
  };
}

/** Carrés de territoire dans la couleur `c` (marques `owner` du plateau). */
export function carresDe(points: readonly number[], size: number, c: Color): Int8Array {
  const o = new Int8Array(size * size);
  for (const p of points) o[p] = c === 1 ? 1 : -1;
  return o;
}
