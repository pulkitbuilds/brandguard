import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { transition, err } from "@/lib/workflow";
export const dynamic = "force-dynamic";

export const POST = guard(null, async (req, u, { id }) => {
  const r = await store().review(id);
  if (!r || (u.role === "creator" && r.author_id !== u.id)) throw err(404, "Review not found");
  const { action, note } = await req.json();
  const updated = await transition(store(), u, id, action, note, new URL(req.url).origin);
  return json({ ok: true, stage: updated.stage });
});
