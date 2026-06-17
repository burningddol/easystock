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
      daily_stock_counts: {
        Row: {
          counted_at: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          counted_at: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          counted_at?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stock_counts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
      purchase_order_items: {
        Row: {
          amount: number
          id: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          unit_price: number | null
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          unit_price?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          ingredient_id?: string
          purchase_order_id?: string
          quantity?: number
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          purchased_at: string
          total_amount: number
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          purchased_at: string
          total_amount?: number
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          purchased_at?: string
          total_amount?: number
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          last_used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          last_used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
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
      sale_edit_history: {
        Row: {
          after_items: Json | null
          before_items: Json
          change_type: Database["public"]["Enums"]["sale_change_type"]
          changed_at: string
          id: string
          reason: string | null
          sale_id: string
          user_id: string
        }
        Insert: {
          after_items?: Json | null
          before_items: Json
          change_type: Database["public"]["Enums"]["sale_change_type"]
          changed_at?: string
          id?: string
          reason?: string | null
          sale_id: string
          user_id: string
        }
        Update: {
          after_items?: Json | null
          before_items?: Json
          change_type?: Database["public"]["Enums"]["sale_change_type"]
          changed_at?: string
          id?: string
          reason?: string | null
          sale_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_edit_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_edit_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          menu_cost_snapshot: number
          menu_id: string
          quantity: number
          sale_id: string
          unit_price: number
          user_id: string
        }
        Insert: {
          id?: string
          menu_cost_snapshot: number
          menu_id: string
          quantity: number
          sale_id: string
          unit_price: number
          user_id: string
        }
        Update: {
          id?: string
          menu_cost_snapshot?: number
          menu_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          id: string
          sold_at: string
          total_cost_snapshot: number
          total_revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sold_at: string
          total_cost_snapshot?: number
          total_revenue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sold_at?: string
          total_cost_snapshot?: number
          total_revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          actual_stock: number
          id: string
          ingredient_id: string
          stock_count_id: string
          system_stock_at_count: number
          user_id: string
          weekly_loss_amount: number
        }
        Insert: {
          actual_stock: number
          id?: string
          ingredient_id: string
          stock_count_id: string
          system_stock_at_count: number
          user_id: string
          weekly_loss_amount: number
        }
        Update: {
          actual_stock?: number
          id?: string
          ingredient_id?: string
          stock_count_id?: string
          system_stock_at_count?: number
          user_id?: string
          weekly_loss_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "daily_stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_user_id_fkey"
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
          safety_buffer_days: number
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
          safety_buffer_days?: number
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
          safety_buffer_days?: number
          signed_up_at?: string
          store_name?: string
          store_type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
          withdrawal_requested_at?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_stock_count: {
        Args: { p_counted_at: string; p_items: Json }
        Returns: {
          item_differences: Json
          stock_count_id: string
          weekly_loss_amount: number
        }[]
      }
      clone_menu_template: {
        Args: { p_store_type: Database["public"]["Enums"]["store_type"] }
        Returns: {
          ingredient_ids: string[]
          menu_ids: string[]
        }[]
      }
      delete_ingredient: {
        Args: { p_ingredient_id: string }
        Returns: {
          in_use_menu_count: number
          ingredient_id: string
          was_active: boolean
        }[]
      }
      delete_menu: {
        Args: { p_menu_id: string }
        Returns: {
          menu_id: string
          was_active: boolean
        }[]
      }
      delete_sale: { Args: { p_sale_id: string }; Returns: undefined }
      edit_menu: {
        Args: {
          p_menu_id: string
          p_name: string
          p_price: number
          p_recipe?: Json
        }
        Returns: {
          menu_id: string
        }[]
      }
      edit_sale: {
        Args: { p_new_items: Json; p_reason?: string; p_sale_id: string }
        Returns: {
          margin_percent: number
          sale_id: string
          total_cost_snapshot: number
          total_net_profit: number
          total_revenue: number
        }[]
      }
      get_calendar_month: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      get_depletion_forecast: {
        Args: never
        Returns: {
          consumption_samples: Json
          current_stock: number
          ingredient_id: string
          is_default_lead_time: boolean
          lead_time_days: number
          lead_time_vendor_name: string | null
          name: string
          regular_days_off: Database["public"]["Enums"]["weekday"][]
          safety_buffer_days: number
          signed_up_at: string
          unit: Database["public"]["Enums"]["ingredient_unit"]
        }[]
      }
      get_menu_demand_forecast: {
        Args: never
        Returns: {
          demand_samples: Json
          is_active: boolean
          menu_id: string
          name: string
          price: number
          regular_days_off: Database["public"]["Enums"]["weekday"][]
          signed_up_at: string
        }[]
      }
      get_today_dashboard: { Args: never; Returns: Json }
      request_withdrawal: {
        Args: never
        Returns: {
          permanent_delete_at: string
          success: boolean
        }[]
      }
      save_ingredient: {
        Args: {
          p_name: string
          p_unit: Database["public"]["Enums"]["ingredient_unit"]
        }
        Returns: {
          current_avg_price: number
          id: string
          name: string
          unit: Database["public"]["Enums"]["ingredient_unit"]
        }[]
      }
      save_menu: {
        Args: { p_name: string; p_price: number; p_recipe?: Json }
        Returns: {
          menu_id: string
        }[]
      }
      save_purchase: {
        Args: { p_items: Json; p_purchased_at: string; p_vendor_id: string }
        Returns: {
          price_change_alerts: Json
          purchase_order_id: string
        }[]
      }
      save_sale: {
        Args: { p_items: Json; p_sold_at: string }
        Returns: {
          margin_percent: number
          sale_id: string
          total_cost_snapshot: number
          total_net_profit: number
          total_revenue: number
        }[]
      }
      save_vendor: {
        Args: { p_lead_time_days?: number; p_name: string }
        Returns: {
          id: string
          lead_time_days: number
          name: string
        }[]
      }
      subscribe_push: {
        Args: {
          p_endpoint: string
          p_keys_auth: string
          p_keys_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      unsubscribe_push: { Args: { p_endpoint: string }; Returns: undefined }
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
      sale_change_type: "edit" | "delete"
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
      sale_change_type: ["edit", "delete"],
      store_type: ["bingsu_cafe", "cafe", "dessert_cafe"],
      weekday: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    },
  },
} as const
