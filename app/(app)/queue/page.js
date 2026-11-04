"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { STAGES } from "@/lib/constants";

export default function Queue() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api("/api/reviews").then((d) => setRows(d.reviews)).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const mine = (r) => (r.stage === 1 && ["manager", "admin"].includes(user.role)) || (r.stage === 2 && ["reviewer", "admin"].includes(user.role));
  async function act(r, action) {
    setMsg("");
    try { await api(`/api/reviews/${r.id}/transition`, "POST", { action }); await load(); } catch (e) { setMsg(`${r.title}: ${e.message}`); }
  }
  if (!rows) return <p className="note">{msg || "Loading…"}</p>;
  const queue = rows.filter(mine), other = rows.filter((r) => !mine(r) && (r.stage === 1 || r.stage === 2));
  return (
    <div className="stack">
      <section>
        <h2>Waiting for you</h2>
        {msg && <p className="low" role="alert">{msg}</p>}
        {!queue.length ? <p className="src">Nothing is waiting for your approval.</p> : (
          <div style={{ overflowX: "auto" }}><table><thead><tr><th>Title</th><th>Author</th><th>Stage</th><th>Open issues</th><th>Actions</th></tr></thead>
            <tbody>{queue.map((r) => (
              <tr key={r.id}><td><Link href={`/review?id=${r.id}`}>{r.title}</Link></td><td>{r.author_email}</td><td>{STAGES[r.stage]}</td><td>{r.issues}</td>
                <td><div className="row"><button className="p" onClick={() => act(r, "approve")}>Approve</button><button onClick={() => act(r, "return")}>Return</button></div></td></tr>
            ))}</tbody></table></div>
        )}
      </section>
      <section><h2>Elsewhere in the pipeline</h2>
        {!other.length ? <p className="src">Nothing else is in approval.</p> : <ul>{other.map((r) => <li key={r.id}><Link href={`/review?id=${r.id}`}>{r.title}</Link> · {STAGES[r.stage]} · {r.author_email}</li>)}</ul>}
      </section>
    </div>
  );
}
