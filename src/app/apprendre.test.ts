import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { ACQUIS, acquis } from '../content/acquis';
import { CHAPITRES_A_VENIR, LIGNE, boutonChemin, etapes, finDeLecon, titreCourt, trace, traceJusqua, type Progression } from './apprendre';

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
    expect(boutonChemin(LESSONS, {})).toEqual({ texte: 'Commencer', verbe: 'Commencer', id: 'l1' });
  });
  it('« Continuer : » avec le titre court de la prochaine leçon ; le bouton n’affiche que le verbe', () => {
    expect(boutonChemin(LESSONS, { l1: plein('l1') })).toEqual({ texte: 'Continuer : Atari', verbe: 'Continuer', id: 'l2' });
    expect(boutonChemin(LESSONS, { l1: 1 })).toEqual({ texte: 'Continuer : Libertés et capture', verbe: 'Continuer', id: 'l1' });
  });
  it('le nom lu contient le texte affiché (WCAG 2.5.3)', () => {
    const cas: Progression[] = [{}, { l1: 1 }, { l1: plein('l1') }];
    for (const p of cas) {
      const b = boutonChemin(LESSONS, p)!;
      expect(b.texte.startsWith(b.verbe)).toBe(true);
    }
  });
  it('chemin fini : revoir la première leçon', () => {
    const tout = Object.fromEntries(LESSONS.map(l => [l.id, l.steps.length]));
    expect(boutonChemin(LESSONS, tout)).toEqual({ texte: 'Revoir : Libertés et capture', verbe: 'Revoir', id: 'l1' });
    expect(boutonChemin([], {})).toBeNull();
  });
  it('titreCourt garde la partie avant les deux-points', () => {
    expect(titreCourt('Atari : attaquer et se sauver')).toBe('Atari');
    expect(titreCourt('Atari : attaquer')).toBe('Atari');
    expect(titreCourt('Le ko')).toBe('Le ko');
  });
});

describe('trace : chemin de pierres sur les lignes du goban', () => {
  it('une pierre par leçon, qui alterne de gauche à droite, de haut en bas', () => {
    const t = trace(6);
    expect(t.pierres).toHaveLength(6);
    for (let i = 1; i < 6; i++) {
      expect(t.pierres[i].y).toBeGreaterThan(t.pierres[i - 1].y);
      expect(Math.sign(t.pierres[i].x)).toBe(-Math.sign(t.pierres[i - 1].x));
    }
    expect(t.hauteur).toBeGreaterThan(t.pierres[5].y);
  });
  it('chaque pierre est sur une intersection du goban', () => {
    for (const p of trace(6, { encours: 3 }).pierres) {
      expect(Math.abs(p.x) % LIGNE).toBe(0);
      expect(p.y % LIGNE).toBe(0);
      expect(p.x).toBe(p.col * LIGNE);
    }
  });
  it('les pierres restent près du milieu : 390 px de large laissent la place d’un titre de l’autre côté', () => {
    for (const p of trace(12).pierres) { expect(Math.abs(p.col)).toBeGreaterThanOrEqual(1); expect(Math.abs(p.col)).toBeLessThanOrEqual(2); }
  });
  it('la leçon en cours a deux lignes de plus au-dessous, pour son bouton en relief', () => {
    const sans = trace(6), avec = trace(6, { encours: 2 });
    expect(avec.pierres[2].y).toBe(sans.pierres[2].y);
    expect(avec.pierres[3].y - avec.pierres[2].y).toBe(4 * LIGNE);
  });
  it('le tracé suit les lignes : que des segments verticaux et horizontaux', () => {
    const t = trace(6, { encours: 1 });
    expect(t.d).toMatch(/^M-?\d+ \d+([VH]-?\d+)+$/);
    expect(t.d.match(/H/g)).toHaveLength(5);
  });
  it('les virages passent entre les rangées, jamais sous le bouton de la leçon en cours', () => {
    const t = trace(6, { encours: 2 });
    const virages = [...t.d.matchAll(/V(\d+)H/g)].map(m => Number(m[1]));
    const enCours = t.pierres[2].y;
    expect(virages[1]).toBe(enCours - LIGNE);
    // Au-dessous : au moins trois lignes plus bas (titre, puis bouton en relief).
    expect(virages[2]).toBeGreaterThanOrEqual(enCours + 3 * LIGNE);
  });
  it('partie parcourue : jusqu’à la pierre donnée', () => {
    const t = trace(6, { encours: 3 });
    expect(traceJusqua(t, 0, 3)).toBe('');
    expect(traceJusqua(t, 2, 3).match(/H/g)).toHaveLength(2);
    expect(traceJusqua(t, 99, 3)).toBe(t.d);
    expect(t.d.startsWith(traceJusqua(t, 3, 3))).toBe(true);
    expect(trace(0)).toEqual({ pierres: [], hauteur: 0, d: '' });
  });
});

describe('finDeLecon', () => {
  it('« Leçon terminée », sauf la dernière du chapitre', () => {
    expect(finDeLecon(LESSONS, 'l1')).toEqual({ titre: 'Leçon terminée', derniere: false });
    expect(finDeLecon(LESSONS, LESSONS[LESSONS.length - 1].id)).toEqual({ titre: 'Chapitre terminé', derniere: true });
    expect(finDeLecon([], 'l1').derniere).toBe(false);
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
