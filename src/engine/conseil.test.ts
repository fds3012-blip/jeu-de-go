// Conseil de Mochi (#80) : chaque position fixe donne la phrase et la zone attendues, et aucune phrase fausse.
import { conseil, MODELES, phraseConseil, reglesCoin, type ConseilMochi, type ModeleConseil, type OptionsConseil } from './conseil';
import { fromRows } from '../go/position';
import { fromLabel, toLabel } from '../go/coords';
import { boardKey, groupAt, newPosition, play, type Color, type Position } from '../go/rules';
import { traduire } from '../content/i18n';

/** Plateau `n` × `n` avec des pierres données en coordonnées affichées. */
function plateau(n: number, noirs: string[], blancs: string[], trait: Color = 1): Position {
  const pos = newPosition(n);
  for (const l of noirs) pos.board[fromLabel(l, n)] = 1;
  for (const l of blancs) pos.board[fromLabel(l, n)] = 2;
  pos.toPlay = trait;
  return pos;
}
const labels = (c: ConseilMochi | null, n: number) => (c ? c.zone.map(p => toLabel(p, n)).sort() : []);

interface Fixture {
  nom: string;
  pos: Position;
  options?: OptionsConseil;
  attendu: null | { modele: ModeleConseil; point: string | null; zone: string[]; fr: string };
  /** Modèles qui seraient faux ici (vérifié en plus de l'attendu). */
  jamais?: ModeleConseil[];
}

/** Propriété 9 × 9 : colonne E neutre, Noir à gauche, Blanc à droite. */
const proprieteColonneE = Float32Array.from({ length: 81 }, (_, p) => (p % 9 < 4 ? 0.9 : p % 9 > 4 ? -0.9 : 0));
const huitPierresHorsE = { noirs: ['C3', 'C5', 'C7', 'B4'], blancs: ['G3', 'G5', 'G7', 'H4'] };

const koE5 = () => { const p = plateau(9, ['C5', 'D6', 'D4'], ['D5', 'E6', 'F5', 'E4']); p.ko = fromLabel('E5', 9); return p; };
const atariBlancE5 = () => plateau(9, ['D5', 'F5', 'E6'], ['E5']);

