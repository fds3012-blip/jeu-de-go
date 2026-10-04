// Course aux problèmes (issue #287) : tirage, minuteur, fin à 3 erreurs, meilleur score et texte partagé.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { choisirLangue } from '../content/i18n';
import { fr as CATALOGUE_FR } from '../content/i18n/fr';
import { COTE_DEPART, ECART_CIBLE } from './coteJoueur';
import {
  DUREE_COURSE, ERREURS_MAX, MEILLEUR_COURSE_KEY, PROBLEMES_MIN, apresCourse, commencer, departPour, dureeSecondes,
  formatTemps, lireMeilleurCourse, nettoyerMeilleur, palierAnnonce, problemeEnCours, repondre, restant, texteCourse,
  tirerCourse, verifierTemps
} from './course';

// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });

const LISTE = parsePuzzles(ALL_PUZZLES);
const difficulte = new Map(LISTE.map(p => [p.id, p.difficulty]));
const T0 = 1_000_000;

describe('tirage', () => {
  it('sans doublon, difficultés non décroissantes', () => {
    for (const cote of [0, COTE_DEPART, 900, 1500, 3000]) {
      const ordre = tirerCourse([...LISTE, ...LISTE.slice(0, 10)], cote);
      expect(new Set(ordre).size).toBe(ordre.length);
      const d = ordre.map(id => difficulte.get(id)!);
      for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    }
  });

  it('part un peu sous la cote du joueur : au-dessus du départ, et le plus facile de ceux-là', () => {
    const cote = 1000;
    const depart = departPour(cote);
    expect(depart).toBeLessThan(cote - ECART_CIBLE);
    const ordre = tirerCourse(LISTE, cote);
    const premier = difficulte.get(ordre[0])!;
    expect(premier).toBeGreaterThanOrEqual(depart);
    expect(LISTE.filter(p => p.difficulty >= depart).every(p => p.difficulty >= premier)).toBe(true);
    // Un nouveau joueur commence par les plus faciles.
    const debutant = tirerCourse(LISTE, COTE_DEPART);
    expect(difficulte.get(debutant[0])).toBe(Math.min(...LISTE.map(p => p.difficulty)));
  });

  it('garde toujours assez de problèmes devant soi, même pour une cote très haute', () => {
    expect(tirerCourse(LISTE, 3000).length).toBe(Math.min(PROBLEMES_MIN, LISTE.length));
  });

  it('exclut le Go du jour, et deux courses ne se ressemblent pas à difficulté égale', () => {
    const exclu = LISTE[0].id;
    expect(tirerCourse(LISTE, COTE_DEPART, { exclure: [exclu] })).not.toContain(exclu);
    const a = tirerCourse(LISTE, COTE_DEPART, { alea: () => 0.1 });
    let x = 0;
    const b = tirerCourse(LISTE, COTE_DEPART, { alea: () => (x = (x * 9301 + 49297) % 233280) / 233280 });
    expect(new Set(a)).toEqual(new Set(b));
    expect(a).not.toEqual(b);
  });

  it('une liste vide finit la course tout de suite', () => {
    expect(commencer([], T0).fin?.raison).toBe('epuise');
  });
});

describe('minuteur', () => {
  it('3 minutes, puis la course s’arrête sur le temps', () => {
    const e = commencer(['a', 'b', 'c'], T0);
    expect(DUREE_COURSE).toBe(180_000);
    expect(restant(e, T0)).toBe(180_000);
    expect(restant(e, T0 + 60_000)).toBe(120_000);
    expect(verifierTemps(e, T0 + 179_999)).toBe(e);
    const fin = verifierTemps(e, T0 + 181_000);
    expect(fin.fin).toEqual({ raison: 'temps', a: T0 + DUREE_COURSE });
    expect(restant(fin, T0 + 500_000)).toBe(0);
    expect(dureeSecondes(fin, T0 + 500_000)).toBe(180);
    expect(problemeEnCours(fin)).toBeUndefined();
  });

  it('une réponse après les 3 minutes ne compte pas', () => {
    const e = commencer(['a', 'b', 'c'], T0);
    const r = repondre(e, true, T0 + DUREE_COURSE + 1);
    expect(r.score).toBe(0);
    expect(r.fin?.raison).toBe('temps');
  });

  it('affiche m:ss, arrondi vers le haut', () => {
    expect(formatTemps(180_000)).toBe('3:00');
    expect(formatTemps(179_001)).toBe('3:00');
    expect(formatTemps(125_000)).toBe('2:05');
    expect(formatTemps(400)).toBe('0:01');
    expect(formatTemps(0)).toBe('0:00');
    expect(formatTemps(-5)).toBe('0:00');
  });

  it('annonce le temps toutes les 30 s seulement, jamais 3:00 ni 0:00', () => {
    const annonces: number[] = [];
    let avant = DUREE_COURSE;
    for (let r = DUREE_COURSE - 250; r >= 0; r -= 250) {
      const a = palierAnnonce(avant, r);
      if (a !== null) annonces.push(a);
      avant = r;
    }
    expect(annonces).toEqual([150_000, 120_000, 90_000, 60_000, 30_000]);
    // Un saut (onglet en veille) annonce le dernier palier franchi, une seule fois.
    expect(palierAnnonce(125_000, 55_000)).toBe(60_000);
    expect(palierAnnonce(119_000, 118_000)).toBeNull();
  });
});

