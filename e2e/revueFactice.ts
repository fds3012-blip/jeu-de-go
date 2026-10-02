import { expect, type Page } from '@playwright/test';

// Revue v3 (#405) : une partie 9 × 9 fixe contre Pomme, gardée sur l'appareil, et un KataGo factice
// (`window.__kataGoFactice`, lu seulement dans un build de test, voir src/engine/index.ts) qui donne à chaque
// position une avance et des candidats choisis pour faire apparaître chaque note :
//   1 C3, 2 G7, 3 G3, 4 C7 : Classique (points de coin de l'ouverture) ;
//   5 E5 : Meilleur ; 6 E7 (Pomme) : Gaffe, 8 points ; 7 D6 : Coup manqué (E3 punissait) ;
//   8 E3 : Meilleur ; 9 F7 : Erreur, 5 points ; 10 F5 : Excellent ; 11 D4 : Brillant (seul bon coup) ;
//   12 C4 (Pomme) : Imprécision ; 13 B6 : Bon ; 14 E8 : Meilleur ; puis deux passes.
export const SGF_REVUE = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Toi]PW[Pomme]RE[B+1.5]'
  + ';B[cg];W[gc];B[gg];W[cc];B[ee];W[ec];B[dd];W[eg];B[fc];W[fe];B[df];W[cf];B[bd];W[eb];B[tt];W[tt])';

/** Garde la partie de la revue sur l'appareil (une seule fois), et installe le KataGo factice. */
export async function preparerRevue(page: Page, { katago = true }: { katago?: boolean } = {}) {
  await page.addInitScript(({ sgf, katago }) => {
    if (!sessionStorage.getItem('revue-semee')) {
      sessionStorage.setItem('revue-semee', '1');
      localStorage.setItem('go.revue.v1', JSON.stringify({ sgf, adversaire: 'pomme', date: new Date(Date.now() - 3_600_000).toISOString() }));
    }
    if (!katago) return;
    const i = (s: string) => (s.charCodeAt(1) - 97) * 9 + (s.charCodeAt(0) - 97);
    const COUPS = ['cg', 'gc', 'gg', 'cc', 'ee', 'ec', 'dd', 'eg', 'fc', 'fe', 'df', 'cf', 'bd', 'eb'];
    // Avance de Noir après k coups ; meilleur coup (null : le coup joué) ; perte du coup joué.
    const L = [0.5, 0.5, 0.5, 0.3, 0.3, 0.3, 8.3, 4.8, 4.8, -0.2, 0.1, 0.1, 2.1, 1.1, 1.1];
    const MEILLEUR: (string | null)[] = [null, null, 'cc', null, null, 'eg', 'eg', null, 'fe', 'df', null, 'dg', 'cd', null];
    const PERTE = [0, 0, 0.2, 0, 0, 8, 3.5, 0, 5, 0.3, 0, 2, 1, 0];
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { board: Int8Array; toPlay: 1 | 2 }) {
        const k = Array.from(pos.board).filter(c => c !== 0).length, s = pos.toPlay === 1 ? 1 : -1;
        const base = { winrate: 0.5, ownership: new Float32Array(81), visits: 64, ms: 1, engine: 'factice' };
        await new Promise(r => setTimeout(r, 40));
        if (k >= COUPS.length) return { ...base, lead: s * L[COUPS.length], moves: [] };
        const joue = i(COUPS[k]), apres = s * L[k + 1], m = MEILLEUR[k];
        let moves;
        if (k === 10) moves = [{ move: joue, visits: 40, lead: apres }, { move: i('gd'), visits: 20, lead: apres - 7 }, { move: i('dh'), visits: 20, lead: apres - 8 }];
        else if (m == null) moves = [{ move: joue, visits: 40, lead: apres }, { move: i(k % 2 ? 'hb' : 'bh'), visits: 20, lead: apres - 0.8 }];
        else moves = [{ move: i(m), visits: 40, lead: apres + PERTE[k] }, { move: joue, visits: 20, lead: apres }];
        return { ...base, lead: s * L[k], moves };
      },
    };
  }, { sgf: SGF_REVUE, katago });
}

/** Ouvre la revue de la partie gardée depuis Profil › Mes parties. */
export async function ouvrirRevue(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /^(Profil|Profile)$/ }).click();
  await page.getByRole('button', { name: /^(Mes parties|My games)/ }).click();
  await page.locator('.mp-parties > li > button').first().click();
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
}
