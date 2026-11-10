import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { DEFAULT_RULES, DEFAULT_FACTS } from "@/lib/engine";
export const dynamic = "force-dynamic";

export const GET = guard(null, async () => json((await store().rulebook()) || { rules: DEFAULT_RULES, facts: DEFAULT_FACTS, version: 0 }));
// Every save creates a new version; nothing is overwritten.
export const PUT = guard(["admin"], async (req, u) => {
  const { rules, facts, note } = await req.json();
  return json({ ok: true, version: await store().saveRulebook({ rules: rules || "", facts: facts || "" }, u.email, note) });
});
