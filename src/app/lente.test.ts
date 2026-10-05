import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { enCours, FINIES_MAX, heuresDepuis, lignesLentes } from './lente';
import { defisEnAttente } from './defisAJouer';
import { elementsAFaire, type DonneesAFaire } from './aFaire';
import { EN_LIGNE_KEY, ecrireFaconEnLigne, lireFaconEnLigne } from './enLigne';
import { CATALOGUE_LENTE, type CleLente } from '../content/i18n/lente';
import { traduire } from '../content/i18n/secondaires';
import type { EtatDefi } from '../data/defi';
import type { Game } from '../data/games';

// Issue #440 : parties lentes classées, logique pure de l'écran, de l'accueil et des textes.

const MOI = 'moi', LUI = 'lui';
const T0 = Date.parse('2026-10-05T10:00:00Z');
const H = 3_600_000;

let n = 0;
function etat(p: Partial<Game> = {}, limite: number | null = T0 + 20 * H, delai = '1 day'): EtatDefi {
  const id = `g${++n}`;
  const partie = {
    black_id: MOI, white_id: LUI, created_by: LUI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
    status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: true,
    analysis: null, bot_id: null, invite_code: null, score_black: null, score_white: null, created_at: '', updated_at: '', ...p, id,
  } as Game;
  return {
    partie,
    defi: { partie_id: id, jeton: 'x'.repeat(32), createur_id: LUI, invite_id: MOI, delai_coup: delai,
      date_limite: limite === null ? null : new Date(limite).toISOString(), lien_expire_le: '', cree_le: '' },
    resultat: partie.result,
  };
}

describe('liste des parties lentes', () => {
  it('d’abord à toi (la plus pressée), puis à l’autre, puis les dernières finies', () => {
    const aToiTard = etat({}, T0 + 40 * H);
    const aToiTot = etat({}, T0 + 2 * H);
    const aLui = etat({ moves: 'ee' });
    const finie = etat({ status: 'finished', result: 'B+T' });
    const l = lignesLentes([finie, aLui, aToiTard, aToiTot], MOI, T0);
    expect(l.map(x => x.partieId)).toEqual([aToiTot.partie.id, aToiTard.partie.id, aLui.partie.id, finie.partie.id]);
    expect(l[0]).toMatchObject({ aMoi: true, restant: 2 * H, adversaireId: LUI, taille: 9, phase: 'jeu' });
    expect(l[2]).toMatchObject({ aMoi: false });
    expect(enCours(l)).toBe(3);
  });
  it('au comptage, c’est à toi tant que tu n’as pas proposé', () => {
    const c1 = etat({ moves: 'tttt', counting: true });
    const c2 = etat({ moves: 'tttt', counting: true, dead_proposed_by: MOI, dead_stones: '' });
    const [a, b] = lignesLentes([c1, c2], MOI, T0);
    expect(a).toMatchObject({ partieId: c1.partie.id, aMoi: true, phase: 'comptage' });
    expect(b).toMatchObject({ partieId: c2.partie.id, aMoi: false });
  });
  it('garde au plus quelques parties finies', () => {
    const finies = Array.from({ length: FINIES_MAX + 3 }, () => etat({ status: 'finished', result: 'W+R' }));
    expect(lignesLentes(finies, MOI, T0)).toHaveLength(FINIES_MAX);
  });
  it('heures d’attente pour la mesure', () => {
    expect(heuresDepuis(new Date(T0 - 90 * 60_000).toISOString(), T0)).toBe(1.5);
    expect(heuresDepuis('n’importe quoi', T0)).toBe(0);
  });
});

describe('accueil : parties lentes à part des défis d’amis', () => {
  it('une partie lente porte `lente` et son délai ; un défi d’ami reste inchangé', () => {
    const l = etat({}, T0 + 20 * H, '2 days');
    const ami = etat({ rated: false }, T0 + 50 * H, '3 days');
    const [a, b] = defisEnAttente([l, ami], MOI, T0);
    expect(a).toMatchObject({ partieId: l.partie.id, lente: true, delaiMs: 48 * H, restant: 20 * H });
    expect(b).toEqual({ partieId: ami.partie.id, adversaire: null, adversaireId: LUI, restant: 50 * H, comptage: false });
  });
  it('« À faire » : délai d’attente calculé sur le délai de la partie lente', () => {
    const d: DonneesAFaire = { premier: false, serie: 0, duJourFait: true, goDuJour: null, leconEnCours: null,
      defis: [{ partieId: 'p', adversaire: 'Léa', restant: 20 * H, comptage: false, lente: true, delaiMs: 24 * H }] };
    expect(elementsAFaire(d)[0]).toMatchObject({ cible: { ecran: 'defi', partieId: 'p' }, attenteH: 4 });
  });
});

