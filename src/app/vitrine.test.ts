import { describe, expect, it } from 'vitest';
import { A_GAGNER_VISIBLES, BADGES, BADGES_SERIE, DU_MOMENT, FAMILLE, SEUILS_BADGES, adversairesBattus, badges, memoriser, statistiques, victoires, vitrineRepliee, type Donnees } from './vitrine';
import { traduire } from '../content/i18n/secondaires';

const vide: Donnees = { reussis: 0, serie: 0, parties: 0, bilan: {}, paliers: [] };

describe('statistiques du profil', () => {
  it('compte les victoires de tous les adversaires', () => {
    expect(victoires({ pomme: { v: 2, d: 1 }, caillou: { v: 1, d: 0 } })).toBe(3);
  });
  it('Ton parcours (#214) : record, leçons, adversaires battus, problèmes réussis (sans total), légendes accordées', () => {
    const s = statistiques({ ...vide, reussis: 1, serie: 3, parties: 0, record: 5 }, { lecons: { faites: 2, total: 7 }, adversaires: 9 });
    expect(s.map(x => x.id)).toEqual(['record', 'lecons', 'adversaires', 'problemes']);
    expect(s[0]).toMatchObject({ valeur: 5, legende: 'jours, ta série record' });
    expect(s[1]).toMatchObject({ valeur: 2, total: 7, legende: 'leçons finies' });
    expect(s[2]).toMatchObject({ valeur: 0, total: 9, legende: 'adversaire battu' });
    expect(s[3]).toMatchObject({ valeur: 1, legende: 'problème réussi' });
    expect(s[3].total).toBeUndefined();
  });
  it('adversaires battus : ceux gagnés au moins une fois, pas les défaites', () => {
    const bilan = { pomme: { v: 3, d: 1 }, caillou: { v: 1, d: 2 }, bambou: { v: 0, d: 4 } };
    expect(adversairesBattus(bilan)).toBe(2);
    expect(statistiques({ ...vide, bilan }, { lecons: { faites: 0, total: 7 }, adversaires: 9 })[2]).toMatchObject({ valeur: 2, total: 9, legende: 'adversaires battus' });
  });
});

describe('badges', () => {
  it('nouveau joueur : 21 badges (#529), tous grisés avec une condition', () => {
    const b = badges(vide);
    expect(b).toHaveLength(21);
    expect(b.every(x => !x.obtenu && x.condition.length > 0)).toBe(true);
  });
  it('se déduisent des données locales, obtenus en premier', () => {
    const b = badges({ reussis: 10, serie: 7, parties: 2, bilan: { pomme: { v: 1, d: 0 } }, paliers: [{ id: 'debutant', complet: true }, { id: 'novice', complet: false }] });
    const obtenus = b.filter(x => x.obtenu).map(x => x.id);
    expect(obtenus).toEqual(['premiere-partie', 'premier-probleme', 'victoire-pomme', 'dix-problemes', 'serie-7', 'palier-debutant']);
    expect(b[b.length - 1].id).toBe('serie-30');
  });
  it('#233 : une victoire contre un adversaire plus fort que Pomme donne aussi le badge (joueur placé, #283)', () => {
    expect(badges({ ...vide, bilan: { renard: { v: 1, d: 2 } } }).find(x => x.id === 'victoire-pomme')!.obtenu).toBe(true);
    expect(badges({ ...vide, bilan: { renard: { v: 0, d: 2 } } }).find(x => x.id === 'victoire-pomme')!.obtenu).toBe(false);
  });
  it('9 problèmes ne suffisent pas pour le badge des 10, une défaite contre Pomme non plus', () => {
    const b = badges({ ...vide, reussis: 9, bilan: { pomme: { v: 0, d: 3 } } });
    expect(b.find(x => x.id === 'dix-problemes')!.obtenu).toBe(false);
    expect(b.find(x => x.id === 'victoire-pomme')!.obtenu).toBe(false);
  });
});

