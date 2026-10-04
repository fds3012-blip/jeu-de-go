// Cote de jeu (#417) : couche de données (lecture seule et départ), textes FR/EN, et contrat avec la migration.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { CODES_DEPART, choisirDepart, lireMaCote, refusDepart } from './cote';
import { CATALOGUE_COTE, texteCote, texteEcart, traduireCote, type CleCote } from '../content/i18n/cote';
import { COTE_DECOUVRE, COTE_REGLES, KYU_CLUB_MAX, RD_DEPART, RD_MIN, RD_PROVISOIRE, TAU, VOL_DEPART } from '../go/cote';

const MIGRATION = readFileSync(resolve(__dirname, '../../supabase/migrations/20261004120100_cote_glicko.sql'), 'utf8');
const sansCommentaires = MIGRATION.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

describe('lecture de la cote', () => {
  it('ligne du profil', () => {
    expect(lireMaCote({ rating: 962, cote_provisoire: true, cote_parties: 1, cote_depart: 'club', cote_depart_kyu: 15 }))
      .toEqual({ cote: 962, provisoire: true, parties: 1, depart: 'club', departKyu: 15 });
    expect(lireMaCote({ rating: 1503, cote_provisoire: false, cote_parties: 21, cote_depart: null, cote_depart_kyu: null }))
      .toEqual({ cote: 1503, provisoire: false, parties: 21, depart: null, departKyu: null });
  });
  it('ligne abîmée : null ; colonnes absentes (serveur pas encore migré) : provisoire, aucune partie', () => {
    expect(lireMaCote(null)).toBeNull();
    expect(lireMaCote({ rating: '800' })).toBeNull();
    expect(lireMaCote({ rating: 800 })).toEqual({ cote: 800, provisoire: true, parties: 0, depart: null, departKyu: null });
    expect(lireMaCote({ rating: 800, cote_depart: 'expert' })?.depart).toBeNull();
  });
});

describe('point de départ', () => {
  it('appelle la fonction serveur, avec le grade seulement pour le club', async () => {
    const rpc = vi.fn(async () => ({ data: 1500, error: null }));
    const db = { rpc } as unknown as Db;
    expect(await choisirDepart(db, 'club', 15)).toEqual({ ok: true, value: 1500 });
    expect(rpc).toHaveBeenLastCalledWith('choisir_depart_cote', { p_depart: 'club', p_kyu: 15 });
    await choisirDepart(db, 'regles', 15);
    expect(rpc).toHaveBeenLastCalledWith('choisir_depart_cote', { p_depart: 'regles' });
  });
  it('refus du serveur : codes de la migration', async () => {
    for (const code of ['JGR01', 'JGR02', 'JGR03']) expect(sansCommentaires).toContain(`errcode = '${code}'`);
    expect(refusDepart({ code: 'JGR01' })).toBe('dejaLancee');
    expect(refusDepart({ code: 'JGR03' })).toBe('partieEnCours');
    expect(refusDepart({ code: 'JGC01' })).toBe('compte');
    expect(refusDepart({ code: '42501' })).toBe('serveur');
    expect(refusDepart(null)).toBe('serveur');
    const db = { rpc: async () => ({ data: null, error: { code: 'JGR01', message: 'brut' } }) } as unknown as Db;
    expect(await choisirDepart(db, 'decouvre')).toEqual({ ok: false, error: 'dejaLancee' });
    for (const r of Object.values(CODES_DEPART)) expect(CATALOGUE_COTE.fr).toHaveProperty(`cote.erreur.${r}`);
    expect(CATALOGUE_COTE.fr).toHaveProperty('cote.erreur.serveur');
  });
});

