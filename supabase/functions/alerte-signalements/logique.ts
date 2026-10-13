// Logique de la fonction serveur `alerte-signalements` (issue #531), sans dépendance : testée par Vitest
// (src/data/alerteSignalements.test.ts) avec une base et un service d'e-mail simulés. index.ts la branche sur
// Supabase et sur l'API de Resend (le service qui envoie déjà les e-mails de connexion).
//
// Règles :
// - la base prépare le résumé et le note (`reclamer_resume_signalements`) : deux appels ne comptent pas deux fois ;
// - un e-mail seulement s'il y a du nouveau (signalement, joueur à revoir ou pseudo à revoir) ;
// - jamais de texte libre de signalement ni de pseudo dans l'e-mail : des nombres, et un lien vers Supabase, où
//   l'équipe lit le détail (connectée à son compte).

/** Résumé rendu par `reclamer_resume_signalements` (supabase/migrations/20261013120100_moderation.sql). */
export interface Resume {
  depuis: string;
  jusqua: string;
  nouveaux: number;
  par_type: Partial<Record<'joueur' | 'probleme' | 'bug' | 'idee' | 'autre', number>>;
  joueurs_signales: number;
  a_revoir: number;
  en_attente: number;
  pseudos_a_revoir: number;
}

export interface Email { sujet: string; texte: string; html: string }

export interface Deps {
  reclamer(): Promise<Resume>;
  envoyer(e: Email): Promise<{ ok: boolean; statut: number }>;
}

/** `rien` : aucun e-mail à envoyer ; sinon `envoye` dit si Resend l'a accepté. */
export type Bilan = { rien: boolean; envoye: boolean; nouveaux: number; statut?: number };

/** Compare le jeton reçu au secret partagé avec la tâche planifiée, en temps constant. 32 caractères au moins. */
export function autorise(entete: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !entete) return false;
  const recu = entete.replace(/^Bearer\s+/i, '');
  if (recu.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= recu.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const TYPES: [keyof Resume['par_type'], string][] = [
  ['joueur', 'joueurs signalés'], ['probleme', 'problèmes (réponse ou énoncé)'], ['bug', 'bugs'], ['idee', 'idées'], ['autre', 'autres messages'],
];

const nombre = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
const echapper = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Vrai s'il y a de quoi écrire à l'équipe. */
export function aSignaler(r: Resume): boolean {
  return nombre(r.nouveaux) > 0 || nombre(r.a_revoir) > 0 || nombre(r.pseudos_a_revoir) > 0;
}

/** L'e-mail à l'équipe : des nombres et un lien, rien d'autre. `lien` : la page de Supabase où lire le détail. */
export function composerEmail(r: Resume, lien: string): Email {
  const n = nombre(r.nouveaux);
  const sujet = n > 0 ? `Mochi Go : ${n} nouveau${n > 1 ? 'x' : ''} signalement${n > 1 ? 's' : ''}` : 'Mochi Go : modération à revoir';
  const lignes = [
    `${n} nouveau${n > 1 ? 'x' : ''} signalement${n > 1 ? 's' : ''} depuis le dernier résumé.`,
    ...TYPES.filter(([k]) => nombre(r.par_type?.[k]) > 0).map(([k, nom]) => `- ${nom} : ${nombre(r.par_type[k])}`),
    `Joueurs différents signalés : ${nombre(r.joueurs_signales)}.`,
    `Joueurs signalés par au moins deux comptes (vue signalements_a_revoir) : ${nombre(r.a_revoir)}.`,
    `Signalements encore « nouveau » au total : ${nombre(r.en_attente)}.`,
    `Pseudos avec un mot interdit (vue pseudos_a_revoir) : ${nombre(r.pseudos_a_revoir)}.`,
    '',
    `Lire le détail dans Supabase : ${lien}`,
    'Marche à suivre : docs/produit/signalements-et-blocage.md et docs/architecture/securite.md.',
  ];
  const texte = lignes.join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${lignes
    .map(l => (l === '' ? '<br>' : l.startsWith('Lire le détail')
      ? `<p><a href="${echapper(lien)}">Lire le détail dans Supabase</a></p>`
      : `<p style="margin:0 0 6px">${echapper(l)}</p>`))
    .join('')}</div>`;
  return { sujet, texte, html };
}

/** Prépare le résumé et l'envoie s'il y a du nouveau. */
export async function alerter(d: Deps, lien: string): Promise<Bilan> {
  const r = await d.reclamer();
  if (!aSignaler(r)) return { rien: true, envoye: false, nouveaux: 0 };
  const { ok, statut } = await d.envoyer(composerEmail(r, lien));
  return { rien: false, envoye: ok, nouveaux: nombre(r.nouveaux), statut };
}

/** Lien vers l'éditeur de tables du projet, tiré de l'adresse Supabase (`https://<ref>.supabase.co`). */
export function lienTableau(supabaseUrl: string): string {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(supabaseUrl)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/editor` : 'https://supabase.com/dashboard';
}
