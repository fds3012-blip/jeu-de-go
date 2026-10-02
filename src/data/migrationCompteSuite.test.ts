// Garde-fous statiques des migrations « suite du compte obligatoire » (#343, #353, #354) : preuve d'acceptation (D2),
// rattachement d'une session anonyme, minimisation du profil et des données Google, politiques Anonyme réécrites.
// Les cas eux-mêmes sont vérifiés sur un vrai Postgres par supabase/tests/*.test.sql (bash supabase/tests/lancer.sh).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_COMPTE_REQUIS } from './compteRequis';
import { CLE_RATTACHEMENT, FORMAT_CODE_RATTACHEMENT } from './rattachement';

const dossier = resolve(__dirname, '../../supabase/migrations');
const MIGRATIONS = {
  preuve: '20261002000100_preuve_conditions.sql',
  rattachement: '20261002001100_rattacher_session_anonyme.sql',
  minimisation: '20261002002100_minimisation_profil_google.sql',
  politiques: '20261002003100_politiques_anonyme_initplan.sql'
} as const;
const lire = (f: string) => readFileSync(resolve(dossier, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
const sql = Object.fromEntries(Object.entries(MIGRATIONS).map(([k, f]) => [k, lire(f)])) as Record<keyof typeof MIGRATIONS, string>;
const tout = Object.values(sql).join('\n');

function fonctions(texte: string): { nom: string; entete: string; corps: string }[] {
  return [...texte.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)]
    .map(m => ({ nom: m[1], entete: m[2], corps: m[3] }));
}

describe('migrations suite du compte obligatoire', () => {
  it('viennent après toutes les migrations de main au 01/10, dans l’ordre des étapes', () => {
    const toutes = readdirSync(dossier).filter(f => f.endsWith('.sql')).sort();
    const rangs = Object.values(MIGRATIONS).map(f => toutes.indexOf(f));
    expect(rangs.every(r => r >= 0)).toBe(true);
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    expect(rangs[0]).toBeGreaterThan(toutes.indexOf('20261001000100_abonnements_rappel.sql'));
  });

  it('toute fonction security definer a search_path vide ; les fonctions internes sont fermées à l’app', () => {
    for (const { nom, entete } of fonctions(tout)) {
      expect(entete, nom).toMatch(/set search_path = ''/);
    }
    for (const interne of ['retirer_nom_et_photo\\(jsonb\\)', 'auth_users_minimiser\\(\\)', 'auth_identities_minimiser\\(\\)']) {
      expect(tout).toMatch(new RegExp(`revoke execute on function public\\.${interne} from public, anon, authenticated, service_role;`));
    }
    // Les RPC de l'app : authenticated seulement (jamais anon, jamais la clé service).
    for (const rpc of ['accepter_conditions\\(text\\)', 'preparer_rattachement\\(\\)', 'rattacher_session_anonyme\\(text\\)']) {
      expect(tout).toMatch(new RegExp(`revoke execute on function public\\.${rpc} from public, anon, service_role;`));
      expect(tout).toMatch(new RegExp(`grant execute on function public\\.${rpc} to authenticated;`));
    }
  });

  it('ne touche ni aux cotes, ni au jeu dans un défi, ni aux politiques existantes (sauf réécriture à l’identique)', () => {
    expect(tout).not.toMatch(/function public\.(apply_game_rating|finish_game_by_score|jouer_coup_defi|play_move|resign_game|victoire_au_temps|noter_a_mesure|record_puzzle_attempt)\b/);
    expect(tout).not.toMatch(/\bdrop policy\b/i);
    expect(tout).not.toMatch(/\bdisable row level security\b/i);
    expect(tout).not.toMatch(/\bdrop (table|column)\b/i);
    expect(tout).not.toMatch(/\brating\b/);
  });

  describe('preuve d’acceptation (D2)', () => {
    it('ajoute les deux colonnes liées, écrites par accepter_conditions seule (vrai compte, version AAAA-MM-JJ)', () => {
      expect(sql.preuve).toMatch(/add column conditions_acceptees_le timestamptz/);
      expect(sql.preuve).toMatch(/add column conditions_version text/);
      expect(sql.preuve).toMatch(/check \(\(conditions_acceptees_le is null\) = \(conditions_version is null\)\)/);
      // Aucun droit de colonne donné au client sur ces colonnes.
      expect(sql.preuve).not.toMatch(/grant update/);
      const f = fonctions(sql.preuve).find(x => x.nom === 'accepter_conditions')!;
      expect(f.entete).toMatch(/p_version text/);
      expect(f.corps).toContain(`errcode = '${CODE_COMPTE_REQUIS}'`);
      expect(f.corps).toMatch(/is_anonymous/);
      expect(f.corps).toContain(`'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`);
      // Même version : la première date est gardée ; l'écriture ne vise que l'appelant.
      expect(f.corps).toMatch(/case when p\.conditions_version = p_version then p\.conditions_acceptees_le else now\(\) end/);
      expect(f.corps).toMatch(/where p\.id = v_uid/);
    });
  });

  describe('rattachement d’une session anonyme', () => {
    it('garde une empreinte SHA-256 du code, 15 minutes, dans une table fermée à l’app', () => {
      expect(sql.rattachement).toMatch(/create table public\.rattachements_anonymes/);
      expect(sql.rattachement).toMatch(/alter table public\.rattachements_anonymes enable row level security/);
      expect(sql.rattachement).toMatch(/revoke all on public\.rattachements_anonymes from public, anon, authenticated, service_role;/);
      expect(sql.rattachement).not.toMatch(/create policy/);
      const preparer = fonctions(sql.rattachement).find(x => x.nom === 'preparer_rattachement')!.corps;
      expect(preparer).toMatch(/gen_random_bytes\(24\)/);
      expect(preparer).toMatch(/digest\(v_code, 'sha256'\)/);
      expect(preparer).toMatch(/interval '15 minutes'/);
      // Réservé aux sessions anonymes, source de vérité auth.users.
      expect(preparer).toMatch(/if not coalesce\(\(select u\.is_anonymous from auth\.users u where u\.id = v_uid\), false\) then/);
    });

    it('rattacher : vrai compte seulement, code vérifié par empreinte et expiration, parties et défis déplacés, anonyme supprimé', () => {
      const c = fonctions(sql.rattachement).find(x => x.nom === 'rattacher_session_anonyme')!.corps;
      expect(c).toContain(`errcode = '${CODE_COMPTE_REQUIS}'`);
      expect(c).toContain(`'^[A-Za-z0-9_-]{32}$'`);
      expect(FORMAT_CODE_RATTACHEMENT.source).toBe('^[A-Za-z0-9_-]{32}$');
      expect(c).toMatch(/r\.code_hash = encode\(extensions\.digest\(p_code, 'sha256'\), 'hex'\)/);
      expect(c).toMatch(/r\.expire_le > now\(\)/);
      // Jamais l'identifiant anonyme en paramètre : seul le code prouve le contrôle de la session.
      expect(fonctions(sql.rattachement).find(x => x.nom === 'rattacher_session_anonyme')!.entete).toMatch(/^p_code text\)\s*returns integer/);
      for (const col of ['created_by', 'black_id', 'white_id', 'dead_proposed_by']) expect(c).toMatch(new RegExp(`${col} = case when g\\.${col} = v_anon`));
      for (const col of ['createur_id', 'invite_id']) expect(c).toMatch(new RegExp(`${col} = case when d\\.${col} = v_anon`));
      expect(c).toMatch(/delete from auth\.users where id = v_anon and is_anonymous is true/);
      // Le défi suit sans que ses coups ou sa date limite soient réécrits.
      expect(c).not.toMatch(/\b(moves|date_limite|jeton)\b/);
    });

    it('le client garde le code en stockage de session, cité dans la politique de confidentialité', () => {
      const politique = readFileSync(resolve(__dirname, '../../docs/juridique/politique-confidentialite.md'), 'utf8');
      expect(politique).toContain('`' + CLE_RATTACHEMENT + '`');
      expect(politique).toMatch(/preparer_rattachement/);
      expect(politique).toMatch(/rattacher_session_anonyme/);
      expect(politique).toMatch(/conditions_acceptees_le/);
    });
  });

  describe('minimisation (E18, Google)', () => {
    it('retire le droit de modifier avatar_url et country, garde les colonnes et la lecture', () => {
      expect(sql.minimisation).toMatch(/revoke update \(avatar_url, country\) on public\.profiles from authenticated;/);
      expect(sql.minimisation).not.toMatch(/drop column/);
      expect(sql.minimisation).not.toMatch(/revoke select/);
      expect(sql.minimisation).not.toMatch(/grant/);
    });
    it('efface nom et photo reçus de Google à chaque écriture, dans auth.users et auth.identities, et une fois l’existant', () => {
      expect(sql.minimisation).toMatch(/array\['name', 'full_name', 'given_name', 'family_name', 'avatar_url', 'picture'\]/);
      expect(sql.minimisation).toMatch(/create trigger auth_users_minimiser before insert or update of raw_user_meta_data on auth\.users/);
      expect(sql.minimisation).toMatch(/create trigger auth_identities_minimiser before insert or update of identity_data on auth\.identities/);
      expect(sql.minimisation).toMatch(/update auth\.users set raw_user_meta_data = public\.retirer_nom_et_photo\(raw_user_meta_data\)/);
      // Ni l'e-mail ni l'identifiant du fournisseur ne sont retirés.
      expect(sql.minimisation).not.toMatch(/'(email|sub|provider_id|email_verified)'/);
    });
  });

  describe('politiques Anonyme (advisors)', () => {
    it('réécrit les dix politiques à l’identique, sous la forme (select auth.jwt()), sans en créer ni en supprimer', () => {
      const alters = [...sql.politiques.matchAll(/alter policy "([^"]+)" on public\.(\w+)([\s\S]*?);/g)];
      expect(alters.map(m => m[1]).sort()).toEqual([
        "Anonyme : pas d'acceptation d'ami", 'Anonyme : pas de badge', 'Anonyme : pas de création de partie', "Anonyme : pas de demande d'ami",
        'Anonyme : pas de problème personnel', 'Anonyme : pas de pseudo', 'Anonyme : pas de rappel', 'Anonyme : pas de suppression de problème',
        "Anonyme : progression des leçons sur l'appareil", "Anonyme : progression des leçons sur l'appareil (mise à jour)"
      ].sort());
      for (const m of alters) {
        const clauses = [...m[3].matchAll(/(using|with check) \((.*)\)/g)];
        expect(clauses.length, m[1]).toBeGreaterThan(0);
        for (const c of clauses) expect(c[2], m[1]).toBe("((select auth.jwt()) ->> 'is_anonymous')::boolean is not true");
      }
      expect(sql.politiques).not.toMatch(/create policy|drop policy/);
      // Chaque politique réécrite existe dans une migration antérieure.
      const anterieures = readdirSync(dossier).filter(f => f.endsWith('.sql') && f < MIGRATIONS.politiques).map(lire).join('\n');
      for (const m of alters) expect(anterieures, m[1]).toContain(`create policy "${m[1]}" on public.${m[2]}`);
    });
  });
});
