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
      ai_appointment_requests: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          external_ref: string | null
          id: string
          notes: string | null
          patient_cpf: string | null
          patient_date_of_birth: string | null
          patient_id: string | null
          patient_name: string | null
          patient_phone: string
          procedure: string | null
          rejection_reason: string | null
          requested_at: string
          source: string
          specialty: string | null
          status: string
          suggested_dentist_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          patient_cpf?: string | null
          patient_date_of_birth?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone: string
          procedure?: string | null
          rejection_reason?: string | null
          requested_at: string
          source?: string
          specialty?: string | null
          status?: string
          suggested_dentist_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          patient_cpf?: string | null
          patient_date_of_birth?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string
          procedure?: string | null
          rejection_reason?: string | null
          requested_at?: string
          source?: string
          specialty?: string | null
          status?: string
          suggested_dentist_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_appointment_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_appointment_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_appointment_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
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
          cancelled_at: string | null
          cancelled_by: string | null
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
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          cancelled_at?: string | null
          cancelled_by?: string | null
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
      clinic_documents: {
        Row: {
          clinic_id: string
          created_at: string
          doc_type: string
          file_name: string | null
          file_path: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_path: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_path?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      clinic_member_procedures: {
        Row: {
          clinic_member_id: string
          created_at: string
          custom_duration: number | null
          custom_price: number | null
          id: string
          procedure_id: string
          updated_at: string
        }
        Insert: {
          clinic_member_id: string
          created_at?: string
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          procedure_id: string
          updated_at?: string
        }
        Update: {
          clinic_member_id?: string
          created_at?: string
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          procedure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_member_procedures_clinic_member_id_fkey"
            columns: ["clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_member_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
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
          is_active: boolean
          is_owner: boolean
          permissions: Json | null
          registration_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          permissions?: Json | null
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          permissions?: Json | null
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
          address_complement: string | null
          address_number: string | null
          appointment_approval_mode: string
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_holder_document: string | null
          bank_name: string | null
          birth_date: string | null
          business_hours: Json | null
          category: Database["public"]["Enums"]["clinic_category"]
          category_label: string | null
          city: string | null
          cnes: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          entity_type: string
          hide_iaclin_logo: boolean
          id: string
          inss_pis: string | null
          invite_code: string | null
          is_published: boolean
          legal_name: string | null
          logo_url: string | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          onboarding_completed_at: string | null
          owner_id: string | null
          phone: string | null
          responsible_name: string | null
          rg: string | null
          specialty_certificate: string | null
          state: string | null
          state_registration: string | null
          updated_at: string
          welcome_dismissed_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          appointment_approval_mode?: string
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_holder_document?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_hours?: Json | null
          category?: Database["public"]["Enums"]["clinic_category"]
          category_label?: string | null
          city?: string | null
          cnes?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          entity_type?: string
          hide_iaclin_logo?: boolean
          id?: string
          inss_pis?: string | null
          invite_code?: string | null
          is_published?: boolean
          legal_name?: string | null
          logo_url?: string | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          onboarding_completed_at?: string | null
          owner_id?: string | null
          phone?: string | null
          responsible_name?: string | null
          rg?: string | null
          specialty_certificate?: string | null
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          welcome_dismissed_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          appointment_approval_mode?: string
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_holder_document?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_hours?: Json | null
          category?: Database["public"]["Enums"]["clinic_category"]
          category_label?: string | null
          city?: string | null
          cnes?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          entity_type?: string
          hide_iaclin_logo?: boolean
          id?: string
          inss_pis?: string | null
          invite_code?: string | null
          is_published?: boolean
          legal_name?: string | null
          logo_url?: string | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          onboarding_completed_at?: string | null
          owner_id?: string | null
          phone?: string | null
          responsible_name?: string | null
          rg?: string | null
          specialty_certificate?: string | null
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          welcome_dismissed_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          dentist_id: string
          id: string
          insurance_provider: string | null
          specialty: string | null
          trigger: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          dentist_id: string
          id?: string
          insurance_provider?: string | null
          specialty?: string | null
          trigger: string
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          dentist_id?: string
          id?: string
          insurance_provider?: string | null
          specialty?: string | null
          trigger?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
          appointment_id: string | null
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
          appointment_id?: string | null
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
          appointment_id?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          approval_decided_at: string | null
          approval_decided_by: string | null
          approval_rejection_reason: string | null
          approval_requested_by: string | null
          approval_status: string
          category: string
          clinic_id: string | null
          created_at: string
          dentist_id: string | null
          description: string | null
          due_date: string
          id: string
          insurance_invoice_period: string | null
          insurance_invoice_status: string | null
          notes: string | null
          operator_id: string | null
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
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_rejection_reason?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          category: string
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          insurance_invoice_period?: string | null
          insurance_invoice_status?: string | null
          notes?: string | null
          operator_id?: string | null
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
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_rejection_reason?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          category?: string
          clinic_id?: string | null
          created_at?: string
          dentist_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          insurance_invoice_period?: string | null
          insurance_invoice_status?: string | null
          notes?: string | null
          operator_id?: string | null
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
            foreignKeyName: "financial_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
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
          active_states: string[]
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
          active_states?: string[]
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
          active_states?: string[]
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
      insurance_plans_catalog: {
        Row: {
          ans_code: string | null
          created_at: string
          id: string
          is_active: boolean
          operator_name: string
          plan_name: string
          type: string
        }
        Insert: {
          ans_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          operator_name: string
          plan_name: string
          type?: string
        }
        Update: {
          ans_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          operator_name?: string
          plan_name?: string
          type?: string
        }
        Relationships: []
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
      nps_responses: {
        Row: {
          answered_at: string | null
          appointment_id: string | null
          category: string | null
          clinic_id: string
          comment: string | null
          id: string
          patient_id: string | null
          patient_phone: string | null
          score: number | null
          sent_at: string
          status: string
          survey_id: string | null
        }
        Insert: {
          answered_at?: string | null
          appointment_id?: string | null
          category?: string | null
          clinic_id: string
          comment?: string | null
          id?: string
          patient_id?: string | null
          patient_phone?: string | null
          score?: number | null
          sent_at?: string
          status?: string
          survey_id?: string | null
        }
        Update: {
          answered_at?: string | null
          appointment_id?: string | null
          category?: string | null
          clinic_id?: string
          comment?: string | null
          id?: string
          patient_id?: string | null
          patient_phone?: string | null
          score?: number | null
          sent_at?: string
          status?: string
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          question: string
          scale_max: number
          scale_min: number
          send_after_hours: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          question: string
          scale_max?: number
          scale_min?: number
          send_after_hours?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          question?: string
          scale_max?: number
          scale_min?: number
          send_after_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_clinic_id_fkey"
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
      operator_beneficiaries: {
        Row: {
          card_number: string
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          due_day: number | null
          email: string | null
          enrolled_at: string | null
          full_name: string
          id: string
          last_payment_at: string | null
          next_due_date: string | null
          notes: string | null
          operator_id: string
          phone: string | null
          plan_name: string | null
          plan_type: string
          status: string
          updated_at: string
        }
        Insert: {
          card_number: string
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          due_day?: number | null
          email?: string | null
          enrolled_at?: string | null
          full_name: string
          id?: string
          last_payment_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          operator_id: string
          phone?: string | null
          plan_name?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          card_number?: string
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          due_day?: number | null
          email?: string | null
          enrolled_at?: string | null
          full_name?: string
          id?: string
          last_payment_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          operator_id?: string
          phone?: string | null
          plan_name?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_beneficiaries_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_beneficiary_dependents: {
        Row: {
          beneficiary_id: string
          card_number: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          card_number?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          relationship?: string
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          card_number?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_beneficiary_dependents_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "operator_beneficiaries"
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
      operator_price_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          table_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_price_files_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "operator_price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_price_items: {
        Row: {
          category: string
          charge_type: string
          created_at: string
          id: string
          longevity: string | null
          observations: string | null
          photo_required: boolean
          plan_coverage: string[]
          procedure_name: string
          rx_required: boolean
          sort_order: number
          table_id: string
          tuss_code: string | null
          value_brl: number | null
          value_us: number | null
        }
        Insert: {
          category?: string
          charge_type?: string
          created_at?: string
          id?: string
          longevity?: string | null
          observations?: string | null
          photo_required?: boolean
          plan_coverage?: string[]
          procedure_name: string
          rx_required?: boolean
          sort_order?: number
          table_id: string
          tuss_code?: string | null
          value_brl?: number | null
          value_us?: number | null
        }
        Update: {
          category?: string
          charge_type?: string
          created_at?: string
          id?: string
          longevity?: string | null
          observations?: string | null
          photo_required?: boolean
          plan_coverage?: string[]
          procedure_name?: string
          rx_required?: boolean
          sort_order?: number
          table_id?: string
          tuss_code?: string | null
          value_brl?: number | null
          value_us?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_price_items_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "operator_price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_price_tables: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          operator_id: string
          region: string | null
          state: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          operator_id: string
          region?: string | null
          state?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          operator_id?: string
          region?: string | null
          state?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_price_tables_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "insurance_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_accounts: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          city: string | null
          cpf: string
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          guardian_cpf: string | null
          guardian_date_of_birth: string | null
          guardian_name: string | null
          id: string
          insurance_holder: string | null
          insurance_holder_cpf: string | null
          insurance_number: string | null
          insurance_plan: string | null
          insurance_provider: string | null
          is_foreign: boolean
          landline: string | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          profession: string | null
          rg: string | null
          sms_reminders: boolean
          state: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cpf: string
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          guardian_cpf?: string | null
          guardian_date_of_birth?: string | null
          guardian_name?: string | null
          id?: string
          insurance_holder?: string | null
          insurance_holder_cpf?: string | null
          insurance_number?: string | null
          insurance_plan?: string | null
          insurance_provider?: string | null
          is_foreign?: boolean
          landline?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sms_reminders?: boolean
          state?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cpf?: string
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          guardian_cpf?: string | null
          guardian_date_of_birth?: string | null
          guardian_name?: string | null
          id?: string
          insurance_holder?: string | null
          insurance_holder_cpf?: string | null
          insurance_number?: string | null
          insurance_plan?: string | null
          insurance_provider?: string | null
          is_foreign?: boolean
          landline?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sms_reminders?: boolean
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
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
          source: string
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
          source?: string
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
          source?: string
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
          insurance_plan: string | null
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
          insurance_plan?: string | null
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
          insurance_plan?: string | null
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
      patient_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          clinic_id: string | null
          cpf: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string | null
          requested_by_user_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          phone?: string | null
          requested_by_user_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          requested_by_user_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_link_requests: {
        Row: {
          clinic_id: string | null
          cpf: string
          created_at: string
          expires_at: string
          id: string
          patient_user_id: string
          rejection_reason: string | null
          requested_by_user_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          cpf: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_user_id: string
          rejection_reason?: string | null
          requested_by_user_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          cpf?: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_user_id?: string
          rejection_reason?: string | null
          requested_by_user_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_link_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          address_complement: string | null
          address_number: string | null
          categories: string[] | null
          city: string | null
          clinic_id: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          dentist_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          guardian_cpf: string | null
          guardian_date_of_birth: string | null
          guardian_name: string | null
          id: string
          insurance_holder: string | null
          insurance_holder_cpf: string | null
          insurance_number: string | null
          insurance_provider: string | null
          is_active: boolean
          is_foreign: boolean
          landline: string | null
          neighborhood: string | null
          notes: string | null
          patient_user_id: string | null
          phone: string | null
          photo_url: string | null
          profession: string | null
          referral_source: string | null
          rg: string | null
          sms_reminders: boolean
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          categories?: string[] | null
          city?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          dentist_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          guardian_cpf?: string | null
          guardian_date_of_birth?: string | null
          guardian_name?: string | null
          id?: string
          insurance_holder?: string | null
          insurance_holder_cpf?: string | null
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          is_foreign?: boolean
          landline?: string | null
          neighborhood?: string | null
          notes?: string | null
          patient_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          referral_source?: string | null
          rg?: string | null
          sms_reminders?: boolean
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          categories?: string[] | null
          city?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          dentist_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          guardian_cpf?: string | null
          guardian_date_of_birth?: string | null
          guardian_name?: string | null
          id?: string
          insurance_holder?: string | null
          insurance_holder_cpf?: string | null
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          is_foreign?: boolean
          landline?: string | null
          neighborhood?: string | null
          notes?: string | null
          patient_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          referral_source?: string | null
          rg?: string | null
          sms_reminders?: boolean
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
      payment_accounts: {
        Row: {
          account: string | null
          account_digit: string | null
          account_holder: string | null
          account_holder_doc: string | null
          account_type: string | null
          agency: string | null
          agency_digit: string | null
          bank_code: string | null
          bank_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_active: boolean
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          account_digit?: string | null
          account_holder?: string | null
          account_holder_doc?: string | null
          account_type?: string | null
          agency?: string | null
          agency_digit?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_active?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          account_digit?: string | null
          account_holder?: string | null
          account_holder_doc?: string | null
          account_type?: string | null
          agency?: string | null
          agency_digit?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          uses_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      platform_payments: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          receipt_url: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_invoice_id: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_date?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_invoice_id?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_invoice_id?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plans: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          currency: string
          description: string | null
          extra_professional_price_cents: number | null
          features: Json
          id: string
          is_active: boolean
          max_professionals: number | null
          mp_preapproval_plan_id: string | null
          name: string
          price_cents: number
          segment: Database["public"]["Enums"]["plan_segment"]
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency?: string
          description?: string | null
          extra_professional_price_cents?: number | null
          features?: Json
          id?: string
          is_active?: boolean
          max_professionals?: number | null
          mp_preapproval_plan_id?: string | null
          name: string
          price_cents?: number
          segment: Database["public"]["Enums"]["plan_segment"]
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency?: string
          description?: string | null
          extra_professional_price_cents?: number | null
          features?: Json
          id?: string
          is_active?: boolean
          max_professionals?: number | null
          mp_preapproval_plan_id?: string | null
          name?: string
          price_cents?: number
          segment?: Database["public"]["Enums"]["plan_segment"]
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_subscriptions: {
        Row: {
          amount_cents: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          coupon_id: string | null
          created_at: string
          current_period_end: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          due_date: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          final_amount_cents: number
          id: string
          last_payment_at: string | null
          last_payment_method:
            | Database["public"]["Enums"]["payment_method"]
            | null
          mp_init_point: string | null
          mp_payer_email: string | null
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_id: string | null
          plan_name: string | null
          status: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          due_date?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          final_amount_cents?: number
          id?: string
          last_payment_at?: string | null
          last_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          mp_init_point?: string | null
          mp_payer_email?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_id?: string | null
          plan_name?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          due_date?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          final_amount_cents?: number
          id?: string
          last_payment_at?: string | null
          last_payment_method?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          mp_init_point?: string | null
          mp_payer_email?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_id?: string | null
          plan_name?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "platform_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
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
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          address_complement: string | null
          address_number: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          neighborhood: string | null
          phone: string | null
          signature_url: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          neighborhood?: string | null
          phone?: string | null
          signature_url?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          neighborhood?: string | null
          phone?: string | null
          signature_url?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
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
          clinic_id: string | null
          created_at: string
          created_by: string
          forwarded_at: string | null
          forwarded_by: string | null
          id: string
          operator_id: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          created_by: string
          forwarded_at?: string | null
          forwarded_by?: string | null
          id?: string
          operator_id?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          forwarded_at?: string | null
          forwarded_by?: string | null
          id?: string
          operator_id?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      treatment_plan_items: {
        Row: {
          created_at: string
          custom_procedure_name: string | null
          id: string
          notes: string | null
          price: number
          procedure_id: string | null
          status: string
          tooth_number: number | null
          treatment_plan_id: string
        }
        Insert: {
          created_at?: string
          custom_procedure_name?: string | null
          id?: string
          notes?: string | null
          price?: number
          procedure_id?: string | null
          status?: string
          tooth_number?: number | null
          treatment_plan_id: string
        }
        Update: {
          created_at?: string
          custom_procedure_name?: string | null
          id?: string
          notes?: string | null
          price?: number
          procedure_id?: string | null
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
          approval_required_by_clinic: boolean
          approved_at: string | null
          approved_by: string | null
          charges_generated_at: string | null
          created_at: string
          dentist_id: string
          description: string | null
          id: string
          paid_at: string | null
          patient_id: string
          payment_method: string | null
          payment_notes: string | null
          payment_recorded_by: string | null
          rejection_reason: string | null
          status: string
          submitted_by: string | null
          title: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          approval_required_by_clinic?: boolean
          approved_at?: string | null
          approved_by?: string | null
          charges_generated_at?: string | null
          created_at?: string
          dentist_id: string
          description?: string | null
          id?: string
          paid_at?: string | null
          patient_id: string
          payment_method?: string | null
          payment_notes?: string | null
          payment_recorded_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          approval_required_by_clinic?: boolean
          approved_at?: string | null
          approved_by?: string | null
          charges_generated_at?: string | null
          created_at?: string
          dentist_id?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          patient_id?: string
          payment_method?: string | null
          payment_notes?: string | null
          payment_recorded_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_by?: string | null
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
      admin_get_clinics: {
        Args: never
        Returns: {
          category: string
          city: string
          created_at: string
          email: string
          id: string
          member_count: number
          name: string
          phone: string
          state: string
        }[]
      }
      admin_get_doctors: {
        Args: never
        Returns: {
          clinic_id: string
          clinic_name: string
          created_at: string
          full_name: string
          is_owner: boolean
          registration_number: string
          role: string
          specialty: string
          user_id: string
        }[]
      }
      admin_get_operators: { Args: never; Returns: Json[] }
      admin_get_stats: { Args: never; Returns: Json }
      calc_final_amount: {
        Args: {
          _base_cents: number
          _discount_type: Database["public"]["Enums"]["discount_type"]
          _discount_value: number
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_clinic_invite_code: { Args: never; Returns: string }
      get_marketplace_doctor_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          address: string
          address_number: string
          avatar_url: string
          city: string
          full_name: string
          id: string
          neighborhood: string
          phone: string
          state: string
          zip_code: string
        }[]
      }
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
      is_platform_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_pix_payment: {
        Args: {
          p_amount_cents: number
          p_notes?: string
          p_paid_at?: string
          p_receipt_url?: string
          p_subscription_id: string
        }
        Returns: {
          amount_cents: number
          created_at: string
          due_date: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          receipt_url: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_invoice_id: string | null
          subscription_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_or_create_ai_tenant_for_clinic: {
        Args: { _clinic_id: string }
        Returns: string
      }
      resolve_or_create_ai_tenant_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      upsert_platform_subscription: {
        Args: {
          p_billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          p_coupon_id?: string
          p_discount_type?: Database["public"]["Enums"]["discount_type"]
          p_discount_value?: number
          p_due_date?: string
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_plan_id?: string
          p_status?: Database["public"]["Enums"]["sub_status"]
        }
        Returns: {
          amount_cents: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          coupon_id: string | null
          created_at: string
          current_period_end: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          due_date: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          final_amount_cents: number
          id: string
          last_payment_at: string | null
          last_payment_method:
            | Database["public"]["Enums"]["payment_method"]
            | null
          mp_init_point: string | null
          mp_payer_email: string | null
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_id: string | null
          plan_name: string | null
          status: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      app_role:
        | "admin"
        | "dentist"
        | "secretary"
        | "patient"
        | "operator"
        | "auxiliary"
      billing_cycle: "monthly" | "yearly"
      clinic_category:
        | "odonto"
        | "medico"
        | "estetica"
        | "veterinario"
        | "outro"
      discount_type: "percent" | "fixed"
      entity_type: "clinic" | "doctor" | "operator"
      payment_method: "card" | "pix" | "manual"
      payment_status: "paid" | "pending" | "failed" | "refunded"
      plan_segment: "clinic" | "doctor" | "operator"
      sub_status: "active" | "trial" | "overdue" | "cancelled"
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
      app_role: [
        "admin",
        "dentist",
        "secretary",
        "patient",
        "operator",
        "auxiliary",
      ],
      billing_cycle: ["monthly", "yearly"],
      clinic_category: ["odonto", "medico", "estetica", "veterinario", "outro"],
      discount_type: ["percent", "fixed"],
      entity_type: ["clinic", "doctor", "operator"],
      payment_method: ["card", "pix", "manual"],
      payment_status: ["paid", "pending", "failed", "refunded"],
      plan_segment: ["clinic", "doctor", "operator"],
      sub_status: ["active", "trial", "overdue", "cancelled"],
    },
  },
} as const
