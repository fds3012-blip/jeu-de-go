// Notifications dans l'app (issue #367) : ce qui attend le joueur, d'un coup d'œil, comme chez chess.com.
// Logique pure, sans React ni réseau. Les données viennent de l'app (défis lus sous la RLS actuelle, série, Go du jour,
// leçons) ; chaque « source » en tire des éléments. Pas de notification poussée ici (rappel : #36).
//
// Règles contre le harcèlement :
// - rien au tout premier lancement : la seule chose à faire est la première partie (#236, N4) ;
// - une pastille (point jade sur l'onglet) seulement quand quelqu'un ou quelque chose t'attend et peut se perdre :
//   un ami qui attend ton coup, une série en jeu aujourd'hui (plus tard : une demande d'ami, #359) ;
// - le Go du jour sans série et la leçon en cours restent dans « Aujourd'hui » (tuiles de l'accueil, sous l'action
//   principale : c'est la liste « À faire »), sans pastille ;
// - la liste est courte (au plus `MAX_ELEMENTS`) ; sans rien en attente, aucune pastille, aucun texte.
import { t } from '../content/i18n';
import type { Onglet } from '../ui/onglets';
import { texteDelai } from './defiAmi';

/** Où mène un élément, en un toucher. */
export type CibleAFaire =
  | { ecran: 'defi'; partieId: string }
  | { ecran: 'goDuJour' }
  | { ecran: 'lecon'; id: string }
  // #359 : « Mes amis » (demandes reçues), sous-vue du Profil.
  | { ecran: 'amis' };

export type GenreAFaire = 'defi' | 'serie' | 'goDuJour' | 'lecon' | 'ami';

export interface ElementAFaire {
  /** Clé stable (React, tests). */
  id: string;
  genre: GenreAFaire;
  /** Onglet qui porte la pastille quand `pastille` est vrai. */
  onglet: Onglet;
  /** Point jade sur l'onglet : quelqu'un ou quelque chose attend, et peut se perdre. */
  pastille: boolean;
  titre: string;
  detail: string;
  cible: CibleAFaire;
  /** Heures écoulées depuis le coup de l'adversaire (défi seulement) : délai de réponse, pour la mesure. */
  attenteH?: number | null;
}

/** Défi d'un ami où c'est au joueur d'agir, lu dans `defis` et `games` (RLS : seulement ses parties). */
export interface DefiEnAttente {
  partieId: string;
  /** Pseudo de l'adversaire, null s'il n'est pas connu. */
  adversaire: string | null;
  /** Temps restant pour répondre (ms), null hors délai. */
  restant: number | null;
  /** Le comptage attend sa réponse (et non un coup). */
  comptage: boolean;
  /**
   * Pas encore vu : une notification du serveur attend (table `notifications`, #367). Faux une fois la partie ouverte :
   * la ligne reste dans la liste, la pastille s'éteint. Absent (notifications illisibles) : compté comme nouveau.
   */
  nouveau?: boolean;
}

export interface DonneesAFaire {
  /** Tout premier lancement (aucune partie, aucune leçon commencée) : rien à signaler. */
  premier: boolean;
  defis: readonly DefiEnAttente[];
  /** Série de jours en cours (0 : aucune). */
  serie: number;
  duJourFait: boolean;
  /** Go du jour d'aujourd'hui, s'il existe. */
  goDuJour: { numero: number; titre: string } | null;
  /** Première leçon commencée et pas finie. */
  leconEnCours: { id: string; titre: string } | null;
  /** #359 : demandes d'ami reçues (`mes_amis()`, lues par App.tsx). */
  demandesAmis?: number;
}

/** Une source d'éléments : une fonction pure des données. Ajouter une source = l'ajouter à `SOURCES`. */
export type SourceAFaire = (d: DonneesAFaire) => ElementAFaire[];

/** Longueur maximale de la liste : au-delà, c'est du bruit. */
export const MAX_ELEMENTS = 4;
const HEURE = 3_600_000;

/** Délai d'un coup dans un défi par lien (3 jours, `DELAI_COUP_MS` de src/data/defi.ts, recopié pour rester pur). */
export const DELAI_COUP_MS = 3 * 24 * HEURE;

