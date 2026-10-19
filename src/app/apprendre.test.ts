import { describe, expect, it } from 'vitest';
import { CHAPITRES, LESSONS } from '../content/lessons';
import { ACQUIS, acquis } from '../content/acquis';
import { FETES_KEY, boutonChemin, chapitresAFeter, dureeMinutes, etapes, finDeLecon, nomLecon, titreCourt, type Progression } from './apprendre';

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

describe('nomLecon : nom accessible d’une leçon (carte, page d’un thème)', () => {
  it('rang, titre, état, puis le verrou du compte', () => {
    const [l1, , , l4] = etapes(LESSONS, { l1: 99 });
    expect(nomLecon(l1)).toBe('Leçon 1 : Libertés et capture, terminée');
    expect(nomLecon(etapes(LESSONS, {})[0])).toBe('Leçon 1 : Libertés et capture, prochaine étape');
    expect(nomLecon(l4, true)).toBe('Leçon 4 : Le ko, avec un compte');
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
  it('« Les bases » (l1 à l7) est complet ; les chapitres 2 à 7 (ouverture, capturer et sauver, vie et mort, fin de partie, formes et tesuji, ouvertures célèbres) sont en cours d’écriture', () => {
    // Chaque chapitre commence par ses leçons d'origine ; les chapitres 2 à 6 grandissent au fil du programme (#16).
    const debuts = [['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'], ['l8'], ['l9', 'l10', 'l11'], ['l12', 'l13', 'l14', 'l17'], ['l15', 'l16'], ['l18', 'l19', 'l20'], []];
    // #547 : les leçons 41 et suivantes s'intercalent (l42 après le filet, l43 après les bonnes formes) sans changer cet ordre.
    const origine = (ids: string[]) => ids.filter(id => Number(id.slice(1)) <= 40);
    expect(CHAPITRES.map(c => origine(c.lecons.map(l => l.id)).slice(0, debuts[CHAPITRES.indexOf(c)].length))).toEqual(debuts);
    expect(CHAPITRES[0].lecons).toHaveLength(7);
    expect(CHAPITRES.map(c => c.complet)).toEqual([true, false, false, false, false, false, false]);
    // #672 : « Les ouvertures célèbres » (l50 à l56), en dernier.
    expect(CHAPITRES.at(-1)!.lecons.map(l => l.id)).toEqual(['l50', 'l51', 'l52', 'l53', 'l54', 'l55', 'l56']);
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
});
