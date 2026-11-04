import { guard, json } from "@/lib/route";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { err } from "@/lib/workflow";
export const dynamic = "force-dynamic";

export const GET = guard(["admin"], async () => json({ users: await store().profiles() }));
export const PATCH = guard(["admin"], async (req, u) => {
  const { id, role } = await req.json();
  if (!ROLES.includes(role)) throw err(400, "Unknown role");
  if (id === u.id) throw err(409, "You cannot change your own role");
  await store().setRole(id, role);
  return json({ ok: true });
});
