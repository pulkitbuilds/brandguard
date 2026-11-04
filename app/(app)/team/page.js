"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { ROLES } from "@/lib/constants";

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState("");
  const load = () => api("/api/team").then((d) => setUsers(d.users)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  if (!users) return <p className="note">{msg || "Loading…"}</p>;
  return (
    <section>
      <h2>Team and roles</h2>
      <p className="src" style={{ margin: "0 0 8px" }}>Creators write drafts. Managers give the first approval. Reviewers give final approval. Admins also edit the rulebook and manage roles.</p>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Email</th><th>Role</th></tr></thead><tbody>
        {users.map((u) => (
          <tr key={u.id}><td>{u.email}</td><td>
            <select aria-label={"Role for " + u.email} value={u.role} disabled={u.id === user.id} onChange={async (e) => { try { await api("/api/team", "PATCH", { id: u.id, role: e.target.value }); setMsg("Role updated."); load(); } catch (x) { setMsg(x.message); } }}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select></td></tr>
        ))}</tbody></table></div>
      {msg && <p className="note" role="status">{msg}</p>}
    </section>
  );
}
