import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { DEFAULT_RULES, DEFAULT_FACTS } from "@/lib/engine";
import { err } from "@/lib/workflow";
import { reviewBase } from "@/lib/services";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Grounded explanation + checked rewrite. The Python endpoint is internal, so this route is the only way in.
export const POST = guard(null, async (req) => {
  const { text, finding } = await req.json();
  const book = (await store().rulebook()) || { rules: DEFAULT_RULES, facts: DEFAULT_FACTS };
  const r = await fetch(reviewBase(new URL(req.url).origin) + "/api/py/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.INTERNAL_KEY ? { "x-internal-key": process.env.INTERNAL_KEY } : {}) },
    body: JSON.stringify({ text, finding: { i: finding.i, len: finding.len, text: finding.text, cat: finding.cat }, rules: book.rules, facts: book.facts }),
  }).catch(() => null);
  if (!r) throw err(503, "The review service is not reachable");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw err(r.status, d.detail || "Explain failed");
  return json(d);
});
