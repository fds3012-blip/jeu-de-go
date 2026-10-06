# Signalements, blocage et messages en partie (#363, #373)

Décision de Florian du 05/10 : la sécurité entre joueurs passe avant d'attirer des inconnus. Ce document dit ce que le joueur peut faire, ce que fait le serveur et **comment l'équipe consulte les signalements**. Migration : `supabase/migrations/20261005220100_securite_signalements.sql`. Tests : `supabase/tests/securite_signalements.test.sql`, `src/data/securite.test.ts`, `src/app/echanges.test.tsx`, `e2e/securite.spec.ts`.

## Ce que le joueur voit

| Où | Action | Ce qui part |
|---|---|---|
| Profil, ligne « Nous écrire » (moitié de la ligne des conditions) | Bug, idée ou autre chose, texte de 500 caractères au plus | `signalements` (type `bug`, `idee`, `autre`) |
| Problème, après un premier essai : « Cette réponse me semble fausse » | Motif (réponse fausse, consigne pas claire, autre), détail facultatif | `signalements` (type `probleme`, identifiant du problème) |
| Partie en direct ou entre amis : menu « Plus » → « Signaler Léa », ou « Signaler ce joueur » sous la fin de partie, ou en bas de la feuille « Dire » | Motif (aide d'un programme, gâche exprès, part sans finir, pseudo choquant, autre), détail facultatif, case « Bloquer aussi Léa » ; lien « Bloquer Léa » sans signaler | `signalements` (type `joueur`, la partie : le serveur en déduit l'adversaire), `blocages` |
| Mes amis : drapeau sur la ligne d'un ami ou d'une demande reçue | La même feuille, par pseudo | idem, par pseudo |
| Mes amis : « Joueurs bloqués » (seulement s'il y en a) | « Débloquer » | `blocages` (ligne retirée) |
| Partie en direct ou entre amis : « Dire » dans la barre d'actions | 6 messages (« Bonne partie », « Bien joué », « Merci », « Joli coup », « Oups », « À la prochaine ») et 4 émotes de Mochi | `messages_partie` (un code) |
| Feuille « Dire », menu « Plus » de la partie | « Messages de l'adversaire » : oui / non | rien (réglage de l'appareil, `go.echanges.v1`) |

Après un envoi : Mochi, « Merci, on regarde. ». Le joueur signalé n'est jamais prévenu et ne voit ni l'auteur ni le signalement. Un joueur bloqué lit « Ce joueur n'est pas disponible » s'il tente de défier ou de demander en ami, le même refus quel que soit le sens du blocage.

## Règles du serveur

