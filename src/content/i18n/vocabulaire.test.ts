// Charte du vocabulaire (issue #237, docs/design/vocabulaire.md) : un mot par objet, un sens par mot.
// Ces tests lisent tout le catalogue français : un texte ajouté plus tard qui réintroduit un terme banni échoue ici.
import { fr as frAccueil } from './fr';
import { frEcrans } from './frEcrans';
// Tout le français (#433) : catalogue de l'accueil et des écrans secondaires.
const fr = { ...frAccueil, ...frEcrans };
import { traduire, type Cle } from './secondaires';
import { statistiques, RECORD_MIN } from '../../app/vitrine';
import { GENERIQUES } from '../../app/repliques';

const textes = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));
const entrees = (Object.keys(fr) as Cle[]).flatMap(k => textes(fr[k]).map(s => [k, s] as const));
const avec = (motif: RegExp) => entrees.filter(([, s]) => motif.test(s)).map(([k]) => k);

describe('boucle quotidienne : « série » et « Go du jour »', () => {
  it('jamais « jour(s) de suite » ni « défi du jour » : on dit « série »', () => {
    expect(avec(/jours? de suite/i)).toEqual([]);
    expect(avec(/défis? du jour|un défi par jour/i)).toEqual([]);
  });

  it('« défi » est réservé aux adversaires (défier, dernier défi de l’échelle, ami défié par lien #81)', () => {
    const cles = avec(/(^|[^\p{L}])défi(er|s)?([^\p{L}]|$)/iu);
    expect(cles.filter(k => !k.startsWith('defi.'))).toEqual(['adv.sensei.description', 'bilan.defier', 'creer.raison.defi']);
    expect(cles.filter(k => k.startsWith('defi.')).length).toBeGreaterThan(0);
  });

  it('« record » seulement à partir de 2 jours ; avant, la légende parle de série', () => {
    expect(RECORD_MIN).toBe(2);
    const vide = { reussis: 0, parties: 0, bilan: {}, paliers: [] };
    const p = { lecons: { faites: 0, total: 7 }, adversaires: 9 };
    const legende = (serie: number, record?: number) => statistiques({ ...vide, serie, record }, p)[0].legende;
    expect(legende(0)).toBe('jour de série');
    expect(legende(1, 1)).toBe('jour de série');
    expect(legende(2)).toBe('jours, ta série record');
    expect(legende(0, 7)).toBe('jours, ta série record');
    expect(avec(/jours? de record/i)).toEqual([]);
  });

  it('même légende de série partout (onglet Problèmes et Profil)', () => {
    expect([1, 3].map(n => traduire('fr', 'pb.serieLegende', { n }))).toEqual(['jour de série', 'jours de série']);
  });
});

describe('« Continuer » : un seul sens, l’étape suivante d’une leçon', () => {
  it('aucun autre bouton ne dit « Continuer »', () => {
    // Seule exception : « Continuer avec Google / Apple / Facebook », libellés imposés par leurs chartes (#354, #411).
    expect(avec(/^Continuer\b/)).toEqual(['apprendre.continuer', 'connexion.avec']);
    expect(['Google', 'Apple', 'Facebook'].map(nom => traduire('fr', 'connexion.avec', { nom })))
      .toEqual(['Continuer avec Google', 'Continuer avec Apple', 'Continuer avec Facebook']);
    expect(traduire('en', 'connexion.avec', { nom: 'Apple' })).toBe('Continue with Apple');
  });

  it('les autres boutons disent leur action', () => {
    expect(traduire('fr', 'pb.continuer')).toBe('Problème suivant');
    expect(traduire('fr', 'recit.continuer')).toBe('Voir le résultat');
    expect(traduire('fr', 'partie.passe.continuer')).toBe('Jouer encore');
    expect(traduire('fr', 'apprendre.reprendre')).toBe('Reprendre');
  });
});

describe('ton juste', () => {
  it('la revue ne nomme pas un adversaire que le débutant ne connaît pas', () => {
    const noms = /Caillou|Bambou|Renard|Rivière|Tigre|Montagne|Dragon|Sensei/;
    expect(avec(noms).filter(k => k.startsWith('revue.') || k.startsWith('cle.') || k.startsWith('note.'))).toEqual([]);
  });

  it('l’adversaire ne demande pas « Tu es sûr ? » ni « Déjà fini ? » quand tu passes', () => {
    for (const r of GENERIQUES.passeJoueur) expect(r).not.toMatch(/sûr|déjà fini/i);
    expect(avec(/tu es sûr|déjà fini/i)).toEqual([]);
  });
});

describe('typographie (#509, lot L6)', () => {
  // Noms accessibles seuls (aria-label), jamais affichés : gardés tels quels, les parcours e2e les citent.
  const NOMS_ACCESSIBLES = ['conseil.note.question', 'partie.retourAccueil', 'revue.courbe', 'serie.progression'];
  it('apostrophe typographique (’) entre deux lettres, jamais l’apostrophe droite', () => {
    expect(avec(/\p{L}'\p{L}/u).filter(k => !NOMS_ACCESSIBLES.includes(k))).toEqual([]);
  });
});
