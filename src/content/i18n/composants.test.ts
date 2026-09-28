// Issue #167, étape 3 : composants partagés (niveau, XP, carrousel, Mes erreurs, installation, Go du jour, vitrine,
// thèmes du goban) passés par `t`. Le français reste strictement identique aux textes d'origine, l'anglais suit.
import { THEMES_GOBAN, ORDRE_THEMES } from '../../ui/boardArt';
import { RECOMPENSES, libelleRecompense } from '../../app/xp';
import { battuAccorde } from '../../ui/sceaux';
import { textePartage } from '../../app/goDuJour';
import { consigneErreur, titreErreur } from '../../app/erreurs';
import { badges, statistiques, type Donnees } from '../../app/vitrine';
import { choisirLangue, traduire } from './index';

const vide: Donnees = { reussis: 0, serie: 0, parties: 0, bilan: {}, paliers: [] };
const plein: Donnees = {
  reussis: 12, serie: 8, parties: 5, bilan: { pomme: { v: 2, d: 0 } } as unknown as Donnees['bilan'],
  paliers: [{ id: 'debutant', complet: true }, { id: 'novice', complet: true }],
};

describe('français identique aux textes d’origine', () => {
  afterEach(() => choisirLangue('fr'));

  it('noms des thèmes du goban et des récompenses', () => {
    for (const id of ORDRE_THEMES) expect(traduire('fr', `theme.${id}`)).toBe(THEMES_GOBAN[id].nom);
    for (const r of RECOMPENSES) expect(traduire('fr', `theme.${r.id}`)).toBe(r.nom);
    expect(RECOMPENSES.map(libelleRecompense)).toEqual(['le goban « Kaya clair »', 'le goban « Ardoise »', 'les pierres « Coquillage doré »']);
  });

  it('barre de niveau, fête et pastille', () => {
    expect(traduire('fr', 'niveau.barre', { niveau: 3 })).toBe('Niveau 3');
    expect(traduire('fr', 'niveau.xp', { dans: 140, besoin: 155 })).toBe('140 / 155 XP');
    expect(traduire('fr', 'niveau.valeur', { dans: 140, besoin: 155, suivant: 4 })).toBe('140 XP sur 155 avant le niveau 4');
    expect(traduire('fr', 'niveau.suite', { niveau: 3, recompense: 'le goban « Kaya clair »' })).toBe('Niveau 3 : le goban « Kaya clair »');
    expect(traduire('fr', 'niveau.fete', { niveau: 5 })).toBe('Niveau 5 !');
    expect(traduire('fr', 'niveau.feteAria', { niveau: 5 })).toBe('Niveau 5 atteint. Fermer');
    expect(traduire('fr', 'niveau.debloque', { recompense: 'le goban « Ardoise »' })).toBe('Tu débloques le goban « Ardoise ».');
    expect(traduire('fr', 'xp.bonus', { bonus: 20 })).toBe('dont +20 première fois');
  });

  it('carrousel et tampon des battus', () => {
    expect(['0', '1', '2'].map(p => traduire('fr', `carrousel.palier.${p as '0' | '1' | '2'}`))).toEqual(['Premiers pas', 'Ça se corse', 'Les maîtres']);
    expect(traduire('fr', 'carrousel.verrou', { requis: 'Pomme', nom: 'Caillou' })).toBe("Bats d'abord Pomme pour affronter Caillou.");
    expect(battuAccorde('pomme')).toBe('battue');
    expect(battuAccorde('tigre')).toBe('battu');
  });

  it('Mes erreurs', () => {
    expect(titreErreur({ coup: 14, adversaire: 'Pomme' })).toBe('Ta partie contre Pomme, coup 14');
    expect(titreErreur({ coup: 3 })).toBe('Ta partie à deux, coup 3');
    expect(consigneErreur({ reponses: [1, 2] })).toBe('Trouve mieux que ton coup.');
    expect(consigneErreur({ reponses: [1] })).toBe('Trouve mieux que ton coup : seul le coup de KataGo est accepté.');
    expect(traduire('fr', 'erreurs.aide')).toBe('Des positions de tes parties. Trouve le coup que KataGo conseillait.');
  });

  it('texte partagé du Go du jour', () => {
    expect(textePartage(1, 1, 3).texte).toBe('Go du jour n° 1 · résolu en 1 essai · série 3 🔥');
    expect(textePartage(12, 4, 0).texte).toBe('Go du jour n° 12 · résolu en 4 essais');
    expect(textePartage(2, 0, 1).texte).toBe('Go du jour n° 2 · résolu en 1 essai · série 1 🔥');
  });

  it('statistiques et badges', () => {
    const p0 = { lecons: { faites: 0, total: 7 }, adversaires: 9 }, p2 = { lecons: { faites: 2, total: 7 }, adversaires: 9 };
    expect(statistiques(vide, p0).map(s => s.legende)).toEqual(['jour de série', 'leçon finie', 'adversaire battu', 'problème réussi']);
    expect(statistiques({ ...vide, reussis: 1, serie: 1, parties: 1 }, p0).map(s => s.legende)).toEqual(['jour de série', 'leçon finie', 'adversaire battu', 'problème réussi']);
    expect(statistiques({ ...plein, serie: 7, bilan: { pomme: { v: 1, d: 0 }, caillou: { v: 2, d: 0 } } }, p2).map(s => s.legende)).toEqual(['jours, ton record', 'leçons finies', 'adversaires battus', 'problèmes réussis']);
    expect(badges(vide).map(b => [b.id, b.nom, b.condition])).toEqual([
      ['premiere-partie', 'Première partie', 'Joue contre l’ordi.'],
      ['premier-probleme', 'Premier problème', 'Réussis un problème.'],
      ['victoire-pomme', 'Pomme battue', 'Gagne contre Pomme.'],
      ['palier-debutant', 'Palier Débutant', 'Finis le palier Débutant.'],
      ['dix-problemes', '10 problèmes', 'Réussis 10 problèmes.'],
      ['palier-novice', 'Palier Novice', 'Finis le palier Novice.'],
      ['serie-7', '7 jours de série', 'Garde ta série 7 jours.'],
    ]);
    expect(badges(plein).every(b => b.obtenu)).toBe(true);
    expect(traduire('fr', 'vitrine.aGagner', { nom: 'Pomme battue', condition: 'Gagne contre Pomme.' })).toBe('Pomme battue : à gagner. Gagne contre Pomme.');
  });
});

