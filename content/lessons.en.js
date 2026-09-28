// Leçons en anglais (issue #167). Textes seulement : positions, réponses, démonstrations et gestes viennent de
// content/lessons.fr.js, étape par étape (src/content/lessons.ts, `localiser`). Une leçon absente d'ici reste en français.
// Vocabulaire : docs/localisation/glossaire.md (AGA, EGF). Même limite qu'en français : 12 mots par consigne.
// Nombres à l'anglaise : 6.5, jamais 6,5 (vérifié par src/content/lessons.en.test.ts).
// Chaque étape : { text, ok?, no?, choices?, geste: { no }?, refus: [no, …]? }, dans l'ordre des étapes françaises.
export const CHAPITRES_EN = {
  c1: { titre: 'The basics', intro: 'Seven short lessons to play your first game.', fin: 'You know the rules of Go.' },
  c2: { titre: 'Opening on 9 × 9', intro: 'Where to place your first stones.' }
};

const COLLEE = 'Right next to White, your stone makes White stronger. Leave some space.';
const BAS = 'On the first two lines, early in the game, your stone surrounds little.';

export const LESSONS_EN = {
  l1: { title: 'Liberties and capture', desc: 'The rule behind the whole game', steps: [
    { text: 'Play the green point. Empty points next to it are its liberties.' },
    { text: 'Play in the corner, on the green point: only two liberties.' },
    { text: 'Fill its liberties, starting with the green point. One left: that’s atari.' },
    { text: 'Play on the last liberty to capture.',
      ok: 'Captured! With no liberties left, it is removed from the board.', no: 'Look for the only empty point next to the marked stone.' },
    { text: 'Stones side by side are connected: one group, shared liberties. Tap it.',
      geste: { no: 'Tap one of the two connected white stones.' } },
    { text: 'Capture both stones in one move.',
      ok: 'Two prisoners (captured stones)! A group lives or dies together.', no: 'The group has only one liberty: find it.' }
  ] },
  l2: { title: 'Atari: attack and escape', desc: 'When only one liberty is left', steps: [
    { text: 'Play the green point. One liberty left: the stone is in atari.' },
    { text: 'If White does nothing, capture it on the green point.' },
    { text: 'In atari? Extend: add a stone at the green point. More liberties.' },
    { text: 'Your turn. Extend your marked stone onto its liberty.',
      ok: 'Three liberties: your stone is safe.', no: 'Play on the green point, next to your stone.' },
    { text: 'Extend to the green point. Not enough here: still one liberty.' },
    { text: 'Save your stone another way: a white stone is in atari.',
      ok: 'Capturing F5 gives your stone its liberties back. Attacking is defending too.', no: 'Look for the white stone with only one liberty.' }
  ] },
  l3: { title: 'Capturing techniques', desc: 'Double atari, edge and ladder', steps: [
    { text: 'Play on the green point: two stones in atari, a double atari.' },
    { text: 'White saves one. Capture the other on the green point.' },
    { text: 'Your turn: find the double atari.',
      ok: 'White can save only one: you capture the other.', no: 'Look for the green point the two stones share.' },
    { text: 'Atari at the green point: it runs to the edge and dies.' },
    { text: 'Your turn: push the marked stone toward the edge.',
      ok: 'Against the edge, it has no way out.', no: 'On this side, it escapes to the center.' },
    { text: 'Ladder: atari at the green point. It runs, never reaching three liberties.' },
    { text: 'It zigzags all the way to the edge, then is captured.' },
    { text: 'Your turn: start the ladder on the marked stone.',
      ok: 'It will zigzag to the edge. A white stone in its path (a ladder breaker) would save it.',
      no: 'Play on the side where your F4 stone blocks the escape.' }
  ] },
  l4: { title: 'Ko', desc: 'The rule against going around in circles', steps: [
    { text: 'Capture on the green point. Your stone is in atari right away.' },
    { text: 'White can’t take back right away. That rule is called ko.' },
    { text: 'White plays elsewhere, then Black. Now White may take back.' },
    { text: 'Your turn: capture the marked stone.',
      ok: 'Now your F5 stone is in atari: it’s a ko.', no: 'The marked stone has only one liberty: the green point.' },
    { text: 'Tap the point where White can’t take back yet.',
      ok: 'Yes, E5: White must play elsewhere first.', no: 'Look for where White would take back your F5 stone.' }
  ] },
  l5: { title: 'Life and death', desc: 'Two eyes', steps: [
    { text: 'An eye: an empty point surrounded by one group. Tap one.',
      geste: { no: 'Look for an empty point surrounded by black stones.' } },
    { text: 'In an eye, White would have no liberties: suicide, not allowed.' },
    { text: 'Two eyes: this group can never be captured. It is alive.' },
    { text: 'Your group is surrounded. Make two eyes in one move.',
      ok: 'B1 splits the space into two eyes, A1 and C1: your group lives.', no: 'One eye is not enough. Play in the middle of the space.' },
    { text: 'The other way around: stop White from making two eyes.',
      ok: 'You took the vital point (the one that decides): White has one eye only, so White is dead.',
      no: 'In the middle, White would make two eyes. Take that point first.' }
  ] },
  l6: { title: 'Territory and opening', desc: 'Counting and a good start', steps: [
    { text: 'Territory: empty points one player surrounds. Tap Black’s territory.',
      ok: 'Yes! These empty points are surrounded by Black.', no: 'Look for an empty point on the black stones’ side.' },
    { text: 'Count with me: three columns of nine.' },
    { text: 'White has more points, plus komi (extra points for playing second): White wins.' },
    { text: 'In the opening (first moves): corners, then sides (along the edges), then center.' },
    { text: 'Corners and sides surround territory with fewer stones.' },
    { text: 'Play the first move. Avoid the two lines nearest the edge.',
      ok: 'Good first move: far enough from the edge to build, close enough to surround territory.',
      no: 'Too close to the edge: a stone on the first two lines surrounds very little. Move toward the center.' }
  ] },
  l7: { title: 'Counting points', desc: 'Close borders, pass, count', steps: [
    { text: 'We count territory + prisoners. White also gets komi (6.5 points, since Black plays first).' },
    { text: 'Territory is colored. With komi, how many points for White?', choices: ['27', '33.5', '36'],
      ok: '27 + 6.5 = 33.5. Black has 36: Black wins by 2.5 points.', no: 'Count White’s points, then add komi.' },
    { text: 'Hole at E7: your territory doesn’t count. Play the green point.' },
    { text: 'Your turn: close the border on the green point.',
      ok: 'Closed: your 36 points count at last.', no: 'While this hole stays open, White can come into your territory.' },
    { text: 'All the borders are closed. What do you do?', choices: ['I pass', 'In my territory', 'In White’s'],
      ok: 'Yes. After two passes in a row, the game ends: now we count.',
      no: 'In your own territory, you lose a point. In White’s, your stone would be captured.' },
    { text: 'Black has 3 prisoners, White 5. How many points for Black?', choices: ['36', '39', '42.5'],
      ok: '36 + 3 = 39. White: 27 + 5 + 6.5 = 38.5. Black wins by half a point.', no: 'Territory plus prisoners. Komi goes to White, not Black.' }
  ] },
  l8: { title: 'The first moves', desc: 'Corners, then sides, then center', steps: [
    { text: 'Close the corner (green point): 4 stones for 4 points. Side: 6, center: 8.' },
    { text: 'Play the 3-3 (3rd line from two edges) at the green point. White takes the 5-5 (the center, near all four corners).' },
    { text: 'Take a free corner: at the 3-3, or the 3-4 (one step farther).',
      ok: 'Good: the 3-3 holds the corner, the 3-4 also faces a side.', no: 'Pick a green point, in a corner with no stones.',
      refus: [COLLEE, BAS] },
    { text: 'Tap your stone next to White: 3 liberties. White attacks at once.',
      geste: { no: 'Look for the black stone right next to a white stone.' } },
    { text: 'Extend to the green point: one free point between your two stones.' },
    { text: 'Your turn: extend from one of your stones, along the side.',
      ok: 'Nice extension: on the 3rd line, with no stone right next to it.',
      no: 'Stay on the 3rd line, two or three points from one of your stones.',
      refus: [COLLEE, 'Too tight: leave a free point between your stones.', BAS] }
  ] }
};
