import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { err } from "@/lib/workflow";
export const dynamic = "force-dynamic";

async function load(u, id) {
  const r = await store().review(id);
  if (!r || (u.role === "creator" && r.author_id !== u.id)) throw err(404, "Review not found");
  return r;
}
export const GET = guard(null, async (_req, u, { id }) => {
  const r = await load(u, id);
  return json({ ...r, audit: await store().audit(id) });
});
export const PATCH = guard(null, async (req, u, { id }) => {
  const r = await load(u, id);
  if (r.author_id !== u.id && u.role !== "admin") throw err(403, "Only the author can edit this draft");
  if (r.stage !== 0) throw err(409, "This review is in approval. Ask for it to be returned before editing.");
  const b = await req.json();
  const patch = { rulebook_version: (await store().rulebook())?.version || 0 };
  for (const k of ["title", "content", "findings", "dismissed", "source"]) if (b[k] !== undefined) patch[k] = b[k];
  const updated = await store().updateReview(id, patch);
  for (const n of b.notes || []) await store().addAudit({ review_id: id, user_email: u.email, role: u.role, action: n });
  return json({ ok: true, stage: updated.stage });
});
