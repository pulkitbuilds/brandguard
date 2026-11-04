import { guard, json } from "@/lib/route";
export const dynamic = "force-dynamic";
export const GET = guard(null, async (_req, u) => json({ user: u }));
