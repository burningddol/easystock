import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

export function createClient(): BrowserSupabaseClient {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
