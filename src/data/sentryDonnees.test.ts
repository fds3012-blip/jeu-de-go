// #474 : aucune donnée personnelle dans les événements Sentry, vérifié avec le vrai SDK (pas un simulacre).
// Constat du 08/10 : l'événement JEU-DE-GO-WEB-1 (27/09) portait l'IP du joueur (`user.ip`), alors que
// `sendDefaultPii: false` était réglé. @sentry/react 11 ne lit plus cette option : c'est `dataCollection.userInfo`.
import { BrowserClient, defaultStackParser } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { SENTRY_OPTIONS } from './analytics';
import { sentrySansUrlSensible } from './urlSensible';

interface Envoi { entete: Record<string, unknown>; evenement: Record<string, unknown> }

/** Client Sentry réel, transport intercepté : on lit l'enveloppe telle qu'elle partirait. */
function client(options: Record<string, unknown>) {
  const envois: Envoi[] = [];
  const c = new BrowserClient({
    dsn: 'https://cle@o1.ingest.de.sentry.io/1',
    integrations: [],
    stackParser: defaultStackParser,
    transport: () => ({
      send: async (enveloppe: unknown) => {
        const [entete, items] = enveloppe as [Record<string, unknown>, [unknown, unknown][]];
        for (const [, evenement] of items) envois.push({ entete, evenement: evenement as Record<string, unknown> });
        return {};
      },
      flush: async () => true,
    }),
    ...options,
  });
  return { c, envois };
}

function inferIp(c: BrowserClient): unknown {
  return (c.getOptions()._metadata?.sdk as { settings?: { infer_ip?: unknown } } | undefined)?.settings?.infer_ip;
}

describe('Sentry : pas d’IP du joueur (#474)', () => {
  it('reproduction : `sendDefaultPii: false` seul laisse Sentry déduire l’IP (SDK 11)', () => {
    const { c } = client({ sendDefaultPii: false });
    expect(inferIp(c)).toBe('auto');
  });

  it('nos réglages demandent à Sentry de ne jamais déduire l’IP', async () => {
    const { c, envois } = client({ ...SENTRY_OPTIONS });
    expect(inferIp(c)).toBe('never');
    c.captureException(new Error('boum'));
    await c.flush(1000);
    expect(envois).toHaveLength(1);
    const ev = envois[0].evenement as { sdk?: { settings?: { infer_ip?: string } }; user?: unknown };
    expect(ev.sdk?.settings?.infer_ip).toBe('never');
    expect(ev.user).toBeUndefined();
  });

  it('beforeSend : l’utilisateur se réduit à son identifiant, cookies retirés', () => {
    const ev = sentrySansUrlSensible({
      user: { id: 'uuid-1', ip_address: '2a02:8440::1', email: 'joueur@exemple.fr', username: 'Florian', geo: { city: 'Paris' } },
      request: { url: 'https://go.example/', cookies: { sb: 'jeton' } },
    });
    expect(ev.user).toEqual({ id: 'uuid-1' });
    expect(ev.request).not.toHaveProperty('cookies');
    const anonyme = sentrySansUrlSensible({ user: { ip_address: '{{auto}}' } });
    expect(anonyme).not.toHaveProperty('user');
  });
});
