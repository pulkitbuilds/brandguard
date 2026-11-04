import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { DEFAULT_RULES, DEFAULT_FACTS } from "@/lib/engine";
export const dynamic = "force-dynamic";

export const GET = guard(null, async () => json((await store().rulebook()) || { rules: DEFAULT_RULES, facts: DEFAULT_FACTS }));
export const PUT = guard(["admin"], async (req) => {
  const { rules, facts } = await req.json();
  await store().saveRulebook({ rules: rules || "", facts: facts || "" });
  return json({ ok: true });
});
