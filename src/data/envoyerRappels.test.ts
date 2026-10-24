// Fonction serveur `envoyer-rappels` (issue #36), avec une base et un service de notification simulés.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  autorise, chargeDuJour, chargeTour, endpointAutorise, envoyerRappels, envoyerTours, estDisparu, TAILLE_LOT, tagTour, TEXTES, TEXTES_TOUR,
  URL_RAPPEL, urlTour, type Abonnement, type Deps, type DepsTours, type Tour,
} from '../../supabase/functions/envoyer-rappels/logique';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const lire = (f: string) => readFileSync(racine + f, 'utf8');

const abo = (i: number, langue = 'fr'): Abonnement => ({
  id: `id-${i}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), langue, jour: '2026-10-01',
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

  // #578 : l'adresse vient du navigateur du joueur, donc du client. Sans liste blanche, la fonction enverrait des
  // requêtes POST vers n'importe quel hôte (SSRF aveugle depuis l'infrastructure Supabase).
  it('n’envoie que vers les services de notification connus, sans supprimer l’abonnement refusé', async () => {
    const piege = { ...abo(9), endpoint: 'https://169.254.169.254.nip.io/latest' };
    const { d, envois } = deps([abo(1), piege]);
    expect(await envoyerRappels(d)).toEqual({ dus: 2, envoyes: 1, supprimes: 0, echecs: 1 });
    expect(envois.map(e => e.a.id)).toEqual(['id-1']);
    expect(d.supprimer).not.toHaveBeenCalled();
  });

  it('liste blanche des services de notification (Chrome, Firefox, Safari, Edge)', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc', 'https://fcm.googleapis.com/wp/abc', 'https://android.googleapis.com/gcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/QAbc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(endpointAutorise(ok), ok).toBe(true);
    for (const non of [
      'http://fcm.googleapis.com/fcm/send/abc', 'https://fcm.googleapis.com.evil.test/x', 'https://evil.test/fcm.googleapis.com/',
      'https://fcm.googleapis.com@evil.test/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x',
      'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://169.254.169.254/latest', 'https://notify.windows.com.evil.test/',
      'https://evilpush.services.mozilla.com.evil.test/', 'https://xjvsalkvpgcjrznznxoi.supabase.co/rest/v1/', 'pas une adresse', '',
      'https://' + 'a'.repeat(1100) + '.fcm.googleapis.com/',
    ]) expect(endpointAutorise(non), non).toBe(false);
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

// ---------- « À toi de jouer » (#699) ----------
// L'horaire (jamais la nuit, une par partie et par heure, trois par jour, fuseau de l'appareil, réglage coupé) est décidé
// par `reclamer_tours` dans la base : supabase/tests/a_toi_de_jouer.test.sql. Ici : l'envoi, les textes, l'adresse ouverte
// au toucher, et un test de contrat qui garde la migration et la fonction d'accord.
const PARTIE = '11111111-0000-4000-8000-0000000000aa';
const tour = (i: number, o: Partial<Tour> = {}): Tour => ({
  id: `id-${i}`, endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), langue: 'fr',
  type: 'tour', partie_id: PARTIE, ...o,
});

function depsTours(dus: Tour[], statut: (t: Tour) => number | Error = () => 201) {
  const envois: { t: Tour; charge: string; tag: string }[] = [];
  const supprimes: string[][] = [];
  const d: DepsTours = {
    reclamer: vi.fn(async () => dus),
    envoyer: vi.fn(async (t: Tour, charge: string, tag: string) => {
      envois.push({ t, charge, tag });
      const s = statut(t);
      if (s instanceof Error) throw s;
      return { statut: s };
    }),
    supprimer: vi.fn(async (ids: string[]) => { supprimes.push(ids); }),
  };
  return { d, envois, supprimes };
}

describe('envoyerTours', () => {
  it('envoie « à toi de jouer » dans la langue de l’appareil, vers la bonne partie', async () => {
    const { d, envois } = depsTours([tour(1), tour(2, { langue: 'en' }), tour(3, { type: 'comptage' })]);
    expect(await envoyerTours(d)).toEqual({ dus: 3, envoyes: 3, supprimes: 0, echecs: 0 });
    const [fr, en, comptage] = envois.map(e => JSON.parse(e.charge));
    expect(fr).toMatchObject({ titre: 'À toi de jouer', url: `/?tour=${PARTIE}` });
    expect(en.titre).toBe('Your move');
    expect(comptage.titre).toBe('On compte la partie');
    // Le sujet web-push est celui du message : une autre poussée de la même partie remplace l’ancienne.
    expect(envois[0].tag).toBe(tagTour(PARTIE));
    expect(envois[0].tag.length).toBeLessThanOrEqual(32);
  });

  it('ne met aucune donnée personnelle dans la notification : pas de pseudo, pas d’adresse, pas de clé', async () => {
    const { d, envois } = depsTours([tour(1)]);
    await envoyerTours(d);
    const charge = JSON.parse(envois[0].charge);
    expect(Object.keys(charge).sort()).toEqual(['tag', 'texte', 'titre', 'url']);
    expect(envois[0].charge).not.toMatch(/fcm|push|Alice|pseudo|p{20}/);
  });

  it('supprime les abonnements disparus (404, 410) une seule fois chacun, garde les autres échecs', async () => {
    // Deux poussées vers le même appareil : un seul abonnement à supprimer.
    const { d, supprimes } = depsTours([tour(1), tour(1, { partie_id: '11111111-0000-4000-8000-0000000000bb' }), tour(3)], t => (t.id === 'id-1' ? 410 : t.id === 'id-3' ? 500 : 201));
    expect(await envoyerTours(d)).toEqual({ dus: 3, envoyes: 0, supprimes: 1, echecs: 1 });
    expect(supprimes).toEqual([['id-1']]);
  });

  it('une erreur réseau compte comme un échec, rien de dû ne fait rien, adresse hors liste jamais appelée', async () => {
    const piege = tour(9, { endpoint: 'https://169.254.169.254.nip.io/latest' });
    const { d, envois } = depsTours([tour(1), tour(2), piege], t => (t.id === 'id-1' ? new Error('réseau') : 201));
    expect(await envoyerTours(d)).toEqual({ dus: 3, envoyes: 1, supprimes: 0, echecs: 2 });
    expect(envois.map(e => e.t.id)).toEqual(['id-1', 'id-2']);
    const vide = depsTours([]);
    expect(await envoyerTours(vide.d)).toEqual({ dus: 0, envoyes: 0, supprimes: 0, echecs: 0 });
    expect(vide.d.envoyer).not.toHaveBeenCalled();
  });

  it('la base en erreur fait échouer l’envoi (l’autre envoi de la fonction continue : index.ts)', async () => {
    const d: DepsTours = { reclamer: async () => { throw new Error('base'); }, envoyer: async () => ({ statut: 201 }), supprimer: async () => {} };
    await expect(envoyerTours(d)).rejects.toThrow('base');
  });
});

describe('textes et adresse de « à toi de jouer »', () => {
  it('sobres : sans fausse urgence, sans compte à rebours, sans nom, courts, en français et en anglais', () => {
    const interdits = /vite|dépêche|dernière chance|perdre|perds|urgent|triste|manque|temps|délai|heure|jour|!|hurry|last chance|lose|losing|sad|miss|time|hour|day|left|🔥/i;
    for (const l of ['fr', 'en'] as const) {
      for (const k of ['tour', 'comptage'] as const) {
        const { titre, texte } = TEXTES_TOUR[l][k];
        expect(`${titre} ${texte}`, `${l}.${k}`).not.toMatch(interdits);
        expect(titre.length).toBeLessThanOrEqual(40);
        expect(texte.length).toBeLessThanOrEqual(80);
      }
    }
    expect(chargeTour({ langue: 'de', type: 'autre', partie_id: PARTIE }).titre).toBe(TEXTES_TOUR.fr.tour.titre);
  });

  it('la notification ouvre la partie ; un identifiant illisible ouvre l’accueil', () => {
    expect(urlTour(PARTIE)).toBe(`/?tour=${PARTIE}`);
    expect(urlTour(PARTIE.toUpperCase())).toBe(`/?tour=${PARTIE}`);
    for (const mauvais of ['', 'abc', `${PARTIE}&x=1`, `//evil.test/${PARTIE}`, '../../x']) expect(urlTour(mauvais)).toBe('/');
  });
});

