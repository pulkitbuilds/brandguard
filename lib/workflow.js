import { review, key, DEFAULT_RULES, DEFAULT_FACTS } from "./engine";

export const err = (status, message) => Object.assign(new Error(message), { status });

// Same findings the editor shows: Python engine (incl. semantic checks) first, browser engine if it is down.
export async function currentFindings(content, book, origin) {
  try {
    const r = await fetch(origin + "/api/py/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: content, rules: book.rules, facts: book.facts }) });
    if (r.ok) return (await r.json()).findings;
  } catch {}
  return review(content, book.rules, book.facts);
}
export async function openIssues(st, r, origin, book) {
  const b = book || (await st.rulebook()) || { rules: DEFAULT_RULES, facts: DEFAULT_FACTS };
  const dk = (r.dismissed || []).map((d) => d.key);
  return (await currentFindings(r.content, b, origin)).filter((f) => !dk.includes(key(f))).length;
}

// Server-side enforcement of Creator -> Manager -> Reviewer approval, against the CURRENT rulebook version.
export async function transition(st, u, id, action, note, origin) {
  const r = await st.review(id);
  if (!r) throw err(404, "Review not found");
  const book = (await st.rulebook()) || { rules: DEFAULT_RULES, facts: DEFAULT_FACTS, version: 0 };
  const open = await openIssues(st, r, origin, book);
  const own = r.author_id === u.id || u.role === "admin";
  let to, log;
  if (action === "submit") {
    if (r.stage !== 0 || !own) throw err(403, "Only the author can submit a draft");
    if (!r.content.trim()) throw err(400, "The draft is empty");
    if (open) throw err(409, `Resolve or dismiss ${open} open issue(s) first`);
    to = 1; log = "Submitted for approval";
  } else if (action === "approve") {
    if (r.stage === 1) {
      if (!["manager", "admin"].includes(u.role)) throw err(403, "Only a manager can approve this stage");
      if (open) throw err(409, `${open} open issue(s) remain. Return it to the creator.`);
      to = 2; log = "Approved by manager, sent to reviewer";
    } else if (r.stage === 2) {
      if (!["reviewer", "admin"].includes(u.role)) throw err(403, "Only a reviewer can give final approval");
      to = 3; log = "Approved for publishing" + (open ? ` with ${open} open issue(s) overridden` : "");
    } else throw err(409, "Nothing to approve at this stage");
  } else if (action === "return") {
    const ok = (r.stage === 1 && ["manager", "admin"].includes(u.role)) || (r.stage === 2 && ["reviewer", "admin"].includes(u.role));
    if (!ok) throw err(403, "You cannot return this review");
    to = 0; log = "Returned to creator" + (note ? `: ${note}` : "");
  } else throw err(400, "Unknown action");
  const updated = await st.updateReview(id, { stage: to, rulebook_version: book.version });
  await st.addAudit({ review_id: id, user_email: u.email, role: u.role, action: `${log} (checked with rules v${book.version})` });
  return updated;
}