describe('façon de jouer en ligne, mémorisée', () => {
  const memoire = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
  it('en direct par défaut ; « Partie lente » gardée', () => {
    const s = memoire();
    expect(lireFaconEnLigne(s)).toBe('direct');
    ecrireFaconEnLigne('lente', s);
    expect(s.m.get(EN_LIGNE_KEY)).toBe('lente');
    expect(lireFaconEnLigne(s)).toBe('lente');
    s.m.set(EN_LIGNE_KEY, 'autre');
    expect(lireFaconEnLigne(s)).toBe('direct');
  });
  it('stockage fermé : pas d’erreur, en direct', () => {
    const ferme = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } };
    expect(lireFaconEnLigne(ferme)).toBe('direct');
    expect(() => ecrireFaconEnLigne('lente', ferme)).not.toThrow();
    expect(lireFaconEnLigne(null)).toBe('direct');
  });
});

describe('textes des parties lentes', () => {
  const cles = Object.keys(CATALOGUE_LENTE.fr) as CleLente[];
  it('mêmes clés en français et en anglais, aucune vide, mêmes variables', () => {
    expect(Object.keys(CATALOGUE_LENTE.en).sort()).toEqual([...cles].sort());
    const vars = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const k of cles) {
      expect(CATALOGUE_LENTE.fr[k].trim(), k).not.toBe('');
      expect(CATALOGUE_LENTE.en[k].trim(), k).not.toBe('');
      expect(vars(CATALOGUE_LENTE.en[k]), k).toEqual(vars(CATALOGUE_LENTE.fr[k]));
    }
  });
  it('tutoiement, phrases courtes', () => {
    for (const k of cles) {
      const s = CATALOGUE_LENTE.fr[k];
      expect(s, k).not.toMatch(/\b(vous|votre|vos)\b/i);
      for (const phrase of s.split(/[.!?]\s/)) expect(phrase.split(/\s+/).length, `${k} : ${phrase}`).toBeLessThanOrEqual(16);
    }
  });
  it('accueil : « À toi de jouer (N) » en français et en anglais', () => {
    expect(traduire('fr', 'lente.accueil.aJouer', { n: 2 })).toBe('À toi de jouer (2)');
    expect(traduire('en', 'lente.accueil.aJouer', { n: 2 })).toBe('Your move (2)');
    expect(traduire('fr', 'lente.accueil.tuile', { n: 1 })).toBe('Partie lente');
  });
});

// Migration #440, lue sans les commentaires.
const sql = readFileSync(new URL('../../supabase/migrations/20261005200100_parties_lentes.sql', import.meta.url), 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

describe('migration parties_lentes', () => {
  it('aucune donnée de production supprimée : seuls DELETE sur la file lente', () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column|policy|trigger|function)\b/i);
    expect(sql).not.toMatch(/\btruncate\s+(table\s+)?public\./i);
    const suppressions = [...sql.matchAll(/\bdelete\s+from\s+([\w.]+)/gi)].map(m => m[1]);
    expect(new Set(suppressions)).toEqual(new Set(['public.file_lente']));
  });
  it('RLS sur la file lente, lecture de sa seule ligne, aucune écriture directe', () => {
    expect(sql).toContain('alter table public.file_lente enable row level security;');
    expect(sql).toContain('using ((select auth.uid()) = user_id)');
    expect(sql).toContain('revoke insert, update, delete, truncate, references, trigger on public.file_lente from authenticated;');
    expect(sql).toContain('revoke all on public.file_lente from anon;');
    expect(sql.match(/create table/gi)?.length).toBe(1);
  });
  it('security definer à search_path vide, internes et tâche fermées', () => {
    const fonctions = [...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$;/g)];
    expect(fonctions.map(f => f[1]).sort()).toEqual(['chercher_partie_lente', 'defi_constater_temps', 'games_defi_garde', 'lente_apparier',
      'lentes_en_cours', 'lentes_tache', 'quitter_file_lente']);
    for (const f of fonctions) expect(f[0], f[1]).toMatch(/set search_path = ''/);
    for (const n of ['defi_constater_temps(uuid)', 'lentes_en_cours(uuid)', 'lente_apparier(uuid, boolean)', 'lentes_tache()']) {
      expect(sql).toContain(`revoke execute on function public.${n} from public, anon, authenticated, service_role;`);
    }
    for (const n of ['chercher_partie_lente(smallint, smallint)', 'quitter_file_lente()']) {
      expect(sql).toContain(`revoke execute on function public.${n} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${n} to authenticated;`);
    }
  });
  it('compte avec pseudo, classée, jamais d’IA, 10 au plus, cote par le serveur seul', () => {
    expect(sql).toMatch(/chercher_partie_lente[\s\S]*?v_uid uuid := public\.exiger_compte_avec_pseudo\(\);/);
    expect(sql).toMatch(/insert into public\.games \(black_id, white_id, created_by, size, rules, komi, status, rated, prive\)\s+values \([^)]*'active', true, true\)/);
    expect(sql).not.toMatch(/bot_id/);
    expect(sql).toContain("errcode = 'JGL10'");
    expect(sql.match(/perform public\.apply_game_rating/g)?.length).toBe(1);
  });
  it('tâche pg_cron seulement si l’extension est là', () => {
    expect(sql).toMatch(/if exists \(select 1 from pg_available_extensions where name = 'pg_cron'\)/);
    expect(sql).toContain("cron.schedule('parties-lentes'");
  });
});
