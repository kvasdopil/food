import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  if (process.env.NODE_ENV === "development") {
    console.warn("Supabase service role credentials are missing. Add them to `.env.local`.");
  }
}

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : undefined;
