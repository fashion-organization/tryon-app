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
    PostgrestVersion: "17.1"
  }
  public: {
    Tables: {
      consents: {
        Row: {
          accepted_at: string
          id: number
          ip: unknown
          type: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: never
          ip?: unknown
          type: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: never
          ip?: unknown
          type?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          buy_url: string | null
          created_at: string
          currency: string
          description: string
          gallery_paths: string[]
          garment_type: string
          id: string
          name: string
          price_cents: number
          shop_name: string
          size_chart: Json
          sizes: string[]
          slug: string
          status: string
          tryon_image_path: string | null
          updated_at: string
        }
        Insert: {
          buy_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          gallery_paths?: string[]
          garment_type: string
          id?: string
          name: string
          price_cents: number
          shop_name: string
          size_chart?: Json
          sizes?: string[]
          slug: string
          status?: string
          tryon_image_path?: string | null
          updated_at?: string
        }
        Update: {
          buy_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          gallery_paths?: string[]
          garment_type?: string
          id?: string
          name?: string
          price_cents?: number
          shop_name?: string
          size_chart?: Json
          sizes?: string[]
          slug?: string
          status?: string
          tryon_image_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          chest_cm: number | null
          created_at: string
          display_name: string | null
          height_cm: number | null
          hips_cm: number | null
          id: string
          is_adult_confirmed_at: string | null
          preferred_units: string
          role: string
          updated_at: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          chest_cm?: number | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id: string
          is_adult_confirmed_at?: string | null
          preferred_units?: string
          role?: string
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          chest_cm?: number | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          is_adult_confirmed_at?: string | null
          preferred_units?: string
          role?: string
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      tryon_jobs: {
        Row: {
          attempts: number
          cost_cents: number | null
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          photo_id: string
          product_id: string
          provider: string
          provider_job_id: string | null
          rating: number | null
          result_path: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          cost_cents?: number | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          photo_id: string
          product_id: string
          provider: string
          provider_job_id?: string | null
          rating?: number | null
          result_path?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          cost_cents?: number | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          photo_id?: string
          product_id?: string
          provider?: string
          provider_job_id?: string | null
          rating?: number | null
          result_path?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryon_jobs_photo_id_user_id_fkey"
            columns: ["photo_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_photos"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tryon_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          reject_reason: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          reject_reason?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          reject_reason?: string | null
          status?: string
          storage_path?: string
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
      is_admin: { Args: never; Returns: boolean }
      set_primary_photo: { Args: { photo_id: string }; Returns: undefined }
      start_tryon_job: {
        Args: {
          p_global_cap: number
          p_photo_id: string
          p_product_id: string
          p_provider: string
          p_user_id: string
          p_user_limit: number
        }
        Returns: {
          job_id: string
          outcome: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
