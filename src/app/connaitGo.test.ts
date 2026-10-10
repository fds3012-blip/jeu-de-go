// #523 : « Tu connais le go ? » : quand la poser, où mène chaque réponse, ce qui est gardé sur l'appareil.
import { CONNAIT_GO_KEY, doitDemander, lireReponse, REPONSES, suiteDe } from './connaitGo';
import { accueilEpure } from './premierePierre';
import { readFileSync } from 'node:fs';

describe('« Tu connais le go ? » : quand la question se pose', () => {
  it('seulement sur l’accueil épuré (#487 : tout premier lancement, aucune pierre posée)', () => {
    expect(doitDemander({ epure: accueilEpure({ nouveau: true, pierre: false }), reponse: null, plusTard: false })).toBe(true);
    // Une pierre posée (partie, leçon, problème, placement) ou une partie déjà jouée : plus de question.
    expect(doitDemander({ epure: accueilEpure({ nouveau: true, pierre: true }), reponse: null, plusTard: false })).toBe(false);
    expect(doitDemander({ epure: accueilEpure({ nouveau: false, pierre: false }), reponse: null, plusTard: false })).toBe(false);
  });

  it('une seule fois : une réponse gardée la referme pour de bon', () => {
    for (const r of REPONSES) expect(doitDemander({ epure: true, reponse: r, plusTard: false }), r).toBe(false);
  });

  it('« Plus tard » la referme pour la session seulement : rien n’est gardé, elle revient à la prochaine ouverture', () => {
    expect(doitDemander({ epure: true, reponse: null, plusTard: true })).toBe(false);
    // Nouvelle session : `plusTard` repart de faux (état de l'app), et la réponse lue sur l'appareil est toujours absente.
    expect(doitDemander({ epure: true, reponse: lireReponse(null), plusTard: false })).toBe(true);
  });
});

describe('routage selon la réponse', () => {
  it('« Jamais joué » → introduction complète ; « Un peu » → rappel express ; « Je sais jouer » → accueil d’avant', () => {
    expect(suiteDe('jamais')).toEqual({ ecran: 'intro', version: 'complete' });
    expect(suiteDe('un_peu')).toEqual({ ecran: 'intro', version: 'express' });
    expect(suiteDe('sait')).toEqual({ ecran: 'accueil' });
  });
});

describe('persistance sur l’appareil', () => {
  it('clé versionnée dans l’espace `go.*`, citée par la politique de confidentialité (section 3.1)', () => {
    expect(CONNAIT_GO_KEY).toBe('go.connait-go.v1');
    const politique = readFileSync(new URL('../../docs/juridique/politique-confidentialite.md', import.meta.url), 'utf8');
    const s31 = politique.slice(politique.indexOf('### 3.1 '), politique.indexOf('### 3.2 '));
    expect(s31).toContain('`go.connait-go.v1`');
  });

  it('relit les trois réponses telles qu’écrites (JSON, comme useStored), et rien d’autre', () => {
    for (const r of REPONSES) expect(lireReponse(JSON.parse(JSON.stringify(r)))).toBe(r);
    for (const brut of [null, undefined, '', 'plus_tard', 'oui', 3, true, {}, ['sait']]) expect(lireReponse(brut)).toBeNull();
  });
  // L'aller-retour réel (réponse gardée, question absente après rechargement) : e2e/connait-go.spec.ts.
});
