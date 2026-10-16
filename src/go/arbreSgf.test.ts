// #562 : arbre SGF, lecture et écriture des variantes (parenthèses imbriquées) et des commentaires.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ecrireArbreSgf, lireArbreSgf, MAX_NOEUDS, type NoeudSgf } from './arbreSgf';

const fixture = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8');
/** Coups d'une branche : suit la première suite. */
function premiere(n: NoeudSgf): string[] {
  const out: string[] = [];
  for (let x: NoeudSgf | undefined = n; x; x = x.enfants[0]) { const m = x.props.B?.[0] ?? x.props.W?.[0]; if (m !== undefined) out.push(m); }
  return out;
}

describe('lecture', () => {
  it('fichier Sabaki 9 × 9 : racine, embranchements imbriqués, commentaires échappés', () => {
    const r = lireArbreSgf(fixture('club-9x9-variantes.sgf'));
    expect(r.props.SZ).toEqual(['9']);
    expect(r.props.KM).toEqual(['7']);
    expect(r.props.C![0]).toContain('a[1] et l\'antislash : \\ fin.');
    expect(premiere(r)).toEqual(['ee', 'gc', 'gd', 'fc', 'hc', 'hb', 'ec', 'eb', 'db']);
    const apresW = r.enfants[0].enfants[0]; // W[gc]
    expect(apresW.enfants.map(n => n.props.B?.[0])).toEqual(['gd', 'cg']);
    const apresFc = apresW.enfants[0].enfants[0];
    expect(apresFc.enfants.map(n => n.props.B?.[0])).toEqual(['hc', 'fd']);
    // Saut de ligne « doux » retiré.
    expect(premiere(apresFc.enfants[1]).length).toBe(3);
    expect(apresFc.enfants[1].enfants[0].enfants[0].props.C).toEqual(['Variante dans la variante.']);
    // Passe en `[]` et en `[tt]`.
    expect(premiere(apresW.enfants[1])).toEqual(['cg', 'gg', '', 'tt']);
  });

  it('fichier CGoban 19 × 19 avec handicap : propriétés inconnues gardées, deux branches', () => {
    const r = lireArbreSgf(fixture('kgs-19x19-handicap.sgf'));
    expect(r.props.AB).toEqual(['pd', 'dp']);
    expect(r.props.RU).toEqual(['Chinese']);
    expect(r.props.WR).toEqual(['3d']);
    const fc = r.enfants[0].enfants[0].enfants[0];
    expect(fc.props.W).toEqual(['fc']);
    expect(fc.enfants.map(n => n.props.B?.[0])).toEqual(['cf', 'qf']);
  });

  it('collection : seul le premier jeu est lu ; noms longs FF[3] ramenés aux majuscules', () => {
    const r = lireArbreSgf('(;SZ[9]AddBlack[ee];B[cc])(;SZ[19];B[pd])');
    expect(r.props.AB).toEqual(['ee']);
    expect(premiere(r)).toEqual(['cc']);
  });

  it('refuse ce qui n’est pas un SGF ; borne le nombre de nœuds', () => {
    expect(() => lireArbreSgf('bonjour')).toThrow();
    expect(() => lireArbreSgf('()')).toThrow();
    const long = `(;SZ[9]${';B[aa];W[bb]'.repeat(MAX_NOEUDS)})`;
    let n = 0;
    for (let x: NoeudSgf | undefined = lireArbreSgf(long); x; x = x.enfants[0]) n++;
    expect(n).toBe(MAX_NOEUDS);
  });

  it('un arbre très profond ne fait pas déborder la pile', () => {
    const profond = `(;SZ[19]${'(;B[aa]'.repeat(5000)}${')'.repeat(5000)})`;
    const r = lireArbreSgf(profond);
    expect(ecrireArbreSgf(r).length).toBeGreaterThan(5000 * 6);
  });
});

describe('écriture', () => {
  it('suite linéaire sans parenthèses, une paire de parenthèses par branche à chaque embranchement', () => {
    const r: NoeudSgf = {
      props: { SZ: ['9'] }, enfants: [{
        props: { B: ['ee'] }, enfants: [
          { props: { W: ['cc'], C: ['a]b\\c'] }, enfants: [{ props: { B: ['gg'] }, enfants: [] }] },
          { props: { W: ['gg'] }, enfants: [] },
        ],
      }],
    };
    expect(ecrireArbreSgf(r)).toBe('(;SZ[9];B[ee](;W[cc]C[a\\]b\\\\c];B[gg])(;W[gg]))');
  });

  it('aller-retour : lire puis écrire puis relire donne le même arbre (fichiers réels)', () => {
    for (const f of ['club-9x9-variantes.sgf', 'kgs-19x19-handicap.sgf']) {
      const a = lireArbreSgf(fixture(f));
      const b = lireArbreSgf(ecrireArbreSgf(a));
      expect(b).toEqual(a);
    }
  });
});
