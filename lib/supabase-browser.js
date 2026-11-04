import { createClient } from "@supabase/supabase-js";
const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supa = u && k ? createClient(u, k) : null;
