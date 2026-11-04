import { createClient } from "@supabase/supabase-js";

// Server-side only. Returns null when env vars are missing so the app still runs offline.
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}
