import { json } from "@/lib/route";
import { isDemo, store } from "@/lib/store";
export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isDemo()) return json({ error: "Demo login is disabled when Supabase is configured" }, 404);
  const { email, password } = await req.json();
  const r = await store().login(email, password);
  return r ? json(r) : json({ error: "Wrong email or password" }, 401);
}
