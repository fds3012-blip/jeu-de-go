// #584 : une seule lecture de `mon_profil()` pour les crochets de l'accueil (pseudo, cote, série, gels), relue après
// une écriture, une `cle` plus grande, une erreur ou au-delà de FRAICHEUR_PROFIL_MS.
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from './supabase';
import { FRAICHEUR_PROFIL_MS, invaliderProfil, lireMonProfil } from './lectureProfil';

function fauxDb(reponses: { data?: unknown; error?: unknown }[] = []) {
  const appels: string[] = [];
  const db = {
    rpc(nom: string) {
      appels.push(nom);
      const r = reponses.shift() ?? { data: { id: 'u1', username: `pseudo${appels.length}` }, error: null };
      return { maybeSingle: async () => r };
    },
  } as unknown as Db;
  return { db, appels };
}

afterEach(() => invaliderProfil());

describe('lecture partagée du profil (#584)', () => {
  it('quatre crochets à l’ouverture : un seul appel, la même réponse', async () => {
    const { db, appels } = fauxDb();
    const t = 1_000;
    const rs = await Promise.all([lireMonProfil(db, 'u1', 0, t), lireMonProfil(db, 'u1', 0, t), lireMonProfil(db, 'u1', 0, t + 5), lireMonProfil(db, 'u1', 0, t + 9)]);
    expect(appels).toEqual(['mon_profil']);
    expect(new Set(rs).size).toBe(1);
    expect(rs[0]).toEqual({ ok: true, value: { id: 'u1', username: 'pseudo1' } });
  });

  it('relu : après une écriture, une clé plus grande, un autre compte, ou au-delà de la fraîcheur', async () => {
    const { db, appels } = fauxDb();
    await lireMonProfil(db, 'u1', 0, 0);
    invaliderProfil();
    expect(await lireMonProfil(db, 'u1', 0, 1)).toMatchObject({ value: { username: 'pseudo2' } });
    // Pseudo choisi : la clé de l'accueil passe à 1 ; ses deux crochets partagent la relecture.
    await Promise.all([lireMonProfil(db, 'u1', 1, 2), lireMonProfil(db, 'u1', 1, 2)]);
    expect(appels).toHaveLength(3);
    // L'écran de partie lit avec la clé 0 : la lecture gardée (clé 1) lui va.
    await lireMonProfil(db, 'u1', 0, 3);
    expect(appels).toHaveLength(3);
    await lireMonProfil(db, 'u2', 0, 4);
    expect(appels).toHaveLength(4);
    await lireMonProfil(db, 'u2', 0, 4 + FRAICHEUR_PROFIL_MS);
    expect(appels).toHaveLength(5);
  });

  it('une erreur n’est pas gardée : la lecture suivante réessaie', async () => {
    const { db, appels } = fauxDb([{ data: null, error: { message: 'réseau' } }]);
    expect((await lireMonProfil(db, 'u1', 0, 0)).ok).toBe(false);
    expect((await lireMonProfil(db, 'u1', 0, 1)).ok).toBe(true);
    expect(appels).toHaveLength(2);
  });
});
