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
          personal_email: string | null;
          gender: string | null;
          date_of_birth: string | null;
          marital_status: string | null;
          blood_group: string | null;
          nationality: string | null;
          current_address: string | null;
          permanent_address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          employment_type: string | null;
          work_location: string | null;
          probation_end_date: string | null;
          notice_period_days: number | null;
          shift_id: string | null;
          organization_id: string | null;
          is_superadmin: boolean | null;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_ifsc_code: string | null;
          bank_branch: string | null;
          bank_account_holder: string | null;
          pan_number: string | null;
          onboarding_status: string | null;
          created_at: string;
          updated_at: string;
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
          personal_email?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          marital_status?: string | null;
          blood_group?: string | null;
          nationality?: string | null;
          current_address?: string | null;
          permanent_address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          employment_type?: string | null;
          work_location?: string | null;
          probation_end_date?: string | null;
          notice_period_days?: number | null;
          shift_id?: string | null;
          organization_id?: string | null;
          is_superadmin?: boolean | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc_code?: string | null;
          bank_branch?: string | null;
          bank_account_holder?: string | null;
          pan_number?: string | null;
          onboarding_status?: string | null;
          created_at?: string;
          updated_at?: string;
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
          personal_email?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          marital_status?: string | null;
          blood_group?: string | null;
          nationality?: string | null;
          current_address?: string | null;
          permanent_address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          employment_type?: string | null;
          work_location?: string | null;
          probation_end_date?: string | null;
          notice_period_days?: number | null;
          shift_id?: string | null;
          organization_id?: string | null;
          is_superadmin?: boolean | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc_code?: string | null;
          bank_branch?: string | null;
          bank_account_holder?: string | null;
          pan_number?: string | null;
          onboarding_status?: string | null;
          created_at?: string;
          updated_at?: string;
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
          shift_id: string | null;
          working_hours: number | null;
          overtime_hours: number | null;
          is_late: boolean | null;
          late_minutes: number | null;
          is_early_departure: boolean | null;
          early_departure_minutes: number | null;
          is_half_day: boolean | null;
          is_missing_punch: boolean | null;
          device_id: string | null;
          organization_id: string | null;
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
          shift_id?: string | null;
          working_hours?: number | null;
          overtime_hours?: number | null;
          is_late?: boolean | null;
          late_minutes?: number | null;
          is_early_departure?: boolean | null;
          early_departure_minutes?: number | null;
          is_half_day?: boolean | null;
          is_missing_punch?: boolean | null;
          device_id?: string | null;
          organization_id?: string | null;
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
          shift_id?: string | null;
          working_hours?: number | null;
          overtime_hours?: number | null;
          is_late?: boolean | null;
          late_minutes?: number | null;
          is_early_departure?: boolean | null;
          early_departure_minutes?: number | null;
          is_half_day?: boolean | null;
          is_missing_punch?: boolean | null;
          device_id?: string | null;
          organization_id?: string | null;
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
          code: string | null;
          description: string | null;
          color: string | null;
          allow_half_day: boolean | null;
          allow_carry_forward: boolean | null;
          max_carry_forward_days: number | null;
          allow_encashment: boolean | null;
          max_encashment_days: number | null;
          requires_approval: boolean | null;
          requires_manager_approval: boolean | null;
          requires_hr_approval: boolean | null;
          max_consecutive_days: number | null;
          min_service_days_required: number | null;
          requires_document_proof: boolean | null;
          document_proof_min_days: number | null;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          days_per_year?: number;
          is_paid?: boolean;
          active?: boolean;
          code?: string | null;
          description?: string | null;
          color?: string | null;
          allow_half_day?: boolean | null;
          allow_carry_forward?: boolean | null;
          max_carry_forward_days?: number | null;
          allow_encashment?: boolean | null;
          max_encashment_days?: number | null;
          requires_approval?: boolean | null;
          requires_manager_approval?: boolean | null;
          requires_hr_approval?: boolean | null;
          max_consecutive_days?: number | null;
          min_service_days_required?: number | null;
          requires_document_proof?: boolean | null;
          document_proof_min_days?: number | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          days_per_year?: number;
          is_paid?: boolean;
          active?: boolean;
          code?: string | null;
          description?: string | null;
          color?: string | null;
          allow_half_day?: boolean | null;
          allow_carry_forward?: boolean | null;
          max_carry_forward_days?: number | null;
          allow_encashment?: boolean | null;
          max_encashment_days?: number | null;
          requires_approval?: boolean | null;
          requires_manager_approval?: boolean | null;
          requires_hr_approval?: boolean | null;
          max_consecutive_days?: number | null;
          min_service_days_required?: number | null;
          requires_document_proof?: boolean | null;
          document_proof_min_days?: number | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
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
          current_approval_level: string | null;
          manager_decision: string | null;
          manager_decision_at: string | null;
          admin_decision: string | null;
          admin_decision_at: string | null;
          half_day_period: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
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
          current_approval_level?: string | null;
          manager_decision?: string | null;
          manager_decision_at?: string | null;
          admin_decision?: string | null;
          admin_decision_at?: string | null;
          half_day_period?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
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
          current_approval_level?: string | null;
          manager_decision?: string | null;
          manager_decision_at?: string | null;
          admin_decision?: string | null;
          admin_decision_at?: string | null;
          half_day_period?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
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
          }
        ];
      };
      holidays: {
        Row: {
          id: string;
          date: string;
          title: string;
          name: string | null;
          is_optional: boolean | null;
          description: string | null;
          created_by: string | null;
          organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          title?: string;
          name?: string | null;
          is_optional?: boolean | null;
          description?: string | null;
          created_by?: string | null;
          organization_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          title?: string;
          name?: string | null;
          is_optional?: boolean | null;
          description?: string | null;
          created_by?: string | null;
          organization_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          organization_id: string | null;
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
          category: string;
          priority: string;
          published_at: string | null;
          is_published: boolean;
          summary: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
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
          category?: string;
          priority?: string;
          published_at?: string | null;
          is_published?: boolean;
          summary?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
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
          category?: string;
          priority?: string;
          published_at?: string | null;
          is_published?: boolean;
          summary?: string | null;
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
          employee_id: string | null;
          organization_id: string | null;
          file_name: string | null;
          file_size: number | null;
          file_type: string | null;
          document_type: string | null;
          uploaded_at: string | null;
          category_id: string | null;
          description: string | null;
          mime_type: string | null;
          drive_link: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          is_confidential: boolean | null;
          is_company_policy: boolean | null;
          verification_status: string | null;
          verified_by: string | null;
          verified_at: string | null;
          rejection_reason: string | null;
          target_department_id: string | null;
          version: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string;
          file_url: string;
          uploaded_by?: string | null;
          employee_id?: string | null;
          organization_id?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          document_type?: string | null;
          uploaded_at?: string | null;
          category_id?: string | null;
          description?: string | null;
          mime_type?: string | null;
          drive_link?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          is_confidential?: boolean | null;
          is_company_policy?: boolean | null;
          verification_status?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          target_department_id?: string | null;
          version?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          file_url?: string;
          uploaded_by?: string | null;
          employee_id?: string | null;
          organization_id?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          document_type?: string | null;
          uploaded_at?: string | null;
          category_id?: string | null;
          description?: string | null;
          mime_type?: string | null;
          drive_link?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          is_confidential?: boolean | null;
          is_company_policy?: boolean | null;
          verification_status?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          target_department_id?: string | null;
          version?: number | null;
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
          organization_id: string | null;
          employee_id: string | null;
          type: string;
          priority: string;
          metadata: Json | null;
          read_at: string | null;
          channel: string;
          delivery_status: string;
          provider_message_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
          organization_id?: string | null;
          employee_id?: string | null;
          type?: string;
          priority?: string;
          metadata?: Json | null;
          read_at?: string | null;
          channel?: string;
          delivery_status?: string;
          provider_message_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
          organization_id?: string | null;
          employee_id?: string | null;
          type?: string;
          priority?: string;
          metadata?: Json | null;
          read_at?: string | null;
          channel?: string;
          delivery_status?: string;
          provider_message_id?: string | null;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string | null;
          organization_id: string | null;
          in_app_enabled: boolean;
          email_enabled: boolean;
          whatsapp_enabled: boolean;
          whatsapp_number: string | null;
          notify_leave: boolean;
          notify_attendance: boolean;
          notify_shift: boolean;
          notify_expense: boolean;
          notify_ticket: boolean;
          notify_document_expiry: boolean;
          notify_onboarding: boolean;
          notify_interview: boolean;
          notify_performance: boolean;
          notify_payroll: boolean;
          notify_announcement: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_id?: string | null;
          organization_id?: string | null;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
          notify_leave?: boolean;
          notify_attendance?: boolean;
          notify_shift?: boolean;
          notify_expense?: boolean;
          notify_ticket?: boolean;
          notify_document_expiry?: boolean;
          notify_onboarding?: boolean;
          notify_interview?: boolean;
          notify_performance?: boolean;
          notify_payroll?: boolean;
          notify_announcement?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          employee_id?: string | null;
          organization_id?: string | null;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
          notify_leave?: boolean;
          notify_attendance?: boolean;
          notify_shift?: boolean;
          notify_expense?: boolean;
          notify_ticket?: boolean;
          notify_document_expiry?: boolean;
          notify_onboarding?: boolean;
          notify_interview?: boolean;
          notify_performance?: boolean;
          notify_payroll?: boolean;
          notify_announcement?: boolean;
          created_at?: string;
          updated_at?: string;
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
          duplicate_scan_minutes: number;
          weekly_off_days: number[];
          face_match_threshold: number;
          approval_flow: string;
          store_capture_photos: boolean;
          retention_days: number;
          email_notifications: boolean;
          org_name: string | null;
          half_day_hours: number | null;
          store_photos: boolean | null;
          data_retention_days: number | null;
          organization_id: string | null;
        };
        Insert: {
          id?: number;
          work_start?: string;
          work_end?: string;
          late_grace_minutes?: number;
          duplicate_scan_minutes?: number;
          weekly_off_days?: number[];
          face_match_threshold?: number;
          approval_flow?: string;
          store_capture_photos?: boolean;
          retention_days?: number;
          email_notifications?: boolean;
          org_name?: string | null;
          half_day_hours?: number | null;
          store_photos?: boolean | null;
          data_retention_days?: number | null;
          organization_id?: string | null;
        };
        Update: {
          id?: number;
          work_start?: string;
          work_end?: string;
          late_grace_minutes?: number;
          duplicate_scan_minutes?: number;
          weekly_off_days?: number[];
          face_match_threshold?: number;
          approval_flow?: string;
          store_capture_photos?: boolean;
          retention_days?: number;
          email_notifications?: boolean;
          org_name?: string | null;
          half_day_hours?: number | null;
          store_photos?: boolean | null;
          data_retention_days?: number | null;
          organization_id?: string | null;
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
      shifts: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          start_time: string;
          end_time: string;
          work_days: string[];
          organization_id: string | null;
          break_duration_minutes: number | null;
          grace_period_minutes: number | null;
          early_departure_grace_minutes: number | null;
          half_day_min_hours: number | null;
          full_day_min_hours: number | null;
          is_night_shift: boolean | null;
          is_rotating: boolean | null;
          rotation_pattern: string | null;
          color: string | null;
          is_active: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          start_time: string;
          end_time: string;
          work_days?: string[];
          organization_id?: string | null;
          break_duration_minutes?: number | null;
          grace_period_minutes?: number | null;
          early_departure_grace_minutes?: number | null;
          half_day_min_hours?: number | null;
          full_day_min_hours?: number | null;
          is_night_shift?: boolean | null;
          is_rotating?: boolean | null;
          rotation_pattern?: string | null;
          color?: string | null;
          is_active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string | null;
          start_time?: string;
          end_time?: string;
          work_days?: string[];
          organization_id?: string | null;
          break_duration_minutes?: number | null;
          grace_period_minutes?: number | null;
          early_departure_grace_minutes?: number | null;
          half_day_min_hours?: number | null;
          full_day_min_hours?: number | null;
          is_night_shift?: boolean | null;
          is_rotating?: boolean | null;
          rotation_pattern?: string | null;
          color?: string | null;
          is_active?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      expense_claims: {
        Row: {
          id: string;
          employee_id: string;
          organization_id: string | null;
          title: string;
          category: string;
          amount: number;
          currency: string;
          expense_date: string;
          receipt_url: string | null;
          notes: string | null;
          status: string;
          approved_by: string | null;
          admin_notes: string | null;
          receipt_storage_path: string | null;
          receipt_name: string | null;
          receipt_size: number | null;
          manager_approved_by: string | null;
          manager_approved_at: string | null;
          manager_notes: string | null;
          finance_approved_by: string | null;
          finance_approved_at: string | null;
          finance_notes: string | null;
          reimbursed_by: string | null;
          reimbursed_at: string | null;
          reimbursement_reference: string | null;
          payment_method: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          current_approval_level: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          organization_id?: string | null;
          title: string;
          category?: string;
          amount: number;
          currency?: string;
          expense_date?: string;
          receipt_url?: string | null;
          notes?: string | null;
          status?: string;
          approved_by?: string | null;
          admin_notes?: string | null;
          receipt_storage_path?: string | null;
          receipt_name?: string | null;
          receipt_size?: number | null;
          manager_approved_by?: string | null;
          manager_approved_at?: string | null;
          manager_notes?: string | null;
          finance_approved_by?: string | null;
          finance_approved_at?: string | null;
          finance_notes?: string | null;
          reimbursed_by?: string | null;
          reimbursed_at?: string | null;
          reimbursement_reference?: string | null;
          payment_method?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          current_approval_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          organization_id?: string | null;
          title?: string;
          category?: string;
          amount?: number;
          currency?: string;
          expense_date?: string;
          receipt_url?: string | null;
          notes?: string | null;
          status?: string;
          approved_by?: string | null;
          admin_notes?: string | null;
          receipt_storage_path?: string | null;
          receipt_name?: string | null;
          receipt_size?: number | null;
          manager_approved_by?: string | null;
          manager_approved_at?: string | null;
          manager_notes?: string | null;
          finance_approved_by?: string | null;
          finance_approved_at?: string | null;
          finance_notes?: string | null;
          reimbursed_by?: string | null;
          reimbursed_at?: string | null;
          reimbursement_reference?: string | null;
          payment_method?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          current_approval_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_claims_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      hr_tickets: {
        Row: {
          id: string;
          ticket_number: string;
          employee_id: string;
          organization_id: string | null;
          subject: string;
          category: string;
          priority: string;
          description: string;
          status: string;
          assigned_to: string | null;
          assigned_employee_id: string | null;
          attachment_url: string | null;
          attachment_name: string | null;
          attachment_size: number | null;
          resolved_at: string | null;
          resolved_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_number?: string;
          employee_id: string;
          organization_id?: string | null;
          subject: string;
          category?: string;
          priority?: string;
          description: string;
          status?: string;
          assigned_to?: string | null;
          assigned_employee_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_number?: string;
          employee_id?: string;
          organization_id?: string | null;
          subject?: string;
          category?: string;
          priority?: string;
          description?: string;
          status?: string;
          assigned_to?: string | null;
          assigned_employee_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hr_tickets_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hr_tickets_assigned_employee_id_fkey";
            columns: ["assigned_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      hr_ticket_categories: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          icon: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          description?: string | null;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          description?: string | null;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hr_ticket_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      hr_ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          organization_id: string | null;
          author_user_id: string | null;
          author_employee_id: string | null;
          author_name: string | null;
          author_role: string | null;
          message: string;
          is_internal: boolean;
          attachment_url: string | null;
          attachment_name: string | null;
          attachment_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          organization_id?: string | null;
          author_user_id?: string | null;
          author_employee_id?: string | null;
          author_name?: string | null;
          author_role?: string | null;
          message: string;
          is_internal?: boolean;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          organization_id?: string | null;
          author_user_id?: string | null;
          author_employee_id?: string | null;
          author_name?: string | null;
          author_role?: string | null;
          message?: string;
          is_internal?: boolean;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hr_ticket_comments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "hr_tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hr_ticket_comments_author_employee_id_fkey";
            columns: ["author_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      hr_ticket_history: {
        Row: {
          id: string;
          ticket_id: string;
          organization_id: string | null;
          changed_by_user_id: string | null;
          action: string;
          from_status: string | null;
          to_status: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action?: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hr_ticket_history_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "hr_tickets";
            referencedColumns: ["id"];
          }
        ];
      };
      expense_categories: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      expense_history: {
        Row: {
          id: string;
          expense_id: string;
          organization_id: string | null;
          changed_by_user_id: string | null;
          action: string;
          from_status: string | null;
          to_status: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action?: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_history_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expense_claims";
            referencedColumns: ["id"];
          }
        ];
      };
      performance_reviews: {
        Row: {
          id: string;
          employee_id: string;
          reviewer_id: string | null;
          cycle_name: string | null;
          cycle_id: string | null;
          rating: number | null;
          feedback: string | null;
          goals: string | null;
          status: string;
          self_rating: number | null;
          self_achievements: string | null;
          self_growth_areas: string | null;
          self_comments: string | null;
          self_submitted_at: string | null;
          manager_rating: number | null;
          manager_feedback: string | null;
          manager_strengths: string | null;
          manager_development_plan: string | null;
          manager_recommendation: string | null;
          manager_submitted_at: string | null;
          final_score: number | null;
          final_grade: string | null;
          hr_comments: string | null;
          stage: string;
          organization_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          reviewer_id?: string | null;
          cycle_name?: string | null;
          cycle_id?: string | null;
          rating?: number | null;
          feedback?: string | null;
          goals?: string | null;
          status?: string;
          self_rating?: number | null;
          self_achievements?: string | null;
          self_growth_areas?: string | null;
          self_comments?: string | null;
          self_submitted_at?: string | null;
          manager_rating?: number | null;
          manager_feedback?: string | null;
          manager_strengths?: string | null;
          manager_development_plan?: string | null;
          manager_recommendation?: string | null;
          manager_submitted_at?: string | null;
          final_score?: number | null;
          final_grade?: string | null;
          hr_comments?: string | null;
          stage?: string;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          reviewer_id?: string | null;
          cycle_name?: string | null;
          cycle_id?: string | null;
          rating?: number | null;
          feedback?: string | null;
          goals?: string | null;
          status?: string;
          self_rating?: number | null;
          self_achievements?: string | null;
          self_growth_areas?: string | null;
          self_comments?: string | null;
          self_submitted_at?: string | null;
          manager_rating?: number | null;
          manager_feedback?: string | null;
          manager_strengths?: string | null;
          manager_development_plan?: string | null;
          manager_recommendation?: string | null;
          manager_submitted_at?: string | null;
          final_score?: number | null;
          final_grade?: string | null;
          hr_comments?: string | null;
          stage?: string;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "performance_cycles";
            referencedColumns: ["id"];
          }
        ];
      };
      job_openings: {
        Row: {
          id: string;
          organization_id: string | null;
          title: string;
          description: string | null;
          department_id: string | null;
          experience_level: string | null;
          employment_type: string | null;
          workplace_type: string | null;
          location: string | null;
          min_salary: number | null;
          max_salary: number | null;
          currency: string | null;
          openings_count: number | null;
          status: string;
          hiring_manager_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          description?: string | null;
          department_id?: string | null;
          experience_level?: string | null;
          employment_type?: string | null;
          workplace_type?: string | null;
          location?: string | null;
          min_salary?: number | null;
          max_salary?: number | null;
          currency?: string | null;
          openings_count?: number | null;
          status?: string;
          hiring_manager_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string | null;
          department_id?: string | null;
          experience_level?: string | null;
          employment_type?: string | null;
          workplace_type?: string | null;
          location?: string | null;
          min_salary?: number | null;
          max_salary?: number | null;
          currency?: string | null;
          openings_count?: number | null;
          status?: string;
          hiring_manager_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_openings_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_openings_hiring_manager_id_fkey";
            columns: ["hiring_manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      candidates: {
        Row: {
          id: string;
          organization_id: string | null;
          job_opening_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          current_company: string | null;
          current_designation: string | null;
          years_of_experience: number | null;
          current_salary: number | null;
          expected_salary: number | null;
          notice_period_days: number | null;
          resume_url: string | null;
          resume_file_name: string | null;
          portfolio_url: string | null;
          linkedin_url: string | null;
          source: string | null;
          stage: string;
          rejection_reason: string | null;
          rejection_notes: string | null;
          offer_salary: number | null;
          offer_status: string;
          offer_date: string | null;
          offer_accepted_date: string | null;
          joining_date: string | null;
          rating: number | null;
          notes: string | null;
          converted_employee_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          job_opening_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          current_company?: string | null;
          current_designation?: string | null;
          years_of_experience?: number | null;
          current_salary?: number | null;
          expected_salary?: number | null;
          notice_period_days?: number | null;
          resume_url?: string | null;
          resume_file_name?: string | null;
          portfolio_url?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          stage?: string;
          rejection_reason?: string | null;
          rejection_notes?: string | null;
          offer_salary?: number | null;
          offer_status?: string;
          offer_date?: string | null;
          offer_accepted_date?: string | null;
          joining_date?: string | null;
          rating?: number | null;
          notes?: string | null;
          converted_employee_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          job_opening_id?: string | null;
          full_name?: string;
          email?: string;
          phone?: string | null;
          current_company?: string | null;
          current_designation?: string | null;
          years_of_experience?: number | null;
          current_salary?: number | null;
          expected_salary?: number | null;
          notice_period_days?: number | null;
          resume_url?: string | null;
          resume_file_name?: string | null;
          portfolio_url?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          stage?: string;
          rejection_reason?: string | null;
          rejection_notes?: string | null;
          offer_salary?: number | null;
          offer_status?: string;
          offer_date?: string | null;
          offer_accepted_date?: string | null;
          joining_date?: string | null;
          rating?: number | null;
          notes?: string | null;
          converted_employee_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      candidate_interviews: {
        Row: {
          id: string;
          organization_id: string | null;
          candidate_id: string;
          job_opening_id: string | null;
          interviewer_id: string;
          round_name: string;
          round_number: number;
          scheduled_at: string;
          duration_minutes: number;
          meeting_link: string | null;
          location: string | null;
          status: string;
          rating: number | null;
          recommendation: string | null;
          strengths: string | null;
          weaknesses: string | null;
          feedback: string | null;
          feedback_submitted_at: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          candidate_id: string;
          job_opening_id?: string | null;
          interviewer_id: string;
          round_name: string;
          round_number?: number;
          scheduled_at: string;
          duration_minutes?: number;
          meeting_link?: string | null;
          location?: string | null;
          status?: string;
          rating?: number | null;
          recommendation?: string | null;
          strengths?: string | null;
          weaknesses?: string | null;
          feedback?: string | null;
          feedback_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          candidate_id?: string;
          job_opening_id?: string | null;
          interviewer_id?: string;
          round_name?: string;
          round_number?: number;
          scheduled_at?: string;
          duration_minutes?: number;
          meeting_link?: string | null;
          location?: string | null;
          status?: string;
          rating?: number | null;
          recommendation?: string | null;
          strengths?: string | null;
          weaknesses?: string | null;
          feedback?: string | null;
          feedback_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      candidate_activities: {
        Row: {
          id: string;
          candidate_id: string;
          performed_by: string | null;
          action: string;
          from_stage: string | null;
          to_stage: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          candidate_id: string;
          performed_by?: string | null;
          action: string;
          from_stage?: string | null;
          to_stage?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          candidate_id?: string;
          performed_by?: string | null;
          action?: string;
          from_stage?: string | null;
          to_stage?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      candidate_documents: {
        Row: {
          id: string;
          candidate_id: string;
          title: string;
          file_url: string;
          file_name: string | null;
          file_size: number | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          candidate_id: string;
          title: string;
          file_url: string;
          file_name?: string | null;
          file_size?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          candidate_id?: string;
          title?: string;
          file_url?: string;
          file_name?: string | null;
          file_size?: number | null;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payslips: {
        Row: {
          id: string;
          employee_id: string;
          organization_id: string | null;
          payroll_run_id: string | null;
          month: number;
          year: number;
          basic_salary: number;
          hra: number;
          special_allowance: number;
          conveyance_allowance: number;
          medical_allowance: number;
          other_allowances: number;
          allowances: number;
          bonus: number;
          overtime_hours: number;
          overtime_pay: number;
          gross_salary: number;
          pf_employee: number;
          pf_employer: number;
          esi_employee: number;
          esi_employer: number;
          professional_tax: number;
          tds: number;
          lop_days: number;
          lop_deduction: number;
          other_deductions: number;
          deductions: number;
          total_deductions: number;
          net_salary: number;
          working_days: number;
          present_days: number;
          leave_days: number;
          bank_name: string | null;
          account_number: string | null;
          pan_number: string | null;
          uan_number: string | null;
          pdf_url: string | null;
          status: string;
          earnings_breakdown: Json;
          deductions_breakdown: Json;
          payment_method: string | null;
          payment_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          organization_id?: string | null;
          payroll_run_id?: string | null;
          month: number;
          year: number;
          basic_salary?: number;
          hra?: number;
          special_allowance?: number;
          conveyance_allowance?: number;
          medical_allowance?: number;
          other_allowances?: number;
          allowances?: number;
          bonus?: number;
          overtime_hours?: number;
          overtime_pay?: number;
          gross_salary?: number;
          pf_employee?: number;
          pf_employer?: number;
          esi_employee?: number;
          esi_employer?: number;
          professional_tax?: number;
          tds?: number;
          lop_days?: number;
          lop_deduction?: number;
          other_deductions?: number;
          deductions?: number;
          total_deductions?: number;
          net_salary?: number;
          working_days?: number;
          present_days?: number;
          leave_days?: number;
          bank_name?: string | null;
          account_number?: string | null;
          pan_number?: string | null;
          uan_number?: string | null;
          pdf_url?: string | null;
          status?: string;
          earnings_breakdown?: Json;
          deductions_breakdown?: Json;
          payment_method?: string | null;
          payment_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          organization_id?: string | null;
          payroll_run_id?: string | null;
          month?: number;
          year?: number;
          basic_salary?: number;
          hra?: number;
          special_allowance?: number;
          conveyance_allowance?: number;
          medical_allowance?: number;
          other_allowances?: number;
          allowances?: number;
          bonus?: number;
          overtime_hours?: number;
          overtime_pay?: number;
          gross_salary?: number;
          pf_employee?: number;
          pf_employer?: number;
          esi_employee?: number;
          esi_employer?: number;
          professional_tax?: number;
          tds?: number;
          lop_days?: number;
          lop_deduction?: number;
          other_deductions?: number;
          deductions?: number;
          total_deductions?: number;
          net_salary?: number;
          working_days?: number;
          present_days?: number;
          leave_days?: number;
          bank_name?: string | null;
          account_number?: string | null;
          pan_number?: string | null;
          uan_number?: string | null;
          pdf_url?: string | null;
          status?: string;
          earnings_breakdown?: Json;
          deductions_breakdown?: Json;
          payment_method?: string | null;
          payment_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      performance_cycles: {
        Row: {
          id: string;
          organization_id: string | null;
          title: string;
          cycle_type: string;
          start_date: string;
          due_date: string;
          description: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          cycle_type?: string;
          start_date: string;
          due_date: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          title?: string;
          cycle_type?: string;
          start_date?: string;
          due_date?: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      performance_goals: {
        Row: {
          id: string;
          organization_id: string | null;
          employee_id: string;
          department_id: string | null;
          cycle_id: string | null;
          title: string;
          description: string | null;
          goal_type: string;
          metric: string | null;
          target_value: number | null;
          current_value: number | null;
          unit: string | null;
          weightage: number | null;
          progress: number;
          status: string;
          start_date: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          employee_id: string;
          department_id?: string | null;
          cycle_id?: string | null;
          title: string;
          description?: string | null;
          goal_type?: string;
          metric?: string | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          weightage?: number | null;
          progress?: number;
          status?: string;
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          employee_id?: string;
          department_id?: string | null;
          cycle_id?: string | null;
          title?: string;
          description?: string | null;
          goal_type?: string;
          metric?: string | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          weightage?: number | null;
          progress?: number;
          status?: string;
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      performance_peer_feedbacks: {
        Row: {
          id: string;
          organization_id: string | null;
          review_id: string | null;
          employee_id: string;
          peer_id: string;
          relationship: string | null;
          rating: number | null;
          strengths: string | null;
          areas_for_improvement: string | null;
          comments: string | null;
          is_anonymous: boolean;
          status: string;
          submitted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          review_id?: string | null;
          employee_id: string;
          peer_id: string;
          relationship?: string | null;
          rating?: number | null;
          strengths?: string | null;
          areas_for_improvement?: string | null;
          comments?: string | null;
          is_anonymous?: boolean;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          review_id?: string | null;
          employee_id?: string;
          peer_id?: string;
          relationship?: string | null;
          rating?: number | null;
          strengths?: string | null;
          areas_for_improvement?: string | null;
          comments?: string | null;
          is_anonymous?: boolean;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_peer_feedbacks_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_peer_feedbacks_peer_id_fkey";
            columns: ["peer_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      lms_courses: {
        Row: {
          id: string;
          organization_id: string | null;
          title: string;
          description: string | null;
          category: string;
          level: string;
          estimated_duration_minutes: number;
          thumbnail_url: string | null;
          status: string;
          passing_score_percent: number;
          created_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          description?: string | null;
          category?: string;
          level?: string;
          estimated_duration_minutes?: number;
          thumbnail_url?: string | null;
          status?: string;
          passing_score_percent?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string | null;
          category?: string;
          level?: string;
          estimated_duration_minutes?: number;
          thumbnail_url?: string | null;
          status?: string;
          passing_score_percent?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      lms_modules: {
        Row: {
          id: string;
          organization_id: string | null;
          course_id: string;
          title: string;
          description: string | null;
          sequence_order: number;
          content_type: string;
          content_url: string | null;
          file_path: string | null;
          text_content: string | null;
          duration_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          course_id: string;
          title: string;
          description?: string | null;
          sequence_order?: number;
          content_type?: string;
          content_url?: string | null;
          file_path?: string | null;
          text_content?: string | null;
          duration_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          course_id?: string;
          title?: string;
          description?: string | null;
          sequence_order?: number;
          content_type?: string;
          content_url?: string | null;
          file_path?: string | null;
          text_content?: string | null;
          duration_minutes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      lms_course_enrollments: {
        Row: {
          id: string;
          organization_id: string | null;
          course_id: string;
          employee_id: string;
          assigned_by: string | null;
          due_date: string | null;
          progress_percent: number;
          status: string;
          enrolled_at: string;
          completed_at: string | null;
          certificate_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          course_id: string;
          employee_id: string;
          assigned_by?: string | null;
          due_date?: string | null;
          progress_percent?: number;
          status?: string;
          enrolled_at?: string;
          completed_at?: string | null;
          certificate_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          course_id?: string;
          employee_id?: string;
          assigned_by?: string | null;
          due_date?: string | null;
          progress_percent?: number;
          status?: string;
          enrolled_at?: string;
          completed_at?: string | null;
          certificate_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      lms_lesson_progress: {
        Row: {
          id: string;
          organization_id: string | null;
          enrollment_id: string;
          module_id: string;
          employee_id: string;
          is_completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          enrollment_id: string;
          module_id: string;
          employee_id: string;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          enrollment_id?: string;
          module_id?: string;
          employee_id?: string;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lms_quizzes: {
        Row: {
          id: string;
          organization_id: string | null;
          course_id: string;
          title: string;
          description: string | null;
          passing_score_percent: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          course_id: string;
          title: string;
          description?: string | null;
          passing_score_percent?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          course_id?: string;
          title?: string;
          description?: string | null;
          passing_score_percent?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      lms_quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question: string;
          options: Json;
          correct_option_index: number;
          explanation: string | null;
          order_index: number;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question: string;
          options: Json;
          correct_option_index: number;
          explanation?: string | null;
          order_index?: number;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question?: string;
          options?: Json;
          correct_option_index?: number;
          explanation?: string | null;
          order_index?: number;
        };
        Relationships: [];
      };
      lms_quiz_attempts: {
        Row: {
          id: string;
          organization_id: string | null;
          quiz_id: string;
          course_id: string;
          employee_id: string;
          enrollment_id: string | null;
          score_percent: number;
          passed: boolean;
          total_questions: number;
          correct_answers: number;
          answers: Json | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          quiz_id: string;
          course_id: string;
          employee_id: string;
          enrollment_id?: string | null;
          score_percent: number;
          passed: boolean;
          total_questions: number;
          correct_answers: number;
          answers?: Json | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          quiz_id?: string;
          course_id?: string;
          employee_id?: string;
          enrollment_id?: string | null;
          score_percent?: number;
          passed?: boolean;
          total_questions?: number;
          correct_answers?: number;
          answers?: Json | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      lms_certificates: {
        Row: {
          id: string;
          organization_id: string | null;
          certificate_code: string;
          course_id: string;
          employee_id: string;
          enrollment_id: string | null;
          issue_date: string;
          final_score_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          certificate_code: string;
          course_id: string;
          employee_id: string;
          enrollment_id?: string | null;
          issue_date?: string;
          final_score_percent?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          certificate_code?: string;
          course_id?: string;
          employee_id?: string;
          enrollment_id?: string | null;
          issue_date?: string;
          final_score_percent?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      work_locations: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          radius_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_assignments: {
        Row: {
          id: string;
          shift_id: string;
          employee_id: string | null;
          department_id: string | null;
          organization_id: string | null;
          start_date: string;
          end_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          employee_id?: string | null;
          department_id?: string | null;
          organization_id?: string | null;
          start_date?: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          employee_id?: string | null;
          department_id?: string | null;
          organization_id?: string | null;
          start_date?: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shift_swap_requests: {
        Row: {
          id: string;
          requester_employee_id: string;
          target_employee_id: string | null;
          requester_shift_id: string;
          requested_shift_id: string;
          swap_date: string;
          reason: string;
          target_accepted: boolean;
          status: string;
          decided_by: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_employee_id: string;
          target_employee_id?: string | null;
          requester_shift_id: string;
          requested_shift_id: string;
          swap_date: string;
          reason: string;
          target_accepted?: boolean;
          status?: string;
          decided_by?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_employee_id?: string;
          target_employee_id?: string | null;
          requester_shift_id?: string;
          requested_shift_id?: string;
          swap_date?: string;
          reason?: string;
          target_accepted?: boolean;
          status?: string;
          decided_by?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance_corrections: {
        Row: {
          id: string;
          attendance_id: string | null;
          employee_id: string;
          organization_id: string | null;
          date: string;
          requested_check_in: string | null;
          requested_check_out: string | null;
          reason: string;
          status: string;
          decided_by: string | null;
          admin_notes: string | null;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          attendance_id?: string | null;
          employee_id: string;
          organization_id?: string | null;
          date: string;
          requested_check_in?: string | null;
          requested_check_out?: string | null;
          reason: string;
          status?: string;
          decided_by?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          attendance_id?: string | null;
          employee_id?: string;
          organization_id?: string | null;
          date?: string;
          requested_check_in?: string | null;
          requested_check_out?: string | null;
          reason?: string;
          status?: string;
          decided_by?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Relationships: [];
      };
      leave_policies: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          weekly_off_days: number[];
          approval_flow: string;
          sandwich_rule_enabled: boolean;
          allow_negative_balance: boolean;
          notice_days_required: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          weekly_off_days?: number[];
          approval_flow?: string;
          sandwich_rule_enabled?: boolean;
          allow_negative_balance?: boolean;
          notice_days_required?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          weekly_off_days?: number[];
          approval_flow?: string;
          sandwich_rule_enabled?: boolean;
          allow_negative_balance?: boolean;
          notice_days_required?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_categories: {
        Row: {
          id: string;
          organization_id: string | null;
          code: string;
          name: string;
          description: string | null;
          is_system: boolean;
          is_required_onboarding: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          code: string;
          name: string;
          description?: string | null;
          is_system?: boolean;
          is_required_onboarding?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          code?: string;
          name?: string;
          description?: string | null;
          is_system?: boolean;
          is_required_onboarding?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      onboarding_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          department_id: string | null;
          is_default: boolean;
          is_active: boolean | null;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          department_id?: string | null;
          is_default?: boolean;
          is_active?: boolean | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          department_id?: string | null;
          is_default?: boolean;
          is_active?: boolean | null;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_templates_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
      };
      onboarding_checklist_items: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          description: string | null;
          category: string;
          required: boolean;
          order_index: number;
          document_category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          description?: string | null;
          category?: string;
          required?: boolean;
          order_index?: number;
          document_category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          required?: boolean;
          order_index?: number;
          document_category?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "onboarding_templates";
            referencedColumns: ["id"];
          }
        ];
      };
      onboarding_template_tasks: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          description: string | null;
          category: string;
          is_required: boolean;
          requires_document: boolean;
          document_category_code: string | null;
          assignee_role: string;
          relative_due_days: number;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          description?: string | null;
          category?: string;
          is_required?: boolean;
          requires_document?: boolean;
          document_category_code?: string | null;
          assignee_role?: string;
          relative_due_days?: number;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          is_required?: boolean;
          requires_document?: boolean;
          document_category_code?: string | null;
          assignee_role?: string;
          relative_due_days?: number;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_onboarding: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          template_id: string | null;
          status: string;
          progress_percentage: number;
          target_completion_date: string | null;
          completed_at: string | null;
          initiated_by: string | null;
          hr_reviewed_by: string | null;
          hr_reviewed_at: string | null;
          hr_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          template_id?: string | null;
          status?: string;
          progress_percentage?: number;
          target_completion_date?: string | null;
          completed_at?: string | null;
          initiated_by?: string | null;
          hr_reviewed_by?: string | null;
          hr_reviewed_at?: string | null;
          hr_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          template_id?: string | null;
          status?: string;
          progress_percentage?: number;
          target_completion_date?: string | null;
          completed_at?: string | null;
          initiated_by?: string | null;
          hr_reviewed_by?: string | null;
          hr_reviewed_at?: string | null;
          hr_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_onboarding_tasks: {
        Row: {
          id: string;
          onboarding_id: string;
          employee_id: string;
          title: string;
          description: string | null;
          category: string;
          required: boolean;
          status: string;
          document_id: string | null;
          completed_by: string | null;
          completed_at: string | null;
          rejection_notes: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          onboarding_id: string;
          employee_id: string;
          title: string;
          description?: string | null;
          category?: string;
          required?: boolean;
          status?: string;
          document_id?: string | null;
          completed_by?: string | null;
          completed_at?: string | null;
          rejection_notes?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          onboarding_id?: string;
          employee_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          required?: boolean;
          status?: string;
          document_id?: string | null;
          completed_by?: string | null;
          completed_at?: string | null;
          rejection_notes?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_tasks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_onboarding_tasks_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_onboarding_tasks_onboarding_id_fkey";
            columns: ["onboarding_id"];
            isOneToOne: false;
            referencedRelation: "employee_onboarding";
            referencedColumns: ["id"];
          }
        ];
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
      payroll_settings: {
        Row: {
          id: string;
          organization_id: string;
          pf_enabled: boolean;
          pf_employee_rate: number;
          pf_employer_rate: number;
          pf_wage_ceiling: number;
          pf_ceiling_enabled: boolean;
          esi_enabled: boolean;
          esi_employee_rate: number;
          esi_employer_rate: number;
          esi_gross_ceiling: number;
          pt_enabled: boolean;
          pt_default_state: string;
          pt_rules: Json;
          working_days_method: string;
          overtime_multiplier: number;
          tds_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pf_enabled?: boolean;
          pf_employee_rate?: number;
          pf_employer_rate?: number;
          pf_wage_ceiling?: number;
          pf_ceiling_enabled?: boolean;
          esi_enabled?: boolean;
          esi_employee_rate?: number;
          esi_employer_rate?: number;
          esi_gross_ceiling?: number;
          pt_enabled?: boolean;
          pt_default_state?: string;
          pt_rules?: Json;
          working_days_method?: string;
          overtime_multiplier?: number;
          tds_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pf_enabled?: boolean;
          pf_employee_rate?: number;
          pf_employer_rate?: number;
          pf_wage_ceiling?: number;
          pf_ceiling_enabled?: boolean;
          esi_enabled?: boolean;
          esi_employee_rate?: number;
          esi_employer_rate?: number;
          esi_gross_ceiling?: number;
          pt_enabled?: boolean;
          pt_default_state?: string;
          pt_rules?: Json;
          working_days_method?: string;
          overtime_multiplier?: number;
          tds_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_salary_structures: {
        Row: {
          id: string;
          employee_id: string;
          organization_id: string | null;
          effective_from: string;
          ctc_annual: number;
          ctc_monthly: number;
          basic_salary: number;
          hra: number;
          special_allowance: number;
          conveyance_allowance: number;
          medical_allowance: number;
          other_allowances: number;
          pf_applicable: boolean;
          pf_cap_at_ceiling: boolean;
          esi_applicable: boolean;
          pt_applicable: boolean;
          pt_state: string;
          tds_monthly: number;
          uan_number: string | null;
          pf_number: string | null;
          esi_number: string | null;
          pan_number: string | null;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_ifsc_code: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          organization_id?: string | null;
          effective_from?: string;
          ctc_annual?: number;
          ctc_monthly?: number;
          basic_salary?: number;
          hra?: number;
          special_allowance?: number;
          conveyance_allowance?: number;
          medical_allowance?: number;
          other_allowances?: number;
          pf_applicable?: boolean;
          pf_cap_at_ceiling?: boolean;
          esi_applicable?: boolean;
          pt_applicable?: boolean;
          pt_state?: string;
          tds_monthly?: number;
          uan_number?: string | null;
          pf_number?: string | null;
          esi_number?: string | null;
          pan_number?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc_code?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          organization_id?: string | null;
          effective_from?: string;
          ctc_annual?: number;
          ctc_monthly?: number;
          basic_salary?: number;
          hra?: number;
          special_allowance?: number;
          conveyance_allowance?: number;
          medical_allowance?: number;
          other_allowances?: number;
          pf_applicable?: boolean;
          pf_cap_at_ceiling?: boolean;
          esi_applicable?: boolean;
          pt_applicable?: boolean;
          pt_state?: string;
          tds_monthly?: number;
          uan_number?: string | null;
          pf_number?: string | null;
          esi_number?: string | null;
          pan_number?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc_code?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payroll_runs: {
        Row: {
          id: string;
          organization_id: string;
          month: number;
          year: number;
          title: string;
          status: string;
          total_employees: number;
          total_gross: number;
          total_deductions: number;
          total_net: number;
          total_pf_employee: number;
          total_pf_employer: number;
          total_esi_employee: number;
          total_esi_employer: number;
          total_pt: number;
          total_tds: number;
          total_lop_deductions: number;
          processed_by: string | null;
          processed_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          locked_by: string | null;
          locked_at: string | null;
          payment_date: string | null;
          payment_reference: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          month: number;
          year: number;
          title: string;
          status?: string;
          total_employees?: number;
          total_gross?: number;
          total_deductions?: number;
          total_net?: number;
          total_pf_employee?: number;
          total_pf_employer?: number;
          total_esi_employee?: number;
          total_esi_employer?: number;
          total_pt?: number;
          total_tds?: number;
          total_lop_deductions?: number;
          processed_by?: string | null;
          processed_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          locked_by?: string | null;
          locked_at?: string | null;
          payment_date?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          month?: number;
          year?: number;
          title?: string;
          status?: string;
          total_employees?: number;
          total_gross?: number;
          total_deductions?: number;
          total_net?: number;
          total_pf_employee?: number;
          total_pf_employer?: number;
          total_esi_employee?: number;
          total_esi_employer?: number;
          total_pt?: number;
          total_tds?: number;
          total_lop_deductions?: number;
          processed_by?: string | null;
          processed_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          locked_by?: string | null;
          locked_at?: string | null;
          payment_date?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payroll_history: {
        Row: {
          id: string;
          payroll_run_id: string;
          organization_id: string | null;
          changed_by_user_id: string | null;
          action: string;
          from_status: string | null;
          to_status: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payroll_run_id: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payroll_run_id?: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action?: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_exits: {
        Row: {
          id: string;
          employee_id: string;
          organization_id: string | null;
          exit_type: string;
          resignation_date: string;
          requested_last_working_day: string;
          agreed_last_working_day: string;
          notice_period_days: number;
          notice_waiver_days: number;
          reason_category: string;
          employee_reason: string;
          status: string;
          manager_approval_status: string;
          manager_approved_by: string | null;
          manager_approved_at: string | null;
          manager_notes: string | null;
          hr_approval_status: string;
          hr_approved_by: string | null;
          hr_approved_at: string | null;
          hr_notes: string | null;
          exit_interview_status: string;
          clearance_status: string;
          fnf_status: string;
          relieving_letter_issued: boolean;
          relieving_letter_issued_at: string | null;
          experience_letter_issued: boolean;
          experience_letter_issued_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          organization_id?: string | null;
          exit_type?: string;
          resignation_date?: string;
          requested_last_working_day: string;
          agreed_last_working_day: string;
          notice_period_days?: number;
          notice_waiver_days?: number;
          reason_category: string;
          employee_reason: string;
          status?: string;
          manager_approval_status?: string;
          manager_approved_by?: string | null;
          manager_approved_at?: string | null;
          manager_notes?: string | null;
          hr_approval_status?: string;
          hr_approved_by?: string | null;
          hr_approved_at?: string | null;
          hr_notes?: string | null;
          exit_interview_status?: string;
          clearance_status?: string;
          fnf_status?: string;
          relieving_letter_issued?: boolean;
          relieving_letter_issued_at?: string | null;
          experience_letter_issued?: boolean;
          experience_letter_issued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          organization_id?: string | null;
          exit_type?: string;
          resignation_date?: string;
          requested_last_working_day?: string;
          agreed_last_working_day?: string;
          notice_period_days?: number;
          notice_waiver_days?: number;
          reason_category?: string;
          employee_reason?: string;
          status?: string;
          manager_approval_status?: string;
          manager_approved_by?: string | null;
          manager_approved_at?: string | null;
          manager_notes?: string | null;
          hr_approval_status?: string;
          hr_approved_by?: string | null;
          hr_approved_at?: string | null;
          hr_notes?: string | null;
          exit_interview_status?: string;
          clearance_status?: string;
          fnf_status?: string;
          relieving_letter_issued?: boolean;
          relieving_letter_issued_at?: string | null;
          experience_letter_issued?: boolean;
          experience_letter_issued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exit_kt_tasks: {
        Row: {
          id: string;
          exit_id: string;
          organization_id: string | null;
          title: string;
          description: string | null;
          assigned_to_employee_id: string | null;
          status: string;
          due_date: string | null;
          completed_at: string | null;
          sign_off_by_employee_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          organization_id?: string | null;
          title: string;
          description?: string | null;
          assigned_to_employee_id?: string | null;
          status?: string;
          due_date?: string | null;
          completed_at?: string | null;
          sign_off_by_employee_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string | null;
          assigned_to_employee_id?: string | null;
          status?: string;
          due_date?: string | null;
          completed_at?: string | null;
          sign_off_by_employee_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exit_asset_returns: {
        Row: {
          id: string;
          exit_id: string;
          organization_id: string | null;
          asset_name: string;
          asset_type: string;
          serial_number: string | null;
          status: string;
          returned_date: string | null;
          verified_by: string | null;
          replacement_cost: number | null;
          condition_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          organization_id?: string | null;
          asset_name: string;
          asset_type?: string;
          serial_number?: string | null;
          status?: string;
          returned_date?: string | null;
          verified_by?: string | null;
          replacement_cost?: number | null;
          condition_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          organization_id?: string | null;
          asset_name?: string;
          asset_type?: string;
          serial_number?: string | null;
          status?: string;
          returned_date?: string | null;
          verified_by?: string | null;
          replacement_cost?: number | null;
          condition_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exit_clearances: {
        Row: {
          id: string;
          exit_id: string;
          organization_id: string | null;
          department_type: string;
          status: string;
          cleared_by: string | null;
          cleared_at: string | null;
          remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          organization_id?: string | null;
          department_type: string;
          status?: string;
          cleared_by?: string | null;
          cleared_at?: string | null;
          remarks?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          organization_id?: string | null;
          department_type?: string;
          status?: string;
          cleared_by?: string | null;
          cleared_at?: string | null;
          remarks?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exit_interviews: {
        Row: {
          id: string;
          exit_id: string;
          organization_id: string | null;
          conducted_by: string | null;
          conducted_at: string;
          culture_rating: number | null;
          management_rating: number | null;
          growth_rating: number | null;
          compensation_rating: number | null;
          work_life_rating: number | null;
          would_recommend: boolean;
          positive_feedback: string | null;
          improvement_areas: string | null;
          reason_for_leaving: string | null;
          confidential_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          organization_id?: string | null;
          conducted_by?: string | null;
          conducted_at?: string;
          culture_rating?: number | null;
          management_rating?: number | null;
          growth_rating?: number | null;
          compensation_rating?: number | null;
          work_life_rating?: number | null;
          would_recommend?: boolean;
          positive_feedback?: string | null;
          improvement_areas?: string | null;
          reason_for_leaving?: string | null;
          confidential_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          organization_id?: string | null;
          conducted_by?: string | null;
          conducted_at?: string;
          culture_rating?: number | null;
          management_rating?: number | null;
          growth_rating?: number | null;
          compensation_rating?: number | null;
          work_life_rating?: number | null;
          would_recommend?: boolean;
          positive_feedback?: string | null;
          improvement_areas?: string | null;
          reason_for_leaving?: string | null;
          confidential_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exit_fnf_settlements: {
        Row: {
          id: string;
          exit_id: string;
          employee_id: string;
          organization_id: string | null;
          settlement_date: string;
          working_days_in_final_month: number;
          payable_days_in_final_month: number;
          basic_salary_rate: number;
          unpaid_salary_amount: number;
          leave_encashment_days: number;
          leave_encashment_amount: number;
          gratuity_amount: number;
          bonus_incentives: number;
          pending_expense_claims: number;
          notice_shortfall_days: number;
          notice_recovery_amount: number;
          asset_deductions: number;
          statutory_deductions: number;
          other_deductions: number;
          total_earnings: number;
          total_deductions: number;
          net_payable: number;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
          settled_at: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          employee_id: string;
          organization_id?: string | null;
          settlement_date?: string;
          working_days_in_final_month?: number;
          payable_days_in_final_month?: number;
          basic_salary_rate?: number;
          unpaid_salary_amount?: number;
          leave_encashment_days?: number;
          leave_encashment_amount?: number;
          gratuity_amount?: number;
          bonus_incentives?: number;
          pending_expense_claims?: number;
          notice_shortfall_days?: number;
          notice_recovery_amount?: number;
          asset_deductions?: number;
          statutory_deductions?: number;
          other_deductions?: number;
          total_earnings?: number;
          total_deductions?: number;
          net_payable?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          settled_at?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          employee_id?: string;
          organization_id?: string | null;
          settlement_date?: string;
          working_days_in_final_month?: number;
          payable_days_in_final_month?: number;
          basic_salary_rate?: number;
          unpaid_salary_amount?: number;
          leave_encashment_days?: number;
          leave_encashment_amount?: number;
          gratuity_amount?: number;
          bonus_incentives?: number;
          pending_expense_claims?: number;
          notice_shortfall_days?: number;
          notice_recovery_amount?: number;
          asset_deductions?: number;
          statutory_deductions?: number;
          other_deductions?: number;
          total_earnings?: number;
          total_deductions?: number;
          net_payable?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          settled_at?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exit_history: {
        Row: {
          id: string;
          exit_id: string;
          organization_id: string | null;
          changed_by_user_id: string | null;
          action: string;
          from_status: string | null;
          to_status: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exit_id: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exit_id?: string;
          organization_id?: string | null;
          changed_by_user_id?: string | null;
          action?: string;
          from_status?: string | null;
          to_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      announcement_reads: {
        Row: {
          id: string;
          announcement_id: string;
          employee_id: string;
          user_id: string | null;
          organization_id: string | null;
          read_at: string;
        };
        Insert: {
          id?: string;
          announcement_id: string;
          employee_id: string;
          user_id?: string | null;
          organization_id?: string | null;
          read_at?: string;
        };
        Update: {
          id?: string;
          announcement_id?: string;
          employee_id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          read_at?: string;
        };
        Relationships: [];
      };
      engagement_surveys: {
        Row: {
          id: string;
          organization_id: string;
          created_by_user_id: string | null;
          title: string;
          description: string | null;
          type: "poll" | "survey" | "feedback_form" | "suggestion_box" | "satisfaction";
          status: "draft" | "active" | "closed" | "archived";
          target_audience: "all" | "department";
          target_department_id: string | null;
          is_anonymous: boolean;
          show_live_results: boolean;
          allow_multiple_submissions: boolean;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by_user_id?: string | null;
          title: string;
          description?: string | null;
          type?: "poll" | "survey" | "feedback_form" | "suggestion_box" | "satisfaction";
          status?: "draft" | "active" | "closed" | "archived";
          target_audience?: "all" | "department";
          target_department_id?: string | null;
          is_anonymous?: boolean;
          show_live_results?: boolean;
          allow_multiple_submissions?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by_user_id?: string | null;
          title?: string;
          description?: string | null;
          type?: "poll" | "survey" | "feedback_form" | "suggestion_box" | "satisfaction";
          status?: "draft" | "active" | "closed" | "archived";
          target_audience?: "all" | "department";
          target_department_id?: string | null;
          is_anonymous?: boolean;
          show_live_results?: boolean;
          allow_multiple_submissions?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      engagement_questions: {
        Row: {
          id: string;
          survey_id: string;
          organization_id: string;
          question_text: string;
          question_type: "single_choice" | "multiple_choice" | "rating_scale" | "text" | "boolean" | "nps";
          options: Json | null;
          is_required: boolean;
          order_index: number;
          scale_min: number | null;
          scale_max: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          organization_id: string;
          question_text: string;
          question_type: "single_choice" | "multiple_choice" | "rating_scale" | "text" | "boolean" | "nps";
          options?: Json | null;
          is_required?: boolean;
          order_index?: number;
          scale_min?: number | null;
          scale_max?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          survey_id?: string;
          organization_id?: string;
          question_text?: string;
          question_type?: "single_choice" | "multiple_choice" | "rating_scale" | "text" | "boolean" | "nps";
          options?: Json | null;
          is_required?: boolean;
          order_index?: number;
          scale_min?: number | null;
          scale_max?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      engagement_responses: {
        Row: {
          id: string;
          survey_id: string;
          organization_id: string;
          employee_id: string | null;
          user_id: string | null;
          respondent_hash: string | null;
          is_anonymous: boolean;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          organization_id: string;
          employee_id?: string | null;
          user_id?: string | null;
          respondent_hash?: string | null;
          is_anonymous?: boolean;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          survey_id?: string;
          organization_id?: string;
          employee_id?: string | null;
          user_id?: string | null;
          respondent_hash?: string | null;
          is_anonymous?: boolean;
          submitted_at?: string;
        };
        Relationships: [];
      };
      engagement_answers: {
        Row: {
          id: string;
          response_id: string;
          question_id: string;
          survey_id: string;
          organization_id: string;
          answer_text: string | null;
          selected_options: Json | null;
          rating_value: number | null;
          boolean_value: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          response_id: string;
          question_id: string;
          survey_id: string;
          organization_id: string;
          answer_text?: string | null;
          selected_options?: Json | null;
          rating_value?: number | null;
          boolean_value?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          response_id?: string;
          question_id?: string;
          survey_id?: string;
          organization_id?: string;
          answer_text?: string | null;
          selected_options?: Json | null;
          rating_value?: number | null;
          boolean_value?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_suggestions: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string | null;
          user_id: string | null;
          is_anonymous: boolean;
          title: string;
          description: string;
          category: "Operations" | "Workplace Culture" | "Technology & Tools" | "Cost Saving" | "Wellness" | "Other";
          status: "submitted" | "under_review" | "planned" | "implemented" | "declined";
          admin_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          upvotes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id?: string | null;
          user_id?: string | null;
          is_anonymous?: boolean;
          title: string;
          description: string;
          category?: "Operations" | "Workplace Culture" | "Technology & Tools" | "Cost Saving" | "Wellness" | "Other";
          status?: "submitted" | "under_review" | "planned" | "implemented" | "declined";
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          upvotes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string | null;
          user_id?: string | null;
          is_anonymous?: boolean;
          title?: string;
          description?: string;
          category?: "Operations" | "Workplace Culture" | "Technology & Tools" | "Cost Saving" | "Wellness" | "Other";
          status?: "submitted" | "under_review" | "planned" | "implemented" | "declined";
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          upvotes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_suggestion_upvotes: {
        Row: {
          id: string;
          suggestion_id: string;
          employee_id: string;
          organization_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          suggestion_id: string;
          employee_id: string;
          organization_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          suggestion_id?: string;
          employee_id?: string;
          organization_id?: string;
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
      run_daily_automation_checks: {
        Args: {
          _organization_id: string;
        };
        Returns: Json;
      };
      get_reports_analytics_overview: {
        Args: {
          _organization_id: string;
          _start_date: string;
          _end_date: string;
          _department_id?: string | null;
        };
        Returns: Json;
      };
      calculate_monthly_payroll_run: {
        Args: {
          _organization_id: string;
          _year: number;
          _month: number;
          _user_id: string;
        };
        Returns: Json;
      };
      approve_payroll_run: {
        Args: {
          _payroll_run_id: string;
          _user_id: string;
          _notes?: string | null;
        };
        Returns: Json;
      };
      lock_payroll_run: {
        Args: {
          _payroll_run_id: string;
          _user_id: string;
          _payment_date?: string | null;
          _payment_ref?: string | null;
          _notes?: string | null;
        };
        Returns: Json;
      };
      submit_employee_resignation: {
        Args: {
          _employee_id: string;
          _requested_lwd: string;
          _reason_category: string;
          _employee_reason: string;
        };
        Returns: Json;
      };
      review_employee_resignation: {
        Args: {
          _exit_id: string;
          _reviewer_id: string;
          _action: string;
          _agreed_lwd?: string | null;
          _notice_waiver?: number | null;
          _notes?: string | null;
        };
        Returns: Json;
      };
      finalize_employee_exit: {
        Args: {
          _exit_id: string;
          _user_id: string;
          _notes?: string | null;
        };
        Returns: Json;
      };
      create_hr_ticket: {
        Args: {
          p_subject: string;
          p_category: string;
          p_priority: string;
          p_description: string;
          p_employee_id?: string | null;
          p_attachment_url?: string | null;
          p_attachment_name?: string | null;
          p_attachment_size?: number | null;
        };
        Returns: string;
      };
      update_hr_ticket_status: {
        Args: {
          p_ticket_id: string;
          p_status: string;
          p_assigned_to?: string | null;
          p_assigned_employee_id?: string | null;
          p_resolution_notes?: string | null;
        };
        Returns: Json;
      };
      add_hr_ticket_comment: {
        Args: {
          p_ticket_id: string;
          p_message: string;
          p_is_internal?: boolean;
          p_attachment_url?: string | null;
          p_attachment_name?: string | null;
          p_attachment_size?: number | null;
        };
        Returns: string;
      };
      submit_expense_claim: {
        Args: {
          p_title: string;
          p_category: string;
          p_amount: number;
          p_expense_date: string;
          p_notes?: string | null;
          p_receipt_url?: string | null;
          p_receipt_storage_path?: string | null;
          p_receipt_name?: string | null;
          p_receipt_size?: number | null;
          p_employee_id?: string | null;
        };
        Returns: string;
      };
      approve_expense_claim: {
        Args: {
          p_claim_id: string;
          p_level: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      reject_expense_claim: {
        Args: {
          p_claim_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      mark_expense_reimbursed: {
        Args: {
          p_claim_id: string;
          p_reference?: string | null;
          p_payment_method?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };

      superadmin_provision_user: {
        Args: {
          p_email: string;
          p_password: string;
          p_full_name: string;
          p_role: string;
          p_department_id?: string | null;
          p_designation?: string | null;
          p_phone?: string | null;
        };
        Returns: string;
      };
      superadmin_set_user_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: string;
        };
        Returns: boolean;
      };
      superadmin_toggle_user_status: {
        Args: {
          p_target_user_id: string;
          p_active: boolean;
        };
        Returns: boolean;
      };
      superadmin_reset_user_password: {
        Args: {
          p_target_user_id: string;
          p_new_password: string;
        };
        Returns: boolean;
      };
      apply_leave_transactional: {
        Args: {
          p_employee_id: string;
          p_leave_type_id: string;
          p_from_date: string;
          p_to_date: string;
          p_days: number;
          p_half_day?: boolean | null;
          p_half_day_period?: string | null;
          p_reason?: string | null;
          p_attachment_url?: string | null;
        };
        Returns: Json;
      };
      approve_leave_transactional: {
        Args: {
          p_request_id: string;
          p_comment?: string | null;
        };
        Returns: boolean;
      };
      reject_leave_transactional: {
        Args: {
          p_request_id: string;
          p_comment?: string | null;
        };
        Returns: boolean;
      };
      cancel_leave_transactional: {
        Args: {
          p_request_id: string;
          p_reason?: string | null;
        };
        Returns: boolean;
      };
      allocate_annual_leaves: {
        Args: {
          p_year: number;
          p_employee_id?: string | null;
          p_organization_id?: string | null;
        };
        Returns: number;
      };
      record_geofence_punch: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_work_location_id?: string | null;
          p_accuracy?: number | null;
        };
        Returns: Json;
      };
      admin_create_employee: {
        Args: {
          p_email: string;
          p_password: string;
          p_full_name: string;
          p_department?: string;
          p_phone?: string | null;
          p_person_code?: string | null;
        };
        Returns: string;
      };
      admin_create_employee_v2: {
        Args: {
          p_email: string;
          p_password: string;
          p_full_name: string;
          p_department?: string;
          p_designation?: string;
          p_phone?: string | null;
          p_person_code?: string | null;
          p_manager_id?: string | null;
          p_joining_date?: string | null;
          p_employment_type?: string | null;
          p_work_location?: string | null;
          p_shift_id?: string | null;
          p_personal_email?: string | null;
          p_gender?: string | null;
          p_date_of_birth?: string | null;
          p_blood_group?: string | null;
          p_marital_status?: string | null;
          p_current_address?: string | null;
          p_permanent_address?: string | null;
          p_emergency_contact_name?: string | null;
          p_emergency_contact_phone?: string | null;
          p_emergency_contact_relation?: string | null;
        };
        Returns: string;
      };
      approve_attendance_correction: {
        Args: {
          p_correction_id: string;
          p_admin_notes?: string | null;
        };
        Returns: boolean;
      };
      reject_attendance_correction: {
        Args: {
          p_correction_id: string;
          p_admin_notes?: string | null;
        };
        Returns: boolean;
      };
      process_leave_approval: {
        Args: {
          p_request_id: string;
          p_decision: string;
          p_comment?: string | null;
        };
        Returns: boolean;
      };
      apply_leave_with_sandwich: {
        Args: {
          p_employee_id: string;
          p_leave_type_id: string;
          p_from_date: string;
          p_to_date: string;
          p_days: number;
          p_half_day?: boolean | null;
          p_half_day_period?: string | null;
          p_reason?: string | null;
          p_attachment_url?: string | null;
        };
        Returns: Json;
      };
      recalculate_leave_balances: {
        Args: {
          p_year: number;
        };
        Returns: boolean;
      };
      recalculate_onboarding_progress: {
        Args: {
          p_onboarding_id: string;
        };
        Returns: number;
      };
      start_employee_onboarding: {
        Args: {
          p_employee_id: string;
          p_template_id?: string | null;
          p_target_date?: string | null;
        };
        Returns: string;
      };
      submit_onboarding_task: {
        Args: {
          p_task_id: string;
          p_document_id?: string | null;
          p_notes?: string | null;
        };
        Returns: boolean;
      };
      verify_employee_document: {
        Args: {
          p_document_id: string;
          p_status: string;
          p_rejection_reason?: string | null;
        };
        Returns: boolean;
      };
      complete_employee_onboarding: {
        Args: {
          p_onboarding_id: string;
          p_hr_notes?: string | null;
        };
        Returns: boolean;
      };
      advance_candidate_stage: {
        Args: {
          p_candidate_id: string;
          p_new_stage: string;
          p_notes?: string | null;
          p_rejection_reason?: string | null;
        };
        Returns: boolean;
      };
      submit_interview_feedback: {
        Args: {
          p_interview_id: string;
          p_rating: number;
          p_recommendation: string;
          p_strengths?: string | null;
          p_weaknesses?: string | null;
          p_feedback?: string | null;
        };
        Returns: boolean;
      };
      convert_candidate_to_employee: {
        Args: {
          p_candidate_id: string;
          p_employee_code: string;
          p_joining_date: string;
          p_designation?: string | null;
          p_department_id?: string | null;
          p_manager_id?: string | null;
          p_employment_type?: string | null;
          p_shift_id?: string | null;
          p_start_onboarding?: boolean | null;
        };
        Returns: string;
      };
      submit_self_assessment: {
        Args: {
          p_review_id: string;
          p_self_rating: number;
          p_self_achievements?: string | null;
          p_self_growth_areas?: string | null;
          p_self_comments?: string | null;
        };
        Returns: boolean;
      };
      submit_manager_assessment: {
        Args: {
          p_review_id: string;
          p_manager_rating: number;
          p_manager_feedback?: string | null;
          p_manager_strengths?: string | null;
          p_manager_development_plan?: string | null;
          p_manager_recommendation?: string | null;
          p_final_score?: number | null;
        };
        Returns: boolean;
      };
      update_goal_progress: {
        Args: {
          p_goal_id: string;
          p_progress: number;
          p_current_value?: number | null;
          p_status?: string | null;
        };
        Returns: boolean;
      };
      complete_lesson_module: {
        Args: {
          p_enrollment_id: string;
          p_module_id: string;
        };
        Returns: Json;
      };
      submit_quiz_assessment: {
        Args: {
          p_enrollment_id: string;
          p_quiz_id: string;
          p_answers: Json;
        };
        Returns: Json;
      };
      assign_course_to_employees: {
        Args: {
          p_course_id: string;
          p_employee_ids: string[];
          p_due_date?: string | null;
        };
        Returns: number;
      };
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
      submit_engagement_survey_response: {
        Args: {
          _survey_id: string;
          _employee_id: string;
          _answers: Json;
        };
        Returns: Json;
      };
      toggle_suggestion_upvote: {
        Args: {
          _suggestion_id: string;
          _employee_id: string;
        };
        Returns: Json;
      };
      mark_announcement_read: {
        Args: {
          _announcement_id: string;
          _employee_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "employee" | "superadmin";
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
