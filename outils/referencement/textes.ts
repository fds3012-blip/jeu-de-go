// Textes des pages de référencement (#472). Mêmes faits que les fiches stores (docs/marketing/fiches-stores.md) :
// aucun chiffre qui ne soit compté dans le dépôt (`{lecons}` : nombre de leçons de src/content/leconsIndex.gen.ts ;
// « plus de 100 problèmes » : vérifié par pages.test.ts sur ALL_PUZZLES), pas de « toujours gratuit » (Premium à l'étude),
// pas de store tant que l'app n'y est pas, pas d'avis ni de nombre de joueurs. Tutoiement, phrases courtes, mots du go
// expliqués la première fois (CLAUDE.md, règle 5). Anglais : glossaire docs/localisation/glossaire.md (« Go » en majuscule).
//
// Les champs `html` sont du HTML écrit ici (liens, gras) ; tout le reste est du texte, échappé par pages.ts.

export type Langue = 'fr' | 'en';

export interface Section {
  id: string;
  titre: string;
  /** Contenu HTML de la section. `{schema:nom}` insère un schéma (pages.ts, SCHEMAS). */
  html: string;
}

export interface Question {
  q: string;
  /** Réponse en HTML simple (liens permis) ; le texte brut va dans les données structurées FAQPage. */
  r: string;
}

export interface Page {
  /** Chemin sans barre initiale ni finale : `apprendre-le-go`, `en/learn-go`. */
  chemin: string;
  langue: Langue;
  /** Même page dans l'autre langue (hreflang). */
  traduction: string;
  /** Nom de la campagne dans le lien « Jouer maintenant » (utm_campaign, lu par PostHog dans l'app). */
  campagne: string;
  titre: string;
  /** Description pour les moteurs (100 à 160 caractères). */
  description: string;
  /** Description de l'aperçu du lien partagé (og:description, 110 caractères au plus : WhatsApp coupe au-delà, #489). */
  apercu: string;
  h1: string;
  chapo: string;
  /** Sections avant la démo, puis après. */
  avant: Section[];
  apres: Section[];
  faq: Question[];
}

/** Textes communs à toutes les pages d'une langue. */
export interface Commun {
  cta: string;
  mention: string;
  sauter: string;
  autreLangue: string;
  accueil: string;
  demoTitre: string;
  demoIntro: string;
  /** Version sans JS : la position du premier défi et sa solution. */
  demoSansJs: string;
  faqTitre: string;
  finTitre: string;
  piedRegles: string;
  piedApprendre: string;
  confidentialite: string;
  credits: string;
  imageAlt: string;
  /** Textes de la démo interactive (outils/referencement/demo.js). */
  demo: {
    defis: { titre: string; consigne: string; bravo: string }[];
    echappe: string;
    prise: string;
    rate: string;
    occupe: string;
    suicide: string;
    joue: string;
    etape: string;
    reessayer: string;
    suivant: string;
    recommencer: string;
    fin: string;
    vide: string;
    noire: string;
    blanche: string;
    goban: string;
  };
}

