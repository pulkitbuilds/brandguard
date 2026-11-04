"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, DEMO } from "@/lib/client";
import { supa } from "@/lib/supabase-browser";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setUser((await api("/api/me")).user); } catch { setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function signIn(email, password) {
    if (DEMO) {
      const r = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      localStorage.setItem("bg_token", d.token);
    } else {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await refresh();
  }
  async function signUp(email, password) {
    if (DEMO) throw new Error("Sign-up is off in demo mode. Use one of the demo accounts.");
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) return "confirm";
    await refresh();
  }
  async function signOut() {
    if (DEMO) localStorage.removeItem("bg_token"); else await supa.auth.signOut();
    setUser(null);
  }
  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}
