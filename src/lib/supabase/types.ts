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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ingredient_price_history: {
        Row: {
          changed_at: string
          id: string
          ingredient_id: string
          new_avg_price: number
          new_stock: number
          previous_avg_price: number
          previous_stock: number
          reason: Database["public"]["Enums"]["price_history_reason"]
          reference_id: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          ingredient_id: string
          new_avg_price: number
          new_stock: number
          previous_avg_price: number
          previous_stock: number
          reason: Database["public"]["Enums"]["price_history_reason"]
          reference_id?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          ingredient_id?: string
          new_avg_price?: number
          new_stock?: number
          previous_avg_price?: number
          previous_stock?: number
          reason?: Database["public"]["Enums"]["price_history_reason"]
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_price_history_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_price_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          current_avg_price: number
          current_stock: number
          expiry_date: string | null
          id: string
          is_active: boolean
          name: string
          unit: Database["public"]["Enums"]["ingredient_unit"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_avg_price?: number
          current_stock?: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit: Database["public"]["Enums"]["ingredient_unit"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_avg_price?: number
          current_stock?: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit?: Database["public"]["Enums"]["ingredient_unit"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_templates: {
        Row: {
          id: string
          name: string
          price: number
          recipe: Json
          store_type: Database["public"]["Enums"]["store_type"]
        }
        Insert: {
          id?: string
          name: string
          price: number
          recipe: Json
          store_type: Database["public"]["Enums"]["store_type"]
        }
        Update: {
          id?: string
          name?: string
          price?: number
          recipe?: Json
          store_type?: Database["public"]["Enums"]["store_type"]
        }
        Relationships: []
      }
      menus: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          menu_id: string
          quantity_per_serving: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          menu_id: string
          quantity_per_serving: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          menu_id?: string
          quantity_per_serving?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          analytics_consent: boolean
          created_at: string
          email: string
          id: string
          permanent_delete_at: string | null
          regular_days_off: Database["public"]["Enums"]["weekday"][]
          signed_up_at: string
          store_name: string
          store_type: Database["public"]["Enums"]["store_type"]
          updated_at: string
          withdrawal_requested_at: string | null
        }
        Insert: {
          analytics_consent?: boolean
          created_at?: string
          email: string
          id: string
          permanent_delete_at?: string | null
          regular_days_off?: Database["public"]["Enums"]["weekday"][]
          signed_up_at?: string
          store_name: string
          store_type: Database["public"]["Enums"]["store_type"]
          updated_at?: string
          withdrawal_requested_at?: string | null
        }
        Update: {
          analytics_consent?: boolean
          created_at?: string
          email?: string
          id?: string
          permanent_delete_at?: string | null
          regular_days_off?: Database["public"]["Enums"]["weekday"][]
          signed_up_at?: string
          store_name?: string
          store_type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
          withdrawal_requested_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clone_menu_template: {
        Args: { p_store_type: Database["public"]["Enums"]["store_type"] }
        Returns: {
          ingredient_ids: string[]
          menu_ids: string[]
        }[]
      }
      request_withdrawal: {
        Args: never
        Returns: {
          permanent_delete_at: string
          success: boolean
        }[]
      }
      update_regular_days_off: {
        Args: { p_days_off: Database["public"]["Enums"]["weekday"][] }
        Returns: {
          days_off: Database["public"]["Enums"]["weekday"][]
          success: boolean
        }[]
      }
    }
    Enums: {
      ingredient_unit: "g" | "ml" | "piece"
      price_history_reason:
        | "purchase"
        | "stock_count_correction"
        | "sale_consumption"
        | "sale_edit_revert"
        | "sale_edit_apply"
      store_type: "bingsu_cafe" | "cafe" | "dessert_cafe"
      weekday: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ingredient_unit: ["g", "ml", "piece"],
      price_history_reason: [
        "purchase",
        "stock_count_correction",
        "sale_consumption",
        "sale_edit_revert",
        "sale_edit_apply",
      ],
      store_type: ["bingsu_cafe", "cafe", "dessert_cafe"],
      weekday: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    },
  },
} as const
