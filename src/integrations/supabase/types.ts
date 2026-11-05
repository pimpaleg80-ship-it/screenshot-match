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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          confidence: number | null
          created_at: string
          date: string
          edit_reason: string | null
          edited_by: string | null
          id: string
          method: string
          person_id: string
          photo_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          confidence?: number | null
          created_at?: string
          date: string
          edit_reason?: string | null
          edited_by?: string | null
          id?: string
          method?: string
          person_id: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          confidence?: number | null
          created_at?: string
          date?: string
          edit_reason?: string | null
          edited_by?: string | null
          id?: string
          method?: string
          person_id?: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      drive_backups: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_link: string | null
          error_message: string | null
          file_name: string
          file_type: "report" | "attendance"
          id: string
          period_end: string | null
          period_start: string | null
          retry_count: number
          status: "pending" | "success" | "failed"
          updated_at: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_link?: string | null
          error_message?: string | null
          file_name: string
          file_type: "report" | "attendance"
          id?: string
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          status?: "pending" | "success" | "failed"
          updated_at?: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_link?: string | null
          error_message?: string | null
          file_name?: string
          file_type?: "report" | "attendance"
          id?: string
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          status?: "pending" | "success" | "failed"
          updated_at?: string
        }
        Relationships: []
      }
      drive_connection: {
        Row: {
          auto_backup_on_pdf: boolean
          connected_at: string
          connected_by: string | null
          daily_backup_enabled: boolean
          google_email: string
          id: string
          refresh_token_encrypted: string
          root_folder_id: string | null
          updated_at: string
        }
        Insert: {
          auto_backup_on_pdf?: boolean
          connected_at?: string
          connected_by?: string | null
          daily_backup_enabled?: boolean
          google_email: string
          id?: string
          refresh_token_encrypted: string
          root_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_backup_on_pdf?: boolean
          connected_at?: string
          connected_by?: string | null
          daily_backup_enabled?: boolean
          google_email?: string
          id?: string
          refresh_token_encrypted?: string
          root_folder_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      face_descriptors: {
        Row: {
          descriptor: Json
          person_id: string
          samples: number
          updated_at: string
        }
        Insert: {
          descriptor: Json
          person_id: string
          samples?: number
          updated_at?: string
        }
        Update: {
          descriptor?: Json
          person_id?: string
          samples?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_descriptors_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          date: string
          id: string
          title: string
        }
        Insert: {
          date: string
          id?: string
          title: string
        }
        Update: {
          date?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean
          consent: boolean
          created_at: string
          department: string
          email: string | null
          id: string
          name: string
          person_code: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          active?: boolean
          consent?: boolean
          created_at?: string
          department?: string
          email?: string | null
          id?: string
          name: string
          person_code: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          active?: boolean
          consent?: boolean
          created_at?: string
          department?: string
          email?: string | null
          id?: string
          name?: string
          person_code?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          data_retention_days: number
          duplicate_scan_minutes: number
          face_match_threshold: number
          half_day_hours: number
          id: number
          late_grace_minutes: number
          org_name: string
          store_photos: boolean
          updated_at: string
          weekly_off_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          data_retention_days?: number
          duplicate_scan_minutes?: number
          face_match_threshold?: number
          half_day_hours?: number
          id?: number
          late_grace_minutes?: number
          org_name?: string
          store_photos?: boolean
          updated_at?: string
          weekly_off_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          data_retention_days?: number
          duplicate_scan_minutes?: number
          face_match_threshold?: number
          half_day_hours?: number
          id?: number
          late_grace_minutes?: number
          org_name?: string
          store_photos?: boolean
          updated_at?: string
          weekly_off_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "kiosk"
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
      app_role: ["admin", "manager", "kiosk"],
    },
  },
} as const
