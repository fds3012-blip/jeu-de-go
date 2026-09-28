// Leçons en anglais (issue #167). Textes seulement : positions, réponses, démonstrations et gestes viennent de
// content/lessons.fr.js, étape par étape (src/content/lessons.ts, `localiser`). Une leçon absente d'ici reste en français.
// Vocabulaire : docs/localisation/glossaire.md (AGA, EGF). Même limite qu'en français : 12 mots par consigne.
// Chaque étape : { text, ok?, no?, choices?, geste: { no }?, refus: [no, …]? }, dans l'ordre des étapes françaises.
export const CHAPITRES_EN = {
  c1: { titre: 'The basics', intro: 'Seven short lessons to play your first game.', fin: 'You know the rules of Go.' },
  c2: { titre: 'Opening on 9 × 9', intro: 'Where to place your first stones.' }
};

export const LESSONS_EN = {
  l1: { title: 'Liberties and capture', desc: 'The rule behind the whole game', steps: [
    { text: 'Place your stone on the green point. Empty points around it: liberties.' },
    { text: 'Play in the corner, on the green point: only two liberties.' },
    { text: 'Block its liberties, starting with the green point. One left: that’s atari.' },
    { text: 'Play on the last liberty to capture.',
      ok: 'Captured! With no liberties, the stone leaves the board.', no: 'Look for the only empty point next to the marked stone.' },
    { text: 'Touching stones form a group and share liberties. Tap it.',
      geste: { no: 'Tap one of the two touching white stones.' } },
    { text: 'Capture both stones in one move.',
      ok: 'Two prisoners! A group lives or dies together.', no: 'The group has only one liberty: find it.' }
  ] },
  l2: { title: 'Atari: attack and escape', desc: 'When only one liberty is left', steps: [
    { text: 'Play the green point. One liberty left: the stone is in atari.' },
    { text: 'If White does nothing, capture it on the green point.' },
    { text: 'In atari? Extend to the green point: your liberties go up.' },
    { text: 'Your turn. Extend your marked stone onto its liberty.',
      ok: 'Three liberties: your stone is safe.', no: 'Play on the green point, next to your stone.' },
    { text: 'Extend to the green point. Not enough here: still one liberty.' },
    { text: 'Save your stone another way: a white stone is in atari.',
      ok: 'Capturing F5 frees your stone. Attacking is defending too.', no: 'Look for the white stone with only one liberty.' }
  ] },
  l3: { title: 'Capturing techniques', desc: 'Double atari, edge and ladder', steps: [
    { text: 'Play on the green point: two stones in atari, a double atari.' },
    { text: 'White saves one. Take the other on the green point.' },
    { text: 'Your turn: find the double atari.',
      ok: 'White can save only one: you take the other.', no: 'Look for the green point both stones share.' },
    { text: 'Atari toward the edge, on the green point: it runs and dies.' },
    { text: 'Your turn: push the marked stone toward the edge.',
      ok: 'Against the edge, it has no way out.', no: 'On this side, it escapes to the center.' },
    { text: 'Ladder: atari on the green point. It runs, never reaching three liberties.' },
    { text: 'It zigzags all the way to the edge, then is captured.' },
    { text: 'Your turn: start the ladder on the marked stone.',
      ok: 'It will zigzag to the edge. A white stone in its path would save it.', no: 'Play on the side where your F4 stone blocks the escape.' }
  ] },
  l4: { title: 'Ko', desc: 'The rule against going around in circles', steps: [
    { text: 'Capture on the green point. Your stone is in atari right away.' },
    { text: 'Retaking right away is not allowed: this is ko.' },
    { text: 'White plays elsewhere, Black too. Now White can retake.' },
    { text: 'Your turn: capture the marked stone.',
      ok: 'Now your F5 stone is in atari: it’s a ko.', no: 'The marked stone has only one liberty: the green point.' },
    { text: 'Tap the point where White can’t retake.',
      ok: 'Yes, E5: White must play elsewhere first.', no: 'Look for where White would retake your F5 stone.' }
  ] },
  l5: { title: 'Life and death', desc: 'Two eyes', steps: [
    { text: 'An eye: an empty point surrounded by one group. Tap one.',
      geste: { no: 'Look for an empty point surrounded by black stones.' } },
    { text: 'In an eye, White would have no liberties: not allowed.' },
    { text: 'Two real eyes: this group lives forever.' },
    { text: 'Your group is surrounded. Make two eyes in one move.',
      ok: 'B1 splits the space into two eyes, A1 and C1: your group lives.', no: 'One eye is not enough. Play in the middle of the space.' },
    { text: 'The other way around: stop White from making two eyes.',
      ok: 'Vital point (the one that decides) taken: one eye only, White is dead.', no: 'In the middle, White would make two eyes. Take that point first.' }
  ] }
};
