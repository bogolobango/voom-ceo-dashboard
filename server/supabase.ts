import { createClient } from "@supabase/supabase-js";

// Server-side: use non-VITE_ prefixed env vars to prevent client bundle leakage.
// Falls back to VITE_ prefixed vars for backwards compatibility during migration.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] Supabase URL or key not set — running in offline mode.");
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;
