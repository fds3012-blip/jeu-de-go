// Coach Mochi (#470), côté écran : budget de 3 bulles, écart, priorité, phrases et réglage.
import { describe, expect, it } from 'vitest';
import { BULLES_PAR_PARTIE, calqueCoach, choisirMoment, cleMoment, ECART_MIN, etatCoachInitial, noterMoment, phraseCoach, proprietesBulle, type EntreeCoach, type MomentCoach } from './coach';
import { coachActif, DEFAULTS, lireSettings, PARTIES_AVEC_COACH } from './settings';
import { fromLabel } from '../go/coords';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';

const pos = (rows: string[], trait: 1 | 2 = 1) => fromRows(rows, trait).pos;
const jouer = (p: Position, label: string): Position => {
  const r = play(p, fromLabel(label, p.size));
  if (typeof r === 'string') throw new Error(`${label} : ${r}`);
  return r;
};

// Noir joue A1 sans prendre E5 (en atari, prise en E4) ; Blanc répond loin, en J9.
const avantToi = pos([
  '.........',
  '.........',
  '.........',
  '....X....',
  '...XOX...',
  '.........',
  '.........',
  '.........',
  '.........',
]);
const apresToi = jouer(avantToi, 'A1');
const priseSeule: EntreeCoach = { avantToi, apresToi, apresIa: jouer(apresToi, 'J9'), moi: 1, len: 10 };

// Même position, mais Blanc répond en mettant Noir A1 en atari : l'atari passe avant la prise ratée.
const atariEtPrise: EntreeCoach = { avantToi, apresToi, apresIa: jouer(apresToi, 'B1'), moi: 1, len: 10 };

describe('choisirMoment', () => {
  it('dit la prise ratée quand rien de plus urgent', () => {
    expect(choisirMoment(priseSeule, etatCoachInitial())?.type).toBe('prise-ratee');
  });
  it('donne la priorité à l’atari sur la prise ratée', () => {
    expect(choisirMoment(atariEtPrise, etatCoachInitial())?.type).toBe('atari');
  });
  it('se tait sans moment clé', () => {
    const p = pos(['.........', '.........', '.........', '.........', '....X....', '.........', '.........', '.........', '.........'], 2);
    const r = jouer(p, 'C3');
    expect(choisirMoment({ avantToi: null, apresToi: p, apresIa: r, moi: 1, len: 3 }, etatCoachInitial())).toBeNull();
  });
  it('3 bulles au plus par partie', () => {
    let etat = etatCoachInitial();
    for (let i = 0; i < BULLES_PAR_PARTIE; i++) etat = { ...etat, bulles: i + 1, derniereA: null };
    expect(choisirMoment(priseSeule, etat)).toBeNull();
  });
  it('attend ECART_MIN demi-coups après la bulle précédente', () => {
    const etat = { ...etatCoachInitial(), bulles: 1, derniereA: priseSeule.len - ECART_MIN + 2 };
    expect(choisirMoment(priseSeule, etat)).toBeNull();
    expect(choisirMoment(priseSeule, { ...etat, derniereA: priseSeule.len - ECART_MIN })?.type).toBe('prise-ratee');
  });
  it('ne redit pas le même groupe', () => {
    const m = choisirMoment(priseSeule, etatCoachInitial())!;
    const etat = noterMoment(etatCoachInitial(), m, 10);
    expect(etat).toEqual({ bulles: 1, derniereA: 10, deja: [cleMoment(m)] });
    expect(choisirMoment({ ...priseSeule, len: 20 }, etat)).toBeNull();
  });
  it('ne parle que quand c’est au joueur de jouer', () => {
    expect(choisirMoment({ ...priseSeule, apresIa: apresToi }, etatCoachInitial())).toBeNull();
  });
});