describe('contrat entre la migration et la fonction (#699)', () => {
  const migration = lire('supabase/migrations/20261025090000_notification_a_toi_de_jouer.sql');
  it('la base garde la nuit, l’heure et le plafond que la fonction suppose', () => {
    // Jamais la nuit : 8 h à 20 h, pour « à toi de jouer » comme pour le rappel du jour.
    expect(migration.match(/between 8 and 19/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toMatch(/interval '1 hour'/);   // une par partie et par heure
    expect(migration).toMatch(/interval '24 hours'\) <= 3/); // trois par 24 heures
    expect(migration).toMatch(/interval '3 days'/);   // plus de poussée d’un vieux tour
  });
  it('seules les parties lentes classées, seulement après l’activation, seulement pour la clé service', () => {
    expect(migration).toMatch(/g\.status = 'active' and g\.rated/);
    expect(migration).toMatch(/n\.creee_le >= a\.tour_depuis/);
    expect(migration).toMatch(/revoke all on function public\.reclamer_tours\(timestamptz\) from public, anon, authenticated;\s+grant execute on function public\.reclamer_tours\(timestamptz\) to service_role;/);
    // Éteint par défaut.
    expect(migration).toMatch(/add column tour boolean not null default false/);
  });
  it('la fonction appelle les deux réclamations de la base et n’embarque aucune clé', () => {
    const index = lire('supabase/functions/envoyer-rappels/index.ts');
    expect(index).toContain("rpc('reclamer_rappels')");
    expect(index).toContain("rpc('reclamer_tours')");
    expect(index).not.toMatch(/BEGIN PRIVATE|VAPID_CLE_PRIVEE\s*=\s*['"]/);
  });
});