/** Défis où c'est ton tour : le plus pressé d'abord. */
export const sourceDefis: SourceAFaire = d => [...d.defis]
  .sort((a, b) => (a.restant ?? Infinity) - (b.restant ?? Infinity))
  .map(x => ({
    id: `defi-${x.partieId}`,
    genre: 'defi',
    onglet: 'jouer',
    pastille: x.nouveau !== false,
    titre: x.comptage
      ? (x.adversaire ? t('aFaire.comptageContre', { pseudo: x.adversaire }) : t('aFaire.comptage'))
      : (x.adversaire ? t('aFaire.tourContre', { pseudo: x.adversaire }) : t('aFaire.tour')),
    detail: x.restant === null ? t('aFaire.tourDetail') : t('aFaire.tourDelai', { delai: texteDelai(x.restant) }),
    cible: { ecran: 'defi', partieId: x.partieId },
    attenteH: x.restant === null ? null : Math.max(0, Math.round((DELAI_COUP_MS - x.restant) / HEURE * 10) / 10),
  }));

/** Go du jour pas encore fait : une série en jeu passe en pastille ; sinon, une ligne calme. */
export const sourceDuJour: SourceAFaire = d => {
  if (d.duJourFait || !d.goDuJour) return [];
  if (d.serie > 0) {
    return [{ id: 'serie', genre: 'serie', onglet: 'problemes', pastille: true,
      titre: t('aFaire.serie', { n: d.serie }), detail: t('aFaire.serieDetail'), cible: { ecran: 'goDuJour' } }];
  }
  return [{ id: 'go-du-jour', genre: 'goDuJour', onglet: 'problemes', pastille: false,
    titre: t('aFaire.goDuJour'), detail: t('aFaire.goDuJourDetail', { numero: d.goDuJour.numero, titre: d.goDuJour.titre }), cible: { ecran: 'goDuJour' } }];
};

/** Leçon commencée : on la reprend où on l'a laissée. */
export const sourceLecon: SourceAFaire = d => d.leconEnCours
  ? [{ id: `lecon-${d.leconEnCours.id}`, genre: 'lecon', onglet: 'apprendre', pastille: false,
    titre: t('aFaire.lecon'), detail: d.leconEnCours.titre, cible: { ecran: 'lecon', id: d.leconEnCours.id } }]
  : [];

/**
 * #359 (amis) : demandes d'ami reçues. Branchement : l'app remplit `demandesAmis` (fonction serveur `mes_amis()`,
 * demandes reçues en attente) dans `DonneesAFaire` ; rien d'autre à changer ici. Sans donnée, aucune ligne.
 */
export const sourceAmis: SourceAFaire = d => d.demandesAmis && d.demandesAmis > 0
  ? [{ id: 'amis', genre: 'ami', onglet: 'profil', pastille: true,
    titre: t('aFaire.amis', { n: d.demandesAmis }), detail: t('aFaire.amisDetail'), cible: { ecran: 'amis' } }]
  : [];

/** Sources, dans l'ordre d'affichage : ce qu'un humain attend d'abord, puis ce qui expire aujourd'hui, puis le reste. */
export const SOURCES: readonly SourceAFaire[] = [sourceDefis, sourceAmis, sourceDuJour, sourceLecon];

/** Ce qu'un humain attend (un ami) : montré même au tout premier lancement, l'ami arrivé par un lien en a besoin. */
const HUMAIN: ReadonlySet<GenreAFaire> = new Set(['defi', 'ami']);

/** La liste « À faire », courte. Au tout premier lancement, seulement ce qu'un ami attend. */
export function elementsAFaire(d: DonneesAFaire, sources: readonly SourceAFaire[] = SOURCES): ElementAFaire[] {
  const tous = sources.flatMap(s => s(d));
  return (d.premier ? tous.filter(e => HUMAIN.has(e.genre)) : tous).slice(0, MAX_ELEMENTS);
}

/** Onglets qui portent une pastille, avec ce qui les attend (le premier élément) : le lecteur d'écran l'entend. */
export function ongletsAPastille(elements: readonly ElementAFaire[]): ReadonlyMap<Onglet, string> {
  const m = new Map<Onglet, string>();
  for (const e of elements) if (e.pastille && !m.has(e.onglet)) m.set(e.onglet, e.titre);
  return m;
}

/** Premier élément à pastille d'un onglet (pour la mesure d'un toucher sur l'onglet). */
export function elementDeLOnglet(elements: readonly ElementAFaire[], onglet: Onglet): ElementAFaire | undefined {
  return elements.find(e => e.pastille && e.onglet === onglet);
}

/** Lecture tolérante de la progression des leçons : la première commencée et pas finie, dans l'ordre du chemin. */
export function leconEnCours<L extends { id: string; title: string; steps: readonly unknown[] }>(
  lecons: readonly L[], progres: Readonly<Record<string, number>>,
): { id: string; titre: string } | null {
  const l = lecons.find(x => { const n = progres[x.id] ?? 0; return n > 0 && n < x.steps.length; });
  return l ? { id: l.id, titre: l.title } : null;
}
