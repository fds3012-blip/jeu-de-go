// Fonction serveur `alerte-signalements` (#531), avec une base et un service d'e-mail simulés.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { aSignaler, alerter, autorise, composerEmail, lienTableau, type Deps, type Resume } from '../../supabase/functions/alerte-signalements/logique';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const lire = (f: string) => readFileSync(racine + f, 'utf8');

const resume = (r: Partial<Resume> = {}): Resume => ({
  depuis: '2026-10-12T05:55:00Z', jusqua: '2026-10-13T05:55:00Z', nouveaux: 3, par_type: { joueur: 2, bug: 1 },
  joueurs_signales: 1, a_revoir: 1, en_attente: 5, pseudos_a_revoir: 0, ...r,
});

function deps(r: Resume, statut = 200) {
  const envois: { sujet: string; texte: string; html: string }[] = [];
  const d: Deps = {
    reclamer: vi.fn(async () => r),
    envoyer: vi.fn(async e => { envois.push(e); return { ok: statut < 300, statut }; }),
  };
  return { d, envois };
}

const LIEN = 'https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/editor';

describe('alerte-signalements', () => {
  it('envoie un résumé en nombres, avec le lien vers Supabase', async () => {
    const { d, envois } = deps(resume());
    expect(await alerter(d, LIEN)).toEqual({ rien: false, envoye: true, nouveaux: 3, statut: 200 });
    expect(envois).toHaveLength(1);
    const e = envois[0];
    expect(e.sujet).toBe('Mochi Go : 3 nouveaux signalements');
    expect(e.texte).toContain('- joueurs signalés : 2');
    expect(e.texte).toContain('- bugs : 1');
    expect(e.texte).toContain('signalés par au moins deux comptes (vue signalements_a_revoir) : 1');
    expect(e.texte).toContain(LIEN);
    expect(e.html).toContain(`<a href="${LIEN}">`);
  });

  it('rien de nouveau : aucun e-mail', async () => {
    const { d, envois } = deps(resume({ nouveaux: 0, par_type: {}, a_revoir: 0, pseudos_a_revoir: 0 }));
    expect(await alerter(d, LIEN)).toEqual({ rien: true, envoye: false, nouveaux: 0 });
    expect(envois).toHaveLength(0);
  });

  it('un joueur reste à revoir, ou un pseudo : l’équipe est prévenue même sans nouveau signalement', () => {
    expect(aSignaler(resume({ nouveaux: 0, a_revoir: 1 }))).toBe(true);
    expect(aSignaler(resume({ nouveaux: 0, a_revoir: 0, pseudos_a_revoir: 2 }))).toBe(true);
    expect(composerEmail(resume({ nouveaux: 0, a_revoir: 1 }), LIEN).sujet).toBe('Mochi Go : modération à revoir');
    expect(composerEmail(resume({ nouveaux: 1 }), LIEN).sujet).toBe('Mochi Go : 1 nouveau signalement');
  });

  it('refus de Resend : rapporté, sans exception', async () => {
    const { d } = deps(resume(), 422);
    expect(await alerter(d, LIEN)).toEqual({ rien: false, envoye: false, nouveaux: 3, statut: 422 });
  });

  it('jamais de texte libre : seuls des nombres viennent de la base, échappés dans le HTML', () => {
    // Un résumé malformé (texte à la place d'un nombre) ne passe pas tel quel.
    const piege = resume({ nouveaux: '<script>' as unknown as number, par_type: { joueur: 'insulte' as unknown as number } });
    const e = composerEmail(piege, LIEN);
    expect(e.texte + e.html).not.toMatch(/script|insulte/);
    expect(composerEmail(resume(), 'https://x/?a=1&b="2"').html).toContain('href="https://x/?a=1&amp;b=&quot;2&quot;"');
  });

  it('accès : secret de 32 caractères au moins, comparé en entier', () => {
    const s = 'a'.repeat(40);
    expect(autorise(`Bearer ${s}`, s)).toBe(true);
    expect(autorise(`Bearer ${s.slice(1)}b`, s)).toBe(false);
    expect(autorise(null, s)).toBe(false);
    expect(autorise('Bearer court', 'court')).toBe(false);
    expect(autorise(`Bearer ${s}`, undefined)).toBe(false);
  });

  it('lien vers l’éditeur du projet, tiré de l’adresse Supabase', () => {
    expect(lienTableau('https://xjvsalkvpgcjrznznxoi.supabase.co')).toBe(LIEN);
    expect(lienTableau('https://evil.example')).toBe('https://supabase.com/dashboard');
  });

  it('déployée sans JWT (secret propre), et aucun secret dans le dépôt', () => {
    expect(lire('supabase/functions/alerte-signalements/.sans-jwt')).toBe('');
    expect(lire('.github/workflows/deployer-fonctions.yml')).toContain('--no-verify-jwt');
    const planif = lire('supabase/planification/alerte-signalements.sql');
    expect(planif).toContain("vault.decrypted_secrets where name = 'alerte_secret'");
    expect(planif).not.toMatch(/re_[A-Za-z0-9]{10,}|Bearer [A-Za-z0-9]{20,}/);
    expect(lire('supabase/functions/alerte-signalements/index.ts')).toMatch(/Deno\.env\.get\('RESEND_API_KEY'\)/);
  });
});