- **Signaler** (`signaler`) : compte avec pseudo ; 10 signalements par 24 heures et par compte (JGS01) ; texte de 500 caractères au plus (JGS02) ; pas soi-même (JGS03) ; un même joueur signalé une seconde fois dans les 24 heures par le même compte : accepté sans nouvelle ligne. Depuis une partie, la cible est l'adversaire lu par le serveur (jamais un identifiant envoyé par le client). Version de l'app et contexte technique (écran, taille de l'écran, langue, navigateur ; 2 Ko au plus) facultatifs.
- **Bloquer** (`bloquer_joueur`, `debloquer_joueur`, `mes_blocages`) : par pseudo ou par partie, 500 au plus (JGB03), pas soi-même (JGB02). Bloquer retire le lien d'amitié ou la demande entre les deux. Ensuite, dans les deux sens : ni demande d'ami, ni défi direct, ni défi par lien rejoint (déclencheurs sur `friendships` et `defis`, JGB01), ni appariement en direct (`find_match`) ni en partie lente (`lente_apparier` de #440, redéfinie dans la même migration). Les messages en partie du joueur bloqué ne parviennent plus (RLS) ; les siens sont acceptés sans être écrits.
- **Dire** (`dire_en_partie`) : partie entre deux humains, en cours ou finie depuis moins de 10 minutes (JGM04) ; un code connu (JGM02) ; 10 messages par partie et par joueur (JGM01) ; 3 secondes entre deux (JGM03). Jamais de texte libre.
- **Pas de modération automatique.** Aucun compte n'est suspendu par le serveur. La vue `signalements_a_revoir` met seulement en tête les joueurs signalés par au moins deux comptes différents.
- **Rétention** : signalements 12 mois après leur envoi ; messages en partie 30 jours (tâche `purger-securite`, chaque nuit à 03:37 UTC). Effacement du compte de l'auteur : ses signalements restent, sans auteur ; ses blocages et ses messages partent avec lui.

## Comment l'équipe consulte (Supabase, éditeur SQL)

Lecture seule par l'éditeur SQL du projet (rôle `postgres`) : l'app ne peut pas lire ces données, la clé service n'est pas nécessaire. Ne jamais exporter un signalement hors de Supabase avec l'e-mail de l'auteur.

**1. Joueurs à revoir en premier** (signalés par au moins deux comptes, signalements nouveaux ou en cours) :

```sql
select pseudo, auteurs, signalements, motifs, premier, dernier, cible_joueur_id
from public.signalements_a_revoir
order by auteurs desc, dernier desc;
```

**2. Derniers signalements** (tous types) :

```sql
select s.id, s.cree_le, s.type, s.motif, s.statut, s.texte,
       a.username as auteur, c.username as joueur_signale, s.partie_id, s.probleme_id, s.version_app
from public.signalements s
left join public.profiles a on a.id = s.auteur_id
left join public.profiles c on c.id = s.cible_joueur_id
where s.statut in ('nouveau', 'en_cours')
order by s.cree_le desc
limit 100;
```

**3. Problèmes à revérifier** :

```sql
select probleme_id, count(*) as signalements, array_agg(distinct motif) as motifs, max(cree_le) as dernier
from public.signalements
where type = 'probleme' and statut in ('nouveau', 'en_cours')
group by probleme_id
order by signalements desc;
```

**4. Revoir une partie signalée** (coups au format SGF, résultat, messages échangés) :

```sql
select g.id, g.size, g.moves, g.result, g.status, b.username as noir, w.username as blanc
from public.games g
left join public.profiles b on b.id = g.black_id
left join public.profiles w on w.id = g.white_id
where g.id = '<partie_id>';

select m.envoye_le, p.username, m.code
from public.messages_partie m join public.profiles p on p.id = m.auteur_id
where m.partie_id = '<partie_id>'
order by m.envoye_le;
```

**5. Répondre à l'auteur** d'un « Nous écrire » : son adresse est celle de son compte (`auth.users.email`), à lire seulement pour lui répondre :

```sql
select u.email from public.signalements s join auth.users u on u.id = s.auteur_id where s.id = <id>;
```

**6. Clore un signalement** (seule écriture de l'équipe ; noter ce qui a été fait, sans donnée inutile) :

```sql
update public.signalements
set statut = 'traite', traite_le = now(), note_equipe = 'Partie revue : rien d''anormal.'
where id = <id>;
-- statuts : nouveau, en_cours, traite, rejete
```

**Notification de l'équipe** : pas d'e-mail automatique pour l'instant (décision à prendre avec Florian, issue #363 : e-mail par fonction serveur ou lecture quotidienne). D'ici là, consulter la requête 2 chaque jour ouvré.

## Parties en direct abandonnées (tâche planifiée)

pg_cron est installé sur le projet (version 1.6.4, vérifié en lecture seule le 05/10 ; tâches existantes : `purger-anonymes-inactifs`, `purger-notifications`). La migration ajoute :

| Tâche | Horaire | Effet |
|---|---|---|
| `clore-parties-direct-abandonnees` | chaque minute | `direct_clore_abandonnees()` : pour chaque partie en direct dont les deux joueurs n'ont donné aucun signe depuis plus de 60 s, la règle d'absence de #360 (`direct_constater`). En jeu : celui qui doit jouer perd au temps (partie annulée si chacun n'a pas encore joué). Au comptage : celui qui est parti le premier perd. La cote bouge une fois, par `apply_game_rating`. 200 parties au plus par passage. |
| `purger-securite` | 03:37 UTC | Signalements de plus de 12 mois, messages en partie de plus de 30 jours. |

Vérifier après application :

```sql
select jobname, schedule, active from cron.job order by jobid;
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
```

Si pg_cron venait à manquer (nouveau projet, branche) : Dashboard Supabase → Database → Extensions → `pg_cron` → Enable, puis rejouer le bloc `do $cron$ … $cron$` de la migration. Sans tâche, une partie dont les deux joueurs sont partis reste « en cours » jusqu'au retour de l'un d'eux (comportement d'avant).

## Hors périmètre

- Pénalité des abandons répétés : attend la fusion des parties lentes (#440). Issue de suivi : #442.
- Émotes dessinées par le designer : en attendant, les quatre humeurs du portrait de Mochi (neutre, content, fier, pensif) de la charte des personnages.
- Son léger à l'arrivée d'une bulle : pas de son dédié dans `src/ui/sound.ts` ; à ajouter avec le designer sonore.
