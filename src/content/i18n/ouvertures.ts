// Textes du répertoire d'ouvertures (#591), FR et EN. Hors du catalogue principal : ils n'arrivent qu'avec l'écran
// « Ouvertures » (chargé à la demande). Règles : phrases courtes, tutoiement, mot japonais expliqué la première fois
// dans chaque entrée. Les entrées elles-mêmes (SGF, erreurs) : src/content/ouvertures.ts.
//
// Clés d'une entrée : `o.<id>.nom`, `o.<id>.idee`, `o.<id>.c<n>` (le n-ième coup, à partir de 1), `o.<id>.e<n>` (la
// n-ième erreur courante). Une réplique citée « en D4 » est celle de KataGo, dans chaque symétrie
// (src/go/ouvertures.test.ts).
import { langue, type Langue } from './index';

const FR = {
  // Liste
  'titre': 'Ouvertures',
  'intro': 'Fuseki (début de partie) et joseki (suites de coups dans un coin). Choisis une ouverture.',
  'taille.9': '9 × 9',
  'taille.19': '19 × 19',
  'tailles': 'Taille du plateau',
  'preuve': 'Chaque coup de la séquence est vérifié par KataGo : il perd 1,5 point au plus face au meilleur coup.',
  'retourApprendre': 'Retour à Apprendre',
  'retourListe': 'Retour aux ouvertures',
  'coups': '{n} coups',
  'coups.un': '1 coup',
  // Lecteur
  'depart': 'Touche « Suivant » pour voir le premier coup.',
  'precedent': 'Précédent',
  'suivant': 'Suivant',
  'progression': 'Coup {n} sur {total}',
  'voirErreur': 'Voir l’erreur courante',
  'autreErreur': 'Autre erreur',
  'retourSequence': 'Revenir à la séquence',
  'perte': 'Ce coup coûte environ {pts} points.',
  'erreurTitre': 'Erreur courante',
  'ailleurs': 'Le coin est réglé : {camp} peut jouer ailleurs.',
  'fin': 'Fin de la séquence. Rejoue-la pour la retenir.',
  'recommencer': 'Recommencer',
  'noir': 'Noir',
  'blanc': 'Blanc',
  'joue': '{camp} joue en {point}.',

  // 9 × 9 : le centre
  'o.n9-centre.nom': 'Le centre d’abord',
  'o.n9-centre.idee': 'En 9 × 9, le tengen (le point central) regarde les quatre coins à la fois.',
  'o.n9-centre.c1': 'Noir joue au tengen, le point central. De là, il regarde tous les coins.',
  'o.n9-centre.c2': 'Blanc s’installe à gauche, sur la 3e ligne.',
  'o.n9-centre.c3': 'Noir descend en diagonale, entre Blanc et le bas.',
  'o.n9-centre.c4': 'Blanc s’allonge vers le bas, le long du bord.',
  'o.n9-centre.c5': 'Noir bloque le haut : Blanc reste près du bord gauche.',
  'o.n9-centre.e1': 'B2, tout près du coin : ta pierre entoure très peu.',
  'o.n9-centre.e2': 'C3, trop bas : Blanc répond en D4 et te coupe du centre.',
  'o.n9-centre.e3': 'C6, collée à Blanc : il répond en D6 et sort par le haut.',

  // 9 × 9 : le 4-4
  'o.n9-coin.nom': 'Les quatre coins en 9 × 9',
  'o.n9-coin.idee': 'Le 4-4 : 4e ligne depuis deux bords (en 9 × 9, ce n’est pas le point étoile). Assez haut pour regarder le centre.',
  'o.n9-coin.c1': 'Noir joue au 4-4 : 4e ligne depuis le bas et depuis la gauche.',
  'o.n9-coin.c2': 'Blanc prend le 4-4 d’en face, en diagonale.',
  'o.n9-coin.c3': 'Noir prend le 4-4 en bas à droite.',
  'o.n9-coin.c4': 'Blanc prend le dernier, en haut à gauche.',
  'o.n9-coin.e1': 'C2, sur la 2e ligne : ta pierre entoure très peu.',
  'o.n9-coin.e2': 'E2, sur la 2e ligne : tu prends bien moins de place.',

  // 19 × 19 : les coins d'abord
  'o.g-coins.nom': 'Les coins d’abord',
  'o.g-coins.idee': 'Dans un coin, deux bords t’aident à entourer des points. Puis les bords, puis le centre.',
  'o.g-coins.c1': 'Noir prend un coin, au hoshi (point étoile, le 4-4).',
  'o.g-coins.c2': 'Blanc prend un coin lui aussi.',
  'o.g-coins.c3': 'Noir prend un deuxième coin.',
  'o.g-coins.c4': 'Blanc prend le dernier coin libre.',
  'o.g-coins.e1': 'K10, le centre : aucun bord n’aide ta pierre à entourer des points.',
  'o.g-coins.e2': 'Le centre, encore trop tôt : un coin libre vaut bien plus.',

  // 19 × 19 : puis les bords
  'o.g-bords.nom': 'Puis les bords',
  'o.g-bords.idee': 'Les quatre coins sont pris. Le bord vient ensuite : il vaut plus que le centre.',
  'o.g-bords.c1': 'Noir se place sur le bord droit, entre ses deux coins.',
  'o.g-bords.e1': 'K10, le centre : sans bord, il faut bien plus de pierres pour entourer des points.',

  // 19 × 19 : hoshi, approche et glissement
  'o.h-approche.nom': 'Hoshi : l’approche',
  'o.h-approche.idee': 'Ton hoshi (point étoile) est seul dans son coin. Blanc vient près de lui : un kakari (approche).',
  'o.h-approche.c1': 'Blanc approche ton hoshi par le bas.',
  'o.h-approche.c2': 'Noir saute d’un pas vers le haut, vers sa pierre D10.',
  'o.h-approche.c3': 'Blanc glisse sous ton hoshi, sur la 2e ligne.',
  'o.h-approche.c4': 'Noir bloque en C3 : il ferme l’entrée du coin.',
  'o.h-approche.c5': 'Blanc s’étend sur le bord bas : ses pierres ont de la place.',
  'o.h-approche.e1': 'F2, sous sa pierre : Blanc coupe en E3. Ta pierre F2 est seule et écrasée sur la 2e ligne.',

  // 19 × 19 : hoshi, l'invasion au 3-3
  'o.h-sansan.nom': 'Hoshi : l’invasion au 3-3',
  'o.h-sansan.idee': 'Blanc entre sous ton hoshi (point étoile), au san-san (point 3-3). Bloque-le et bâtis un mur.',
  'o.h-sansan.c1': 'Blanc entre au san-san (point 3-3), sous ton hoshi.',
  'o.h-sansan.c2': 'Noir bloque du côté de sa pierre D10.',
  'o.h-sansan.c3': 'Blanc rampe vers la droite, sur la 3e ligne.',
  'o.h-sansan.c4': 'Noir s’allonge au-dessus de lui : son mur grandit.',
  'o.h-sansan.c5': 'Blanc saute d’un pas sur la 3e ligne.',
  'o.h-sansan.e1': 'D5 ne bloque rien : Blanc avance en D3.',
  'o.h-sansan.e2': 'C2, par en dessous : Blanc répond en D3. Ta pierre C2 est coupée et Blanc garde le bas.',

  // 19 × 19 : komoku, l'approche et le tsuke
  'o.k-tsuke.nom': 'Komoku : le tsuke',
  'o.k-tsuke.idee': 'Le komoku : 3e ligne d’un bord, 4e de l’autre. Blanc approche, tu te colles à sa pierre, côté coin.',
  'o.k-tsuke.c1': 'Noir joue un komoku : 3e ligne d’un bord, 4e de l’autre.',
  'o.k-tsuke.c2': 'Blanc approche par le bas : kakari (approche).',
  'o.k-tsuke.c3': 'Tsuke (coup au contact) : Noir se colle à sa pierre, côté coin.',
  'o.k-tsuke.c4': 'Blanc se redresse : il joue juste au-dessus, en E4.',
  'o.k-tsuke.c5': 'Noir s’étend le long du bord gauche : il prend de la place.',
  'o.k-tsuke.e1': 'C3, collée à ta pierre : elle n’entoure presque rien de plus.',
  'o.k-tsuke.e2': 'E5 : Blanc coupe en D4, tes pierres sont séparées.',

  // 19 × 19 : komoku, le kosumi
  'o.k-kosumi.nom': 'Komoku : le kosumi',
  'o.k-kosumi.idee': 'Le komoku : 3e ligne d’un bord, 4e de l’autre. Contre l’approche, un pas en diagonale.',
  'o.k-kosumi.c1': 'Noir joue un komoku : 3e ligne d’un bord, 4e de l’autre.',
  'o.k-kosumi.c2': 'Blanc approche par le bas : kakari (approche).',
  'o.k-kosumi.c3': 'Kosumi (un pas en diagonale) : Noir renforce son coin vers le haut.',
  'o.k-kosumi.c4': 'Blanc s’étend sur le bord bas : chacun son côté.',
  'o.k-kosumi.e1': 'B5, sur la 2e ligne : trop bas, ta pierre protège peu le coin.',
};

