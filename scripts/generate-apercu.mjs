// Génère les images d'aperçu des liens partagés (1200 × 630, Open Graph) : public/apercu.png (Go du jour, issue #285)
// et, depuis #364, ses variantes anglaise, défi par lien et partie partagée (pages d'aperçu : outils/apercus.ts).
// Même approche que scripts/generate-icons.mjs : le Chromium de Playwright, aucune dépendance image en plus.
// Logo à deux pierres (public/icon.svg), goban décoratif (aucun vrai problème : pas de spoiler) et phrase d'accroche,
// aux couleurs Encre & Jade (src/ui/tokens.css). Textes en grand : l'aperçu WhatsApp fait environ 300 px de large.
// Depuis #489, l'aperçu de l'accueil et des pages de référencement (apercu-accueil, apercu-accueil-en) : la promesse
// générale (apprendre en jouant, débutants bienvenus, gratuit) et Mochi, le coach, avec son sceau jade (src/ui/Sceau.tsx)
// et une bulle, comme sur l'accueil de l'app (skill personnages-go : un seul personnage, aucun texte dans l'illustration).
// Usage : node scripts/generate-apercu.mjs [nom…]   (sans nom : toutes ; ex. `apercu-defi apercu-defi-en`)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const W = 1200;
const H = 630;

const logo = (await readFile(`${root}public/icon.svg`, 'utf8')).replace('<svg ', '<svg class="logo" ');
async function police(chemin) {
  return (await readFile(`${root}node_modules/${chemin}`)).toString('base64');
}
const titre = await police('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2');
const texte = await police('@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-700-normal.woff2');

// Goban 9 × 9 décoratif, dessiné en perspective légère à droite. `pierres` : [couleur, x, y] ; `cible` : anneau jade.
const N = 9;
const pas = 50;
const marge = 30;
const cote = marge * 2 + pas * (N - 1);
const lignes = [];
for (let i = 0; i < N; i++) {
  const p = marge + i * pas;
  lignes.push(`M${marge} ${p}H${marge + pas * (N - 1)}M${p} ${marge}V${marge + pas * (N - 1)}`);
}
const hoshi = [
  [2, 2], [6, 2], [4, 4], [2, 6], [6, 6],
].map(([x, y]) => `<circle cx="${marge + x * pas}" cy="${marge + y * pas}" r="5" fill="#3A2912"/>`).join('');
function goban(pierres, cible) {
  const dessin = pierres.map(([c, x, y]) => {
    const cx = marge + x * pas;
    const cy = marge + y * pas;
    return `<circle cx="${cx + 3}" cy="${cy + 5}" r="23" fill="rgba(0,0,0,.35)"/><circle cx="${cx}" cy="${cy}" r="23" fill="url(#${c})"/>`;
  }).join('');
  const anneau = cible ? `<circle cx="${marge + cible[0] * pas}" cy="${marge + cible[1] * pas}" r="19" fill="none" stroke="#3CC48E" stroke-width="6"/>` : '';
  return `<svg class="goban" viewBox="0 0 ${cote} ${cote}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="n" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="#6a6e6c"/><stop offset=".22" stop-color="#2e3130"/><stop offset=".6" stop-color="#151716"/><stop offset="1" stop-color="#050606"/></radialGradient>
    <radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#F3EEE3"/><stop offset=".85" stop-color="#DDD5C4"/><stop offset="1" stop-color="#BDB3A0"/></radialGradient>
    <linearGradient id="k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDC27A"/><stop offset="1" stop-color="#C58D42"/></linearGradient>
  </defs>
  <rect width="${cote}" height="${cote}" rx="14" fill="url(#k)"/>
  <path d="${lignes.join('')}" stroke="#3A2912" stroke-width="2.4"/>
  ${hoshi}${dessin}${anneau}
</svg>`;
}

// Go du jour : position de début de partie, sans enjeu tactique, et le coup à trouver (un anneau jade sur un point vide).
const DEBUT = [['n', 2, 2], ['b', 6, 2], ['n', 6, 6], ['b', 2, 6], ['n', 4, 3], ['b', 5, 4]];
// Défi : deux pierres face à face, au centre. Partie partagée : une fin de partie décorative, dernier coup cerclé.
const FACE = [['n', 3, 4], ['b', 5, 4]];
const FIN = [['n', 2, 2], ['b', 6, 2], ['n', 6, 6], ['b', 2, 6], ['n', 4, 3], ['b', 5, 4], ['n', 3, 5], ['b', 5, 6], ['n', 4, 5],
  ['b', 6, 4], ['n', 2, 4], ['b', 4, 7], ['n', 3, 6], ['b', 7, 5]];

