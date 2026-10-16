// Règle de Mochi (#527, décision de Florian ; charte `.claude/skills/personnages-go`, section « Mochi : sceau ou portrait ») :
// - le SCEAU jade pour les messages d'interface : bandeaux, aides, états vides, confirmations, accueil ;
// - le PORTRAIT quand Mochi parle de la partie ou de l'exercice du joueur : coach en partie, revue, bilan, « Rejouer mes
//   erreurs », leçon, problèmes, découverte, introduction des règles.
// Ce test lit les sources : chaque écran qui montre Mochi est classé ici, avec le nombre exact de sceaux et de portraits.
// Un nouvel écran, ou un rendu qui change, fait échouer le test : on décide alors du visage avec la règle, puis on met
// la table à jour.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Bubble } from './Mochi';

type Usage = { sceau: number; portrait: number; pourquoi: string };

const REGLE: Record<string, Usage> = {
  // ---------- Sceau seul : messages d'interface ----------
  'src/app/Accueil.tsx': { sceau: 4, portrait: 0, pourquoi: 'accueil : annonce de Mochi, icônes du chemin et de la partie guidée' },
  'src/app/CreerCompte.tsx': { sceau: 2, portrait: 0, pourquoi: 'création de compte : confirmation, aide' },
  'src/app/Direct.tsx': { sceau: 2, portrait: 0, pourquoi: 'en ligne : attente, délai après abandons' },
  'src/app/Learn.tsx': { sceau: 1, portrait: 0, pourquoi: 'chemin des leçons : aide pour choisir la suite (la leçon elle-même a le portrait)' },
  'src/app/Lentes.tsx': { sceau: 1, portrait: 0, pourquoi: 'parties lentes : recherche en cours' },
  'src/app/PartiePartagee.tsx': { sceau: 4, portrait: 0, pourquoi: 'lien partagé : chargement, introuvable, aide pour revoir les coups' },
  'src/app/ProfilPublic.tsx': { sceau: 1, portrait: 0, pourquoi: 'profil public (#560) : « Ce joueur n’est pas disponible » (état vide d’interface)' },
  'src/app/QuestionGo.tsx': { sceau: 1, portrait: 0, pourquoi: 'premier lancement : « Tu connais le go ? » (accueil)' },
  'src/app/VeilleFile.tsx': { sceau: 2, portrait: 0, pourquoi: 'en ligne : attente dans la file' },
  'src/ui/BilanSemaine.tsx': { sceau: 1, portrait: 0, pourquoi: 'carte de l’accueil (la semaine), pas une partie' },
  'src/ui/EcranErreur.tsx': { sceau: 1, portrait: 0, pourquoi: 'écran d’erreur' },
  'src/ui/Retours.tsx': { sceau: 1, portrait: 0, pourquoi: 'ton avis en 3 questions : « Merci ! » (confirmation)' },
  // ---------- Portrait seul : Mochi parle de ta partie ou de ton exercice ----------
  'src/app/CourseProblemes.tsx': { sceau: 0, portrait: 1, pourquoi: 'problèmes : énoncé' },
  'src/app/Game.tsx': { sceau: 0, portrait: 3, pourquoi: 'partie guidée (Mochi joue Blanc), fin de partie guidée, bouton « Conseil »' },
  'src/app/IntroRegles.tsx': { sceau: 0, portrait: 1, pourquoi: 'introduction des règles' },
  'src/app/Lecon.tsx': { sceau: 0, portrait: 1, pourquoi: 'leçon' },
  'src/app/PartieDecouverte.tsx': { sceau: 0, portrait: 2, pourquoi: 'partie de découverte, et sa fin' },
  'src/app/Placement.tsx': { sceau: 0, portrait: 1, pourquoi: 'placement : bilan de tes trois problèmes' },
  'src/app/RejouerErreurs.tsx': { sceau: 0, portrait: 2, pourquoi: 'Rejouer mes erreurs : consigne, bilan' },
  'src/app/Revue.tsx': { sceau: 0, portrait: 4, pourquoi: 'revue : analyse, bilan, parcours, « Rejoue cette erreur »' },
  'src/ui/BulleCoach.tsx': { sceau: 0, portrait: 1, pourquoi: 'coach en partie' },
  'src/ui/ConseilMochi.tsx': { sceau: 0, portrait: 1, pourquoi: 'conseil en partie' },
  'src/ui/FinPartie.tsx': { sceau: 0, portrait: 1, pourquoi: 'fin de partie : la leçon de ta partie' },
  'src/ui/Lecteur.tsx': { sceau: 0, portrait: 1, pourquoi: 'lecteur de leçon' },
  'src/ui/Partie.tsx': { sceau: 0, portrait: 1, pourquoi: 'coach en partie (une phrase à la fois)' },
  // ---------- Les deux, chacun à sa place ----------
  'src/app/App.tsx': { sceau: 2, portrait: 2, pourquoi: 'bandeaux de l’accueil (série gelée, retour de série) ; bulle d’intro de la partie (but, komi)' },
  'src/app/MesParties.tsx': { sceau: 1, portrait: 1, pourquoi: 'état vide (sceau) ; Mochi adversaire d’une partie guidée, comme les autres adversaires (portrait)' },
  'src/app/SeanceRevisions.tsx': { sceau: 1, portrait: 1, pourquoi: 'rien à réviser, état vide (sceau) ; bilan de la séance (portrait)' },
  'src/app/Statistiques.tsx': { sceau: 1, portrait: 1, pourquoi: 'aucune partie, état vide (sceau) ; ce que disent tes parties (portrait)' },
  // Émotes en ligne : le joueur envoie une humeur de Mochi, seul le portrait en a. Merci après un signalement : sceau.
  'src/ui/Securite.tsx': { sceau: 1, portrait: 2, pourquoi: 'confirmation du signalement (sceau) ; émotes à humeur (portrait)' },
};

