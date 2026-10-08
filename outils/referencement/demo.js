// Mini démo de capture des pages de référencement (#472) : trois défis sur un goban 9 × 9, sans le JS de l'app.
// Script classique, inliné (minifié) dans chaque page par outils/referencement/pages.ts. Le même fichier sert au build :
// pages.ts l'exécute dans Node (vm) pour dessiner le goban de la version sans JS avec `svgGoban`, et les tests y lisent
// les règles (`poser`, `groupe`). Coordonnées : index y * 9 + x (y depuis le haut), affichées A à J sans I, lignes
// numérotées depuis le bas (CLAUDE.md). Plateau : chaîne de 81 caractères, « . » vide, « b » noire, « w » blanche.
/* exported DEFIS, plateauDe, poser, groupe, nomPoint, indexDe, svgGoban */
const N = 9;
const LETTRES = 'ABCDEFGHJ';

/**
 * Défis : pierres noires et blanches, but (`capture` : prendre le groupe `cible` ; `sauver` : lui donner 2 libertés ou
 * plus), et le point clé (`cle`) : la bonne réponse, que Blanc joue si Noir se trompe.
 */
const DEFIS = [
  { noires: ['D5', 'F5', 'E6'], blanches: ['E5'], but: 'capture', cible: 'E5', cle: 'E4' },
  { noires: ['D5', 'E6', 'F6', 'G5', 'E4'], blanches: ['E5', 'F5'], but: 'capture', cible: 'E5', cle: 'F4' },
  { noires: ['E5'], blanches: ['D5', 'F5', 'E6'], but: 'sauver', cible: 'E5', cle: 'E4' },
];

/** Index d'un point affiché (`E5`). */
function indexDe(nom) {
  return (N - Number(nom.slice(1))) * N + LETTRES.indexOf(nom[0]);
}
/** Point affiché d'un index. */
function nomPoint(i) {
  return LETTRES[i % N] + (N - Math.floor(i / N));
}
function plateauDe(defi) {
  const p = [];
  for (let i = 0; i < N * N; i++) p.push('.');
  defi.noires.forEach(function (n) { p[indexDe(n)] = 'b'; });
  defi.blanches.forEach(function (n) { p[indexDe(n)] = 'w'; });
  return p.join('');
}
function voisins(i) {
  const x = i % N, y = Math.floor(i / N), v = [];
  if (x > 0) v.push(i - 1);
  if (x < N - 1) v.push(i + 1);
  if (y > 0) v.push(i - N);
  if (y < N - 1) v.push(i + N);
  return v;
}
/** Groupe de la pierre en `i` : ses pierres et ses libertés (index triés). */
function groupe(p, i) {
  const c = p[i], pile = [i], vus = {}, pierres = [], libs = {};
  vus[i] = true;
  while (pile.length) {
    const j = pile.pop();
    pierres.push(j);
    voisins(j).forEach(function (k) {
      if (p[k] === '.') libs[k] = true;
      else if (p[k] === c && !vus[k]) { vus[k] = true; pile.push(k); }
    });
  }
  const num = function (a, b) { return a - b; };
  return { pierres: pierres.sort(num), libertes: Object.keys(libs).map(Number).sort(num) };
}
/**
 * Pose une pierre `c` en `i`. Rend { plateau, prises } ou { erreur: 'occupe' | 'suicide' }. Les groupes adverses sans
 * liberté sont retirés d'abord ; un coup qui laisse son propre groupe sans liberté est interdit (suicide).
 */
function poser(p, i, c) {
  if (p[i] !== '.') return { erreur: 'occupe' };
  const t = p.split('');
  t[i] = c;
  const autre = c === 'b' ? 'w' : 'b', prises = [];
  voisins(i).forEach(function (k) {
    if (t[k] !== autre) return;
    const g = groupe(t.join(''), k);
    if (g.libertes.length === 0) g.pierres.forEach(function (s) { t[s] = '.'; prises.push(s); });
  });
  const q = t.join('');
  if (groupe(q, i).libertes.length === 0) return { erreur: 'suicide' };
  return { plateau: q, prises: prises };
}

