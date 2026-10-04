import { readFileSync } from 'node:fs';
import { avecEssais, rechargerPourNouvelleVersion } from './ecrans';

const lire = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('écrans chargés à la demande', () => {
  it("l'accueil n'importe aucun écran directement (ils passent par ecrans.ts)", () => {
    const app = lire('./App.tsx');
    for (const ecran of ['Game', 'Learn', 'Puzzles', 'Profil', 'Placement', 'SeriePratique', 'Defis', 'CreerCompte', 'Connexion']) {
      // `import type` reste permis : il disparaît du JS.
      expect(app).not.toMatch(new RegExp(`^import (?!type )[^\\n]* from '\\./${ecran}';`, 'm'));
    }
  });

  it('App.tsx lit les problèmes résolus et vus sous les mêmes clés que Puzzles.tsx', () => {
    for (const nom of ['SOLVED_KEY', 'VUS_KEY']) {
      const cle = (src: string) => src.match(new RegExp(`${nom} = '([^']+)'`))?.[1];
      expect(cle(lire('./App.tsx')), nom).toBeDefined();
      expect(cle(lire('./App.tsx')), nom).toBe(cle(lire('./Puzzles.tsx')));
    }
  });

  it('les styles des écrans restent dans la feuille principale (importés par main.tsx avant App)', () => {
    const main = lire('../main.tsx');
    const avantApp = main.slice(0, main.indexOf("import { App } from './app/App';"));
    for (const [ecran, css] of [['Game', 'comptage'], ['Game', 'revue'], ['Learn', 'apprendre-partage'], ['Puzzles', 'course'], ['Profil', 'import'], ['Placement', 'placement']]) {
      expect(avantApp, `${ecran} : ${css}.css`).toContain(`import './ui/${css}.css';`);
    }
  });

  it("#433 : apprendre.css arrive avec les écrans Apprendre et Problèmes, ses règles partagées restent à sa place", () => {
    const main = lire('../main.tsx');
    expect(main).not.toContain("import './ui/apprendre.css';");
    // Même place qu'avant : après revue.css, avant gel.css (ordre de la cascade inchangé).
    expect(main.indexOf("import './ui/revue.css';")).toBeLessThan(main.indexOf("import './ui/apprendre-partage.css';"));
    expect(main.indexOf("import './ui/apprendre-partage.css';")).toBeLessThan(main.indexOf("import './ui/gel.css';"));
    expect(lire('./Learn.tsx')).toContain("import '../ui/apprendre.css';");
    expect(lire('./Puzzles.tsx')).toContain("import '../ui/apprendre.css';");
    expect(lire('../ui/Lecteur.tsx')).toContain("import './apprendre.css';");
  });
});

describe('avecEssais', () => {
  it('réessaie après un échec réseau puis réussit', async () => {
    let n = 0;
    const r = await avecEssais(async () => { if (++n < 3) throw new Error('réseau'); return 'ok'; }, [0, 0, 0]);
    expect(r).toBe('ok');
    expect(n).toBe(3);
  });

  it('abandonne après le dernier essai', async () => {
    let n = 0;
    await expect(avecEssais(async () => { n++; throw new Error('absent'); }, [0, 0])).rejects.toThrow('absent');
    expect(n).toBe(3);
  });
});

describe('rechargerPourNouvelleVersion', () => {
  const stock = new Map<string, string>();
  const reload = vi.fn();
  beforeEach(() => {
    stock.clear();
    reload.mockReset();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => stock.get(k) ?? null, setItem: (k: string, v: string) => stock.set(k, v) });
    vi.stubGlobal('location', { reload });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('recharge une fois, puis plus pendant une minute (jamais de boucle)', () => {
    expect(rechargerPourNouvelleVersion(1_000_000)).toBe(true);
    expect(rechargerPourNouvelleVersion(1_030_000)).toBe(false);
    expect(rechargerPourNouvelleVersion(1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('ne recharge pas si le stockage est indisponible', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => {} });
    expect(rechargerPourNouvelleVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