const RACINE = join(__dirname, '..', '..');

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap(n => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
  });
}

/** Source sans ses commentaires (`//`, `/* … *\/`, `{/* … *\/}`). */
const sansCommentaires = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function usage(src: string): { sceau: number; portrait: number } {
  const s = sansCommentaires(src);
  const n = (re: RegExp) => (s.match(re) ?? []).length;
  return {
    sceau: n(/<Mochi\b/g) + n(/<Bubble\s+voix="interface"/g) + n(/<Sceau\s+id="mochi"/g),
    portrait: n(/<PortraitMochi\b/g) + n(/<Bubble\s+voix="coach"/g),
  };
}

describe('Mochi : sceau pour l’interface, portrait quand il parle de ta partie (#527)', () => {
  const lus = Object.fromEntries(fichiers(join(RACINE, 'src'))
    .map(f => [relative(RACINE, f).split('\\').join('/'), readFileSync(f, 'utf8')] as const)
    .filter(([f]) => f !== 'src/ui/Mochi.tsx' && f !== 'src/ui/Portrait.tsx'));

  it('chaque écran qui montre Mochi est classé, avec ses rendus', () => {
    const vus = Object.entries(lus).map(([f, s]) => [f, usage(s)] as const).filter(([, u]) => u.sceau + u.portrait > 0);
    const nonClasses = vus.filter(([f]) => !REGLE[f]).map(([f, u]) => `${f} (sceau ${u.sceau}, portrait ${u.portrait})`);
    expect(nonClasses, 'écran à classer dans REGLE (voir la règle en tête de fichier)').toEqual([]);
    for (const [f, u] of vus) expect({ sceau: u.sceau, portrait: u.portrait }, `${f} : ${REGLE[f].pourquoi}`).toEqual({ sceau: REGLE[f].sceau, portrait: REGLE[f].portrait });
    // Un écran classé qui ne montre plus Mochi : on retire sa ligne.
    for (const f of Object.keys(REGLE)) expect(vus.some(([g]) => g === f), `${f} ne montre plus Mochi`).toBe(true);
  });

  it('toute bulle de Mochi dit qui parle (interface ou coach)', () => {
    for (const [f, s] of Object.entries(lus)) {
      const bulles = sansCommentaires(s).match(/<Bubble\b[^>]*>/g) ?? [];
      for (const b of bulles) expect(b, f).toMatch(/voix="(interface|coach)"/);
    }
  });

  it('les écrans où Mochi parle de ta partie ou de ton exercice n’ont jamais le sceau', () => {
    for (const f of ['src/app/Revue.tsx', 'src/app/RejouerErreurs.tsx', 'src/app/Lecon.tsx', 'src/app/CourseProblemes.tsx', 'src/app/PartieDecouverte.tsx', 'src/app/IntroRegles.tsx', 'src/ui/Partie.tsx', 'src/ui/FinPartie.tsx']) {
      expect(usage(lus[f]).sceau, f).toBe(0);
    }
  });

  it('la bulle d’intro de la partie a le portrait, comme le coach qui suit (constat n° 5 de la passe #509)', () => {
    const app = sansCommentaires(lus['src/app/App.tsx']);
    const intro = app.match(/intro=\{[^\n]*/)?.[0] ?? '';
    expect(intro).toContain('<Bubble voix="coach">');
    expect(intro).not.toContain('voix="interface"');
  });
});

describe('Bubble', () => {
  it('voix « coach » : le portrait (avec son humeur) ; voix « interface » : le sceau', () => {
    const coach = renderToStaticMarkup(createElement(Bubble, { voix: 'coach', humeur: 'content', children: 'À toi.' }));
    expect(coach).toContain('data-portrait="mochi"');
    expect(coach).toContain('data-humeur="content"');
    expect(coach).not.toContain('class="sceau');
    const ui = renderToStaticMarkup(createElement(Bubble, { voix: 'interface', children: 'Choisis une leçon.' }));
    expect(ui).toContain('class="sceau');
    expect(ui).not.toContain('data-portrait');
  });
});
