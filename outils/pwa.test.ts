import { readFileSync } from 'node:fs';
import { COQUILLE, injecterDansSw, listePrecache, MARQUEUR, type Morceau } from './pwa';

const meta = (css: string[] = [], assets: string[] = []) => ({ importedCss: new Set(css), importedAssets: new Set(assets) });
const chunk = (fileName: string, o: Partial<Morceau> = {}): Morceau => ({ type: 'chunk', fileName, imports: [], dynamicImports: [], moduleIds: [], viteMetadata: meta(), ...o });
const asset = (fileName: string): Morceau => ({ type: 'asset', fileName });

function bundle(...ms: Morceau[]) {
  return Object.fromEntries(ms.map(m => [m.fileName, m]));
}

describe('listePrecache', () => {
  const b = bundle(
    chunk('assets/index-a.js', { isEntry: true, imports: ['assets/react-b.js'], dynamicImports: ['assets/Game-c.js', 'assets/module-d.js', 'assets/index-e.js'], moduleIds: ['/p/src/main.tsx'], viteMetadata: meta(['assets/index-f.css']) }),
    chunk('assets/react-b.js', { moduleIds: ['/p/node_modules/react/index.js'] }),
    chunk('assets/Game-c.js', { moduleIds: ['/p/src/app/Game.tsx'], imports: ['assets/Revue-g.js'] }),
    chunk('assets/Revue-g.js', { moduleIds: ['/p/src/app/Revue.tsx'] }),
    chunk('assets/module-d.js', { moduleIds: ['/p/node_modules/posthog-js/dist/module.js'] }),
    chunk('assets/index-e.js', { moduleIds: ['/p/node_modules/@sentry/react/index.js'], imports: ['assets/index-a.js'] }),
    asset('assets/index-f.css'),
    asset('assets/police-h.woff2'),
    asset('assets/simple.worker-i.js'),
    asset('assets/worker-j.js'),
    asset('assets/shared-k.js'),
    asset('index.html'),
  );
  const liste = listePrecache(b);

  it("met en cache le JS initial, les écrans, le CSS, les polices et le moteur simple", () => {
    expect(liste).toEqual(expect.arrayContaining([
      '/assets/index-a.js', '/assets/react-b.js', '/assets/Game-c.js', '/assets/Revue-g.js',
      '/assets/index-f.css', '/assets/police-h.woff2', '/assets/simple.worker-i.js',
    ]));
  });

  it('laisse de côté KataGo, TensorFlow.js, PostHog et Sentry (mis en cache au premier usage)', () => {
    for (const f of ['/assets/module-d.js', '/assets/index-e.js', '/assets/worker-j.js', '/assets/shared-k.js', '/index.html']) {
      expect(liste).not.toContain(f);
    }
  });
});

describe('injecterDansSw', () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

  it('trouve la ligne à remplacer dans public/sw.js (ne pas la couper en plusieurs lignes)', () => {
    expect(source).toMatch(MARQUEUR);
  });

  it('injecte la coquille, les fichiers et une version qui suit leur contenu', () => {
    const lire = (s: string) => JSON.parse(s.match(/^const BUILD = (.*);$/m)![1]) as { version: string; precache: string[] };
    const a = lire(injecterDansSw(source, ['/assets/index-a.js']));
    const b = lire(injecterDansSw(source, ['/assets/index-b.js']));
    expect(a.precache).toEqual([...COQUILLE, '/assets/index-a.js']);
    expect(a.version).toMatch(/^[0-9a-f]{12}$/);
    expect(a.version).not.toBe(b.version);
  });

  it('refuse un service worker sans la ligne attendue', () => {
    expect(() => injecterDansSw('self.addEventListener("fetch", () => {});', [])).toThrow(/introuvable/);
  });
});
