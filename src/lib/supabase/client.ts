import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Without env vars the panel runs in demo mode: sample data, nothing is saved.
export const isDemo = !url || !anonKey;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (isDemo) return null;
  client ??= createBrowserClient(url!, anonKey!);
  return client;
}
