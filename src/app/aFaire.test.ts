import { describe, expect, it } from 'vitest';
import {
  DELAI_COUP_MS, MAX_ELEMENTS, SOURCES, elementDeLOnglet, elementsAFaire, leconEnCours, ongletsAPastille, sourceAmis,
  type DonneesAFaire, type DefiEnAttente,
} from './aFaire';
import { defisEnAttente } from './defisAJouer';
import { DELAI_COUP_MS as DELAI_SERVEUR } from '../data/defi';
import type { Game } from '../data/games';
import type { Defi, EtatDefi } from '../data/defi';
import { traduire } from '../content/i18n';

// Issue #367 : notifications dans l'app. Ce qui attend le joueur, sans le harceler.

describe('JS initial (budget, scripts/budget-bundle.mjs)', () => {
  it('l’app et l’adresse du défi ne tirent pas « À faire » ni les règles du défi au chargement', async () => {
    const { readFileSync } = await import('node:fs');
    const lire = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
    const statiques = (src: string) => [...src.matchAll(/^import (?!type )[^;]*?from '([^']+)'/gms)].map(m => m[1]);
    for (const f of ['./App.tsx', './useAFaire.ts', './adresseDefi.ts']) {
      expect(statiques(lire(f)).filter(m => /\/(aFaire|aFaireCharge|defisAJouer|defiAmi)$/.test(m)), f).toEqual([]);
    }
    expect(lire('./useAFaire.ts')).toContain("import('./aFaireCharge')");
  });
});

const sp = (s: string) => s.replace(/\u00a0/g, ' ');
const H = 3_600_000;
const base: DonneesAFaire = { premier: false, defis: [], serie: 0, duJourFait: true, goDuJour: { numero: 6, titre: 'L’échelle' }, leconEnCours: null };
const d = (p: Partial<DonneesAFaire>): DonneesAFaire => ({ ...base, ...p });
const defiDe = (p: Partial<DefiEnAttente> = {}): DefiEnAttente => ({ partieId: 'p1', adversaire: 'Léa', restant: 50 * H, comptage: false, ...p });

describe('état vide', () => {
  it('rien à faire : liste vide, aucune pastille', () => {
    const e = elementsAFaire(base);
    expect(e).toEqual([]);
    expect(ongletsAPastille(e).size).toBe(0);
  });

  it('les textes ne disent rien d’inquiétant (ni « perdre », ni « vite », ni « dernier »)', () => {
    for (const l of ['fr', 'en'] as const) {
      for (const k of ['aFaire.pastilleAria', 'aFaire.serie', 'aFaire.serieDetail', 'aFaire.goDuJour'] as const) {
        expect(traduire(l, k, { n: 3 })).not.toMatch(/perd|lose|lost|vite|hurry|dernier|last chance|!/i);
      }
    }
  });
});

describe('tout premier lancement (#236, N4)', () => {
  it('ni Go du jour ni leçon : la seule chose à faire est la première partie', () => {
    expect(elementsAFaire(d({ premier: true, duJourFait: false, leconEnCours: { id: 'l1', titre: 'Libertés' } }))).toEqual([]);
  });

  it('mais un ami qui attend ton coup se voit (l’ami arrivé par un lien n’a encore rien joué ici)', () => {
    const e = elementsAFaire(d({ premier: true, duJourFait: false, defis: [defiDe()] }));
    expect(e.map(x => x.genre)).toEqual(['defi']);
  });
});

