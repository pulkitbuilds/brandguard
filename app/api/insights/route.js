import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { APPROVER } from "@/lib/constants";
export const dynamic = "force-dynamic";

export const GET = guard(APPROVER, async () => {
  const all = await store().reviews();
  const funnel = [0, 0, 0, 0], cat = {}, rules = {}, terms = {};
  for (const r of all) {
    funnel[r.stage]++;
    const dk = (r.dismissed || []).map((d) => d.key);
    for (const f of r.findings || []) {
      const k = f.cat + ":" + f.text.toLowerCase(), gone = dk.includes(k);
      cat[f.cat] = (cat[f.cat] || 0) + 1;
      rules[f.src] = rules[f.src] || { src: f.src, count: 0, dismissed: 0 };
      rules[f.src].count++; if (gone) rules[f.src].dismissed++;
      const t = f.text.toLowerCase(); terms[t] = (terms[t] || 0) + 1;
    }
  }
  const top = (o) => Object.entries(o).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const imps = await store().imports();
  const proposed = imps.reduce((a, i) => a + i.proposed, 0), accepted = imps.reduce((a, i) => a + i.accepted, 0);
  return json({ imports: { count: imps.length, proposed, accepted, rate: proposed ? accepted / proposed : null }, total: all.length, funnel, categories: top(cat), rules: Object.values(rules).sort((a, b) => b.count - a.count), terms: top(terms).slice(0, 8) });
});