/** Goban en SVG (décoratif : les boutons portent les noms des points). `marques` : points entourés en pointillé. */
function svgGoban(p, o) {
  o = o || {};
  const S = 40, O = 40, F = O + S * (N - 1);
  let s = '';
  s += '<svg class="goban-svg" viewBox="0 0 380 380" aria-hidden="true" focusable="false">';
  s += '<defs><radialGradient id="pn" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="#6a6e6c"/><stop offset=".22" stop-color="#2e3130"/><stop offset=".6" stop-color="#151716"/><stop offset="1" stop-color="#050606"/></radialGradient>';
  s += '<radialGradient id="pb" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#F3EEE3"/><stop offset=".85" stop-color="#DDD5C4"/><stop offset="1" stop-color="#BDB3A0"/></radialGradient></defs>';
  s += '<rect width="380" height="380" rx="10" fill="#EDC27A"/>';
  let d = '';
  for (let k = 0; k < N; k++) {
    const c = O + k * S;
    d += 'M' + O + ' ' + c + 'H' + F + 'M' + c + ' ' + O + 'V' + F;
  }
  s += '<path d="' + d + '" stroke="#3A2912" stroke-width="1.6" fill="none"/>';
  s += '<g fill="#3A2912">';
  [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]].forEach(function (h) { s += '<circle cx="' + (O + h[0] * S) + '" cy="' + (O + h[1] * S) + '" r="4"/>'; });
  s += '</g><g fill="#3A2912" font-size="14" font-family="system-ui,sans-serif" text-anchor="middle">';
  for (let l = 0; l < N; l++) {
    s += '<text x="' + (O + l * S) + '" y="20">' + LETTRES[l] + '</text>';
    s += '<text x="15" y="' + (O + l * S + 5) + '">' + (N - l) + '</text>';
  }
  s += '</g>';
  for (let i = 0; i < N * N; i++) {
    if (p[i] === '.') continue;
    const cx = O + (i % N) * S, cy = O + Math.floor(i / N) * S;
    s += '<circle class="pierre" data-point="' + nomPoint(i) + '" data-couleur="' + p[i] + '" cx="' + cx + '" cy="' + cy + '" r="18.5" fill="url(#' + (p[i] === 'b' ? 'pn' : 'pb') + ')"/>';
    if (o.dernier === i) s += '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="none" stroke="' + (p[i] === 'b' ? '#F3EDE3' : '#1C1916') + '" stroke-width="2.5"/>';
  }
  (o.marques || []).forEach(function (m) {
    s += '<circle class="marque" cx="' + (O + (m % N) * S) + '" cy="' + (O + Math.floor(m / N) * S) + '" r="14" fill="none" stroke="#07231A" stroke-width="3" stroke-dasharray="5 4"/>';
  });
  return s + '</svg>';
}

