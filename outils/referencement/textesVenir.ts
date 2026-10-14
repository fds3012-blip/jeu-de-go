// Pages d'entrée par cible (#537, plan d'acquisition docs/marketing/analyse-marche-acquisition-2026-10.md, section 2.4 F) :
// le joueur d'échecs curieux (cible cœur), le fan de Hikaru no Go, le parent, et le vocabulaire du go. Mêmes règles que
// textes.ts : aucun chiffre qui ne soit compté dans le dépôt, pas de promesse interdite par les fiches stores, tutoiement,
// phrases courtes. Aucun conseil de go : seulement des faits sûrs des règles. Les définitions du vocabulaire sont celles
// du glossaire de l'app (aide, #362), relues et traduites : une seule source, rien d'écrit deux fois.
import { frEcrans } from '../../src/content/i18n/frEcrans';
import { en } from '../../src/content/i18n/en';
import type { Langue, Page, Question } from './textes';

const GLOSSAIRE: Record<Langue, Record<string, string>> = { fr: frEcrans as unknown as Record<string, string>, en: en as unknown as Record<string, string> };

/** Mot du glossaire de l'app : son nom et sa définition, sans la phrase qui renvoie au schéma de l'aide (« Ici, … »). */
export function mot(l: Langue, id: string): { nom: string; def: string } {
  const nom = GLOSSAIRE[l][`aide.mot.${id}`];
  const brut = GLOSSAIRE[l][`aide.mot.${id}.def`];
  if (!nom || !brut) throw new Error(`Mot absent du glossaire de l'app : ${id} (${l})`);
  return { nom, def: brut.replace(/\s*(?:Ici|Here)\b[^.]*\.\s*/g, ' ').trim() };
}

/** Liste de définitions (HTML) : les mots de l'app, plus des mots propres à la page (`avant`). */
function glossaire(l: Langue, ids: readonly string[], avant: { nom: string; def: string }[] = []): string {
  const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const mots = [...avant, ...ids.map(id => mot(l, id))];
  return `<dl class="glossaire">\n${mots.map(m => `<dt>${echapper(m.nom)}</dt><dd>${echapper(m.def)}</dd>`).join('\n')}\n</dl>`;
}

/** Question de FAQ dont la réponse est la définition de l'app. */
const question = (l: Langue, q: string, id: string): Question => ({ q, r: mot(l, id).def });

/** Mots du vocabulaire, par section. Tous existent dans le glossaire de l'app (vérifié par pages.test.ts). */
export const MOTS_VOCABULAIRE = {
  bases: ['liberte', 'groupe', 'atari', 'prisonnier', 'suicide', 'ko', 'territoire', 'komi', 'passe'],
  vie: ['oeil', 'seki', 'pierresMortes', 'semeai'],
  jeu: ['senteGote', 'tenuki', 'miai', 'joseki', 'tesuji', 'hoshi', 'sanSan', 'handicap', 'kyuDan'],
} as const;

const GOBAN = {
  fr: [
    { nom: 'Goban', def: 'Le plateau du go. On pose les pierres sur les intersections des lignes, pas dans les cases. 19 × 19 lignes pour une partie complète, 9 × 9 ou 13 × 13 pour débuter.' },
    { nom: 'Pierre', def: 'Ce qu’on pose à son tour, noire ou blanche. Toutes les pierres se valent. Une pierre posée ne bouge plus.' },
  ],
  en: [
    { nom: 'Goban', def: 'The Go board. Stones go on the points where the lines cross, not in the squares. 19 × 19 lines for a full game, 9 × 9 or 13 × 13 to start.' },
    { nom: 'Stone', def: 'What you place on your turn, black or white. All stones are equal. Once placed, a stone never moves.' },
  ],
};

const MOCHI_FR = `<ul class="atouts">
<li><strong>{lecons} leçons avec Mochi.</strong> Tu poses ta pierre dès le premier écran. Chaque mot du go est expliqué quand il arrive.</li>
<li><strong>9 adversaires</strong>, de Pomme (20 kyu, débutante) à Sensei (1 dan). Tu commences contre Pomme, sur un petit plateau.</li>
<li><strong>Plus de 100 problèmes</strong> et un Go du jour : le même défi pour tout le monde.</li>
<li><strong>Une revue honnête.</strong> À la fin, elle va droit au coup qui t’a coûté le plus, et tu le rejoues.</li>
</ul>`;

