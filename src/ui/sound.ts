// Sons du goban, synthétisés en Web Audio : aucun fichier, aucune licence à gérer.
// Principe (synthèse modale) : un claquement = une attaque de bruit filtré très courte (le choc)
// + quelques résonances sinusoïdales amorties, non harmoniques (le bois qui sonne) + un « toc » grave (le plateau).
// Le contexte audio est créé ou repris au premier geste (exigence des navigateurs, surtout Safari iOS).

export type SoundName = 'pose' | 'poseAdverse' | 'capture' | 'atari' | 'interdit' | 'victoire' | 'reussite' | 'echec';

/** Panoramique d'un coup selon sa colonne : de −0,15 (colonne A) à +0,15 (dernière colonne). */
export function panFor(x: number, size: number): number {
  if (size < 2) return 0;
  return (x / (size - 1) - 0.5) * 0.3;
}

/** Anti-répétition : un même son n'est pas rejoué moins de `gap` ms après lui-même. Met `last` à jour. */
export function shouldPlay(last: Map<string, number>, key: string, now: number, gap = 50): boolean {
  const t = last.get(key);
  if (t !== undefined && now - t < gap) return false;
  last.set(key, now);
  return true;
}

/** Variation de hauteur ±3 % à partir d'un tirage dans [0, 1). */
export function pitchFactor(r: number): number {
  return 1 + (r * 2 - 1) * 0.03;
}

/** Nombre de pierres qui tombent sur le tas pour une capture de `n` pierres (1, 2, puis un tas). */
export function pileClicks(n: number): number {
  return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 4;
}

// Quatre claquements : fréquences des modes du bois (Hz), amplitude et durée d'amortissement (s).
// Rapports non harmoniques, comme une plaque de bois épaisse frappée par une pierre.
const CLAQUEMENTS: { modes: [number, number, number][]; choc: number; toc: number }[] = [
  { modes: [[1180, 0.5, 0.03], [2050, 0.26, 0.017], [3420, 0.13, 0.009]], choc: 3300, toc: 190 },
  { modes: [[1060, 0.52, 0.034], [1930, 0.24, 0.018], [3160, 0.12, 0.01]], choc: 3000, toc: 175 },
  { modes: [[1270, 0.46, 0.027], [2240, 0.28, 0.015], [3650, 0.14, 0.008]], choc: 3600, toc: 205 },
  { modes: [[1120, 0.5, 0.031], [1760, 0.2, 0.02], [2980, 0.15, 0.011]], choc: 3150, toc: 182 },
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let lastVariant = -1;
const last = new Map<string, number>();

type Ctor = typeof AudioContext;
function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Contexte audio prêt à jouer, ou null (sons coupés, navigateur sans Web Audio, contexte encore bloqué). */
function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const A = audioCtor();
      if (!A) return null;
      ctx = new A();
      const comp = ctx.createDynamicsCompressor(); // évite la saturation quand plusieurs sons se superposent
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/**
 * iPhone en mode silencieux : par défaut, Safari classe le son Web Audio comme « ambiant » et le coupe.
 * On demande la catégorie « lecture » (Safari 16.4+ : navigator.audioSession), et, pour les versions plus
 * anciennes, on joue une fois un court silence dans un élément <audio>, qui fait basculer la page en lecture.
 */
let sessionPrete = false;
function sessionLecture(): void {
  if (sessionPrete || typeof navigator === 'undefined') return;
  sessionPrete = true;
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) { nav.audioSession.type = 'playback'; return; }
  } catch { /* ignoré */ }
  try {
    const el = new Audio(SILENCE_WAV);
    el.setAttribute('playsinline', '');
    void el.play().catch(() => undefined);
  } catch { /* ignoré */ }
}

/** Un dixième de seconde de silence en WAV (8 kHz, 8 bits, mono). */
const SILENCE_WAV = (() => {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const txt = (o: number, t: string) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); txt(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = ''; for (const x of b) bin += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + (typeof btoa === 'function' ? btoa(bin) : '');
})();

/** À appeler au premier geste : crée ou reprend le contexte audio. */
export function unlockAudio(): void {
  if (!enabled) return;
  sessionLecture();
  const a = audio();
  if (!a) return;
  try { // Safari iOS : jouer un tampon silencieux dans le geste débloque la sortie.
    const s = a.createBufferSource();
    s.buffer = a.createBuffer(1, 1, a.sampleRate);
    s.connect(a.destination);
    s.start();
  } catch { /* ignoré */ }
}

