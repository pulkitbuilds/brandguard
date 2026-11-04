import { supa } from "./supabase-browser";
export const DEMO = !supa;
export async function token() {
  if (DEMO) return localStorage.getItem("bg_token");
  const { data } = await supa.auth.getSession();
  return data.session?.access_token || null;
}
export async function api(url, method = "GET", body) {
  const t = await token();
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}
