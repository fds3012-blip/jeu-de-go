// Fonction serveur `envoyer-rappels` (issue #36), avec une base et un service de notification simulés.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  autorise, chargeDuJour, envoyerRappels, estDisparu, TAILLE_LOT, TEXTES, URL_RAPPEL, type Abonnement, type Deps,
} from '../../supabase/functions/envoyer-rappels/logique';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const lire = (f: string) => readFileSync(racine + f, 'utf8');

const abo = (i: number, langue = 'fr'): Abonnement => ({
  id: `id-${i}`, endpoint: `https://push.exemple.test/${i}`, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), langue, jour: '2026-10-01',
});

function deps(dus: Abonnement[], statut: (a: Abonnement) => number | Error = () => 201) {
  const envois: { a: Abonnement; charge: string }[] = [];
  const supprimes: string[][] = [];
  const d: Deps = {
    reclamer: vi.fn(async () => dus),
    envoyer: vi.fn(async (a: Abonnement, charge: string) => {
      envois.push({ a, charge });
      const s = statut(a);
      if (s instanceof Error) throw s;
      return { statut: s };
    }),
    supprimer: vi.fn(async (ids: string[]) => { supprimes.push(ids); }),
  };
  return { d, envois, supprimes };
}

describe('envoyerRappels', () => {
  it('envoie un rappel à chaque abonnement dû, dans sa langue, vers le Go du jour', async () => {
    const { d, envois } = deps([abo(1), abo(2, 'en')]);
    expect(await envoyerRappels(d)).toEqual({ dus: 2, envoyes: 2, supprimes: 0, echecs: 0 });
    const [fr, en] = envois.map(e => JSON.parse(e.charge));
    expect(TEXTES.fr.map(t => t.titre)).toContain(fr.titre);
    expect(TEXTES.en.map(t => t.titre)).toContain(en.titre);
    expect(fr.url).toBe(URL_RAPPEL);
    expect(URL_RAPPEL).toBe('/?rappel=1');
    expect(d.supprimer).not.toHaveBeenCalled();
  });

  it('supprime les abonnements disparus (404, 410), garde les autres échecs', async () => {
    const { d, supprimes } = deps([abo(1), abo(2), abo(3), abo(4)], a => ({ 'id-1': 410, 'id-2': 404, 'id-3': 500 } as Record<string, number>)[a.id] ?? 201);
    expect(await envoyerRappels(d)).toEqual({ dus: 4, envoyes: 1, supprimes: 2, echecs: 1 });
    expect(supprimes).toEqual([['id-1', 'id-2']]);
  });

  it('une erreur réseau compte comme un échec, sans arrêter les autres envois', async () => {
    const { d } = deps([abo(1), abo(2)], a => (a.id === 'id-1' ? new Error('réseau') : 201));
    expect(await envoyerRappels(d)).toEqual({ dus: 2, envoyes: 1, supprimes: 0, echecs: 1 });
  });

  it('rien de dû : aucun envoi', async () => {
    const { d } = deps([]);
    expect(await envoyerRappels(d)).toEqual({ dus: 0, envoyes: 0, supprimes: 0, echecs: 0 });
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it('envoie par lots', async () => {
    let enCours = 0, max = 0;
    const dus = Array.from({ length: TAILLE_LOT * 2 + 3 }, (_, i) => abo(i));
    const d: Deps = {
      reclamer: async () => dus,
      envoyer: async () => { enCours++; max = Math.max(max, enCours); await new Promise(r => setTimeout(r, 1)); enCours--; return { statut: 201 }; },
      supprimer: async () => {},
    };
    expect((await envoyerRappels(d)).envoyes).toBe(dus.length);
    expect(max).toBeLessThanOrEqual(TAILLE_LOT);
  });

  it('la base en erreur fait échouer la fonction (la tâche le verra dans ses journaux)', async () => {
    const d: Deps = { reclamer: async () => { throw new Error('base'); }, envoyer: async () => ({ statut: 201 }), supprimer: async () => {} };
    await expect(envoyerRappels(d)).rejects.toThrow('base');
  });

  it('404 et 410 seulement sont des abonnements disparus', () => {
    expect([404, 410].every(estDisparu)).toBe(true);
    expect([0, 400, 413, 429, 500].some(estDisparu)).toBe(false);
  });
});

describe('textes des rappels', () => {
  it('changent d’un jour à l’autre et reviennent en boucle', () => {
    const jours = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(j => chargeDuJour('fr', j).titre);
    expect(new Set(jours.slice(0, 4)).size).toBe(4);
    expect(jours[4]).toBe(jours[0]);
    expect(chargeDuJour('de', '2026-10-01').titre).toBe(chargeDuJour('fr', '2026-10-01').titre);
    expect(chargeDuJour('fr', 'illisible').titre).toBe(TEXTES.fr[0].titre);
  });

  it('sans fausse urgence ni culpabilité, courts, autant en français qu’en anglais', () => {
    expect(TEXTES.fr).toHaveLength(TEXTES.en.length);
    const interdits = /vite|dépêche|dernière chance|perdre|perds|urgent|triste|manque|!|hurry|last chance|lose|losing|sad|miss|🔥/i;
    for (const t of [...TEXTES.fr, ...TEXTES.en]) {
      expect(t.titre + ' ' + t.texte).not.toMatch(interdits);
      expect(t.titre.length).toBeLessThanOrEqual(40);
      expect(t.texte.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('accès à la fonction', () => {
  const secret = 'x'.repeat(40);
  it('seulement avec le secret de la tâche planifiée', () => {
    expect(autorise(`Bearer ${secret}`, secret)).toBe(true);
    expect(autorise(`Bearer ${'y'.repeat(40)}`, secret)).toBe(false);
    expect(autorise(`Bearer ${secret}z`, secret)).toBe(false);
    expect(autorise(null, secret)).toBe(false);
    expect(autorise('Bearer ', '')).toBe(false);
    expect(autorise(`Bearer ${undefined}`, undefined)).toBe(false);
    // Secret trop court : refusé même s'il correspond.
    expect(autorise('Bearer court', 'court')).toBe(false);
  });

  it('index.ts lit les clés dans l’environnement, jamais en dur', () => {
    const index = lire('supabase/functions/envoyer-rappels/index.ts');
    for (const v of ['VAPID_CLE_PRIVEE', 'VAPID_CLE_PUBLIQUE', 'VAPID_SUJET', 'RAPPELS_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
      expect(index).toContain(`Deno.env.get('${v}')`);
    }
    // Aucune clé VAPID (base64url de 43 ou 87 caractères) ni JWT écrit dans le code.
    expect(index).not.toMatch(/['"`][A-Za-z0-9_-]{43,}['"`]/);
    expect(index).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    // Un rappel non délivré dans l'heure est abandonné (jamais tard le soir).
    expect(index).toMatch(/TTL_SECONDES = 3600/);
  });

  it('la planification est écrite mais désactivée, sans secret en clair', () => {
    const plan = lire('supabase/planification/envoyer-rappels.sql');
    expect(plan).toMatch(/cron\.schedule/);
    expect(plan).toMatch(/net\.http_post/);
    expect(plan).toMatch(/active\s*:=\s*false/);
    expect(plan).toMatch(/vault\.decrypted_secrets/);
    expect(plan).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    // Hors des migrations : rien ne s'active en appliquant les migrations.
    expect(plan).toMatch(/Ne pas placer dans supabase\/migrations/);
  });
});
