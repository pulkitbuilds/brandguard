import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
export const dynamic = "force-dynamic";

export const POST = guard(["admin"], async (req, u) => {
  const { filename, proposed, accepted } = await req.json();
  await store().addImport({ filename: String(filename || "guideline").slice(0, 120), proposed: Number(proposed) || 0, accepted: Number(accepted) || 0, user_email: u.email });
  return json({ ok: true });
});