describe('badges élargis (#529)', () => {
  const plein: Donnees = {
    reussis: 50, serie: 3, record: 30, parties: 4, lecons: 7,
    bilan: { pomme: { v: 2, d: 0 }, caillou: { v: 1, d: 1 }, bambou: { v: 1, d: 3 } },
    paliers: [{ id: 'debutant', complet: true }, { id: 'novice', complet: true }],
    chapitres: ['c1'], course: 4, tailles: [9, 13, 19], maitrisees: 1, serieTheme: 5, revues: 2,
  };

  it('environ 20 badges, dans cinq familles, chacun avec un nom et une condition en français et en anglais', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(18);
    expect(BADGES.length).toBeLessThanOrEqual(24);
    expect(new Set(BADGES).size).toBe(BADGES.length);
    expect(new Set(Object.values(FAMILLE))).toEqual(new Set(['premiers-pas', 'regularite', 'maitrise', 'decouverte', 'social']));
    for (const id of BADGES) {
      for (const l of ['fr', 'en'] as const) {
        expect(traduire(l, `badge.${id}.nom`).length, `${l} ${id}`).toBeGreaterThan(1);
        expect(traduire(l, `badge.${id}.condition`), `${l} ${id}`).toMatch(/\.$/);
      }
    }
  });

  it('toutes les conditions se déduisent des données, sauf les badges du moment', () => {
    const b = badges(plein);
    for (const x of b) expect(x.obtenu, x.id).toBe(!DU_MOMENT.has(x.id));
  });

  it('les badges du moment ne viennent que de la liste gagnée, et ne se perdent jamais', () => {
    const gagnes = ['objectif-semaine', 'premiere-en-ligne', 'victoire-classee'];
    const b = badges(vide, gagnes);
    expect(b.filter(x => x.obtenu).map(x => x.id)).toEqual(['objectif-semaine', 'premiere-en-ligne', 'victoire-classee']);
    // Un badge gagné reste, même si la donnée qui l'a donné a disparu (Mes parties ne garde que 50 parties).
    expect(badges(vide, ['goban-19']).find(x => x.id === 'goban-19')!.obtenu).toBe(true);
    expect(memoriser([], badges(plein))).toHaveLength(BADGES.length - DU_MOMENT.size);
  });

  it('seuils : un de moins ne suffit pas', () => {
    const juste = (d: Partial<Donnees>) => badges({ ...vide, ...d }).filter(x => x.obtenu).map(x => x.id);
    expect(juste({ reussis: SEUILS_BADGES.problemes - 1 })).not.toContain('cinquante-problemes');
    expect(juste({ reussis: SEUILS_BADGES.problemes })).toContain('cinquante-problemes');
    expect(juste({ record: SEUILS_BADGES.serieLongue - 1 })).not.toContain('serie-30');
    expect(juste({ serie: SEUILS_BADGES.serieLongue })).toContain('serie-30');
    expect(juste({ serieTheme: SEUILS_BADGES.serieTheme - 1 })).not.toContain('serie-theme');
    expect(juste({ bilan: { pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 0 }, bambou: { v: 0, d: 5 } } })).not.toContain('trois-adversaires');
    expect(juste({ tailles: [9] })).toEqual([]);
    expect(juste({ chapitres: ['c2'] })).toEqual([]);
    expect(juste({ course: 0 })).toEqual([]);
  });

  it('#137 : aucun badge ne dit un total de problèmes ni une cote', () => {
    for (const id of BADGES) for (const l of ['fr', 'en'] as const) {
      expect(traduire(l, `badge.${id}.condition`)).not.toMatch(/\b\d+\s*(sur|of|\/)\s*\d+|cote|rating/i);
    }
  });

  it('vitrine repliée : les gagnés, puis les 4 prochains dans l’ordre du parcours', () => {
    const r = vitrineRepliee(badges(vide));
    expect(r.map(x => x.id)).toEqual(['premiere-partie', 'premier-probleme', 'premiere-lecon', 'victoire-pomme']);
    expect(A_GAGNER_VISIBLES).toBe(4);
    const r2 = vitrineRepliee(badges({ ...vide, reussis: 12 }));
    expect(r2.filter(x => x.obtenu).map(x => x.id)).toEqual(['premier-probleme', 'dix-problemes']);
    expect(r2).toHaveLength(2 + A_GAGNER_VISIBLES);
  });

  it('les badges de série se cachent avec la série (#365)', () => {
    expect([...BADGES_SERIE]).toEqual(['serie-7', 'serie-30']);
  });
});
