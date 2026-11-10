import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { extractFile } from "@/lib/extract";
import { err } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin uploads a brand guideline (PDF/DOCX); returns PROPOSED rules, each tied to a page. Nothing is saved here.
export const POST = guard(["admin"], async (req) => {
  const file = (await req.formData()).get("file");
  const doc = await extractFile(file);
  const first = {};
  for (const w of doc.words) if (!(w.p in first)) first[w.p] = w.s;
  const page_starts = Object.entries(first).map(([p, s]) => [s, Number(p)]);
  const existing = (await store().rulebook())?.rules || "";
  const r = await fetch(new URL(req.url).origin + "/api/py/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.INTERNAL_KEY ? { "x-internal-key": process.env.INTERNAL_KEY } : {}) },
    body: JSON.stringify({ text: doc.text, page_starts, existing_rules: existing }),
  }).catch(() => null);
  if (!r) throw err(503, "The review service is not reachable");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw err(r.status, d.detail || "Could not analyse the guideline");
  return json({ filename: file.name, pages: doc.pages.length || null, ...d });
});
