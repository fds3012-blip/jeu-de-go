// Leçons en anglais (issue #167). Textes seulement : positions, réponses, démonstrations et gestes viennent de
// content/lessons.fr.js, étape par étape (src/content/lessons.ts, `localiser`). Une leçon absente d'ici reste en français.
// Vocabulaire : docs/localisation/glossaire.md (AGA, EGF). Même limite qu'en français : 12 mots par consigne.
// Nombres à l'anglaise : 6.5, jamais 6,5 (vérifié par src/content/lessons.en.test.ts).
// Chaque étape : { text, ok?, no?, choices?, geste: { no }?, refus: [no, …]? }, dans l'ordre des étapes françaises.
export const CHAPITRES_EN = {
  c1: { titre: 'The basics', intro: 'Seven short lessons to play your first game.', fin: 'You know the rules of Go.' },
  c2: { titre: 'The opening', intro: 'Where to place your first stones.' },
  c3: { titre: 'Capturing and saving', intro: 'Traps to capture more stones.' },
  c4: { titre: 'Life and death', intro: 'When a group lives, and when it dies.' },
  c5: { titre: 'Endgame and counting', intro: 'Finish cleanly, then count right.' },
  c6: { titre: 'Shape and tesuji', intro: 'Good shapes and the clever moves of Go.' }
};

