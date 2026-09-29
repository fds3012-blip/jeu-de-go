// Lien de partie OGS (issue #286) : reconnaissance du lien et téléchargement par l'API publique, avec un fetch simulé.
import { chargerSgfOgs, idPartieOgs, urlSgfOgs } from './ogs';
import { importerSgf, MAX_OCTETS } from './importSgf';

const SGF_OGS = '(;FF[4]CA[UTF-8]GM[1]PC[OGS: https://online-go.com/game/67000001]SZ[9]KM[6.5]PB[a]PW[b];B[ee];W[cc])';

describe('idPartieOgs', () => {
  it('reconnaît les liens de partie OGS', () => {
    expect(idPartieOgs('https://online-go.com/game/67000001')).toBe(67000001);
    expect(idPartieOgs('  online-go.com/game/67000001/  ')).toBe(67000001);
    expect(idPartieOgs('http://www.online-go.com/game/view/123?utm=x')).toBe(123);
    expect(idPartieOgs('https://beta.online-go.com/game/42#chat')).toBe(42);
    expect(idPartieOgs('HTTPS://ONLINE-GO.COM/GAME/7')).toBe(7);
  });

  it('refuse le reste', () => {
    expect(idPartieOgs('')).toBeNull();
    expect(idPartieOgs('https://online-go.com/review/1234')).toBeNull();
    expect(idPartieOgs('https://online-go.com/game/abc')).toBeNull();
    expect(idPartieOgs('https://online-go.com.evil.example/game/1')).toBeNull();
    expect(idPartieOgs('https://evil.example/online-go.com/game/1')).toBeNull();
    expect(idPartieOgs('https://online-go.com/game/0')).toBeNull();
    expect(idPartieOgs('https://www.foxwq.com/game/123')).toBeNull();
    // Un SGF qui cite son lien OGS dans PC[] reste un SGF.
    expect(idPartieOgs(SGF_OGS)).toBeNull();
    expect(idPartieOgs('regarde online-go.com/game/1')).toBeNull();
  });

  it('adresse de l’API publique', () => {
    expect(urlSgfOgs(67000001)).toBe('https://online-go.com/api/v1/games/67000001/sgf');
  });
});

const reponse = (status: number, texte = '') => async () => ({ ok: status >= 200 && status < 300, status, text: async () => texte });

describe('chargerSgfOgs', () => {
  it('télécharge le SGF, sans cookie, puis il se lit', async () => {
    const appels: { url: string; credentials?: string }[] = [];
    const r = await chargerSgfOgs(67000001, async (url, init) => { appels.push({ url, credentials: init?.credentials }); return reponse(200, SGF_OGS)(); });
    expect(appels).toEqual([{ url: 'https://online-go.com/api/v1/games/67000001/sgf', credentials: 'omit' }]);
    expect(r).toMatchObject({ ok: true, texte: SGF_OGS });
    expect(r.ok && importerSgf(r.texte, r.octets).ok).toBe(true);
  });

  it('partie introuvable, privée, serveur en panne', async () => {
    expect(await chargerSgfOgs(1, reponse(404))).toEqual({ ok: false, raison: 'ogs-introuvable' });
    expect(await chargerSgfOgs(1, reponse(403))).toEqual({ ok: false, raison: 'ogs-privee' });
    expect(await chargerSgfOgs(1, reponse(401))).toEqual({ ok: false, raison: 'ogs-privee' });
    expect(await chargerSgfOgs(1, reponse(502))).toEqual({ ok: false, raison: 'ogs-injoignable' });
  });

  it('appel refusé par le navigateur (CORS) ou réseau coupé', async () => {
    expect(await chargerSgfOgs(1, async () => { throw new TypeError('Failed to fetch'); })).toEqual({ ok: false, raison: 'ogs-injoignable' });
  });

  it('délai dépassé : l’appel est annulé', async () => {
    const lent = (_u: string, init?: { signal?: AbortSignal }) => new Promise<never>((_, rejeter) => {
      init?.signal?.addEventListener('abort', () => rejeter(new Error('abort')));
    });
    expect(await chargerSgfOgs(1, lent, 20)).toEqual({ ok: false, raison: 'ogs-injoignable' });
  });

  it('réponse trop grosse', async () => {
    expect(await chargerSgfOgs(1, reponse(200, 'x'.repeat(MAX_OCTETS + 1)))).toEqual({ ok: false, raison: 'trop-gros' });
  });
});