// Mochi : son sceau jade, mêmes tracés que src/ui/Sceau.tsx (grille 100 × 100, texture de tampon légère).
const PAPIER = '#F7E9DA';
const mochi = `<svg class="mochi" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mochi">
  <defs><filter id="tampon" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="13"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></defs>
  <g filter="url(#tampon)">
    <rect x="6" y="6" width="88" height="88" rx="22" fill="#3CC48E"/>
    <rect x="12" y="12" width="76" height="76" rx="17" fill="none" stroke="${PAPIER}" stroke-width="2.2" opacity=".85"/>
    <ellipse cx="50" cy="56" rx="26" ry="20" fill="${PAPIER}"/><path d="M28 44 32 28l10 12M72 44l-4-16-10 12" fill="${PAPIER}"/>
    <circle cx="41" cy="54" r="3" fill="#1E8A5F"/><circle cx="59" cy="54" r="3" fill="#1E8A5F"/>
    <path d="M46 62q4 3 8 0" stroke="#1E8A5F" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
// Accueil : un début de partie calme, sans anneau (aucune question posée).
const ACCUEIL = [['n', 2, 2], ['b', 6, 2], ['n', 6, 6], ['b', 2, 6], ['n', 4, 4]];

const VARIANTES = {
  'apercu-accueil': { lang: 'fr', h1: 'Apprends le go <em>en jouant</em>', p: 'Gratuit, sans pub.<br>Ta première pierre en 1 minute.', pierres: ACCUEIL, bulle: 'Débutants bienvenus !' },
  'apercu-accueil-en': { lang: 'en', h1: 'Learn Go <em>by playing</em>', p: 'Free, no ads.<br>Your first stone in 1 minute.', pierres: ACCUEIL, bulle: 'Beginners welcome!' },
  apercu: { lang: 'fr', h1: 'Trouveras-tu <em>le bon coup ?</em>', p: 'Un défi par jour. Gratuit, sans compte.', pastille: 'Joue en 1 minute', pierres: DEBUT, cible: [4, 5] },
  'apercu-en': { lang: 'en', h1: 'Can you find <em>the right move?</em>', p: 'One puzzle a day. Free, no account.', pastille: 'Play in 1 minute', pierres: DEBUT, cible: [4, 5] },
  'apercu-defi': { lang: 'fr', h1: 'Un ami te <em>défie au go</em>', p: 'Partie 9 × 9, 3 jours par coup. Gratuit.', pastille: 'Joue ton premier coup', pierres: FACE },
  'apercu-defi-en': { lang: 'en', h1: 'A friend <em>challenges you</em>', p: '9 × 9 game, 3 days per move. Free.', pastille: 'Play your first move', pierres: FACE },
  'apercu-partie': { lang: 'fr', h1: 'Une partie <em>à revoir</em>', p: 'Coup par coup, sans compte. Gratuit.', pastille: 'Ouvre la revue', pierres: FIN, cible: [4, 5] },
  'apercu-partie-en': { lang: 'en', h1: 'A game <em>to replay</em>', p: 'Move by move, no account. Free.', pastille: 'Open the review', pierres: FIN, cible: [4, 5] },
};

const page = (v) => `<!doctype html><html lang="${v.lang}"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Bricolage'; src: url(data:font/woff2;base64,${titre}) format('woff2'); font-weight: 200 800; }
@font-face { font-family: 'Zen'; src: url(data:font/woff2;base64,${texte}) format('woff2'); font-weight: 700; }
html, body { margin: 0; }
body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative; color: #F3EDE3;
  background: radial-gradient(900px 520px at 78% -10%, rgba(239,184,74,.22), rgba(239,184,74,0) 70%), #1C1916; }
.gauche { position: absolute; left: 72px; top: 64px; width: 600px; }
.marque { display: flex; align-items: center; gap: 22px; font: 800 44px/1 'Bricolage', sans-serif; letter-spacing: -.5px; }
.logo { width: 92px; height: 92px; border-radius: 22px; box-shadow: 0 10px 24px -10px rgba(0,0,0,.8); }
h1 { margin: ${v.bulle ? 44 : 58}px 0 0; font: 800 76px/1.02 'Bricolage', sans-serif; letter-spacing: -1.5px; }
h1 em { font-style: normal; color: #3CC48E; }
p { margin: ${v.bulle ? 22 : 30}px 0 0; font: 700 32px/1.3 'Zen', sans-serif; color: #EFE8DC; }
.pastille { display: inline-block; margin-top: 34px; padding: 14px 30px; border-radius: 16px; background: #3CC48E; color: #07231A;
  font: 800 32px/1 'Bricolage', sans-serif; box-shadow: 0 6px 0 #1E8A5F; }
.goban { position: absolute; right: 64px; top: 75px; width: 480px; height: 480px;
  filter: drop-shadow(0 26px 30px rgba(0,0,0,.6)); }
.coach { display: flex; align-items: center; gap: 22px; margin-top: 30px; }
.mochi { width: 116px; height: 116px; flex: none; filter: drop-shadow(0 12px 18px rgba(0,0,0,.55)); }
.bulle { position: relative; padding: 16px 24px; border-radius: 22px; background: #FBF8F2; color: #1C1916;
  font: 800 30px/1.1 'Bricolage', sans-serif; letter-spacing: -.3px; box-shadow: 0 12px 24px -10px rgba(0,0,0,.6); white-space: nowrap; }
.bulle::after { content: ''; position: absolute; left: -12px; top: 50%; margin-top: -12px; border: 12px solid transparent; border-left: 0; border-right-color: #FBF8F2; }
</style></head><body>
<div class="gauche">
  <div class="marque">${logo}<span>Mochi Go</span></div>
  <h1>${v.h1}</h1>
  <p>${v.p}</p>
  ${v.bulle ? `<div class="coach">${mochi}<span class="bulle">${v.bulle}</span></div>` : `<span class="pastille">${v.pastille}</span>`}
</div>
${goban(v.pierres, v.cible)}
</body></html>`;

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const onglet = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const noms = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTES);
for (const nom of noms) {
  const v = VARIANTES[nom];
  if (!v) throw new Error(`Variante inconnue : ${nom}`);
  await onglet.setContent(page(v));
  await onglet.evaluate(() => document.fonts.ready);
  await onglet.screenshot({ path: `${root}public/${nom}.png`, omitBackground: false });
  console.log(`public/${nom}.png`);
}
await browser.close();