let unlockInstalled = false;
/** Installe (une fois) l'écoute du premier geste pour débloquer le son. */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const once = () => {
    unlockAudio();
    if (ctx && ctx.state === 'running') for (const e of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(e, once, true);
  };
  for (const e of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(e, once, true);
}

/** Réglage « Sons » du Profil. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on && ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
}
export function soundEnabled(): boolean { return enabled; }

// ---------- Briques de synthèse (tout contexte, y compris OfflineAudioContext pour l'analyse) ----------

type Ctx = BaseAudioContext;
const bruits = new WeakMap<Ctx, AudioBuffer>();
function bruit(a: Ctx): AudioBuffer {
  let b = bruits.get(a);
  if (!b) {
    b = a.createBuffer(1, Math.ceil(a.sampleRate * 0.12), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    bruits.set(a, b);
  }
  return b;
}

/** Sortie d'un son : filtre de timbre puis panoramique, vers `root`. */
function out(a: Ctx, root: AudioNode, pan: number, lowpass = 12000): AudioNode {
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = lowpass; lp.Q.value = 0.5;
  let node: AudioNode = lp;
  if (typeof a.createStereoPanner === 'function') {
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    lp.connect(p);
    node = p;
  }
  node.connect(root);
  return lp;
}

/** Mode résonant : sinus amorti exponentiellement (attaque 1 ms), avec un léger glissement de hauteur possible. */
function mode(a: Ctx, dest: AudioNode, t: number, f: number, amp: number, tau: number, glide = 1): void {
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * glide, t);
  if (glide !== 1) o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.001);
  g.gain.setTargetAtTime(0, t + 0.001, tau);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.001 + tau * 7);
}

/** Choc : bruit blanc très court passé en passe-bande (ou passe-haut), décroissance exponentielle sur `dur`. */
function choc(a: Ctx, dest: AudioNode, t: number, centre: number, q: number, amp: number, dur: number, type: BiquadFilterType = 'bandpass'): void {
  const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  s.buffer = bruit(a);
  bp.type = type; bp.frequency.value = centre; bp.Q.value = q;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.0005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random() * 0.05);
  s.stop(t + dur + 0.01);
}

/** Note douce (sons d'interface) : sinus ou triangle, enveloppe lente. */
function note(a: Ctx, dest: AudioNode, t: number, f: number, amp: number, dur: number, type: OscillatorType = 'sine', to?: number): void {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.012);
  g.gain.setTargetAtTime(0, t + 0.02, dur / 4);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.1);
}

/** Cloche : fondamentale + partiels non harmoniques (2,76 et 5,40), longue résonance. */
function cloche(a: Ctx, dest: AudioNode, t: number, f: number, amp: number): void {
  mode(a, dest, t, f, amp, 0.42);
  mode(a, dest, t, f * 2.76, amp * 0.28, 0.16);
  mode(a, dest, t, f * 5.4, amp * 0.09, 0.06);
}

/** Pierre qui tombe sur le tas : choc plus aigu et plus vitreux (pierre contre pierre). */
function clicSurLeTas(a: Ctx, dest: AudioNode, t: number, amp: number): void {
  const f = pitchFactor(Math.random());
  choc(a, dest, t, 5200 * f, 1.4, 0.4 * amp, 0.01);
  mode(a, dest, t, 2650 * f, 0.34 * amp, 0.011);
  mode(a, dest, t, 4180 * f, 0.2 * amp, 0.007);
  mode(a, dest, t, 6020 * f, 0.08 * amp, 0.004);
}