export const COMMUN: Record<Langue, Commun> = {
  fr: {
    cta: 'Jouer maintenant',
    mention: 'Gratuit, sans publicité. Sans compte : ta première partie commence tout de suite.',
    sauter: 'Aller au contenu',
    autreLangue: 'English',
    accueil: 'Mochi Go, accueil',
    demoTitre: 'Essaie : capture une pierre',
    demoIntro: 'Trois petits défis pour saisir l’idée du go. Tu joues Noir : touche un point du plateau pour poser ta pierre.',
    demoSansJs: 'La pierre blanche en E5 n’a plus qu’une liberté : le point E4, entouré en pointillé. Si Noir joue en E4, elle n’a plus aucune liberté. Elle est capturée et quitte le plateau.',
    faqTitre: 'Questions fréquentes',
    finTitre: 'Prêt à poser ta première pierre ?',
    piedRegles: 'Les règles du go',
    piedApprendre: 'Apprendre le go',
    confidentialite: 'Confidentialité',
    credits: 'Les adversaires les plus forts sont joués par KataGo, une IA de go open source. Moteur adapté de web-katrain (licence MIT).',
    imageAlt: 'Mochi, le petit chat coach, à côté d’un goban : apprends le go en jouant, débutants bienvenus.',
    demo: {
      defis: [
        { titre: 'Capture la pierre blanche', consigne: 'Les points vides à côté d’une pierre sont ses libertés. La pierre blanche n’en a plus qu’une : joue dessus.', bravo: 'Capturée ! Une pierre sans liberté quitte le plateau.' },
        { titre: 'Capture les deux pierres', consigne: 'Ces deux pierres blanches se touchent : elles forment un groupe et partagent leurs libertés. Il leur en reste une.', bravo: 'Deux d’un coup ! Un groupe sans liberté est capturé en entier.' },
        { titre: 'Sauve ta pierre', consigne: 'Ta pierre noire est en atari : il ne lui reste qu’une liberté. Allonge-la pour lui en donner plus.', bravo: 'Sauvée ! Ton groupe a maintenant {n} libertés.' },
      ],
      echappe: 'Blanc s’échappe en {p} : son groupe a maintenant {n} libertés. Réessaie.',
      prise: 'Blanc joue en {p} et capture ta pierre. Réessaie.',
      rate: 'Pas encore. Réessaie.',
      occupe: 'Ce point est déjà pris. Choisis un point vide.',
      suicide: 'Coup interdit : ta pierre n’aurait aucune liberté.',
      joue: 'Noir joue en {p}.',
      etape: 'Défi {i} sur {n}',
      reessayer: 'Réessayer',
      suivant: 'Défi suivant',
      recommencer: 'Recommencer',
      fin: 'Bravo ! Tu connais déjà les libertés, l’atari et la capture : le cœur du go.',
      vide: 'vide',
      noire: 'pierre noire',
      blanche: 'pierre blanche',
      goban: 'Goban 9 × 9. Flèches pour te déplacer, Entrée pour jouer.',
    },
  },
  en: {
    cta: 'Play now',
    mention: 'Free, no ads. No account: your first game starts right away.',
    sauter: 'Skip to content',
    autreLangue: 'Français',
    accueil: 'Mochi Go, home',
    demoTitre: 'Try it: capture a stone',
    demoIntro: 'Three tiny challenges to get the idea of Go. You play Black: tap a point on the board to place your stone.',
    demoSansJs: 'The white stone on E5 has only one liberty left: the point E4, circled with a dashed line. If Black plays E4, it has no liberty at all. It is captured and leaves the board.',
    faqTitre: 'Frequently asked questions',
    finTitre: 'Ready to place your first stone?',
    piedRegles: 'Go rules',
    piedApprendre: 'Learn Go',
    confidentialite: 'Privacy',
    credits: 'The strongest opponents are played by KataGo, an open-source Go AI. Engine adapted from web-katrain (MIT license).',
    imageAlt: 'Mochi, the little coach cat, next to a go board: learn Go by playing, beginners welcome.',
    demo: {
      defis: [
        { titre: 'Capture the white stone', consigne: 'The empty points next to a stone are its liberties. The white stone has only one left: play on it.', bravo: 'Captured! A stone with no liberties leaves the board.' },
        { titre: 'Capture both stones', consigne: 'These two white stones touch: they form a group and share their liberties. Only one is left.', bravo: 'Two at once! A group with no liberties is captured as a whole.' },
        { titre: 'Save your stone', consigne: 'Your black stone is in atari: it has only one liberty left. Extend it to give it more.', bravo: 'Saved! Your group now has {n} liberties.' },
      ],
      echappe: 'White escapes on {p}: the group now has {n} liberties. Try again.',
      prise: 'White plays {p} and captures your stone. Try again.',
      rate: 'Not yet. Try again.',
      occupe: 'This point is taken. Pick an empty one.',
      suicide: 'Not allowed: your stone would have no liberties.',
      joue: 'Black plays {p}.',
      etape: 'Challenge {i} of {n}',
      reessayer: 'Try again',
      suivant: 'Next challenge',
      recommencer: 'Start over',
      fin: 'Well done! You already know liberties, atari and capture: the heart of Go.',
      vide: 'empty',
      noire: 'black stone',
      blanche: 'white stone',
      goban: '9 × 9 board. Arrow keys to move, Enter to play.',
    },
  },
};

