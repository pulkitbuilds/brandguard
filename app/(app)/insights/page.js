"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { STAGES } from "@/lib/constants";

function Bars({ rows, max }) {
  const m = max || Math.max(1, ...rows.map((r) => r.count));
  return <div>{rows.map((r) => <div className="bar" key={r.name}><span>{r.name}</span><i style={{ width: (r.count / m) * 100 + "%" }} /><b>{r.count}</b></div>)}</div>;
}
export default function Insights() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/insights").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="low">{err}</p>;
  if (!d) return <p className="note">Loading…</p>;
  const unclear = d.rules.filter((r) => r.count >= 1 && r.dismissed / r.count >= 0.5);
  return (
    <div className="stack">
      <section><h2>Where reviews are in the pipeline ({d.total} total)</h2><Bars rows={d.funnel.map((count, i) => ({ name: STAGES[i], count }))} /></section>
      <section><h2>Issues by type</h2>{d.categories.length ? <Bars rows={d.categories} /> : <p className="src">No issues recorded yet.</p>}</section>
      <section><h2>Most repeated mistakes</h2>{d.terms.length ? <Bars rows={d.terms} /> : <p className="src">Nothing yet.</p>}</section>
      <section>
        <h2>Rules that may be unclear</h2>
        <p className="src" style={{ margin: "0 0 8px" }}>Rules whose findings creators dismiss at least half the time. Consider rewording them or adding approved claims.</p>
        {unclear.length ? <ul>{unclear.map((r) => <li key={r.src}>{r.src}: dismissed {r.dismissed} of {r.count}</li>)}</ul> : <p className="src">No rule is being dismissed that often.</p>}
        <details><summary>All rules by findings</summary><ul>{d.rules.map((r) => <li key={r.src}>{r.src}: {r.count} found, {r.dismissed} dismissed</li>)}</ul></details>
      </section>
    </div>
  );
}
