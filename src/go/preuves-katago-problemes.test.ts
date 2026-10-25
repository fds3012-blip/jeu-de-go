// #733 : contrôle KataGo des problèmes ajoutés par les lots du chantier C4, rejoué sans le réseau.
//
// Le moteur de règles prouve la réponse (minimax exact, recherche complète) ; KataGo donne un second avis indépendant, calculé
// une fois par `npm run preuves-katago-problemes -- --lot <lettres>` (réseau g170 b6c96 du dépôt, komi 6,5, règle
// japonaise, 8 symétries du plateau, outils/preuvesKataGoProblemes.ts) et figé dans src/go/preuves-katago-problemes.json :
// - la réponse est le premier choix de la politique du réseau, et de la recherche dans presque toutes les symétries ;
// - pour les problèmes de fin de partie et de comptage : la propriété par point estimée par le réseau coïncide avec le
//   partage du territoire du projet (src/go/refutation-fin.ts), point par point.
// La « avance » en points de KataGo n'est pas utilisée : le réseau y mêle les règles et compte les pierres, ce qui ne se
// compare pas au compte japonais (territoire + prisonniers) des problèmes.
import { ALL_PUZZLES } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { parsePuzzles, startOf } from '../data/puzzles';
import { butFin } from '../../outils/refutationsLocales';
import { REGLAGES_PROBLEMES, cleProbleme, jugementKataGo, type PreuvesProblemes } from '../../outils/kataGoProblemes';
import preuvesJson from './preuves-katago-problemes.json';
import { toLabel } from './coords';
import { proprietaires } from './refutation-fin';

const preuves = preuvesJson as unknown as PreuvesProblemes;
const tous = parsePuzzles(ALL_PUZZLES);
const parId = new Map(tous.map(p => [p.id, p]));

/** Problèmes du lot AC (comptage) : le contrôle est obligatoire. Les lots suivants s'ajoutent ici. */
const OBLIGATOIRES = ['ac01', 'ac02', 'ac03', 'ac04', 'ac05'];

describe('contrôle KataGo figé (src/go/preuves-katago-problemes.json)', () => {
  it('les réglages de la fixture sont ceux de outils/kataGoProblemes.ts, et tout le lot AC est contrôlé', () => {
    expect(preuves.reglages).toEqual(REGLAGES_PROBLEMES);
    for (const id of OBLIGATOIRES) expect(preuves.problemes[id], `${id} : npm run preuves-katago-problemes -- --lot ac`).toBeTruthy();
  });

  for (const [id, a] of Object.entries(preuves.problemes)) {
    const p = parId.get(id);

    it(`${id} : le problème existe et la fixture est à jour (position, trait, réponses)`, () => {
      expect(p, id).toBeTruthy();
      expect(a.cle, `${id} : le problème a changé, relance npm run preuves-katago-problemes`).toBe(cleProbleme(p!));
      expect(a.recherche).toHaveLength(REGLAGES_PROBLEMES.symetries.length);
    });
    if (!p) continue;

    it(`${id} : ${toLabel(p.answers[0], p.size)} est le premier choix de la politique du réseau et de la recherche`, () => {
      const j = jugementKataGo(p, a);
      expect(j.rang, `${id} : rang dans la politique`).toBe(1);
      expect(j.prior, `${id} : probabilité`).toBeGreaterThan(0.3);
      // Une recherche courte (64 visites) peut hésiter dans une symétrie : 7 sur 8 au moins.
      expect(j.symetriesOk, `${id} : symétries où la recherche la préfère`).toBeGreaterThanOrEqual(7);
    });

    const but = butFin(p);
    if (!but || !['comptage', 'fin-de-partie'].includes(THEME_DU_PROBLEME[id] ?? '')) continue;

    it(`${id} : la propriété estimée par KataGo est le partage du territoire du projet, point par point`, () => {
      const { pos } = startOf(p), owner = proprietaires(pos, but), zone = new Set(but.zone), mortes = new Set(but.mortes);
      const ecarts: string[] = [];
      for (let q = 0; q < p.size * p.size; q++) {
        if (zone.has(q) || (pos.board[q] && !mortes.has(q))) continue;
        const attendu = owner[q] === 1 ? 'N' : owner[q] === 2 ? 'B' : '?';
        const lu = a.propriete[Math.floor(q / p.size)][q % p.size];
        if (lu !== attendu) ecarts.push(`${toLabel(q, p.size)} (projet ${attendu}, KataGo ${lu})`);
      }
      expect(ecarts, id).toEqual([]);
    });
  }
});
