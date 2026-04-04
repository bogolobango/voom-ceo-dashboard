import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

// Require the service role key unless we're explicitly in local development.
// "production" check: NODE_ENV=production OR the presence of RENDER=true (Render.com sets this)
// OR PORT is set (deployed environments typically set PORT). If none of these signal "dev",
// we assume production and require the service role key.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

if (!isDev && !serviceRoleKey && supabaseUrl) {
  throw new Error(
    "[supabase] FATAL: SUPABASE_SERVICE_ROLE_KEY is required in deployed environments. " +
    "The server cannot run with an anon key because admin operations (vendor verification, " +
    "tier changes, notifications) will fail silently due to RLS policies. " +
    "Set NODE_ENV=development to bypass this check for local dev."
  );
}

const supabaseKey = serviceRoleKey || anonKey || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] Supabase URL or key not set — running in offline mode.");
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;
