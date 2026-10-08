// Version anglaise complète (#473) : chaque texte français a son anglais, et chaque texte anglais vise un texte
// français qui existe. Couvre tous les catalogues de l'interface (principal et écrans à part), les leçons, les
// problèmes, les refus du serveur et les rappels. Un texte ajouté en français sans son anglais (ou recopié tel quel)
// fait échouer ce test. Glossaire : docs/localisation/glossaire.md ; inventaire : docs/i18n/inventaire-anglais-2026-10.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fr as frAccueil } from './i18n/fr';
import { frEcrans } from './i18n/frEcrans';
import { en } from './i18n/en';
import { CATALOGUE_AMIS } from './i18n/amis';
import { CATALOGUE_CLUB } from './i18n/club';
import { CATALOGUE_COTE } from './i18n/cote';
import { CATALOGUE_DIRECT } from './i18n/direct';
import { CATALOGUE_EMULATION } from './i18n/emulation';
import { CATALOGUE_LENTE } from './i18n/lente';
import { CATALOGUE_PARTAGE } from './i18n/partage';
import { CATALOGUE_SECURITE } from './i18n/securite';
import { CATALOGUE_REFUS, messageServeur } from './i18n/refus';
import { LESSONS_FR, CHAPITRES } from './lessons';
import { CHAPITRES_EN, LESSONS_EN } from '../../content/lessons.en.js';
import { ALL_PUZZLES } from './puzzles';
import { PROBLEMES_EN } from './problemes.en';
import { ACQUIS } from './acquis';
import { TEXTES as RAPPELS } from '../../supabase/functions/envoyer-rappels/logique';
import { MOVE_ERROR_MESSAGES } from '../go/server';

type Brut = Record<string, unknown>;
const textes = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));
const variables = (v: unknown) => [...new Set(textes(v).flatMap(s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1])))].filter(x => x !== 'n').sort();

/** Tous les catalogues de l'interface : [nom, français, anglais]. */
const CATALOGUES: [string, Brut, Brut][] = [
  ['principal (fr.ts + frEcrans.ts / en.ts)', { ...frAccueil, ...frEcrans }, en],
  ['amis', CATALOGUE_AMIS.fr, CATALOGUE_AMIS.en],
  ['club', CATALOGUE_CLUB.fr, CATALOGUE_CLUB.en],
  ['cote', CATALOGUE_COTE.fr, CATALOGUE_COTE.en],
  ['direct', CATALOGUE_DIRECT.fr, CATALOGUE_DIRECT.en],
  ['emulation', CATALOGUE_EMULATION.fr, CATALOGUE_EMULATION.en],
  ['lente', CATALOGUE_LENTE.fr, CATALOGUE_LENTE.en],
  ['partage', CATALOGUE_PARTAGE.fr, CATALOGUE_PARTAGE.en],
  ['securite', CATALOGUE_SECURITE.fr, CATALOGUE_SECURITE.en],
  ['refus du serveur', CATALOGUE_REFUS.fr, CATALOGUE_REFUS.en],
];

/**
 * Mots qui s'écrivent pareil dans les deux langues : termes du go (glossaire), noms propres, unités. Un texte anglais
 * identique au français n'est accepté que s'il n'est fait que de ces mots (et de variables, chiffres, symboles).
 */
const INVARIABLES = new Set(['mochi', 'go', 'kaya', 'xp', 'capture', 'atari', 'double', 'seki', 'ko', 'komi', 'superko', 'suicide',
  'handicap', 'hane', 'tesuji', 'joseki', 'français', 'english', 'auto', 'version', 'novice', 'score', 'excellent', 'pts',
  'point', 'points', 'ogs', 'fox', 'kgs', 'placement', 'normal', 'long', 'min', 's', 'messages']);
const invariable = (v: unknown) => textes(v).every(s => s.replace(/\{\w+\}/g, ' ').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).every(m => INVARIABLES.has(m)));

/** Lettres françaises interdites dans l'anglais, hors noms propres (Rivière, Français) et mots repris tels quels. */
const ACCENTS = /[àâçéèêëîïôûùœ]/i;
const sansNoms = (s: string) => s.replace(/Rivière|Français|café|naïve|résumé/g, '');

