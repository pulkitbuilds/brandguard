"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { APPROVER } from "@/lib/constants";
import ReviewTable from "@/components/ReviewTable";

export default function Dashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/reviews").then((d) => setRows(d.reviews)).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="low">{err}</p>;
  if (!rows) return <p className="note">Loading…</p>;
  const mine = rows.filter((r) => r.author_id === user.id);
  const waiting = rows.filter((r) => (r.stage === 1 && ["manager", "admin"].includes(user.role)) || (r.stage === 2 && ["reviewer", "admin"].includes(user.role)));
  const cards = [
    ["My drafts", mine.filter((r) => r.stage === 0).length, "/review"],
    ["In approval", rows.filter((r) => r.stage === 1 || r.stage === 2).length, APPROVER.includes(user.role) ? "/queue" : "/dashboard"],
    ["Approved", rows.filter((r) => r.stage === 3).length, "/dashboard"],
  ];
  if (APPROVER.includes(user.role)) cards.unshift(["Waiting for me", waiting.length, "/queue"]);
  return (
    <div className="stack">
      <section>
        <h2>Welcome, {user.name || user.email}</h2>
        <p className="src" style={{ margin: "0 0 12px" }}>You are signed in as {user.role}. {user.role === "creator" ? "Write a draft, fix the flagged issues, then submit it for approval." : "Open the Approvals tab to act on reviews waiting for you."}</p>
        <div className="cards">{cards.map(([l, n, h]) => <Link key={l} href={h} className="stat"><b>{n}</b><span>{l}</span></Link>)}</div>
        <div className="row" style={{ marginTop: 12 }}><Link className="btn p" href="/review">New review</Link></div>
      </section>
      <section><h2>Recent reviews</h2><ReviewTable rows={rows.slice(0, 10)} empty="No reviews yet. Start with New review." /></section>
    </div>
  );
}
