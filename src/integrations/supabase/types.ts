export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          logo_url: string | null;
          plan_tier: "starter" | "pro" | "enterprise";
          max_employees: number;
          gps_retention_days: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          logo_url?: string | null;
          plan_tier?: "starter" | "pro" | "enterprise";
          max_employees?: number;
          gps_retention_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          legal_name?: string | null;
          logo_url?: string | null;
          plan_tier?: "starter" | "pro" | "enterprise";
          max_employees?: number;
          gps_retention_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "super_admin" | "org_admin" | "hr_manager" | "employee";
          status: "active" | "suspended" | "invited";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: "super_admin" | "org_admin" | "hr_manager" | "employee";
          status?: "active" | "suspended" | "invited";
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: "super_admin" | "org_admin" | "hr_manager" | "employee";
          status?: "active" | "suspended" | "invited";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      work_locations: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          radius_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          address?: string | null;
          latitude?: number;
          longitude?: number;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      geofence_zones: {
        Row: {
          id: string;
          location_id: string;
          name: string;
          zone_type: "circle" | "polygon";
          polygon_coordinates: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          name: string;
          zone_type?: "circle" | "polygon";
          polygon_coordinates?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          name?: string;
          zone_type?: "circle" | "polygon";
          polygon_coordinates?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          start_time: string;
          end_time: string;
          late_grace_minutes: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          start_time?: string;
          end_time?: string;
          late_grace_minutes?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          start_time?: string;
          end_time?: string;
          late_grace_minutes?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_location_assignments: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          location_id: string;
          is_primary: boolean;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          location_id: string;
          is_primary?: boolean;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          location_id?: string;
          is_primary?: boolean;
          assigned_at?: string;
        };
        Relationships: [];
      };
      registered_devices: {
        Row: {
          id: string;
          employee_id: string;
          device_uuid: string;
          device_model: string | null;
          operating_system: string | null;
          is_active: boolean;
          registered_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          device_uuid: string;
          device_model?: string | null;
          operating_system?: string | null;
          is_active?: boolean;
          registered_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          device_uuid?: string;
          device_model?: string | null;
          operating_system?: string | null;
          is_active?: boolean;
          registered_at?: string;
        };
        Relationships: [];
      };
      geofence_events: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          location_id: string | null;
          event_type: "ENTER" | "EXIT" | "DWELL";
          latitude: number | null;
          longitude: number | null;
          accuracy_meters: number | null;
          is_mock: boolean;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          location_id?: string | null;
          event_type: "ENTER" | "EXIT" | "DWELL";
          latitude?: number | null;
          longitude?: number | null;
          accuracy_meters?: number | null;
          is_mock?: boolean;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          location_id?: string | null;
          event_type?: "ENTER" | "EXIT" | "DWELL";
          latitude?: number | null;
          longitude?: number | null;
          accuracy_meters?: number | null;
          is_mock?: boolean;
          recorded_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          organization_id?: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          organization_id?: string | null;
          work_location_id?: string | null;
          default_shift_id?: string | null;
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
          is_superadmin?: boolean | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          work_location_id?: string | null;
          default_shift_id?: string | null;
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
          is_superadmin?: boolean | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          work_location_id?: string | null;
          default_shift_id?: string | null;
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
          is_superadmin?: boolean | null;
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
      attendance: {
        Row: {
          id: string;
          organization_id?: string | null;
          employee_id: string;
          work_location_id?: string | null;
          date: string;
          check_in: string | null;
          check_out: string | null;
          check_in_lat?: number | null;
          check_in_lon?: number | null;
          check_out_lat?: number | null;
          check_out_lon?: number | null;
          device_id?: string | null;
          total_hours?: number | null;
          status: Database["public"]["Enums"]["attendance_status"];
          method: string | null;
          confidence: number | null;
          note: string | null;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          employee_id: string;
          work_location_id?: string | null;
          date: string;
          check_in?: string | null;
          check_out?: string | null;
          check_in_lat?: number | null;
          check_in_lon?: number | null;
          check_out_lat?: number | null;
          check_out_lon?: number | null;
          device_id?: string | null;
          total_hours?: number | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          method?: string | null;
          confidence?: number | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          employee_id?: string;
          work_location_id?: string | null;
          date?: string;
          check_in?: string | null;
          check_out?: string | null;
          check_in_lat?: number | null;
          check_in_lon?: number | null;
          check_out_lat?: number | null;
          check_out_lon?: number | null;
          device_id?: string | null;
          total_hours?: number | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          method?: string | null;
          confidence?: number | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
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
      attendance_exceptions: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          session_id: string | null;
          exception_type:
            "MISSED_CHECKOUT" | "OUTSIDE_GEOFENCE" | "LATE_ARRIVAL" | "EARLY_DEPARTURE";
          reason: string;
          regularization_status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          session_id?: string | null;
          exception_type:
            "MISSED_CHECKOUT" | "OUTSIDE_GEOFENCE" | "LATE_ARRIVAL" | "EARLY_DEPARTURE";
          reason: string;
          regularization_status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          session_id?: string | null;
          exception_type?:
            "MISSED_CHECKOUT" | "OUTSIDE_GEOFENCE" | "LATE_ARRIVAL" | "EARLY_DEPARTURE";
          reason?: string;
          regularization_status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attendance_monthly_summaries: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          year: number;
          month: number;
          total_working_days: number;
          days_present: number;
          days_late: number;
          days_half_day: number;
          days_absent: number;
          days_on_leave: number;
          total_hours_worked: number;
          is_locked: boolean;
          pdf_archive_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          year: number;
          month: number;
          total_working_days: number;
          days_present?: number;
          days_late?: number;
          days_half_day?: number;
          days_absent?: number;
          days_on_leave?: number;
          total_hours_worked?: number;
          is_locked?: boolean;
          pdf_archive_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          year?: number;
          month?: number;
          total_working_days?: number;
          days_present?: number;
          days_late?: number;
          days_half_day?: number;
          days_absent?: number;
          days_on_leave?: number;
          total_hours_worked?: number;
          is_locked?: boolean;
          pdf_archive_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attendance_archives: {
        Row: {
          id: string;
          organization_id: string;
          google_email: string;
          refresh_token_encrypted: string | null;
          root_folder_id: string | null;
          auto_backup_enabled: boolean;
          last_archive_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          google_email: string;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          auto_backup_enabled?: boolean;
          last_archive_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          google_email?: string;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          auto_backup_enabled?: boolean;
          last_archive_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archive_jobs: {
        Row: {
          id: string;
          organization_id: string;
          year: number;
          month: number;
          status: "pending" | "processing" | "completed" | "failed";
          total_files_expected: number;
          total_files_uploaded: number;
          manifest_sha256: string | null;
          error_message: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          year: number;
          month: number;
          status?: "pending" | "processing" | "completed" | "failed";
          total_files_expected?: number;
          total_files_uploaded?: number;
          manifest_sha256?: string | null;
          error_message?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          year?: number;
          month?: number;
          status?: "pending" | "processing" | "completed" | "failed";
          total_files_expected?: number;
          total_files_uploaded?: number;
          manifest_sha256?: string | null;
          error_message?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      archive_files: {
        Row: {
          id: string;
          job_id: string;
          organization_id: string;
          employee_id: string | null;
          file_name: string;
          file_type: "master_summary" | "employee_report";
          drive_file_id: string;
          drive_web_link: string | null;
          sha256_hash: string;
          file_size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          organization_id: string;
          employee_id?: string | null;
          file_name: string;
          file_type: "master_summary" | "employee_report";
          drive_file_id: string;
          drive_web_link?: string | null;
          sha256_hash: string;
          file_size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          organization_id?: string;
          employee_id?: string | null;
          file_name?: string;
          file_type?: "master_summary" | "employee_report";
          drive_file_id?: string;
          drive_web_link?: string | null;
          sha256_hash?: string;
          file_size_bytes?: number;
          created_at?: string;
        };
        Relationships: [];
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
      settings: {
        Row: {
          id: number;
          organization_id?: string | null;
          work_start: string | null;
          work_end: string | null;
          late_grace_minutes: number | null;
          weekly_off_days: number[] | null;
          face_match_threshold: number | null;
          approval_flow: string | null;
          store_capture_photos: boolean | null;
          retention_days: number | null;
          email_notifications: boolean | null;
          duplicate_scan_minutes: number | null;
        };
        Insert: {
          id?: number;
          organization_id?: string | null;
          work_start?: string | null;
          work_end?: string | null;
          late_grace_minutes?: number | null;
          weekly_off_days?: number[] | null;
          face_match_threshold?: number | null;
          approval_flow?: string | null;
          store_capture_photos?: boolean | null;
          retention_days?: number | null;
          email_notifications?: boolean | null;
          duplicate_scan_minutes?: number | null;
        };
        Update: {
          id?: number;
          organization_id?: string | null;
          work_start?: string | null;
          work_end?: string | null;
          late_grace_minutes?: number | null;
          weekly_off_days?: number[] | null;
          face_match_threshold?: number | null;
          approval_flow?: string | null;
          store_capture_photos?: boolean | null;
          retention_days?: number | null;
          email_notifications?: boolean | null;
          duplicate_scan_minutes?: number | null;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          organization_id: string | null;
          employee_id: string;
          leave_type_id: string;
          from_date: string;
          to_date: string;
          days: number;
          half_day: boolean | null;
          reason: string | null;
          attachment_url: string | null;
          status: Database["public"]["Enums"]["leave_status"];
          manager_id: string | null;
          manager_comment: string | null;
          admin_id: string | null;
          admin_comment: string | null;
          applied_at: string | null;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          employee_id: string;
          leave_type_id: string;
          from_date: string;
          to_date: string;
          days: number;
          half_day?: boolean | null;
          reason?: string | null;
          attachment_url?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          manager_id?: string | null;
          manager_comment?: string | null;
          admin_id?: string | null;
          admin_comment?: string | null;
          applied_at?: string | null;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          employee_id?: string;
          leave_type_id?: string;
          from_date?: string;
          to_date?: string;
          days?: number;
          half_day?: boolean | null;
          reason?: string | null;
          attachment_url?: string | null;
          status?: Database["public"]["Enums"]["leave_status"];
          manager_id?: string | null;
          manager_comment?: string | null;
          admin_id?: string | null;
          admin_comment?: string | null;
          applied_at?: string | null;
          decided_at?: string | null;
        };
        Relationships: [];
      };
      leave_balances: {
        Row: {
          id: string;
          organization_id: string | null;
          employee_id: string;
          leave_type_id: string;
          year: number;
          total: number;
          used: number;
          remaining: number | null;
          pending?: number;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          employee_id: string;
          leave_type_id: string;
          year?: number;
          total?: number;
          used?: number;
          remaining?: number | null;
          pending?: number;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          employee_id?: string;
          leave_type_id?: string;
          year?: number;
          total?: number;
          used?: number;
          remaining?: number | null;
          pending?: number;
        };
        Relationships: [];
      };
      leave_types: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          days_per_year: number;
          days_allowed: number;
          is_paid: boolean | null;
          active: boolean | null;
          requires_approval: boolean | null;
          color: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          days_per_year?: number;
          days_allowed?: number;
          is_paid?: boolean | null;
          active?: boolean | null;
          requires_approval?: boolean | null;
          color?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          days_per_year?: number;
          days_allowed?: number;
          is_paid?: boolean | null;
          active?: boolean | null;
          requires_approval?: boolean | null;
          color?: string | null;
        };
        Relationships: [];
      };
      holidays: {
        Row: {
          id: string;
          date: string;
          title: string;
          description: string | null;
          created_by: string | null;
          name: string | null;
          is_optional: boolean | null;
          organization_id: string | null;
          work_location_id: string | null;
        };
        Insert: {
          id?: string;
          date: string;
          title: string;
          description?: string | null;
          created_by?: string | null;
          name?: string | null;
          is_optional?: boolean | null;
          organization_id?: string | null;
          work_location_id?: string | null;
        };
        Update: {
          id?: string;
          date?: string;
          title?: string;
          description?: string | null;
          created_by?: string | null;
          name?: string | null;
          is_optional?: boolean | null;
          organization_id?: string | null;
          work_location_id?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          file_url: string;
          uploaded_by: string | null;
          created_at: string | null;
          description: string | null;
          file_size: number | null;
          mime_type: string | null;
          drive_link: string | null;
          organization_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          file_url: string;
          uploaded_by?: string | null;
          created_at?: string | null;
          description?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          drive_link?: string | null;
          organization_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string | null;
          file_url?: string;
          uploaded_by?: string | null;
          created_at?: string | null;
          description?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          drive_link?: string | null;
          organization_id?: string | null;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          message: string;
          attachment_url: string | null;
          target: string | null;
          target_department_id: string | null;
          target_employee_ids: string[] | null;
          pinned: boolean | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string | null;
          organization_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          attachment_url?: string | null;
          target?: string | null;
          target_department_id?: string | null;
          target_employee_ids?: string[] | null;
          pinned?: boolean | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          organization_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          message?: string;
          attachment_url?: string | null;
          target?: string | null;
          target_department_id?: string | null;
          target_employee_ids?: string[] | null;
          pinned?: boolean | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          organization_id?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          name: string;
          person_code: string | null;
          department: string | null;
          email: string | null;
          phone: string | null;
          consent: boolean | null;
          active: boolean | null;
          photo_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          person_code?: string | null;
          department?: string | null;
          email?: string | null;
          phone?: string | null;
          consent?: boolean | null;
          active?: boolean | null;
          photo_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          person_code?: string | null;
          department?: string | null;
          email?: string | null;
          phone?: string | null;
          consent?: boolean | null;
          active?: boolean | null;
          photo_url?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          details: Json | null;
          created_at: string | null;
          user_email: string | null;
          target_user_id: string | null;
          organization_id: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          details?: Json | null;
          created_at?: string | null;
          user_email?: string | null;
          target_user_id?: string | null;
          organization_id?: string | null;
          actor_id?: string;
          target_id?: string | null;
          target_table?: string;
          changes?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          details?: Json | null;
          created_at?: string | null;
          user_email?: string | null;
          target_user_id?: string | null;
          organization_id?: string | null;
          actor_id?: string;
          target_id?: string | null;
          target_table?: string;
          changes?: Json | null;
        };
        Relationships: [];
      };
      drive_connection: {
        Row: {
          id: string;
          google_email: string | null;
          refresh_token_encrypted: string | null;
          root_folder_id: string | null;
          connected_at: string | null;
          connected_by: string | null;
          auto_backup_on_pdf: boolean | null;
          daily_backup: boolean | null;
        };
        Insert: {
          id?: string;
          google_email?: string | null;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          connected_at?: string | null;
          connected_by?: string | null;
          auto_backup_on_pdf?: boolean | null;
          daily_backup?: boolean | null;
        };
        Update: {
          id?: string;
          google_email?: string | null;
          refresh_token_encrypted?: string | null;
          root_folder_id?: string | null;
          connected_at?: string | null;
          connected_by?: string | null;
          auto_backup_on_pdf?: boolean | null;
          daily_backup?: boolean | null;
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
          status: string | null;
          error_message: string | null;
          retry_count: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          file_type?: string | null;
          file_name: string;
          drive_file_id?: string | null;
          drive_link?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          status?: string | null;
          error_message?: string | null;
          retry_count?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          file_type?: string | null;
          file_name?: string;
          drive_file_id?: string | null;
          drive_link?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          status?: string | null;
          error_message?: string | null;
          retry_count?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      face_data: {
        Row: {
          id: string;
          employee_id: string | null;
          descriptor: Json;
          consent: boolean;
          enrolled_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id?: string | null;
          descriptor: Json;
          consent?: boolean;
          enrolled_at?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string | null;
          descriptor?: Json;
          consent?: boolean;
          enrolled_at?: string | null;
        };
        Relationships: [];
      };
      face_descriptors: {
        Row: {
          person_id: string | null;
          descriptor: Json | null;
          samples: number | null;
          updated_at: string | null;
        };
        Insert: {
          person_id?: string | null;
          descriptor?: Json | null;
          samples?: number | null;
          updated_at?: string | null;
        };
        Update: {
          person_id?: string | null;
          descriptor?: Json | null;
          samples?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      work_location_stats: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          radius_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string | null;
          assigned_employee_count: number;
        };
        Relationships: [];
      };
      face_descriptors: {
        Row: {
          person_id: string | null;
          descriptor: Json | null;
          samples: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_create_employee: {
        Args: {
          p_email: string;
          p_password: string;
          p_full_name: string;
          p_department?: string | null;
          p_phone?: string | null;
          p_person_code?: string | null;
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
        Returns: Json;
      };
      superadmin_reset_user_password: {
        Args: {
          p_target_user_id: string;
          p_new_password: string;
        };
        Returns: Json;
      };
      superadmin_set_user_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: string;
        };
        Returns: Json;
      };
      superadmin_toggle_user_status: {
        Args: {
          p_target_user_id: string;
          p_active: boolean;
        };
        Returns: Json;
      };
      is_superadmin: {
        Args: {
          _user_id?: string;
        };
        Returns: boolean;
      };
      assign_employees_to_work_location: {
        Args: {
          p_location_id: string;
          p_employee_ids: string[];
        };
        Returns: Json;
      };
      current_org_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      has_org_role: {
        Args: {
          required_role: string;
        };
        Returns: boolean;
      };
      calculate_haversine_distance: {
        Args: {
          lat1: number;
          lon1: number;
          lat2: number;
          lon2: number;
        };
        Returns: number;
      };
      get_employee_geofence_context: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      verify_and_record_attendance: {
        Args: {
          p_action: string;
          p_lat: number;
          p_lon: number;
          p_accuracy?: number;
          p_device_id?: string;
        };
        Returns: Json;
      };
      cleanup_expired_gps_logs: {
        Args: Record<PropertyKey, never>;
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
    };
    Enums: {
      app_role: "admin" | "manager" | "employee";
      leave_status: "pending" | "approved" | "rejected" | "cancelled";
      attendance_status:
        "present" | "late" | "absent" | "half_day" | "on_leave" | "holiday" | "weekly_off";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