const REGLES_COURTES_FR = `<ol class="regles">
<li><strong>Noir et Blanc posent une pierre chacun leur tour</strong> sur une intersection du plateau, le goban. Noir commence. Une pierre posée ne bouge plus.</li>
<li><strong>Les points vides voisins d’une pierre sont ses libertés</strong> (en haut, en bas, à gauche, à droite). Des pierres de même couleur qui se touchent forment un groupe et partagent leurs libertés.</li>
<li><strong>Un groupe sans liberté est capturé</strong> : on le retire du plateau. Avec une seule liberté, il est en atari. Tu ne peux pas jouer là où ta pierre n’aurait aucune liberté, sauf si elle capture.</li>
<li><strong>Le ko : pas de reprise immédiate.</strong> Si une pierre vient d’en prendre une seule, l’autre joueur ne peut pas la reprendre tout de suite : il joue d’abord ailleurs.</li>
<li><strong>Quand les deux joueurs passent, on compte.</strong> Chacun a son territoire (les points vides qu’il entoure) plus ses prisonniers. Blanc reçoit le komi, souvent 6,5 points, parce que Noir a commencé. Le plus grand total gagne.</li>
</ol>`;

const REGLES_COURTES_EN = `<ol class="regles">
<li><strong>Black and White take turns placing one stone</strong> on a point of the board. Black plays first. Once placed, a stone never moves.</li>
<li><strong>The empty points next to a stone are its liberties</strong> (up, down, left, right). Stones of the same color that touch form a group and share their liberties.</li>
<li><strong>A group with no liberties is captured</strong> and removed from the board. With only one liberty left, it is in atari. You can’t play where your stone would have no liberties, unless it captures.</li>
<li><strong>Ko: no immediate recapture.</strong> If a stone has just captured a single stone, the other player can’t take it back right away: they must play elsewhere first.</li>
<li><strong>When both players pass, you count.</strong> Each player scores their territory (the empty points they surround) plus their prisoners. White gets komi, usually 6.5 points, because Black played first. The higher total wins.</li>
</ol>`;

