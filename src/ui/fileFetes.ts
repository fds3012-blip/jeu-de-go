// Issue #236 (N2) : une fête à la fois, jamais sur la consigne. Logique pure de la file des célébrations.
// Duolingo met les récompenses après l'exercice, une par écran et dans l'ordre ; on fait de même :
// - une seule célébration à l'écran (`actif`) ; les autres attendent (`attente`), dans l'ordre XP, niveau, installation ;
// - pendant un exercice (problème, leçon, partie en cours), rien ne se pose par-dessus : l'XP gagnée se lit dans la
//   feuille de réussite (`enLigne`), la fête de niveau et la carte d'installation attendent la fin de l'exercice ;
// - si l'XP n'a pas été lue dans la feuille (fin de leçon, fin de partie), elle passe en tête de la file à la fin.
// Le magasin (celebrations.ts) applique ces fonctions ; les composants n'en connaissent que le résultat.

export type Fete =
  | { genre: 'xp'; points: number; bonus: number }
  | { genre: 'niveau'; niveau: number }
  | { genre: 'installation' }
  // Proposition du rappel quotidien (#36) : fin de partie, après l'XP et le niveau.
  | { genre: 'rappel' }
  // Invitation à partager l'app (#521) : en dernier, et seulement si aucune autre proposition n'est passée sur l'écran.
  | { genre: 'partage' };

export type Genre = Fete['genre'];

export interface EtatFile {
  /** Célébration à l'écran, ou null. */
  actif: Fete | null;
  attente: Fete[];
  /** Un exercice est en cours : aucune célébration ne s'affiche par-dessus. */
  exercice: boolean;
  /** XP gagnée pendant l'exercice, à lire dans la feuille de réussite ; `vue` : la feuille l'a montrée. */
  enLigne: { points: number; bonus: number; vue: boolean } | null;
}

export const FILE_VIDE: EtatFile = { actif: null, attente: [], exercice: false, enLigne: null };

/** Ordre de passage : l'XP d'abord (le gain de l'action), puis le niveau (le jalon), puis l'installation. */
const RANG: Record<Genre, number> = { xp: 0, niveau: 1, installation: 2, rappel: 3, partage: 4 };

function trier(f: Fete[]): Fete[] {
  return f.map((x, i) => [x, i] as const).sort((a, b) => RANG[a[0].genre] - RANG[b[0].genre] || a[1] - b[1]).map(([x]) => x);
}

function cumulerXp(liste: Fete[], g: { points: number; bonus: number }): Fete[] {
  const i = liste.findIndex(f => f.genre === 'xp');
  if (i < 0) return [...liste, { genre: 'xp', points: g.points, bonus: g.bonus }];
  const x = liste[i] as Extract<Fete, { genre: 'xp' }>;
  return liste.map((f, j) => (j === i ? { genre: 'xp', points: x.points + g.points, bonus: x.bonus + g.bonus } : f));
}

/** Nouvelle célébration demandée. Elle ne s'affiche pas d'elle-même : `avancer` choisit la suivante. */
export function ajouter(e: EtatFile, f: Fete): EtatFile {
  if (f.genre === 'xp') {
    if (e.exercice) {
      const avant = e.enLigne;
      return { ...e, enLigne: { points: (avant?.points ?? 0) + f.points, bonus: (avant?.bonus ?? 0) + f.bonus, vue: false } };
    }
    // Deux gains à la même fin : une seule pastille, cumulée (celle à l'écran grossit plutôt que de se répéter).
    if (e.actif?.genre === 'xp') return { ...e, actif: { genre: 'xp', points: e.actif.points + f.points, bonus: e.actif.bonus + f.bonus } };
    return { ...e, attente: trier(cumulerXp(e.attente, f)) };
  }
  if (f.genre === 'niveau') {
    // Deux niveaux franchis avant d'être fêtés : on fête le plus haut.
    const sans = e.attente.filter(x => x.genre !== 'niveau');
    const deja = e.attente.find((x): x is Extract<Fete, { genre: 'niveau' }> => x.genre === 'niveau');
    return { ...e, attente: trier([...sans, { genre: 'niveau', niveau: Math.max(f.niveau, deja?.niveau ?? 0) }]) };
  }
  if (e.actif?.genre === f.genre || e.attente.some(x => x.genre === f.genre)) return e;
  return { ...e, attente: trier([...e.attente, f]) };
}

/** Met la suivante à l'écran, si l'écran est libre et qu'aucun exercice n'est en cours. */
export function avancer(e: EtatFile): EtatFile {
  if (e.actif || e.exercice || !e.attente.length) return e;
  const [suivante, ...reste] = e.attente;
  return { ...e, actif: suivante, attente: reste };
}

/** La célébration à l'écran est finie (durée écoulée, touchée, carte fermée). */
export function terminer(e: EtatFile, genre?: Genre): EtatFile {
  if (!e.actif || (genre && e.actif.genre !== genre)) return e;
  return { ...e, actif: null };
}

/** Retire une demande (la carte d'installation quitte l'écran avant son tour, par exemple). */
export function retirer(e: EtatFile, genre: Genre): EtatFile {
  const actif = e.actif?.genre === genre ? null : e.actif;
  const attente = e.attente.filter(f => f.genre !== genre);
  return actif === e.actif && attente.length === e.attente.length ? e : { ...e, actif, attente };
}

/** Niveau franchi pas encore fêté (à l'écran ou en attente), ou null. */
export function niveauEnAttente(e: EtatFile): number | null {
  const f = [e.actif, ...e.attente].find(x => x?.genre === 'niveau');
  return f?.genre === 'niveau' ? f.niveau : null;
}

/** La feuille de réussite a montré l'XP de l'exercice : elle ne sera pas répétée à la fin. */
export function marquerVue(e: EtatFile): EtatFile {
  return e.enLigne && !e.enLigne.vue ? { ...e, enLigne: { ...e.enLigne, vue: true } } : e;
}

/**
 * Début ou fin d'exercice. Au début, la célébration à l'écran s'efface (elle ne couvre pas la consigne).
 * À la fin, l'XP non lue passe dans la file. `avancer` est appelé à part : le magasin laisse l'écran suivant se poser.
 */
export function exercice(e: EtatFile, enCours: boolean): EtatFile {
  if (enCours) return e.exercice && !e.actif ? e : { ...e, exercice: true, actif: null };
  if (!e.exercice) return e;
  const x = e.enLigne;
  const attente = x && !x.vue ? trier(cumulerXp(e.attente, x)) : e.attente;
  return { ...e, exercice: false, enLigne: null, attente };
}