describe('erreurs et score', () => {
  it('le score monte à chaque bonne réponse, un seul essai par problème', () => {
    let e = commencer(['a', 'b', 'c', 'd'], T0);
    e = repondre(e, true, T0 + 1000);
    expect(e).toMatchObject({ score: 1, erreurs: 0, rang: 1 });
    expect(problemeEnCours(e)).toBe('b');
    e = repondre(e, false, T0 + 2000);
    expect(e).toMatchObject({ score: 1, erreurs: 1, rang: 2 });
    expect(problemeEnCours(e)).toBe('c');
  });

  it('s’arrête à la 3e erreur', () => {
    let e = commencer(['a', 'b', 'c', 'd', 'e', 'f'], T0);
    e = repondre(e, false, T0 + 1000);
    e = repondre(e, true, T0 + 2000);
    e = repondre(e, false, T0 + 3000);
    expect(e.fin).toBeUndefined();
    e = repondre(e, false, T0 + 4000);
    expect(ERREURS_MAX).toBe(3);
    expect(e).toMatchObject({ score: 1, erreurs: 3, fin: { raison: 'erreurs', a: T0 + 4000 } });
    expect(dureeSecondes(e, T0 + 99_000)).toBe(4);
    // Plus rien ne compte après la fin.
    expect(repondre(e, true, T0 + 5000)).toBe(e);
  });

  it('s’arrête quand il n’y a plus de problème', () => {
    let e = commencer(['a', 'b'], T0);
    e = repondre(e, true, T0 + 1000);
    e = repondre(e, true, T0 + 2000);
    expect(e.fin?.raison).toBe('epuise');
    expect(e.score).toBe(2);
  });
});

describe('meilleur score', () => {
  beforeEach(() => localStorage.clear());

  it('ne monte que s’il est battu, jamais pour 0', () => {
    expect(apresCourse(0, 0)).toEqual({ meilleur: 0, nouveau: false });
    expect(apresCourse(0, 5)).toEqual({ meilleur: 5, nouveau: true });
    expect(apresCourse(17, 14)).toEqual({ meilleur: 17, nouveau: false });
    expect(apresCourse(17, 17)).toEqual({ meilleur: 17, nouveau: false });
    expect(apresCourse(17, 18)).toEqual({ meilleur: 18, nouveau: true });
  });

  it('relu du stockage, sous la clé citée dans la politique de confidentialité', () => {
    expect(MEILLEUR_COURSE_KEY).toBe('go.course-meilleur.v1');
    expect(lireMeilleurCourse()).toBe(0);
    localStorage.setItem(MEILLEUR_COURSE_KEY, '12');
    expect(lireMeilleurCourse()).toBe(12);
    localStorage.setItem(MEILLEUR_COURSE_KEY, '{abîmé');
    expect(lireMeilleurCourse()).toBe(0);
    for (const x of [null, -3, 'dix', Number.NaN, Infinity, {}]) expect(nettoyerMeilleur(x)).toBe(0);
    expect(nettoyerMeilleur(7.8)).toBe(7);
  });
});

describe('texte partagé', () => {
  afterEach(() => choisirLangue('fr'));

  it('sans spoiler : score, durée, meilleur score et le lien', () => {
    const p = texteCourse(14, 17);
    expect(p.texte).toBe('Course de go : 14 problèmes en 3 min · meilleur 17');
    expect(p.url).toBe('https://mochi-go.app/');
    expect(p.complet).toBe(`${p.texte}\n${p.url}`);
    expect(texteCourse(1, 1).texte).toBe('Course de go : 1 problème en 3 min · meilleur 1');
    expect(texteCourse(0, 0).texte).toBe('Course de go : 0 problème en 3 min');
    // Jamais une coordonnée (A1 à T19) dans le texte.
    expect(p.complet).not.toMatch(/\b[A-HJ-T]1?\d\b/);
  });

  it('en anglais', () => {
    choisirLangue('en');
    expect(texteCourse(14, 17).texte).toBe('Go rush: 14 puzzles in 3 min · best 17');
  });
});

describe('règle de Florian : les problèmes restent infinis', () => {
  it('aucun texte de la course ne parle d’un total ni d’une fin des problèmes', () => {
    const textes = Object.entries(CATALOGUE_FR).filter(([k]) => k.startsWith('course.')).flatMap(([, v]) => (typeof v === 'string' ? [v] : Object.values(v)));
    expect(textes.length).toBeGreaterThan(10);
    for (const s of textes) expect(s).not.toMatch(/c.est fini|tout est résolu|tous les problèmes|\d+\s\/\s\d+/i);
  });
});