describe('le client et le serveur ont les mêmes constantes', () => {
  it('Glicko-2, provisoire, départs, bornes', () => {
    expect(sansCommentaires).toContain(`c_tau constant double precision := ${TAU}`);
    expect(sansCommentaires).toMatch(new RegExp(`cote_rd numeric\\(6,2\\) not null default ${RD_DEPART}`));
    expect(sansCommentaires).toContain(`cote_vol numeric(8,6) not null default ${VOL_DEPART}`);
    expect(sansCommentaires).toContain(`generated always as (cote_rd > ${RD_PROVISOIRE}) stored`);
    expect(sansCommentaires).toContain(`greatest(${RD_MIN}, round(v_nw.rd::numeric, 2))`);
    expect(sansCommentaires).toContain(`p_depart = 'decouvre' and p_kyu is null then ${COTE_DECOUVRE}`);
    expect(sansCommentaires).toContain(`p_depart = 'regles' and p_kyu is null then ${COTE_REGLES}`);
    expect(sansCommentaires).toContain(`p_kyu between 0 and ${KYU_CLUB_MAX} then 3000 - 100 * p_kyu`);
  });
  it('migration : aucune suppression de données, RLS, security definer à search_path vide', () => {
    expect(sansCommentaires).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(sansCommentaires).not.toMatch(/\btruncate\b/i);
    // Seul DELETE : la purge des attentes de plus de 10 minutes de find_match, inchangée depuis la première migration.
    expect(sansCommentaires.match(/\bdelete from\b[^;]*/gi)).toEqual([
      "delete from public.match_queue where created_at < now() - interval '10 minutes'",
      'delete from public.match_queue where user_id in (v_uid, v_opp)',
    ]);
    const definer = sansCommentaires.match(/security definer set search_path = ''/g) ?? [];
    expect(definer.length).toBe(3);
    expect(sansCommentaires).not.toMatch(/create table/i);
    expect(sansCommentaires).toContain('revoke execute on function public.choisir_depart_cote(text, integer) from public, anon;');
    expect(sansCommentaires).toContain('revoke execute on function public.apply_game_rating(uuid, uuid, uuid) from public, anon, authenticated;');
    expect(sansCommentaires).toContain('check (not rated or bot_id is null) not valid');
  });
});

describe('textes de la cote', () => {
  const cles = Object.keys(CATALOGUE_COTE.fr) as CleCote[];
  it('mêmes clés en français et en anglais, aucune vide', () => {
    expect(Object.keys(CATALOGUE_COTE.en).sort()).toEqual([...cles].sort());
    for (const k of cles) { expect(CATALOGUE_COTE.fr[k].trim()).not.toBe(''); expect(CATALOGUE_COTE.en[k].trim()).not.toBe(''); }
  });
  it('tutoiement, phrases courtes', () => {
    for (const k of cles) {
      const s = CATALOGUE_COTE.fr[k];
      expect(s, k).not.toMatch(/\b(vous|votre|vos)\b/i);
      for (const phrase of s.split(/[.!?]\s/)) expect(phrase.split(/\s+/).length, `${k} : ${phrase}`).toBeLessThanOrEqual(16);
    }
  });
  it('kyu et dan expliqués en une phrase courte, et la règle des IA dite', () => {
    expect(CATALOGUE_COTE.fr['cote.vocabulaire']).toMatch(/kyu.*dan/);
    expect(CATALOGUE_COTE.fr['cote.regle']).toMatch(/IA/);
  });
  it('variables remplacées', () => {
    expect(traduireCote('fr', 'cote.monte', { grade: '14ᵉ kyu' })).toBe('Tu passes 14ᵉ kyu !');
    expect(traduireCote('en', 'cote.monte', { grade: '14 kyu' })).toBe('You reach 14 kyu!');
  });
  it('cote provisoire « 1200 ? », écart signé', () => {
    expect(texteCote(1200, true, 'fr')).toBe('1200 ?');
    expect(texteCote(1200, true, 'en')).toBe('1200?');
    expect(texteCote(1503, false, 'fr')).toBe('1503');
    expect(texteEcart(14)).toBe('+14');
    expect(texteEcart(-8)).toBe('−8');
    expect(texteEcart(0)).toBe('0');
  });
});

describe('problèmes et leçons : jamais la cote de jeu (#137)', () => {
  it('ni l’écran Problèmes ni les leçons n’importent la cote de jeu', () => {
    for (const f of ['app/Puzzles.tsx', 'app/Lecon.tsx', 'app/Learn.tsx', 'ui/RevisionDuJour.tsx', 'ui/MesErreurs.tsx']) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(src, f).not.toMatch(/i18n\/cote'|ui\/Cote'|data\/cote'|go\/cote'/);
    }
  });
});