describe('phrases (tutoiement, vocabulaire expliqué)', () => {
  it('atari : la liberté est expliquée', () => {
    const m = choisirMoment(atariEtPrise, etatCoachInitial())!;
    expect(phraseCoach(m, 9, 'fr')).toBe("Atari en A1 : ton groupe n’a plus qu’une liberté (un point libre à côté). Sans réponse, il peut être pris.");
    expect(phraseCoach(m, 9, 'en')).toContain('Atari at A1: your group');
  });
  it('prise ratée : accord au singulier et au pluriel', () => {
    const m = choisirMoment(priseSeule, etatCoachInitial())!;
    expect(phraseCoach(m, 9, 'fr')).toBe("Au coup d’avant, tu pouvais prendre une pierre en E4 : elle n’avait plus qu’une liberté.");
    expect(phraseCoach({ type: 'prise-ratee', point: 0, pierres: [1, 2] }, 9, 'fr')).toBe("Au coup d’avant, tu pouvais prendre 2 pierres en A9 : elles n’avaient plus qu’une liberté.");
  });
  it('un seul œil : le mot œil est expliqué', () => {
    expect(phraseCoach({ type: 'un-oeil', repere: fromLabel('A2', 9), pierres: [], oeil: [] }, 9, 'fr'))
      .toBe("Ton groupe en A2 n’a qu’un œil (un trou fermé par tes pierres). Il en faut deux pour vivre : il est en danger.");
  });
  it('zone libre : le coin est nommé', () => {
    expect(phraseCoach({ type: 'zone-libre', coin: 'bg', zone: [] }, 9, 'fr')).toBe('Le coin en bas à gauche est encore tout vide. Une pierre là-bas peut y prendre beaucoup de place.');
    expect(phraseCoach({ type: 'zone-libre', coin: 'hd', zone: [] }, 9, 'en')).toBe('The top-right corner is still completely empty. A stone there can claim a lot of room.');
  });
  it('phrases courtes (25 mots au plus)', () => {
    const ms = [choisirMoment(atariEtPrise, etatCoachInitial())!, choisirMoment(priseSeule, etatCoachInitial())!,
      { type: 'un-oeil', repere: 0, pierres: [], oeil: [] }, { type: 'zone-libre', coin: 'hd', zone: [] }] satisfies MomentCoach[];
    for (const m of ms) expect(phraseCoach(m, 9, 'fr').split(/\s+/).length).toBeLessThanOrEqual(25);
  });
});

describe('calque et mesure', () => {
  it('prise ratée : le point cerclé et les pierres encore là', () => {
    const m = choisirMoment(priseSeule, etatCoachInitial())!;
    expect(calqueCoach(m, priseSeule.apresIa)).toEqual({ zone: [fromLabel('E5', 9), fromLabel('E4', 9)].sort((a, b) => a - b), point: fromLabel('E4', 9) });
  });
  it('atari : le groupe et sa liberté', () => {
    const m = choisirMoment(atariEtPrise, etatCoachInitial())!;
    expect(calqueCoach(m, atariEtPrise.apresIa)).toEqual({ zone: [fromLabel('A2', 9), fromLabel('A1', 9)].sort((a, b) => a - b), point: fromLabel('A2', 9) });
  });
  it('événement coach_bulle : type et contexte, jamais la position', () => {
    const m = choisirMoment(priseSeule, etatCoachInitial())!;
    expect(proprietesBulle(m, { numero: 1, coup: 9, taille: 9, adversaire: 'pomme' })).toEqual({ type: 'prise-ratee', numero: 1, coup: 9, taille: 9, adversaire: 'pomme' });
  });
});

describe('réglage du coach', () => {
  it('actif par défaut pendant les 10 premières parties', () => {
    expect(DEFAULTS.coach).toBe('auto');
    expect(PARTIES_AVEC_COACH).toBe(10);
    expect(coachActif('auto', 0)).toBe(true);
    expect(coachActif('auto', 9)).toBe(true);
    expect(coachActif('auto', 10)).toBe(false);
    expect(coachActif(undefined, 3)).toBe(true);
  });
  it('« Toujours » et « Jamais » l’emportent sur le compteur', () => {
    expect(coachActif('oui', 50)).toBe(true);
    expect(coachActif('non', 0)).toBe(false);
  });
  it('une valeur abîmée revient à « auto »', () => {
    expect(lireSettings({ coach: 'peut-etre' }).coach).toBe('auto');
    expect(lireSettings({ coach: 'non' }).coach).toBe('non');
    expect(lireSettings({}).coach).toBe('auto');
  });
});
