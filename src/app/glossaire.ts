// Recherche dans le glossaire et choix de la fiche d'aide (issue #362). Logique pure, sans React.
import { AUSSI, COMPTER, MOTS, REGLES, type Fiche, type IdMot } from '../content/aide';
import { traduire, type Langue } from '../content/i18n';

/** Minuscules, sans accents ni ligatures : « Œil » et « oeil », « Échelle » et « echelle » se trouvent pareil. */
export function normaliser(s: string): string {
  return s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
}

const nom = (id: IdMot, l: Langue) => traduire(l, `aide.mot.${id}`);
const definition = (id: IdMot, l: Langue) => traduire(l, `aide.mot.${id}.def`);

/** Mots entiers d'un texte normalisé. */
const mots = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Mots du glossaire qui répondent à `requete`, du plus proche au plus lointain :
 * 0 nom exact (ou un de ses autres noms), 1 nom qui commence par la requête, 2 nom qui la contient,
 * 3 un mot de la définition qui commence par la requête. Requête vide : tout le glossaire, dans l'ordre d'apprentissage.
 */
export function chercherMots(requete: string, l: Langue): IdMot[] {
  const q = normaliser(requete);
  if (!q) return MOTS.map(m => m.id);
  const rang = (id: IdMot): number => {
    const noms = [nom(id, l), ...(AUSSI[l][id] ?? [])].map(normaliser);
    if (noms.some(n => n === q || mots(n).includes(q))) return 0;
    if (noms.some(n => n.startsWith(q))) return 1;
    if (noms.some(n => n.includes(q))) return 2;
    if (q.length >= 3 && mots(normaliser(definition(id, l))).some(w => w.startsWith(q))) return 3;
    return 9;
  };
  return MOTS.map((m, i) => ({ id: m.id, r: rang(m.id), i })).filter(x => x.r < 9).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.id);
}

/** Ce que le « ? » d'une leçon ouvre : le mot qu'elle enseigne, ou « Comment on compte ? » pour la leçon de comptage. */
const AIDE_DES_LECONS: Record<string, { fiche: Fiche; mot?: IdMot }> = {
  l1: { fiche: 'mots', mot: 'liberte' }, l2: { fiche: 'mots', mot: 'atari' }, l3: { fiche: 'mots', mot: 'doubleAtari' },
  l4: { fiche: 'mots', mot: 'ko' }, l5: { fiche: 'mots', mot: 'oeil' }, l6: { fiche: 'mots', mot: 'territoire' },
  l7: { fiche: 'compter' }, l9: { fiche: 'mots', mot: 'filet' }, l10: { fiche: 'mots', mot: 'priseEnRetour' },
  l11: { fiche: 'mots', mot: 'semeai' }, l12: { fiche: 'mots', mot: 'fauxOeil' },
};

/** Fiche à ouvrir depuis une leçon ; les règles quand la leçon n'a pas de mot à elle (ouverture, par exemple). */
export function ficheDeLecon(lecon: string): { fiche: Fiche; mot?: IdMot } {
  return AIDE_DES_LECONS[lecon] ?? { fiche: 'regles' };
}

/** Leçons citées par l'aide (liens « Rejoue la leçon » et « ? » des leçons), pour les tests. */
export const LECONS_CITEES = [...new Set([...REGLES, ...COMPTER, ...MOTS].map(c => c.lecon).filter((l): l is string => !!l).concat(Object.keys(AIDE_DES_LECONS)))];