/** Démo interactive : remplace la figure sans JS. Textes de la page dans `#demo-textes` (JSON). */
function demarrer() {
  const racine = document.getElementById('demo');
  const donnees = document.getElementById('demo-textes');
  if (!racine || !donnees) return;
  const T = JSON.parse(donnees.textContent);
  const dessin = racine.querySelector('.goban-dessin');
  const grille = racine.querySelector('.goban-points');
  const titre = racine.querySelector('.demo-defi');
  const consigne = racine.querySelector('.demo-consigne');
  const statut = racine.querySelector('.demo-statut');
  const actions = racine.querySelector('.demo-actions');
  const reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boutons = [];
  let n = 0, plateau = '', etat = 'jeu', focus = indexDe('E5'), attente = 0;
  const dire = function (gabarit, v) { return gabarit.replace(/\{(\w+)\}/g, function (_t, k) { return v[k]; }); };

  for (let i = 0; i < N * N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'point';
    b.style.left = ((40 + (i % N) * 40 - 20) / 3.8) + '%';
    b.style.top = ((40 + Math.floor(i / N) * 40 - 20) / 3.8) + '%';
    b.dataset.i = String(i);
    grille.appendChild(b);
    boutons.push(b);
  }

  function rendre(dernier, annonce) {
    dessin.innerHTML = svgGoban(plateau, { dernier: dernier });
    boutons.forEach(function (b, i) {
      const c = plateau[i];
      b.setAttribute('aria-label', nomPoint(i) + ', ' + (c === 'b' ? T.noire : c === 'w' ? T.blanche : T.vide));
      b.tabIndex = i === focus ? 0 : -1;
      b.setAttribute('aria-disabled', etat === 'jeu' ? 'false' : 'true');
    });
    racine.setAttribute('data-etat', etat);
    if (annonce !== undefined) statut.textContent = annonce;
  }
  function bouton(texte, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondaire';
    b.textContent = texte;
    b.addEventListener('click', action);
    actions.appendChild(b);
    return b;
  }
  function charger(k) {
    clearTimeout(attente);
    n = k;
    etat = 'jeu';
    plateau = plateauDe(DEFIS[n]);
    const d = T.defis[n];
    titre.textContent = dire(T.etape, { i: n + 1, n: DEFIS.length }) + ' · ' + d.titre;
    consigne.textContent = d.consigne;
    actions.textContent = '';
    rendre(undefined, '');
  }
  function terminer(texte, reussi) {
    statut.textContent = texte;
    actions.textContent = '';
    let b;
    if (!reussi) b = bouton(T.reessayer, function () { charger(n); boutons[focus].focus(); });
    else if (n < DEFIS.length - 1) b = bouton(T.suivant, function () { charger(n + 1); boutons[focus].focus(); });
    else {
      const fin = document.createElement('p');
      fin.className = 'demo-fin';
      fin.textContent = T.fin;
      actions.appendChild(fin);
      b = bouton(T.recommencer, function () { charger(0); boutons[focus].focus(); });
    }
    return b;
  }
  function jouer(i) {
    if (etat !== 'jeu') return;
    const defi = DEFIS[n], r = poser(plateau, i, 'b');
    if (r.erreur) { statut.textContent = T[r.erreur]; return; }
    plateau = r.plateau;
    const cible = indexDe(defi.cible);
    const reussi = defi.but === 'capture' ? plateau[cible] === '.' : groupe(plateau, cible).libertes.length >= 2;
    if (reussi) {
      etat = 'gagne';
      rendre(i);
      terminer(dire(T.defis[n].bravo, { n: groupe(plateau, cible).libertes.length }), true);
      return;
    }
    etat = 'attente';
    rendre(i, dire(T.joue, { p: nomPoint(i) }));
    attente = setTimeout(function () {
      const cle = indexDe(defi.cle), rb = poser(plateau, cle, 'w');
      etat = 'rate';
      let texte;
      if (rb.erreur) texte = T.rate;
      else {
        plateau = rb.plateau;
        texte = defi.but === 'capture'
          ? dire(T.echappe, { p: defi.cle, n: groupe(plateau, cible).libertes.length })
          : dire(T.prise, { p: defi.cle });
      }
      rendre(rb.erreur ? i : cle);
      terminer(texte, false);
    }, reduit ? 0 : 500);
  }

  grille.addEventListener('click', function (e) {
    const b = e.target.closest('.point');
    if (!b) return;
    focus = Number(b.dataset.i);
    boutons.forEach(function (x, k) { x.tabIndex = k === focus ? 0 : -1; });
    jouer(focus);
  });
  // Le point qui reçoit le focus (Tab, toucher, lecteur d'écran) devient le point de départ des flèches.
  grille.addEventListener('focusin', function (e) {
    const b = e.target.closest('.point');
    if (!b) return;
    focus = Number(b.dataset.i);
    boutons.forEach(function (x, k) { x.tabIndex = k === focus ? 0 : -1; });
  });
  grille.addEventListener('keydown', function (e) {
    let x = focus % N, y = Math.floor(focus / N);
    if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
    else if (e.key === 'ArrowRight') x = Math.min(N - 1, x + 1);
    else if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
    else if (e.key === 'ArrowDown') y = Math.min(N - 1, y + 1);
    else return;
    e.preventDefault();
    boutons[focus].tabIndex = -1;
    focus = y * N + x;
    boutons[focus].tabIndex = 0;
    boutons[focus].focus();
  });
  grille.setAttribute('aria-label', T.goban);
  racine.classList.add('pret');
  charger(0);
}

if (typeof document !== 'undefined') demarrer();