export type CleOuvertures = keyof typeof FR;

const EN: { readonly [K in CleOuvertures]: string } = {
  'titre': 'Openings',
  'intro': 'The start of a game (fuseki) and move sequences in a corner (joseki). Pick an opening.',
  'taille.9': '9 × 9',
  'taille.19': '19 × 19',
  'tailles': 'Board size',
  'preuve': 'Every move in the sequence is checked by KataGo: it loses 1.5 points at most against the best move.',
  'retourApprendre': 'Back to Learn',
  'retourListe': 'Back to openings',
  'coups': '{n} moves',
  'coups.un': '1 move',
  'depart': 'Tap “Next” to see the first move.',
  'precedent': 'Previous',
  'suivant': 'Next',
  'progression': 'Move {n} of {total}',
  'voirErreur': 'See the common mistake',
  'autreErreur': 'Another mistake',
  'retourSequence': 'Back to the sequence',
  'perte': 'This move costs about {pts} points.',
  'erreurTitre': 'Common mistake',
  'ailleurs': 'The corner is settled: {camp} can play elsewhere.',
  'fin': 'End of the sequence. Replay it to remember it.',
  'recommencer': 'Start over',
  'noir': 'Black',
  'blanc': 'White',
  'joue': '{camp} plays at {point}.',

  'o.n9-centre.nom': 'The center first',
  'o.n9-centre.idee': 'On 9 × 9, the center point (tengen) looks at all four corners at once.',
  'o.n9-centre.c1': 'Black plays the center point. From there, it looks at every corner.',
  'o.n9-centre.c2': 'White settles on the left, on the 3rd line.',
  'o.n9-centre.c3': 'Black steps down diagonally, between White and the bottom.',
  'o.n9-centre.c4': 'White extends down, along the edge.',
  'o.n9-centre.c5': 'Black blocks the top: White stays near the left edge.',
  'o.n9-centre.e1': 'B2, right next to the corner: your stone surrounds very little.',
  'o.n9-centre.e2': 'C3, too low: White answers at D4 and cuts you off from the center.',
  'o.n9-centre.e3': 'C6, stuck to White: White answers at D6 and gets out at the top.',

  'o.n9-coin.nom': 'The four corners on 9 × 9',
  'o.n9-coin.idee': 'The 4-4: 4th line from two edges (on 9 × 9, it is not the star point). High enough to watch the center.',
  'o.n9-coin.c1': 'Black plays the 4-4: 4th line from the bottom and from the left.',
  'o.n9-coin.c2': 'White takes the opposite 4-4, diagonally.',
  'o.n9-coin.c3': 'Black takes the bottom right 4-4.',
  'o.n9-coin.c4': 'White takes the last one, top left.',
  'o.n9-coin.e1': 'C2, on the 2nd line: your stone surrounds very little.',
  'o.n9-coin.e2': 'E2, on the 2nd line: you take much less room.',

  'o.g-coins.nom': 'Corners first',
  'o.g-coins.idee': 'In a corner, two edges help you surround points. Then the sides, then the center.',
  'o.g-coins.c1': 'Black takes a corner, on the star point (hoshi), the 4-4.',
  'o.g-coins.c2': 'White takes a corner too.',
  'o.g-coins.c3': 'Black takes a second corner.',
  'o.g-coins.c4': 'White takes the last free corner.',
  'o.g-coins.e1': 'K10, the center: no edge helps your stone surround points.',
  'o.g-coins.e2': 'The center, still too early: a free corner is worth much more.',

  'o.g-bords.nom': 'Then the sides',
  'o.g-bords.idee': 'All four corners are taken. The side comes next: it is worth more than the center.',
  'o.g-bords.c1': 'Black plays on the right side, between its two corners.',
  'o.g-bords.e1': 'K10, the center: with no edge, you need many more stones to surround points.',

  'o.h-approche.nom': 'Star point: the approach',
  'o.h-approche.idee': 'Your star point (hoshi) is alone in its corner. White comes close to it: an approach (kakari).',
  'o.h-approche.c1': 'White approaches your star point from below.',
  'o.h-approche.c2': 'Black jumps one space up, toward its stone at D10.',
  'o.h-approche.c3': 'White slides under your hoshi, on the 2nd line.',
  'o.h-approche.c4': 'Black blocks at C3: it closes the way into the corner.',
  'o.h-approche.c5': 'White extends along the bottom side: its stones have room.',
  'o.h-approche.e1': 'F2, under its stone: White cuts at E3. Your F2 stone is cut off and stuck on the 2nd line.',

  'o.h-sansan.nom': 'Star point: the 3-3 invasion',
  'o.h-sansan.idee': 'White goes in under your star point (hoshi), at the 3-3 point (san-san). Block it and build a wall.',
  'o.h-sansan.c1': 'White goes in at the 3-3 point, under your star point.',
  'o.h-sansan.c2': 'Black blocks on the side of its stone at D10.',
  'o.h-sansan.c3': 'White crawls to the right, on the 3rd line.',
  'o.h-sansan.c4': 'Black extends above it: its wall grows.',
  'o.h-sansan.c5': 'White jumps one space along the 3rd line.',
  'o.h-sansan.e1': 'D5 blocks nothing: White moves on at D3.',
  'o.h-sansan.e2': 'C2, from below: White answers at D3. Your C2 stone is cut off and White keeps the bottom.',

  'o.k-tsuke.nom': '3-4 point: the attachment',
  'o.k-tsuke.idee': 'The 3-4 point (komoku): 3rd line from one edge, 4th from the other. White approaches, you attach on the corner side.',
  'o.k-tsuke.c1': 'Black plays a 3-4 point: 3rd line from one edge, 4th from the other.',
  'o.k-tsuke.c2': 'White makes an approach (kakari) from below.',
  'o.k-tsuke.c3': 'Black attaches (tsuke, a contact move) on the corner side of its stone.',
  'o.k-tsuke.c4': 'White stands up, right above, at E4.',
  'o.k-tsuke.c5': 'Black extends along the left side: it takes room.',
  'o.k-tsuke.e1': 'C3, stuck to your stone: it surrounds almost nothing more.',
  'o.k-tsuke.e2': 'E5: White cuts at D4, and your stones are split.',

  'o.k-kosumi.nom': '3-4 point: the diagonal move',
  'o.k-kosumi.idee': 'The 3-4 point (komoku): 3rd line from one edge, 4th from the other. Against the approach, one diagonal step.',
  'o.k-kosumi.c1': 'Black plays a 3-4 point: 3rd line from one edge, 4th from the other.',
  'o.k-kosumi.c2': 'White makes an approach (kakari) from below.',
  'o.k-kosumi.c3': 'One diagonal step (kosumi): Black makes its corner stronger, upward.',
  'o.k-kosumi.c4': 'White extends along the bottom side: each takes a side.',
  'o.k-kosumi.e1': 'B5, on the 2nd line: too low, your stone does little for the corner.',
};

export const CATALOGUE_OUVERTURES: Record<Langue, { readonly [K in CleOuvertures]: string }> = { fr: FR, en: EN };

/** Texte dans une langue donnée, variables `{nom}` remplacées. */
export function traduireOuvertures(l: Langue, cle: CleOuvertures, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_OUVERTURES[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const tou = (cle: CleOuvertures, vars?: Record<string, string | number>): string => traduireOuvertures(langue(), cle, vars);
