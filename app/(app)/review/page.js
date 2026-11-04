"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/client";
import { review as localReview, key, WHY, SAMPLE } from "@/lib/engine";
import { STAGES } from "@/lib/constants";

function Editor() {
  const { user } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [rev, setRev] = useState(null);
  const [text, setText] = useState("");
  const [book, setBook] = useState(null);
  const [finds, setFinds] = useState([]);
  const [engine, setEngine] = useState("");
  const [dismissed, setDismissed] = useState([]);
  const [notes, setNotes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [msg, setMsg] = useState({ t: "", err: false });
  const say = (t, err = false) => setMsg({ t, err });

  const load = useCallback(async () => {
    try {
      setBook(await api("/api/rulebook"));
      if (!id) { setRev(null); setText(""); setDismissed([]); setAudit([]); return; }
      const r = await api(`/api/reviews/${id}`);
      setRev(r); setText(r.content); setDismissed(r.dismissed || []); setAudit(r.audit || []); setNotes([]);
    } catch (e) { say(e.message, true); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Live check: Python ML backend first, browser engine as fallback
  useEffect(() => {
    if (!book) return;
    const t = setTimeout(async () => {
      try {
        const d = await api("/api/py/review", "POST", { text, rules: book.rules, facts: book.facts });
        setFinds(d.findings); setEngine(d.engine);
      } catch { setFinds(localReview(text, book.rules, book.facts)); setEngine("Browser engine"); }
    }, 350);
    return () => clearTimeout(t);
  }, [text, book]);

  const editable = !rev || (rev.stage === 0 && (rev.author_id === user.id || user.role === "admin"));
  const dk = dismissed.map((d) => d.key);
  const open = finds.filter((f) => !dk.includes(key(f)));
  const canApprove = rev && ((rev.stage === 1 && ["manager", "admin"].includes(user.role)) || (rev.stage === 2 && ["reviewer", "admin"].includes(user.role)));

  async function save() {
    const body = { title: text.slice(0, 60), content: text, findings: finds.map(({ cat, text, src }) => ({ cat, text, src })), dismissed, notes };
    if (rev) { await api(`/api/reviews/${rev.id}`, "PATCH", body); setNotes([]); return rev.id; }
    const r = await api("/api/reviews", "POST", body); setNotes([]);
    router.replace(`/review?id=${r.id}`);
    return r.id;
  }
  async function run(fn, ok) {
    try { await fn(); say(ok); await load(); } catch (e) { say(e.message, true); }
  }
  const act = (action, ok) => run(async () => {
    const rid = editable ? await save() : rev.id;
    await api(`/api/reviews/${rid}/transition`, "POST", { action, note: action === "return" ? window.prompt("Note for the creator (optional)") || "" : undefined });
  }, ok);
  const accept = (f) => {
    let r = f.rep;
    if (/^[A-Z]/.test(f.text) && /^[a-z]/.test(r)) r = r[0].toUpperCase() + r.slice(1);
    setText(text.slice(0, f.i) + r + text.slice(f.i + f.len));
    setNotes((n) => [...n, `Accepted fix for ${f.cat.toLowerCase()} issue “${f.text}”`]);
  };
  const dismiss = (f) => {
    setDismissed((d) => [...d, { key: key(f), cat: f.cat, text: f.text, src: f.src }]);
    setNotes((n) => [...n, `Dismissed ${f.cat.toLowerCase()} issue “${f.text}”`]);
  };

  const segs = []; let pos = 0;
  open.forEach((f, n) => {
    if (f.i < pos) return;
    segs.push(text.slice(pos, f.i));
    segs.push(<mark key={n} style={{ background: `color-mix(in srgb,var(--c-${f.cat}) 22%,transparent)`, color: `var(--c-${f.cat})` }}><span style={{ color: "var(--ink)" }}>{text.slice(f.i, f.i + f.len)}</span></mark>);
    pos = f.i + f.len;
  });
  segs.push(text.slice(pos));

  if (!book) return <p className="note">{msg.t || "Loading…"}</p>;
  return (
    <div className="review">
      <div className="stack">
        <section>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{rev ? rev.title : "New review"}</h2>
            <div className="stages">{STAGES.map((s, i) => <span key={s} className={"st " + (rev && i === rev.stage ? "on" : rev && i < rev.stage ? "done" : "")}>{s}</span>)}</div>
          </div>
          {rev && <p className="src" style={{ margin: "6px 0 0" }}>Author: {rev.author_email}</p>}
          {!editable && <p className="note">{rev?.stage > 0 ? "This review is in approval and locked. An approver can return it to the creator for edits." : "Only the author can edit this draft."}</p>}
          <label htmlFor="text">Draft (text, HTML or Markdown). The check updates as you type.</label>
          <textarea id="text" spellCheck={false} readOnly={!editable} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            {editable && <button onClick={() => !rev && !text ? setText(SAMPLE) : run(save, "Saved.")}>{!rev && !text ? "Load sample draft" : "Save draft"}</button>}
            {editable && <button className="p" disabled={!text.trim()} onClick={() => act("submit", "Submitted for approval.")}>Submit for approval</button>}
            {canApprove && <button className="p" onClick={() => act("approve", "Approved.")}>{rev.stage === 1 ? "Approve and send to reviewer" : "Approve for publishing"}</button>}
            {canApprove && <button onClick={() => act("return", "Returned to the creator.")}>Return to creator</button>}
          </div>
          {msg.t && <p className={msg.err ? "low" : "note"} role="status">{msg.t}</p>}
          <p className="note">Engine: {engine || "starting…"}</p>
          <h2 style={{ marginTop: 14 }}>Where the issues are</h2>
          <div id="prev">{text.trim() ? segs : <span className="src">Nothing to review yet.</span>}</div>
        </section>
        <section><details open><summary>Audit trail</summary>
          <ol className="log">{audit.map((a, i) => <li key={i}>{new Date(a.created_at).toLocaleString()} · {a.user_email} ({a.role}): {a.action}</li>)}{!audit.length && <li>Nothing yet. Save the draft to start the trail.</li>}</ol>
        </details></section>
      </div>
      <section aria-live="polite">
        <div className={"verdict " + (text.trim() && !open.length ? "ok" : "")}>{!text.trim() ? "Waiting for a draft" : !open.length ? "No open issues." : `${open.length} open issue${open.length > 1 ? "s" : ""}`}</div>
        {open.map((f, n) => (
          <div className="card" key={n} style={{ "--k": `var(--c-${f.cat})` }}>
            <b className="t">{f.cat}</b> · <q>{f.text}</q>
            <p>{WHY[f.cat] || "Breaks a brand rule."}</p>
            <p><b>Suggestion:</b> {f.rep !== null ? <>Replace with <q>{f.rep}</q></> : f.fixmsg || "Add evidence from the approved claims list, or remove this claim."}</p>
            <p className="src">Rule: {f.src} · Confidence {Math.round(f.conf * 100)}%{f.conf < 0.7 && <span className="low"> Needs a human check</span>}</p>
            {editable && <div className="row">{f.rep !== null && <button className="p" onClick={() => accept(f)}>Accept fix</button>}<button onClick={() => dismiss(f)}>Dismiss</button></div>}
          </div>
        ))}
        {dismissed.length > 0 && <p className="src">{dismissed.length} dismissed.{editable && <> <button onClick={() => setDismissed([])}>Restore</button></>}</p>}
      </section>
    </div>
  );
}

export default function ReviewPage() { return <Suspense fallback={<p className="note">Loading…</p>}><Editor /></Suspense>; }
