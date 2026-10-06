// Image du moment clé (#364) : 1200 × 630 (format des aperçus), dessinée sur l'appareil, sans serveur.
// Le plateau au coup du moment clé (dernier coup cerclé de jade), le résultat, les deux camps (pseudo du joueur ou
// « Noir » / « Blanc », nom de l'adversaire de l'échelle ou pseudo de l'ami) et la marque Mochi Go.
// Aucune autre donnée : ni date, ni cote, ni identifiant. Couleurs Encre & Jade (src/ui/tokens.css), comme
// public/apercu.png (scripts/generate-apercu.mjs). Textes en grand : l'aperçu d'une messagerie fait ≈ 300 px de large.
import { hoshi } from '../ui/boardArt';
import type { Langue } from '../content/i18n';
import { traduirePartage } from '../content/i18n/partage';

export const LARGEUR = 1200;
export const HAUTEUR = 630;

const ENCRE = '#1C1916', PAPIER = '#F3EDE3', SABLE = '#EFE8DC', JADE = '#3CC48E', OR = '#EFB84A', LIGNE = '#3A2912';
const TITRE = '"Bricolage Grotesque", "Zen Kaku Gothic New", system-ui, sans-serif';
const TEXTE = '"Zen Kaku Gothic New", system-ui, sans-serif';

export interface DonneesImage {
  size: number;
  /** Plateau au moment clé : 0 vide, 1 Noir, 2 Blanc ; index `y * size + x`. */
  board: ArrayLike<number>;
  /** Dernier coup joué (cerclé), -1 ou null : aucun. */
  dernier: number | null;
  /** Numéro du coup montré (0 : fin de partie montrée sans moment clé). */
  coup: number;
  /** Résultat SGF (`B+6.5`, `W+R`…). */
  resultat?: string;
  noir: string;
  blanc: string;
  langue: Langue;
}

/** Phrase du résultat : « Noir gagne de 6,5 points », « Blanc gagne par abandon », « Égalité »… */
export function texteResultat(re: string | undefined, l: Langue): string {
  const t = (c: Parameters<typeof traduirePartage>[1], v?: Record<string, string | number>) => traduirePartage(l, c, v);
  const m = /^([BW])\+(.+)$/.exec(re?.trim() ?? '');
  if (!m) return re?.trim() === '0' ? t('image.egalite') : t('image.enCours');
  const camp = t(m[1] === 'B' ? 'image.noir' : 'image.blanc');
  const v = m[2];
  if (/^R/i.test(v)) return t('image.abandon', { camp });
  if (/^T/i.test(v)) return t('image.temps', { camp });
  if (/^F/i.test(v)) return t('image.forfait', { camp });
  const n = Number(v);
  if (!Number.isFinite(n)) return t('image.enCours');
  const nombre = l === 'fr' ? String(n).replace('.', ',') : String(n);
  // Singulier sous 2 en français (« 1,5 point »), seulement pour 1 en anglais (« 1.5 points »).
  return t((l === 'fr' ? n < 2 : n === 1) ? 'image.point' : 'image.points', { camp, n: nombre });
}

/** Coupe un texte en lignes qui tiennent dans `largeur` (au plus `max` lignes, la dernière abrégée). */
export function couper(mesurer: (s: string) => number, texte: string, largeur: number, max = 2): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let cur = '';
  for (const m of mots) {
    const essai = cur ? `${cur} ${m}` : m;
    if (mesurer(essai) <= largeur || !cur) cur = essai;
    else { lignes.push(cur); cur = m; }
  }
  if (cur) lignes.push(cur);
  if (lignes.length <= max) return lignes;
  const garde = lignes.slice(0, max);
  let der = `${garde[max - 1]}…`;
  while (der.length > 1 && mesurer(der) > largeur) der = `${der.slice(0, -2)}…`;
  garde[max - 1] = der;
  return garde;
}