describe.each(CATALOGUES)('catalogue %s', (_nom, FR, EN) => {
  it('chaque clé française a son anglais, et chaque clé anglaise existe en français', () => {
    expect(Object.keys(FR).filter(k => !(k in EN)), 'clés sans anglais').toEqual([]);
    expect(Object.keys(EN).filter(k => !(k in FR)), 'clés anglaises sans français').toEqual([]);
  });

  it('aucun texte anglais vide, même forme (texte ou pluriel) et mêmes variables que le français', () => {
    for (const k of Object.keys(FR)) {
      for (const s of textes(EN[k])) expect(s.trim(), k).not.toBe('');
      expect(typeof EN[k], k).toBe(typeof FR[k]);
      expect(variables(EN[k]), k).toEqual(variables(FR[k]));
    }
  });

  it('aucun texte resté en français : pas d’accent, pas de copie du français (sauf mots invariables)', () => {
    const accents = Object.keys(EN).filter(k => textes(EN[k]).some(s => ACCENTS.test(sansNoms(s))));
    expect(accents).toEqual([]);
    const copies = Object.keys(FR).filter(k => JSON.stringify(EN[k]) === JSON.stringify(FR[k]) && !invariable(FR[k]));
    expect(copies).toEqual([]);
  });
});

describe('leçons et chapitres', () => {
  it('chaque leçon et chaque chapitre français a son anglais, et inversement', () => {
    expect(LESSONS_FR.map(l => l.id).filter(id => !(id in LESSONS_EN))).toEqual([]);
    expect(Object.keys(LESSONS_EN).filter(id => !LESSONS_FR.some(l => l.id === id))).toEqual([]);
    expect(CHAPITRES.map(c => c.id).filter(id => !(id in CHAPITRES_EN))).toEqual([]);
    expect(Object.keys(CHAPITRES_EN).filter(id => !CHAPITRES.some(c => c.id === id))).toEqual([]);
  });

  it('chaque leçon a sa phrase de fin (« ce que tu sais faire ») dans les deux langues', () => {
    for (const { id } of LESSONS_FR) {
      expect(ACQUIS[id], id).toBeTruthy();
      expect(en[`acquis.${id}` as keyof typeof en], id).toBeTruthy();
    }
  });
  // Le détail (étapes, réponses, nombres, coordonnées, 12 mots) : src/content/lessons.en.test.ts.
});

describe('problèmes', () => {
  it('chaque problème (lots locaux et copie de la table `puzzles`) a son anglais, et inversement', () => {
    expect(ALL_PUZZLES.map(p => p.id).filter(id => !PROBLEMES_EN[id])).toEqual([]);
    expect(Object.keys(PROBLEMES_EN).filter(id => !ALL_PUZZLES.some(p => p.id === id))).toEqual([]);
  });
  // Le détail (champs, coordonnées, nombres, longueurs) : src/content/problemes.en.test.ts.
});

describe('refus du serveur (game-action)', () => {
  const sources = ['../go/server.ts', '../go/defi-action.ts', '../../supabase/functions/game-action/index.ts']
    .map(f => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')).join('\n');
  /** Codes et messages que le serveur peut renvoyer : `refuse(statut, 'code', 'message')` et les erreurs de coup. */
  const emis = new Map<string, string>([...sources.matchAll(/refuse\([^,]+, '([a-z-]+)', '([^'`]+)'/g)].map(m => [m[1], m[2]]));
  for (const [code, message] of Object.entries(MOVE_ERROR_MESSAGES)) emis.set(code, message);

  it('chaque code émis par le serveur a son texte anglais', () => {
    expect(emis.size).toBeGreaterThan(20);
    expect([...emis.keys()].filter(c => !(c in CATALOGUE_REFUS.en))).toEqual([]);
  });

  it('le français du catalogue recopie le message du serveur', () => {
    for (const [code, message] of emis) expect(CATALOGUE_REFUS.fr[code as keyof typeof CATALOGUE_REFUS.fr], code).toBe(message);
  });

  it('en anglais, jamais le message français du serveur ; en français, le message du serveur tel quel', () => {
    expect(messageServeur('superko', MOVE_ERROR_MESSAGES.superko, 'en')).toBe('Illegal move: this position has already happened (superko).');
    expect(messageServeur('nouveau-code', 'Message inconnu.', 'en')).toBe(CATALOGUE_REFUS.en.autre);
    expect(messageServeur('temps', 'Temps écoulé : la partie est finie (B+T).', 'fr')).toBe('Temps écoulé : la partie est finie (B+T).');
    expect(messageServeur(undefined, undefined, 'fr')).toBe(CATALOGUE_REFUS.fr.autre);
  });
});

describe('rappels du Go du jour (notifications)', () => {
  it('autant de textes en anglais qu’en français, aucun vide ni accentué', () => {
    expect(RAPPELS.en).toHaveLength(RAPPELS.fr.length);
    for (const r of RAPPELS.en) for (const s of [r.titre, r.texte]) {
      expect(s.trim()).not.toBe('');
      expect(s).not.toMatch(ACCENTS);
    }
  });
});
