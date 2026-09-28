import { describe, expect, it } from 'vitest';
import { CHAPITRES, LESSONS } from '../content/lessons';
import { ACQUIS, acquis } from '../content/acquis';
import { CHAPITRES_A_VENIR, LIGNE, MARGE_RANGEE, boutonChemin, placeSousLigne, etapes, finDeLecon, titreCourt, trace, traceJusqua, type Progression } from './apprendre';

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
  it('sept leçons au chapitre 1 (#177) : sept pierres, toujours sur les lignes et près du milieu', () => {
    expect(CHAPITRES[0].lecons).toHaveLength(7);
    const t = trace(CHAPITRES[0].lecons.length, { encours: 6 });
    expect(t.pierres).toHaveLength(7);
    for (let i = 1; i < 7; i++) expect(Math.sign(t.pierres[i].x)).toBe(-Math.sign(t.pierres[i - 1].x));
    expect(t.hauteur).toBeGreaterThan(t.pierres[6].y);
  });
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
  it('dernière leçon en cours (#177) : sa place reste réservée sous le chemin, plus une ligne de marge', () => {
    expect(trace(7, { encours: 6 }).hauteur - trace(7).hauteur).toBe(3 * LIGNE);
    expect(trace(7, { encours: 6, bas: [0, 0, 0, 0, 0, 0, 100] }).hauteur - trace(7).hauteur).toBe(3 * LIGNE);
    expect(trace(7, { encours: 6, bas: [0, 0, 0, 0, 0, 0, 300] }).hauteur).toBe(trace(7).pierres[6].y + 336 + LIGNE);
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
    expect(traceJusqua(t, 0)).toBe('');
    expect(traceJusqua(t, 2).match(/H/g)).toHaveLength(2);
    expect(traceJusqua(t, 99)).toBe(t.d);
    expect(t.d.startsWith(traceJusqua(t, 3))).toBe(true);
    expect(trace(0)).toEqual({ pierres: [], hauteur: 0, virages: [], d: '' });
  });
});

describe('trace : rangées plus hautes que l’écart (#169, zoom 200 %)', () => {
  const pierre = 29; // moitié de la pierre : une rangée occupe au moins ça sous son centre
  it('sans mesure, ou si chaque rangée tient dans son écart, rien ne change (390 px)', () => {
    for (const encours of [-1, 0, 2, 5]) {
      const ref = trace(6, { encours });
      expect(trace(6, { encours, bas: [] })).toEqual(ref);
      // Tient : rangée ordinaire jusqu’à une ligne moins la marge ; rangée en cours jusqu’à trois lignes moins la marge.
      const bas = Array.from({ length: 6 }, (_, i) => (i === encours ? 3 : 1) * LIGNE - MARGE_RANGEE);
      expect(trace(6, { encours, bas })).toEqual(ref);
    }
  });
  it('une rangée haute repousse la suivante : pas de chevauchement, virage sous la rangée', () => {
    const bas = [pierre, 200, pierre, 150, 320, pierre];
    const t = trace(6, { encours: 0, bas });
    for (let i = 1; i < 6; i++) {
      const finRangee = t.pierres[i - 1].y + bas[i - 1];
      // Le virage passe sous la rangée du dessus, et la rangée suivante (qui commence une demi-pierre au-dessus
      // de sa pierre) commence sous le virage.
      expect(t.virages[i - 1]).toBeGreaterThanOrEqual(finRangee + MARGE_RANGEE);
      expect(t.pierres[i].y - pierre).toBeGreaterThan(t.virages[i - 1]);
    }
    expect(t.hauteur).toBeGreaterThanOrEqual(t.pierres[5].y + bas[5]);
  });
  it('les pierres et les virages restent sur les lignes du goban', () => {
    const t = trace(6, { encours: 3, bas: [97, 211, 45, 400, 61, 133] });
    for (const p of t.pierres) expect(p.y % LIGNE).toBe(0);
    for (const v of t.virages) expect(v % LIGNE).toBe(0);
    expect(t.hauteur % LIGNE).toBe(0);
    expect(t.d).toMatch(/^M-?\d+ \d+([VH]-?\d+)+$/);
  });
  it('la dernière rangée haute agrandit le goban', () => {
    expect(trace(2, { bas: [pierre, 300] }).hauteur).toBeGreaterThanOrEqual(trace(2).pierres[1].y + 300);
  });
});

