// Partager une étude (#449) : SGF accepté par le serveur, relu à l'identique, appels au serveur, copie ouverte, image.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { etudeDepuisSgf, etudeVersSgf, etudeVide, jouerVariante, poser, type Etude } from '../go/etude';
import { lirePartiePartagee, publierEtude } from '../data/partage';
import type { Db } from '../data/supabase';
import { sgfPublic } from './partage';
import { copieEtudeEnAttente, deposerCopieEtude, oublierCopieEtude } from './copieEtude';
import { dessinerImage } from './imagePartie';
import { traduirePartage } from '../content/i18n/partage';

const racine = new URL('../../', import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, racine), 'utf8');
const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

// Contrôles du serveur, relus dans les migrations : `sgf_partageable` (#364), puis ceux de `partager_etude` (#449).
const m364 = lire('supabase/migrations/20261005213100_parties_partagees.sql');
const motif = /regexp_replace\(p_sgf,\s*'([^']+)'\s*\|\|\s*'([^']+)',/.exec(m364);
const proprietes = new RegExp(motif![1] + motif![2], 'g');
const m449 = lire('supabase/migrations/20261006134900_etudes_partagees.sql');
const auMoinsUne = new RegExp(/p_sgf !~ '(\(A\[BW\][^']+)'/.exec(m449)![1]);
const etudeAccepteeParLeServeur = (s: string, taille: number) => /^\(;/.test(s) && new TextEncoder().encode(s).length <= 16384
  && /^[();\s]*$/.test(s.replace(proprietes, '')) && [9, 13, 19].includes(taille) && s.includes(`SZ[${taille}]`)
  && auMoinsUne.test(s) && !/RE\[/.test(s);

function exemple(size: 9 | 13 | 19 = 9): Etude {
  let e: Etude = etudeVide(size);
  for (const [p, o] of [[20, 'noir'], [21, 'blanc'], [30, 'noir'], [31, 'blanc']] as const) e = poser(e, p, o) as Etude;
  e = { ...e, trait: 2 };
  for (const p of [40, 41, 49]) e = jouerVariante(e, p) as Etude;
  return e;
}

describe('étude réduite au partage', () => {
  it('ce que produit l’écran d’étude, le serveur l’accepte (9, 13 et 19 lignes)', () => {
    for (const size of [9, 13, 19] as const) {
      const pub = sgfPublic(etudeVersSgf(exemple(size)));
      expect(etudeAccepteeParLeServeur(pub.sgf, pub.taille), pub.sgf).toBe(true);
      expect(pub.coups).toBe(3);
    }
    // Position seule, sans variante : acceptée. Goban vide : refusé (rien à étudier).
    expect(etudeAccepteeParLeServeur(sgfPublic(etudeVersSgf({ ...exemple(), variante: [] })).sgf, 9)).toBe(true);
    expect(etudeAccepteeParLeServeur(sgfPublic(etudeVersSgf(etudeVide(9))).sgf, 9)).toBe(false);
  });

  it('se relit en la même étude : position, trait, variante', () => {
    const e = exemple();
    const relue = etudeDepuisSgf(sgfPublic(etudeVersSgf(e)).sgf)!;
    expect(Array.from(relue.depart)).toEqual(Array.from(e.depart));
    expect(relue.trait).toBe(2);
    expect(relue.variante).toEqual([40, 41, 49]);
  });
});

describe('serveur', () => {
  it('publierEtude : `partager_etude` avec la taille et le coup montré ; refus traduits', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: JETON, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'JGS01', message: 'Reviens demain' } });
    const db = { rpc } as unknown as Db;
    expect(await publierEtude(db, { sgf: '(;SZ[9]AB[aa])', taille: 9, coup: 3 })).toEqual({ ok: true, value: JETON });
    expect(rpc).toHaveBeenCalledWith('partager_etude', { p_sgf: '(;SZ[9]AB[aa])', p_taille: 9, p_coup: 3 });
    expect(await publierEtude(db, { sgf: '(;SZ[9]AB[aa])', taille: 9, coup: 5000 })).toMatchObject({ ok: false, raison: 'jour' });
    expect(rpc).toHaveBeenLastCalledWith('partager_etude', expect.objectContaining({ p_coup: 1000 }));
  });

  it('lecture : `lire_partage` dit si le lien montre une étude', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ objet: 'etude', sgf: '(;SZ[9]AB[aa])', taille: 9, joueur: null, adversaire: null, coup: 2, pseudo: 'Ana' }], error: null });
    const r = await lirePartiePartagee({ rpc } as unknown as Db, JETON);
    expect(rpc).toHaveBeenCalledWith('lire_partage', { p_jeton: JETON });
    expect(r).toEqual({ ok: true, value: { objet: 'etude', sgf: '(;SZ[9]AB[aa])', taille: 9, joueur: null, adversaire: null, coup: 2, pseudo: 'Ana' } });
  });

  it('migration pas encore appliquée : repli sur `lire_partie_partagee`, le lien se lit comme une partie', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: [{ sgf: '(;SZ[9];B[ee])', taille: 9, joueur: 1, adversaire: 'Tigre', coup: 1, pseudo: 'Ana' }], error: null });
    const r = await lirePartiePartagee({ rpc } as unknown as Db, JETON);
    expect(rpc).toHaveBeenLastCalledWith('lire_partie_partagee', { p_jeton: JETON });
    expect(r).toMatchObject({ ok: true, value: { objet: 'partie', adversaire: 'Tigre' } });
  });

  it('autre erreur : pas de repli, erreur rendue (l’écran propose « Réessayer »)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '08006', message: 'réseau' } });
    expect(await lirePartiePartagee({ rpc } as unknown as Db, JETON)).toEqual({ ok: false, error: 'réseau' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('copie ouverte dans l’écran d’étude', () => {
  it('déposée, lue sans être retirée (double montage), puis oubliée', () => {
    expect(copieEtudeEnAttente()).toBeNull();
    deposerCopieEtude({ sgf: '(;SZ[9]AB[aa])', pseudo: 'Ana' });
    expect(copieEtudeEnAttente()).toEqual({ sgf: '(;SZ[9]AB[aa])', pseudo: 'Ana' });
    expect(copieEtudeEnAttente()).not.toBeNull();
    oublierCopieEtude();
    expect(copieEtudeEnAttente()).toBeNull();
  });
});

describe('image de l’étude', () => {
  it('la ligne de l’étude et qui joue, sans résultat ni camps', () => {
    const textes: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(cible, cle: string) {
        if (cle in cible) return cible[cle];
        if (cle === 'fillText') return (t: string) => { textes.push(t); };
        if (cle === 'measureText') return (t: string) => ({ width: t.length * 20 });
        if (cle.startsWith('create')) return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set(cible, cle: string, v) { cible[cle] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const etiquette = traduirePartage('fr', 'image.etude', { n: 3 });
    const titre = traduirePartage('fr', 'image.trait', { camp: traduirePartage('fr', 'image.blanc') });
    dessinerImage(ctx, { size: 9, board: new Array(81).fill(0), dernier: 40, coup: 3, noir: 'Ana', blanc: 'Tigre', langue: 'fr', etude: { etiquette, titre } });
    expect(textes).toEqual(expect.arrayContaining(['Mochi Go', 'Étude · variante de 3 coups', 'Blanc joue', 'Joue au go sur mochi-go.app']));
    expect(textes).not.toContain('Ana');
    expect(textes.join(' ')).not.toMatch(/gagne|Moment clé/);
  });

  it('textes de l’étude en français et en anglais', () => {
    expect(traduirePartage('en', 'vueEtude.etudier')).toBe('Study it with Mochi');
    expect(traduirePartage('fr', 'vueEtude.etudier')).toBe('Étudie-la avec Mochi');
    expect(traduirePartage('en', 'image.etude', { n: 4 })).toBe('Study · 4-move line');
  });
});
