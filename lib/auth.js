import { db } from "./supabase";
import { store } from "./store";

export async function authUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const s = db();
  if (!s) return store().userByToken(token);
  const { data, error } = await s.auth.getUser(token);
  if (error || !data.user) return null;
  return store().profile({ id: data.user.id, email: data.user.email });
}
