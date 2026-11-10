import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { err } from "@/lib/workflow";
export const dynamic = "force-dynamic";

export const GET = guard(null, async () => json({ versions: await store().rulebookVersions() }));
// Rollback = a NEW version that copies an old one, so history is never lost.
export const POST = guard(["admin"], async (req, u) => {
  const { restore } = await req.json();
  const old = await store().rulebookVersion(Number(restore));
  if (!old) throw err(404, "Version not found");
  return json({ ok: true, version: await store().saveRulebook({ rules: old.rules, facts: old.facts }, u.email, `Rolled back to v${old.version}`) });
});
