/**
 * Supabase 자동 생성 타입 stub.
 *
 * 마이그레이션이 Cloud에 적용된 후 다음 명령으로 재생성:
 *   npm run db:gen-types > src/lib/supabase/types.ts
 *
 * 1차 stub: 미들웨어와 클라이언트가 필요로 하는 최소 스키마만 손으로 정의.
 * 후속 PR에서 실제 generated 타입으로 대체.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type StoreType = "bingsu_cafe" | "cafe" | "dessert_cafe";
type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
type IngredientUnit = "g" | "ml" | "piece";
type PriceHistoryReason =
  | "purchase"
  | "stock_count_correction"
  | "sale_consumption"
  | "sale_edit_revert"
  | "sale_edit_apply";

interface UsersRow {
  id: string;
  email: string;
  store_name: string;
  store_type: StoreType;
  regular_days_off: Weekday[];
  signed_up_at: string;
  withdrawal_requested_at: string | null;
  permanent_delete_at: string | null;
  analytics_consent: boolean;
  created_at: string;
  updated_at: string;
}

interface IngredientsRow {
  id: string;
  user_id: string;
  name: string;
  unit: IngredientUnit;
  current_stock: number;
  current_avg_price: number;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface IngredientPriceHistoryRow {
  id: string;
  user_id: string;
  ingredient_id: string;
  changed_at: string;
  previous_avg_price: number;
  new_avg_price: number;
  previous_stock: number;
  new_stock: number;
  reason: PriceHistoryReason;
  reference_id: string | null;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UsersRow;
        Insert: Pick<UsersRow, "id" | "email" | "store_name" | "store_type"> &
          Partial<Omit<UsersRow, "id" | "email" | "store_name" | "store_type">>;
        Update: Partial<UsersRow>;
        Relationships: [];
      };
      ingredients: {
        Row: IngredientsRow;
        Insert: Pick<IngredientsRow, "user_id" | "name" | "unit"> &
          Partial<Omit<IngredientsRow, "user_id" | "name" | "unit">>;
        Update: Partial<IngredientsRow>;
        Relationships: [];
      };
      ingredient_price_history: {
        Row: IngredientPriceHistoryRow;
        Insert: Omit<IngredientPriceHistoryRow, "id" | "changed_at"> &
          Partial<Pick<IngredientPriceHistoryRow, "id" | "changed_at">>;
        Update: Partial<IngredientPriceHistoryRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      store_type: StoreType;
      weekday: Weekday;
      ingredient_unit: IngredientUnit;
      price_history_reason: PriceHistoryReason;
    };
    CompositeTypes: Record<string, never>;
  };
}