describe('en anglais', () => {
  beforeEach(() => choisirLangue('en'));
  afterEach(() => choisirLangue('fr'));

  it('récompenses, tampon et Mes erreurs', () => {
    expect(libelleRecompense(RECOMPENSES[0])).toBe('the “Light kaya” board');
    expect(libelleRecompense(RECOMPENSES[2])).toBe('the “Golden shell” stones');
    expect(battuAccorde('pomme')).toBe('beaten');
    expect(titreErreur({ coup: 14, adversaire: 'Pomme' })).toBe('Your game against Pomme, move 14');
  });

  it('texte partagé : pluriel anglais', () => {
    expect(textePartage(1, 1, 3).texte).toBe('Daily Go #1 · solved in 1 try · streak 3 🔥');
    expect(textePartage(12, 4, 0).texte).toBe('Daily Go #12 · solved in 4 tries');
  });

  it('statistiques (0 est pluriel en anglais) et badges', () => {
    const p = { lecons: { faites: 0, total: 7 }, adversaires: 9 };
    expect(statistiques(vide, p).map(s => s.legende)).toEqual(['day streak', 'lessons done', 'opponents beaten', 'puzzles solved']);
    expect(statistiques({ ...vide, reussis: 1, bilan: { pomme: { v: 1, d: 0 } } }, { ...p, lecons: { faites: 1, total: 7 } }).map(s => s.legende)).toEqual(['day streak', 'lesson done', 'opponent beaten', 'puzzle solved']);
    expect(badges(vide)[0]).toMatchObject({ nom: 'First game', condition: 'Play a game vs the computer.' });
  });
});