const fixtures: Fixture[] = [
  // 1. Atari du joueur
  { nom: 'pierre noire en atari au centre, qui peut s’allonger', pos: plateau(9, ['E5'], ['E6', 'D5', 'F5']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'deux pierres noires en atari au bord', pos: plateau(9, ['C1', 'D1'], ['B1', 'E1', 'C2']),
    attendu: { modele: 'atari-joueur', point: 'D1', zone: ['C1', 'D1', 'D2'], fr: "Ton groupe en D1 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'le plus gros groupe en atari est nommé', pos: plateau(9, ['C1', 'D1', 'B8'], ['B1', 'E1', 'C2', 'A8', 'C8', 'B9']),
    attendu: { modele: 'atari-joueur', point: 'D1', zone: ['C1', 'D1', 'D2'], fr: "Ton groupe en D1 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'sauvetage par capture : s’allonger serait un suicide', pos: plateau(9, ['E5', 'D6', 'F6'], ['E6', 'D5', 'F5', 'D4', 'F4', 'E3']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'atari du joueur avant atari adverse (priorité fixe)', pos: plateau(9, ['E5', 'A8', 'C8', 'B9'], ['E6', 'D5', 'F5', 'B8']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'Blanc au trait : sa pierre en atari', pos: plateau(9, ['E6', 'D5', 'F5'], ['E5'], 2),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'atari du joueur sans sauvetage (coin) : pas de « sauve-le »', pos: plateau(9, ['A1', 'C5', 'D5', 'E5', 'F5'], ['B1', 'B2', 'G5']),
    attendu: null, jamais: ['atari-joueur'] },
  { nom: 'atari du joueur sans sauvetage, avec un coin libre : on passe au modèle suivant', pos: plateau(9, ['A1'], ['B1', 'B2']),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-joueur'] },
  { nom: 'atari du joueur, échelle perdue : pas de « sauve-le »',
    pos: plateau(9, ['C7', 'B5', 'H2', 'H3', 'J4'], ['C8', 'B7', 'D7', 'C6', 'D5']), // Noir C7 entouré, la seule sortie est prise
    attendu: null, jamais: ['atari-joueur'] },

  // 2. Atari de l'adversaire
  { nom: 'pierre blanche à prendre', pos: atariBlancE5(),
    attendu: { modele: 'atari-adverse', point: 'E4', zone: ['E4', 'E5'], fr: "Tu peux prendre en E4 : sa pierre n'a plus qu'une liberté." } },
  { nom: 'deux pierres blanches à prendre', pos: plateau(9, ['C5', 'D6', 'E6', 'D4', 'E4'], ['D5', 'E5']),
    attendu: { modele: 'atari-adverse', point: 'F5', zone: ['D5', 'E5', 'F5'], fr: "Tu peux prendre en F5 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'le plus gros groupe à prendre est choisi', pos: plateau(9, ['C5', 'D6', 'E6', 'D4', 'E4', 'A8', 'C8', 'B9'], ['D5', 'E5', 'B8']),
    attendu: { modele: 'atari-adverse', point: 'F5', zone: ['D5', 'E5', 'F5'], fr: "Tu peux prendre en F5 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'prise interdite par le ko : pas de « tu peux prendre »', pos: koE5(), attendu: null, jamais: ['atari-adverse'] },
  { nom: 'même forme sans ko : la prise est permise', pos: { ...koE5(), ko: -1 },
    attendu: { modele: 'atari-adverse', point: 'E5', zone: ['D5', 'E5'], fr: "Tu peux prendre en E5 : sa pierre n'a plus qu'une liberté." } },
  { nom: 'prise interdite par le superko : on passe au modèle suivant', pos: atariBlancE5(),
    options: { dejaVues: new Set([boardKey((play(atariBlancE5(), fromLabel('E4', 9)) as Position).board)]) },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-adverse'] },
  { nom: 'deux groupes blancs en atari : le plus gros, dans un point entouré', pos: plateau(9, ['B1', 'A3', 'B2', 'C1', 'D2', 'D3', 'C4'], ['A1', 'C2', 'C3']),
    attendu: { modele: 'atari-adverse', point: 'B3', zone: ['B3', 'C2', 'C3'], fr: "Tu peux prendre en B3 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'Noir au trait : Blanc a un groupe en atari, Blanc au trait ne le « prend » pas', pos: plateau(9, ['D5', 'F5', 'E6'], ['E5'], 2),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." }, jamais: ['atari-adverse'] },
  { nom: 'Blanc au trait peut prendre une pierre noire', pos: plateau(9, ['E5'], ['E6', 'D5', 'F5'], 2),
    attendu: { modele: 'atari-adverse', point: 'E4', zone: ['E4', 'E5'], fr: "Tu peux prendre en E4 : sa pierre n'a plus qu'une liberté." } },

  // 3. Peu de libertés
  { nom: 'pierre au bord à deux libertés, menacée', pos: plateau(9, ['B1'], ['B2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'même forme en 19 × 19', pos: plateau(19, ['B1'], ['B2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'deux libertés mais deux yeux : aucune menace', pos: plateau(9, ['A2', 'B2', 'C2', 'D2', 'B1', 'D1'], ['A3', 'B3', 'C3', 'D3', 'E2', 'E1']),
    attendu: null, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'deux libertés mais déjà perdu : pas de « donne-lui de l’air »', pos: plateau(9, ['B1'], ['A2', 'B2', 'C2']),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'deux libertés vers le large : pas menacé', pos: plateau(9, ['E5', 'B2', 'H2', 'H8', 'B7'], ['E6', 'D5', 'C7']),
    attendu: null, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'trois libertés : ni atari ni « peu de libertés »', pos: plateau(9, ['E5', 'B2', 'H2', 'H8', 'B7'], ['E6', 'D8']),
    attendu: null, jamais: ['atari-joueur', 'peu-de-libertes'] },

  // 4. Coins libres
  { nom: '9 × 9 vide : coin en haut à droite', pos: newPosition(9),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '13 × 13 vide', pos: newPosition(13),
    attendu: { modele: 'coin-libre', point: null, zone: ['K10', 'K11', 'L10', 'L11'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 vide', pos: newPosition(19),
    attendu: { modele: 'coin-libre', point: null, zone: ['Q16', 'Q17', 'R16', 'R17'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : coin en haut à droite pris, on montre celui en bas à gauche', pos: plateau(19, ['Q16'], [], 2),
    attendu: { modele: 'coin-libre', point: null, zone: ['C3', 'C4', 'D3', 'D4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : puis en bas à droite', pos: plateau(19, ['Q16'], ['D4']),
    attendu: { modele: 'coin-libre', point: null, zone: ['Q3', 'Q4', 'R3', 'R4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : les quatre coins pris, aucun conseil sans propriété', pos: plateau(19, ['Q16', 'D4'], ['D16', 'Q4']),
    attendu: null, jamais: ['coin-libre'] },
  { nom: '9 × 9 : une pierre sur le 3-3 suffit à occuper le coin', pos: plateau(9, ['G7'], [], 2),
    attendu: { modele: 'coin-libre', point: null, zone: ['C3', 'C4', 'D3', 'D4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '9 × 9 : trop de pierres, ce n’est plus le début', pos: plateau(9, ['C3', 'C5', 'C7', 'E5'], ['G3', 'G5', 'E7']),
    attendu: null, jamais: ['coin-libre'] },
  { nom: '7 × 7 : pas de modèle de coin', pos: newPosition(7), attendu: null, jamais: ['coin-libre'] },

  // 5. Zone à prendre (propriété KataGo)
  { nom: 'colonne E neutre', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs), options: { propriete: proprieteColonneE },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'], fr: 'La zone en E5 est encore à prendre.' } },
  { nom: 'la plus grande des deux zones neutres', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => ((p % 9 === 0 && p < 45) || (p % 9 === 8 && p < 27) ? 0.1 : 0.95)) },
    attendu: { modele: 'zone-a-prendre', point: 'A7', zone: ['A5', 'A6', 'A7', 'A8', 'A9'], fr: 'La zone en A7 est encore à prendre.' } },
  { nom: 'zone neutre trop petite (3 points)', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => (p === 0 || p === 1 || p === 2 ? 0 : -0.8)) }, attendu: null, jamais: ['zone-a-prendre'] },
  { nom: 'points neutres tous occupés : pas de zone', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => (['C3', 'C5', 'C7', 'B4', 'G3'].map(l => fromLabel(l, 9)).includes(p) ? 0 : 0.9)) },
    attendu: null, jamais: ['zone-a-prendre'] },
  { nom: 'propriété de mauvaise taille ignorée', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs), options: { propriete: new Float32Array(361) },
    attendu: null },
  { nom: 'l’atari passe avant la propriété', pos: plateau(9, ['E5', ...huitPierresHorsE.noirs], ['E6', 'D5', 'F5', ...huitPierresHorsE.blancs]),
    options: { propriete: proprieteColonneE },
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'le coin libre passe avant la propriété', pos: newPosition(9), options: { propriete: new Float32Array(81) },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." } },
];

// Positions tirées de l'ascii (lecture directe d'un diagramme), pour vérifier fromRows et l'ordre des coordonnées.
fixtures.push({
  nom: 'diagramme : groupe noir en atari au bord droit, déjà perdu',
  pos: fromRows([
    '.........',
    '.........',
    '.......O.',
    '......OX.',
    '......OXO',
    '.......O.',
    '.........',
    '.........',
    '.........',
  ]).pos,
  attendu: null, jamais: ['atari-joueur'],
});

describe('Conseil de Mochi : positions fixes', () => {
  it('au moins 30 positions', () => expect(fixtures.length).toBeGreaterThanOrEqual(30));

  it.each(fixtures.map(f => [f.nom, f] as const))('%s', (_, f) => {
    const c = conseil(f.pos, f.options);
    const n = f.pos.size;
    if (!f.attendu) expect(c).toBeNull();
    else {
      expect(c?.modele).toBe(f.attendu.modele);
      expect(c && c.point !== null ? toLabel(c.point, n) : null).toBe(f.attendu.point);
      expect(labels(c, n)).toEqual([...f.attendu.zone].sort());
      expect(phraseConseil(c!, n, 'fr')).toBe(f.attendu.fr);
    }
    for (const m of f.jamais ?? []) expect(c?.modele).not.toBe(m);
  });
});

/** Vérifie qu'une phrase est vraie sur la position (indépendamment du code qui l'a choisie). */
function verifier(pos: Position, c: ConseilMochi) {
  const moi = pos.toPlay, n = pos.size;
  switch (c.modele) {
    case 'atari-joueur': {
      expect(pos.board[c.point!]).toBe(moi);
      const g = groupAt(pos.board, n, c.point!);
      expect(g.liberties.size).toBe(1);
      expect(c.zone).toEqual([...g.stones, ...g.liberties].sort((a, b) => a - b));
      break;
    }
    case 'atari-adverse': {
      const r = play(pos, c.point!);
      expect(typeof r).not.toBe('string');
      const pris = c.zone.filter(p => p !== c.point);
      expect(pris.length).toBe(c.pierres);
      for (const p of pris) { expect(pos.board[p]).toBe(3 - moi); expect((r as Position).board[p]).toBe(0); }
      break;
    }
    case 'peu-de-libertes': {
      expect(pos.board[c.point!]).toBe(moi);
      expect(groupAt(pos.board, n, c.point!).liberties.size).toBe(2);
      break;
    }
    case 'coin-libre': {
      for (const p of c.zone) expect(pos.board[p]).toBe(0);
      expect(pos.board.filter(v => v !== 0).length).toBeLessThanOrEqual(reglesCoin(n)!.maxPierres);
      break;
    }
    case 'zone-a-prendre':
      for (const p of c.zone) expect(pos.board[p]).toBe(0);
      break;
  }
}

describe('Conseil de Mochi : aucune phrase fausse', () => {
  it('les positions fixes', () => {
    for (const f of fixtures) { const c = conseil(f.pos, f.options); if (c) verifier(f.pos, c); }
  });

  it('300 positions de parties au hasard (9 × 9 et 13 × 13)', () => {
    let graine = 12345;
    const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    const vus = new Set<ModeleConseil>();
    for (let k = 0; k < 300; k++) {
      const n = k % 3 === 0 ? 13 : 9;
      let pos = newPosition(n);
      const coups = Math.floor(hasard() * n * n * 0.7);
      for (let i = 0; i < coups; i++) {
        for (let essai = 0; essai < 20; essai++) {
          const r = play(pos, Math.floor(hasard() * n * n));
          if (typeof r !== 'string') { pos = r; break; }
        }
      }
      const c = conseil(pos);
      if (c) { vus.add(c.modele); verifier(pos, c); }
    }
    // Les quatre modèles sans propriété apparaissent dans de vraies suites de coups.
    expect([...vus].sort()).toEqual(['atari-adverse', 'atari-joueur', 'coin-libre', 'peu-de-libertes']);
  });

  it('jamais d’« atari » sur un groupe à deux libertés', () => {
    // Pierre noire à deux libertés, rien d'autre en atari : la phrase d'atari ne sort pas.
    for (const pos of [plateau(9, ['E5'], ['E6', 'D5']), plateau(9, ['A1'], ['B1']), plateau(19, ['K10', 'K11'], ['J10', 'L10', 'J11', 'L11'])]) {
      expect(conseil(pos)?.modele).not.toBe('atari-joueur');
      expect(conseil(pos)?.modele).not.toBe('atari-adverse');
    }
  });
});

describe('Conseil de Mochi : textes', () => {
  const cles = ['conseil.atariJoueur', 'conseil.atariAdverse', 'conseil.peuDeLibertes', 'conseil.coinLibre', 'conseil.zoneAPrendre'] as const;
  const mots = (s: string) => s.replace(/[:!.,?]/g, ' ').split(/\s+/).filter(Boolean).length;

  it('12 mots au plus, en français et en anglais, au singulier et au pluriel', () => {
    for (const l of ['fr', 'en'] as const) for (const cle of cles) for (const n of [1, 3]) {
      const s = traduire(l, cle, { point: 'Q16', n } as never);
      expect(s).not.toMatch(/\{/);
      expect(mots(s)).toBeLessThanOrEqual(12);
    }
  });

  it('tutoiement en français', () => {
    for (const cle of cles) expect(traduire('fr', cle, { point: 'E5', n: 2 } as never)).not.toMatch(/\bvous\b|\bvotre\b/i);
  });

  it('un modèle par phrase, dans l’ordre de priorité', () => {
    expect(MODELES).toEqual(['atari-joueur', 'atari-adverse', 'peu-de-libertes', 'coin-libre', 'zone-a-prendre']);
  });

  it('phrase anglaise', () => {
    const c = conseil(atariBlancE5())!;
    expect(phraseConseil(c, 9, 'en')).toBe('You can capture at E4: that stone has one liberty left.');
    expect(phraseConseil(conseil(newPosition(9))!, 9, 'en')).toBe('A corner is still free: corners first.');
  });
});
