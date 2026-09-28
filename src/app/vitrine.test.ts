import { describe, expect, it } from 'vitest';
import { adversairesBattus, badges, statistiques, victoires, type Donnees } from './vitrine';

const vide: Donnees = { reussis: 0, serie: 0, parties: 0, bilan: {}, paliers: [] };

describe('statistiques du profil', () => {
  it('compte les victoires de tous les adversaires', () => {
    expect(victoires({ pomme: { v: 2, d: 1 }, caillou: { v: 1, d: 0 } })).toBe(3);
  });
  it('Ton parcours (#214) : record, leçons, adversaires battus, problèmes réussis (sans total), légendes accordées', () => {
    const s = statistiques({ ...vide, reussis: 1, serie: 3, parties: 0, record: 5 }, { lecons: { faites: 2, total: 7 }, adversaires: 9 });
    expect(s.map(x => x.id)).toEqual(['record', 'lecons', 'adversaires', 'problemes']);
    expect(s[0]).toMatchObject({ valeur: 5, legende: 'jours, ton record' });
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
  it('nouveau joueur : sept badges, tous grisés avec une condition', () => {
    const b = badges(vide);
    expect(b).toHaveLength(7);
    expect(b.every(x => !x.obtenu && x.condition.length > 0)).toBe(true);
  });
  it('se déduisent des données locales, obtenus en premier', () => {
    const b = badges({ reussis: 10, serie: 7, parties: 2, bilan: { pomme: { v: 1, d: 0 } }, paliers: [{ id: 'debutant', complet: true }, { id: 'novice', complet: false }] });
    const obtenus = b.filter(x => x.obtenu).map(x => x.id);
    expect(obtenus).toEqual(['premiere-partie', 'premier-probleme', 'victoire-pomme', 'palier-debutant', 'dix-problemes', 'serie-7']);
    expect(b[b.length - 1].id).toBe('palier-novice');
  });
  it('9 problèmes ne suffisent pas pour le badge des 10, une défaite contre Pomme non plus', () => {
    const b = badges({ ...vide, reussis: 9, bilan: { pomme: { v: 0, d: 3 } } });
    expect(b.find(x => x.id === 'dix-problemes')!.obtenu).toBe(false);
    expect(b.find(x => x.id === 'victoire-pomme')!.obtenu).toBe(false);
  });
});
