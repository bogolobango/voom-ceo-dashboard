import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

// In production, require the service role key for privileged operations
// (vendor status changes, tier updates, notifications, etc.).
// In development, fall back to anon key for convenience.
const isProduction = process.env.NODE_ENV === "production";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (isProduction && !serviceRoleKey) {
  throw new Error(
    "[supabase] FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production. " +
    "The server cannot run with an anon key because admin operations (vendor verification, " +
    "tier changes, notifications) will fail silently due to RLS policies."
  );
}

const supabaseKey = serviceRoleKey || anonKey || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] Supabase URL or key not set — running in offline mode.");
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;
