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
          created_at: string
          rating: number
          size: number
          user_id: string
        }
        Insert: {
          created_at?: string
          rating: number
          size: number
          user_id: string
        }
        Update: {
          created_at?: string
          rating?: number
          size?: number
          user_id?: string
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
      rating_history: {
        Row: {
          created_at: string
          game_id: string | null
          id: number
          kind: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id?: string | null
          id?: never
          kind: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string | null
          id?: never
          kind?: string
          rating?: number
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
      creer_defi: {
        Args: never
        Returns: {
          jeton: string
          partie_id: string
        }[]
      }
      defier_ami: { Args: { p_pseudo: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
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
      exiger_compte_avec_pseudo: { Args: never; Returns: string }
      find_match: { Args: { p_size: number }; Returns: string }
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
      heure_rappel: { Args: { p_moment: string }; Returns: number }
      importer_serie_appareil: {
        Args: { p_dernier_jour: string; p_jours: number }
        Returns: number
      }
      join_game: { Args: { p_code: string }; Returns: string }
      joueur_par_pseudo: { Args: { p_pseudo: string }; Returns: string }
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
      mes_amis: {
        Args: never
        Returns: {
          depuis: string
          etat: string
          pseudo: string
        }[]
      }
      play_move: { Args: { p_game: string; p_move: string }; Returns: string }
      preparer_rattachement: { Args: never; Returns: string }
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
      rejoindre_defi: { Args: { p_jeton: string }; Returns: string }
      repondre_ami: {
        Args: { p_accepter: boolean; p_pseudo: string }
        Returns: string
      }
      resign_game: { Args: { p_game: string }; Returns: string }
      retirer_ami: { Args: { p_pseudo: string }; Returns: undefined }
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
