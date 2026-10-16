// Contexte audio des sons du goban (#563) : création au premier geste, mode silencieux de l'iPhone, réglage « Sons ».
// Léger : il reste dans le JS initial (settings.ts installe le déverrouillage au démarrage) ; la synthèse des sons
// (src/ui/sound.ts) arrive avec les écrans qui jouent un son.
// Le contexte audio est créé ou repris au premier geste (exigence des navigateurs, surtout Safari iOS).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

type Ctor = typeof AudioContext;
function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Contexte audio prêt à jouer, ou null (sons coupés, navigateur sans Web Audio, contexte encore bloqué). */
export function audio(): AudioContext | null {
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

/** Sortie commune des sons (gain et compresseur), créée avec le contexte. */
export function sortie(): GainNode | null { return master; }
