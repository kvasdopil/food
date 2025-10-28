import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // In development we log a helpful hint when env vars are missing.
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Supabase environment variables are missing. Add them to `.env.local`.",
    );
  }
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : undefined;
