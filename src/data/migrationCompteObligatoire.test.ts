// Garde-fous statiques de la migration « compte obligatoire avec pseudo » (#343). Les cas eux-mêmes (anonyme et
// compte sans pseudo refusés, parties en cours préservées, aperçu du lien) sont vérifiés sur un vrai Postgres par
// supabase/tests/compte_obligatoire.test.sql.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';

const dossier = resolve(__dirname, '../../supabase/migrations');
const FICHIER = '20260930233100_compte_obligatoire.sql';
const sql = readFileSync(resolve(dossier, FICHIER), 'utf8')
  .split('\n')
  .filter(ligne => !ligne.trim().startsWith('--'))
  .join('\n');

function fonctions(): { nom: string; entete: string; corps: string }[] {
  return [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)]
    .map(m => ({ nom: m[1], entete: m[2], corps: m[3] }));
}
const corps = (nom: string) => fonctions().find(f => f.nom === nom)!.corps;

describe('migration compte_obligatoire', () => {
  it('passe après les migrations dont elle reprend les fonctions (et après toutes celles de main au 30/09)', () => {
    const toutes = readdirSync(dossier).filter(f => f.endsWith('.sql')).sort();
    const rang = toutes.indexOf(FICHIER);
    for (const avant of ['20260929003100_defi_par_lien.sql', '20260929100100_garde_anonymes.sql', '20260929234100_lot_u.sql']) {
      expect(toutes.indexOf(avant), avant).toBeGreaterThanOrEqual(0);
      expect(toutes.indexOf(avant), avant).toBeLessThan(rang);
    }
    // Aucune migration postérieure ne doit redéfinir ces fonctions sans reprendre le contrôle du compte.
    for (const f of toutes.slice(rang + 1)) {
      const texte = readFileSync(resolve(dossier, f), 'utf8');
      for (const m of texte.matchAll(/create or replace function public\.(creer_defi|rejoindre_defi|find_match|join_game)\(([\s\S]*?)\$\$;/g)) {
        expect(m[0], `${f} : ${m[1]}`).toContain('exiger_compte_avec_pseudo()');
      }
    }
  });

  it('redéfinit seulement les fonctions attendues, toutes security definer à search_path vide', () => {
    const f = fonctions();
    expect(f.map(x => x.nom).sort()).toEqual(
      ['apercu_defi', 'creer_defi', 'exiger_compte_avec_pseudo', 'find_match', 'join_game', 'rejoindre_defi']
    );
    for (const { nom, entete } of f) expect(entete, nom).toMatch(/security definer set search_path = ''/);
  });

  it('distingue « Crée ton compte » et « Choisis ton pseudo » par deux codes que le client connaît', () => {
    const c = corps('exiger_compte_avec_pseudo');
    expect(c).toContain(`errcode = '${CODE_COMPTE_REQUIS}'`);
    expect(c).toContain(`errcode = '${CODE_PSEUDO_REQUIS}'`);
    expect(c).toMatch(/is_anonymous/);
    expect(c).toMatch(/username is not null/);
    expect(CODE_COMPTE_REQUIS).not.toBe(CODE_PSEUDO_REQUIS);
    for (const code of [CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS]) expect(code).toMatch(/^[0-9A-Z]{5}$/);
  });

  it('exige compte et pseudo à l’entrée de creer_defi, find_match, join_game', () => {
    for (const nom of ['creer_defi', 'find_match', 'join_game']) {
      expect(corps(nom), nom).toMatch(/v_uid uuid := public\.exiger_compte_avec_pseudo\(\);/);
    }
  });

  it('rejoindre_defi rend sa partie à un joueur déjà dans le défi avant d’exiger le compte', () => {
    const c = corps('rejoindre_defi');
    const retour = c.indexOf('then return v_defi.partie_id');
    const controle = c.indexOf('perform public.exiger_compte_avec_pseudo()');
    expect(retour).toBeGreaterThan(0);
    expect(controle).toBeGreaterThan(retour);
    expect(c.indexOf('update public.games')).toBeGreaterThan(controle);
  });

  it('ne touche pas au jeu dans un défi en cours ni aux cotes', () => {
    expect(sql).not.toMatch(/function public\.(jouer_coup_defi|resign_game|victoire_au_temps|apply_game_rating|finish_game_by_score)\b/);
  });

  it('droits : contrôle interne fermé, aperçu ouvert sans session', () => {
    expect(sql).toMatch(/revoke execute on function public\.exiger_compte_avec_pseudo\(\) from public, anon, authenticated, service_role;/);
    expect(sql).not.toMatch(/grant execute on function public\.exiger_compte_avec_pseudo/);
    expect(sql).toMatch(/grant execute on function public\.apercu_defi\(text\) to anon, authenticated;/);
    // L'aperçu ne renvoie ni jeton, ni identifiant de partie ou de joueur.
    expect(sql).toMatch(/returns table \(createur_pseudo text, taille smallint, etat text, ma_place text\)/);
  });

  it('ne supprime aucune donnée, ne retire aucune politique, garde la RLS', () => {
    const sansFonctions = sql.replace(/\$\$[\s\S]*?\$\$/g, '');
    expect(sansFonctions).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|policy|function)\b/i);
    expect(sansFonctions).not.toMatch(/disable row level security|no force row level security/i);
    for (const { nom, corps: c } of fonctions()) {
      const suppressions = [...c.matchAll(/delete from public\.(\w+)/g)].map(m => m[1]);
      expect(suppressions, nom).toEqual(nom === 'find_match' ? ['match_queue', 'match_queue'] : []);
    }
    const politiques = [...sql.matchAll(/create policy "[^"]+" on public\.(\w+)\s+(as restrictive\s+)?for (\w+)/g)];
    expect(politiques.map(m => `${m[1]}:${m[3]}:${m[2] ? 'restrictive' : 'permissive'}`)).toEqual(['games:insert:restrictive']);
  });
});
