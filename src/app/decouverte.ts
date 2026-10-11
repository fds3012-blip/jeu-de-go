// Partie de découverte (#524) : logique pure de l'écran (src/app/PartieDecouverte.tsx), sans React.
// Avancement gardé sur l'appareil (reprendre où on s'est arrêté), progression par notions, textes dans la langue de
// l'interface. Le scénario et ses preuves : src/content/decouverte.ts et decouverte.test.ts.
import { NOTIONS, SCENARIO, rangNotion, type Notion } from '../content/decouverte';
import { DECOUVERTE_FR, type CleDecouverte } from '../content/decouverte.fr';
import { DECOUVERTE_EN } from '../content/decouverte.en';
import { langue } from '../content/i18n';
import { fr } from '../ui/typo';

export { DECOUVERTE_KEY } from './decouverteEtat';

export interface Avancement {
  /** Index du moment où reprendre (0 : le début). */
  etape: number;
  /** La partie a déjà été menée au bout une fois sur cet appareil (l'XP ne se gagne qu'une fois). */
  fini: boolean;
}

export const AVANCEMENT_VIDE: Avancement = { etape: 0, fini: false };

/** Lit l'avancement gardé ; une valeur abîmée ou d'une autre version du scénario repart du début, sans erreur. */
export function lireAvancement(brut: unknown): Avancement {
  if (!brut || typeof brut !== 'object') return AVANCEMENT_VIDE;
  const { etape, fini } = brut as Partial<Avancement>;
  const ok = typeof etape === 'number' && Number.isInteger(etape) && etape >= 0 && etape < SCENARIO.length;
  return { etape: ok ? etape : 0, fini: fini === true };
}

/** Avancement après avoir atteint le moment `etape` (la reprise repart de là). */
export const avancer = (a: Avancement, etape: number): Avancement => ({ ...a, etape: Math.max(0, Math.min(etape, SCENARIO.length - 1)) });

/** Avancement de la partie terminée : la prochaine ouverture rejoue depuis le début. */
export const terminer = (): Avancement => ({ etape: 0, fini: true });

/** Progression affichée : la notion du moment `i` (1 à 15) sur le nombre total de notions. */
export function progression(i: number): { n: number; total: number; notion: Notion } {
  const m = SCENARIO[Math.max(0, Math.min(i, SCENARIO.length - 1))];
  return { n: rangNotion(m) + 1, total: NOTIONS.length, notion: m.notion };
}

/** Texte de la découverte dans la langue de l'interface, variables `{nom}` remplacées, typographie française. */
export function td(cle: CleDecouverte, vars: Record<string, string | number> = {}): string {
  const en = langue() === 'en';
  const brut = (en ? DECOUVERTE_EN[cle] : DECOUVERTE_FR[cle]) ?? DECOUVERTE_FR[cle];
  const texte = brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
  return en ? texte : fr(texte);
}

/** Texte d'une erreur pendant un coup : celle du coup s'il en a une, sinon celle du moment. */
export function cleErreur(id: string, coup: string, erreurs: readonly string[] = []): CleDecouverte {
  return (erreurs.includes(coup) ? `${id}.non.${coup}` : `${id}.non`) as CleDecouverte;
}
