// Generado desde el proyecto Supabase de pruebas (yqvymjryecmfsoilkxgj) el 2026-10-29.
// No editar a mano: regenerar tras cada migracion (ver docs/FASE_K1_DATOS_TS.md).

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
      audit_log: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          family_id: string | null
          id: string
          metadata: Json
          record_id: string | null
          service_id: Database["public"]["Enums"]["service_code"] | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          metadata?: Json
          record_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"] | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          metadata?: Json
          record_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"] | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_requests: {
        Row: {
          availability: Json
          created_at: string
          enrollment_id: string
          id: string
          notes: string | null
        }
        Insert: {
          availability?: Json
          created_at?: string
          enrollment_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          availability?: Json
          created_at?: string
          enrollment_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          family_id: string | null
          id: string
          player_id: string | null
          service_id: Database["public"]["Enums"]["service_code"] | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          family_id?: string | null
          id?: string
          player_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"] | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          family_id?: string | null
          id?: string
          player_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"] | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          service_document_id: string
          sha256: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string | null
          version: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          service_document_id: string
          sha256?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          version: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          service_document_id?: string
          sha256?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_service_document_id_fkey"
            columns: ["service_document_id"]
            isOneToOne: false
            referencedRelation: "service_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          player_id: string
          priority: number
          relationship: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          player_id: string
          priority?: number
          relationship?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          player_id?: string
          priority?: number
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          family_id: string
          group_id: string | null
          id: string
          location_id: string | null
          operational_status: Database["public"]["Enums"]["enrollment_status"]
          plan_id: string | null
          plan_price_id: string | null
          player_id: string
          review_notes: string | null
          review_status: string
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          group_id?: string | null
          id?: string
          location_id?: string | null
          operational_status?: Database["public"]["Enums"]["enrollment_status"]
          plan_id?: string | null
          plan_price_id?: string | null
          player_id: string
          review_notes?: string | null
          review_status?: string
          season_id?: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          group_id?: string | null
          id?: string
          location_id?: string | null
          operational_status?: Database["public"]["Enums"]["enrollment_status"]
          plan_id?: string | null
          plan_price_id?: string | null
          player_id?: string
          review_notes?: string | null
          review_status?: string
          season_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"]
          start_on?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "service_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "service_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          stripe_customer_ref: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          stripe_customer_ref?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          stripe_customer_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          can_pay: boolean
          can_sign: boolean
          email: string
          family_id: string
          id: string
          invited_at: string
          joined_at: string | null
          relationship: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string | null
        }
        Insert: {
          can_pay?: boolean
          can_sign?: boolean
          email: string
          family_id: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          relationship?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string | null
        }
        Update: {
          can_pay?: boolean
          can_sign?: boolean
          email?: string
          family_id?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          relationship?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          family_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          family_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_profiles: {
        Row: {
          allergies: string | null
          conditions: string | null
          created_at: string
          id: string
          limitations: string | null
          medication: string | null
          notes: string | null
          player_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allergies?: string | null
          conditions?: string | null
          created_at?: string
          id?: string
          limitations?: string | null
          medication?: string | null
          notes?: string | null
          player_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allergies?: string | null
          conditions?: string | null
          created_at?: string
          id?: string
          limitations?: string | null
          medication?: string | null
          notes?: string | null
          player_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_order_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_order_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_order_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount_cents: number
          billing_period: string | null
          created_at: string
          currency: string
          description: string | null
          due_on: string | null
          enrollment_fee_cents: number
          enrollment_id: string
          family_id: string
          id: string
          paid_at: string | null
          plan_amount_cents: number | null
          plan_price_id: string | null
          provider: string
          provider_customer_ref: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_cents: number
          billing_period?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_on?: string | null
          enrollment_fee_cents?: number
          enrollment_id: string
          family_id: string
          id?: string
          paid_at?: string | null
          plan_amount_cents?: number | null
          plan_price_id?: string | null
          provider?: string
          provider_customer_ref?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_cents?: number
          billing_period?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_on?: string | null
          enrollment_fee_cents?: number
          enrollment_id?: string
          family_id?: string
          id?: string
          paid_at?: string | null
          plan_amount_cents?: number | null
          plan_price_id?: string | null
          provider?: string
          provider_customer_ref?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          active: boolean
          admin_only: boolean
          amount_cents: number
          billing_period: string
          currency: string
          enrollment_fee_cents: number
          id: string
          plan_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          admin_only?: boolean
          amount_cents: number
          billing_period: string
          currency?: string
          enrollment_fee_cents?: number
          id?: string
          plan_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          admin_only?: boolean
          amount_cents?: number
          billing_period?: string
          currency?: string
          enrollment_fee_cents?: number
          id?: string
          plan_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          birth_date: string | null
          created_at: string
          family_id: string
          first_name: string
          id: string
          last_name: string
          team: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          created_at?: string
          family_id: string
          first_name: string
          id?: string
          last_name: string
          team?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          created_at?: string
          family_id?: string
          first_name?: string
          id?: string
          last_name?: string
          team?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_documents: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          required: boolean
          scope: string
          service_id: Database["public"]["Enums"]["service_code"] | null
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          required?: boolean
          scope?: string
          service_id?: Database["public"]["Enums"]["service_code"] | null
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          required?: boolean
          scope?: string
          service_id?: Database["public"]["Enums"]["service_code"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_groups: {
        Row: {
          active: boolean
          capacity: number
          day_of_week: string | null
          ends_at: string | null
          id: string
          location_id: string
          name: string
          occupied_base: number
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          capacity?: number
          day_of_week?: string | null
          ends_at?: string | null
          id?: string
          location_id: string
          name: string
          occupied_base?: number
          season_id?: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          capacity?: number
          day_of_week?: string | null
          ends_at?: string | null
          id?: string
          location_id?: string
          name?: string
          occupied_base?: number
          season_id?: string | null
          service_id?: Database["public"]["Enums"]["service_code"]
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_groups_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "service_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_groups_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_interest_requests: {
        Row: {
          admin_notes: string | null
          closed_at: string | null
          contacted_at: string | null
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          notes: string | null
          player_id: string
          service_id: Database["public"]["Enums"]["service_code"]
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          closed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          notes?: string | null
          player_id: string
          service_id: Database["public"]["Enums"]["service_code"]
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          closed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          notes?: string | null
          player_id?: string
          service_id?: Database["public"]["Enums"]["service_code"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_interest_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interest_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interest_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interest_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_locations: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          name: string
          owner_type: string
          service_id: Database["public"]["Enums"]["service_code"]
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_type?: string
          service_id: Database["public"]["Enums"]["service_code"]
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_type?: string
          service_id?: Database["public"]["Enums"]["service_code"]
        }
        Relationships: [
          {
            foreignKeyName: "service_locations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          active: boolean
          frequency_label: string
          id: string
          name: string
          service_id: Database["public"]["Enums"]["service_code"]
        }
        Insert: {
          active?: boolean
          frequency_label: string
          id?: string
          name: string
          service_id: Database["public"]["Enums"]["service_code"]
        }
        Update: {
          active?: boolean
          frequency_label?: string
          id?: string
          name?: string
          service_id?: Database["public"]["Enums"]["service_code"]
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_seasons: {
        Row: {
          active: boolean
          ends_on: string
          id: string
          name: string
          service_id: Database["public"]["Enums"]["service_code"]
          starts_on: string
        }
        Insert: {
          active?: boolean
          ends_on: string
          id?: string
          name: string
          service_id: Database["public"]["Enums"]["service_code"]
          starts_on: string
        }
        Update: {
          active?: boolean
          ends_on?: string
          id?: string
          name?: string
          service_id?: Database["public"]["Enums"]["service_code"]
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_seasons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          id: Database["public"]["Enums"]["service_code"]
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          id: Database["public"]["Enums"]["service_code"]
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: Database["public"]["Enums"]["service_code"]
          name?: string
          status?: string
        }
        Relationships: []
      }
      signature_records: {
        Row: {
          accepted_consents: Json
          completed_data: Json
          created_at: string
          document_version_id: string
          enrollment_id: string | null
          evidence_sha256: string | null
          evidence_storage_path: string | null
          family_id: string
          final_sha256: string | null
          final_storage_path: string | null
          id: string
          image_decision: string | null
          locked_at: string | null
          player_id: string | null
          signed_at: string | null
          signer_name: string | null
          signer_user_id: string | null
          status: Database["public"]["Enums"]["document_status"]
        }
        Insert: {
          accepted_consents?: Json
          completed_data?: Json
          created_at?: string
          document_version_id: string
          enrollment_id?: string | null
          evidence_sha256?: string | null
          evidence_storage_path?: string | null
          family_id: string
          final_sha256?: string | null
          final_storage_path?: string | null
          id?: string
          image_decision?: string | null
          locked_at?: string | null
          player_id?: string | null
          signed_at?: string | null
          signer_name?: string | null
          signer_user_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
        }
        Update: {
          accepted_consents?: Json
          completed_data?: Json
          created_at?: string
          document_version_id?: string
          enrollment_id?: string | null
          evidence_sha256?: string | null
          evidence_storage_path?: string | null
          family_id?: string
          final_sha256?: string | null
          final_storage_path?: string | null
          id?: string
          image_decision?: string | null
          locked_at?: string | null
          player_id?: string | null
          signed_at?: string | null
          signer_name?: string | null
          signer_user_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
        }
        Relationships: [
          {
            foreignKeyName: "signature_records_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_records_signer_user_id_fkey"
            columns: ["signer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          family_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activate_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: {
          created_at: string
          family_id: string
          group_id: string | null
          id: string
          location_id: string | null
          operational_status: Database["public"]["Enums"]["enrollment_status"]
          plan_id: string | null
          plan_price_id: string | null
          player_id: string
          review_notes: string | null
          review_status: string
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_assign_group: {
        Args: { p_enrollment_id: string; p_group_id: string }
        Returns: {
          created_at: string
          family_id: string
          group_id: string | null
          id: string
          location_id: string | null
          operational_status: Database["public"]["Enums"]["enrollment_status"]
          plan_id: string | null
          plan_price_id: string | null
          player_id: string
          review_notes: string | null
          review_status: string
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_prepare_payment_order: {
        Args: { p_enrollment_id: string }
        Returns: string
      }
      admin_record_payment: {
        Args: { p_note?: string; p_payment_order_id: string; p_result: string }
        Returns: {
          amount_cents: number
          billing_period: string | null
          created_at: string
          currency: string
          description: string | null
          due_on: string | null
          enrollment_fee_cents: number
          enrollment_id: string
          family_id: string
          id: string
          paid_at: string | null
          plan_amount_cents: number | null
          plan_price_id: string | null
          provider: string
          provider_customer_ref: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "payment_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_enrollment: {
        Args: {
          p_decision: string
          p_enrollment_id: string
          p_group_id?: string
          p_notes?: string
        }
        Returns: {
          created_at: string
          family_id: string
          group_id: string | null
          id: string
          location_id: string | null
          operational_status: Database["public"]["Enums"]["enrollment_status"]
          plan_id: string | null
          plan_price_id: string | null
          player_id: string
          review_notes: string | null
          review_status: string
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_interest: {
        Args: { p_admin_notes?: string; p_request_id: string; p_status: string }
        Returns: {
          admin_notes: string | null
          closed_at: string | null
          contacted_at: string | null
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          notes: string | null
          player_id: string
          service_id: Database["public"]["Enums"]["service_code"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_interest_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_withdraw_enrollment: {
        Args: { p_enrollment_id: string; p_reason?: string }
        Returns: {
          created_at: string
          family_id: string
          group_id: string | null
          id: string
          location_id: string | null
          operational_status: Database["public"]["Enums"]["enrollment_status"]
          plan_id: string | null
          plan_price_id: string | null
          player_id: string
          review_notes: string | null
          review_status: string
          season_id: string | null
          service_id: Database["public"]["Enums"]["service_code"]
          start_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_family: {
        Args: { target_family_id: string }
        Returns: boolean
      }
      current_family_id: { Args: never; Returns: string }
      enrollment_missing_requirements: {
        Args: { p_enrollment_id: string }
        Returns: string[]
      }
      family_register_interest: {
        Args: {
          p_notes?: string
          p_player_id: string
          p_service_id: Database["public"]["Enums"]["service_code"]
        }
        Returns: string
      }
      family_save_player: {
        Args: {
          p_birth_date: string
          p_emergency_name: string
          p_emergency_phone: string
          p_emergency_relationship?: string
          p_first_name: string
          p_last_name: string
          p_medical_notes: string
          p_player_id: string
          p_team: string
        }
        Returns: string
      }
      family_sign_document: {
        Args: {
          p_accepted_consents: Json
          p_completed_data: Json
          p_document_version_id: string
          p_enrollment_id: string
          p_evidence_sha256: string
          p_evidence_storage_path: string
          p_final_sha256?: string
          p_final_storage_path?: string
          p_signer_name: string
        }
        Returns: string
      }
      family_submit_enrollment: {
        Args: {
          p_availability?: Json
          p_location_id: string
          p_notes?: string
          p_plan_id: string
          p_plan_price_id: string
          p_player_id: string
          p_season_id: string
          p_service_id: Database["public"]["Enums"]["service_code"]
        }
        Returns: string
      }
      family_update_details: {
        Args: { p_address: string; p_name: string; p_phone: string }
        Returns: {
          address: string | null
          archived_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          stripe_customer_ref: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "families"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      group_occupancy: {
        Args: never
        Returns: {
          assigned: number
          group_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      player_family_id: { Args: { target_player_id: string }; Returns: string }
      prepare_initial_payment_order: {
        Args: { p_enrollment_id: string }
        Returns: string
      }
      service_lookup_auth_user: { Args: { p_email: string }; Returns: string }
      service_prepare_family_access: {
        Args: {
          p_actor_user_id: string
          p_auth_user_id: string
          p_email: string
          p_family_id?: string
          p_family_name?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "family"
      document_status:
        | "draft"
        | "pending_signature"
        | "signed"
        | "update_required"
        | "informative"
        | "not_applicable"
      enrollment_status:
        | "draft"
        | "pending_completion"
        | "ready_to_activate"
        | "active"
        | "withdrawn"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      member_status: "invited" | "active" | "revoked"
      payment_status: "pending" | "paid" | "failed" | "canceled"
      service_code: "training_kids" | "football_academy" | "gym_home"
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
      app_role: ["owner", "admin", "family"],
      document_status: [
        "draft",
        "pending_signature",
        "signed",
        "update_required",
        "informative",
        "not_applicable",
      ],
      enrollment_status: [
        "draft",
        "pending_completion",
        "ready_to_activate",
        "active",
        "withdrawn",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      member_status: ["invited", "active", "revoked"],
      payment_status: ["pending", "paid", "failed", "canceled"],
      service_code: ["training_kids", "football_academy", "gym_home"],
    },
  },
} as const
