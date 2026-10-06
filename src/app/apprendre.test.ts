import { describe, expect, it } from 'vitest';
import { CHAPITRES, LESSONS } from '../content/lessons';
import { ACQUIS, acquis } from '../content/acquis';
import { CHAPITRES_A_VENIR, FETES_KEY, boutonChemin, chapitresAFeter, colonne, courbe, dureeMinutes, etapes, finDeLecon, titreCourt, type Progression } from './apprendre';

const plein = (id: string) => LESSONS.find(l => l.id === id)!.steps.length;

describe('etapes : état des pierres du chemin', () => {
  it('chemin neuf : la leçon 1 est en cours, les autres à venir', () => {
    const e = etapes(LESSONS, {});
    expect(e.map(x => x.etat)).toEqual(['encours', ...Array(LESSONS.length - 1).fill('avenir')]);
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
  it('le verbe dit l’action (#237) : « Commencer » la leçon suivante, « Reprendre » une leçon entamée ; le bouton n’affiche que le verbe', () => {
    expect(boutonChemin(LESSONS, { l1: plein('l1') })).toEqual({ texte: 'Commencer la leçon : Atari', verbe: 'Commencer', id: 'l2' });
    expect(boutonChemin(LESSONS, { l1: 1 })).toEqual({ texte: 'Reprendre la leçon : Libertés et capture', verbe: 'Reprendre', id: 'l1' });
    expect(boutonChemin(LESSONS, { l1: plein('l1'), l2: 1 })).toEqual({ texte: 'Reprendre la leçon : Atari', verbe: 'Reprendre', id: 'l2' });
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

describe('courbe : le sentier qui serpente entre les pierres', () => {
  it('les colonnes alternent de gauche à droite, jamais deux fois du même côté', () => {
    for (let i = 1; i < 12; i++) expect(Math.sign(colonne(i))).toBe(-Math.sign(colonne(i - 1)));
    for (let i = 0; i < 12; i++) { expect(Math.abs(colonne(i))).toBeGreaterThanOrEqual(0.6); expect(Math.abs(colonne(i))).toBeLessThanOrEqual(1); }
  });
  it('passe par chaque ancre avec un arc en S (tangentes verticales), vide avec moins de deux points', () => {
    expect(courbe([])).toBe('');
    expect(courbe([{ x: 0, y: 10 }])).toBe('');
    const d = courbe([{ x: -92, y: 28 }, { x: 92, y: 120 }, { x: 0, y: 260 }]);
    expect(d).toBe('M-92 28C-92 74 92 74 92 120C92 190 0 190 0 260');
    expect(d.match(/C/g)).toHaveLength(2);
  });
  it('deux ancres alignées sont reliées en droite ligne (haut et bas de la carte)', () => {
    expect(courbe([{ x: 0, y: 0 }, { x: 0, y: 200 }])).toBe('M0 0L0 200');
  });
});

describe('dureeMinutes', () => {
  it('une vingtaine de secondes par étape, jamais moins d’une minute', () => {
    expect([1, 3, 5, 6, 8, 10].map(dureeMinutes)).toEqual([1, 1, 2, 2, 2, 3]);
    for (const l of LESSONS) expect(dureeMinutes(l.steps.length)).toBeGreaterThanOrEqual(1);
  });
});

describe('chapitresAFeter : la fête de fin de chapitre, une seule fois', () => {
  const tout = (ids: string[]) => Object.fromEntries(LESSONS.filter(l => ids.includes(l.id)).map(l => [l.id, l.steps.length]));
  it('un chapitre complet et fini, pas encore fêté', () => {
    expect(chapitresAFeter(CHAPITRES, tout(['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']), [])).toEqual(['c1']);
    expect(chapitresAFeter(CHAPITRES, tout(['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']), ['c1'])).toEqual([]);
    expect(chapitresAFeter(CHAPITRES, tout(['l1', 'l2']), [])).toEqual([]);
  });
  it('un chapitre en cours d’écriture ne se fête pas encore', () => {
    expect(chapitresAFeter(CHAPITRES, tout(['l8']), [])).toEqual([]);
    expect(FETES_KEY).toBe('go.fetes-chapitres.v1');
  });
});

describe('finDeLecon', () => {
  it('« Leçon terminée », sauf la dernière du chapitre', () => {
    expect(finDeLecon(LESSONS, 'l1')).toEqual({ titre: 'Leçon terminée', derniere: false });
    expect(finDeLecon(LESSONS, LESSONS[LESSONS.length - 1].id)).toEqual({ titre: 'Chapitre terminé', derniere: true });
    expect(finDeLecon([], 'l1').derniere).toBe(false);
  });
});

describe('chapitres (#228)', () => {
  it('chaque leçon est dans un seul chapitre, dans l’ordre du chemin', () => {
    expect(CHAPITRES.flatMap(c => c.lecons)).toEqual(LESSONS);
  });
  it('« Les bases » (l1 à l7) est complet ; les chapitres 2 à 6 (ouverture, capturer et sauver, vie et mort, fin de partie, formes et tesuji) sont en cours d’écriture', () => {
    expect(CHAPITRES.map(c => c.lecons.map(l => l.id))).toEqual([['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'], ['l8'], ['l9', 'l10', 'l11'], ['l12', 'l13', 'l14', 'l17'], ['l15', 'l16'], ['l18', 'l19', 'l20']]);
    expect(CHAPITRES.map(c => c.complet)).toEqual([true, false, false, false, false, false]);
    expect(CHAPITRES[0].titre).toBe('Les bases');
  });
  it('la leçon 7 finit « Les bases », pas le chemin : la leçon 8 est la prochaine étape', () => {
    const avant = Object.fromEntries(CHAPITRES[0].lecons.map(l => [l.id, l.steps.length]));
    expect(finDeLecon(CHAPITRES[0].lecons, 'l7').derniere).toBe(true);
    expect(etapes(LESSONS, avant).find(e => e.etat === 'encours')!.lecon.id).toBe('l8');
    expect(boutonChemin(LESSONS, avant)!.id).toBe('l8');
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
  it('un chapitre annoncé (« Formes et tesuji » est ouvert depuis le 05/10), sans majuscules d’étiquette ni « A · B », et aucun déjà ouvert sur le chemin (#16)', () => {
    expect(CHAPITRES_A_VENIR).toHaveLength(1);
    for (const c of CHAPITRES_A_VENIR) expect(CHAPITRES.map(x => x.titre)).not.toContain(c);
    for (const c of CHAPITRES_A_VENIR) { expect(c).not.toMatch(/·/); expect(c).not.toBe(c.toUpperCase()); }
  });
});