describe('défi où c’est ton tour', () => {
  it('« C’est ton tour contre Léa », pastille sur Jouer, ouvre la partie', () => {
    const [e] = elementsAFaire(d({ defis: [defiDe()] }));
    expect(e).toMatchObject({ genre: 'defi', onglet: 'jouer', pastille: true, titre: 'C’est ton tour contre Léa', cible: { ecran: 'defi', partieId: 'p1' } });
    expect(sp(e.detail)).toBe('Partie entre amis · il te reste 2 jours et 2 h');
    expect([...ongletsAPastille([e])]).toEqual([['jouer', 'C’est ton tour contre Léa']]);
    expect(elementDeLOnglet([e], 'jouer')).toBe(e);
    expect(elementDeLOnglet([e], 'profil')).toBeUndefined();
  });

  it('sans pseudo connu, sans délai, au comptage', () => {
    expect(elementsAFaire(d({ defis: [defiDe({ adversaire: null, restant: null })] }))[0]).toMatchObject({ titre: 'C’est ton tour', detail: 'Partie entre amis' });
    expect(elementsAFaire(d({ defis: [defiDe({ comptage: true })] }))[0].titre).toBe('Compte des points avec Léa');
    expect(elementsAFaire(d({ defis: [defiDe({ comptage: true, adversaire: null })] }))[0].titre).toBe('Compte des points avec ton ami');
  });

  it('le plus pressé d’abord', () => {
    const e = elementsAFaire(d({ defis: [defiDe({ partieId: 'a', restant: 60 * H }), defiDe({ partieId: 'b', restant: 2 * H }), defiDe({ partieId: 'c', restant: null })] }));
    expect(e.map(x => x.id)).toEqual(['defi-b', 'defi-a', 'defi-c']);
  });

  it('mesure : heures depuis le coup de l’adversaire (délai médian de réponse)', () => {
    expect(DELAI_COUP_MS).toBe(DELAI_SERVEUR);
    expect(elementsAFaire(d({ defis: [defiDe({ restant: DELAI_COUP_MS - 5 * H })] }))[0].attenteH).toBe(5);
    expect(elementsAFaire(d({ defis: [defiDe({ restant: null })] }))[0].attenteH).toBeNull();
  });
});

describe('Go du jour et série', () => {
  it('série en jeu aujourd’hui : une ligne avec pastille sur Problèmes', () => {
    const [e] = elementsAFaire(d({ duJourFait: false, serie: 4 }));
    expect(e).toMatchObject({ genre: 'serie', onglet: 'problemes', pastille: true, titre: 'Garde ta série de 4 jours', cible: { ecran: 'goDuJour' } });
    expect(elementsAFaire(d({ duJourFait: false, serie: 1 }))[0].titre).toBe('Garde ta série de 1 jour');
  });

  it('sans série : le Go du jour, sans pastille (pas d’appel chaque jour)', () => {
    const [e] = elementsAFaire(d({ duJourFait: false, serie: 0 }));
    expect(e).toMatchObject({ genre: 'goDuJour', pastille: false, titre: 'Le Go du jour t’attend', detail: 'N° 6 · L’échelle' });
    expect(ongletsAPastille([e]).size).toBe(0);
  });

  it('fait, ou pas de Go du jour : rien', () => {
    expect(elementsAFaire(d({ duJourFait: true, serie: 4 }))).toEqual([]);
    expect(elementsAFaire(d({ duJourFait: false, goDuJour: null }))).toEqual([]);
  });
});

describe('leçon en cours', () => {
  const lecons = [{ id: 'l1', title: 'Libertés', steps: [1, 2, 3] }, { id: 'l2', title: 'Atari', steps: [1, 2] }, { id: 'l3', title: 'Ko', steps: [1, 2] }];
  it('la première leçon commencée et pas finie', () => {
    expect(leconEnCours(lecons, {})).toBeNull();
    expect(leconEnCours(lecons, { l1: 3 })).toBeNull();
    expect(leconEnCours(lecons, { l1: 3, l2: 1, l3: 1 })).toEqual({ id: 'l2', titre: 'Atari' });
  });

  it('une ligne sans pastille, qui rouvre la leçon', () => {
    const [e] = elementsAFaire(d({ leconEnCours: { id: 'l2', titre: 'Atari' } }));
    expect(e).toMatchObject({ genre: 'lecon', onglet: 'apprendre', pastille: false, titre: 'Reprends ta leçon', detail: 'Atari', cible: { ecran: 'lecon', id: 'l2' } });
  });
});