const COLLEE = 'Right next to White, your stone makes White stronger. Leave some space.';
const STUCK = 'Stuck to your own stone, it surrounds almost nothing more.';
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
  ] },
  l29: { title: 'The opening on 13\u00A0×\u00A013', desc: 'Corners, then sides, then center', steps: [
    { text: 'Corners first: play the green point. Each player takes a corner.' },
    { text: 'Your turn: take a free corner.',
      ok: 'Good: a corner is held with few stones.', no: 'Aim for an empty corner, on the 3rd or 4th line.',
      refus: [STUCK] },
    { text: 'For Black: K4, a free corner, or E4, next to D4?', choices: ['K4', 'E4'],
      ok: 'K4: a whole corner. E4 adds almost nothing to D4.', no: 'Stuck to D4, the stone at E4 surrounds few new points.' },
    { text: 'Then the sides, the center last. Play the green point.' },
    { text: 'Corners are closed. Your turn: take a big point on a side.',
      ok: 'Good: a big point, on the 3rd or 4th line.', no: 'Look for a free side, on the 3rd or 4th line.',
      refus: [STUCK] }
  ] },
  l30: { title: 'The san-san', desc: 'When White slides under your star point', steps: [
    { text: 'San-san (the 3-3 point): White slides under your hoshi (star point). Block at the green point.' },
    { text: 'Your turn: White invades at the san-san. Block it.',
      ok: 'Good: your stone touches White’s and bars the way.', no: 'Put your stone against White’s: at D3 or at C4.',
      refus: ['From underneath, you block nothing: White moves ahead.', 'Too far from White’s stone: White moves one step ahead.'] },
    { text: 'White crawls upward. Bar the way at the green point.' },
    { text: 'Your turn: White crawls along the edge. Bar the way.',
      ok: 'Good: White stays shut in the corner.', no: 'Play in front of White’s leading stone, not underneath it.',
      refus: ['From the inside, you bar nothing: White gets out over the top.', 'Stuck to your hoshi: White passes in front and gets out.'] }
  ] },
  l31: { title: 'The 3-4 point and the approach', desc: 'The kakari and its answers', steps: [
    { text: 'Play a 3-4 point (komoku: 3rd line from one edge, 4th from the other) at the green point. White approaches: kakari.' },
    { text: 'Tsuke (a contact move): attach underneath at the green point. White stands up.' },
    { text: 'Your turn: tsuke underneath, or kosumi (one diagonal step).',
      ok: 'Good: that is one of the two classic answers.', no: 'Tsuke: under White’s stone. Kosumi: diagonal from yours.',
      refus: ['On the 2nd line, your stone protects nothing.', STUCK] },
    { text: 'White stood up. Extend along the edge.',
      ok: 'Good: your stones gain room on the side.', no: 'Go up along the left edge, without touching White.',
      refus: ['Too slow: White takes the side before you.', 'White cuts at D4: your stones are split.', 'Too far: White slides in at D2, under your stones.'] }
  ] },
  l9: { title: 'The net', desc: 'Trap a stone without touching it', steps: [
    { text: 'Atari at the green point? It runs to a white stone: safe.' },
    { text: 'Net (geta): close its exits at the green point, without touching it.' },
    { text: 'Your turn: catch the marked stone in a net.',
      ok: 'Net! It still has two liberties, but no way out.', no: 'Don’t touch it: close both exits from a distance.',
      refus: ['In atari, it extends, the ladder breaks, and it escapes.'] }
  ] },
  l10: { title: 'Snapback', desc: 'Give one stone to capture three', steps: [
    { text: 'Play the green point. Your stone is in atari: on purpose.' },
    { text: 'White took it, but is in atari. Recapture at the green point.' },
    { text: 'Your turn: give one stone, then capture three.',
      ok: 'Snapback! Not a ko: you capture three stones.', no: 'Play where White wants to connect, even if your stone gets captured.',
      refus: ['Atari from the wrong side: White plays E9 and connects.'] }
  ] },
  l11: { title: 'The capturing race', desc: 'Who captures the other first', steps: [
    { text: 'Capturing race (semeai): groups without eyes. Tap White’s group, we count.',
      geste: { no: 'Tap one of the three connected white stones.' } },
    { text: 'Three against three. You play first: fill the green point.' },
    { text: 'Your turn: fill White’s liberties, not your own.',
      ok: 'White has only one liberty left: you win the race.', no: 'Count: you must fill one of White’s liberties.',
      refus: ['You’re filling your own liberty: White wins the race.'] }
  ] },
  l12: { title: 'The false eye', desc: 'An eye that doesn’t count', steps: [
    { text: 'Two eyes? Tap D1: it isn’t connected to the rest.',
      geste: { no: 'Tap one of the two black stones on the right.' } },
    { text: 'D1 is in atari. Connect at the green point: one eye left.' },
    { text: 'Tap the false eye (an eye White can destroy).',
      ok: 'Yes, C1: its corner D2 is White’s. On the edge, one corner is enough.', no: 'Look at the corners (diagonal points) of each eye.' },
    { text: 'Your turn: make two real eyes before White does.',
      ok: 'D2 connects everything: A1 and C1 are two real eyes. You live.', no: 'Protect C1’s corner before White takes it.',
      refus: ['You’re filling one of your own eyes: only one is left.'] },
    { text: 'The other way around: make one of White’s eyes false.',
      ok: 'White has only one real eye left: White is dead.', no: 'Take the corner of White’s eye, where its stones split apart.' }
  ] },
  l13: { title: 'The vital point', desc: 'The middle decides', steps: [
    { text: 'Three in a row: playing the middle (green point) makes two eyes.' },
    { text: 'Tap the vital point. If White takes it, your group dies.',
      geste: { no: 'Tap the middle point, between the other two.' } },
    { text: 'Your turn: kill the marked white group.',
      ok: 'Vital point! White can make only one eye: White is dead.', no: 'Play in the middle of White’s space.',
      refus: ['Next to the middle: White plays there and makes two eyes.'] },
    { text: 'Your turn: make your marked group live.',
      ok: 'Two eyes, J4 and J2: your group lives.', no: 'Take the middle point before White does.',
      refus: ['At the end of the space: White takes the middle, and you die.'] },
    { text: 'Four in a row: White enters, answer the green point. You live.' },
    { text: 'Only two points. Can this black group live?', choices: ['Yes, always', 'Yes, if Black plays first', 'No, never'],
      ok: 'Two points make only one eye: this group is dead.', no: 'Even if Black plays first, it makes only one eye.' }
  ] },
  l14: { title: 'Seki', desc: 'Living together, without eyes', steps: [
    { text: 'Seki (mutual life): no eyes, two shared liberties. Tap one.',
      geste: { no: 'Tap an empty point between the stones.' } },
    { text: 'Fill the green point: you put yourself in atari. White captures everything.' },
    { text: 'If White fills C1, White dies. Capture at the green point.' },
    { text: 'Nobody plays here. Who owns C1 and E1?', choices: ['Black', 'White', 'Nobody'],
      ok: 'Nobody: in a seki, these points don’t count.', no: 'Neither player can fill them without dying.' },
    { text: 'Your turn: save your marked stones with a seki.',
      ok: 'Two shared liberties: nobody can attack. That’s seki.', no: 'Keep two liberties shared with White.',
      refus: ['There, you put yourself in atari: White captures.'] }
  ] },
  l15: { title: 'Finishing the game', desc: 'Dame, borders, dead stones', steps: [
    { text: 'Dame (neutral point): it touches Black and White. Tap it.',
      geste: { no: 'Look for the empty point between Black and White.' } },
    { text: 'Fill it at the green point: no point won, none lost.' },
    { text: 'Before passing: one border is still open. Close it.',
      ok: 'Closed right against White: all your points count.', no: 'Look for the hole between your territory and White.',
      refus: ['Closed, but you lose D8: close it right against White.'] },
    { text: 'Dead stone: it can never live. Tap it, in your territory.',
      geste: { no: 'Look for the white stone, bottom left.' } },
    { text: 'Should you capture B2 before passing?', choices: ['Yes', 'No, I pass'],
      ok: 'It’s dead: it’s removed at the end, like a prisoner.', no: 'Each move in your own territory costs a point. It’s already dead.' },
    { text: 'B2 is removed and becomes a prisoner. How many points for Black?', choices: ['26', '27', '28'],
      ok: '26 territory + 1 prisoner = 27.', no: 'Count the colored territory, then add the prisoner.' }
  ] },
  l16: { title: 'Counting a game', desc: 'Dead stones, territory, prisoners, komi', steps: [
    { text: 'The game is over. Tap your dead stone, in White’s area.',
      geste: { no: 'Look for a lone black stone in White’s area.' } },
    { text: 'Your turn: tap the dead white stone.',
      ok: 'Yes: both dead stones are removed. Each one becomes a prisoner.', no: 'Look for a lone white stone in Black’s area.' },
    { text: 'Dead stones removed. Count with me: 26 points each.' },
    { text: 'Black has 7 prisoners, plus the dead stone. How many points?', choices: ['33', '34', '40.5'],
      ok: '26 + 7 + 1 = 34.', no: 'Territory plus prisoners, dead stone included. Komi goes to White.' },
    { text: 'White has 1 prisoner, plus the dead stone. With komi?', choices: ['28', '32.5', '34.5'],
      ok: '26 + 1 + 1 + 6.5 = 34.5.', no: 'Territory, prisoners, dead stone, then komi (6.5).' },
    { text: 'Black 34, White 34.5. Who wins?', choices: ['Black', 'White', 'Tie'],
      ok: 'White, by half a point. The half point of komi prevents ties.', no: '34.5 is more than 34.' }
  ] },
  l17: { title: 'Eye shapes', desc: 'The T, the box, the bulky five', steps: [
    { text: 'T-shaped space: play the middle, at the green point. Three eyes!' },
    { text: 'Your turn: kill the marked white group.',
      ok: 'The middle of the T: White makes only one eye. Dead.', no: 'Look for the point touching the other three.',
      refus: ['White takes the middle: two eyes.'] },
    { text: 'Box of four. Black plays first: can it live?', choices: ['Yes', 'No'],
      ok: 'No. After one move inside, White takes the vital point: one eye.', no: 'Play once inside: White takes the opposite corner, one eye.' },
    { text: 'Bulky five: the vital point is the green point. Take it.' },
    { text: 'Your turn: kill this white group of five points.',
      ok: 'Vital point taken: White’s vital point is yours too.', no: 'Look for the point touching three empty points.',
      refus: ['White takes the vital point: it lives.'] }
  ] },
  l18: { title: 'Good shape', desc: 'Tiger’s mouth and bamboo joint', steps: [
    { text: 'Cutting point: White would split your stones there. Tap it.',
      ok: 'Yes, D5: if White plays there, your two stones are cut.', no: 'Look for the empty point touching both your stones.' },
    { text: 'Tiger’s mouth (three stones around an empty point): play the green point. White enters? Captured.' },
    { text: 'Your turn: guard the cutting point with a tiger’s mouth.',
      ok: 'If White cuts at C7, it’s in atari at once.', no: 'Play next to the cutting point C7, without filling it.',
      refus: ['It connects, but it’s heavy. The tiger’s mouth connects from further away.'] },
    { text: 'Bamboo joint: two gaps. White takes one? Take the other, green point.' },
    { text: 'White enters your bamboo joint. Connect your marked stones.',
      ok: 'Connected: a bamboo joint can never be cut.', no: 'Take the other gap of the bamboo joint.' }
  ] },
  l19: { title: 'Cutting stones', desc: 'Capture the ones that split your groups', steps: [
    { text: 'This white stone cuts your stones. Capture it at the green point.' },
    { text: 'Diamond (ponnuki): White can never enter. Your stones hold together.' },
    { text: 'Two white stones in atari. Capture the cutting one.',
      ok: 'Your marked stones hold together. White keeps a useless stone.', no: 'Look for the white stone between your marked stones.',
      refus: ['It cuts nothing. White saves E6 and splits your stones.'] },
    { text: 'Two stones on one side, one on the other. Which one?',
      ok: 'The cutting stone is worth more than two useless ones.', no: 'Capture the stone that splits your marked stones.',
      refus: ['Two prisoners, but White saves E6 and splits your stones.'] }
  ] },
  l20: { title: 'Connect and die', desc: 'When connecting saves nothing', steps: [
    { text: 'Atari at the green point. White connects? Everything stays in atari.' },
    { text: 'Capture everything at the green point: five stones for one.' },
    { text: 'Your turn: capture the marked stones, even if White connects.',
      ok: 'Connecting at F9 leaves one liberty: you capture everything.', no: 'Put the marked stones in atari, from the open side.',
      refus: ['Atari from the wrong side: White captures your stone at G9.'] },
    { text: 'After your atari at F1, should White connect?', choices: ['Yes', 'No, give up E1'],
      ok: 'Right: connecting loses five stones, giving up loses only one.', no: 'Connecting leaves one liberty: White would lose five stones.' }
  ] },
  l21: { title: 'Shortage of liberties', desc: 'When connecting means atari', steps: [
    { text: 'Fill White’s only outside liberty, at the green point.' },
    { text: 'Shortage of liberties: connecting means atari. Capture at the green point.' },
    { text: 'White connects at A2. How many liberties are left?', choices: ['0', '1', '2'],
      ok: 'Only one, B1: you capture six stones.', no: 'Count the empty points around the connected group.' },
    { text: 'Your turn: fill its outside liberty. It can’t connect anymore.',
      ok: 'Connecting would put it in atari: White is captured.', no: 'Look for White’s only liberty outside its shape.' }
  ] },
  l22: { title: 'Sente and gote', desc: 'The move that demands an answer', steps: [
    { text: 'Sente (a move that demands an answer): atari at the green point. White connects.' },
    { text: 'You keep the initiative: close the top too, at the green point.' },
    { text: 'Gote (a move that threatens nothing): play the green point. White connects at E2.' },
    { text: 'Here, your move at E1: sente or gote?', choices: ['It’s sente', 'It’s gote'],
      ok: 'Gote: it threatens nothing, White can play elsewhere.', no: 'After E1, White has nothing to defend: it plays elsewhere.' },
    { text: 'Your turn: play the sente move first.',
      ok: 'Atari: White must connect, then you close the bottom too.', no: 'Look for the atari: White will have to answer.',
      refus: ['Gote first: White connects at E8. Two points less.'] }
  ] },
  l23: { title: 'First-line hane', desc: 'Bend around, then connect', steps: [
    { text: 'Hane (a move that bends around a stone): play the green point. White blocks, you connect.' },
    { text: 'White blocks. Your stone is in atari: connect it.',
      ok: 'Connected. Thanks to the hane, White has one point less.', no: 'Play on the last liberty of your stone E1.',
      refus: ['White captures E1 at D1, and it’s a ko. Connect instead.'] },
    { text: 'Your hane, or White’s at D1: how many points apart?', choices: ['1', '2', '4'],
      ok: 'Two: one more point for you, one less for White.', no: 'Count both sequences: each side wins or loses one point.' },
    { text: 'Your turn: play the first-line hane.',
      ok: 'Hane, then you will connect: White gives up one point.', no: 'Bend around the white stone E2 from below.',
      refus: ['You block on your own side: one point less than the hane.'] }
  ] },
  l24: { title: 'Enlarge or reduce', desc: 'The point at the edge of the space', steps: [
    { text: 'Take the green point, at the edge: two eyes, A1-B1 and D1.' },
    { text: 'If White plays there first, your space shrinks: one eye only.', geste: { no: 'Tap the empty point at your space’s edge, by White.' } },
    { text: 'Your turn: reduce this white group from the outside.',
      ok: 'Reduced from the edge: White has only one eye.', no: 'Look for the point at the edge of its space, next to your stones.',
      refus: ['Too early inside: White takes E1 and lives.'] },
    { text: 'Your turn: enlarge your space to live.',
      ok: 'The edge of your space is yours: two eyes.', no: 'Take the empty point at the edge of your space, next to White.',
      refus: ['Inside, you fill your own space: White takes J5.'] }
  ] },
  l25: { title: 'Corner groups', desc: 'The corner point, and the ko', steps: [
    { text: 'In the corner, the green point decides. Take it: two eyes.' },
    { text: 'White takes A2. Play the green point: White captures, a ko.' },
    { text: 'If White plays A2 first, what happens?', choices: ['You live', 'You die at once', 'A ko starts'],
      ok: 'A ko: White must win it to capture you. While it lasts, you are not alive.', no: 'Neither alive nor captured yet: it all depends on the ko.' },
    { text: 'Your turn: make your group live in the corner.',
      ok: 'The corner point is yours: two eyes.', no: 'Look for the corner point, on the edge.',
      refus: ['White takes J8: only one eye.', 'White takes J8: it’s a ko.', 'You fill your eye F9: only one eye left.'] }
  ] },
  l26: { title: 'Racing with an eye', desc: 'The eye is filled last', steps: [
    { text: 'Your eye at A1: White can only play there last.', geste: { no: 'Tap the empty point surrounded by your group, in the corner.' } },
    { text: 'First fill its outside liberties, at the green point.' },
    { text: 'If White plays first, who wins the race?', choices: ['You', 'White'],
      ok: 'White: it fills C1, and your group only has its eye.', no: 'White fills C1: only your eye is left, and White takes it.' },
    { text: 'Your turn: win the race. Keep your eye for last.',
      ok: 'Outside first: White can’t touch your eye.', no: 'Fill a White liberty that doesn’t touch your group.',
      refus: ['Shared liberty: you put yourself in atari, White captures at J1.', 'You fill your eye: White captures at G1.'] }
  ] },
  l27: { title: 'Attack and defend', desc: 'The road to the center', steps: [
    { text: 'Weak stone (alone in enemy area): close its way to the center, at the green point.' },
    { text: 'If White plays first, it escapes at this same point. Tap it.',
      geste: { no: 'Tap the point between its stone and the center.' } },
    { text: 'Your turn: attack the marked stone. Close its way to the center.',
      ok: 'Good: its road to the center is closed.', no: 'Play between the marked stone and the center.',
      refus: ['You block it along the edge: it gets out at F4.'] },
    { text: 'Your marked stone is weak. Run it toward the center.',
      ok: 'Good: your stone takes the road to the center.', no: 'Move your stone away from the edge, toward the center.',
      refus: ['On the 3rd line, you crawl instead of running to the center.', 'Toward the edge, you shrink: White closes the center at F6.'] }
  ] }
};