function pierre(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: 1 | 2) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.arc(x + r * 0.08, y + r * 0.14, r, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1);
  if (c === 1) { g.addColorStop(0, '#6a6e6c'); g.addColorStop(0.25, '#2e3130'); g.addColorStop(0.65, '#151716'); g.addColorStop(1, '#050606'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#F3EEE3'); g.addColorStop(0.85, '#DDD5C4'); g.addColorStop(1, '#BDB3A0'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Logo deux pierres (public/icon.svg), redessiné : aucune image à charger. */
function logo(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const k = t / 512;
  ctx.save();
  ctx.fillStyle = '#2A2521';
  ctx.beginPath(); ctx.roundRect?.(x, y, t, t, t * 0.22); if (!ctx.roundRect) ctx.rect(x, y, t, t); ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(237,194,122,.13)'; ctx.lineWidth = 5 * k;
  ctx.beginPath();
  for (const v of [166, 256, 346]) { ctx.moveTo(x, y + v * k); ctx.lineTo(x + t, y + v * k); ctx.moveTo(x + v * k, y); ctx.lineTo(x + v * k, y + t); }
  ctx.stroke();
  pierre(ctx, x + 306 * k, y + 226 * k, 92 * k, 2);
  ctx.fillStyle = '#2A2521';
  ctx.beginPath(); ctx.arc(x + 210 * k, y + 292 * k, 106 * k, 0, Math.PI * 2); ctx.fill();
  pierre(ctx, x + 210 * k, y + 292 * k, 100 * k, 1);
  ctx.restore();
}

/** Dessine l'image entière dans `ctx` (1200 × 630). */
export function dessinerImage(ctx: CanvasRenderingContext2D, d: DonneesImage): void {
  const t = (c: Parameters<typeof traduirePartage>[1], v?: Record<string, string | number>) => traduirePartage(d.langue, c, v);
  // Fond : encre, halo doré en haut à droite.
  ctx.fillStyle = ENCRE;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  const halo = ctx.createRadialGradient(940, -60, 20, 940, -60, 620);
  halo.addColorStop(0, 'rgba(239,184,74,.24)');
  halo.addColorStop(1, 'rgba(239,184,74,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Plateau à droite : carré de 540 px.
  const cote = 540, bx = LARGEUR - cote - 45, by = (HAUTEUR - cote) / 2;
  const n = d.size, marge = cote * (n === 19 ? 0.045 : 0.07), pas = (cote - 2 * marge) / (n - 1);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
  const bois = ctx.createLinearGradient(bx, by, bx + cote, by + cote);
  bois.addColorStop(0, '#EDC27A'); bois.addColorStop(1, '#C58D42');
  ctx.fillStyle = bois;
  ctx.beginPath(); ctx.roundRect?.(bx, by, cote, cote, 14); if (!ctx.roundRect) ctx.rect(bx, by, cote, cote); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = LIGNE; ctx.lineWidth = n === 19 ? 1.4 : 2.2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = Math.round(marge + i * pas) + 0.5;
    ctx.moveTo(bx + marge, by + p); ctx.lineTo(bx + cote - marge, by + p);
    ctx.moveTo(bx + p, by + marge); ctx.lineTo(bx + p, by + cote - marge);
  }
  ctx.stroke();
  ctx.fillStyle = LIGNE;
  for (const h of hoshi(n)) {
    ctx.beginPath(); ctx.arc(bx + marge + (h % n) * pas, by + marge + Math.floor(h / n) * pas, n === 19 ? 3.5 : 5, 0, Math.PI * 2); ctx.fill();
  }
  const r = pas * 0.47;
  for (let p = 0; p < n * n; p++) {
    const c = d.board[p];
    if (c === 1 || c === 2) pierre(ctx, bx + marge + (p % n) * pas, by + marge + Math.floor(p / n) * pas, r, c);
  }
  if (d.dernier != null && d.dernier >= 0) {
    ctx.strokeStyle = JADE; ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.beginPath(); ctx.arc(bx + marge + (d.dernier % n) * pas, by + marge + Math.floor(d.dernier / n) * pas, r * 0.55, 0, Math.PI * 2); ctx.stroke();
  }

  // Colonne de gauche.
  const gx = 64, lg = bx - gx - 48;
  logo(ctx, gx, 56, 72);
  ctx.fillStyle = PAPIER; ctx.textBaseline = 'middle';
  ctx.font = `800 40px ${TITRE}`;
  ctx.fillText('Mochi Go', gx + 92, 92);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = JADE; ctx.font = `800 30px ${TITRE}`;
  ctx.fillText(d.coup > 0 ? t('image.cle', { coup: d.coup }) : t('image.fin'), gx, 214);

  ctx.fillStyle = PAPIER; ctx.font = `800 54px ${TITRE}`;
  const lignes = couper(s => ctx.measureText(s).width, texteResultat(d.resultat, d.langue), lg, 2);
  lignes.forEach((l, i) => ctx.fillText(l, gx, 280 + i * 60));

  // Les deux camps : pierre et nom.
  ctx.font = `700 30px ${TEXTE}`;
  const camps: [1 | 2, string][] = [[1, d.noir], [2, d.blanc]];
  camps.forEach(([c, nom], i) => {
    const y = 420 + i * 56;
    pierre(ctx, gx + 16, y - 10, 16, c);
    ctx.fillStyle = SABLE;
    ctx.fillText(couper(s => ctx.measureText(s).width, nom, lg - 48, 1)[0] ?? '', gx + 48, y);
  });

  ctx.fillStyle = OR; ctx.font = `700 26px ${TEXTE}`;
  ctx.fillText(t('image.appel'), gx, 572);
}

/** Image PNG du moment clé, prête à partager. Rejette si le navigateur ne sait pas dessiner (très vieux appareil). */
export async function creerImage(d: DonneesImage): Promise<Blob> {
  // Les polices de l'app ne sont téléchargées qu'une fois demandées : on les demande avant de dessiner.
  try {
    await Promise.all([document.fonts?.load(`800 40px ${TITRE}`), document.fonts?.load(`700 30px ${TEXTE}`)]);
  } catch { /* polices de repli */ }
  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR; canvas.height = HAUTEUR;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  dessinerImage(ctx, d);
  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('toBlob'))), 'image/png'));
}
