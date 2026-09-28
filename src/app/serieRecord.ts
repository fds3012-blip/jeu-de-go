// Rien de gagné ne se perd (issue #212). Logique pure, sans React.
// Le record de série est gardé sur l'appareil, à côté de la série (goDuJour.ts). Une série perdue est constatée
// une seule fois à l'ouverture : Mochi accueille le retour sans reproche, et l'événement `serie_perdue` part une fois.
import type { Serie } from './goDuJour';
import { t } from '../content/i18n';

/** Record de série et dernière série perdue déjà constatée (son `dernier` jour réussi). */
export const RECORD_KEY = 'go.serie-record.v1';

export interface EtatRecord {
  /** Plus longue série connue sur cet appareil (ou lue au serveur). */
  record: number;
  /** `dernier` de la série perdue déjà annoncée : on ne l'annonce pas deux fois. */
  perdue: number | null;
}

export const RECORD_VIDE: EtatRecord = { record: 0, perdue: null };

/** Mochi ne parle qu'à partir de 2 jours perdus : « ta série de 1 jour » n'a pas de sens. */
export const MESSAGE_MIN = 2;

/** Relit l'état venu du stockage local, en tolérant les valeurs abîmées. */
export function lireRecord(brut: unknown): EtatRecord {
  const r = (brut ?? {}) as Partial<EtatRecord>;
  const record = Number.isInteger(r.record) && (r.record as number) > 0 ? (r.record as number) : 0;
  const perdue = Number.isInteger(r.perdue) ? (r.perdue as number) : null;
  return { record, perdue };
}

/** Le record ne descend jamais. */
export function avecRecord(etat: EtatRecord, jours: number): EtatRecord {
  const j = Number.isFinite(jours) ? Math.floor(jours) : 0;
  return j > etat.record ? { ...etat, record: j } : etat;
}

export interface Perte {
  /** Longueur de la série perdue. */
  jours: number;
  /** Record après la perte (au moins `jours`). */
  record: number;
  /** Jours manqués depuis la dernière réussite (hors aujourd'hui). */
  manques: number;
}

/**
 * À l'ouverture du jour `numero`, après la réconciliation des gels (gel.ts) : la série est-elle perdue ?
 * Elle l'est si le dernier Go du jour réussi date d'avant-hier ou plus (les gels n'ont pas suffi).
 * Le record prend la série en compte avant tout : un joueur d'avant #212 retrouve donc son record.
 */
export function constaterPerte(serie: Serie | null, etat: EtatRecord, numero: number): { etat: EtatRecord; perte: Perte | null } {
  const base = avecRecord(etat, serie?.jours ?? 0);
  if (!serie || serie.jours < 1) return { etat: base, perte: null };
  const manques = numero - serie.dernier - 1;
  if (manques < 1 || base.perdue === serie.dernier) return { etat: base, perte: null };
  return { etat: { ...base, perdue: serie.dernier }, perte: { jours: serie.jours, record: base.record, manques } };
}

/** Mochi dit-il quelque chose pour cette perte ? */
export const annoncerPerte = (perte: Perte | null): perte is Perte => !!perte && perte.jours >= MESSAGE_MIN;

/** Message de Mochi au retour : jamais de reproche, jamais de « 0 ». */
export function messagePerte(perte: Perte): string {
  const jours = t('profil.jours', { n: perte.jours });
  return perte.jours >= perte.record ? t('serie.perdueRecord', { jours }) : t('serie.perdue', { record: t('profil.jours', { n: perte.record }) });
}
