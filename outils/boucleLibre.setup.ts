// Issue #586 (setupFiles, vite.config.ts) : aucun test ne doit occuper la boucle d'événements d'un seul bloc trop longtemps.
//
// Un worker de Vitest attend la réponse de chaque message envoyé au processus principal (onTaskUpdate…) au plus 60 s.
// Si un calcul synchrone commence pendant qu'un message est en route et dure plus de 60 s, la réponse n'est lue qu'après
// le calcul : le minuteur expire d'abord, et le passage échoue (« Timeout calling onTaskUpdate », exit 1) alors que tous
// les tests sont verts. Selon le moment exact de l'envoi, une fois sur deux : c'est ce qui faisait échouer la CI.
//
// Ici, un tic toutes les 250 ms mesure le plus long bloc pendant chaque test (et avant lui : collecte, hooks). Au-delà de
// LIMITE_BLOC_MS, le test échoue, à chaque passage, avec son nom : découpe le calcul et rends la main entre deux
// morceaux (`await cederLaMain()`, src/go/preuve-par-coup.ts). Le plus long bloc est noté dans `meta.blocMs`, que le
// résumé de la CI (outils/resumeCi.ts) affiche.
import { performance } from 'node:perf_hooks';
import { setInterval } from 'node:timers';

/** La moitié du délai de Vitest : la CI va jusqu'à deux fois moins vite qu'un poste de développement. */
export const LIMITE_BLOC_MS = 30_000;

declare module 'vitest' {
  interface TaskMeta { blocMs?: number }
}

// Références prises au chargement : vi.useFakeTimers() ne les remplace pas.
const maintenant = () => performance.now();
let dernier = maintenant(), pire = 0;
setInterval(() => {
  const t = maintenant();
  pire = Math.max(pire, t - dernier);
  dernier = t;
}, 250).unref();

/** Plus long bloc depuis le début du test en cours (ou depuis la fin du précédent), en ms. */
export const blocEnCours = () => Math.max(pire, maintenant() - dernier);
const bloc = blocEnCours;
export const messageBloc = (ms: number, ou: string) =>
  `${ou} a occupé la boucle d'événements ${(ms / 1000).toFixed(1)} s d'un seul bloc (limite ${LIMITE_BLOC_MS / 1000} s, ` +
  'Vitest abandonne à 60 s : « Timeout calling onTaskUpdate ») : découpe le calcul et rends la main (await cederLaMain()).';

beforeEach(({ task }) => {
  const avant = bloc();
  pire = 0;
  dernier = maintenant();
  task.meta.blocMs = Math.round(avant);
  if (avant > LIMITE_BLOC_MS) throw new Error(messageBloc(avant, 'Avant ce test, la collecte du fichier ou un hook'));
});

afterEach(({ task }) => {
  const pendant = bloc();
  task.meta.blocMs = Math.round(Math.max(task.meta.blocMs ?? 0, pendant));
  if (pendant > LIMITE_BLOC_MS) throw new Error(messageBloc(pendant, 'Ce test'));
});
