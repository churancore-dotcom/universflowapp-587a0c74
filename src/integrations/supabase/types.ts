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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      albums: {
        Row: {
          artist: string
          cover_url: string | null
          created_at: string
          id: string
          release_year: number | null
          title: string
        }
        Insert: {
          artist: string
          cover_url?: string | null
          created_at?: string
          id?: string
          release_year?: number | null
          title: string
        }
        Update: {
          artist?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          release_year?: number | null
          title?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          message: string
          starts_at: string
          target_audience: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          starts_at?: string
          target_audience?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          starts_at?: string
          target_audience?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      app_reviews: {
        Row: {
          comment: string | null
          created_at: string
          display_name: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          display_name: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          display_name?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      artists: {
        Row: {
          bio: string | null
          created_at: string
          genre: string | null
          id: string
          is_premium_only: boolean
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          is_premium_only?: boolean
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          is_premium_only?: boolean
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      code_redemptions: {
        Row: {
          id: string
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          action_taken: string | null
          content_id: string
          content_type: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action_taken?: string | null
          content_id: string
          content_type: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action_taken?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          currency: string
          email: string | null
          id: string
          is_anonymous: boolean
          message: string | null
          platform: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          platform: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          platform?: string
          user_id?: string | null
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listening_session_members: {
        Row: {
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "listening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_sessions: {
        Row: {
          created_at: string
          current_song_data: Json | null
          host_user_id: string
          id: string
          is_active: boolean
          is_playing: boolean
          playback_position: number
          session_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_song_data?: Json | null
          host_user_id: string
          id?: string
          is_active?: boolean
          is_playing?: boolean
          playback_position?: number
          session_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_song_data?: Json | null
          host_user_id?: string
          id?: string
          is_active?: boolean
          is_playing?: boolean
          playback_position?: number
          session_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_songs: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          song_id: string
          track_source: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position?: number
          song_id: string
          track_source?: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          song_id?: string
          track_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          is_public: boolean
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_admin: boolean
          share_code: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
          username_changed: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_admin?: boolean
          share_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
          username_changed?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_admin?: boolean
          share_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          username_changed?: boolean
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Relationships: []
      }
      recently_played: {
        Row: {
          id: string
          played_at: string
          song_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          song_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          song_id?: string
          user_id?: string
        }
        Relationships: []
      }
      review_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reactions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "app_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      song_dedications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          sender_id: string
          song_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          sender_id: string
          song_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          sender_id?: string
          song_id?: string
        }
        Relationships: []
      }
      song_requests: {
        Row: {
          artist: string
          audio_url: string
          cover_url: string | null
          created_at: string
          genre: string | null
          id: string
          mood: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          artist: string
          audio_url: string
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          mood?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          artist?: string
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          mood?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          album: string | null
          artist: string
          artist_id: string | null
          audio_url: string
          bitrate: number | null
          bpm: number | null
          cover_size: number | null
          cover_url: string | null
          created_at: string
          download_count: number | null
          duration: number | null
          file_size: number | null
          genre: string | null
          id: string
          is_premium_only: boolean
          is_visible: boolean
          mood: string | null
          play_count: number
          show_in_new_releases: boolean
          show_in_trending: boolean
          title: string
          updated_at: string
        }
        Insert: {
          album?: string | null
          artist: string
          artist_id?: string | null
          audio_url: string
          bitrate?: number | null
          bpm?: number | null
          cover_size?: number | null
          cover_url?: string | null
          created_at?: string
          download_count?: number | null
          duration?: number | null
          file_size?: number | null
          genre?: string | null
          id?: string
          is_premium_only?: boolean
          is_visible?: boolean
          mood?: string | null
          play_count?: number
          show_in_new_releases?: boolean
          show_in_trending?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          album?: string | null
          artist?: string
          artist_id?: string | null
          audio_url?: string
          bitrate?: number | null
          bpm?: number | null
          cover_size?: number | null
          cover_url?: string | null
          created_at?: string
          download_count?: number | null
          duration?: number | null
          file_size?: number | null
          genre?: string | null
          id?: string
          is_premium_only?: boolean
          is_visible?: boolean
          mood?: string | null
          play_count?: number
          show_in_new_releases?: boolean
          show_in_trending?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_songs: {
        Row: {
          album: string | null
          artist: string
          artist_image_url: string | null
          audio_url: string | null
          cover_url: string | null
          created_at: string
          duration: number | null
          genre: string | null
          last_seen_at: string
          metadata: Json
          mood: string | null
          source: string
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          album?: string | null
          artist: string
          artist_image_url?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          genre?: string | null
          last_seen_at?: string
          metadata?: Json
          mood?: string | null
          source?: string
          title: string
          track_id: string
          updated_at?: string
        }
        Update: {
          album?: string | null
          artist?: string
          artist_image_url?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          genre?: string | null
          last_seen_at?: string
          metadata?: Json
          mood?: string | null
          source?: string
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_artist_preferences: {
        Row: {
          artist_image: string | null
          artist_name: string
          artist_source: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          artist_image?: string | null
          artist_name: string
          artist_source?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          artist_image?: string | null
          artist_name?: string
          artist_source?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_library: {
        Row: {
          added_at: string
          id: string
          song_id: string
          track_source: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          song_id: string
          track_source?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          song_id?: string
          track_source?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          platform: Database["public"]["Enums"]["subscription_platform"]
          purchase_token: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_type: Database["public"]["Enums"]["subscription_type"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["subscription_platform"]
          purchase_token?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_type?: Database["public"]["Enums"]["subscription_type"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["subscription_platform"]
          purchase_token?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_type?: Database["public"]["Enums"]["subscription_type"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_profile_by_share_code: {
        Args: { p_share_code: string }
        Returns: {
          avatar_url: string
          user_id: string
          username: string
        }[]
      }
      get_user_count: { Args: never; Returns: number }
      has_premium_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_promo_code:
        | { Args: { p_code: string }; Returns: Json }
        | { Args: { p_code: string; p_user_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_platform: "android" | "ios" | "web" | "donation"
      subscription_status: "active" | "expired" | "cancelled" | "pending"
      subscription_type: "free" | "premium_monthly" | "premium_yearly"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
      subscription_platform: ["android", "ios", "web", "donation"],
      subscription_status: ["active", "expired", "cancelled", "pending"],
      subscription_type: ["free", "premium_monthly", "premium_yearly"],
    },
  },
} as const
