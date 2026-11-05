export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          user_id: string | null;
          employee_code: string;
          full_name: string;
          email: string;
          phone: string | null;
          department_id: string | null;
          designation: string | null;
          manager_id: string | null;
          joining_date: string | null;
          status: string;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          employee_code: string;
          full_name: string;
          email: string;
          phone?: string | null;
          department_id?: string | null;
          designation?: string | null;
          manager_id?: string | null;
          joining_date?: string | null;
          status?: string;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          employee_code?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          department_id?: string | null;
          designation?: string | null;
          manager_id?: string | null;
          joining_date?: string | null;
          status?: string;
          photo_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      face_data: {
        Row: {
          id: string;
          employee_id: string;
          descriptor: Json;
          consent: boolean;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          descriptor: Json;
          consent?: boolean;
          enrolled_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          descriptor?: Json;
          consent?: boolean;
          enrolled_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "face_data_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: true;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          check_in: string | null;
          check_out: string | null;
          status: Database["public"]["Enums"]["attendance_status"];
          method: string;
          confidence: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          date: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          method?: string;
          confidence?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          date?: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          method?: string;
          confidence?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_types: {
        Row: {
          id: string;
          name: string;
          days_per_year: number;
          is_paid: boolean;
          active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          days_per_year?: number;
          is_paid?: boolean;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          days_per_year?: number;
          is_paid?: boolean;
          active?: boolean;
        };
        Relationships: [];
      };
      leave_balances: {
        Row: {
          id: string;
          employee_id: string;
          leave_type_id: string;
          year: number;
          total: number;
          used: number;
          remaining: number;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type_id: string;
          year: number;
          total?: number;
          used?: number;
        };
        Update: {
          id?: string;
          employee_id?: string;
          leave_type_id?: string;
          year?: number;
          total?: number;
          used?: number;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey";
            columns: ["leave_type_id"];
            isOneToOne: false;
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          leave_type_id: string;
          from_date: string;
          to_date: string;
          days: number;
          half_day: boolean;
          reason: string | null;
          attachment_url: string | null;
          status: Database["public"]["Enums"]["leave_status"];
          manager_id: string | null;
          manager_comment: string | null;
          admin_id: string | null;
          admin_comment: string | null;
          applied_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type_id: string;
          from_date: string;
          to_date: string;
          days: number;
          half_day?: boolean;
          reason?: string | null;
          attachment_url?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          manager_id?: string | null;
          manager_comment?: string | null;
          admin_id?: string | null;
          admin_comment?: string | null;
          applied_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          leave_type_id?: string;
          from_date?: string;
          to_date?: string;
          days?: number;
          half_day?: boolean;
          reason?: string | null;
          attachment_url?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          manager_id?: string | null;
          manager_comment?: string | null;
          admin_id?: string | null;
          admin_comment?: string | null;
          applied_at?: string;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey";
            columns: ["leave_type_id"];
            isOneToOne: false;
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          id: string;
          date: string;
          title: string;
          description: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          date: string;
          title: string;
          description?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          date?: string;
          title?: string;
          description?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          message: string;
          attachment_url: string | null;
          target: string;
          target_department_id: string | null;
          target_employee_ids: string[] | null;
          pinned: boolean;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          attachment_url?: string | null;
          target?: string;
          target_department_id?: string | null;
          target_employee_ids?: string[] | null;
          pinned?: boolean;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          message?: string;
          attachment_url?: string | null;
          target?: string;
          target_department_id?: string | null;
          target_employee_ids?: string[] | null;
          pinned?: boolean;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          title: string;
          category: string;
          file_url: string;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string;
          file_url: string;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          file_url?: string;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string | null;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: number;
          work_start: string;
          work_end: string;
          late_grace_minutes: number;
          weekly_off_days: number[];
          face_match_threshold: number;
          approval_flow: string;
          store_capture_photos: boolean;
          retention_days: number;
          email_notifications: boolean;
        };
        Insert: {
          id?: number;
          work_start?: string;
          work_end?: string;
          late_grace_minutes?: number;
          weekly_off_days?: number[];
          face_match_threshold?: number;
          approval_flow?: string;
          store_capture_photos?: boolean;
          retention_days?: number;
          email_notifications?: boolean;
        };
        Update: {
          id?: number;
          work_start?: string;
          work_end?: string;
          late_grace_minutes?: number;
          weekly_off_days?: number[];
          face_match_threshold?: number;
          approval_flow?: string;
          store_capture_photos?: boolean;
          retention_days?: number;
          email_notifications?: boolean;
        };
        Relationships: [];
      };
      drive_connection: {
        Row: {
          id: string;
          google_email: string | null;
          refresh_token_encrypted: string | null;
          root_folder_id: string | null;
          auto_backup_on_pdf: boolean;
          daily_backup: boolean;
          connected_at: string;
          connected_by: string | null;
        };
        Insert: {
          id?: string;
          google_email?: string | null;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          auto_backup_on_pdf?: boolean;
          daily_backup?: boolean;
          connected_at?: string;
          connected_by?: string | null;
        };
        Update: {
          id?: string;
          google_email?: string | null;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          auto_backup_on_pdf?: boolean;
          daily_backup?: boolean;
          connected_at?: string;
          connected_by?: string | null;
        };
        Relationships: [];
      };
      drive_backups: {
        Row: {
          id: string;
          file_type: string | null;
          file_name: string;
          drive_file_id: string | null;
          drive_link: string | null;
          period_start: string | null;
          period_end: string | null;
          status: string;
          error_message: string | null;
          retry_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_type?: string | null;
          file_name: string;
          drive_file_id?: string | null;
          drive_link?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          status?: string;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_type?: string | null;
          file_name?: string;
          drive_file_id?: string | null;
          drive_link?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          status?: string;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      people: {
        Row: {
          id: string;
          name: string;
          person_code: string;
          department: string;
          email: string | null;
          phone: string | null;
          photo_url: string | null;
          active: boolean;
          consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          person_code?: string;
          department?: string;
          email?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          active?: boolean;
          consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          person_code?: string;
          department?: string;
          email?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          active?: boolean;
          consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      face_descriptors: {
        Row: {
          person_id: string;
          samples: number;
          descriptor: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          person_id: string;
          samples?: number;
          descriptor: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          person_id?: string;
          samples?: number;
          descriptor?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _user_id: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: boolean;
      };
      current_employee_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_my_team_member: {
        Args: {
          _employee_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "employee";
      leave_status: "pending" | "approved" | "rejected" | "cancelled";
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "half_day"
        | "on_leave"
        | "holiday"
        | "weekly_off";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
