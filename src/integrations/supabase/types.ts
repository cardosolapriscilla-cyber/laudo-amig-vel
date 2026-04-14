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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      consultas_agendadas: {
        Row: {
          created_at: string | null
          data_consulta: string
          especialidade: string
          id: string
          lembrete_enviado: boolean | null
          local_consulta: string | null
          resumo_enviado: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_consulta: string
          especialidade: string
          id?: string
          lembrete_enviado?: boolean | null
          local_consulta?: string | null
          resumo_enviado?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_consulta?: string
          especialidade?: string
          id?: string
          lembrete_enviado?: boolean | null
          local_consulta?: string | null
          resumo_enviado?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_agendadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      dicas_enviadas: {
        Row: {
          enviado_em: string | null
          id: string
          tema: string
          user_id: string | null
        }
        Insert: {
          enviado_em?: string | null
          id?: string
          tema: string
          user_id?: string | null
        }
        Update: {
          enviado_em?: string | null
          id?: string
          tema?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dicas_enviadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_preventivos: {
        Row: {
          created_at: string | null
          data_proximo: string
          data_ultimo: string | null
          enviado: boolean | null
          fonte_guideline: string | null
          id: string
          motivo: string | null
          tipo_exame: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_proximo: string
          data_ultimo?: string | null
          enviado?: boolean | null
          fonte_guideline?: string | null
          id?: string
          motivo?: string | null
          tipo_exame: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_proximo?: string
          data_ultimo?: string | null
          enviado?: boolean | null
          fonte_guideline?: string | null
          id?: string
          motivo?: string | null
          tipo_exame?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_preventivos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_exames: {
        Row: {
          created_at: string | null
          data_coleta: string | null
          id: string
          laboratorio: string | null
          nome: string
          resultado_json: Json | null
          resumo: string | null
          sistema: string | null
          texto_original: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_coleta?: string | null
          id?: string
          laboratorio?: string | null
          nome: string
          resultado_json?: Json | null
          resumo?: string | null
          sistema?: string | null
          texto_original: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_coleta?: string | null
          id?: string
          laboratorio?: string | null
          nome?: string
          resultado_json?: Json | null
          resumo?: string | null
          sistema?: string | null
          texto_original?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_exames_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          conteudo: string
          created_at: string | null
          direcao: string
          id: string
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          direcao: string
          id?: string
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          direcao?: string
          id?: string
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_users: {
        Row: {
          ativo: boolean | null
          condicoes: string[] | null
          created_at: string | null
          data_nascimento: string | null
          historico_familiar: string | null
          id: string
          nome: string | null
          onboarding_completo: boolean | null
          phone: string
          sexo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          condicoes?: string[] | null
          created_at?: string | null
          data_nascimento?: string | null
          historico_familiar?: string | null
          id?: string
          nome?: string | null
          onboarding_completo?: boolean | null
          phone: string
          sexo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          condicoes?: string[] | null
          created_at?: string | null
          data_nascimento?: string | null
          historico_familiar?: string | null
          id?: string
          nome?: string | null
          onboarding_completo?: boolean | null
          phone?: string
          sexo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