describe('ordre et longueur', () => {
  it('ami qui attend, puis série, puis leçon ; au plus MAX_ELEMENTS', () => {
    const e = elementsAFaire(d({ duJourFait: false, serie: 2, leconEnCours: { id: 'l2', titre: 'Atari' }, defis: [defiDe()] }));
    expect(e.map(x => x.genre)).toEqual(['defi', 'serie', 'lecon']);
    expect([...ongletsAPastille(e).keys()]).toEqual(['jouer', 'problemes']);
    const beaucoup = elementsAFaire(d({ duJourFait: false, defis: Array.from({ length: 9 }, (_, i) => defiDe({ partieId: String(i) })) }));
    expect(beaucoup).toHaveLength(MAX_ELEMENTS);
  });
});

describe('#359 amis : branchement prêt', () => {
  it('la source des amis est enregistrée, muette tant que `demandesAmis` est absent', () => {
    expect(SOURCES).toContain(sourceAmis);
    expect(sourceAmis(base)).toEqual([]);
    const [e] = elementsAFaire(d({ demandesAmis: 2 }));
    expect(e).toMatchObject({ genre: 'ami', onglet: 'profil', pastille: true, titre: '2 demandes d’ami', cible: { ecran: 'amis' } });
  });

  it('une source ajoutée à la liste suffit', () => {
    const e = elementsAFaire(base, [...SOURCES, () => [{ id: 'x', genre: 'ami', onglet: 'profil', pastille: false, titre: 'X', detail: '', cible: { ecran: 'amis' } }]]);
    expect(e.map(x => x.id)).toEqual(['x']);
  });
});

describe('EN', () => {
  it('textes anglais courts', () => {
    expect(traduire('en', 'aFaire.tourContre', { pseudo: 'Lea' })).toBe('Your move against Lea');
    expect(traduire('en', 'aFaire.serie', { n: 4 })).toBe('Keep your 4-day streak');
    expect(traduire('en', 'aFaire.pastilleAria')).toBe('something’s waiting');
  });
});

describe('défis lus sous la RLS : où c’est ton tour', () => {
  const T0 = Date.parse('2026-10-02T10:00:00Z');
  const partie = (p: Partial<Game>): Game => ({
    id: 'g', black_id: 'moi', white_id: 'lea', created_by: 'lea', size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
    status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false,
    analysis: null, bot_id: null, invite_code: null, score_black: null, score_white: null, created_at: '', updated_at: '', ...p,
  }) as Game;
  const ligne = (id: string, p: Partial<Game>): EtatDefi => ({
    partie: partie({ id, ...p }), resultat: p.result ?? null,
    defi: { partie_id: id, jeton: 'J'.repeat(32), createur_id: 'lea', invite_id: 'moi', delai_coup: '3 days', date_limite: new Date(T0 + 50 * H).toISOString(), lien_expire_le: '', cree_le: '' } as Defi,
  });

  it('garde seulement les parties où c’est à moi, avec l’id de l’adversaire', () => {
    const r = defisEnAttente([
      ligne('a', {}), // Noir commence : à moi
      ligne('b', { moves: 'ee' }), // à Léa
      ligne('c', { status: 'finished', result: 'B+R' }),
      ligne('d', { status: 'waiting', white_id: 'lea', black_id: null }),
    ], 'moi', T0);
    expect(r).toEqual([{ partieId: 'a', adversaire: null, adversaireId: 'lea', restant: 50 * H, comptage: false }]);
  });

  it('au comptage proposé par l’ami, c’est à moi de répondre', () => {
    const r = defisEnAttente([ligne('e', { moves: 'eett', counting: true, dead_proposed_by: 'lea' })], 'moi', T0);
    expect(r).toMatchObject([{ partieId: 'e', comptage: true }]);
  });
});