/** Synthèse de chaque son, à l'instant `t`, vers `root`. Exposée pour l'analyse hors ligne (OfflineAudioContext). */
export const synth = {
  /** Claquement d'une pierre sur le bois. `variant` 0 à 3, `pitch` facteur de hauteur, `adverse` : plus sourd. */
  pose(a: Ctx, root: AudioNode, t: number, variant: number, pitch: number, adverse: boolean, pan: number): void {
    const c = CLAQUEMENTS[variant], amp = adverse ? 0.72 : 1, f = pitch * (adverse ? 0.94 : 1);
    const dest = out(a, root, pan, adverse ? 1700 : 12000);
    // 1. Le choc : bruit large bande, très bref (c'est lui qui rend le son « sec »), plus un souffle aigu.
    choc(a, dest, t, c.choc * f, 0.7, 1.1 * amp, 0.012);
    choc(a, dest, t, 6500, 0.7, 0.35 * amp, 0.006, 'highpass');
    // 2. Le bois qui répond : bruit filtré autour des deux premiers modes (Q moyen) = résonance « granuleuse », pas une note pure.
    choc(a, dest, t, c.modes[0][0] * f, 7, 1.5 * amp, 0.05);
    choc(a, dest, t, c.modes[1][0] * f, 8, 0.9 * amp, 0.035);
    // 3. Les modes eux-mêmes, courts et discrets, pour la hauteur du claquement.
    c.modes.forEach(([fm, am, tau], i) => mode(a, dest, t, fm * f, am * 0.5 * amp, tau * 0.55, i === 0 ? 1.018 : 1));
    // 4. Le plateau sonne creux sous la pierre : « toc » grave, bref.
    mode(a, dest, t, c.toc * f, 0.3 * amp, 0.015, 1.3);
  },
  capture(a: Ctx, root: AudioNode, t: number, n: number): void {
    const dest = out(a, root, (Math.random() - 0.5) * 0.2, 9000);
    const offsets = [0, 0.065, 0.1, 0.155];
    for (let i = 0; i < pileClicks(n); i++) clicSurLeTas(a, dest, t + offsets[i] + Math.random() * 0.012, 0.8 - i * 0.14);
  },
  atari(a: Ctx, root: AudioNode, t: number): void {
    const dest = out(a, root, 0, 2600);
    note(a, dest, t, 659.3, 0.11, 0.32, 'triangle');
    note(a, dest, t + 0.13, 830.6, 0.09, 0.4, 'triangle');
  },
  interdit(a: Ctx, root: AudioNode, t: number): void {
    // Assez haut pour sortir d'un haut-parleur de téléphone (peu de rendu sous 300 Hz), mais mat.
    const dest = out(a, root, 0, 1400);
    mode(a, dest, t, 250, 0.45, 0.026, 1.3);
    mode(a, dest, t, 505, 0.22, 0.016);
    mode(a, dest, t, 760, 0.09, 0.01);
    choc(a, dest, t, 620, 0.9, 0.4, 0.022);
  },
  victoire(a: Ctx, root: AudioNode, t: number): void {
    const dest = out(a, root, 0, 9000);
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => cloche(a, dest, t + i * 0.11 + (i === 3 ? 0.04 : 0), f, i === 3 ? 0.2 : 0.15));
  },
  reussite(a: Ctx, root: AudioNode, t: number): void {
    const dest = out(a, root, 0, 7000);
    mode(a, dest, t, 784, 0.2, 0.12); mode(a, dest, t, 784 * 3.9, 0.04, 0.02);
    mode(a, dest, t + 0.12, 1174.7, 0.22, 0.2); mode(a, dest, t + 0.12, 1174.7 * 3.9, 0.04, 0.025);
  },
  echec(a: Ctx, root: AudioNode, t: number): void {
    note(a, out(a, root, 0, 1800), t, 392, 0.14, 0.34, 'triangle', 311);
  },
};

// ---------- Sons du jeu ----------

function start(name: SoundName): AudioContext | null {
  const a = audio();
  // Un contexte encore « suspended » (reprise en cours dans ce même geste) joue dès qu'il repart.
  if (!a || !master || a.state === 'closed') return null;
  if (!shouldPlay(last, name, performance.now())) return null;
  return a;
}

/** Pose d'une pierre en `p` (plateau `size`). `adverse` : coup de l'ordi, plus sourd. */
export function playStone(p: number, size: number, adverse = false): void {
  const a = start(adverse ? 'poseAdverse' : 'pose');
  if (!a) return;
  let v = Math.floor(Math.random() * 4);
  if (v === lastVariant) v = (v + 1) % 4; // jamais deux fois le même claquement de suite
  lastVariant = v;
  synth.pose(a, master!, a.currentTime + 0.004, v, pitchFactor(Math.random()), adverse, panFor(p % size, size));
}
/** Pierres prises qui tombent sur le tas : 1, 2, ou 3 et plus. Suit le claquement de la pose. */
export function playCapture(n: number): void { const a = start('capture'); if (a) synth.capture(a, master!, a.currentTime + 0.09, n); }
/** Atari sur un de tes groupes : deux notes douces. */
export function playAtari(): void { const a = start('atari'); if (a) synth.atari(a, master!, a.currentTime + 0.1); }
/** Coup interdit : « tok » sourd. */
export function playIllegal(): void { const a = start('interdit'); if (a) synth.interdit(a, master!, a.currentTime + 0.004); }
/** Victoire : petit carillon montant. */
export function playVictory(): void { const a = start('victoire'); if (a) synth.victoire(a, master!, a.currentTime + 0.05); }
/** Problème ou exercice réussi : deux notes montantes (après le claquement de la pierre). */
export function playSuccess(): void { const a = start('reussite'); if (a) synth.reussite(a, master!, a.currentTime + 0.14); }
/** Problème ou exercice raté : une note qui descend. */
export function playFail(): void { const a = start('echec'); if (a) synth.echec(a, master!, a.currentTime + 0.14); }

