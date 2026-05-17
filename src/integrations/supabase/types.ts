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
      agb_sections: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          service_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          service_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          service_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agb_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_history: {
        Row: {
          appointment_id: string
          change_type: string
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          appointment_id: string
          change_type: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          appointment_id?: string
          change_type?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          error_message: string | null
          id: string
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_type: string
          reminder_type: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          appointment_id: string
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type: string
          reminder_type: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          appointment_id?: string
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          reminder_type?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      appointments: {
        Row: {
          all_day: boolean | null
          appointment_date: string
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_team_member_ids: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          completed_at: string | null
          completion_notes: string | null
          confirmed_at: string | null
          confirmed_by_customer: boolean | null
          confirmed_by_firma: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          internal_notes: string | null
          is_recurring: boolean | null
          lead_id: string | null
          location_address: string | null
          location_city: string | null
          location_notes: string | null
          location_plz: string | null
          offer_id: string | null
          parent_appointment_id: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          reminder_sent_at: string | null
          reminder_sent_customer: boolean | null
          reminder_sent_firma: boolean | null
          reminder_sent_team: boolean | null
          required_equipment: string[] | null
          required_vehicles: string[] | null
          rescheduled_from_id: string | null
          rescheduled_to_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          appointment_date: string
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_team_member_ids?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          completed_at?: string | null
          completion_notes?: string | null
          confirmed_at?: string | null
          confirmed_by_customer?: boolean | null
          confirmed_by_firma?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          internal_notes?: string | null
          is_recurring?: boolean | null
          lead_id?: string | null
          location_address?: string | null
          location_city?: string | null
          location_notes?: string | null
          location_plz?: string | null
          offer_id?: string | null
          parent_appointment_id?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          reminder_sent_at?: string | null
          reminder_sent_customer?: boolean | null
          reminder_sent_firma?: boolean | null
          reminder_sent_team?: boolean | null
          required_equipment?: string[] | null
          required_vehicles?: string[] | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          appointment_date?: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_team_member_ids?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          completed_at?: string | null
          completion_notes?: string | null
          confirmed_at?: string | null
          confirmed_by_customer?: boolean | null
          confirmed_by_firma?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          internal_notes?: string | null
          is_recurring?: boolean | null
          lead_id?: string | null
          location_address?: string | null
          location_city?: string | null
          location_notes?: string | null
          location_plz?: string | null
          offer_id?: string | null
          parent_appointment_id?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          reminder_sent_at?: string | null
          reminder_sent_customer?: boolean | null
          reminder_sent_firma?: boolean | null
          reminder_sent_team?: boolean | null
          required_equipment?: string[] | null
          required_vehicles?: string[] | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "fk_rescheduled_from"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rescheduled_from"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "fk_rescheduled_to"
            columns: ["rescheduled_to_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rescheduled_to"
            columns: ["rescheduled_to_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      archive_logs: {
        Row: {
          archive_name: string
          archive_type: string
          compression_ratio: number | null
          created_at: string | null
          data_from_date: string | null
          data_to_date: string | null
          deleted_at: string | null
          error_message: string | null
          export_format: string | null
          file_size_bytes: number | null
          id: string
          is_restorable: boolean | null
          records_archived: number | null
          restored_at: string | null
          restored_by_user_id: string | null
          source_data_deleted: boolean | null
          status: string | null
          storage_path: string | null
          storage_type: string
          storage_url: string | null
          triggered_by: string | null
          triggered_by_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          archive_name: string
          archive_type: string
          compression_ratio?: number | null
          created_at?: string | null
          data_from_date?: string | null
          data_to_date?: string | null
          deleted_at?: string | null
          error_message?: string | null
          export_format?: string | null
          file_size_bytes?: number | null
          id?: string
          is_restorable?: boolean | null
          records_archived?: number | null
          restored_at?: string | null
          restored_by_user_id?: string | null
          source_data_deleted?: boolean | null
          status?: string | null
          storage_path?: string | null
          storage_type: string
          storage_url?: string | null
          triggered_by?: string | null
          triggered_by_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archive_name?: string
          archive_type?: string
          compression_ratio?: number | null
          created_at?: string | null
          data_from_date?: string | null
          data_to_date?: string | null
          deleted_at?: string | null
          error_message?: string | null
          export_format?: string | null
          file_size_bytes?: number | null
          id?: string
          is_restorable?: boolean | null
          records_archived?: number | null
          restored_at?: string | null
          restored_by_user_id?: string | null
          source_data_deleted?: boolean | null
          status?: string | null
          storage_path?: string | null
          storage_type?: string
          storage_url?: string | null
          triggered_by?: string | null
          triggered_by_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      archive_settings: {
        Row: {
          analytics_retention_days: number | null
          appointments_retention_days: number | null
          auto_archive_day: number | null
          compress_archives: boolean | null
          created_at: string | null
          default_export_format: string | null
          dropbox_enabled: boolean | null
          dropbox_folder_path: string | null
          email_logs_retention_days: number | null
          google_drive_enabled: boolean | null
          google_drive_folder_id: string | null
          id: string
          is_enabled: boolean | null
          leads_retention_days: number | null
          notifications_retention_days: number | null
          notify_email: string | null
          notify_on_archive: boolean | null
          offers_retention_days: number | null
          s3_bucket_name: string | null
          s3_enabled: boolean | null
          s3_region: string | null
          updated_at: string | null
        }
        Insert: {
          analytics_retention_days?: number | null
          appointments_retention_days?: number | null
          auto_archive_day?: number | null
          compress_archives?: boolean | null
          created_at?: string | null
          default_export_format?: string | null
          dropbox_enabled?: boolean | null
          dropbox_folder_path?: string | null
          email_logs_retention_days?: number | null
          google_drive_enabled?: boolean | null
          google_drive_folder_id?: string | null
          id?: string
          is_enabled?: boolean | null
          leads_retention_days?: number | null
          notifications_retention_days?: number | null
          notify_email?: string | null
          notify_on_archive?: boolean | null
          offers_retention_days?: number | null
          s3_bucket_name?: string | null
          s3_enabled?: boolean | null
          s3_region?: string | null
          updated_at?: string | null
        }
        Update: {
          analytics_retention_days?: number | null
          appointments_retention_days?: number | null
          auto_archive_day?: number | null
          compress_archives?: boolean | null
          created_at?: string | null
          default_export_format?: string | null
          dropbox_enabled?: boolean | null
          dropbox_folder_path?: string | null
          email_logs_retention_days?: number | null
          google_drive_enabled?: boolean | null
          google_drive_folder_id?: string | null
          id?: string
          is_enabled?: boolean | null
          leads_retention_days?: number | null
          notifications_retention_days?: number | null
          notify_email?: string | null
          notify_on_archive?: boolean | null
          offers_retention_days?: number | null
          s3_bucket_name?: string | null
          s3_enabled?: boolean | null
          s3_region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      archive_snapshots: {
        Row: {
          archive_log_id: string | null
          checksum: string | null
          chunk_number: number | null
          created_at: string | null
          data: Json
          id: string
          record_count: number | null
          total_chunks: number | null
        }
        Insert: {
          archive_log_id?: string | null
          checksum?: string | null
          chunk_number?: number | null
          created_at?: string | null
          data: Json
          id?: string
          record_count?: number | null
          total_chunks?: number | null
        }
        Update: {
          archive_log_id?: string | null
          checksum?: string | null
          chunk_number?: number | null
          created_at?: string | null
          data?: Json
          id?: string
          record_count?: number | null
          total_chunks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archive_snapshots_archive_log_id_fkey"
            columns: ["archive_log_id"]
            isOneToOne: false
            referencedRelation: "archive_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      auftraege: {
        Row: {
          assigned_team_members: string[] | null
          auftrag_nummer: string
          company_id: string
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          description: string | null
          estimated_duration_minutes: number | null
          extra_services: Json | null
          from_address: string | null
          id: string
          internal_notes: string | null
          items: Json | null
          lead_id: string | null
          offer_id: string | null
          reminder_days_before: number | null
          reminder_sent_at: string | null
          scheduled_date: string
          scheduled_time: string | null
          service_details: Json | null
          service_type: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["auftrag_status"] | null
          subtotal: number | null
          team_leader_id: string | null
          team_reminder_sent: boolean | null
          title: string
          to_address: string | null
          total: number | null
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          assigned_team_members?: string[] | null
          auftrag_nummer: string
          company_id: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          extra_services?: Json | null
          from_address?: string | null
          id?: string
          internal_notes?: string | null
          items?: Json | null
          lead_id?: string | null
          offer_id?: string | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          service_details?: Json | null
          service_type?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["auftrag_status"] | null
          subtotal?: number | null
          team_leader_id?: string | null
          team_reminder_sent?: boolean | null
          title: string
          to_address?: string | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          assigned_team_members?: string[] | null
          auftrag_nummer?: string
          company_id?: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          extra_services?: Json | null
          from_address?: string | null
          id?: string
          internal_notes?: string | null
          items?: Json | null
          lead_id?: string | null
          offer_id?: string | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          service_details?: Json | null
          service_type?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["auftrag_status"] | null
          subtotal?: number | null
          team_leader_id?: string | null
          team_reminder_sent?: boolean | null
          title?: string
          to_address?: string | null
          total?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auftraege_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          ai_model_used: string | null
          author_id: string | null
          author_name: string | null
          canonical_url: string | null
          category_id: string | null
          category_name: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          faq_schema: Json | null
          featured_image_alt: string | null
          featured_image_url: string | null
          focus_keyword: string | null
          gallery_images: Json | null
          generated_by_ai: boolean | null
          generation_prompt: string | null
          id: string
          last_viewed_at: string | null
          meta_description: string | null
          published_at: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string | null
          tags: string[] | null
          target_canton: string | null
          target_city: string | null
          target_service: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          ai_model_used?: string | null
          author_id?: string | null
          author_name?: string | null
          canonical_url?: string | null
          category_id?: string | null
          category_name?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          gallery_images?: Json | null
          generated_by_ai?: boolean | null
          generation_prompt?: string | null
          id?: string
          last_viewed_at?: string | null
          meta_description?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          target_canton?: string | null
          target_city?: string | null
          target_service?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          ai_model_used?: string | null
          author_id?: string | null
          author_name?: string | null
          canonical_url?: string | null
          category_id?: string | null
          category_name?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          gallery_images?: Json | null
          generated_by_ai?: boolean | null
          generation_prompt?: string | null
          id?: string
          last_viewed_at?: string | null
          meta_description?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          target_canton?: string | null
          target_city?: string | null
          target_service?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_seo_performance: {
        Row: {
          average_position: number | null
          clicks: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          post_id: string | null
        }
        Insert: {
          average_position?: number | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          post_id?: string | null
        }
        Update: {
          average_position?: number | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_seo_performance_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          include_in_offerte: boolean | null
          is_active: boolean | null
          sections: Json
          service_type: string
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          include_in_offerte?: boolean | null
          is_active?: boolean | null
          sections?: Json
          service_type: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          include_in_offerte?: boolean | null
          is_active?: boolean | null
          sections?: Json
          service_type?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          canton: string | null
          city: string
          company_name: string
          created_at: string | null
          crm_enabled: boolean | null
          crm_enabled_at: string | null
          crm_enabled_by: string | null
          default_payment_terms: string | null
          default_terms_and_conditions: string | null
          email: string
          house_number: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_reminder_sent_at: string | null
          last_reminder_type: string | null
          lead_sharing_preference:
            | Database["public"]["Enums"]["lead_sharing_preference"]
            | null
          legal_name: string | null
          logo_url: string | null
          manual_import_activated_at: string | null
          manual_import_enabled: boolean | null
          manual_import_monthly_fee: number | null
          manual_import_next_billing_at: string | null
          mwst_number: string | null
          notification_email: string | null
          notification_phone: string | null
          phone: string | null
          plz: string
          primary_color: string | null
          resend_api_key: string | null
          resend_enabled: boolean | null
          resend_from_email: string | null
          resend_from_name: string | null
          signature_url: string | null
          slogan: string | null
          slug: string | null
          sms_reminders_enabled: boolean | null
          street: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_notes: string | null
          subscription_type: string | null
          token_balance: number | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_enabled: boolean | null
          twilio_phone_number: string | null
          uid_number: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          canton?: string | null
          city: string
          company_name: string
          created_at?: string | null
          crm_enabled?: boolean | null
          crm_enabled_at?: string | null
          crm_enabled_by?: string | null
          default_payment_terms?: string | null
          default_terms_and_conditions?: string | null
          email: string
          house_number?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_reminder_sent_at?: string | null
          last_reminder_type?: string | null
          lead_sharing_preference?:
            | Database["public"]["Enums"]["lead_sharing_preference"]
            | null
          legal_name?: string | null
          logo_url?: string | null
          manual_import_activated_at?: string | null
          manual_import_enabled?: boolean | null
          manual_import_monthly_fee?: number | null
          manual_import_next_billing_at?: string | null
          mwst_number?: string | null
          notification_email?: string | null
          notification_phone?: string | null
          phone?: string | null
          plz: string
          primary_color?: string | null
          resend_api_key?: string | null
          resend_enabled?: boolean | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          signature_url?: string | null
          slogan?: string | null
          slug?: string | null
          sms_reminders_enabled?: boolean | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          subscription_type?: string | null
          token_balance?: number | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_number?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          canton?: string | null
          city?: string
          company_name?: string
          created_at?: string | null
          crm_enabled?: boolean | null
          crm_enabled_at?: string | null
          crm_enabled_by?: string | null
          default_payment_terms?: string | null
          default_terms_and_conditions?: string | null
          email?: string
          house_number?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_reminder_sent_at?: string | null
          last_reminder_type?: string | null
          lead_sharing_preference?:
            | Database["public"]["Enums"]["lead_sharing_preference"]
            | null
          legal_name?: string | null
          logo_url?: string | null
          manual_import_activated_at?: string | null
          manual_import_enabled?: boolean | null
          manual_import_monthly_fee?: number | null
          manual_import_next_billing_at?: string | null
          mwst_number?: string | null
          notification_email?: string | null
          notification_phone?: string | null
          phone?: string | null
          plz?: string
          primary_color?: string | null
          resend_api_key?: string | null
          resend_enabled?: boolean | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          signature_url?: string | null
          slogan?: string | null
          slug?: string | null
          sms_reminders_enabled?: boolean | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          subscription_type?: string | null
          token_balance?: number | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_number?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_offer_settings: {
        Row: {
          company_id: string
          created_at: string | null
          default_payment_due_days: number | null
          default_payment_method: string | null
          default_validity_days: number | null
          default_vat_rate: number | null
          highlight_inclusions: boolean | null
          id: string
          offer_number_prefix: string | null
          offer_number_start: number | null
          show_company_reference: boolean | null
          show_item_numbers: boolean | null
          show_mwst_separately: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          default_payment_due_days?: number | null
          default_payment_method?: string | null
          default_validity_days?: number | null
          default_vat_rate?: number | null
          highlight_inclusions?: boolean | null
          id?: string
          offer_number_prefix?: string | null
          offer_number_start?: number | null
          show_company_reference?: boolean | null
          show_item_numbers?: boolean | null
          show_mwst_separately?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          default_payment_due_days?: number | null
          default_payment_method?: string | null
          default_validity_days?: number | null
          default_vat_rate?: number | null
          highlight_inclusions?: boolean | null
          id?: string
          offer_number_prefix?: string | null
          offer_number_start?: number | null
          show_company_reference?: boolean | null
          show_item_numbers?: boolean | null
          show_mwst_separately?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_offer_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_offer_templates: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          payment_terms: string | null
          service_type: string
          terms_and_conditions: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          payment_terms?: string | null
          service_type: string
          terms_and_conditions?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          payment_terms?: string | null
          service_type?: string
          terms_and_conditions?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_offer_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_plz_coverage: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          plz: string
          radius_km: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plz: string
          radius_km?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plz?: string
          radius_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_plz_coverage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reminder_settings: {
        Row: {
          company_id: string
          created_at: string | null
          custom_footer_message: string | null
          customer_reminder_hours: number | null
          customer_reminders_enabled: boolean | null
          id: string
          include_customer_email: boolean | null
          include_customer_phone: boolean | null
          include_lead_details: boolean | null
          include_offer_details: boolean | null
          team_reminder_hours: number | null
          team_reminders_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          custom_footer_message?: string | null
          customer_reminder_hours?: number | null
          customer_reminders_enabled?: boolean | null
          id?: string
          include_customer_email?: boolean | null
          include_customer_phone?: boolean | null
          include_lead_details?: boolean | null
          include_offer_details?: boolean | null
          team_reminder_hours?: number | null
          team_reminders_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          custom_footer_message?: string | null
          customer_reminder_hours?: number | null
          customer_reminders_enabled?: boolean | null
          id?: string
          include_customer_email?: boolean | null
          include_customer_phone?: boolean | null
          include_lead_details?: boolean | null
          include_offer_details?: boolean | null
          team_reminder_hours?: number | null
          team_reminders_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_reminder_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_service_items: {
        Row: {
          category: string
          company_id: string
          created_at: string | null
          default_price: number | null
          description: string | null
          display_order: number | null
          id: string
          is_default_included: boolean | null
          is_optional: boolean | null
          name: string
          service_type: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_default_included?: boolean | null
          is_optional?: boolean | null
          name: string
          service_type: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_default_included?: boolean | null
          is_optional?: boolean | null
          name?: string
          service_type?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_service_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: "owner" | "admin" | "member"
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role?: "owner" | "admin" | "member"
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: "owner" | "admin" | "member"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_services: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          service_type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          service_type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consent_log: {
        Row: {
          consent_categories: Json | null
          consent_given: boolean | null
          consent_timestamp: string | null
          created_at: string | null
          id: string
          ip_address_hash: string | null
          user_agent: string | null
          visitor_id: string
          withdrawal_timestamp: string | null
        }
        Insert: {
          consent_categories?: Json | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          id?: string
          ip_address_hash?: string | null
          user_agent?: string | null
          visitor_id: string
          withdrawal_timestamp?: string | null
        }
        Update: {
          consent_categories?: Json | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          id?: string
          ip_address_hash?: string | null
          user_agent?: string | null
          visitor_id?: string
          withdrawal_timestamp?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          company_id: string | null
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          status: string
          subject: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          status?: string
          subject: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      firma_resources: {
        Row: {
          capacity_m3: number | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          license_plate: string | null
          name: string
          quantity: number | null
          resource_type: string
          updated_at: string | null
        }
        Insert: {
          capacity_m3?: number | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          license_plate?: string | null
          name: string
          quantity?: number | null
          resource_type: string
          updated_at?: string | null
        }
        Update: {
          capacity_m3?: number | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          license_plate?: string | null
          name?: string
          quantity?: number | null
          resource_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "firma_resources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_blacklist: {
        Row: {
          added_by: string | null
          blocked_count: number | null
          created_at: string | null
          id: string
          ip_address: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          blocked_count?: number | null
          created_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          blocked_count?: number | null
          created_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      job_price_estimates: {
        Row: {
          avg_price_chf: number
          created_at: string
          id: string
          max_price_chf: number
          min_price_chf: number
          notes: string | null
          room_count: string
          service_type: string
        }
        Insert: {
          avg_price_chf: number
          created_at?: string
          id?: string
          max_price_chf: number
          min_price_chf: number
          notes?: string | null
          room_count: string
          service_type: string
        }
        Update: {
          avg_price_chf?: number
          created_at?: string
          id?: string
          max_price_chf?: number
          min_price_chf?: number
          notes?: string | null
          room_count?: string
          service_type?: string
        }
        Relationships: []
      }
      klaviertransport_anfragen: {
        Row: {
          abholort_adresse: Json | null
          abholort_hindernisse: Json | null
          abholort_lift: Json | null
          abholort_stockwerk: string | null
          abholort_treppenhaus: string | null
          agb_akzeptiert: boolean | null
          anfrage_nummer: string | null
          bemerkungen: string | null
          berechtigung_bestaetigt: boolean | null
          created_at: string | null
          demontage: string | null
          equipment_required: string | null
          flexibilitaet: string | null
          form_version: number | null
          geschaetzte_distanz_km: number | null
          geschaetzter_preis_chf: number | null
          id: string
          instrument_age: string | null
          instrument_brand: string | null
          instrument_model: string | null
          instrument_notes: string | null
          instrument_photos: string[] | null
          instrument_type: string
          instrument_value: string | null
          kontakt_vor_ort: Json | null
          kunde_anrede: string | null
          kunde_email: string | null
          kunde_kontaktzeit: string | null
          kunde_nachname: string | null
          kunde_telefon: string | null
          kunde_vorname: string | null
          lieferort_adresse: Json | null
          lieferort_hindernisse: Json | null
          lieferort_lift: Json | null
          lieferort_stockwerk: string | null
          lieferort_treppenhaus: string | null
          service_type: string
          status: string | null
          transportfaehig_bestaetigt: boolean | null
          uhrzeit: string | null
          updated_at: string | null
          wunschdatum: string | null
          zusatzleistungen: Json | null
        }
        Insert: {
          abholort_adresse?: Json | null
          abholort_hindernisse?: Json | null
          abholort_lift?: Json | null
          abholort_stockwerk?: string | null
          abholort_treppenhaus?: string | null
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          demontage?: string | null
          equipment_required?: string | null
          flexibilitaet?: string | null
          form_version?: number | null
          geschaetzte_distanz_km?: number | null
          geschaetzter_preis_chf?: number | null
          id?: string
          instrument_age?: string | null
          instrument_brand?: string | null
          instrument_model?: string | null
          instrument_notes?: string | null
          instrument_photos?: string[] | null
          instrument_type: string
          instrument_value?: string | null
          kontakt_vor_ort?: Json | null
          kunde_anrede?: string | null
          kunde_email?: string | null
          kunde_kontaktzeit?: string | null
          kunde_nachname?: string | null
          kunde_telefon?: string | null
          kunde_vorname?: string | null
          lieferort_adresse?: Json | null
          lieferort_hindernisse?: Json | null
          lieferort_lift?: Json | null
          lieferort_stockwerk?: string | null
          lieferort_treppenhaus?: string | null
          service_type?: string
          status?: string | null
          transportfaehig_bestaetigt?: boolean | null
          uhrzeit?: string | null
          updated_at?: string | null
          wunschdatum?: string | null
          zusatzleistungen?: Json | null
        }
        Update: {
          abholort_adresse?: Json | null
          abholort_hindernisse?: Json | null
          abholort_lift?: Json | null
          abholort_stockwerk?: string | null
          abholort_treppenhaus?: string | null
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          demontage?: string | null
          equipment_required?: string | null
          flexibilitaet?: string | null
          form_version?: number | null
          geschaetzte_distanz_km?: number | null
          geschaetzter_preis_chf?: number | null
          id?: string
          instrument_age?: string | null
          instrument_brand?: string | null
          instrument_model?: string | null
          instrument_notes?: string | null
          instrument_photos?: string[] | null
          instrument_type?: string
          instrument_value?: string | null
          kontakt_vor_ort?: Json | null
          kunde_anrede?: string | null
          kunde_email?: string | null
          kunde_kontaktzeit?: string | null
          kunde_nachname?: string | null
          kunde_telefon?: string | null
          kunde_vorname?: string | null
          lieferort_adresse?: Json | null
          lieferort_hindernisse?: Json | null
          lieferort_lift?: Json | null
          lieferort_stockwerk?: string | null
          lieferort_treppenhaus?: string | null
          service_type?: string
          status?: string | null
          transportfaehig_bestaetigt?: boolean | null
          uhrzeit?: string | null
          updated_at?: string | null
          wunschdatum?: string | null
          zusatzleistungen?: Json | null
        }
        Relationships: []
      }
      landing_page_analytics: {
        Row: {
          avg_time_on_page: number | null
          conversions: number | null
          created_at: string | null
          date: string
          id: string
          landing_page_id: string | null
          unique_visitors: number | null
          views: number | null
        }
        Insert: {
          avg_time_on_page?: number | null
          conversions?: number | null
          created_at?: string | null
          date: string
          id?: string
          landing_page_id?: string | null
          unique_visitors?: number | null
          views?: number | null
        }
        Update: {
          avg_time_on_page?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          id?: string
          landing_page_id?: string | null
          unique_visitors?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_analytics_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          canonical_url: string | null
          content_sections: Json | null
          created_at: string | null
          created_by: string | null
          custom_faq: Json | null
          faq_source: string | null
          hero_cta_link: string | null
          hero_cta_text: string | null
          hero_description: string | null
          hero_image_url: string
          hero_subtitle: string | null
          hero_title: string
          id: string
          is_published: boolean | null
          og_image_url: string | null
          published_at: string | null
          seo_description: string
          seo_keywords: string[] | null
          seo_title: string
          service_type: string
          side_section_config: Json | null
          slug: string
          updated_at: string | null
          updated_by: string | null
          use_shared_content: boolean | null
        }
        Insert: {
          canonical_url?: string | null
          content_sections?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_faq?: Json | null
          faq_source?: string | null
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_description?: string | null
          hero_image_url: string
          hero_subtitle?: string | null
          hero_title: string
          id?: string
          is_published?: boolean | null
          og_image_url?: string | null
          published_at?: string | null
          seo_description: string
          seo_keywords?: string[] | null
          seo_title: string
          service_type: string
          side_section_config?: Json | null
          slug: string
          updated_at?: string | null
          updated_by?: string | null
          use_shared_content?: boolean | null
        }
        Update: {
          canonical_url?: string | null
          content_sections?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_faq?: Json | null
          faq_source?: string | null
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_description?: string | null
          hero_image_url?: string
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          is_published?: boolean | null
          og_image_url?: string | null
          published_at?: string | null
          seo_description?: string
          seo_keywords?: string[] | null
          seo_title?: string
          service_type?: string
          side_section_config?: Json | null
          slug?: string
          updated_at?: string | null
          updated_by?: string | null
          use_shared_content?: boolean | null
        }
        Relationships: []
      }
      lead_distributions: {
        Row: {
          company_id: string
          expires_at: string | null
          id: string
          lead_id: string
          rejection_reason: string | null
          responded_at: string | null
          sent_at: string | null
          status: string | null
          token_charged: boolean | null
          token_cost: number | null
          viewed_at: string | null
        }
        Insert: {
          company_id: string
          expires_at?: string | null
          id?: string
          lead_id: string
          rejection_reason?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
          token_charged?: boolean | null
          token_cost?: number | null
          viewed_at?: string | null
        }
        Update: {
          company_id?: string
          expires_at?: string | null
          id?: string
          lead_id?: string
          rejection_reason?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
          token_charged?: boolean | null
          token_cost?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distributions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distributions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          created_at: string | null
          description: string | null
          header_subtitle: string | null
          header_title: string | null
          id: string
          is_active: boolean | null
          name: string
          primary_color: string | null
          service_types: string[] | null
          show_header: boolean | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          primary_color?: string | null
          service_types?: string[] | null
          show_header?: boolean | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          primary_color?: string | null
          service_types?: string[] | null
          show_header?: boolean | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          accepted_count: number | null
          access_frequency: string | null
          additional_services_umzug: Json | null
          admin_notes: string | null
          anfragender_rolle: string | null
          bathroom_count: number | null
          berechtigung_bestaetigt: boolean | null
          cleaning_service_needed: boolean | null
          cleaning_windows: boolean | null
          clearing_type: string | null
          created_at: string | null
          customer_contact_time: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_salutation: string | null
          description: string | null
          detailed_form_data: Json | null
          disposal_type: string | null
          distance_km: number | null
          estimated_duration_minutes: number | null
          estimated_job_price_confidence: string | null
          estimated_job_price_max: number | null
          estimated_job_price_min: number | null
          estimated_volume: string | null
          expires_at: string | null
          form_version: number | null
          from_city: string
          from_distance_to_parking: number | null
          from_floor: number | null
          from_has_lift: boolean | null
          from_house_number: string | null
          from_lift_type: string | null
          from_living_space_m2: number | null
          from_path_obstruction: boolean | null
          from_plz: string
          from_rooms: number | null
          from_steps_to_entrance: string | null
          from_street: string | null
          gerichtsbefehl_vorhanden: boolean | null
          has_attic: boolean | null
          has_balcony: boolean | null
          has_basement: boolean | null
          has_garage: boolean | null
          has_heavy_items: boolean | null
          heavy_items_description: string | null
          id: string
          inventory_items: Json | null
          ip_address: string | null
          is_flexible_date: boolean | null
          items_description: string | null
          kitchen_type: string | null
          max_companies: number
          moebellift_floor: number | null
          moebellift_item_description: string | null
          moebellift_item_dimensions: string | null
          moving_date: string | null
          moving_flexibility: string | null
          moving_start_time: string | null
          needs_climate_control: boolean | null
          packing_service_needed: boolean | null
          piano_brand: string | null
          piano_type: string | null
          piano_weight_kg: number | null
          pickup_floor: number | null
          pickup_has_lift: boolean | null
          pickup_house_number: string | null
          pickup_street: string | null
          preferred_date: string | null
          preferred_time_slot: string | null
          property_type: string | null
          raeumungs_art: string | null
          rejection_reason: string | null
          service_type: string
          slug: string | null
          source: string | null
          source_form_id: string | null
          spam_score: number | null
          special_items: string[] | null
          staircase_turns: number | null
          staircase_type: string | null
          staircase_width_cm: number | null
          status: string | null
          storage_duration: string | null
          storage_items_description: string | null
          storage_needed: boolean | null
          storage_volume: string | null
          to_city: string | null
          to_distance_to_parking: number | null
          to_floor: number | null
          to_has_lift: boolean | null
          to_house_number: string | null
          to_lift_type: string | null
          to_living_space_m2: number | null
          to_path_obstruction: boolean | null
          to_plz: string | null
          to_rooms: number | null
          to_steps_to_entrance: string | null
          to_street: string | null
          token_cost: number | null
          token_cost_overridden: boolean
          umfang_bereiche: Json | null
          umfang_inventar: Json | null
          umfang_scope: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          window_access_possible: boolean | null
          zugang_hindernisse: Json | null
          zustand_allgemein: string | null
          zustand_besonderheiten: Json | null
        }
        Insert: {
          accepted_count?: number | null
          access_frequency?: string | null
          additional_services_umzug?: Json | null
          admin_notes?: string | null
          anfragender_rolle?: string | null
          bathroom_count?: number | null
          berechtigung_bestaetigt?: boolean | null
          cleaning_service_needed?: boolean | null
          cleaning_windows?: boolean | null
          clearing_type?: string | null
          created_at?: string | null
          customer_contact_time?: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_salutation?: string | null
          description?: string | null
          detailed_form_data?: Json | null
          disposal_type?: string | null
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_job_price_confidence?: string | null
          estimated_job_price_max?: number | null
          estimated_job_price_min?: number | null
          estimated_volume?: string | null
          expires_at?: string | null
          form_version?: number | null
          from_city: string
          from_distance_to_parking?: number | null
          from_floor?: number | null
          from_has_lift?: boolean | null
          from_house_number?: string | null
          from_lift_type?: string | null
          from_living_space_m2?: number | null
          from_path_obstruction?: boolean | null
          from_plz: string
          from_rooms?: number | null
          from_steps_to_entrance?: string | null
          from_street?: string | null
          gerichtsbefehl_vorhanden?: boolean | null
          has_attic?: boolean | null
          has_balcony?: boolean | null
          has_basement?: boolean | null
          has_garage?: boolean | null
          has_heavy_items?: boolean | null
          heavy_items_description?: string | null
          id?: string
          inventory_items?: Json | null
          ip_address?: string | null
          is_flexible_date?: boolean | null
          items_description?: string | null
          kitchen_type?: string | null
          max_companies?: number
          moebellift_floor?: number | null
          moebellift_item_description?: string | null
          moebellift_item_dimensions?: string | null
          moving_date?: string | null
          moving_flexibility?: string | null
          moving_start_time?: string | null
          needs_climate_control?: boolean | null
          packing_service_needed?: boolean | null
          piano_brand?: string | null
          piano_type?: string | null
          piano_weight_kg?: number | null
          pickup_floor?: number | null
          pickup_has_lift?: boolean | null
          pickup_house_number?: string | null
          pickup_street?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          property_type?: string | null
          raeumungs_art?: string | null
          rejection_reason?: string | null
          service_type: string
          slug?: string | null
          source?: string | null
          source_form_id?: string | null
          spam_score?: number | null
          special_items?: string[] | null
          staircase_turns?: number | null
          staircase_type?: string | null
          staircase_width_cm?: number | null
          status?: string | null
          storage_duration?: string | null
          storage_items_description?: string | null
          storage_needed?: boolean | null
          storage_volume?: string | null
          to_city?: string | null
          to_distance_to_parking?: number | null
          to_floor?: number | null
          to_has_lift?: boolean | null
          to_house_number?: string | null
          to_lift_type?: string | null
          to_living_space_m2?: number | null
          to_path_obstruction?: boolean | null
          to_plz?: string | null
          to_rooms?: number | null
          to_steps_to_entrance?: string | null
          to_street?: string | null
          token_cost?: number | null
          token_cost_overridden?: boolean
          umfang_bereiche?: Json | null
          umfang_inventar?: Json | null
          umfang_scope?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          window_access_possible?: boolean | null
          zugang_hindernisse?: Json | null
          zustand_allgemein?: string | null
          zustand_besonderheiten?: Json | null
        }
        Update: {
          accepted_count?: number | null
          access_frequency?: string | null
          additional_services_umzug?: Json | null
          admin_notes?: string | null
          anfragender_rolle?: string | null
          bathroom_count?: number | null
          berechtigung_bestaetigt?: boolean | null
          cleaning_service_needed?: boolean | null
          cleaning_windows?: boolean | null
          clearing_type?: string | null
          created_at?: string | null
          customer_contact_time?: string | null
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string
          customer_salutation?: string | null
          description?: string | null
          detailed_form_data?: Json | null
          disposal_type?: string | null
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_job_price_confidence?: string | null
          estimated_job_price_max?: number | null
          estimated_job_price_min?: number | null
          estimated_volume?: string | null
          expires_at?: string | null
          form_version?: number | null
          from_city?: string
          from_distance_to_parking?: number | null
          from_floor?: number | null
          from_has_lift?: boolean | null
          from_house_number?: string | null
          from_lift_type?: string | null
          from_living_space_m2?: number | null
          from_path_obstruction?: boolean | null
          from_plz?: string
          from_rooms?: number | null
          from_steps_to_entrance?: string | null
          from_street?: string | null
          gerichtsbefehl_vorhanden?: boolean | null
          has_attic?: boolean | null
          has_balcony?: boolean | null
          has_basement?: boolean | null
          has_garage?: boolean | null
          has_heavy_items?: boolean | null
          heavy_items_description?: string | null
          id?: string
          inventory_items?: Json | null
          ip_address?: string | null
          is_flexible_date?: boolean | null
          items_description?: string | null
          kitchen_type?: string | null
          max_companies?: number
          moebellift_floor?: number | null
          moebellift_item_description?: string | null
          moebellift_item_dimensions?: string | null
          moving_date?: string | null
          moving_flexibility?: string | null
          moving_start_time?: string | null
          needs_climate_control?: boolean | null
          packing_service_needed?: boolean | null
          piano_brand?: string | null
          piano_type?: string | null
          piano_weight_kg?: number | null
          pickup_floor?: number | null
          pickup_has_lift?: boolean | null
          pickup_house_number?: string | null
          pickup_street?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          property_type?: string | null
          raeumungs_art?: string | null
          rejection_reason?: string | null
          service_type?: string
          slug?: string | null
          source?: string | null
          source_form_id?: string | null
          spam_score?: number | null
          special_items?: string[] | null
          staircase_turns?: number | null
          staircase_type?: string | null
          staircase_width_cm?: number | null
          status?: string | null
          storage_duration?: string | null
          storage_items_description?: string | null
          storage_needed?: boolean | null
          storage_volume?: string | null
          to_city?: string | null
          to_distance_to_parking?: number | null
          to_floor?: number | null
          to_has_lift?: boolean | null
          to_house_number?: string | null
          to_lift_type?: string | null
          to_living_space_m2?: number | null
          to_path_obstruction?: boolean | null
          to_plz?: string | null
          to_rooms?: number | null
          to_steps_to_entrance?: string | null
          to_street?: string | null
          token_cost?: number | null
          token_cost_overridden?: boolean
          umfang_bereiche?: Json | null
          umfang_inventar?: Json | null
          umfang_scope?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          window_access_possible?: boolean | null
          zugang_hindernisse?: Json | null
          zustand_allgemein?: string | null
          zustand_besonderheiten?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_source_form_id_fkey"
            columns: ["source_form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      leistungsuebersicht_templates: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          excluded_services: string[] | null
          id: string
          included_service_ids: string[] | null
          is_active: boolean | null
          name: string
          notes: string | null
          service_type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          excluded_services?: string[] | null
          id?: string
          included_service_ids?: string[] | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          service_type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          excluded_services?: string[] | null
          id?: string
          included_service_ids?: string[] | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          service_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leistungsuebersicht_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_import_subscriptions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          company_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          monthly_tokens: number | null
          status: string | null
          total_imports_count: number | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          monthly_tokens?: number | null
          status?: string | null
          total_imports_count?: number | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          monthly_tokens?: number | null
          status?: string | null
          total_imports_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_import_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_imported_leads: {
        Row: {
          ai_confidence_score: number | null
          company_id: string
          created_at: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          lead_id: string | null
          raw_import_text: string
        }
        Insert: {
          ai_confidence_score?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          lead_id?: string | null
          raw_import_text: string
        }
        Update: {
          ai_confidence_score?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          lead_id?: string | null
          raw_import_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_imported_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_imported_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      moebellift_anfragen: {
        Row: {
          agb_akzeptiert: boolean | null
          anfrage_nummer: string | null
          bemerkungen: string | null
          berechtigung_bestaetigt: boolean | null
          created_at: string | null
          dauer: string | null
          einsatzort_adresse: Json | null
          empfohlener_lift_typ: string | null
          flexibilitaet: string | null
          form_version: number | null
          fotos: string[] | null
          geschaetzte_hoehe_m: number | null
          geschaetzter_preis_chf: number | null
          hindernisse: Json | null
          id: string
          kontakt_vor_ort: Json | null
          kunde_anrede: string | null
          kunde_email: string | null
          kunde_firma: string | null
          kunde_kontakt_art: string | null
          kunde_nachname: string | null
          kunde_telefon: string | null
          kunde_vorname: string | null
          oeffnung_breite_cm: number | null
          oeffnung_hoehe_cm: number | null
          parkplatz: string | null
          richtung: string | null
          service_type: string
          status: string | null
          stellflaeche: string | null
          stellflaeche_bestaetigt: boolean | null
          stockwerk: string | null
          strom: string | null
          transport_details: Json | null
          updated_at: string | null
          wunschdatum: string | null
          wunschzeit: string | null
          zugang: string | null
          zusatzleistungen: Json | null
          zweck: string
        }
        Insert: {
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          dauer?: string | null
          einsatzort_adresse?: Json | null
          empfohlener_lift_typ?: string | null
          flexibilitaet?: string | null
          form_version?: number | null
          fotos?: string[] | null
          geschaetzte_hoehe_m?: number | null
          geschaetzter_preis_chf?: number | null
          hindernisse?: Json | null
          id?: string
          kontakt_vor_ort?: Json | null
          kunde_anrede?: string | null
          kunde_email?: string | null
          kunde_firma?: string | null
          kunde_kontakt_art?: string | null
          kunde_nachname?: string | null
          kunde_telefon?: string | null
          kunde_vorname?: string | null
          oeffnung_breite_cm?: number | null
          oeffnung_hoehe_cm?: number | null
          parkplatz?: string | null
          richtung?: string | null
          service_type?: string
          status?: string | null
          stellflaeche?: string | null
          stellflaeche_bestaetigt?: boolean | null
          stockwerk?: string | null
          strom?: string | null
          transport_details?: Json | null
          updated_at?: string | null
          wunschdatum?: string | null
          wunschzeit?: string | null
          zugang?: string | null
          zusatzleistungen?: Json | null
          zweck?: string
        }
        Update: {
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          dauer?: string | null
          einsatzort_adresse?: Json | null
          empfohlener_lift_typ?: string | null
          flexibilitaet?: string | null
          form_version?: number | null
          fotos?: string[] | null
          geschaetzte_hoehe_m?: number | null
          geschaetzter_preis_chf?: number | null
          hindernisse?: Json | null
          id?: string
          kontakt_vor_ort?: Json | null
          kunde_anrede?: string | null
          kunde_email?: string | null
          kunde_firma?: string | null
          kunde_kontakt_art?: string | null
          kunde_nachname?: string | null
          kunde_telefon?: string | null
          kunde_vorname?: string | null
          oeffnung_breite_cm?: number | null
          oeffnung_hoehe_cm?: number | null
          parkplatz?: string | null
          richtung?: string | null
          service_type?: string
          status?: string | null
          stellflaeche?: string | null
          stellflaeche_bestaetigt?: boolean | null
          stockwerk?: string | null
          strom?: string | null
          transport_details?: Json | null
          updated_at?: string | null
          wunschdatum?: string | null
          wunschzeit?: string | null
          zugang?: string | null
          zusatzleistungen?: Json | null
          zweck?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_highlighted: boolean | null
          is_optional: boolean | null
          offer_id: string
          position: number
          price_type: 'pauschale' | 'per_unit' | 'per_hour' | 'inkl' | 'optional' | null
          quantity: number
          total: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_highlighted?: boolean | null
          is_optional?: boolean | null
          offer_id: string
          position?: number
          price_type?: 'pauschale' | 'per_unit' | 'per_hour' | 'inkl' | 'optional' | null
          quantity?: number
          total?: number | null
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_highlighted?: boolean | null
          is_optional?: boolean | null
          offer_id?: string
          position?: number
          price_type?: 'pauschale' | 'per_unit' | 'per_hour' | 'inkl' | 'optional' | null
          quantity?: number
          total?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_leistungsuebersicht: {
        Row: {
          created_at: string | null
          excluded_services: string[] | null
          id: string
          included_services: Json
          offer_id: string
          special_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          excluded_services?: string[] | null
          id?: string
          included_services?: Json
          offer_id: string
          special_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          excluded_services?: string[] | null
          id?: string
          included_services?: Json
          offer_id?: string
          special_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_leistungsuebersicht_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_leistungsuebersicht_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          access_token: string
          agb_accepted_at: string | null
          agb_ip_address: string | null
          agb_version: string | null
          assigned_team_member_id: string | null
          brief_layout: boolean
          checklist_url: string | null
          company_id: string
          company_reference: string | null
          created_at: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string | null
          customer_response_note: string | null
          customer_salutation: string | null
          description: string | null
          highlighted_items: string[] | null
          hourly_rate: number | null
          id: string
          internal_notes: string | null
          kostendach_max: number | null
          lead_distribution_id: string | null
          lead_id: string
          leistungsuebersicht_url: string | null
          offer_number: number | null
          offerte_type: 'normal' | 'blind'
          payment_due_days: number | null
          payment_method: string | null
          price_model: 'pauschal' | 'stundenansatz' | 'kostendach'
          rejected_at: string | null
          resources: Json | null
          secondary_service_date: string | null
          secondary_service_type: string | null
          sent_at: string | null
          service_date: string | null
          service_details: Json | null
          service_end_time: string | null
          service_start_time: string | null
          status: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
          vat_amount: number | null
          vat_rate: number
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          access_token?: string
          agb_accepted_at?: string | null
          agb_ip_address?: string | null
          agb_version?: string | null
          assigned_team_member_id?: string | null
          brief_layout?: boolean
          checklist_url?: string | null
          company_id: string
          company_reference?: string | null
          created_at?: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone?: string | null
          customer_response_note?: string | null
          customer_salutation?: string | null
          description?: string | null
          highlighted_items?: string[] | null
          hourly_rate?: number | null
          id?: string
          internal_notes?: string | null
          kostendach_max?: number | null
          lead_distribution_id?: string | null
          lead_id: string
          leistungsuebersicht_url?: string | null
          offer_number?: number | null
          offerte_type?: 'normal' | 'blind'
          payment_due_days?: number | null
          payment_method?: string | null
          price_model?: 'pauschal' | 'stundenansatz' | 'kostendach'
          rejected_at?: string | null
          resources?: Json | null
          secondary_service_date?: string | null
          secondary_service_type?: string | null
          sent_at?: string | null
          service_date?: string | null
          service_details?: Json | null
          service_end_time?: string | null
          service_start_time?: string | null
          status?: string
          subtotal?: number
          title: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          access_token?: string
          agb_accepted_at?: string | null
          agb_ip_address?: string | null
          agb_version?: string | null
          assigned_team_member_id?: string | null
          brief_layout?: boolean
          checklist_url?: string | null
          company_id?: string
          company_reference?: string | null
          created_at?: string
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string | null
          customer_response_note?: string | null
          customer_salutation?: string | null
          description?: string | null
          highlighted_items?: string[] | null
          hourly_rate?: number | null
          id?: string
          internal_notes?: string | null
          kostendach_max?: number | null
          lead_distribution_id?: string | null
          lead_id?: string
          leistungsuebersicht_url?: string | null
          offer_number?: number | null
          offerte_type?: 'normal' | 'blind'
          payment_due_days?: number | null
          payment_method?: string | null
          price_model?: 'pauschal' | 'stundenansatz' | 'kostendach'
          rejected_at?: string | null
          resources?: Json | null
          secondary_service_date?: string | null
          secondary_service_type?: string | null
          sent_at?: string | null
          service_date?: string | null
          service_details?: Json | null
          service_end_time?: string | null
          service_start_time?: string | null
          status?: string
          subtotal?: number
          title?: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_distribution_id_fkey"
            columns: ["lead_distribution_id"]
            isOneToOne: false
            referencedRelation: "lead_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          base_price: number
          created_at: string | null
          distance_tiers: Json | null
          exclusivity_multipliers: Json | null
          extra_services: Json | null
          id: string
          is_active: boolean | null
          job_value_base_chf: number | null
          job_value_factor_enabled: boolean | null
          job_value_max_factor: number | null
          job_value_min_factor: number | null
          living_space_tiers: Json | null
          location_multipliers: Json | null
          name: string
          room_tiers: Json | null
          service_multipliers: Json | null
          size_tiers: Json | null
          token_to_chf_rate: number | null
          updated_at: string | null
          urgency_multipliers: Json | null
        }
        Insert: {
          base_price?: number
          created_at?: string | null
          distance_tiers?: Json | null
          exclusivity_multipliers?: Json | null
          extra_services?: Json | null
          id?: string
          is_active?: boolean | null
          job_value_base_chf?: number | null
          job_value_factor_enabled?: boolean | null
          job_value_max_factor?: number | null
          job_value_min_factor?: number | null
          living_space_tiers?: Json | null
          location_multipliers?: Json | null
          name?: string
          room_tiers?: Json | null
          service_multipliers?: Json | null
          size_tiers?: Json | null
          token_to_chf_rate?: number | null
          updated_at?: string | null
          urgency_multipliers?: Json | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          distance_tiers?: Json | null
          exclusivity_multipliers?: Json | null
          extra_services?: Json | null
          id?: string
          is_active?: boolean | null
          job_value_base_chf?: number | null
          job_value_factor_enabled?: boolean | null
          job_value_max_factor?: number | null
          job_value_min_factor?: number | null
          living_space_tiers?: Json | null
          location_multipliers?: Json | null
          name?: string
          room_tiers?: Json | null
          service_multipliers?: Json | null
          size_tiers?: Json | null
          token_to_chf_rate?: number | null
          updated_at?: string | null
          urgency_multipliers?: Json | null
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          created_at: string | null
          id: string
          max_lead_price_tokens: number | null
          min_lead_price_tokens: number | null
          token_value_chf: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_lead_price_tokens?: number | null
          min_lead_price_tokens?: number | null
          token_value_chf?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_lead_price_tokens?: number | null
          min_lead_price_tokens?: number | null
          token_value_chf?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      raeumung_anfragen: {
        Row: {
          adresse_hausnummer: string | null
          adresse_kanton: string | null
          adresse_land: string | null
          adresse_ort: string | null
          adresse_plz: string | null
          adresse_strasse: string | null
          agb_akzeptiert: boolean | null
          anfrage_nummer: string | null
          anfragender_anrede: string | null
          anfragender_email: string | null
          anfragender_firma: string | null
          anfragender_kontaktzeit: string | null
          anfragender_nachname: string | null
          anfragender_rolle: string | null
          anfragender_telefon: string | null
          anfragender_vorname: string | null
          bemerkungen: string | null
          berechtigung_bestaetigt: boolean | null
          created_at: string | null
          flaeche_m2: number | null
          form_version: number | null
          fuellgrad: number | null
          gerichtsbefehl_vorhanden: boolean | null
          id: string
          property_type: string | null
          raeumungs_art: string
          status: string | null
          stockwerke: number | null
          termin_besichtigung_gewuenscht: boolean | null
          termin_besichtigung_termine: Json | null
          termin_dringlichkeit: string | null
          termin_flexibilitaet: string | null
          termin_wunschdatum: string | null
          umfang_bereiche: Json | null
          umfang_inventar: Json | null
          umfang_kartons_anzahl: number | null
          umfang_scope: string | null
          umfang_volumen_m3: number | null
          updated_at: string | null
          zimmer_anzahl: number | null
          zugang_hindernisse: Json | null
          zugang_lift_typ: string | null
          zugang_lift_vorhanden: boolean | null
          zugang_parkplatz_distanz_m: number | null
          zugang_stockwerk: string | null
          zugang_stufen: string | null
          zusatzleistungen: Json | null
          zustand_allgemein: string | null
          zustand_besonderheiten: Json | null
          zustand_fuellgrad_prozent: number | null
          zustand_schutzausruestung: string | null
        }
        Insert: {
          adresse_hausnummer?: string | null
          adresse_kanton?: string | null
          adresse_land?: string | null
          adresse_ort?: string | null
          adresse_plz?: string | null
          adresse_strasse?: string | null
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          anfragender_anrede?: string | null
          anfragender_email?: string | null
          anfragender_firma?: string | null
          anfragender_kontaktzeit?: string | null
          anfragender_nachname?: string | null
          anfragender_rolle?: string | null
          anfragender_telefon?: string | null
          anfragender_vorname?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          flaeche_m2?: number | null
          form_version?: number | null
          fuellgrad?: number | null
          gerichtsbefehl_vorhanden?: boolean | null
          id?: string
          property_type?: string | null
          raeumungs_art?: string
          status?: string | null
          stockwerke?: number | null
          termin_besichtigung_gewuenscht?: boolean | null
          termin_besichtigung_termine?: Json | null
          termin_dringlichkeit?: string | null
          termin_flexibilitaet?: string | null
          termin_wunschdatum?: string | null
          umfang_bereiche?: Json | null
          umfang_inventar?: Json | null
          umfang_kartons_anzahl?: number | null
          umfang_scope?: string | null
          umfang_volumen_m3?: number | null
          updated_at?: string | null
          zimmer_anzahl?: number | null
          zugang_hindernisse?: Json | null
          zugang_lift_typ?: string | null
          zugang_lift_vorhanden?: boolean | null
          zugang_parkplatz_distanz_m?: number | null
          zugang_stockwerk?: string | null
          zugang_stufen?: string | null
          zusatzleistungen?: Json | null
          zustand_allgemein?: string | null
          zustand_besonderheiten?: Json | null
          zustand_fuellgrad_prozent?: number | null
          zustand_schutzausruestung?: string | null
        }
        Update: {
          adresse_hausnummer?: string | null
          adresse_kanton?: string | null
          adresse_land?: string | null
          adresse_ort?: string | null
          adresse_plz?: string | null
          adresse_strasse?: string | null
          agb_akzeptiert?: boolean | null
          anfrage_nummer?: string | null
          anfragender_anrede?: string | null
          anfragender_email?: string | null
          anfragender_firma?: string | null
          anfragender_kontaktzeit?: string | null
          anfragender_nachname?: string | null
          anfragender_rolle?: string | null
          anfragender_telefon?: string | null
          anfragender_vorname?: string | null
          bemerkungen?: string | null
          berechtigung_bestaetigt?: boolean | null
          created_at?: string | null
          flaeche_m2?: number | null
          form_version?: number | null
          fuellgrad?: number | null
          gerichtsbefehl_vorhanden?: boolean | null
          id?: string
          property_type?: string | null
          raeumungs_art?: string
          status?: string | null
          stockwerke?: number | null
          termin_besichtigung_gewuenscht?: boolean | null
          termin_besichtigung_termine?: Json | null
          termin_dringlichkeit?: string | null
          termin_flexibilitaet?: string | null
          termin_wunschdatum?: string | null
          umfang_bereiche?: Json | null
          umfang_inventar?: Json | null
          umfang_kartons_anzahl?: number | null
          umfang_scope?: string | null
          umfang_volumen_m3?: number | null
          updated_at?: string | null
          zimmer_anzahl?: number | null
          zugang_hindernisse?: Json | null
          zugang_lift_typ?: string | null
          zugang_lift_vorhanden?: boolean | null
          zugang_parkplatz_distanz_m?: number | null
          zugang_stockwerk?: string | null
          zugang_stufen?: string | null
          zusatzleistungen?: Json | null
          zustand_allgemein?: string | null
          zustand_besonderheiten?: Json | null
          zustand_fuellgrad_prozent?: number | null
          zustand_schutzausruestung?: string | null
        }
        Relationships: []
      }
      service_acquisition_costs: {
        Row: {
          conversion_rate: number
          created_at: string
          exclusivity_1_mult: number | null
          exclusivity_3_mult: number | null
          exclusivity_5_mult: number | null
          google_ads_cpc_chf: number
          id: string
          is_active: boolean
          max_size_mult: number | null
          min_profit_margin: number
          notes: string | null
          organic_lead_ratio: number
          service_label: string
          service_type: string
          updated_at: string
        }
        Insert: {
          conversion_rate?: number
          created_at?: string
          exclusivity_1_mult?: number | null
          exclusivity_3_mult?: number | null
          exclusivity_5_mult?: number | null
          google_ads_cpc_chf?: number
          id?: string
          is_active?: boolean
          max_size_mult?: number | null
          min_profit_margin?: number
          notes?: string | null
          organic_lead_ratio?: number
          service_label: string
          service_type: string
          updated_at?: string
        }
        Update: {
          conversion_rate?: number
          created_at?: string
          exclusivity_1_mult?: number | null
          exclusivity_3_mult?: number | null
          exclusivity_5_mult?: number | null
          google_ads_cpc_chf?: number
          id?: string
          is_active?: boolean
          max_size_mult?: number | null
          min_profit_margin?: number
          notes?: string | null
          organic_lead_ratio?: number
          service_label?: string
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          base_token_cost: number
          category: string | null
          created_at: string | null
          description_de: string | null
          id: string
          is_active: boolean | null
          name_de: string
          name_en: string | null
          name_fr: string | null
          service_type: string
          sort_order: number | null
        }
        Insert: {
          base_token_cost?: number
          category?: string | null
          created_at?: string | null
          description_de?: string | null
          id?: string
          is_active?: boolean | null
          name_de: string
          name_en?: string | null
          name_fr?: string | null
          service_type: string
          sort_order?: number | null
        }
        Update: {
          base_token_cost?: number
          category?: string | null
          created_at?: string | null
          description_de?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string
          name_en?: string | null
          name_fr?: string | null
          service_type?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      service_detail_templates: {
        Row: {
          created_at: string | null
          default_details: Json | null
          default_highlighted_items: string[] | null
          default_resources: Json | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          service_type: string
          template_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_details?: Json | null
          default_highlighted_items?: string[] | null
          default_resources?: Json | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          service_type: string
          template_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_details?: Json | null
          default_highlighted_items?: string[] | null
          default_resources?: Json | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          service_type?: string
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shared_content: {
        Row: {
          component_key: string
          component_type: string
          content: Json
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          component_key: string
          component_type: string
          content: Json
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          component_key?: string
          component_type?: string
          content?: Json
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string | null
          invoice_sent_at: string | null
          notes: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string | null
          subscription_months: number
        }
        Insert: {
          amount: number
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          subscription_months?: number
        }
        Update: {
          amount?: number
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          subscription_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_reminders: {
        Row: {
          company_id: string
          email_sent_to: string | null
          error_message: string | null
          id: string
          reminder_type: string
          sent_at: string | null
          success: boolean | null
        }
        Insert: {
          company_id: string
          email_sent_to?: string | null
          error_message?: string | null
          id?: string
          reminder_type: string
          sent_at?: string | null
          success?: boolean | null
        }
        Update: {
          company_id?: string
          email_sent_to?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          created_at: string | null
          id: string
          is_internal: boolean | null
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message: string
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          browser_info: string | null
          category:
            | Database["public"]["Enums"]["support_ticket_category"]
            | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          first_response_at: string | null
          id: string
          message: string
          page_url: string | null
          priority:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"] | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          browser_info?: string | null
          category?:
            | Database["public"]["Enums"]["support_ticket_category"]
            | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          message: string
          page_url?: string | null
          priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"] | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          browser_info?: string | null
          category?:
            | Database["public"]["Enums"]["support_ticket_category"]
            | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          message?: string
          page_url?: string | null
          priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"] | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      swiss_plz: {
        Row: {
          canton: string | null
          city: string
          created_at: string | null
          id: string
          latitude: number
          longitude: number
          plz: string
        }
        Insert: {
          canton?: string | null
          city: string
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          plz: string
        }
        Update: {
          canton?: string | null
          city?: string
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          plz?: string
        }
        Relationships: []
      }
      team_availability: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          id: string
          is_available: boolean | null
          notes: string | null
          specific_date: string | null
          start_time: string | null
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          specific_date?: string | null
          start_time?: string | null
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          specific_date?: string | null
          start_time?: string | null
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_availability_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          color_code: string | null
          company_id: string
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          phone: string | null
          role: string | null
          skills: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color_code?: string | null
          company_id: string
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          phone?: string | null
          role?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color_code?: string | null
          company_id?: string
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          role?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      token_packages: {
        Row: {
          badge_text: string | null
          bonus_tokens: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price_chf: number
          sort_order: number | null
          stripe_price_id: string | null
          tokens_included: number
        }
        Insert: {
          badge_text?: string | null
          bonus_tokens?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price_chf: number
          sort_order?: number | null
          stripe_price_id?: string | null
          tokens_included: number
        }
        Update: {
          badge_text?: string | null
          bonus_tokens?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price_chf?: number
          sort_order?: number | null
          stripe_price_id?: string | null
          tokens_included?: number
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      umzug_anfragen: {
        Row: {
          additional_services_umzug: Json | null
          anfrage_nummer: string | null
          created_at: string | null
          customer_contact_time: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_remarks: string | null
          customer_salutation: string | null
          distance_km: number | null
          estimated_boxes: number | null
          estimated_duration_hours: number | null
          estimated_price_chf: number | null
          form_version: number | null
          from_canton: string | null
          from_city: string | null
          from_country: string | null
          from_distance_to_parking: number | null
          from_extras: Json | null
          from_floor: string | null
          from_floors: number | null
          from_has_lift: boolean | null
          from_house_number: string | null
          from_lift_capacity_kg: number | null
          from_lift_capacity_persons: number | null
          from_lift_depth_cm: number | null
          from_lift_height_cm: number | null
          from_lift_type: string | null
          from_lift_width_cm: number | null
          from_living_space_m2: number | null
          from_path_obstruction: boolean | null
          from_path_obstruction_details: string | null
          from_plz: string | null
          from_property_type: string | null
          from_rooms: number | null
          from_steps_to_entrance: string | null
          from_street: string | null
          heavy_items: Json | null
          id: string
          inventory_items: Json | null
          max_companies: number | null
          moving_date: string | null
          moving_flexibility: string | null
          moving_start_time: string | null
          service_type: string
          status: string | null
          to_canton: string | null
          to_city: string | null
          to_country: string | null
          to_distance_to_parking: number | null
          to_extras: Json | null
          to_floor: string | null
          to_floors: number | null
          to_has_lift: boolean | null
          to_house_number: string | null
          to_lift_capacity_kg: number | null
          to_lift_capacity_persons: number | null
          to_lift_depth_cm: number | null
          to_lift_height_cm: number | null
          to_lift_type: string | null
          to_lift_width_cm: number | null
          to_living_space_m2: number | null
          to_path_obstruction: boolean | null
          to_path_obstruction_details: string | null
          to_plz: string | null
          to_property_type: string | null
          to_rooms: number | null
          to_steps_to_entrance: string | null
          to_street: string | null
          token_cost: number | null
          updated_at: string | null
        }
        Insert: {
          additional_services_umzug?: Json | null
          anfrage_nummer?: string | null
          created_at?: string | null
          customer_contact_time?: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_remarks?: string | null
          customer_salutation?: string | null
          distance_km?: number | null
          estimated_boxes?: number | null
          estimated_duration_hours?: number | null
          estimated_price_chf?: number | null
          form_version?: number | null
          from_canton?: string | null
          from_city?: string | null
          from_country?: string | null
          from_distance_to_parking?: number | null
          from_extras?: Json | null
          from_floor?: string | null
          from_floors?: number | null
          from_has_lift?: boolean | null
          from_house_number?: string | null
          from_lift_capacity_kg?: number | null
          from_lift_capacity_persons?: number | null
          from_lift_depth_cm?: number | null
          from_lift_height_cm?: number | null
          from_lift_type?: string | null
          from_lift_width_cm?: number | null
          from_living_space_m2?: number | null
          from_path_obstruction?: boolean | null
          from_path_obstruction_details?: string | null
          from_plz?: string | null
          from_property_type?: string | null
          from_rooms?: number | null
          from_steps_to_entrance?: string | null
          from_street?: string | null
          heavy_items?: Json | null
          id?: string
          inventory_items?: Json | null
          max_companies?: number | null
          moving_date?: string | null
          moving_flexibility?: string | null
          moving_start_time?: string | null
          service_type?: string
          status?: string | null
          to_canton?: string | null
          to_city?: string | null
          to_country?: string | null
          to_distance_to_parking?: number | null
          to_extras?: Json | null
          to_floor?: string | null
          to_floors?: number | null
          to_has_lift?: boolean | null
          to_house_number?: string | null
          to_lift_capacity_kg?: number | null
          to_lift_capacity_persons?: number | null
          to_lift_depth_cm?: number | null
          to_lift_height_cm?: number | null
          to_lift_type?: string | null
          to_lift_width_cm?: number | null
          to_living_space_m2?: number | null
          to_path_obstruction?: boolean | null
          to_path_obstruction_details?: string | null
          to_plz?: string | null
          to_property_type?: string | null
          to_rooms?: number | null
          to_steps_to_entrance?: string | null
          to_street?: string | null
          token_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          additional_services_umzug?: Json | null
          anfrage_nummer?: string | null
          created_at?: string | null
          customer_contact_time?: string | null
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string
          customer_remarks?: string | null
          customer_salutation?: string | null
          distance_km?: number | null
          estimated_boxes?: number | null
          estimated_duration_hours?: number | null
          estimated_price_chf?: number | null
          form_version?: number | null
          from_canton?: string | null
          from_city?: string | null
          from_country?: string | null
          from_distance_to_parking?: number | null
          from_extras?: Json | null
          from_floor?: string | null
          from_floors?: number | null
          from_has_lift?: boolean | null
          from_house_number?: string | null
          from_lift_capacity_kg?: number | null
          from_lift_capacity_persons?: number | null
          from_lift_depth_cm?: number | null
          from_lift_height_cm?: number | null
          from_lift_type?: string | null
          from_lift_width_cm?: number | null
          from_living_space_m2?: number | null
          from_path_obstruction?: boolean | null
          from_path_obstruction_details?: string | null
          from_plz?: string | null
          from_property_type?: string | null
          from_rooms?: number | null
          from_steps_to_entrance?: string | null
          from_street?: string | null
          heavy_items?: Json | null
          id?: string
          inventory_items?: Json | null
          max_companies?: number | null
          moving_date?: string | null
          moving_flexibility?: string | null
          moving_start_time?: string | null
          service_type?: string
          status?: string | null
          to_canton?: string | null
          to_city?: string | null
          to_country?: string | null
          to_distance_to_parking?: number | null
          to_extras?: Json | null
          to_floor?: string | null
          to_floors?: number | null
          to_has_lift?: boolean | null
          to_house_number?: string | null
          to_lift_capacity_kg?: number | null
          to_lift_capacity_persons?: number | null
          to_lift_depth_cm?: number | null
          to_lift_height_cm?: number | null
          to_lift_type?: string | null
          to_lift_width_cm?: number | null
          to_living_space_m2?: number | null
          to_path_obstruction?: boolean | null
          to_path_obstruction_details?: string | null
          to_plz?: string | null
          to_property_type?: string | null
          to_rooms?: number | null
          to_steps_to_entrance?: string | null
          to_street?: string | null
          token_cost?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      umzugsbox_rentals: {
        Row: {
          actual_return_date: string | null
          appointment_id: string | null
          archived_at: string | null
          assigned_team_member_id: string | null
          box_description: string | null
          box_items: Json | null
          box_quantity: number
          box_type: Database["public"]["Enums"]["umzugsbox_type"] | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_first_name: string
          customer_last_name: string
          customer_notes: string | null
          customer_notified: boolean | null
          customer_notified_at: string | null
          customer_phone: string | null
          customer_pickup_request_at: string | null
          delivered_by_team_member_id: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_date: string
          delivery_plz: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          expected_return_date: string | null
          id: string
          internal_notes: string | null
          is_rental: boolean | null
          lead_id: string | null
          offer_id: string | null
          picked_up_by_team_member_id: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
          reminder_days_before: number | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          rental_price_per_day: number | null
          second_reminder_sent: boolean | null
          second_reminder_sent_at: string | null
          status: Database["public"]["Enums"]["box_rental_status"] | null
          updated_at: string | null
        }
        Insert: {
          actual_return_date?: string | null
          appointment_id?: string | null
          archived_at?: string | null
          assigned_team_member_id?: string | null
          box_description?: string | null
          box_items?: Json | null
          box_quantity?: number
          box_type?: Database["public"]["Enums"]["umzugsbox_type"] | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_first_name: string
          customer_last_name: string
          customer_notes?: string | null
          customer_notified?: boolean | null
          customer_notified_at?: string | null
          customer_phone?: string | null
          customer_pickup_request_at?: string | null
          delivered_by_team_member_id?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date: string
          delivery_plz?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          expected_return_date?: string | null
          id?: string
          internal_notes?: string | null
          is_rental?: boolean | null
          lead_id?: string | null
          offer_id?: string | null
          picked_up_by_team_member_id?: string | null
          pickup_scheduled_date?: string | null
          pickup_scheduled_time?: string | null
          reminder_days_before?: number | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          rental_price_per_day?: number | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["box_rental_status"] | null
          updated_at?: string | null
        }
        Update: {
          actual_return_date?: string | null
          appointment_id?: string | null
          archived_at?: string | null
          assigned_team_member_id?: string | null
          box_description?: string | null
          box_items?: Json | null
          box_quantity?: number
          box_type?: Database["public"]["Enums"]["umzugsbox_type"] | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_first_name?: string
          customer_last_name?: string
          customer_notes?: string | null
          customer_notified?: boolean | null
          customer_notified_at?: string | null
          customer_phone?: string | null
          customer_pickup_request_at?: string | null
          delivered_by_team_member_id?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date?: string
          delivery_plz?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          expected_return_date?: string | null
          id?: string
          internal_notes?: string | null
          is_rental?: boolean | null
          lead_id?: string | null
          offer_id?: string | null
          picked_up_by_team_member_id?: string | null
          pickup_scheduled_date?: string | null
          pickup_scheduled_time?: string | null
          reminder_days_before?: number | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          rental_price_per_day?: number | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["box_rental_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umzugsbox_rentals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_delivered_by_team_member_id_fkey"
            columns: ["delivered_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_picked_up_by_team_member_id_fkey"
            columns: ["picked_up_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_key: string
          setting_type: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_key?: string
          setting_type?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      appointment_summary: {
        Row: {
          appointment_date: string | null
          appointment_type:
            | Database["public"]["Enums"]["appointment_type"]
            | null
          cancelled_count: number | null
          company_id: string | null
          completed_count: number | null
          confirmed_count: number | null
          pending_count: number | null
          team_member_ids: string[] | null
          total_appointments: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_details: {
        Row: {
          accepted_at: string | null
          access_token: string | null
          agb_accepted_at: string | null
          agb_ip_address: string | null
          agb_version: string | null
          assigned_team_member_id: string | null
          checklist_url: string | null
          company_city: string | null
          company_email: string | null
          company_house_number: string | null
          company_id: string | null
          company_logo_url: string | null
          company_mwst_number: string | null
          company_name: string | null
          company_phone: string | null
          company_plz: string | null
          company_reference: string | null
          company_street: string | null
          created_at: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string | null
          customer_response_note: string | null
          customer_salutation: string | null
          description: string | null
          from_city: string | null
          from_floor: number | null
          from_has_lift: boolean | null
          from_house_number: string | null
          from_living_space_m2: number | null
          from_plz: string | null
          from_rooms: number | null
          from_street: string | null
          highlighted_items: string[] | null
          id: string | null
          internal_notes: string | null
          lead_description: string | null
          lead_distribution_id: string | null
          lead_id: string | null
          leistungsuebersicht_url: string | null
          offer_number: number | null
          payment_due_days: number | null
          payment_method: string | null
          preferred_date: string | null
          reference_email: string | null
          reference_first_name: string | null
          reference_last_name: string | null
          reference_phone: string | null
          rejected_at: string | null
          resources: Json | null
          secondary_service_date: string | null
          secondary_service_type: string | null
          sent_at: string | null
          service_date: string | null
          service_details: Json | null
          service_end_time: string | null
          service_start_time: string | null
          service_type: string | null
          status: string | null
          subtotal: number | null
          title: string | null
          to_city: string | null
          to_floor: number | null
          to_has_lift: boolean | null
          to_house_number: string | null
          to_plz: string | null
          to_street: string | null
          total: number | null
          updated_at: string | null
          valid_until: string | null
          vat_amount: number | null
          vat_rate: number | null
          viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_distribution_id_fkey"
            columns: ["lead_distribution_id"]
            isOneToOne: false
            referencedRelation: "lead_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_box_pickups: {
        Row: {
          actual_return_date: string | null
          appointment_id: string | null
          archived_at: string | null
          assigned_color: string | null
          assigned_first_name: string | null
          assigned_last_name: string | null
          assigned_team_member_id: string | null
          box_description: string | null
          box_items: Json | null
          box_quantity: number | null
          box_type: Database["public"]["Enums"]["umzugsbox_type"] | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_notes: string | null
          customer_notified: boolean | null
          customer_notified_at: string | null
          customer_phone: string | null
          customer_pickup_request_at: string | null
          delivered_by_team_member_id: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_date: string | null
          delivery_plz: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          expected_return_date: string | null
          id: string | null
          internal_notes: string | null
          is_rental: boolean | null
          lead_id: string | null
          offer_id: string | null
          picked_up_by_team_member_id: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
          reminder_days_before: number | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          rental_price_per_day: number | null
          second_reminder_sent: boolean | null
          second_reminder_sent_at: string | null
          status: Database["public"]["Enums"]["box_rental_status"] | null
          total_box_quantity: number | null
          updated_at: string | null
          urgency: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umzugsbox_rentals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "pending_team_reminders"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_delivered_by_team_member_id_fkey"
            columns: ["delivered_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umzugsbox_rentals_picked_up_by_team_member_id_fkey"
            columns: ["picked_up_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_team_reminders: {
        Row: {
          appointment_date: string | null
          appointment_datetime: string | null
          appointment_id: string | null
          appointment_type:
            | Database["public"]["Enums"]["appointment_type"]
            | null
          assigned_team_member_ids: string[] | null
          company_id: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          end_time: string | null
          location_address: string | null
          location_city: string | null
          location_plz: string | null
          reminder_time: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          team_emails: string[] | null
          team_names: string[] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_manual_import: {
        Args: { p_admin_id: string; p_company_id: string }
        Returns: Json
      }
      archive_returned_boxes: { Args: never; Returns: number }
      atomic_accept_lead: {
        Args: {
          p_company_id: string
          p_current_balance: number
          p_distribution_id: string
          p_lead_id: string
          p_max_companies: number
          p_token_cost: number
        }
        Returns: Json
      }
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_min_token_price: {
        Args: { p_max_companies?: number; p_service_type: string }
        Returns: number
      }
      can_modify_role: {
        Args: { modifier_id: string; target_user_id: string }
        Returns: boolean
      }
      cleanup_archived_boxes: { Args: never; Returns: number }
      create_appointment_from_lead: {
        Args: {
          p_appointment_date?: string
          p_appointment_type?: string
          p_company_id: string
          p_end_time?: string
          p_lead_id: string
          p_start_time?: string
          p_title?: string
        }
        Returns: string
      }
      create_archive_log: {
        Args: {
          p_archive_name: string
          p_archive_type: string
          p_data_from?: string
          p_data_to?: string
          p_export_format?: string
          p_records_count: number
          p_storage_path: string
          p_storage_type: string
          p_triggered_by?: string
          p_user_id?: string
        }
        Returns: string
      }
      deactivate_expired_subscriptions: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          email: string
        }[]
      }
      deactivate_manual_import: {
        Args: { p_company_id: string; p_reason?: string }
        Returns: Json
      }
      extend_subscription: {
        Args: {
          p_company_id: string
          p_confirmed_by?: string
          p_months: number
        }
        Returns: boolean
      }
      find_companies_in_radius: {
        Args: {
          max_results?: number
          service_type_filter: string
          target_plz: string
        }
        Returns: {
          company_id: string
          company_name: string
          coverage_plz: string
          coverage_radius_km: number
          distance_km: number
          email: string
          notification_email: string
        }[]
      }
      generate_recurring_appointments: {
        Args: { p_end_date?: string; p_parent_id: string }
        Returns: number
      }
      generate_unique_slug: { Args: { prefix: string }; Returns: string }
      get_archivable_leads: {
        Args: { retention_days?: number }
        Returns: {
          created_at: string
          id: string
          service_type: string
          status: string
        }[]
      }
      get_archivable_offers: {
        Args: { retention_days?: number }
        Returns: {
          created_at: string
          id: string
          status: string
        }[]
      }
      get_archive_statistics: {
        Args: never
        Returns: {
          archivable_records: number
          estimated_size_mb: number
          oldest_record_date: string
          table_name: string
          total_records: number
        }[]
      }
      get_auftraege_needing_reminders: {
        Args: never
        Returns: {
          assigned_team_members: string[]
          auftrag_id: string
          auftrag_nummer: string
          company_email: string
          company_id: string
          company_name: string
          customer_email: string
          customer_name: string
          customer_phone: string
          description: string
          estimated_duration_minutes: number
          from_address: string
          scheduled_date: string
          scheduled_time: string
          special_instructions: string
          team_leader_email: string
          team_leader_id: string
          team_leader_name: string
          title: string
          to_address: string
        }[]
      }
      get_box_rental_stats: {
        Args: { p_company_id: string }
        Returns: {
          overdue: number
          pickup_this_week: number
          pickup_today: number
          total_active: number
          total_boxes_out: number
        }[]
      }
      get_companies_needing_reminders: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          days_until_expiry: number
          email: string
          expires_at: string
          last_reminder_type: string
          notification_email: string
          reminder_type: string
        }[]
      }
      get_company_id_from_offer_token: {
        Args: { offer_id: string; token: string }
        Returns: string
      }
      get_offer_by_token: {
        Args: { offer_access_token: string }
        Returns: {
          accepted_at: string
          agb_accepted_at: string
          company_id: string
          created_at: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          description: string
          id: string
          lead_id: string
          rejected_at: string
          sent_at: string
          service_date: string
          status: string
          subtotal: number
          title: string
          total: number
          valid_until: string
          vat_amount: number
          vat_rate: number
          viewed_at: string
        }[]
      }
      get_plz_distance_km: {
        Args: { plz1: string; plz2: string }
        Returns: number
      }
      get_public_company_info: {
        Args: { company_uuid: string }
        Returns: {
          city: string
          company_name: string
          email: string
          house_number: string
          id: string
          logo_url: string
          phone: string
          plz: string
          primary_color: string
          slogan: string
          street: string
          website: string
        }[]
      }
      get_role_level: { Args: { role_name: string }; Returns: number }
      get_total_box_quantity: {
        Args: { box_items_json: Json }
        Returns: number
      }
      get_user_company_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_manual_import_count: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      insert_manual_imported_lead: {
        Args: {
          p_company_id: string
          p_confidence_score: number
          p_lead_data: Json
          p_raw_text: string
        }
        Returns: Json
      }
      invoke_appointment_reminder: { Args: never; Returns: undefined }
      invoke_team_reminder: { Args: never; Returns: undefined }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_visible_via_offer: {
        Args: { company_uuid: string }
        Returns: boolean
      }
      is_crm_enabled: { Args: { p_company_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_support_admin: { Args: never; Returns: boolean }
      submit_lead: {
        Args: {
          p_customer_email?: string
          p_customer_first_name?: string
          p_customer_last_name?: string
          p_customer_phone?: string
          p_description?: string
          p_detailed_form_data?: Json
          p_form_version?: number
          p_from_city?: string
          p_from_house_number?: string
          p_from_living_space_m2?: number
          p_from_plz?: string
          p_from_rooms?: number
          p_from_street?: string
          p_preferred_date?: string
          p_property_type?: string
          p_service_type: string
        }
        Returns: string
      }
      submit_lead_json: { Args: { lead_data: Json }; Returns: string }
      trigger_team_reminder_for_appointment: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      update_offer_by_token: {
        Args: {
          new_accepted_at?: string
          new_agb_accepted_at?: string
          new_agb_ip_address?: string
          new_agb_version?: string
          new_customer_response_note?: string
          new_rejected_at?: string
          new_status?: string
          new_viewed_at?: string
          offer_access_token: string
        }
        Returns: boolean
      }
      validate_offer_access_token: {
        Args: { offer_id: string; token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "moderator" | "user"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "rescheduled"
        | "no_show"
      appointment_type:
        | "besichtigung"
        | "service"
        | "follow_up"
        | "meeting"
        | "blocked"
      auftrag_status:
        | "geplant"
        | "bestaetigt"
        | "in_bearbeitung"
        | "abgeschlossen"
        | "storniert"
      box_rental_status:
        | "reserved"
        | "delivered"
        | "in_use"
        | "pickup_requested"
        | "pickup_scheduled"
        | "returned"
        | "lost"
        | "damaged"
      clearance_scope: "complete" | "partial"
      condition_level: "normal" | "dirty" | "very_dirty" | "extreme"
      lead_sharing_preference: "only_1" | "only_3" | "only_4" | "only_5" | "both"
      raeumungs_art:
        | "household_dissolution"
        | "apartment_clearance"
        | "house_clearance"
        | "decluttering"
        | "death_clearance"
        | "estate_clearance"
        | "hoarder_clearance"
        | "forced_eviction"
        | "cellar_clearance"
        | "attic_clearance"
        | "garage_clearance"
        | "office_clearance"
        | "company_dissolution"
        | "storage_clearance"
      requester_role:
        | "owner"
        | "tenant"
        | "property_manager"
        | "heir"
        | "landlord"
        | "authority"
        | "other"
      support_ticket_category:
        | "technical"
        | "billing"
        | "feature_request"
        | "bug_report"
        | "general"
        | "account"
      support_ticket_priority: "low" | "medium" | "high" | "urgent"
      support_ticket_status: "open" | "in_progress" | "answered" | "closed"
      umzugsbox_type:
        | "standard"
        | "wardrobe"
        | "book"
        | "fragile"
        | "archive"
        | "other"
      urgency_level: "normal" | "urgent" | "very_urgent" | "emergency"
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
      app_role: ["super_admin", "admin", "moderator", "user"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "rescheduled",
        "no_show",
      ],
      appointment_type: [
        "besichtigung",
        "service",
        "follow_up",
        "meeting",
        "blocked",
      ],
      auftrag_status: [
        "geplant",
        "bestaetigt",
        "in_bearbeitung",
        "abgeschlossen",
        "storniert",
      ],
      box_rental_status: [
        "reserved",
        "delivered",
        "in_use",
        "pickup_requested",
        "pickup_scheduled",
        "returned",
        "lost",
        "damaged",
      ],
      clearance_scope: ["complete", "partial"],
      condition_level: ["normal", "dirty", "very_dirty", "extreme"],
      lead_sharing_preference: ["only_1", "only_3", "only_4", "only_5", "both"],
      raeumungs_art: [
        "household_dissolution",
        "apartment_clearance",
        "house_clearance",
        "decluttering",
        "death_clearance",
        "estate_clearance",
        "hoarder_clearance",
        "forced_eviction",
        "cellar_clearance",
        "attic_clearance",
        "garage_clearance",
        "office_clearance",
        "company_dissolution",
        "storage_clearance",
      ],
      requester_role: [
        "owner",
        "tenant",
        "property_manager",
        "heir",
        "landlord",
        "authority",
        "other",
      ],
      support_ticket_category: [
        "technical",
        "billing",
        "feature_request",
        "bug_report",
        "general",
        "account",
      ],
      support_ticket_priority: ["low", "medium", "high", "urgent"],
      support_ticket_status: ["open", "in_progress", "answered", "closed"],
      umzugsbox_type: [
        "standard",
        "wardrobe",
        "book",
        "fragile",
        "archive",
        "other",
      ],
      urgency_level: ["normal", "urgent", "very_urgent", "emergency"],
    },
  },
} as const
