// « Partager pour recruter » (#364) : partie réduite au partage, liens courts, noms de fichiers, et la remise en forme
// de l'adresse faite par index.html (`adresseCourte`).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSgf } from '../go/sgf';
import {
  adversairePublic, jetonPartieDeLAdresse, lienPartie, nomFichierImage, nomFichierSgf, originePartage, partageable, resultatPublic,
  sgfAvecCamps, sgfPublic, SITE,
} from './partage';
import { prendreJetonPartie } from './adressePartie';
import { nettoyerUrl } from '../data/urlSensible';
import { jetonDeLAdresse, jetonDepuisLien, lienDefi } from '../data/defi';
import { textePartage } from './goDuJour';
import { choisirLangue } from '../content/i18n';

const racine = new URL('../../', import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, racine), 'utf8');
const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

// Contrôle du serveur (`sgf_partageable`, migration 20261005213100) : même expression, relue dans la migration.
const migration = lire('supabase/migrations/20261005213100_parties_partagees.sql');
const motif = /regexp_replace\(p_sgf,\s*'([^']+)'\s*\|\|\s*'([^']+)',/.exec(migration);
const proprietes = new RegExp(motif![1] + motif![2], 'g');
const sgfAccepteParLeServeur = (s: string) => /^\(;/.test(s) && new TextEncoder().encode(s).length <= 16384
  && /^[();\s]*$/.test(s.replace(proprietes, ''));

// Remise en forme de l'adresse, en ligne dans index.html (avant tout le reste).
const html = lire('index.html');
const source = html.match(/function adresseCourte\(chemin, recherche, fragment\) \{[\s\S]*?\n {6}\}/)?.[0];
const adresseCourte = new Function(`${source}; return adresseCourte;`)() as (c: string, r: string, f: string) => string | null;

describe('partie réduite au partage (sgfPublic)', () => {
  const brut = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Jean Dupont]PW[Pomme]DT[2026-10-05]PC[Paris]RE[B+Resign]'
    + 'C[mon numéro : 06 12 34 56 78];B[ee]C[joli];W[cc];B[];W[tt])';

  it('ne garde que la partie : ni noms, ni commentaires, ni date, ni lieu', () => {
    const { sgf, taille, coups } = sgfPublic(brut);
    expect(sgf).toBe('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[B+R];B[ee];W[cc];B[tt];W[tt])');
    expect(taille).toBe(9);
    expect(coups).toBe(4);
    expect(sgf).not.toMatch(/Jean|Pomme|06 12|Paris|2026|joli/);
  });

  it('se relit en la même partie (coups, komi, résultat)', () => {
    const a = readSgf(brut), b = readSgf(sgfPublic(brut).sgf);
    expect(b.moves).toEqual(a.moves);
    expect(b.komi).toBe(a.komi);
    expect(b.size).toBe(a.size);
  });

  it('garde handicap, pierres posées et premier joueur ; règles chinoises', () => {
    const { sgf } = sgfPublic('(;GM[1]SZ[13]KM[0.5]RU[Chinese]HA[2]AB[dd][jj]PL[W];W[gg])');
    expect(sgf).toBe('(;GM[1]FF[4]CA[UTF-8]SZ[13]KM[0.5]RU[Chinese]HA[2]AB[dd][jj]PL[W];W[gg])');
  });

  it('résultats normalisés ; illisible : absent', () => {
    expect(resultatPublic('W+12.5')).toBe('W+12.5');
    expect(resultatPublic('b+time')).toBe('B+T');
    expect(resultatPublic('B+Forfeit')).toBe('B+F');
    expect(resultatPublic('Draw')).toBe('0');
    expect(resultatPublic('Void')).toBeUndefined();
    expect(resultatPublic('B+beaucoup')).toBeUndefined();
    expect(sgfPublic('(;SZ[9]RE[Jean])').sgf).not.toContain('RE[');
  });

  it('ce que produit l’app, le serveur l’accepte ; un SGF avec un nom ou un commentaire, il le refuse', () => {
    for (const s of [brut, '(;GM[1]SZ[13]KM[0.5]RU[Chinese]HA[2]AB[dd][jj]PL[W];W[gg])', '(;SZ[19]KM[7];B[pd];W[dp];B[tt]RE[W+0.5])',
      '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Toi]PW[Pomme]RE[B+1.5];B[cg];W[gc];B[tt];W[tt])']) {
      expect(sgfAccepteParLeServeur(sgfPublic(s).sgf), s).toBe(true);
    }
    expect(sgfAccepteParLeServeur(brut)).toBe(false);
    expect(sgfAccepteParLeServeur('(;GM[1]FF[4]SZ[9];B[ee]C[salut])')).toBe(false);
    expect(sgfAccepteParLeServeur(sgfAvecCamps(sgfPublic(brut).sgf, { noir: 'Ana', blanc: 'Tigre' }))).toBe(false);
  });

  it('taille plafonnée comme au serveur', () => {
    expect(partageable(sgfPublic(brut).sgf)).toBe(true);
    expect(partageable(`(;SZ[19]${';B[aa]'.repeat(3000)})`)).toBe(false);
  });

  it('fichier téléchargé : la partie et le nom des deux camps, échappés', () => {
    const s = sgfAvecCamps('(;GM[1]FF[4]SZ[9];B[ee])', { noir: 'Ana', blanc: 'A]b' });
    expect(s).toBe('(;GM[1]PB[Ana]PW[A\\]b]FF[4]SZ[9];B[ee])');
    expect(readSgf(s).white).toBe('A]b');
  });
});

describe('noms et adversaire', () => {
  it('fichier : adversaire-date, sans accent ni espace', () => {
    const d = new Date(2026, 9, 5, 12);
    expect(nomFichierSgf('Tigre', d)).toBe('tigre-2026-10-05.sgf');
    expect(nomFichierSgf('Éléphant de mer', d)).toBe('elephant-de-mer-2026-10-05.sgf');
    expect(nomFichierSgf(undefined, d)).toBe('partie-2026-10-05.sgf');
    expect(nomFichierSgf('../../etc', d)).toBe('etc-2026-10-05.sgf');
    expect(nomFichierImage('Tigre', d)).toBe('tigre-2026-10-05.png');
  });

  it('adversaire publiable : nom de l’échelle ou pseudo, rien d’autre', () => {
    expect(adversairePublic('Tigre')).toBe('Tigre');
    expect(adversairePublic('Flo_rian')).toBe('Flo_rian');
    expect(adversairePublic('partie-ogs-12345.sgf')).toBe('partie-ogs-12345.sgf');
    expect(adversairePublic('<script>')).toBeNull();
    expect(adversairePublic('x'.repeat(25))).toBeNull();
    expect(adversairePublic('')).toBeNull();
  });
});

describe('liens courts', () => {
  it('partie : le jeton dans le fragment, jamais envoyé au serveur ni à la mesure', () => {
    const lien = lienPartie(JETON, 'fr', SITE);
    expect(lien).toBe(`https://mochi-go.app/partie#${JETON}`);
    expect(lienPartie(JETON, 'en', SITE)).toBe(`https://mochi-go.app/en/partie#${JETON}`);
    expect(nettoyerUrl(lien)).toBe('https://mochi-go.app/partie');
  });

  it('origine : l’adresse publique sur mochi-go.app, sinon l’origine courante (préversions, tests)', () => {
    expect(originePartage({ hostname: 'mochi-go.app', origin: 'https://mochi-go.app' })).toBe(SITE);
    expect(originePartage({ hostname: 'www.mochi-go.app', origin: 'https://www.mochi-go.app' })).toBe(SITE);
    expect(originePartage({ hostname: 'localhost', origin: 'http://localhost:4173' })).toBe('http://localhost:4173');
    expect(originePartage({ hostname: 'faux-mochi-go.app.evil', origin: 'https://faux-mochi-go.app.evil' })).toBe('https://faux-mochi-go.app.evil');
  });

  it('Go du jour : `/j/N`, `/en/j/N` en anglais', () => {
    expect(textePartage(42, 1, 0).url).toBe('https://mochi-go.app/j/42');
    choisirLangue('en');
    try { expect(textePartage(42, 1, 0).url).toBe('https://mochi-go.app/en/j/42'); } finally { choisirLangue('fr'); }
  });

  it('jeton de partie lu dans le fragment ; mal formé : vide ; absent : null', () => {
    expect(jetonPartieDeLAdresse(`#partie=${JETON}`)).toBe(JETON);
    expect(jetonPartieDeLAdresse(`#partie=${JETON}&x=1`)).toBe(JETON);
    expect(jetonPartieDeLAdresse('#partie=court')).toBe('');
    expect(jetonPartieDeLAdresse(`#defi=${JETON}`)).toBeNull();
    expect(jetonPartieDeLAdresse('')).toBeNull();
  });

  it('le jeton quitte l’adresse au chargement', () => {
    const appels: string[] = [];
    const hist = { state: null, replaceState: (_s: unknown, _t: string, u?: string | URL | null) => { appels.push(String(u)); } };
    expect(prendreJetonPartie({ hash: `#partie=${JETON}`, pathname: '/', search: '?lang=en' }, hist)).toBe(JETON);
    expect(appels).toEqual(['/?lang=en']);
    expect(prendreJetonPartie({ hash: '#autre', pathname: '/', search: '' }, hist)).toBeNull();
    expect(appels).toHaveLength(1);
    expect(lire('src/app/adressePartie.ts')).not.toMatch(/analytics/);
    // Importé en tête de main.tsx, juste après le jeton du défi : avant la mesure.
    const main = lire('src/main.tsx');
    expect(main.indexOf("from './app/adressePartie'")).toBeLessThan(main.indexOf("from './data/analytics'"));
  });
});

describe('adresse courte remise en forme par index.html', () => {
  it('se trouve dans index.html, avant le script de l’ouverture', () => {
    expect(source).toBeTruthy();
    expect(html.indexOf('function adresseCourte')).toBeLessThan(html.indexOf('function modeOuverture'));
  });

  it('Go du jour : `/j/42` et `/en/j/42` deviennent `/?go-du-jour=42`, en gardant les autres paramètres', () => {
    expect(adresseCourte('/j/42', '', '')).toBe('/?go-du-jour=42');
    expect(adresseCourte('/en/j/42/', '', '')).toBe('/?go-du-jour=42');
    expect(adresseCourte('/j/3', '?utm_source=wa', '')).toBe('/?utm_source=wa&go-du-jour=3');
  });

  it('défi : `/defi#JETON&de=Ana` devient `/#defi=JETON&de=Ana`, lu ensuite par adresseDefi.ts', () => {
    const a = adresseCourte('/defi', '', `#${JETON}&de=Ana`)!;
    expect(a).toBe(`/#defi=${JETON}&de=Ana`);
    expect(jetonDeLAdresse(a.slice(a.indexOf('#')))).toBe(JETON);
    expect(adresseCourte('/en/defi', '', `#${JETON}`)).toBe(`/#defi=${JETON}`);
    expect(adresseCourte('/defi', '', `#defi=${JETON}`)).toBe(`/#defi=${JETON}`);
    expect(adresseCourte('/defi', '', '')).toBe('/');
    // Le lien que l'app partage se relit de bout en bout.
    const lien = new URL(lienDefi(JETON, 'https://mochi-go.app', 'Ana', 'en'));
    const forme = adresseCourte(lien.pathname, lien.search, lien.hash)!;
    expect(jetonDeLAdresse(forme.slice(forme.indexOf('#')))).toBe(JETON);
    expect(jetonDepuisLien(lien.href)).toBe(JETON);
  });

  it('partie : `/partie#JETON` devient `/#partie=JETON`', () => {
    expect(adresseCourte('/partie', '', `#${JETON}`)).toBe(`/#partie=${JETON}`);
    const lien = new URL(lienPartie(JETON, 'en', SITE));
    const forme = adresseCourte(lien.pathname, lien.search, lien.hash)!;
    expect(jetonPartieDeLAdresse(forme.slice(forme.indexOf('#')))).toBe(JETON);
  });

  it('les autres adresses ne bougent pas', () => {
    expect(adresseCourte('/', '?go-du-jour=4', '')).toBeNull();
    expect(adresseCourte('/confidentialite', '', '')).toBeNull();
    expect(adresseCourte('/j/abc', '', '')).toBeNull();
    expect(adresseCourte('/enj/4', '', '')).toBeNull();
    expect(adresseCourte('/defis', '', '')).toBeNull();
    expect(adresseCourte('/en', '?lang=fr', '')).toBe('/?lang=fr');
  });

  it('l’ouverture animée s’efface aussi devant un lien de partie', () => {
    expect(html).toMatch(/\/\^#\(\?:defi\|partie\)=\/\.test\(c\.adresse\)/);
  });
});
