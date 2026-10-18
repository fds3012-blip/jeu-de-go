// #673 : le générateur d'explications face au vrai KataGo (réseau g170-b6c96), sans le réseau : les analyses sont
// figées dans explications-katago.json par outils/explicationsKataGo.ts (mêmes réglages que `analyseErreur`).
// 1. Positions dont la bonne raison est connue (explications-cas.ts) : la raison attendue sort en premier, aucune
//    raison interdite n'apparaît ; la position ambiguë ne reçoit que « surtout positionnelle ».
// 2. Deux vraies parties de Florian : des raisons vérifiées à la main sur le plateau (docs/produit/analyse-expliquee-2026-10.md),
//    puis, pour chaque erreur, chaque fait est rejoué avec les règles (une prise annoncée est une prise jouée), et
//    les phrases sont figées (instantané relu par écrit).
import { describe, expect, it } from 'vitest';
import fige from './explications-katago.json';
import { fromRows } from './position';
import { fromLabel, toLabel } from './coords';
import { groupAt, type Color, type Position } from './rules';
import { expliquerErreur, SEUILS, type Explication } from './explication';
import { CAS_CONNUS } from './explications-cas';
import { entreeDe, type FigeExplications } from './explications-fige';
import { positionsDepuisSgf, conseilFiable } from '../app/revue';
import { glosesDesErreurs, textesExplication } from '../app/analyseExpliquee';
import { choisirLangue } from '../content/i18n';

const F = fige as unknown as FigeExplications;

describe('analyses figées', () => {
  it('réglages de la revue : réseau g170-b6c96, 64 visites par recherche', () => {
    expect(F.reglages).toEqual({ modele: 'g170-b6c96-s175395328-d26788732', visites: 64, visitesRevue: 32 });
    expect(F.cas.map(c => c.id)).toEqual(CAS_CONNUS.map(c => c.id));
  });
});

describe('positions dont la bonne raison est connue', () => {
  for (const c of CAS_CONNUS) {
    it(`${c.id} : ${c.titre}`, () => {
      const f = F.cas.find(x => x.id === c.id)!;
      const { pos } = fromRows(c.rows, c.trait);
      const x = expliquerErreur(entreeDe(pos, f))!;
      expect(x).not.toBeNull();
      const types = x.faits.map(y => y.type);
      if (c.attendu.length) expect(c.attendu).toContain(types[0]);
      else expect(x.positionnel).toBe(true);
      for (const t of c.interdit ?? []) expect(types).not.toContain(t);
    });
  }
});

/** Erreurs d'une partie figée, expliquées comme dans la revue (bon coup montré seulement s'il est fiable). */
function erreursDe(id: string) {
  const p = F.parties.find(x => x.id === id)!;
  const { positions } = positionsDepuisSgf(p.sgf);
  const out = new Map<number, { avant: Position; x: Explication }>();
  for (const f of p.erreurs) {
    const avant = positions[f.coup! - 1], c = avant.toPlay;
    if (!conseilFiable(avant, f.bon, f.leadBon - (c === 1 ? f.avance! : -f.avance!))) continue;
    const x = expliquerErreur(entreeDe(avant, f));
    if (x) out.set(f.coup!, { avant, x });
  }
  return out;
}
const L = (s: string) => fromLabel(s, 9);
const etiquettes = (xs: number[]) => xs.map(p => toLabel(p, 9)).sort();

