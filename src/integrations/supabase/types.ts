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
      ai_secretary_config: {
        Row: {
          ai_tenant_id: string | null
          clinic_id: string | null
          created_at: string
          custom_prompt: string | null
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          ai_tenant_id?: string | null
          clinic_id?: string | null
          created_at?: string
          custom_prompt?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          ai_tenant_id?: string | null
          clinic_id?: string | null
          created_at?: string
          custom_prompt?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_secretary_handoff: {
        Row: {
          ai_tenant_id: string | null
          clinic_id: string | null
          created_at: string
          enabled: boolean
          handoff_message: string | null
          id: string
          target_phone: string | null
          target_user_id: string | null
          trigger_keywords: string | null
          updated_at: string
        }
        Insert: {
          ai_tenant_id?: string | null
          clinic_id?: string | null
          created_at?: string
          enabled?: boolean
          handoff_message?: string | null
          id?: string
          target_phone?: string | null
          target_user_id?: string | null
          trigger_keywords?: string | null
          updated_at?: string
        }
        Update: {
          ai_tenant_id?: string | null
          clinic_id?: string | null
          created_at?: string
          enabled?: boolean
          handoff_message?: string | null
          id?: string
          target_phone?: string | null
          target_user_id?: string | null
          trigger_keywords?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_tenants: {
        Row: {
          branding: Json
          clinic_id: string | null
          created_at: string
          display_name: string | null
          id: string
          owner_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branding?: Json
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          owner_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branding?: Json
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          owner_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      anamneses: {
        Row: {
          allergies: string | null
          blood_type: string | null
          clinic_id: string | null
          created_at: string
          filled_by: string | null
          habits: string | null
          id: string
          medical_conditions: string | null
          medications: string | null
          notes: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          blood_type?: string | null
          clinic_id?: string | null
          created_at?: string
          filled_by?: string | null
          habits?: string | null
          id?: string
          medical_conditions?: string | null
          medications?: string | null
          notes?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          blood_type?: string | null
          clinic_id?: string | null
          created_at?: string
          filled_by?: string | null
          habits?: string | null
          id?: string
          medical_conditions?: string | null
          medications?: string | null
          notes?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_requests: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          dentist_id: string
          end_time: string
          id: string
          notes: string | null
          patient_account_snapshot: Json
          patient_user_id: string
          rejection_reason: string | null
          specialty: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dentist_id: string
          end_time: string
          id?: string
          notes?: string | null
          patient_account_snapshot?: Json
          patient_user_id: string
          rejection_reason?: string | null
          specialty?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dentist_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          patient_account_snapshot?: Json
          patient_user_id?: string
          rejection_reason?: string | null
          specialty?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          arrived_at: string | null
          clinic_id: string | null
          created_at: string
          dentist_id: string
          end_time: string
          id: string
          label: string | null
          notes: string | null
          patient_id: string
          presence_status: string
          procedure_id: string | null
          room_id: string | null
          send_confirmation: boolean | null
          service_started_at: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          clinic_id?: string | null
          created_at?: string
          dentist_id: string
          end_time: string
          id?: string
          label?: string | null
          notes?: string | null
          patient_id: string
          presence_status?: string
          procedure_id?: string | null
          room_id?: string | null
          send_confirmation?: boolean | null
          service_started_at?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string
          end_time?: string
          id?: string
          label?: string | null
          notes?: string | null
          patient_id?: string
          presence_status?: string
          procedure_id?: string | null
          room_id?: string | null
          send_confirmation?: boolean | null
          service_started_at?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "clinic_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          registration_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_member_insurance_plans: {
        Row: {
          clinic_member_id: string
          created_at: string
          id: string
          insurance_plan_id: string
          operator_id: string | null
        }
        Insert: {
          clinic_member_id: string
          created_at?: string
          id?: string
          insurance_plan_id: string
          operator_id?: string | null
        }
        Update: {
          clinic_member_id?: string
          created_at?: string
          id?: string
          insurance_plan_id?: string
          operator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_member_insurance_plans_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_member_insurance_plans_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_member_specialties: {
        Row: {
          clinic_member_id: string
          created_at: string
          id: string
          specialty: string
        }
        Insert: {
          clinic_member_id: string
          created_at?: string
          id?: string
          specialty: string
        }
        Update: {
          clinic_member_id?: string
          created_at?: string
          id?: string
          specialty?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_member_specialties_clinic_member_id_fkey"
            columns: ["clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_owner: boolean
          registration_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_owner?: boolean
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_owner?: boolean
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_rooms: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_map_entries: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          condition: string
          created_at: string
          dentist_id: string | null
          id: string
          map_type: string
          notes: string | null
          patient_id: string
          payload: Json | null
          region_code: string
          severity: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          condition: string
          created_at?: string
          dentist_id?: string | null
          id?: string
          map_type: string
          notes?: string | null
          patient_id: string
          payload?: Json | null
          region_code: string
          severity?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          condition?: string
          created_at?: string
          dentist_id?: string | null
          id?: string
          map_type?: string
          notes?: string | null
          patient_id?: string
          payload?: Json | null
          region_code?: string
          severity?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clinical_record_procedures: {
        Row: {
          clinical_record_id: string
          created_at: string
          id: string
          notes: string | null
          price: number
          procedure_id: string
          surface: string | null
          tooth_number: number | null
        }
        Insert: {
          clinical_record_id: string
          created_at?: string
          id?: string
          notes?: string | null
          price?: number
          procedure_id: string
          surface?: string | null
          tooth_number?: number | null
        }
        Update: {
          clinical_record_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          price?: number
          procedure_id?: string
          surface?: string | null
          tooth_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_record_procedures_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_record_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_record_requests: {
        Row: {
          clinical_record_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          clinical_record_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
        }
        Update: {
          clinical_record_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clinical_record_requests_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string | null
          created_at: string
          dentist_id: string
          diagnosis: string | null
          follow_up_date: string | null
          follow_up_reason: string | null
          history_present_illness: string | null
          hypotheses: Json | null
          id: string
          notes: string | null
          patient_id: string
          physical_exam: string | null
          procedure_duration_seconds: number | null
          severity: string | null
          status: string
          symptom_duration: string | null
          treatment_plan: string | null
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          dentist_id: string
          diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_reason?: string | null
          history_present_illness?: string | null
          hypotheses?: Json | null
          id?: string
          notes?: string | null
          patient_id: string
          physical_exam?: string | null
          procedure_duration_seconds?: number | null
          severity?: string | null
          status?: string
          symptom_duration?: string | null
          treatment_plan?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string
          diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_reason?: string | null
          history_present_illness?: string | null
          hypotheses?: Json | null
          id?: string
          notes?: string | null
          patient_id?: string
          physical_exam?: string | null
          procedure_duration_seconds?: number | null
          severity?: string | null
          status?: string
          symptom_duration?: string | null
          treatment_plan?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          business_hours: Json | null
          category: Database["public"]["Enums"]["clinic_category"]
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          hide_iaclin_logo: boolean
          id: string
          invite_code: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          responsible_name: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          category?: Database["public"]["Enums"]["clinic_category"]
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          hide_iaclin_logo?: boolean
          id?: string
          invite_code?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          responsible_name?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          category?: Database["public"]["Enums"]["clinic_category"]
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          hide_iaclin_logo?: boolean
          id?: string
          invite_code?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          responsible_name?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      consultation_recordings: {
        Row: {
          anamnesis: Json | null
          appointment_id: string | null
          audio_storage_path: string | null
          clinic_id: string | null
          clinical_record_id: string | null
          consent_accepted_at: string | null
          created_at: string
          dentist_id: string
          duration_seconds: number | null
          error_message: string | null
          hypotheses: Json | null
          id: string
          patient_id: string
          soap: Json | null
          status: string
          structured: Json | null
          summary: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          anamnesis?: Json | null
          appointment_id?: string | null
          audio_storage_path?: string | null
          clinic_id?: string | null
          clinical_record_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          dentist_id: string
          duration_seconds?: number | null
          error_message?: string | null
          hypotheses?: Json | null
          id?: string
          patient_id: string
          soap?: Json | null
          status?: string
          structured?: Json | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          anamnesis?: Json | null
          appointment_id?: string | null
          audio_storage_path?: string | null
          clinic_id?: string | null
          clinical_record_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          dentist_id?: string
          duration_seconds?: number | null
          error_message?: string | null
          hypotheses?: Json | null
          id?: string
          patient_id?: string
          soap?: Json | null
          status?: string
          structured?: Json | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_recordings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_recordings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_recordings_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_recordings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          name: string
          patient_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          patient_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          patient_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          clinic_id: string | null
          created_at: string
          dentist_id: string | null
          description: string | null
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          patient_id: string | null
          payment_method: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category: string
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_gestor_folders: {
        Row: {
          clinic_id: string | null
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ia_gestor_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          parts: Json
          role: string
          sdk_message_id: string | null
          thread_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json
          role: string
          sdk_message_id?: string | null
          thread_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          sdk_message_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_gestor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ia_gestor_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_gestor_threads: {
        Row: {
          clinic_id: string | null
          created_at: string
          folder_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_gestor_threads_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "ia_gestor_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          source_file_url: string
          status: string
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          source_file_url: string
          status?: string
          transaction_date: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          source_file_url?: string
          status?: string
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance_operators: {
        Row: {
          ans_code: string | null
          brand_color: string | null
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          responsible_name: string | null
          slug: string | null
          type: string
          updated_at: string
        }
        Insert: {
          ans_code?: string | null
          brand_color?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          responsible_name?: string | null
          slug?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          ans_code?: string | null
          brand_color?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          responsible_name?: string | null
          slug?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_plans: {
        Row: {
          ans_code: string | null
          clinic_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          operator_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          ans_code?: string | null
          clinic_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          operator_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          ans_code?: string | null
          clinic_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          operator_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_plans_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          message: string | null
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      odontogram_entries: {
        Row: {
          condition: string
          created_at: string
          dentist_id: string | null
          id: string
          notes: string | null
          patient_id: string
          procedure_id: string | null
          surface: string | null
          tooth_number: number
          updated_at: string
        }
        Insert: {
          condition: string
          created_at?: string
          dentist_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          procedure_id?: string | null
          surface?: string | null
          tooth_number: number
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          dentist_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_id?: string | null
          surface?: string | null
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_entries_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_credentialings: {
        Row: {
          clinic_id: string
          clinic_member_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          operator_id: string
          professional_user_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          clinic_member_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          operator_id: string
          professional_user_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          clinic_member_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          operator_id?: string
          professional_user_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_credentialings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_members: {
        Row: {
          created_at: string
          id: string
          is_owner: boolean
          operator_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_owner?: boolean
          operator_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_owner?: boolean
          operator_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_members_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_accounts: {
        Row: {
          cpf: string
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          insurance_number: string | null
          insurance_provider: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_chart_shares: {
        Row: {
          clinic_id: string | null
          code: string
          consumed_at: string | null
          consumed_count: number
          created_at: string
          created_by: string
          expires_at: string
          id: string
          patient_id: string
        }
        Insert: {
          clinic_id?: string | null
          code: string
          consumed_at?: string | null
          consumed_count?: number
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          patient_id: string
        }
        Update: {
          clinic_id?: string | null
          code?: string
          consumed_at?: string | null
          consumed_count?: number
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: []
      }
      patient_dependents_insurance: {
        Row: {
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          insurance_number: string | null
          insurance_provider: string | null
          patient_account_id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          patient_account_id: string
          relationship: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          patient_account_id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_dependents_insurance_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_personalizations: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_favorite: boolean
          patient_id: string
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          patient_id: string
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          patient_id?: string
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_personalizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          city: string | null
          clinic_id: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          dentist_id: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          insurance_number: string | null
          insurance_provider: string | null
          is_active: boolean
          notes: string | null
          patient_user_id: string | null
          phone: string | null
          photo_url: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          dentist_id?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          notes?: string | null
          patient_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          dentist_id?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          notes?: string | null
          patient_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_templates: {
        Row: {
          category: string | null
          clinic_id: string
          content: Json
          created_at: string
          dentist_id: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          content?: Json
          created_at?: string
          dentist_id?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          content?: Json
          created_at?: string
          dentist_id?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          category: string
          code: string | null
          color: string
          created_at: string
          default_duration: number
          default_price: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          specialty_category: string
        }
        Insert: {
          category: string
          code?: string | null
          color?: string
          created_at?: string
          default_duration?: number
          default_price?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          specialty_category?: string
        }
        Update: {
          category?: string
          code?: string | null
          color?: string
          created_at?: string
          default_duration?: number
          default_price?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          specialty_category?: string
        }
        Relationships: []
      }
      professional_availability: {
        Row: {
          breaks: Json
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          is_holiday_override: boolean
          mode: string
          operator_id: string | null
          start_time: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          breaks?: Json
          clinic_id: string
          created_at?: string
          end_time: string
          id?: string
          is_holiday_override?: boolean
          mode?: string
          operator_id?: string | null
          start_time: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          breaks?: Json
          clinic_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_holiday_override?: boolean
          mode?: string
          operator_id?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_blocked_dates: {
        Row: {
          blocked_date: string
          clinic_id: string | null
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_date: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_date?: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      professional_schedule_template: {
        Row: {
          accepted_plan_ids: string[]
          breaks: Json
          clinic_id: string | null
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          mode: string
          start_time: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          accepted_plan_ids?: string[]
          breaks?: Json
          clinic_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          mode?: string
          start_time?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          accepted_plan_ids?: string[]
          breaks?: Json
          clinic_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          mode?: string
          start_time?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      professional_settings: {
        Row: {
          buffer_minutes: number
          created_at: string
          default_slot_duration: number
          min_lead_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          default_slot_duration?: number
          min_lead_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          default_slot_duration?: number
          min_lead_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_specialties: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          specialty: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          specialty: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          specialty?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      treatment_plan_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          price: number
          procedure_id: string
          status: string
          tooth_number: number | null
          treatment_plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          price?: number
          procedure_id: string
          status?: string
          tooth_number?: number | null
          treatment_plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          price?: number
          procedure_id?: string
          status?: string
          tooth_number?: number | null
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          created_at: string
          dentist_id: string
          description: string | null
          id: string
          patient_id: string
          status: string
          title: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dentist_id: string
          description?: string | null
          id?: string
          patient_id: string
          status?: string
          title: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dentist_id?: string
          description?: string | null
          id?: string
          patient_id?: string
          status?: string
          title?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
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
      whatsapp_instances: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          instance_name: string
          qr_code_url: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          instance_name: string
          qr_code_url?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          qr_code_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          ai_tenant_id: string | null
          clinic_id: string
          content: string
          created_at: string
          direction: string
          external_message_id: string | null
          handled_by: string
          id: string
          message_type: string
          metadata: Json | null
          patient_name: string | null
          patient_phone: string
          status: string
        }
        Insert: {
          ai_tenant_id?: string | null
          clinic_id: string
          content: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          handled_by?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          patient_name?: string | null
          patient_phone: string
          status?: string
        }
        Update: {
          ai_tenant_id?: string | null
          clinic_id?: string
          content?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          handled_by?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          patient_name?: string | null
          patient_phone?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_clinic_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinic_member: { Args: { _user_id: string }; Returns: string[] }
      is_clinic_owner: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_operator_member: { Args: { _user_id: string }; Returns: string[] }
      is_operator_owner: {
        Args: { _operator_id: string; _user_id: string }
        Returns: boolean
      }
      resolve_or_create_ai_tenant_for_clinic: {
        Args: { _clinic_id: string }
        Returns: string
      }
      resolve_or_create_ai_tenant_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      user_belongs_to_clinic: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      user_belongs_to_operator: {
        Args: { _operator_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_ai_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dentist" | "secretary" | "patient" | "operator"
      clinic_category:
        | "odonto"
        | "medico"
        | "estetica"
        | "veterinario"
        | "outro"
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
      app_role: ["admin", "dentist", "secretary", "patient", "operator"],
      clinic_category: ["odonto", "medico", "estetica", "veterinario", "outro"],
    },
  },
} as const
