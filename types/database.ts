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
      comite_propuestas: {
        Row: {
          created_at: string
          id: string
          notas: string | null
          tasacion_id: string
          tasador_id: string
          valor_ars: number | null
          valor_usd: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notas?: string | null
          tasacion_id: string
          tasador_id: string
          valor_ars?: number | null
          valor_usd?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notas?: string | null
          tasacion_id?: string
          tasador_id?: string
          valor_ars?: number | null
          valor_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comite_propuestas_tasacion_id_fkey"
            columns: ["tasacion_id"]
            isOneToOne: false
            referencedRelation: "tasaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comite_propuestas_tasador_id_fkey"
            columns: ["tasador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entidad_miembros: {
        Row: {
          created_at: string
          entidad_id: string
          roles: Database["public"]["Enums"]["rol_entidad_miembro"][]
          user_id: string
        }
        Insert: {
          created_at?: string
          entidad_id: string
          roles: Database["public"]["Enums"]["rol_entidad_miembro"][]
          user_id: string
        }
        Update: {
          created_at?: string
          entidad_id?: string
          roles?: Database["public"]["Enums"]["rol_entidad_miembro"][]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entidad_miembros_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entidad_miembros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entidades: {
        Row: {
          created_at: string
          cuit: string | null
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_entidad"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuit?: string | null
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_entidad"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuit?: string | null
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_entidad"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acepto_terminos_at: string | null
          apellido: string | null
          created_at: string
          email: string
          id: string
          matricula: string | null
          nombre: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          acepto_terminos_at?: string | null
          apellido?: string | null
          created_at?: string
          email: string
          id: string
          matricula?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          acepto_terminos_at?: string | null
          apellido?: string | null
          created_at?: string
          email?: string
          id?: string
          matricula?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solicitantes: {
        Row: {
          apellido: string
          created_at: string
          email: string | null
          id: string
          nombre: string
          telefono: string
          updated_at: string
        }
        Insert: {
          apellido: string
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          telefono: string
          updated_at?: string
        }
        Update: {
          apellido?: string
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasacion_fotos: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          orden: number
          storage_path: string
          tasacion_id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          orden?: number
          storage_path: string
          tasacion_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          orden?: number
          storage_path?: string
          tasacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasacion_fotos_tasacion_id_fkey"
            columns: ["tasacion_id"]
            isOneToOne: false
            referencedRelation: "tasaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      tasaciones: {
        Row: {
          amenities: string[] | null
          antiguedad_anios: number | null
          banios: number | null
          cierre_at: string | null
          cierre_metodo: string | null
          cierre_motivo: string | null
          cliente_b2c_id: string | null
          comite_revelado_at: string | null
          completada_at: string | null
          creado_por: string | null
          created_at: string
          descripcion: string | null
          domicilio: string | null
          dormitorios: number | null
          entidad_id: string | null
          enviado_a_comite_at: string | null
          es_referencial: boolean
          estado: Database["public"]["Enums"]["estado_tasacion"]
          estado_conservacion:
            | Database["public"]["Enums"]["estado_conservacion"]
            | null
          id: string
          inspeccion_ocular_completada_at: string | null
          lat: number | null
          lng: number | null
          motivo: Database["public"]["Enums"]["motivo_tasacion"]
          numero: number
          numero_busqueda: string | null
          padron_inmobiliario: string | null
          pdf_compartido_at: string | null
          pdf_generado_at: string | null
          pdf_url: string | null
          solicitante_id: string | null
          sup_cubierta: number | null
          sup_total: number | null
          tasador_asignado_at: string | null
          tasador_id: string | null
          tipo: Database["public"]["Enums"]["tipo_inmueble"]
          tipo_tasacion: Database["public"]["Enums"]["tipo_tasacion"]
          updated_at: string
          valor_ars: number | null
          valor_fitt_servini_ars: number | null
          valor_robotomus_ars: number | null
          valor_usd: number | null
          visita_programada_at: string | null
        }
        Insert: {
          amenities?: string[] | null
          antiguedad_anios?: number | null
          banios?: number | null
          cierre_at?: string | null
          cierre_metodo?: string | null
          cierre_motivo?: string | null
          cliente_b2c_id?: string | null
          comite_revelado_at?: string | null
          completada_at?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          domicilio?: string | null
          dormitorios?: number | null
          entidad_id?: string | null
          enviado_a_comite_at?: string | null
          es_referencial?: boolean
          estado?: Database["public"]["Enums"]["estado_tasacion"]
          estado_conservacion?:
            | Database["public"]["Enums"]["estado_conservacion"]
            | null
          id?: string
          inspeccion_ocular_completada_at?: string | null
          lat?: number | null
          lng?: number | null
          motivo: Database["public"]["Enums"]["motivo_tasacion"]
          numero?: number
          numero_busqueda?: string | null
          padron_inmobiliario?: string | null
          pdf_compartido_at?: string | null
          pdf_generado_at?: string | null
          pdf_url?: string | null
          solicitante_id?: string | null
          sup_cubierta?: number | null
          sup_total?: number | null
          tasador_asignado_at?: string | null
          tasador_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_inmueble"]
          tipo_tasacion?: Database["public"]["Enums"]["tipo_tasacion"]
          updated_at?: string
          valor_ars?: number | null
          valor_fitt_servini_ars?: number | null
          valor_robotomus_ars?: number | null
          valor_usd?: number | null
          visita_programada_at?: string | null
        }
        Update: {
          amenities?: string[] | null
          antiguedad_anios?: number | null
          banios?: number | null
          cierre_at?: string | null
          cierre_metodo?: string | null
          cierre_motivo?: string | null
          cliente_b2c_id?: string | null
          comite_revelado_at?: string | null
          completada_at?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          domicilio?: string | null
          dormitorios?: number | null
          entidad_id?: string | null
          enviado_a_comite_at?: string | null
          es_referencial?: boolean
          estado?: Database["public"]["Enums"]["estado_tasacion"]
          estado_conservacion?:
            | Database["public"]["Enums"]["estado_conservacion"]
            | null
          id?: string
          inspeccion_ocular_completada_at?: string | null
          lat?: number | null
          lng?: number | null
          motivo?: Database["public"]["Enums"]["motivo_tasacion"]
          numero?: number
          numero_busqueda?: string | null
          padron_inmobiliario?: string | null
          pdf_compartido_at?: string | null
          pdf_generado_at?: string | null
          pdf_url?: string | null
          solicitante_id?: string | null
          sup_cubierta?: number | null
          sup_total?: number | null
          tasador_asignado_at?: string | null
          tasador_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_inmueble"]
          tipo_tasacion?: Database["public"]["Enums"]["tipo_tasacion"]
          updated_at?: string
          valor_ars?: number | null
          valor_fitt_servini_ars?: number | null
          valor_robotomus_ars?: number | null
          valor_usd?: number | null
          visita_programada_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasaciones_cliente_b2c_id_fkey"
            columns: ["cliente_b2c_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasaciones_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasaciones_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "solicitantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasaciones_tasador_id_fkey"
            columns: ["tasador_id"]
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
      actualizar_roles_miembro: {
        Args: {
          _entidad: string
          _roles: Database["public"]["Enums"]["rol_entidad_miembro"][]
          _user: string
        }
        Returns: undefined
      }
      agregar_miembro_por_email: {
        Args: {
          _email: string
          _entidad: string
          _roles: Database["public"]["Enums"]["rol_entidad_miembro"][]
        }
        Returns: string
      }
      asignar_tasador_a_tasacion: {
        Args: { p_tasacion_id: string; p_tasador_id: string }
        Returns: {
          amenities: string[] | null
          antiguedad_anios: number | null
          banios: number | null
          cierre_at: string | null
          cierre_metodo: string | null
          cierre_motivo: string | null
          cliente_b2c_id: string | null
          comite_revelado_at: string | null
          completada_at: string | null
          creado_por: string | null
          created_at: string
          descripcion: string | null
          domicilio: string | null
          dormitorios: number | null
          entidad_id: string | null
          enviado_a_comite_at: string | null
          es_referencial: boolean
          estado: Database["public"]["Enums"]["estado_tasacion"]
          estado_conservacion:
            | Database["public"]["Enums"]["estado_conservacion"]
            | null
          id: string
          inspeccion_ocular_completada_at: string | null
          lat: number | null
          lng: number | null
          motivo: Database["public"]["Enums"]["motivo_tasacion"]
          numero: number
          numero_busqueda: string | null
          padron_inmobiliario: string | null
          pdf_compartido_at: string | null
          pdf_generado_at: string | null
          pdf_url: string | null
          solicitante_id: string | null
          sup_cubierta: number | null
          sup_total: number | null
          tasador_asignado_at: string | null
          tasador_id: string | null
          tipo: Database["public"]["Enums"]["tipo_inmueble"]
          tipo_tasacion: Database["public"]["Enums"]["tipo_tasacion"]
          updated_at: string
          valor_ars: number | null
          valor_fitt_servini_ars: number | null
          valor_robotomus_ars: number | null
          valor_usd: number | null
          visita_programada_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tasaciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_solicitante: {
        Args: { _solicitante_id: string }
        Returns: boolean
      }
      can_access_tasacion_comite: {
        Args: { _tasacion_id: string }
        Returns: boolean
      }
      can_generar_informe: { Args: { _tasacion_id: string }; Returns: boolean }
      can_read_tasacion: { Args: { _tasacion_id: string }; Returns: boolean }
      can_write_informe: { Args: { _tasacion_id: string }; Returns: boolean }
      can_write_tasacion: { Args: { _tasacion_id: string }; Returns: boolean }
      crear_tasacion_profesional: {
        Args: {
          p_amenities: string[]
          p_antiguedad_anios: number
          p_banios: number
          p_descripcion: string
          p_domicilio: string
          p_dormitorios: number
          p_estado_conservacion: Database["public"]["Enums"]["estado_conservacion"]
          p_lat: number
          p_lng: number
          p_motivo: Database["public"]["Enums"]["motivo_tasacion"]
          p_padron_inmobiliario: string
          p_sol_apellido: string
          p_sol_email: string
          p_sol_nombre: string
          p_sol_telefono: string
          p_sup_cubierta: number
          p_sup_total: number
          p_tipo: Database["public"]["Enums"]["tipo_inmueble"]
          p_tipo_tasacion: Database["public"]["Enums"]["tipo_tasacion"]
        }
        Returns: {
          id: string
          numero: number
        }[]
      }
      current_user_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      listar_miembros_entidad: {
        Args: { _entidad: string }
        Returns: {
          apellido: string
          created_at: string
          email: string
          matricula: string
          nombre: string
          roles: Database["public"]["Enums"]["rol_entidad_miembro"][]
          telefono: string
          user_id: string
        }[]
      }
      marcar_inspeccion_ocular: {
        Args: { _cuando?: string; _tasacion_id: string }
        Returns: string
      }
      marcar_pdf_compartido: { Args: { _tasacion_id: string }; Returns: string }
      programar_visita: {
        Args: { _cuando?: string; _tasacion_id: string }
        Returns: string
      }
      quitar_miembro_entidad: {
        Args: { _entidad: string; _user: string }
        Returns: undefined
      }
      reclamar_tasacion: {
        Args: { p_tasacion_id: string }
        Returns: {
          amenities: string[] | null
          antiguedad_anios: number | null
          banios: number | null
          cierre_at: string | null
          cierre_metodo: string | null
          cierre_motivo: string | null
          cliente_b2c_id: string | null
          comite_revelado_at: string | null
          completada_at: string | null
          creado_por: string | null
          created_at: string
          descripcion: string | null
          domicilio: string | null
          dormitorios: number | null
          entidad_id: string | null
          enviado_a_comite_at: string | null
          es_referencial: boolean
          estado: Database["public"]["Enums"]["estado_tasacion"]
          estado_conservacion:
            | Database["public"]["Enums"]["estado_conservacion"]
            | null
          id: string
          inspeccion_ocular_completada_at: string | null
          lat: number | null
          lng: number | null
          motivo: Database["public"]["Enums"]["motivo_tasacion"]
          numero: number
          numero_busqueda: string | null
          padron_inmobiliario: string | null
          pdf_compartido_at: string | null
          pdf_generado_at: string | null
          pdf_url: string | null
          solicitante_id: string | null
          sup_cubierta: number | null
          sup_total: number | null
          tasador_asignado_at: string | null
          tasador_id: string | null
          tipo: Database["public"]["Enums"]["tipo_inmueble"]
          tipo_tasacion: Database["public"]["Enums"]["tipo_tasacion"]
          updated_at: string
          valor_ars: number | null
          valor_fitt_servini_ars: number | null
          valor_robotomus_ars: number | null
          valor_usd: number | null
          visita_programada_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tasaciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_pdf_url: {
        Args: { _pdf_url: string; _tasacion_id: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tasacion_id_from_storage_name: {
        Args: { _name: string }
        Returns: string
      }
      tasadores_de_entidad: {
        Args: { _entidad: string }
        Returns: {
          apellido: string
          email: string
          matricula: string
          nombre: string
          tasacion_id: string
          user_id: string
        }[]
      }
      user_has_role_in_entidad: {
        Args: {
          _entidad: string
          _role: Database["public"]["Enums"]["rol_entidad_miembro"]
        }
        Returns: boolean
      }
    }
    Enums: {
      estado_conservacion: "muy_bueno" | "bueno" | "regular" | "a_reciclar"
      estado_tasacion: "pendiente" | "en_proceso" | "en_comite" | "completada"
      motivo_tasacion:
        | "venta"
        | "alquiler"
        | "asesoramiento_particulares"
        | "empresas"
        | "expropiaciones"
        | "divisiones_fraccionamientos"
        | "sucesion"
        | "judicial"
        | "extrajudicial"
        | "hipoteca"
      rol_entidad_miembro: "admin" | "tasador" | "solicitante"
      rol_usuario:
        | "tasador"
        | "comite"
        | "admin"
        | "cliente_b2c"
        | "cliente_b2b"
      tipo_entidad:
        | "inmobiliaria"
        | "banco"
        | "constructora"
        | "juzgado"
        | "otro"
        | "unipersonal"
      tipo_inmueble:
        | "casa"
        | "depto"
        | "terreno"
        | "galpon"
        | "local"
        | "oficina"
        | "finca"
      tipo_tasacion: "venta" | "alquiler" | "ambos"
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
      estado_conservacion: ["muy_bueno", "bueno", "regular", "a_reciclar"],
      estado_tasacion: ["pendiente", "en_proceso", "en_comite", "completada"],
      motivo_tasacion: [
        "venta",
        "alquiler",
        "asesoramiento_particulares",
        "empresas",
        "expropiaciones",
        "divisiones_fraccionamientos",
        "sucesion",
        "judicial",
        "extrajudicial",
        "hipoteca",
      ],
      rol_entidad_miembro: ["admin", "tasador", "solicitante"],
      rol_usuario: ["tasador", "comite", "admin", "cliente_b2c", "cliente_b2b"],
      tipo_entidad: [
        "inmobiliaria",
        "banco",
        "constructora",
        "juzgado",
        "otro",
        "unipersonal",
      ],
      tipo_inmueble: ["casa", "depto", "terreno", "galpon", "local", "oficina", "finca"],
      tipo_tasacion: ["venta", "alquiler", "ambos"],
    },
  },
} as const
