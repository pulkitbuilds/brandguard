"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, token } from "@/lib/client";

export default function Rulebook() {
  const { user } = useAuth();
  const admin = user.role === "admin";
  const [b, setB] = useState(null);
  const [versions, setVersions] = useState([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(null); // { filename, proposals: [{..., on, line}] }

  const load = useCallback(async () => {
    try { setB(await api("/api/rulebook")); setVersions((await api("/api/rulebook/versions")).versions); } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    try { const r = await api("/api/rulebook", "PUT", { rules: b.rules, facts: b.facts, note }); setMsg(`Saved as version ${r.version}.`); setNote(""); load(); } catch (e) { setMsg(e.message); }
  }
  async function restore(v) {
    if (!window.confirm(`Create a new version that copies v${v}?`)) return;
    try { const r = await api("/api/rulebook/versions", "POST", { restore: v }); setMsg(`Rolled back. Saved as version ${r.version}.`); load(); } catch (e) { setMsg(e.message); }
  }
  async function upload(file) {
    if (!file) return;
    setBusy(true); setMsg("Reading the guideline…");
    try {
      const fd = new FormData(); fd.append("file", file);
      const t = await token();
      const r = await fetch("/api/rulebook/propose", { method: "POST", headers: t ? { Authorization: "Bearer " + t } : {}, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Upload failed");
      setImp({ filename: d.filename, proposals: d.proposals.map((p) => ({ ...p, on: p.conf >= 0.8 })) });
      setMsg(d.proposals.length ? `${d.proposals.length} rule(s) proposed${d.llm ? "" : " (pattern-based; no AI model configured)"}. Review each one.` : "No rules could be proposed from this file.");
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  const setP = (id, patch) => setImp((s) => ({ ...s, proposals: s.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  async function addSelected() {
    const on = imp.proposals.filter((p) => p.on && p.line.trim());
    const rules = on.filter((p) => p.kind === "rule").map((p) => p.line.trim()), facts = on.filter((p) => p.kind === "fact").map((p) => p.line.trim());
    setB({ ...b, rules: [b.rules.trim(), ...rules].filter(Boolean).join("\n"), facts: [b.facts.trim(), ...facts].filter(Boolean).join("\n") });
    try { await api("/api/rulebook/import-log", "POST", { filename: imp.filename, proposed: imp.proposals.length, accepted: on.length }); } catch {}
    setMsg(`${on.length} of ${imp.proposals.length} proposed rules added to the text below. Save to create a new version.`);
    setImp(null);
  }

  if (!b) return <p className="note">{msg || "Loading…"}</p>;
  return (
    <div className="stack">
      <section>
        <h2>Brand rulebook <span className="src">(version {b.version})</span></h2>
        <p className="src" style={{ margin: 0 }}>{admin ? "Each save creates a new version." : "Read only. Only an admin can change the rulebook."} One rule per line: category | pattern | fix | source. “Semantic” lines hold an example of a prohibited claim and match sentences with the same meaning. Use “(…)” as the fix when no automatic fix exists.</p>
        <label htmlFor="r">Rules (Terminology, Tone, Claims, Semantic)</label>
        <textarea id="r" rows={14} readOnly={!admin} spellCheck={false} value={b.rules} onChange={(e) => setB({ ...b, rules: e.target.value })} />
        <label htmlFor="f">Approved facts (name: value) and approved claims</label>
        <textarea id="f" rows={6} readOnly={!admin} spellCheck={false} value={b.facts} onChange={(e) => setB({ ...b, facts: e.target.value })} />
        {admin && <div className="row" style={{ marginTop: 10 }}><input type="text" style={{ maxWidth: 320 }} placeholder="What changed? (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Version note" /><button className="p" onClick={save}>Save as new version</button></div>}
        {msg && <p className="note" role="status">{msg}</p>}
      </section>
      {admin && (
        <section>
          <h2>Import from a brand guideline</h2>
          <p className="src" style={{ margin: "0 0 8px" }}>Upload the guideline (PDF or DOCX). Rules are proposed with the page they came from. You accept, edit or reject each one; nothing is applied automatically.</p>
          <label className="btn" style={{ cursor: "pointer" }}>{busy ? "Reading…" : "Upload guideline"}<input type="file" hidden disabled={busy} accept=".pdf,.docx" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} /></label>
          {imp && imp.proposals.length > 0 && (
            <>
              <div style={{ overflowX: "auto", marginTop: 10 }}><table><thead><tr><th>Use</th><th>Proposed rule (editable)</th><th>From the guideline</th><th>Conf.</th></tr></thead><tbody>
                {imp.proposals.map((p) => (
                  <tr key={p.id}><td><input type="checkbox" checked={p.on} onChange={(e) => setP(p.id, { on: e.target.checked })} aria-label={"Use " + p.id} /></td>
                    <td><input type="text" value={p.line} onChange={(e) => setP(p.id, { line: e.target.value })} aria-label={"Rule " + p.id} /></td>
                    <td className="src">{p.page ? `p.${p.page}: ` : ""}{p.quote}</td><td>{Math.round(p.conf * 100)}%</td></tr>
                ))}</tbody></table></div>
              <div className="row" style={{ marginTop: 10 }}><button className="p" onClick={addSelected}>Add {imp.proposals.filter((p) => p.on).length} selected to the rulebook</button><button onClick={() => setImp(null)}>Discard</button></div>
            </>
          )}
        </section>
      )}
      <section>
        <h2>Version history</h2>
        <div style={{ overflowX: "auto" }}><table><thead><tr><th>Version</th><th>By</th><th>When</th><th>Note</th>{admin && <th />}</tr></thead><tbody>
          {versions.map((v) => (
            <tr key={v.version}><td>v{v.version}{v.version === b.version ? " (current)" : ""}</td><td>{v.created_by}</td><td>{new Date(v.created_at).toLocaleString()}</td><td>{v.note}</td>
              {admin && <td>{v.version !== b.version && <button onClick={() => restore(v.version)}>Roll back to this</button>}</td>}</tr>
          ))}</tbody></table></div>
      </section>
    </div>
  );
}