export const PAGES: readonly Page[] = [
  {
    chemin: 'apprendre-le-go',
    langue: 'fr',
    traduction: 'en/learn-go',
    campagne: 'apprendre-le-go',
    titre: 'Apprendre le go gratuitement, en jouant | Mochi Go',
    description: 'Apprends le jeu de go en jouant : les règles en 5 points, une capture à essayer tout de suite, puis {lecons} leçons et plus de 100 problèmes. Gratuit.',
    apercu: 'Débutants bienvenus : les règles en 5 points, {lecons} leçons, plus de 100 problèmes. Gratuit, sans pub.',
    h1: 'Apprends le go en jouant, gratuitement',
    chapo: 'Le go se joue depuis plus de 2 500 ans, et ses règles tiennent en une minute. Essaie ci-dessous, puis continue avec Mochi : {lecons} leçons où tu poses ta pierre dès le premier écran.',
    avant: [],
    apres: [
      {
        id: 'regles',
        titre: 'Les règles du go en 5 points',
        html: `${REGLES_COURTES_FR}\n<p><a href="/regles-du-go">Toutes les règles, avec des schémas</a></p>`,
      },
      {
        id: 'pourquoi',
        titre: 'Pourquoi apprendre le go ?',
        html: `<ul class="raisons">
<li><strong>Des règles simples, un jeu sans fond.</strong> Toutes les pierres se valent : pas de pièces à apprendre. Pourtant, on y découvre des idées nouvelles toute sa vie.</li>
<li><strong>Aucun hasard.</strong> Pas de dés, pas de cartes cachées : tout est sur le plateau.</li>
<li><strong>On joue ensemble, quel que soit le niveau.</strong> Avec des pierres de handicap posées d’avance, un débutant et un joueur fort font une vraie partie.</li>
<li><strong>Un jeu d’histoire.</strong> Né en Chine il y a plus de 2 500 ans, joué au Japon et en Corée depuis des siècles, il a longtemps résisté à l’intelligence artificielle : AlphaGo n’a battu le champion Lee Sedol qu’en 2016.</li>
<li><strong>Tu joues aux échecs ?</strong> Tu retrouveras la lecture et la stratégie, dans une partie qui se construit pierre après pierre au lieu de se vider.</li>
</ul>`,
      },
      {
        id: 'mochi-go',
        titre: 'Ce que tu trouves dans Mochi Go',
        html: `<ul class="atouts">
<li><strong>{lecons} leçons avec Mochi.</strong> Tu poses ta pierre dès le premier écran. Chaque mot du go (atari, ko, komi) est expliqué quand il arrive.</li>
<li><strong>Plus de 100 problèmes</strong>, dont chaque solution est vérifiée contre toutes les défenses, et un Go du jour : le même défi pour tout le monde.</li>
<li><strong>9 adversaires illustrés</strong>, de Pomme (20 kyu, débutante) à Sensei (1 dan, joueur confirmé). Pour tes 3 premières parties, le komi passe à 0,5 point : ta première victoire est possible.</li>
<li><strong>Une IA de go sur ton appareil.</strong> Les adversaires forts sont joués par KataGo, une IA open source. Une fois téléchargée, elle marche même hors ligne.</li>
<li><strong>Une revue honnête.</strong> À la fin, elle va droit au coup qui t’a coûté le plus, et tu le rejoues.</li>
<li><strong>Pour tout le monde.</strong> Jouable au clavier et avec un lecteur d’écran, en mode sombre ou clair.</li>
</ul>`,
      },
    ],
    faq: [
      { q: 'C’est quoi le go ?', r: 'Un jeu de stratégie né en Chine il y a plus de 2 500 ans. Deux joueurs posent à tour de rôle des pierres noires et blanches sur un plateau, le goban, pour entourer le plus de territoire. Les règles tiennent en une minute, mais on peut y jouer toute sa vie.' },
      { q: 'Le go est-il difficile à apprendre ?', r: 'Les règles sont simples : poser, entourer, capturer. Le plus dur est de savoir où jouer, et ça s’apprend en jouant. Avec Mochi Go, ta première partie se joue sur un petit plateau 9 × 9, contre Pomme, qui débute aussi.' },
      { q: 'Mochi Go est-il gratuit ?', r: 'Oui. Leçons, problèmes, Go du jour et parties contre les adversaires sont gratuits, sans publicité.' },
      { q: 'Faut-il créer un compte ?', r: 'Non. Tu joues tout de suite. Un compte sert seulement à retrouver ta progression sur un autre appareil.' },
      { q: 'Sur quel appareil jouer ?', r: 'Dans le navigateur de ton téléphone, de ta tablette ou de ton ordinateur. Tu peux aussi l’installer sur ton écran d’accueil, comme une app.' },
    ],
  },
  {
    chemin: 'regles-du-go',
    langue: 'fr',
    traduction: 'en/go-rules',
    campagne: 'regles-du-go',
    titre: 'Règles du go : le jeu expliqué simplement | Mochi Go',
    description: 'Les règles du jeu de go en 5 points, avec des schémas : libertés, capture, atari, ko, fin de partie et comptage. Et une capture à essayer tout de suite.',
    apercu: 'Les règles du go en 5 points, avec des schémas. Et une capture à essayer tout de suite.',
    h1: 'Les règles du go, simplement',
    chapo: 'Deux joueurs, un plateau, des pierres noires et blanches. Voici tout ce qu’il faut savoir pour jouer ta première partie, en 5 points.',
    avant: [
      {
        id: 'tour',
        titre: '1. Poser une pierre, chacun son tour',
        html: `<p>Le go se joue sur un plateau quadrillé, le goban : 19 × 19 lignes pour une partie complète, 9 × 9 ou 13 × 13 pour débuter. Noir commence, puis Noir et Blanc posent <strong>une pierre chacun leur tour</strong>, sur une intersection libre. Une pierre posée ne bouge plus. Au lieu de jouer, tu peux aussi passer.</p>`,
      },
      {
        id: 'libertes',
        titre: '2. Les libertés',
        html: `<p>Les <strong>libertés</strong> d’une pierre sont les intersections vides juste à côté d’elle : en haut, en bas, à gauche, à droite (pas en diagonale). Au milieu du plateau, une pierre seule en a 4 ; au bord, 3 ; dans le coin, 2.</p>
{schema:libertes}
<p>Des pierres de même couleur qui se touchent forment un <strong>groupe</strong>. Elles partagent leurs libertés : elles vivent et meurent ensemble.</p>`,
      },
    ],
    apres: [
      {
        id: 'capture',
        titre: '3. La capture et l’atari',
        html: `<p>Quand un groupe n’a plus aucune liberté, il est <strong>capturé</strong> : on retire ses pierres du plateau, et elles deviennent des prisonniers. Quand il ne lui reste qu’une liberté, il est <strong>en atari</strong> : il faut le sauver ou accepter de le perdre.</p>
<p>Tu ne peux pas poser une pierre là où elle n’aurait aucune liberté (c’est le suicide), sauf si ce coup capture des pierres adverses : elles partent d’abord, et ta pierre retrouve des libertés.</p>`,
      },
      {
        id: 'ko',
        titre: '4. Le ko',
        html: `<p>Parfois, une pierre en prend une seule, et pourrait être reprise aussitôt par le même coup en sens inverse. Sans règle, les deux joueurs tourneraient en rond. Le <strong>ko</strong> l’interdit : après une telle prise, l’autre joueur doit d’abord jouer ailleurs. Au tour suivant, il pourra reprendre.</p>
{schema:ko}`,
      },
      {
        id: 'fin',
        titre: '5. La fin de partie et le comptage',
        html: `<p>Quand il n’y a plus rien d’utile à jouer, chacun passe. <strong>Deux passes de suite</strong> terminent la partie. On retire les pierres mortes (celles qui ne peuvent plus échapper à la capture), puis on compte :</p>
<ul>
<li>ton <strong>territoire</strong> : les intersections vides entourées par tes seules pierres ;</li>
<li>plus tes <strong>prisonniers</strong> : les pierres que tu as capturées.</li>
</ul>
<p>Blanc reçoit le <strong>komi</strong>, souvent 6,5 points, parce que Noir a joué en premier ; le demi-point évite les égalités. Le plus grand total gagne. C’est la règle japonaise, celle de Mochi Go. La règle chinoise compte le territoire plus les pierres sur le plateau, avec un komi de 7,5 : le vainqueur est presque toujours le même.</p>`,
      },
    ],
    faq: [
      { q: 'Qu’est-ce que l’atari ?', r: 'Un groupe est en atari quand il ne lui reste qu’une seule liberté. Au coup suivant, l’adversaire peut le capturer en jouant sur cette dernière liberté.' },
      { q: 'Qu’est-ce que le komi ?', r: 'Les points donnés à Blanc parce que Noir commence, souvent 6,5 en règle japonaise et 7,5 en règle chinoise. Le demi-point évite les égalités.' },
      { q: 'Peut-on jouer n’importe où ?', r: 'Sur toute intersection vide, sauf deux exceptions : un coup où ta pierre n’aurait aucune liberté (sauf s’il capture), et la reprise immédiate d’un ko.' },
      { q: 'Comment se termine une partie de go ?', r: 'Quand les deux joueurs passent l’un après l’autre. On retire les pierres mortes, puis chacun compte son territoire et ses prisonniers. On peut aussi abandonner à tout moment.' },
      { q: 'Quelle taille de plateau pour débuter ?', r: 'Le 9 × 9 : une partie y dure quelques minutes et on voit vite l’effet de chaque coup. On passe ensuite au 13 × 13, puis au 19 × 19 de la partie complète.' },
    ],
  },
  {
    chemin: 'en/learn-go',
    langue: 'en',
    traduction: 'apprendre-le-go',
    campagne: 'learn-go',
    titre: 'Learn Go for free, by playing | Mochi Go',
    description: 'Learn the game of Go by playing: the rules in 5 points, a capture to try right now, then {lecons} lessons and over 100 puzzles. Free, no ads.',
    apercu: 'Beginners welcome: the rules in 5 points, {lecons} lessons, over 100 puzzles. Free, no ads.',
    h1: 'Learn Go by playing, for free',
    chapo: 'Go has been played for more than 2,500 years, and its rules fit in a minute. Try it below, then carry on with Mochi: {lecons} lessons where you place your stone from the very first screen.',
    avant: [],
    apres: [
      {
        id: 'rules',
        titre: 'The rules of Go in 5 points',
        html: `${REGLES_COURTES_EN}\n<p><a href="/en/go-rules">All the rules, with diagrams</a></p>`,
      },
      {
        id: 'why',
        titre: 'Why learn Go?',
        html: `<ul class="raisons">
<li><strong>Simple rules, endless depth.</strong> Every stone is the same: no pieces to learn. Yet you keep finding new ideas for a lifetime.</li>
<li><strong>No luck.</strong> No dice, no hidden cards: everything is on the board.</li>
<li><strong>Play together at any level.</strong> With handicap stones placed in advance, a beginner and a strong player can have a real game.</li>
<li><strong>A game with history.</strong> Born in China more than 2,500 years ago and played in Japan and Korea for centuries, it long resisted artificial intelligence: AlphaGo only beat champion Lee Sedol in 2016.</li>
<li><strong>Do you play chess?</strong> You’ll find reading and strategy again, in a game that builds up stone by stone instead of emptying out.</li>
</ul>`,
      },
      {
        id: 'mochi-go',
        titre: 'What you get in Mochi Go',
        html: `<ul class="atouts">
<li><strong>{lecons} lessons with Mochi.</strong> You place your stone from the very first screen. Every Go word (atari, ko, komi) is explained when it first comes up.</li>
<li><strong>Over 100 puzzles</strong>, each solution checked against every defense, and a Daily Go: the same challenge for everyone.</li>
<li><strong>9 illustrated opponents</strong>, from Pomme (20 kyu, a beginner) to Sensei (1 dan, a strong amateur). For your first 3 games, komi drops to 0.5: your first win is within reach.</li>
<li><strong>A Go AI on your device.</strong> The strong opponents are played by KataGo, an open-source AI. Once downloaded, it even works offline.</li>
<li><strong>An honest review.</strong> After the game, it goes straight to the move that cost you the most, and you replay it.</li>
<li><strong>For everyone.</strong> Playable with a keyboard and a screen reader, in dark or light mode.</li>
</ul>`,
      },
    ],
    faq: [
      { q: 'What is Go?', r: 'A strategy game born in China more than 2,500 years ago. Two players take turns placing black and white stones on a board to surround the most territory. The rules fit in a minute, but you can play it all your life.' },
      { q: 'Is Go hard to learn?', r: 'The rules are simple: place, surround, capture. The hard part is knowing where to play, and you learn that by playing. In Mochi Go, your first game is on a small 9 × 9 board, against Pomme, who is a beginner too.' },
      { q: 'Is Mochi Go free?', r: 'Yes. Lessons, puzzles, the Daily Go and games against the opponents are free, with no ads.' },
      { q: 'Do I need an account?', r: 'No. You can play right away. An account only lets you keep your progress on another device.' },
      { q: 'Which devices can I play on?', r: 'In the browser of your phone, tablet or computer. You can also add it to your home screen, like an app.' },
    ],
  },
  {
    chemin: 'en/go-rules',
    langue: 'en',
    traduction: 'regles-du-go',
    campagne: 'go-rules',
    titre: 'Go rules: the game explained simply | Mochi Go',
    description: 'The rules of Go in 5 points, with diagrams: liberties, capture, atari, ko, the end of the game and scoring. And a capture to try right now.',
    apercu: 'The rules of Go in 5 points, with diagrams. And a capture to try right now.',
    h1: 'The rules of Go, simply',
    chapo: 'Two players, a board, black and white stones. Here is everything you need to play your first game, in 5 points.',
    avant: [
      {
        id: 'turns',
        titre: '1. Place a stone, one at a time',
        html: `<p>Go is played on a grid board: 19 × 19 lines for a full game, 9 × 9 or 13 × 13 to start. Black plays first, then Black and White take turns placing <strong>one stone</strong> on an empty point. Once placed, a stone never moves. Instead of playing, you may also pass.</p>`,
      },
      {
        id: 'liberties',
        titre: '2. Liberties',
        html: `<p>A stone’s <strong>liberties</strong> are the empty points right next to it: up, down, left, right (not diagonally). In the middle of the board, a lone stone has 4; on the edge, 3; in the corner, 2.</p>
{schema:libertes}
<p>Stones of the same color that touch form a <strong>group</strong>. They share their liberties: they live and die together.</p>`,
      },
    ],
    apres: [
      {
        id: 'capture',
        titre: '3. Capture and atari',
        html: `<p>When a group has no liberties left, it is <strong>captured</strong>: its stones are removed from the board and become prisoners. When it has only one liberty left, it is <strong>in atari</strong>: save it, or accept losing it.</p>
<p>You can’t place a stone where it would have no liberties (that’s suicide), unless the move captures enemy stones: they are removed first, and your stone gets liberties back.</p>`,
      },
      {
        id: 'ko',
        titre: '4. Ko',
        html: `<p>Sometimes a stone captures a single stone and could be taken back at once by the same move the other way round. Without a rule, both players would go round in circles. <strong>Ko</strong> forbids it: after such a capture, the other player must play elsewhere first. On the next turn, they may take back.</p>
{schema:ko}`,
      },
      {
        id: 'end',
        titre: '5. End of the game and scoring',
        html: `<p>When there is nothing useful left to play, each player passes. <strong>Two passes in a row</strong> end the game. Dead stones (those that can no longer escape capture) are removed, then you count:</p>
<ul>
<li>your <strong>territory</strong>: the empty points surrounded only by your stones;</li>
<li>plus your <strong>prisoners</strong>: the stones you captured.</li>
</ul>
<p>White gets <strong>komi</strong>, usually 6.5 points, because Black played first; the half point avoids ties. The higher total wins. These are Japanese rules, the ones Mochi Go uses. Chinese rules count territory plus stones on the board, with 7.5 komi: the winner is almost always the same.</p>`,
      },
    ],
    faq: [
      { q: 'What is atari?', r: 'A group is in atari when it has only one liberty left. On the next move, the opponent can capture it by playing on that last liberty.' },
      { q: 'What is komi?', r: 'The points given to White because Black plays first, usually 6.5 under Japanese rules and 7.5 under Chinese rules. The half point avoids ties.' },
      { q: 'Can I play anywhere?', r: 'On any empty point, with two exceptions: a move where your stone would have no liberties (unless it captures), and immediately retaking a ko.' },
      { q: 'How does a game of Go end?', r: 'When both players pass one after the other. Dead stones are removed, then each player counts their territory and prisoners. You can also resign at any time.' },
      { q: 'What board size should beginners use?', r: '9 × 9: a game lasts a few minutes and you quickly see the effect of each move. Then move on to 13 × 13, and to the 19 × 19 of a full game.' },
    ],
  },
];

/** Légendes des schémas (pages.ts, SCHEMAS). */
export const LEGENDES: Record<Langue, Record<'libertes' | 'ko', string>> = {
  fr: {
    libertes: 'La pierre noire en E5 a 4 libertés, entourées en pointillé : D5, F5, E6 et E4.',
    ko: 'Noir vient de jouer en F5 et de prendre la pierre blanche en E5. Blanc ne peut pas rejouer en E5 tout de suite (point entouré) : c’est le ko.',
  },
  en: {
    libertes: 'The black stone on E5 has 4 liberties, circled with a dashed line: D5, F5, E6 and E4.',
    ko: 'Black has just played F5 and captured the white stone on E5. White can’t play E5 again right away (circled point): that’s ko.',
  },
};
