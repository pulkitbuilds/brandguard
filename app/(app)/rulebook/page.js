"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";

export default function Rulebook() {
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [msg, setMsg] = useState("");
  const admin = user.role === "admin";
  useEffect(() => { api("/api/rulebook").then(setB).catch((e) => setMsg(e.message)); }, []);
  if (!b) return <p className="note">{msg || "Loading…"}</p>;
  return (
    <section>
      <h2>Brand rulebook</h2>
      <p className="src" style={{ margin: 0 }}>{admin ? "Changes apply to every new review check straight away." : "Read only. Only an admin can change the rulebook."} One rule per line: category | pattern | fix | source. Use “(…)” as the fix when no automatic fix exists.</p>
      <label htmlFor="r">Rules (Terminology, Tone, Claims)</label>
      <textarea id="r" rows={14} readOnly={!admin} spellCheck={false} value={b.rules} onChange={(e) => setB({ ...b, rules: e.target.value })} />
      <label htmlFor="f">Approved facts (name: value) and approved claims</label>
      <textarea id="f" rows={6} readOnly={!admin} spellCheck={false} value={b.facts} onChange={(e) => setB({ ...b, facts: e.target.value })} />
      {admin && <div className="row" style={{ marginTop: 10 }}><button className="p" onClick={async () => { try { await api("/api/rulebook", "PUT", b); setMsg("Rulebook saved."); } catch (e) { setMsg(e.message); } }}>Save rulebook</button></div>}
      {msg && <p className="note" role="status">{msg}</p>}
    </section>
  );
}
