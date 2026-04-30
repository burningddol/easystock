/**
 * Supabase 자동 생성 타입 stub.
 *
 * 마이그레이션이 Cloud에 적용된 후 다음 명령으로 재생성:
 *   npm run db:gen-types > src/lib/supabase/types.ts
 *
 * 1차 stub: 미들웨어/클라이언트/도메인 함수가 필요로 하는 최소 스키마.
 * 후속 PR에서 실제 generated 타입으로 대체.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          store_name: string;
          store_type: Database["public"]["Enums"]["store_type"];
          regular_days_off: Database["public"]["Enums"]["weekday"][];
          signed_up_at: string;
          withdrawal_requested_at: string | null;
          permanent_delete_at: string | null;
          analytics_consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          store_name: string;
          store_type: Database["public"]["Enums"]["store_type"];
          regular_days_off?: Database["public"]["Enums"]["weekday"][];
          signed_up_at?: string;
          withdrawal_requested_at?: string | null;
          permanent_delete_at?: string | null;
          analytics_consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          store_name?: string;
          store_type?: Database["public"]["Enums"]["store_type"];
          regular_days_off?: Database["public"]["Enums"]["weekday"][];
          signed_up_at?: string;
          withdrawal_requested_at?: string | null;
          permanent_delete_at?: string | null;
          analytics_consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          unit: Database["public"]["Enums"]["ingredient_unit"];
          current_stock: number;
          current_avg_price: number;
          expiry_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          unit: Database["public"]["Enums"]["ingredient_unit"];
          current_stock?: number;
          current_avg_price?: number;
          expiry_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          unit?: Database["public"]["Enums"]["ingredient_unit"];
          current_stock?: number;
          current_avg_price?: number;
          expiry_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredient_price_history: {
        Row: {
          id: string;
          user_id: string;
          ingredient_id: string;
          changed_at: string;
          previous_avg_price: number;
          new_avg_price: number;
          previous_stock: number;
          new_stock: number;
          reason: Database["public"]["Enums"]["price_history_reason"];
          reference_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          ingredient_id: string;
          changed_at?: string;
          previous_avg_price: number;
          new_avg_price: number;
          previous_stock: number;
          new_stock: number;
          reason: Database["public"]["Enums"]["price_history_reason"];
          reference_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          ingredient_id?: string;
          changed_at?: string;
          previous_avg_price?: number;
          new_avg_price?: number;
          previous_stock?: number;
          new_stock?: number;
          reason?: Database["public"]["Enums"]["price_history_reason"];
          reference_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_regular_days_off: {
        Args: { p_days_off: string[] };
        Returns: { success: boolean; days_off: string[] }[];
      };
      request_withdrawal: {
        Args: Record<PropertyKey, never>;
        Returns: { success: boolean; permanent_delete_at: string }[];
      };
    };
    Enums: {
      store_type: "bingsu_cafe" | "cafe" | "dessert_cafe";
      weekday: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
      ingredient_unit: "g" | "ml" | "piece";
      price_history_reason:
        | "purchase"
        | "stock_count_correction"
        | "sale_consumption"
        | "sale_edit_revert"
        | "sale_edit_apply";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
