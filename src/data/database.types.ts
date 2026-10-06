// Fichier généré par Supabase (generate_typescript_types) : ne pas modifier à la main.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abonnements_rappel: {
        Row: {
          auth: string
          cree_le: string
          dernier_envoi: string | null
          endpoint: string
          fuseau: string
          id: string
          langue: string
          moment: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          cree_le?: string
          dernier_envoi?: string | null
          endpoint: string
          fuseau?: string
          id?: string
          langue?: string
          moment?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          cree_le?: string
          dernier_envoi?: string | null
          endpoint?: string
          fuseau?: string
          id?: string
          langue?: string
          moment?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id?: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocages: {
        Row: {
          bloque_id: string
          bloqueur_id: string
          cree_le: string
        }
        Insert: {
          bloque_id: string
          bloqueur_id: string
          cree_le?: string
        }
        Update: {
          bloque_id?: string
          bloqueur_id?: string
          cree_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocages_bloque_id_fkey"
            columns: ["bloque_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocages_bloque_id_fkey"
            columns: ["bloque_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocages_bloqueur_id_fkey"
            columns: ["bloqueur_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocages_bloqueur_id_fkey"
            columns: ["bloqueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_ami_journal: {
        Row: {
          demandeur_id: string
          destinataire_id: string
          envoyee_le: string
          id: number
        }
        Insert: {
          demandeur_id: string
          destinataire_id: string
          envoyee_le?: string
          id?: never
        }
        Update: {
          demandeur_id?: string
          destinataire_id?: string
          envoyee_le?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "demandes_ami_journal_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_ami_journal_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      defis: {
        Row: {
          cree_le: string
          createur_id: string | null
          date_limite: string | null
          delai_coup: unknown
          invite_id: string | null
          jeton: string
          lien_expire_le: string
          partie_id: string
        }
        Insert: {
          cree_le?: string
          createur_id?: string | null
          date_limite?: string | null
          delai_coup?: unknown
          invite_id?: string | null
          jeton: string
          lien_expire_le?: string
          partie_id: string
        }
        Update: {
          cree_le?: string
          createur_id?: string | null
          date_limite?: string | null
          delai_coup?: unknown
          invite_id?: string | null
          jeton?: string
          lien_expire_le?: string
          partie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defis_createur_id_fkey"
            columns: ["createur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defis_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defis_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      file_lente: {
        Row: {
          created_at: string
          delai_jours: number
          partie_id: string | null
          rating: number
          rd: number
          size: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delai_jours: number
          partie_id?: string | null
          rating: number
          rd?: number
          size: number
          user_id: string
        }
        Update: {
          created_at?: string
          delai_jours?: number
          partie_id?: string | null
          rating?: number
          rd?: number
          size?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_lente_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_lente_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_lente_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      go_du_jour_resultats: {
        Row: {
          essais: number
          etat: string
          maj_le: string
          numero: number
          user_id: string
        }
        Insert: {
          essais?: number
          etat?: string
          maj_le?: string
          numero: number
          user_id: string
        }
        Update: {
          essais?: number
          etat?: string
          maj_le?: string
          numero?: number
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          analysis: Json | null
          black_id: string | null
          bot_id: string | null
          counting: boolean
          created_at: string
          created_by: string
          dead_proposed_by: string | null
          dead_stones: string | null
          handicap: number
          id: string
          invite_code: string | null
          komi: number
          moves: string
          prive: boolean
          rated: boolean
          result: string | null
          resumed_at: number
          rules: string
          score_black: number | null
          score_white: number | null
          size: number
          status: Database["public"]["Enums"]["game_status"]
          updated_at: string
          white_id: string | null
        }
        Insert: {
          analysis?: Json | null
          black_id?: string | null
          bot_id?: string | null
          counting?: boolean
          created_at?: string
          created_by?: string
          dead_proposed_by?: string | null
          dead_stones?: string | null
          handicap?: number
          id?: string
          invite_code?: string | null
          komi?: number
          moves?: string
          prive?: boolean
          rated?: boolean
          result?: string | null
          resumed_at?: number
          rules?: string
          score_black?: number | null
          score_white?: number | null
          size: number
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          white_id?: string | null
        }
        Update: {
          analysis?: Json | null
          black_id?: string | null
          bot_id?: string | null
          counting?: boolean
          created_at?: string
          created_by?: string
          dead_proposed_by?: string | null
          dead_stones?: string | null
          handicap?: number
          id?: string
          invite_code?: string | null
          komi?: number
          moves?: string
          prive?: boolean
          rated?: boolean
          result?: string | null
          resumed_at?: number
          rules?: string
          score_black?: number | null
          score_white?: number | null
          size?: number
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          white_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_dead_proposed_by_fkey"
            columns: ["dead_proposed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_dead_proposed_by_fkey"
            columns: ["dead_proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          lesson_id: string
          steps_done: number
          updated_at: string
          user_id: string
        }
        Insert: {
          lesson_id: string
          steps_done?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          lesson_id?: string
          steps_done?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_queue: {
        Row: {
          cadence: string
          created_at: string
          rating: number
          rd: number
          regles: string
          size: number
          user_id: string
          vu_le: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          rating: number
          rd?: number
          regles?: string
          size: number
          user_id: string
          vu_le?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          rating?: number
          rd?: number
          regles?: string
          size?: number
          user_id?: string
          vu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_partie: {
        Row: {
          auteur_id: string
          code: string
          envoye_le: string
          id: number
          partie_id: string
        }
        Insert: {
          auteur_id: string
          code: string
          envoye_le?: string
          id?: never
          partie_id: string
        }
        Update: {
          auteur_id?: string
          code?: string
          envoye_le?: string
          id?: never
          partie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_partie_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_partie_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_partie_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          creee_le: string
          destinataire_id: string
          id: number
          lue_le: string | null
          partie_id: string | null
          type: string
        }
        Insert: {
          creee_le?: string
          destinataire_id: string
          id?: never
          lue_le?: string | null
          partie_id?: string | null
          type: string
        }
        Update: {
          creee_le?: string
          destinataire_id?: string
          id?: never
          lue_le?: string | null
          partie_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      parties_direct: {
        Row: {
          blanc_ms: number
          blanc_periodes: number
          blanc_vu_le: string | null
          cadence: string
          comptage_depuis: string | null
          cree_le: string
          main_ms: number
          noir_ms: number
          noir_periodes: number
          noir_vu_le: string | null
          partie_id: string
          periode_ms: number
          periodes: number
          trait_depuis: string | null
        }
        Insert: {
          blanc_ms: number
          blanc_periodes: number
          blanc_vu_le?: string | null
          cadence: string
          comptage_depuis?: string | null
          cree_le?: string
          main_ms: number
          noir_ms: number
          noir_periodes: number
          noir_vu_le?: string | null
          partie_id: string
          periode_ms: number
          periodes: number
          trait_depuis?: string | null
        }
        Update: {
          blanc_ms?: number
          blanc_periodes?: number
          blanc_vu_le?: string | null
          cadence?: string
          comptage_depuis?: string | null
          cree_le?: string
          main_ms?: number
          noir_ms?: number
          noir_periodes?: number
          noir_vu_le?: string | null
          partie_id?: string
          periode_ms?: number
          periodes?: number
          trait_depuis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_direct_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      parties_partagees: {
        Row: {
          adversaire: string | null
          coup: number
          cree_le: string
          empreinte: string
          jeton: string
          joueur: number | null
          sgf: string
          taille: number
          user_id: string
        }
        Insert: {
          adversaire?: string | null
          coup?: number
          cree_le?: string
          empreinte: string
          jeton: string
          joueur?: number | null
          sgf: string
          taille: number
          user_id: string
        }
        Update: {
          adversaire?: string | null
          coup?: number
          cree_le?: string
          empreinte?: string
          jeton?: string
          joueur?: number | null
          sgf?: string
          taille?: number
          user_id?: string
        }
        Relationships: []
      }
      parties_perso: {
        Row: {
          adversaire: string | null
          cle: string
          cree_le: string
          id: string
          joue_le: string
          joueur: number | null
          mode: string
          resultat: string | null
          sgf: string
          taille: number
          user_id: string
        }
        Insert: {
          adversaire?: string | null
          cle: string
          cree_le?: string
          id?: string
          joue_le: string
          joueur?: number | null
          mode: string
          resultat?: string | null
          sgf: string
          taille: number
          user_id: string
        }
        Update: {
          adversaire?: string | null
          cle?: string
          cree_le?: string
          id?: string
          joue_le?: string
          joueur?: number | null
          mode?: string
          resultat?: string | null
          sgf?: string
          taille?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          conditions_acceptees_le: string | null
          conditions_version: string | null
          cote_depart: string | null
          cote_depart_kyu: number | null
          cote_depart_le: string | null
          cote_maj_le: string | null
          cote_parties: number
          cote_provisoire: boolean
          cote_rd: number
          cote_vol: number
          country: string | null
          created_at: string
          id: string
          puzzle_rating: number
          rating: number
          streak_days: number
          streak_freezes: number
          streak_frozen_days: string[]
          streak_last: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          conditions_acceptees_le?: string | null
          conditions_version?: string | null
          cote_depart?: string | null
          cote_depart_kyu?: number | null
          cote_depart_le?: string | null
          cote_maj_le?: string | null
          cote_parties?: number
          cote_provisoire?: never
          cote_rd?: number
          cote_vol?: number
          country?: string | null
          created_at?: string
          id: string
          puzzle_rating?: number
          rating?: number
          streak_days?: number
          streak_freezes?: number
          streak_frozen_days?: string[]
          streak_last?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          conditions_acceptees_le?: string | null
          conditions_version?: string | null
          cote_depart?: string | null
          cote_depart_kyu?: number | null
          cote_depart_le?: string | null
          cote_maj_le?: string | null
          cote_parties?: number
          cote_provisoire?: never
          cote_rd?: number
          cote_vol?: number
          country?: string | null
          created_at?: string
          id?: string
          puzzle_rating?: number
          rating?: number
          streak_days?: number
          streak_freezes?: number
          streak_frozen_days?: string[]
          streak_last?: string | null
          username?: string | null
        }
        Relationships: []
      }
      puzzle_attempts: {
        Row: {
          created_at: string
          id: number
          puzzle_id: string
          rating_after: number
          solved: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          puzzle_id: string
          rating_after: number
          solved: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          puzzle_id?: string
          rating_after?: number
          solved?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_attempts_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzle_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzle_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzles: {
        Row: {
          answers: string[]
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          owner_id: string | null
          prompt: string | null
          setup: Json
          size: number
          source_game: string | null
          title: string | null
        }
        Insert: {
          answers: string[]
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id: string
          owner_id?: string | null
          prompt?: string | null
          setup: Json
          size: number
          source_game?: string | null
          title?: string | null
        }
        Update: {
          answers?: string[]
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          owner_id?: string | null
          prompt?: string | null
          setup?: Json
          size?: number
          source_game?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puzzles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzles_source_game_fkey"
            columns: ["source_game"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      rattachements_anonymes: {
        Row: {
          anonyme_id: string
          code_hash: string
          cree_le: string
          expire_le: string
        }
        Insert: {
          anonyme_id: string
          code_hash: string
          cree_le?: string
          expire_le: string
        }
        Update: {
          anonyme_id?: string
          code_hash?: string
          cree_le?: string
          expire_le?: string
        }
        Relationships: []
      }
      rappels_go_du_jour: {
        Row: {
          destinataire_id: string
          envoye_le: string
          expediteur_id: string
          numero: number
        }
        Insert: {
          destinataire_id: string
          envoye_le?: string
          expediteur_id: string
          numero: number
        }
        Update: {
          destinataire_id?: string
          envoye_le?: string
          expediteur_id?: string
          numero?: number
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          created_at: string
          game_id: string | null
          id: number
          ecart: number | null
          kind: string
          rating: number
          rd: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ecart?: number | null
          game_id?: string | null
          id?: never
          kind: string
          rating: number
          rd?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          ecart?: number | null
          game_id?: string | null
          id?: never
          kind?: string
          rating?: number
          rd?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          auteur_id: string | null
          cible_joueur_id: string | null
          contexte: Json | null
          cree_le: string
          id: number
          motif: string | null
          note_equipe: string | null
          partie_id: string | null
          probleme_id: string | null
          statut: string
          texte: string | null
          traite_le: string | null
          type: string
          version_app: string | null
        }
        Insert: {
          auteur_id?: string | null
          cible_joueur_id?: string | null
          contexte?: Json | null
          cree_le?: string
          id?: never
          motif?: string | null
          note_equipe?: string | null
          partie_id?: string | null
          probleme_id?: string | null
          statut?: string
          texte?: string | null
          traite_le?: string | null
          type: string
          version_app?: string | null
        }
        Update: {
          auteur_id?: string | null
          cible_joueur_id?: string | null
          contexte?: Json | null
          cree_le?: string
          id?: never
          motif?: string | null
          note_equipe?: string | null
          partie_id?: string | null
          probleme_id?: string | null
          statut?: string
          texte?: string | null
          traite_le?: string | null
          type?: string
          version_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_cible_joueur_id_fkey"
            columns: ["cible_joueur_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_cible_joueur_id_fkey"
            columns: ["cible_joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_partie_id_fkey"
            columns: ["partie_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          country: string | null
          id: string | null
          rank: number | null
          rating: number | null
          username: string | null
        }
        Relationships: []
      }
      signalements_a_revoir: {
        Row: {
          auteurs: number | null
          cible_joueur_id: string | null
          dernier: string | null
          motifs: string[] | null
          premier: string | null
          pseudo: string | null
          signalements: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accepter_conditions: { Args: { p_version: string }; Returns: string }
      apply_game_rating: {
        Args: { p_game: string; p_loser: string; p_winner: string }
        Returns: undefined
      }
      apercu_defi: {
        Args: { p_jeton: string }
        Returns: {
          createur_pseudo: string | null
          etat: string
          ma_place: string | null
          taille: number
        }[]
      }
      bilan_semaine: { Args: { p_precedente?: boolean }; Returns: Json }
      bloquer_joueur: {
        Args: { p_partie?: string; p_pseudo?: string }
        Returns: boolean
      }
      cadence_direct: {
        Args: { p_cadence: string }
        Returns: {
          main_ms: number
          periode_ms: number
          periodes: number
        }[]
      }
      chercher_partie_lente: {
        Args: { p_delai_jours?: number; p_size?: number }
        Returns: string
      }
      choisir_depart_cote: {
        Args: { p_depart: string; p_kyu?: number }
        Returns: number
      }
      classement_go_du_jour: {
        Args: never
        Returns: {
          essais: number | null
          etat: string
          moi: boolean
          pseudo: string
          rappele: boolean
        }[]
      }
      cote_rd_apres_absence: {
        Args: { p_depuis: string; p_maintenant: string; p_rd: number; p_vol: number }
        Returns: number
      }
      creer_defi: {
        Args: never
        Returns: {
          jeton: string
          partie_id: string
        }[]
      }
      debloquer_joueur: { Args: { p_pseudo: string }; Returns: boolean }
      defier_ami: { Args: { p_pseudo: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      dire_en_partie: {
        Args: { p_code: string; p_partie: string }
        Returns: boolean
      }
      direct_clore_abandonnees: { Args: never; Returns: number }
      direct_constater: {
        Args: { p_appelant: string; p_partie: string }
        Returns: string
      }
      direct_en_cours: { Args: { p_uid: string }; Returns: string }
      demander_ami: { Args: { p_pseudo: string }; Returns: string }
      enregistrer_abonnement_rappel: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_fuseau: string
          p_langue: string
          p_moment: string
          p_p256dh: string
        }
        Returns: string
      }
      enregistrer_parties_perso: { Args: { p_parties: Json }; Returns: string[] }
      lire_partie_partagee: {
        Args: { p_jeton: string }
        Returns: {
          adversaire: string | null
          coup: number
          cree_le: string
          joueur: number | null
          pseudo: string | null
          sgf: string
          taille: number
        }[]
      }
      partager_partie: {
        Args: { p_adversaire: string | null; p_coup: number; p_joueur: number | null; p_sgf: string; p_taille: number }
        Returns: string
      }
      retirer_partie_partagee: { Args: { p_jeton: string }; Returns: boolean }
      sgf_partageable: { Args: { p_sgf: string }; Returns: boolean }
      est_bloque: { Args: { p_a: string; p_b: string }; Returns: boolean }
      exiger_compte_avec_pseudo: { Args: never; Returns: string }
      find_match: {
        Args: { p_cadence?: string; p_regles?: string; p_size: number }
        Returns: string
      }
      finish_game_by_score: {
        Args: {
          p_black: number
          p_dead: string
          p_game: string
          p_moves: string
          p_result: string
          p_user: string
          p_white: number
        }
        Returns: string
      }
      glicko2: {
        Args: {
          p_adv_cotes: number[]
          p_adv_rd: number[]
          p_cote: number
          p_rd: number
          p_scores: number[]
          p_vol: number
        }
        Returns: {
          cote: number
          rd: number
          vol: number
        }[]
      }
      glicko2_f: {
        Args: {
          p_a: number
          p_delta: number
          p_phi: number
          p_tau: number
          p_v: number
          p_x: number
        }
        Returns: number
      }
      heure_rappel:{ Args: { p_moment: string }; Returns: number }
      marquer_notifications_lues: {
        Args: { p_partie?: string; p_type?: string }
        Returns: number
      }
      purger_notifications: { Args: never; Returns: number }
      importer_serie_appareil: {
        Args: { p_dernier_jour: string; p_jours: number }
        Returns: number
      }
      join_game: { Args: { p_code: string }; Returns: string }
      joueur_par_pseudo: { Args: { p_pseudo: string }; Returns: string }
      lente_apparier: {
        Args: { p_present: boolean; p_uid: string }
        Returns: string
      }
      lentes_en_cours: { Args: { p_uid: string }; Returns: number }
      lentes_tache: {
        Args: never
        Returns: {
          creees: number
          finies: number
        }[]
      }
      jouer_coup_defi: {
        Args: {
          p_comptage?: boolean
          p_coup: string
          p_coups_avant: string
          p_joueur: string
          p_partie: string
        }
        Returns: Json
      }
      mes_blocages: {
        Args: never
        Returns: {
          depuis: string
          pseudo: string
        }[]
      }
      mes_amis: {
        Args: never
        Returns: {
          depuis: string
          etat: string
          pseudo: string
        }[]
      }
      mes_records: { Args: never; Returns: Json }
      noter_go_du_jour: {
        Args: { p_numero: number; p_resultat: string }
        Returns: string
      }
      numero_go_du_jour: { Args: { p_jour?: string }; Returns: number }
      pendule_apres: {
        Args: {
          p_ecoule_ms: number
          p_main_ms: number
          p_periode_ms: number
          p_periodes: number
        }
        Returns: {
          main_ms: number
          periodes: number
          tombe: boolean
        }[]
      }
      pendule_direct: { Args: { p_partie: string }; Returns: Json }
      play_move: { Args: { p_game: string; p_move: string }; Returns: string }
      preparer_rattachement: { Args: never; Returns: string }
      purger_securite: { Args: never; Returns: undefined }
      quitter_file_attente: { Args: never; Returns: string }
      quitter_file_lente: { Args: never; Returns: string }
      rappeler_go_du_jour: { Args: { p_pseudo: string }; Returns: string }
      rattacher_session_anonyme: { Args: { p_code: string }; Returns: number }
      reclamer_rappels: {
        Args: { p_maintenant?: string }
        Returns: {
          auth: string
          endpoint: string
          id: string
          jour: string
          langue: string
          p256dh: string
        }[]
      }
      record_puzzle_attempt: {
        Args: { p_puzzle: string; p_solved: boolean }
        Returns: number
      }
      refuser_partie_direct: { Args: { p_partie: string }; Returns: boolean }
      rejoindre_defi: { Args: { p_jeton: string }; Returns: string }
      repondre_ami: {
        Args: { p_accepter: boolean; p_pseudo: string }
        Returns: string
      }
      resign_game: { Args: { p_game: string }; Returns: string }
      retirer_ami: { Args: { p_pseudo: string }; Returns: undefined }
      signaler: {
        Args: {
          p_contexte?: Json
          p_motif?: string
          p_partie?: string
          p_probleme?: string
          p_pseudo?: string
          p_texte?: string
          p_type: string
          p_version?: string
        }
        Returns: boolean
      }
      victoire_au_temps: { Args: { p_partie: string }; Returns: string }
    }
    Enums: {
      friend_status: "pending" | "accepted"
      game_status: "waiting" | "active" | "finished" | "aborted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      friend_status: ["pending", "accepted"],
      game_status: ["waiting", "active", "finished", "aborted"],
    },
  },
} as const