describe('placeSousLigne et trace avec la police doublée (#232)', () => {
  const PIERRE = 58;
  it('mesure depuis la ligne de la rangée, pas depuis la pierre dessinée plus bas', () => {
    // Rangée posée une demi-pierre au-dessus de sa ligne (y = 56) : haut 27, bas 291.
    expect(placeSousLigne({ haut: 27, bas: 291 }, PIERRE)).toBe(291 - 56);
    // Pierre seule : une demi-pierre sous la ligne.
    expect(placeSousLigne({ haut: 100, bas: 158 }, PIERRE)).toBe(29);
    expect(placeSousLigne({ haut: 0, bas: 60.2 }, PIERRE)).toBe(32);
  });
  // Hauteurs des rangées du chapitre 1 mesurées à 390 × 844 (e2e, 28/09), leçon 1 en cours.
  const rangees = (hauteurs: number[]) => hauteurs.map(h => placeSousLigne({ haut: 0, bas: h }, PIERRE));
  it('390 px, police normale : rien ne change', () => {
    expect(trace(7, { encours: 0, bas: rangees([126, 63, 81, 60, 58, 81, 58]) })).toEqual(trace(7, { encours: 0 }));
    expect(trace(7, { encours: 6, bas: rangees([58, 63, 81, 60, 58, 81, 126]) })).toEqual(trace(7, { encours: 6 }));
  });
  it('390 px, police doublée : les rangées ne se chevauchent plus', () => {
    for (const [encours, hauteurs] of [
      [0, [264, 238, 238, 154, 123, 281, 160]],
      [1, [160, 306, 238, 154, 123, 281, 160]],
      [5, [160, 238, 238, 154, 123, 385, 160]],
      [-1, [160, 238, 238, 154, 123, 281, 160]],
    ] as const) {
      const bas = rangees([...hauteurs]);
      const t = trace(7, { encours, bas });
      for (let i = 1; i < 7; i++) {
        const finRangee = t.pierres[i - 1].y + bas[i - 1], debutSuivante = t.pierres[i].y - PIERRE / 2;
        expect(t.virages[i - 1]).toBeGreaterThanOrEqual(finRangee + MARGE_RANGEE);
        expect(debutSuivante).toBeGreaterThan(t.virages[i - 1]);
      }
      expect(t.hauteur).toBeGreaterThanOrEqual(t.pierres[6].y + bas[6]);
    }
  });
});

describe('trace : suite', () => {
  it('le tracé partiel suit les mêmes virages', () => {
    const t = trace(4, { bas: [200, 200, 200, 200] });
    expect(traceJusqua(t, 3)).toBe(t.d);
    expect(t.d).toContain(`V${t.virages[0]}H`);
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
  it('« Les bases » (l1 à l7) est complet ; le chapitre 2 s’ouvre sur la leçon 8, encore en cours d’écriture', () => {
    expect(CHAPITRES.map(c => c.lecons.map(l => l.id))).toEqual([['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'], ['l8']]);
    expect(CHAPITRES.map(c => c.complet)).toEqual([true, false]);
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
  it('cinq chapitres annoncés, sans majuscules d’étiquette ni « A · B »', () => {
    expect(CHAPITRES_A_VENIR).toHaveLength(5);
    for (const c of CHAPITRES_A_VENIR) { expect(c).not.toMatch(/·/); expect(c).not.toBe(c.toUpperCase()); }
  });
});
