// Mentions légales (issue #530, art. 6 III de la loi pour la confiance dans l'économie numérique), FR et EN.
// Une seule source pour l'écran de l'app (src/app/MentionsLegales.tsx) et la page statique `/mentions-legales/`
// (`/en/legal-notice/`, outils/referencement/mentions.ts).
//
// Aucune identité, aucune adresse ni aucun numéro n'est inventé : chaque information que seul l'éditeur peut donner est
// un champ `{{…}}`, affiché « À compléter » et surligné tant que Florian ne l'a pas rempli (liste dans
// docs/juridique/mentions-legales.md). Remplir un champ : remplacer `{{…}}` par la valeur, dans les deux langues.
// Un test (src/content/mentionsLegales.test.ts) vérifie la parité FR/EN et que chaque champ reste bien marqué.
import type { Langue } from './i18n/types';

/** Un paragraphe : texte, avec des champs à compléter `{{description}}` et des liens `[texte](adresse)`. */
export interface SectionMentions { id: string; titre: string; paragraphes: string[] }

export interface Mentions { titre: string; intro: string; miseAJour: string; aCompleter: string; sections: SectionMentions[] }

const FR: Mentions = {
  titre: 'Mentions légales',
  intro: 'Qui publie Mochi Go, qui l’héberge, et comment nous joindre.',
  miseAJour: 'Dernière mise à jour : {{date de mise à jour}}.',
  aCompleter: 'À compléter',
  sections: [
    {
      id: 'editeur',
      titre: 'Éditeur',
      paragraphes: [
        'Mochi Go est édité par {{nom et prénom, ou raison sociale et forme juridique}}.',
        'Adresse : {{adresse postale}}.',
        'Immatriculation : {{numéro SIREN ou RCS, le cas échéant}}. Capital social : {{capital, si société}}. TVA intracommunautaire : {{numéro, le cas échéant}}.',
        'Contact : {{adresse e-mail de contact}}, {{numéro de téléphone}}. Tu peux aussi passer par « Nous écrire », dans le Profil de l’app.',
      ],
    },
    {
      id: 'directeur',
      titre: 'Directeur de la publication',
      paragraphes: ['{{nom et prénom du directeur de la publication}}.'],
    },
    {
      id: 'hebergeurs',
      titre: 'Hébergeurs',
      paragraphes: [
        'Site et app : Vercel Inc. (États-Unis), [vercel.com](https://vercel.com). Le site est servi depuis le point du réseau de Vercel le plus proche de toi. Adresse et téléphone : {{adresse et téléphone de Vercel Inc., tirés du contrat}}.',
        'Base de données, comptes et parties en ligne : Supabase Inc. (États-Unis), [supabase.com](https://supabase.com). Serveurs dans l’Union européenne, à Paris (région AWS eu-west-3). Adresse et téléphone : {{adresse et téléphone de Supabase Inc., tirés du contrat}}.',
      ],
    },
    {
      id: 'donnees',
      titre: 'Tes données',
      paragraphes: [
        'Ce que nous gardons, pourquoi et combien de temps : [Conditions et confidentialité](/confidentialite). Délégué à la protection des données : {{nom et contact du DPO, ou « aucun DPO désigné »}}.',
        'Tu peux télécharger une copie de tes données dans l’app : Profil, Conditions et confidentialité, Mes données.',
      ],
    },
    {
      id: 'propriete',
      titre: 'Propriété',
      paragraphes: [
        'Les textes, leçons, problèmes, illustrations et la mascotte Mochi appartiennent à l’éditeur. Tous droits réservés.',
        'Les adversaires les plus forts sont joués par KataGo, une IA de go open source. Moteur adapté de web-katrain (licence MIT).',
      ],
    },
  ],
};

const EN: Mentions = {
  titre: 'Legal notice',
  intro: 'Who publishes Mochi Go, who hosts it, and how to reach us.',
  miseAJour: 'Last updated: {{date of last update}}.',
  aCompleter: 'To be completed',
  sections: [
    {
      id: 'editeur',
      titre: 'Publisher',
      paragraphes: [
        'Mochi Go is published by {{full name, or company name and legal form}}.',
        'Address: {{postal address}}.',
        'Registration: {{SIREN or RCS number, if any}}. Share capital: {{capital, if a company}}. EU VAT number: {{number, if any}}.',
        'Contact: {{contact email address}}, {{phone number}}. You can also use “Write to us” in the app’s Profile.',
      ],
    },
    {
      id: 'directeur',
      titre: 'Publication director',
      paragraphes: ['{{full name of the publication director}}.'],
    },
    {
      id: 'hebergeurs',
      titre: 'Hosting',
      paragraphes: [
        'Website and app: Vercel Inc. (United States), [vercel.com](https://vercel.com). The site is served from the point of Vercel’s network closest to you. Address and phone: {{address and phone of Vercel Inc., from the contract}}.',
        'Database, accounts and online games: Supabase Inc. (United States), [supabase.com](https://supabase.com). Servers in the European Union, in Paris (AWS region eu-west-3). Address and phone: {{address and phone of Supabase Inc., from the contract}}.',
      ],
    },
    {
      id: 'donnees',
      titre: 'Your data',
      paragraphes: [
        'What we keep, why and for how long: [Terms and privacy](/confidentialite?lang=en). Data protection officer: {{name and contact of the DPO, or “no DPO appointed”}}.',
        'You can download a copy of your data in the app: Profile, Terms and privacy, My data.',
      ],
    },
    {
      id: 'propriete',
      titre: 'Ownership',
      paragraphes: [
        'The texts, lessons, problems, illustrations and the Mochi mascot belong to the publisher. All rights reserved.',
        'The strongest opponents are played by KataGo, an open-source Go AI. Engine adapted from web-katrain (MIT license).',
      ],
    },
  ],
};

export const MENTIONS: Record<Langue, Mentions> = { fr: FR, en: EN };

/** Morceau d'un paragraphe : texte, champ à compléter, ou lien. */
export type Morceau = { texte: string } | { aCompleter: string } | { lien: string; adresse: string };

/** Découpe un paragraphe en morceaux (champs `{{…}}`, liens `[texte](adresse)`). */
export function morceaux(paragraphe: string): Morceau[] {
  const r: Morceau[] = [];
  const motif = /\{\{([^}]+)\}\}|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let i = 0;
  for (const m of paragraphe.matchAll(motif)) {
    if (m.index! > i) r.push({ texte: paragraphe.slice(i, m.index) });
    r.push(m[1] !== undefined ? { aCompleter: m[1] } : { lien: m[2], adresse: m[3] });
    i = m.index! + m[0].length;
  }
  if (i < paragraphe.length) r.push({ texte: paragraphe.slice(i) });
  return r;
}

/** Champs encore à compléter, dans une langue (vide quand tout est rempli). */
export function champsACompleter(l: Langue): string[] {
  const m = MENTIONS[l];
  return [m.miseAJour, ...m.sections.flatMap(s => s.paragraphes)].flatMap(p => morceaux(p).flatMap(x => ('aCompleter' in x ? [x.aCompleter] : [])));
}

export { ADRESSE_MENTIONS } from './i18n/donnees';
