import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { ACQUIS, acquis } from '../content/acquis';
import { CHAPITRES_A_VENIR, boutonChemin, etapes, repliqueMochi, titreCourt, trace, traceJusqua } from './apprendre';

const plein = (id: string) => LESSONS.find(l => l.id === id)!.steps.length;

describe('etapes : état des pierres du chemin', () => {
  it('chemin neuf : la leçon 1 est en cours, les autres à venir', () => {
    const e = etapes(LESSONS, {});
    expect(e.map(x => x.etat)).toEqual(['encours', 'avenir', 'avenir', 'avenir', 'avenir', 'avenir']);
    expect(e[0].rang).toBe(1);
  });
  it('leçon 1 finie, leçon 2 commencée', () => {
    const e = etapes(LESSONS, { l1: plein('l1'), l2: 1 });
    expect(e.slice(0, 3).map(x => x.etat)).toEqual(['faite', 'encours', 'avenir']);
    expect(e[1].faites).toBe(1);
  });
  it('une leçon faite plus loin reste cochée, la première pas finie est en cours', () => {
    const e = etapes(LESSONS, { l3: plein('l3') });
    expect(e[0].etat).toBe('encours');
    expect(e[2].etat).toBe('faite');
  });
  it('une progression trop grande est bornée au nombre d’étapes', () => {
    expect(etapes(LESSONS, { l1: 99 })[0].faites).toBe(plein('l1'));
  });
});

describe('boutonChemin', () => {
  it('« Commencer » sur un chemin neuf', () => {
    expect(boutonChemin(LESSONS, {})).toEqual({ texte: 'Commencer', id: 'l1' });
  });
  it('« Continuer : » avec le titre court de la prochaine leçon', () => {
    expect(boutonChemin(LESSONS, { l1: plein('l1') })).toEqual({ texte: 'Continuer : Atari', id: 'l2' });
    expect(boutonChemin(LESSONS, { l1: 1 })).toEqual({ texte: 'Continuer : Libertés et capture', id: 'l1' });
  });
  it('chemin fini : revoir la première leçon', () => {
    const tout = Object.fromEntries(LESSONS.map(l => [l.id, l.steps.length]));
    expect(boutonChemin(LESSONS, tout)).toEqual({ texte: 'Revoir : Libertés et capture', id: 'l1' });
    expect(boutonChemin([], {})).toBeNull();
  });
  it('titreCourt garde la partie avant les deux-points', () => {
    expect(titreCourt('Atari : attaquer et se sauver')).toBe('Atari');
    expect(titreCourt('Atari : attaquer')).toBe('Atari');
    expect(titreCourt('Le ko')).toBe('Le ko');
  });
});

describe('repliqueMochi', () => {
  it('courte, et différente selon l’état', () => {
    expect(repliqueMochi(etapes(LESSONS, {})[0])).toBe('On commence ici !');
    expect(repliqueMochi(etapes(LESSONS, { l1: 1 })[0])).toBe('On reprend ici ?');
    expect(repliqueMochi(etapes(LESSONS, { l1: plein('l1') })[1])).toBe('À toi, deux minutes !');
    expect(repliqueMochi(undefined)).toMatch(/Bravo/);
  });
});

describe('trace : chemin qui serpente', () => {
  it('une pierre par leçon, qui alterne de gauche à droite, de haut en bas', () => {
    const t = trace(6);
    expect(t.pierres).toHaveLength(6);
    for (let i = 1; i < 6; i++) {
      expect(t.pierres[i].y).toBeGreaterThan(t.pierres[i - 1].y);
      expect(Math.sign(t.pierres[i].x - 50)).toBe(-Math.sign(t.pierres[i - 1].x - 50));
    }
    expect(t.hauteur).toBeGreaterThan(t.pierres[5].y);
  });
  it('les pierres restent dans la largeur, avec la place d’un titre de l’autre côté', () => {
    for (const p of trace(12).pierres) { expect(p.x).toBeGreaterThanOrEqual(20); expect(p.x).toBeLessThanOrEqual(80); }
  });
  it('la place de la bulle de Mochi est réservée au-dessus de la pierre en cours', () => {
    const sans = trace(6), avec = trace(6, { bulle: 2, avant: 56 });
    expect(avec.pierres[1].y).toBe(sans.pierres[1].y);
    expect(avec.pierres[2].y - sans.pierres[2].y).toBe(56);
  });
  it('tracé : une courbe par intervalle, partie parcourue jusqu’à la pierre donnée', () => {
    const t = trace(6);
    expect(t.d.match(/C/g)).toHaveLength(5);
    expect(traceJusqua(t, 0)).toBe('');
    expect(traceJusqua(t, 2).match(/C/g)).toHaveLength(2);
    expect(traceJusqua(t, 99)).toBe(t.d);
    expect(trace(0)).toEqual({ pierres: [], hauteur: 0, d: '' });
  });
});

describe('textes', () => {
  it('chaque leçon a sa phrase de fin, courte', () => {
    for (const l of LESSONS) {
      expect(ACQUIS[l.id]).toBeTruthy();
      expect(acquis(l.id).length).toBeLessThan(80);
    }
    expect(acquis('inconnue')).toBeTruthy();
  });
  it('cinq chapitres annoncés, sans majuscules d’étiquette ni « A · B »', () => {
    expect(CHAPITRES_A_VENIR).toHaveLength(5);
    for (const c of CHAPITRES_A_VENIR) { expect(c).not.toMatch(/·/); expect(c).not.toBe(c.toUpperCase()); }
  });
});