describe('partie entre amis de Florian (#424) : raisons vérifiées sur le plateau', () => {
  const e = erreursDe('florian-424');
  it('coup 24 : Noir E5 n’a qu’une liberté (F5) ; Blanc joue J6 au lieu de le prendre', () => {
    expect(e.get(24)!.x.faits[0]).toMatchObject({ type: 'priseManquee', cause: 'atari', point: L('F5'), pierres: [L('E5')] });
  });
  it('coup 25 : Noir laisse E5 en atari ; Blanc le prend en F5', () => {
    expect(e.get(25)!.x.faits[0]).toMatchObject({ type: 'pierresPerdues', cause: 'atari', point: L('F5'), pierres: [L('E5')] });
  });
  it('coup 27 : Noir joue B8 ; ses pierres E5 et F6 meurent (E5 n’a qu’une liberté, F6 deux, entourées de Blanc)', () => {
    const f = e.get(27)!.x.faits[0];
    expect(f).toMatchObject({ type: 'groupe', etat: 'mort' });
    expect(etiquettes(f.visuel.pierres)).toEqual(['E5', 'F6']);
  });
  it('coup 28 : les 8 pierres blanches (C8 à D5) n’ont qu’une liberté, E8 ; Blanc joue J8 ; F5 prenait E5 et les sauvait', () => {
    const x = e.get(28)!.x;
    expect(x.faits[0]).toMatchObject({ type: 'pierresPerdues', cause: 'atari', point: L('E8') });
    expect(etiquettes(x.faits[0].visuel.pierres)).toEqual(['B7', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E6']);
    expect(x.faits[1]).toMatchObject({ type: 'priseManquee', cause: 'atari', point: L('F5') });
  });
  it('coup 41 : la chaîne blanche E4-E3-E2 peut encore sortir après D1 ; G3 la tue selon KataGo', () => {
    const f = e.get(41)!.x.faits[0];
    expect(f).toMatchObject({ type: 'groupeTue', apresJoue: 'incertain' });
    expect(etiquettes(f.visuel.pierres)).toEqual(['E2', 'E3', 'E4']);
  });
  it('coup 42 : la même chaîne, côté Blanc, n’est plus sûre de vivre après E1 (tout le groupe, 3 pierres)', () => {
    const f = e.get(42)!.x.faits[0];
    expect(f).toMatchObject({ type: 'groupe', etat: 'faible' });
    expect(f.visuel.pierres).toHaveLength(3);
  });
});

describe('chaque fait des vraies parties se vérifie en rejouant les suites', () => {
  for (const id of ['florian-424', 'florian-takumi']) {
    it(id, () => {
      const e = erreursDe(id);
      expect(e.size).toBeGreaterThan(5);
      for (const [coup, { avant, x }] of e) {
        const c = avant.toPlay, o = (3 - c) as Color, quoi = `${id} coup ${coup}`;
        expect(x.faits.length, quoi).toBeLessThanOrEqual(2);
        for (const f of x.faits) {
          if (f.type === 'pierresPerdues' || f.type === 'priseManquee') {
            const suite = f.type === 'pierresPerdues' ? x.suiteJoue : x.suiteBon, camp = f.type === 'pierresPerdues' ? c : o;
            const avantPrise = f.etape === 0 ? avant : suite.positions[f.etape - 1];
            // Les pierres sont là juste avant, à `camp`, et disparaissent au coup annoncé, joué au point annoncé.
            expect(f.pierres.every(p => avantPrise.board[p] === camp && suite.positions[f.etape].board[p] === 0), quoi).toBe(true);
            expect(suite.coups[f.etape], quoi).toBe(f.point);
            if (f.cause === 'atari') expect(f.pierres.filter(p => avant.board[p]).every(p => groupAt(avant.board, 9, p).liberties.size === 1), quoi).toBe(true);
          }
          if (f.type === 'groupe' || f.type === 'groupeTue') {
            expect(f.pierres.length, quoi).toBeGreaterThanOrEqual(2);
            expect(f.pierres.every(p => avant.board[p] === (f.type === 'groupe' ? c : o)), quoi).toBe(true);
          }
          if (f.type === 'coupe') expect(x.suiteJoue.coups[1], quoi).toBe(f.point);
          if (f.type === 'territoire') {
            const pierres = x.faits.flatMap(y => ('pierres' in y ? y.pierres : [])).length;
            expect(f.gain, quoi).toBeLessThanOrEqual(x.perte - 2 * pierres + (pierres ? 0 : SEUILS.zoneMarge) + 0.05);
          }
        }
      }
    });
  }
});

describe('relecture : les phrases générées sur les deux vraies parties (instantané relu)', () => {
  for (const langue of ['fr', 'en'] as const) {
    it(langue, () => {
      choisirLangue(langue);
      try {
        const lignes: string[] = [];
        for (const id of ['florian-424', 'florian-takumi']) {
          const e = erreursDe(id);
          const gloses = glosesDesErreurs(new Map([...e].map(([k, v]) => [k, v.x])));
          for (const [coup, { avant, x }] of e) {
            const adv = langue === 'fr' ? (avant.toPlay === 1 ? 'Blanc' : 'Noir') : (avant.toPlay === 1 ? 'White' : 'Black');
            const t = textesExplication(x, 9, { adv, gloses: gloses.get(coup) });
            // Ni variable oubliée, ni clé brute, ni plus de 2 raisons par texte.
            for (const s of [t.erreur, t.meilleur]) expect(s, `${id} ${coup}`).not.toMatch(/\{|\}|undefined|NaN|erreur\.|bon\./);
            lignes.push(`${id} ${coup} | ${t.erreur} | ${t.meilleur}`);
          }
        }
        expect(lignes.join('\n')).toMatchSnapshot();
      } finally { choisirLangue('fr'); }
    });
  }
});
