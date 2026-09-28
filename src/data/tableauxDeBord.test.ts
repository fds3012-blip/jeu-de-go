// Garde-fous de la documentation data (#166, #222) : les requêtes HogQL de docs/data/tableaux-de-bord.md
// ne citent que des événements réels (ou annoncés), et les tests A/B citent des interrupteurs qui existent.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENTS } from './analytics';
import { SERIE_UN_DEFI } from '../app/defi';
import { POMME_RESPIRE } from '../app/rythme';
import { KOMI_DEBUTANT, KOMI_NORMAL, PARTIES_KOMI_DEBUTANT } from '../app/equilibrage';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const tableaux = lire('../../docs/data/tableaux-de-bord.md');
const plan = lire('../../docs/data/plan-de-marquage.md');

/** Blocs ```sql du document. */
function blocsSql(md: string): string[] {
  return [...md.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]);
}

/** Noms d'événements filtrés dans une requête : `event = '…'` et `event IN ('…', …)`. */
function evenementsCites(sql: string): string[] {
  const noms = new Set<string>();
  for (const m of sql.matchAll(/\bevent\s*=\s*'([^']+)'/g)) noms.add(m[1]);
  for (const m of sql.matchAll(/\bevent\s+IN\s*\(([^)]*)\)/g)) {
    for (const n of m[1].matchAll(/'([^']+)'/g)) noms.add(n[1]);
  }
  return [...noms];
}

/** Section d'un document Markdown, de son titre au titre suivant de même niveau ou plus haut. */
function section(md: string, titre: string): string {
  const debut = md.indexOf(titre);
  if (debut < 0) return '';
  const niveau = titre.match(/^#+/)?.[0].length ?? 2;
  const reste = md.slice(debut + titre.length);
  const fin = reste.search(new RegExp(`\\n#{1,${niveau}} `));
  return fin < 0 ? reste : reste.slice(0, fin);
}

describe('evenementsCites', () => {
  it('lit les égalités et les listes IN', () => {
    expect(evenementsCites("WHERE event = 'a' AND countIf(event = 'b') AND event IN ('c', 'd')").sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('docs/data/tableaux-de-bord.md', () => {
  const annonces = [...section(plan, '## À ajouter plus tard').matchAll(/`([a-z_]+)`/g)].map(m => m[1]);
  const connus = new Set<string>([...Object.values(EVENTS), ...annonces]);

  it('a des requêtes', () => {
    expect(blocsSql(tableaux).length).toBeGreaterThan(20);
  });

  it('ne cite que des événements de EVENTS ou annoncés dans le plan de marquage', () => {
    const inconnus = blocsSql(tableaux).flatMap(evenementsCites).filter(n => !connus.has(n));
    expect(inconnus).toEqual([]);
  });

  it("l'entonnoir d'activation suit les six étapes demandées (#222)", () => {
    const entonnoir = blocsSql(section(tableaux, "### 7.1 Entonnoir d'activation"))[0] ?? '';
    const etapes = [EVENTS.appOuverte, EVENTS.premierePierre, EVENTS.partieTerminee, EVENTS.leconCommencee, EVENTS.leconTerminee, EVENTS.goDuJourResolu];
    const positions = etapes.map(e => entonnoir.indexOf(`'${e}'`));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('chaque lecture de la section 7 dit son indicateur et sa décision', () => {
    const lectures = section(tableaux, '## 7. Entonnoirs').split(/\n### /).slice(1);
    expect(lectures.length).toBe(7);
    for (const l of lectures) {
      expect(l, l.split('\n')[0]).toContain('**Indicateur servi**');
      expect(l, l.split('\n')[0]).toContain('**Décision éclairée**');
    }
  });

  it('chaque test A/B a son protocole complet', () => {
    const tests = section(tableaux, '## 8. Tests A/B').split(/\n### 8\.\d /).slice(1);
    expect(tests.length).toBe(3);
    for (const t of tests) {
      for (const rubrique of ['**Hypothèse**', '**Métrique principale**', '**Garde-fous**', '**Taille**', '**Durée**', '**Décision**']) {
        expect(t, `${t.split('\n')[0]} : ${rubrique}`).toContain(rubrique);
      }
    }
  });
});

describe('interrupteurs des tests A/B (section 8)', () => {
  it('existent dans le code et sont allumés, comme le dit le document', () => {
    expect(tableaux).toContain('`SERIE_UN_DEFI`');
    expect(tableaux).toContain('`POMME_RESPIRE`');
    expect(SERIE_UN_DEFI).toBe(true);
    expect(POMME_RESPIRE).toBe(true);
  });

  it('le komi décrit est celui du code (0,5 pour 3 parties, puis 6,5)', () => {
    expect(KOMI_DEBUTANT).toBe(0.5);
    expect(PARTIES_KOMI_DEBUTANT).toBe(3);
    expect(KOMI_NORMAL).toBe(6.5);
    expect(tableaux).toContain('komi 0,5 pour les 3 premières parties');
    expect(tableaux).toContain('komi 6,5 dès la première');
  });
});