const MOCHI_EN = `<ul class="atouts">
<li><strong>{lecons} lessons with Mochi.</strong> You place your stone from the very first screen. Every Go word is explained when it first comes up.</li>
<li><strong>9 opponents</strong>, from Pomme (20 kyu, a beginner) to Sensei (1 dan). You start against Pomme, on a small board.</li>
<li><strong>Over 100 puzzles</strong> and a Daily Go: the same challenge for everyone.</li>
<li><strong>An honest review.</strong> After the game, it goes straight to the move that cost you the most, and you replay it.</li>
</ul>`;

const GRATUIT_FR: Question = { q: 'Mochi Go est-il gratuit ?', r: 'Oui. Leçons, problèmes, Go du jour et parties contre les adversaires sont gratuits, sans publicité.' };
const GRATUIT_EN: Question = { q: 'Is Mochi Go free?', r: 'Yes. Lessons, puzzles, the Daily Go and games against the opponents are free, with no ads.' };

export const PAGES_VENIR: readonly Page[] = [
  // --- Joueurs d'échecs (persona 1, cible cœur) ---------------------------------------------------------------------
  {
    chemin: 'go-pour-joueurs-echecs',
    langue: 'fr',
    traduction: 'en/go-for-chess-players',
    campagne: 'go-echecs',
    pied: 'Le go pour les joueurs d’échecs',
    titre: 'Le go pour les joueurs d’échecs | Mochi Go',
    description: 'Tu joues aux échecs ? Ce qui ressemble au go, ce qui change, et par où commencer. Puis ta première partie de go, gratuite et sans compte.',
    apercu: 'Tu joues aux échecs ? Ce qui ressemble au go, ce qui change, et ta première partie tout de suite.',
    h1: 'Tu joues aux échecs ? Essaie le go',
    chapo: 'Tu sais déjà calculer quelques coups à l’avance. Au go, tu gardes ce réflexe, avec des règles bien plus courtes. Voici ce qui ressemble, ce qui change, et par où commencer.',
    avant: [
      {
        id: 'ressemble',
        titre: 'Ce qui ressemble aux échecs',
        html: `<ul class="raisons">
<li><strong>Deux joueurs, aucun hasard.</strong> Pas de dés, pas de cartes cachées : tout est sur le plateau.</li>
<li><strong>Le calcul.</strong> Tu lis des suites de coups dans ta tête, comme une combinaison.</li>
<li><strong>Des suites connues et des problèmes.</strong> Les joseki sont des suites de coups connues dans un coin. Les problèmes de go (tsumego) se travaillent comme des problèmes d’échecs.</li>
<li><strong>Des grades.</strong> Au lieu de l’Elo, on parle de kyu, puis de dan. On débute vers 30 kyu : plus le chiffre baisse, plus tu es fort.</li>
<li><strong>L’abandon.</strong> Quand une partie est perdue, on abandonne, comme aux échecs.</li>
</ul>`,
      },
      {
        id: 'change',
        titre: 'Ce qui change',
        html: `<ul class="raisons">
<li><strong>On pose, on ne déplace pas.</strong> À ton tour, tu poses une pierre sur une intersection vide. Elle ne bouge plus.</li>
<li><strong>Toutes les pierres se valent.</strong> Pas de roi, pas de dame, pas de cavalier : aucune marche à apprendre.</li>
<li><strong>Le plateau se remplit.</strong> Aux échecs, il se vide au fil des prises. Au go, il se remplit pierre après pierre.</li>
<li><strong>Pas de mat : on compte.</strong> Tu gagnes en entourant plus de territoire que l’autre. Tu captures un groupe en lui retirant toutes ses libertés, les points vides qui le touchent.</li>
<li><strong>Noir commence.</strong> Pour compenser, Blanc reçoit des points, le komi : souvent 6,5. Le demi-point évite les égalités.</li>
<li><strong>Plusieurs combats à la fois.</strong> Tu peux laisser un combat pour jouer ailleurs : c’est le tenuki.</li>
<li><strong>Tu peux passer.</strong> Quand les deux joueurs passent l’un après l’autre, la partie s’arrête et on compte.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'commencer',
        titre: 'Par où commencer',
        html: `<ol class="regles">
<li><strong>Apprends la capture.</strong> Un groupe sans liberté est pris. La démo de cette page te le montre en trois défis.</li>
<li><strong>Joue sur un petit plateau.</strong> En 9 × 9, une partie dure quelques minutes. Tu passeras ensuite au 13 × 13, puis au 19 × 19.</li>
<li><strong>Apprends à faire vivre un groupe.</strong> Un groupe qui a deux vrais yeux ne peut pas être capturé. C’est la deuxième grande idée du go.</li>
<li><strong>Joue beaucoup de parties courtes.</strong> Tu perdras les premières : c’est normal. Chaque partie t’apprend où jouer.</li>
<li><strong>Fais un problème par jour.</strong> Comme la tactique aux échecs. Dans Mochi Go, c’est le Go du jour.</li>
</ol>
<p>Tu as déjà un peu joué au go ? Dans l’app, « Je sais déjà jouer » t’évalue en 3 problèmes.</p>`,
      },
      { id: 'mochi-go', titre: 'Ce que tu trouves dans Mochi Go', html: MOCHI_FR },
    ],
    faq: [
      { q: 'Le go est-il plus difficile que les échecs ?', r: 'Les règles sont plus courtes : poser, entourer, capturer. Le jeu reste profond, comme les échecs. AlphaGo n’a battu le champion Lee Sedol qu’en 2016.' },
      { q: 'Y a-t-il un équivalent du mat ?', r: 'Non. Au go, on gagne aux points : le territoire entouré, plus les prisonniers. On peut aussi abandonner à tout moment.' },
      { q: 'Combien de temps dure une partie ?', r: 'Sur un plateau 9 × 9, quelques minutes. Une partie complète sur 19 × 19 dure bien plus longtemps.' },
      { q: 'Qui commence au go ?', r: 'Noir. Blanc reçoit le komi, souvent 6,5 points, pour compenser.' },
      GRATUIT_FR,
    ],
  },
  {
    chemin: 'en/go-for-chess-players',
    langue: 'en',
    traduction: 'go-pour-joueurs-echecs',
    campagne: 'go-chess',
    pied: 'Go for chess players',
    titre: 'Go for chess players | Mochi Go',
    description: 'Do you play chess? What feels familiar in Go, what changes, and where to start. Then your first game of Go, free and with no account.',
    apercu: 'Do you play chess? What feels familiar in Go, what changes, and your first game right away.',
    h1: 'You play chess? Try Go',
    chapo: 'You already know how to calculate a few moves ahead. In Go you keep that habit, with much shorter rules. Here is what feels familiar, what changes, and where to start.',
    avant: [
      {
        id: 'familiar',
        titre: 'What feels like chess',
        html: `<ul class="raisons">
<li><strong>Two players, no luck.</strong> No dice, no hidden cards: everything is on the board.</li>
<li><strong>Calculation.</strong> You read sequences of moves in your head, like a combination.</li>
<li><strong>Known sequences and puzzles.</strong> Joseki are known sequences of moves in a corner. Go puzzles (tsumego) are trained like chess puzzles.</li>
<li><strong>Ranks.</strong> Instead of Elo, Go uses kyu, then dan. Beginners start around 30 kyu: the smaller the number, the stronger you are.</li>
<li><strong>Resigning.</strong> When a game is lost, you resign, as in chess.</li>
</ul>`,
      },
      {
        id: 'changes',
        titre: 'What changes',
        html: `<ul class="raisons">
<li><strong>You place, you don’t move.</strong> On your turn, you place a stone on an empty point. It never moves again.</li>
<li><strong>All stones are equal.</strong> No king, no queen, no knight: no moves to learn.</li>
<li><strong>The board fills up.</strong> In chess it empties as pieces are taken. In Go it fills up, stone by stone.</li>
<li><strong>No checkmate: you count.</strong> You win by surrounding more territory than your opponent. You capture a group by taking away all its liberties, the empty points touching it.</li>
<li><strong>Black plays first.</strong> To make up for it, White gets points, called komi: usually 6.5. The half point avoids ties.</li>
<li><strong>Several fights at once.</strong> You can leave a fight to play elsewhere: that’s tenuki.</li>
<li><strong>You can pass.</strong> When both players pass one after the other, the game stops and you count.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'start',
        titre: 'Where to start',
        html: `<ol class="regles">
<li><strong>Learn to capture.</strong> A group with no liberties is taken. The demo on this page shows you in three challenges.</li>
<li><strong>Play on a small board.</strong> On 9 × 9, a game lasts a few minutes. Then move on to 13 × 13, and to 19 × 19.</li>
<li><strong>Learn to make a group live.</strong> A group with two real eyes can’t be captured. That’s the second big idea of Go.</li>
<li><strong>Play lots of short games.</strong> You’ll lose the first ones: that’s normal. Each game teaches you where to play.</li>
<li><strong>Solve one puzzle a day.</strong> Like chess tactics. In Mochi Go, that’s the Daily Go.</li>
</ol>
<p>Played a little Go before? In the app, “I already know how to play” places you with 3 puzzles.</p>`,
      },
      { id: 'mochi-go', titre: 'What you get in Mochi Go', html: MOCHI_EN },
    ],
    faq: [
      { q: 'Is Go harder than chess?', r: 'The rules are shorter: place, surround, capture. The game is just as deep. AlphaGo only beat champion Lee Sedol in 2016.' },
      { q: 'Is there a checkmate in Go?', r: 'No. In Go you win on points: the territory you surround, plus your prisoners. You can also resign at any time.' },
      { q: 'How long does a game last?', r: 'On a 9 × 9 board, a few minutes. A full game on 19 × 19 takes much longer.' },
      { q: 'Who plays first in Go?', r: 'Black. White gets komi, usually 6.5 points, to make up for it.' },
      GRATUIT_EN,
    ],
  },

  // --- Hikaru no Go (persona 3) -------------------------------------------------------------------------------------
  {
    chemin: 'hikaru-no-go',
    langue: 'fr',
    traduction: 'en/hikaru-no-go',
    campagne: 'hikaru-no-go',
    pied: 'Hikaru no Go',
    titre: 'Hikaru no Go : apprendre à jouer pour de vrai | Mochi Go',
    description: 'Tu as aimé Hikaru no Go ? Le goban, le komi, le nigiri, expliqués simplement. Puis ta première partie de go, gratuite et sans compte.',
    apercu: 'Tu as aimé Hikaru no Go ? Apprends à jouer pour de vrai, en commençant tout de suite.',
    h1: 'Tu as aimé Hikaru no Go ? Joue pour de vrai',
    chapo: 'Hikaru apprend le go avec Sai, un fantôme. Toi, tu as Mochi, un petit chat coach. Les règles tiennent en une minute, et ta première pierre se pose tout de suite.',
    avant: [
      {
        id: 'serie',
        titre: 'La série en bref',
        html: `<p><em>Hikaru no Go</em> est un manga de Yumi Hotta (scénario) et Takeshi Obata (dessin), publié de 1998 à 2003, puis un anime de 75 épisodes. Hikaru, 12 ans, trouve un vieux goban chez son grand-père. Il y vit Sai, l’esprit d’un joueur de go de l’époque Heian, qui veut encore jouer. Les parties de la série ont été supervisées par une joueuse professionnelle, Yukari Umezawa.</p>
<p>Au Japon, la série a donné envie de jouer à beaucoup d’enfants. Bonne nouvelle : les règles sont bien plus simples qu’elles n’en ont l’air à l’écran.</p>`,
      },
      {
        id: 'mots',
        titre: 'Ce que tu vois dans la série, expliqué',
        html: `<ul class="raisons">
<li><strong>Le goban</strong> : le plateau de 19 × 19 lignes. On pose les pierres sur les intersections, pas dans les cases.</li>
<li><strong>Les pierres</strong> : Noir et Blanc posent une pierre chacun leur tour. Noir commence. Une pierre posée ne bouge plus.</li>
<li><strong>Le nigiri</strong> : avant la partie, un joueur prend une poignée de pierres blanches, l’autre devine pair ou impair. C’est ainsi qu’on tire au sort qui joue Noir.</li>
<li><strong>Le komi</strong> : les points donnés à Blanc parce que Noir joue en premier.</li>
<li><strong>L’abandon</strong> : un joueur qui se sait perdu abandonne. Ça arrive souvent dans la série, et chez les pros.</li>
<li><strong>Les grades</strong> : kyu pour les débutants, puis dan. Les professionnels ont leurs propres grades dan.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'commencer',
        titre: 'Pour jouer comme Hikaru, commence petit',
        html: `<ol class="regles">
<li><strong>Apprends la capture.</strong> Un groupe sans liberté est pris. La démo de cette page te le montre en trois défis.</li>
<li><strong>Joue en 9 × 9.</strong> Une partie dure quelques minutes. Le 19 × 19 de la série viendra ensuite.</li>
<li><strong>Apprends à faire vivre un groupe.</strong> Avec deux vrais yeux, un groupe ne peut pas être capturé.</li>
<li><strong>Joue contre un adversaire à ta mesure.</strong> Perdre au début, c’est normal. Hikaru aussi a commencé par perdre.</li>
</ol>`,
      },
      { id: 'mochi-go', titre: 'Ce que tu trouves dans Mochi Go', html: `${MOCHI_FR}\n<p class="mention">Mochi Go n’a aucun lien avec la série, ses auteurs ou ses éditeurs.</p>` },
    ],
    faq: [
      { q: 'Les règles du go sont-elles difficiles ?', r: 'Non. Poser, entourer, capturer : elles tiennent en une minute. Le plus dur est de savoir où jouer, et ça s’apprend en jouant.' },
      { q: 'Peut-on jouer en 19 × 19, comme dans la série ?', r: 'Oui. Commence en 9 × 9 pour apprendre vite, puis passe au 13 × 13 et au 19 × 19.' },
      { q: 'Qu’est-ce que le nigiri ?', r: 'Le tirage au sort du go : un joueur prend une poignée de pierres blanches, l’autre devine pair ou impair pour savoir qui joue Noir.' },
      { q: 'Faut-il avoir vu la série pour jouer ?', r: 'Non. Mochi Go part de zéro : ta première leçon commence par poser une pierre.' },
      GRATUIT_FR,
    ],
  },
  {
    chemin: 'en/hikaru-no-go',
    langue: 'en',
    traduction: 'hikaru-no-go',
    campagne: 'hikaru-no-go-en',
    pied: 'Hikaru no Go',
    titre: 'Hikaru no Go: learn to play Go for real | Mochi Go',
    description: 'Loved Hikaru no Go? The goban, komi and nigiri, explained simply. Then your first game of Go, free and with no account.',
    apercu: 'Loved Hikaru no Go? Learn to play for real, starting right now.',
    h1: 'Loved Hikaru no Go? Play for real',
    chapo: 'Hikaru learns Go with Sai, a ghost. You have Mochi, a little coach cat. The rules fit in a minute, and you place your first stone right away.',
    avant: [
      {
        id: 'series',
        titre: 'The series in short',
        html: `<p><em>Hikaru no Go</em> is a manga by Yumi Hotta (story) and Takeshi Obata (art), published from 1998 to 2003, then a 75-episode anime. Hikaru, aged 12, finds an old goban at his grandfather’s house. Sai lives in it: the spirit of a Go player from the Heian era, who still wants to play. The games in the series were supervised by a professional player, Yukari Umezawa.</p>
<p>In Japan, the series made many children want to play. Good news: the rules are much simpler than they look on screen.</p>`,
      },
      {
        id: 'words',
        titre: 'What you see in the series, explained',
        html: `<ul class="raisons">
<li><strong>The goban</strong>: the board, 19 × 19 lines. Stones go on the points where lines cross, not in the squares.</li>
<li><strong>The stones</strong>: Black and White take turns placing one stone. Black plays first. Once placed, a stone never moves.</li>
<li><strong>Nigiri</strong>: before the game, one player takes a handful of white stones, the other guesses odd or even. That’s how you draw lots for who plays Black.</li>
<li><strong>Komi</strong>: the points given to White because Black plays first.</li>
<li><strong>Resigning</strong>: a player who knows they’ve lost resigns. It happens a lot in the series, and among pros.</li>
<li><strong>Ranks</strong>: kyu for beginners, then dan. Professionals have their own dan ranks.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'start',
        titre: 'To play like Hikaru, start small',
        html: `<ol class="regles">
<li><strong>Learn to capture.</strong> A group with no liberties is taken. The demo on this page shows you in three challenges.</li>
<li><strong>Play on 9 × 9.</strong> A game lasts a few minutes. The 19 × 19 of the series comes later.</li>
<li><strong>Learn to make a group live.</strong> With two real eyes, a group can’t be captured.</li>
<li><strong>Play an opponent at your level.</strong> Losing at first is normal. Hikaru started by losing too.</li>
</ol>`,
      },
      { id: 'mochi-go', titre: 'What you get in Mochi Go', html: `${MOCHI_EN}\n<p class="mention">Mochi Go has no link with the series, its authors or its publishers.</p>` },
    ],
    faq: [
      { q: 'Are the rules of Go hard?', r: 'No. Place, surround, capture: they fit in a minute. The hard part is knowing where to play, and you learn that by playing.' },
      { q: 'Can I play on 19 × 19, like in the series?', r: 'Yes. Start on 9 × 9 to learn fast, then move on to 13 × 13 and 19 × 19.' },
      { q: 'What is nigiri?', r: 'How Go players draw lots: one player takes a handful of white stones, the other guesses odd or even to decide who plays Black.' },
      { q: 'Do I need to have seen the series?', r: 'No. Mochi Go starts from zero: your first lesson starts with placing a stone.' },
      GRATUIT_EN,
    ],
  },

  // --- Parents (persona 4) ------------------------------------------------------------------------------------------
  {
    chemin: 'go-pour-enfants',
    langue: 'fr',
    traduction: 'en/go-for-kids',
    campagne: 'go-enfants',
    pied: 'Le go pour les enfants',
    titre: 'Le go pour les enfants, sans pub ni achat | Mochi Go',
    description: 'Le jeu de go expliqué aux parents : des règles courtes, aucun hasard, sans publicité ni achat, et rien à donner pour commencer.',
    apercu: 'Le go pour les enfants, expliqué aux parents. Sans pub, sans achat, sans compte pour commencer.',
    h1: 'Le go pour les enfants, expliqué aux parents',
    chapo: 'Un jeu de réflexion très ancien, aux règles courtes. Ton enfant pose sa première pierre en quelques secondes, sans publicité et sans achat.',
    avant: [
      {
        id: 'pourquoi',
        titre: 'Pourquoi le go plaît aux enfants',
        html: `<ul class="raisons">
<li><strong>Des règles en une minute.</strong> Poser, entourer, capturer. Toutes les pierres se valent : rien d’autre à retenir.</li>
<li><strong>Aucun hasard.</strong> Pas de dés, pas de cartes : on comprend pourquoi on gagne ou on perd.</li>
<li><strong>Des parties courtes.</strong> Sur un petit plateau de 9 × 9, une partie dure quelques minutes.</li>
<li><strong>On joue ensemble, quel que soit le niveau.</strong> Avec des pierres de handicap posées d’avance, un débutant et un joueur plus fort font une vraie partie. Tu peux apprendre en même temps que lui.</li>
</ul>`,
      },
      {
        id: 'parents',
        titre: 'Ce que tu dois savoir, en tant que parent',
        html: `<ul class="atouts">
<li><strong>Sans publicité, sans achat dans l’app.</strong> Rien à payer pour jouer.</li>
<li><strong>Rien à donner pour commencer.</strong> Ni nom, ni e-mail : les premières leçons, le Go du jour et quelques parties d’essai contre l’ordinateur se jouent sans compte.</li>
<li><strong>Pas de messagerie libre.</strong> En ligne, les joueurs ne s’envoient que des messages tout prêts, comme « Bien joué ! ». Les pseudos choquants sont refusés, et chacun peut signaler ou bloquer un joueur.</li>
<li><strong>Avant 15 ans, le compte se crée avec toi.</strong> Il faut un compte pour jouer en ligne. Avant 15 ans, il se crée avec l’accord d’un parent. On ne demande pas la date de naissance.</li>
<li><strong>Cette page ne mesure rien.</strong> Ni cookie, ni traceur. Dans l’app, la mesure d’audience est anonyme, et tu peux la couper dans Profil, Conditions et confidentialité.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'commencer',
        titre: 'Comment l’aider à commencer',
        html: `<ol class="regles">
<li><strong>Faites la démo ensemble.</strong> Trois petits défis, juste au-dessus : capturer, puis sauver une pierre.</li>
<li><strong>Ouvrez la première leçon.</strong> Mochi, le petit chat coach, explique chaque mot du go quand il arrive. Les leçons ont du texte à lire : un jeune enfant les suivra mieux avec toi.</li>
<li><strong>Jouez sur 9 × 9.</strong> Sa première partie se joue contre Pomme, une adversaire débutante.</li>
<li><strong>Un petit défi par jour.</strong> Le Go du jour est le même pour tout le monde : vous pouvez le chercher ensemble.</li>
</ol>
<p>Pour jouer autour d’un vrai goban, la Fédération française de go recense des clubs partout en France.</p>`,
      },
      { id: 'mochi-go', titre: 'Ce que tu trouves dans Mochi Go', html: MOCHI_FR },
    ],
    faq: [
      { q: 'À partir de quel âge ?', r: 'Dès qu’un enfant aime les jeux de plateau, il peut essayer. Les leçons ont du texte à lire : un jeune enfant les fera mieux avec un parent.' },
      { q: 'Faut-il créer un compte ?', r: 'Pas pour commencer. Un compte sert à jouer en ligne et à garder sa progression. Avant 15 ans, il se crée avec l’accord d’un parent.' },
      { q: 'Mon enfant peut-il parler à des inconnus ?', r: 'Non. En partie en ligne, il n’y a que des messages tout prêts, sans texte libre. Il peut aussi couper les messages de l’adversaire.' },
      { q: 'Quelles données gardez-vous ?', r: 'Tout est expliqué dans <a href="/confidentialite">Conditions et confidentialité</a>. Sans compte, la progression reste sur l’appareil.' },
      GRATUIT_FR,
    ],
  },
  {
    chemin: 'en/go-for-kids',
    langue: 'en',
    traduction: 'go-pour-enfants',
    campagne: 'go-kids',
    pied: 'Go for kids',
    titre: 'Go for kids: no ads, no in-app purchases | Mochi Go',
    description: 'The game of Go explained for parents: short rules, no luck, no ads, no in-app purchases, and nothing to hand over to get started.',
    apercu: 'Go for kids, explained for parents. No ads, no purchases, no account to get started.',
    h1: 'Go for kids, explained for parents',
    chapo: 'A very old thinking game with short rules. Your child places their first stone in seconds, with no ads and no purchases.',
    avant: [
      {
        id: 'why',
        titre: 'Why kids enjoy Go',
        html: `<ul class="raisons">
<li><strong>Rules in a minute.</strong> Place, surround, capture. All stones are equal: nothing else to remember.</li>
<li><strong>No luck.</strong> No dice, no cards: you understand why you win or lose.</li>
<li><strong>Short games.</strong> On a small 9 × 9 board, a game lasts a few minutes.</li>
<li><strong>Play together at any level.</strong> With handicap stones placed in advance, a beginner and a stronger player can have a real game. You can learn alongside your child.</li>
</ul>`,
      },
      {
        id: 'parents',
        titre: 'What you should know as a parent',
        html: `<ul class="atouts">
<li><strong>No ads, no in-app purchases.</strong> Nothing to pay to play.</li>
<li><strong>Nothing to hand over to start.</strong> No name, no email: the first lessons, the Daily Go and a few trial games against the computer work without an account.</li>
<li><strong>No free-text chat.</strong> Online, players can only send ready-made messages, like “Well played!”. Offensive nicknames are refused, and anyone can report or block a player.</li>
<li><strong>Under 15, the account is created with you.</strong> Playing online needs an account. Under 15, it is created with a parent’s agreement. We don’t ask for a date of birth.</li>
<li><strong>This page measures nothing.</strong> No cookies, no trackers. In the app, audience measurement is anonymous, and you can turn it off in Profile, Terms and privacy.</li>
</ul>`,
      },
    ],
    apres: [
      {
        id: 'start',
        titre: 'How to help them start',
        html: `<ol class="regles">
<li><strong>Try the demo together.</strong> Three tiny challenges, just above: capture, then save a stone.</li>
<li><strong>Open the first lesson.</strong> Mochi, the little coach cat, explains every Go word when it first comes up. Lessons have text to read: a young child will follow them better with you.</li>
<li><strong>Play on 9 × 9.</strong> Their first game is against Pomme, a beginner opponent.</li>
<li><strong>One small challenge a day.</strong> The Daily Go is the same for everyone: you can solve it together.</li>
</ol>
<p>To play on a real board, look for a Go club near you: many countries have a national Go association.</p>`,
      },
      { id: 'mochi-go', titre: 'What you get in Mochi Go', html: MOCHI_EN },
    ],
    faq: [
      { q: 'From what age?', r: 'As soon as a child enjoys board games, they can try. Lessons have text to read: a young child will do better with a parent.' },
      { q: 'Do we need an account?', r: 'Not to start. An account is for playing online and keeping progress. Under 15, it is created with a parent’s agreement.' },
      { q: 'Can my child talk to strangers?', r: 'No. In online games there are only ready-made messages, no free text. They can also turn off the opponent’s messages.' },
      { q: 'What data do you keep?', r: 'Everything is explained in <a href="/confidentialite?lang=en">Terms and privacy</a>. Without an account, progress stays on the device.' },
      GRATUIT_EN,
    ],
  },

  // --- Vocabulaire (tous publics, SEO « atari, ko, komi ») ----------------------------------------------------------
  {
    chemin: 'vocabulaire-du-go',
    langue: 'fr',
    traduction: 'en/go-terms',
    campagne: 'vocabulaire',
    pied: 'Vocabulaire du go',
    titre: 'Vocabulaire du go : atari, ko, komi, seki… | Mochi Go',
    description: 'Les mots du jeu de go en phrases simples : liberté, atari, ko, komi, seki, sente et gote, tenuki, joseki… Et une capture à essayer tout de suite.',
    apercu: 'Atari, ko, komi, seki, sente… Les mots du go en phrases simples.',
    h1: 'Le vocabulaire du go, en mots simples',
    chapo: 'Atari, ko, komi, seki, sente… Les mots du go viennent surtout du japonais. Voici leur sens, en une ou deux phrases chacun.',
    avant: [
      { id: 'bases', titre: 'Les mots des règles', html: `${glossaire('fr', MOTS_VOCABULAIRE.bases, GOBAN.fr)}\n{schema:ko}` },
    ],
    apres: [
      { id: 'vie', titre: 'Vie et mort des groupes', html: glossaire('fr', MOTS_VOCABULAIRE.vie) },
      { id: 'jeu', titre: 'Les mots du jeu', html: glossaire('fr', MOTS_VOCABULAIRE.jeu) },
    ],
    faq: [
      question('fr', 'Que veut dire atari ?', 'atari'),
      question('fr', 'Qu’est-ce que le ko ?', 'ko'),
      question('fr', 'Qu’est-ce que le komi ?', 'komi'),
      question('fr', 'Que veulent dire sente et gote ?', 'senteGote'),
      question('fr', 'Qu’est-ce qu’un seki ?', 'seki'),
    ],
  },
  {
    chemin: 'en/go-terms',
    langue: 'en',
    traduction: 'vocabulaire-du-go',
    campagne: 'go-terms',
    pied: 'Go terms',
    titre: 'Go terms: atari, ko, komi, seki… | Mochi Go',
    description: 'The words of the game of Go in plain English: liberty, atari, ko, komi, seki, sente and gote, tenuki, joseki… And a capture to try right now.',
    apercu: 'Atari, ko, komi, seki, sente… The words of Go in plain English.',
    h1: 'Go terms, in plain words',
    chapo: 'Atari, ko, komi, seki, sente… Most Go words come from Japanese. Here is what they mean, in one or two sentences each.',
    avant: [
      { id: 'basics', titre: 'Words of the rules', html: `${glossaire('en', MOTS_VOCABULAIRE.bases, GOBAN.en)}\n{schema:ko}` },
    ],
    apres: [
      { id: 'life', titre: 'Life and death of groups', html: glossaire('en', MOTS_VOCABULAIRE.vie) },
      { id: 'play', titre: 'Words of play', html: glossaire('en', MOTS_VOCABULAIRE.jeu) },
    ],
    faq: [
      question('en', 'What does atari mean?', 'atari'),
      question('en', 'What is ko?', 'ko'),
      question('en', 'What is komi?', 'komi'),
      question('en', 'What do sente and gote mean?', 'senteGote'),
      question('en', 'What is seki?', 'seki'),
    ],
  },
];
